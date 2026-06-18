package store

import (
	"context"
	"encoding/json"
	"errors"
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

// ── De-identification (Batch 3) ──────────────────────────────────────────

// DecryptedStudent is a student row with its PII decrypted back to plaintext
// via vault.decrypt_pii. Nullable PII columns come back as nil pointers.
type DecryptedStudent struct {
	ID         string
	LastName   *string
	FirstName  *string
	MiddleName *string
	Email      *string
	Phone      *string
	BirthDate  *time.Time
}

// DecryptedGuardian is a guardian row with its PII decrypted to plaintext.
type DecryptedGuardian struct {
	ID           string
	LastName     *string
	FirstName    *string
	MiddleName   *string
	Email        *string
	Phone        *string
	RelationType *string
}

// LoadStudents reads every student and decrypts its PII through the vault
// SECURITY DEFINER function. This is the only path that turns stored ciphertext
// back into plaintext, so it is the entry point for both de-identification modes.
func (s *Store) LoadStudents(ctx context.Context) ([]DecryptedStudent, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text,
		       vault.decrypt_pii(last_name),
		       vault.decrypt_pii(first_name),
		       vault.decrypt_pii(middle_name),
		       vault.decrypt_pii(email),
		       vault.decrypt_pii(phone),
		       birth_date
		FROM core.students
		ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("load students: %w", err)
	}
	defer rows.Close()

	var out []DecryptedStudent
	for rows.Next() {
		var r DecryptedStudent
		if err := rows.Scan(&r.ID, &r.LastName, &r.FirstName, &r.MiddleName,
			&r.Email, &r.Phone, &r.BirthDate); err != nil {
			return nil, fmt.Errorf("scan student: %w", err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate students: %w", err)
	}
	return out, nil
}

// LoadGuardians reads every guardian and decrypts its PII to plaintext.
func (s *Store) LoadGuardians(ctx context.Context) ([]DecryptedGuardian, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id::text,
		       vault.decrypt_pii(last_name),
		       vault.decrypt_pii(first_name),
		       vault.decrypt_pii(middle_name),
		       vault.decrypt_pii(email),
		       vault.decrypt_pii(phone),
		       relation_type
		FROM core.guardians
		ORDER BY id
	`)
	if err != nil {
		return nil, fmt.Errorf("load guardians: %w", err)
	}
	defer rows.Close()

	var out []DecryptedGuardian
	for rows.Next() {
		var r DecryptedGuardian
		if err := rows.Scan(&r.ID, &r.LastName, &r.FirstName, &r.MiddleName,
			&r.Email, &r.Phone, &r.RelationType); err != nil {
			return nil, fmt.Errorf("scan guardian: %w", err)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate guardians: %w", err)
	}
	return out, nil
}

// UpsertPseudonym records (or re-confirms) the reversible mapping for one field
// of one entity in vault.pseudonym_map and returns the effective token.
//
// On the first call for a given (entity_type, entity_id, field_name) the
// supplied token is stored. On any later call the existing token is KEPT (only
// the original_hash is refreshed) and returned, so pseudonymization is stable
// and idempotent across re-runs. The map stores a hash of the original — never
// the plaintext — so the vault table alone does not leak PII; reversal is done
// by joining the token back to the entity and decrypting from core (see
// RestorePseudonym).
func (s *Store) UpsertPseudonym(
	ctx context.Context, entityType, entityID, fieldName, originalHash, token string,
) (string, error) {
	var effective string
	err := s.pool.QueryRow(ctx, `
		INSERT INTO vault.pseudonym_map
		    (entity_type, entity_id, field_name, original_hash, pseudonym)
		VALUES ($1, $2::uuid, $3, $4, $5)
		ON CONFLICT (entity_type, entity_id, field_name)
		DO UPDATE SET original_hash = EXCLUDED.original_hash
		RETURNING pseudonym
	`, entityType, entityID, fieldName, originalHash, token).Scan(&effective)
	if err != nil {
		return "", fmt.Errorf("upsert pseudonym (%s.%s): %w", entityType, fieldName, err)
	}
	return effective, nil
}

// CountPseudonyms returns the number of rows currently in vault.pseudonym_map.
// Used to prove that anonymization writes nothing to the reversible map.
func (s *Store) CountPseudonyms(ctx context.Context) (int, error) {
	var n int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM vault.pseudonym_map`).Scan(&n); err != nil {
		return 0, fmt.Errorf("count pseudonyms: %w", err)
	}
	return n, nil
}

// studentPIIColumns whitelists the core.students columns that may be resolved
// from a pseudonym, guarding the dynamic column name against SQL injection.
var studentPIIColumns = map[string]bool{
	"last_name": true, "first_name": true, "middle_name": true,
	"email": true, "phone": true,
}

// RestorePseudonym reverses a student pseudonym: it looks the token up in
// vault.pseudonym_map to recover (entity_id, field_name), then decrypts the
// original value from core.students. This demonstrates that pseudonymization is
// reversible for anyone holding vault access. ok is false if the token is
// unknown.
func (s *Store) RestorePseudonym(ctx context.Context, token string) (original string, ok bool, err error) {
	var entityID, fieldName string
	scanErr := s.pool.QueryRow(ctx, `
		SELECT entity_id::text, field_name
		FROM vault.pseudonym_map
		WHERE entity_type = 'student' AND pseudonym = $1
	`, token).Scan(&entityID, &fieldName)
	if errors.Is(scanErr, pgx.ErrNoRows) {
		return "", false, nil
	}
	if scanErr != nil {
		return "", false, fmt.Errorf("lookup pseudonym: %w", scanErr)
	}
	if !studentPIIColumns[fieldName] {
		return "", false, fmt.Errorf("unexpected field_name %q in pseudonym_map", fieldName)
	}

	// fieldName is whitelisted above, so this interpolation is safe.
	query := fmt.Sprintf(
		`SELECT vault.decrypt_pii(%s) FROM core.students WHERE id = $1::uuid`, fieldName)
	var value *string
	if err := s.pool.QueryRow(ctx, query, entityID).Scan(&value); err != nil {
		return "", false, fmt.Errorf("decrypt restored field: %w", err)
	}
	if value == nil {
		return "", true, nil
	}
	return *value, true, nil
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
