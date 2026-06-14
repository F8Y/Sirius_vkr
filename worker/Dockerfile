# ── Build Stage ────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy dependency manifests and download layers
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Compile optimized statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o worker cmd/worker/main.go

# ── Runtime Stage ──────────────────────────────────────────────
FROM alpine:3.19

# Add CA certificates for secure connections and time zone database
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy compiled binary from builder stage
COPY --from=builder /app/worker .

# Run the worker binary
CMD ["./worker"]
