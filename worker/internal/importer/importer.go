// Package importer implements the real "import" job pipeline: it reads the
// CSV/XLSX files produced by tools/gen_synthetic_data.py from a dataset
// directory, validates each row, and writes valid rows into core.students /
// core.guardians / core.student_guardian. PII columns are encrypted on write
// via vault.encrypt_pii (handled in the store layer). Writes are idempotent
// (ON CONFLICT DO NOTHING), so re-running the same dataset is safe.
package importer

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"sirius27/worker/internal/store"
)

// ProgressFunc reports overall progress (0–100) as the pipeline advances.
type ProgressFunc func(progress int)

// Importer runs the import pipeline against a store.
type Importer struct {
	store *store.Store
}

// New creates an Importer bound to the given store.
func New(s *store.Store) *Importer {
	return &Importer{store: s}
}

// Run imports the dataset located at dir. dir must be a directory containing
// students.csv (required) and optionally guardians.csv / student_guardian.csv
// (or their .xlsx equivalents). It returns a per-entity report. A nil error
// means the pipeline ran; per-row validation/FK problems are recorded in the
// report, not returned as errors. A non-nil error indicates a fatal failure
// (path unreadable, required file missing, DB unavailable, context cancelled).
func (imp *Importer) Run(ctx context.Context, dir string, progress ProgressFunc) (*Report, error) {
	info, err := os.Stat(dir)
	if err != nil {
		return nil, fmt.Errorf("cannot access import path %q: %w", dir, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("import path %q must be a directory containing the dataset CSVs", dir)
	}

	report := &Report{}
	progress(10)

	// 1. Students — required, and must exist before links (FK).
	sPath, ok := findEntityFile(dir, "students")
	if !ok {
		return nil, fmt.Errorf("required file students.csv (or .xlsx) not found in %q", dir)
	}
	sRep, err := imp.importStudents(ctx, sPath)
	if err != nil {
		return report, err
	}
	report.Students = sRep
	progress(45)

	// 2. Guardians — optional.
	if gPath, ok := findEntityFile(dir, "guardians"); ok {
		gRep, err := imp.importGuardians(ctx, gPath)
		if err != nil {
			return report, err
		}
		report.Guardians = gRep
	} else {
		report.Notes = append(report.Notes, "guardians file not found — skipped")
	}
	progress(70)

	// 3. Student↔guardian links — optional, depend on both above (FK).
	if lPath, ok := findEntityFile(dir, "student_guardian"); ok {
		lRep, err := imp.importLinks(ctx, lPath)
		if err != nil {
			return report, err
		}
		report.Links = lRep
	} else {
		report.Notes = append(report.Notes, "student_guardian file not found — skipped")
	}
	progress(95)

	return report, nil
}

func (imp *Importer) importStudents(ctx context.Context, path string) (*EntityReport, error) {
	recs, err := readRecords(path)
	if err != nil {
		return nil, err
	}
	rep := &EntityReport{File: filepath.Base(path), Total: len(recs)}

	valid := make([]store.StudentRow, 0, len(recs))
	for i, rec := range recs {
		row, verr := validateStudent(rec)
		if verr != nil {
			rep.addError(i+1, verr)
			continue
		}
		valid = append(valid, *row)
	}

	inserted, err := imp.store.InsertStudents(ctx, valid)
	if err != nil {
		return rep, fmt.Errorf("writing students: %w", err)
	}
	rep.Inserted = inserted
	rep.Skipped = len(valid) - inserted
	return rep, nil
}

func (imp *Importer) importGuardians(ctx context.Context, path string) (*EntityReport, error) {
	recs, err := readRecords(path)
	if err != nil {
		return nil, err
	}
	rep := &EntityReport{File: filepath.Base(path), Total: len(recs)}

	valid := make([]store.GuardianRow, 0, len(recs))
	for i, rec := range recs {
		row, verr := validateGuardian(rec)
		if verr != nil {
			rep.addError(i+1, verr)
			continue
		}
		valid = append(valid, *row)
	}

	inserted, err := imp.store.InsertGuardians(ctx, valid)
	if err != nil {
		return rep, fmt.Errorf("writing guardians: %w", err)
	}
	rep.Inserted = inserted
	rep.Skipped = len(valid) - inserted
	return rep, nil
}

func (imp *Importer) importLinks(ctx context.Context, path string) (*EntityReport, error) {
	recs, err := readRecords(path)
	if err != nil {
		return nil, err
	}
	rep := &EntityReport{File: filepath.Base(path), Total: len(recs)}

	// Links are inserted one by one so a foreign-key violation (e.g. a link to a
	// student that failed validation) is reported per row instead of aborting.
	for i, rec := range recs {
		link, verr := validateLink(rec)
		if verr != nil {
			rep.addError(i+1, verr)
			continue
		}
		inserted, err := imp.store.InsertLink(ctx, link.StudentID, link.GuardianID)
		if err != nil {
			if ctx.Err() != nil {
				return rep, ctx.Err()
			}
			rep.addError(i+1, err)
			continue
		}
		if inserted {
			rep.Inserted++
		} else {
			rep.Skipped++
		}
	}
	return rep, nil
}
