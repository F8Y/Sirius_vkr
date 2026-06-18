package consumer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"sirius27/worker/internal/anonymizer"
	"sirius27/worker/internal/config"
	"sirius27/worker/internal/importer"
	"sirius27/worker/internal/job"
	"sirius27/worker/internal/store"
)

// Consumer handles reading jobs from Redis Stream and orchestrating execution.
type Consumer struct {
	cfg   *config.Config
	redis *redis.Client
	store *store.Store
}

// NewConsumer creates a new Consumer instance.
func NewConsumer(cfg *config.Config, rdb *redis.Client, dbStore *store.Store) *Consumer {
	return &Consumer{
		cfg:   cfg,
		redis: rdb,
		store: dbStore,
	}
}

// Start runs the consumption loop. It blocks until ctx is cancelled.
func (c *Consumer) Start(ctx context.Context) error {
	log.Printf("[Consumer] Starting consumer group %s, consumer name %s", c.cfg.ConsumerGroup, c.cfg.ConsumerName)

	// 1. Ensure Stream and Consumer Group exist
	err := c.ensureConsumerGroup(ctx)
	if err != nil {
		return fmt.Errorf("failed to prepare consumer group: %w", err)
	}

	// 2. Start consumption loop
	for {
		select {
		case <-ctx.Done():
			log.Println("[Consumer] Shutting down consumption loop...")
			return nil
		default:
			// Read a message from the Stream
			// Using block of 2s to allow responsive shutdown
			msgs, err := c.redis.XReadGroup(ctx, &redis.XReadGroupArgs{
				Group:    c.cfg.ConsumerGroup,
				Consumer: c.cfg.ConsumerName,
				Streams:  []string{c.cfg.StreamName, ">"},
				Count:    1,
				Block:    2 * time.Second,
			}).Result()

			if err != nil {
				if errors.Is(err, redis.Nil) {
					// No new messages, block timed out. Continue loop.
					continue
				}
				if ctx.Err() != nil {
					// Context cancelled, exit loop.
					return nil
				}
				log.Printf("[Consumer] Error reading from stream: %v. Retrying in 2 seconds...", err)
				time.Sleep(2 * time.Second)
				continue
			}

			for _, stream := range msgs {
				for _, msg := range stream.Messages {
					c.processMessage(ctx, msg)
				}
			}
		}
	}
}

// ensureConsumerGroup creates the consumer group if it doesn't already exist.
func (c *Consumer) ensureConsumerGroup(ctx context.Context) error {
	// Create group at id "0" — must match backend (main.py / publisher.py) so the
	// group's start position is deterministic regardless of who wins the startup race.
	// "0" gives at-least-once delivery from the very first message in the stream.
	err := c.redis.XGroupCreateMkStream(ctx, c.cfg.StreamName, c.cfg.ConsumerGroup, "0").Err()
	if err != nil {
		// If group already exists, go-redis returns a "BUSYGROUP" error which is fine
		if err.Error() == "BUSYGROUP Consumer Group name already exists" {
			log.Println("[Consumer] Consumer group already exists, resuming consumption.")
			return nil
		}
		return err
	}
	log.Printf("[Consumer] Created consumer group %s on stream %s", c.cfg.ConsumerGroup, c.cfg.StreamName)
	return nil
}

// processMessage handles parsing, executing and acknowledging a single stream message.
func (c *Consumer) processMessage(ctx context.Context, msg redis.XMessage) {
	log.Printf("[Consumer] Received stream message ID: %s", msg.ID)

	// Extract data field
	dataJSON, exists := msg.Values["data"]
	if !exists {
		log.Printf("[Consumer] [Warning] Message %s does not contain 'data' key", msg.ID)
		c.acknowledge(ctx, msg.ID)
		return
	}

	dataStr, ok := dataJSON.(string)
	if !ok {
		log.Printf("[Consumer] [Warning] 'data' in message %s is not a string", msg.ID)
		c.acknowledge(ctx, msg.ID)
		return
	}

	// Parse JSON job
	var streamMsg job.JobStreamMessage
	if err := json.Unmarshal([]byte(dataStr), &streamMsg); err != nil {
		log.Printf("[Consumer] [Error] Failed to unmarshal message JSON: %v", err)
		c.acknowledge(ctx, msg.ID)
		return
	}

	log.Printf("[Consumer] Processing job ID: %s, type: %s", streamMsg.JobID, streamMsg.Type)

	// Run job execution pipeline
	err := c.executeJob(ctx, streamMsg)
	if err != nil {
		log.Printf("[Consumer] [Error] Job %s execution failed: %v", streamMsg.JobID, err)
		// Mark failed in DB
		if dbErr := c.store.MarkFailed(ctx, streamMsg.JobID, err.Error()); dbErr != nil {
			log.Printf("[Consumer] [Error] Failed to mark job %s as failed in database: %v", streamMsg.JobID, dbErr)
		}
	} else {
		log.Printf("[Consumer] Job %s completed successfully", streamMsg.JobID)
	}

	// Acknowledge the stream message
	c.acknowledge(ctx, msg.ID)
}

// executeJob dispatches a job to the pipeline for its type.
func (c *Consumer) executeJob(ctx context.Context, msg job.JobStreamMessage) error {
	switch msg.Type {
	case "import":
		return c.runImport(ctx, msg)
	case "anonymize":
		return c.runAnonymize(ctx, msg)
	default:
		return fmt.Errorf("unknown job type: %q", msg.Type)
	}
}

// runImport executes the real CSV/XLSX import pipeline.
func (c *Consumer) runImport(ctx context.Context, msg job.JobStreamMessage) error {
	if msg.Payload.FilePath == nil || *msg.Payload.FilePath == "" {
		return fmt.Errorf("import job requires payload.file_path (dataset directory)")
	}

	if err := c.store.UpdateStatus(ctx, msg.JobID, "processing", 5); err != nil {
		return fmt.Errorf("failed to transition to processing: %w", err)
	}

	progress := func(p int) {
		if err := c.store.UpdateStatus(ctx, msg.JobID, "processing", p); err != nil {
			log.Printf("[Consumer] [Warning] progress update failed for job %s: %v", msg.JobID, err)
		}
	}

	report, err := importer.New(c.store).Run(ctx, *msg.Payload.FilePath, progress)
	if err != nil {
		return err
	}
	if err := c.store.MarkDone(ctx, msg.JobID, report); err != nil {
		return fmt.Errorf("failed to mark job as completed in DB: %w", err)
	}
	return nil
}

// runAnonymize executes the real de-identification pipeline (pseudonymize or
// anonymize) selected by payload.mode against payload.dataset.
func (c *Consumer) runAnonymize(ctx context.Context, msg job.JobStreamMessage) error {
	mode := ""
	if msg.Payload.Mode != nil {
		mode = *msg.Payload.Mode
	}
	if mode == "" {
		return fmt.Errorf("anonymize job requires payload.mode (pseudonymize|anonymize)")
	}
	dataset := "students"
	if msg.Payload.Dataset != nil && *msg.Payload.Dataset != "" {
		dataset = *msg.Payload.Dataset
	}

	if err := c.store.UpdateStatus(ctx, msg.JobID, "processing", 5); err != nil {
		return fmt.Errorf("failed to transition to processing: %w", err)
	}

	progress := func(p int) {
		if err := c.store.UpdateStatus(ctx, msg.JobID, "processing", p); err != nil {
			log.Printf("[Consumer] [Warning] progress update failed for job %s: %v", msg.JobID, err)
		}
	}

	report, err := anonymizer.New(c.store, c.cfg.OutputDir).Run(ctx, msg.JobID, mode, dataset, progress)
	if err != nil {
		return err
	}
	if err := c.store.MarkDone(ctx, msg.JobID, report); err != nil {
		return fmt.Errorf("failed to mark job as completed in DB: %w", err)
	}
	return nil
}

// acknowledge calls XACK to confirm processing is complete.
func (c *Consumer) acknowledge(ctx context.Context, msgID string) {
	err := c.redis.XAck(ctx, c.cfg.StreamName, c.cfg.ConsumerGroup, msgID).Err()
	if err != nil {
		log.Printf("[Consumer] [Error] Failed to ACK message %s: %v", msgID, err)
		return
	}
	log.Printf("[Consumer] Acknowledged message ID: %s", msgID)
}
