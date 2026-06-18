package config

import (
	"os"
)

// Config holds all configuration parameters for the worker.
type Config struct {
	DatabaseURL   string
	RedisURL      string
	StreamName    string
	ConsumerGroup string
	ConsumerName  string
	OutputDir     string
}

// LoadConfig parses configuration from environment variables with safe fallbacks.
func LoadConfig() *Config {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://sirius:changeme@localhost:5432/sirius27?sslmode=disable"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	streamName := os.Getenv("STREAM_NAME")
	if streamName == "" {
		streamName = "jobs:stream"
	}

	consumerGroup := os.Getenv("CONSUMER_GROUP")
	if consumerGroup == "" {
		consumerGroup = "worker-group"
	}

	consumerName := os.Getenv("CONSUMER_NAME")
	if consumerName == "" {
		consumerName = "worker-1"
	}

	// Shared drop-zone (mounted in docker-compose). Import datasets are read
	// from here; anonymize jobs write their de-identified output under it.
	outputDir := os.Getenv("OUTPUT_DIR")
	if outputDir == "" {
		outputDir = "/data/imports"
	}

	return &Config{
		DatabaseURL:   dbURL,
		RedisURL:      redisURL,
		StreamName:    streamName,
		ConsumerGroup: consumerGroup,
		ConsumerName:  consumerName,
		OutputDir:     outputDir,
	}
}
