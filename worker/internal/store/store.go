package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles persistence operations for jobs.
type Store struct {
	pool *pgxpool.Pool
}

// insertChunkSize bounds how many rows are pipelined per batch.
const insertChunkSize = 500

// StudentRow is a validated, insert-ready student. PII fields are encrypted on
// write by the store via vault.encrypt_pii; nil pointers become SQL NULL.
type StudentRow struct {
	ID         string
	LastName   string
	FirstName  string
	MiddleName *string
	Email      *string
	Phone      *string
	BirthDate  *time.Time
}

// GuardianRow is a validated, insert-ready guardian.
type GuardianRow struct {
	ID           string
	LastName     string
	FirstName    string
	MiddleName   *string
	Email        *string
	Phone        *string
	RelationType string
}

// LinkRow is a validated student↔guardian association.
type LinkRow struct {
	StudentID  string
	GuardianID string
}

// NewStore creates a new Store instance.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// UpdateStatus updates the status and progress of a job.
func (s *Store) UpdateStatus(ctx context.Context, jobID string, status string, progress int) error {
	query := `
		UPDATE core.jobs
		SET status = $1, progress = $2, updated_at = $3
		WHERE id = $4
	`
	now := time.Now()
	tag, err := s.pool.Exec(ctx, query, status, progress, now, jobID)
	if err != nil {
		return fmt.Errorf("failed to update job status: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("job not found: %s", jobID)
	}
	return nil
}

// MarkDone marks a job as done with progress 100% and sets the result.
func (s *Store) MarkDone(ctx context.Context, jobID string, result any) error {
	query := `
		UPDATE core.jobs
		SET status = $1, progress = $2, result = $3, updated_at = $4, error = NULL
		WHERE id = $5
	`
	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal job result: %w", err)
	}

	now := time.Now()
	tag, err := s.pool.Exec(ctx, query, "done", 100, resultJSON, now, jobID)
	if err != nil {
		return fmt.Errorf("failed to mark job as done: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("job not found: %s", jobID)
	}
	return nil
}

// MarkFailed marks a job as failed and sets the error message.
func (s *Store) MarkFailed(ctx context.Context, jobID string, errMsg string) error {
	query := `
		UPDATE core.jobs
		SET status = $1, error = $2, updated_at = $3
		WHERE id = $4
	`
	now := time.Now()
	tag, err := s.pool.Exec(ctx, query, "failed", errMsg, now, jobID)
	if err != nil {
		return fmt.Errorf("failed to mark job as failed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("job not found: %s", jobID)
	}
	return nil
}

const insertStudentQuery = `
	INSERT INTO core.students (id, last_name, first_name, middle_name, email, phone, birth_date)
	VALUES ($1, vault.encrypt_pii($2), vault.encrypt_pii($3), vault.encrypt_pii($4),
	        vault.encrypt_pii($5), vault.encrypt_pii($6), $7)
	ON CONFLICT (id) DO NOTHING
`

// InsertStudents writes students in idempotent batches and returns how many
// rows were newly inserted (duplicates are skipped via ON CONFLICT).
func (s *Store) InsertStudents(ctx context.Context, rows []StudentRow) (int, error) {
	inserted := 0
	for start := 0; start < len(rows); start += insertChunkSize {
		end := min(start+insertChunkSize, len(rows))
		batch := &pgx.Batch{}
		for _, r := range rows[start:end] {
			batch.Queue(insertStudentQuery, r.ID, r.LastName, r.FirstName,
				r.MiddleName, r.Email, r.Phone, r.BirthDate)
		}
		n, err := execBatch(ctx, s.pool, batch, end-start)
		inserted += n
		if err != nil {
			return inserted, fmt.Errorf("insert students: %w", err)
		}
	}
	return inserted, nil
}

const insertGuardianQuery = `
	INSERT INTO core.guardians (id, last_name, first_name, middle_name, email, phone, relation_type)
	VALUES ($1, vault.encrypt_pii($2), vault.encrypt_pii($3), vault.encrypt_pii($4),
	        vault.encrypt_pii($5), vault.encrypt_pii($6), $7)
	ON CONFLICT (id) DO NOTHING
`

// InsertGuardians writes guardians in idempotent batches and returns the number
// of newly inserted rows.
func (s *Store) InsertGuardians(ctx context.Context, rows []GuardianRow) (int, error) {
	inserted := 0
	for start := 0; start < len(rows); start += insertChunkSize {
		end := min(start+insertChunkSize, len(rows))
		batch := &pgx.Batch{}
		for _, r := range rows[start:end] {
			batch.Queue(insertGuardianQuery, r.ID, r.LastName, r.FirstName,
				r.MiddleName, r.Email, r.Phone, r.RelationType)
		}
		n, err := execBatch(ctx, s.pool, batch, end-start)
		inserted += n
		if err != nil {
			return inserted, fmt.Errorf("insert guardians: %w", err)
		}
	}
	return inserted, nil
}

// InsertLink writes a single student↔guardian association idempotently.
// It returns true if a new row was inserted (false if it already existed).
func (s *Store) InsertLink(ctx context.Context, studentID, guardianID string) (bool, error) {
	tag, err := s.pool.Exec(ctx,
		`INSERT INTO core.student_guardian (student_id, guardian_id) VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`,
		studentID, guardianID,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// execBatch sends a batch, reads all results, and returns the total rows
// affected. The first error stops reading and is returned.
func execBatch(ctx context.Context, pool *pgxpool.Pool, batch *pgx.Batch, count int) (int, error) {
	br := pool.SendBatch(ctx, batch)
	defer br.Close()

	affected := 0
	for i := 0; i < count; i++ {
		tag, err := br.Exec()
		if err != nil {
			return affected, err
		}
		affected += int(tag.RowsAffected())
	}
	return affected, nil
}
