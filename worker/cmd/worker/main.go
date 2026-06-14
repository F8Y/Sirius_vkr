package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"sirius27/worker/internal/config"
	"sirius27/worker/internal/consumer"
	"sirius27/worker/internal/store"
)

func main() {
	log.Println("[Worker] Starting Sirius 27 Go Worker...")

	// 1. Load configuration
	cfg := config.LoadConfig()

	// Create root context that can be cancelled on OS shutdown signals
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 2. Connect to PostgreSQL with retry logic
	var pool *pgxpool.Pool
	var err error
	log.Println("[Worker] Connecting to PostgreSQL...")
	for i := 1; i <= 5; i++ {
		pool, err = pgxpool.New(ctx, cfg.DatabaseURL)
		if err == nil {
			// Ping the connection to be sure it's valid
			err = pool.Ping(ctx)
		}
		if err == nil {
			log.Println("[Worker] Successfully connected to PostgreSQL")
			break
		}
		log.Printf("[Worker] [Warning] Failed to connect to PostgreSQL (attempt %d/5): %v. Retrying in 2s...", i, err)
		if pool != nil {
			pool.Close()
		}
		select {
		case <-ctx.Done():
			log.Fatal("[Worker] Shutdown during PostgreSQL connection attempts")
		case <-time.After(2 * time.Second):
		}
	}
	if err != nil {
		log.Fatalf("[Worker] [Critical] Failed to connect to PostgreSQL after 5 attempts: %v", err)
	}
	defer pool.Close()

	// 3. Connect to Redis with retry logic
	var rdb *redis.Client
	log.Println("[Worker] Connecting to Redis...")
	for i := 1; i <= 5; i++ {
		opts, parseErr := redis.ParseURL(cfg.RedisURL)
		if parseErr != nil {
			log.Fatalf("[Worker] [Critical] Invalid Redis URL: %v", parseErr)
		}
		rdb = redis.NewClient(opts)

		// Test connection
		_, err = rdb.Ping(ctx).Result()
		if err == nil {
			log.Println("[Worker] Successfully connected to Redis")
			break
		}
		log.Printf("[Worker] [Warning] Failed to connect to Redis (attempt %d/5): %v. Retrying in 2s...", i, err)
		rdb.Close()
		select {
		case <-ctx.Done():
			log.Fatal("[Worker] Shutdown during Redis connection attempts")
		case <-time.After(2 * time.Second):
		}
	}
	if err != nil {
		log.Fatalf("[Worker] [Critical] Failed to connect to Redis after 5 attempts: %v", err)
	}
	defer rdb.Close()

	// 4. Initialize Store and Consumer
	dbStore := store.NewStore(pool)
	c := consumer.NewConsumer(cfg, rdb, dbStore)

	// 5. Run Consumer in a separate goroutine
	errChan := make(chan error, 1)
	go func() {
		errChan <- c.Start(ctx)
	}()

	log.Println("[Worker] Worker is active and waiting for tasks...")

	// 6. Block until context is cancelled or consumer returns an error
	select {
	case <-ctx.Done():
		log.Println("[Worker] Shutdown signal received. Commencing graceful shutdown...")
	case runErr := <-errChan:
		if runErr != nil {
			log.Printf("[Worker] [Error] Consumer crashed: %v", runErr)
		}
	}

	// 7. Cleanup and exit
	log.Println("[Worker] Closing PostgreSQL connection pool...")
	pool.Close()

	log.Println("[Worker] Closing Redis connection...")
	rdb.Close()

	log.Println("[Worker] Shutdown complete. Goodbye.")
}
