// Package anonymizer implements the "anonymize" job — the privacy core of the
// project. It reads PII from core via vault.decrypt_pii and produces a
// de-identified dataset in one of two legally distinct modes:
//
//   - pseudonymize (REVERSIBLE): direct identifiers are replaced by opaque
//     tokens; the token↔entity mapping is recorded in vault.pseudonym_map, so
//     the result can be restored by anyone holding vault access. The data
//     legally remains personal.
//   - anonymize (IRREVERSIBLE): direct identifiers are masked or removed and
//     quasi-identifiers (birth date) are generalized. No mapping is kept, so the
//     transformation cannot be undone. Privacy is quantified with k-anonymity.
//
// Output is written as CSV under <outputDir>/anonymized/<jobID>/ and the run is
// summarized in jobs.result.
package anonymizer

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"

	"sirius27/worker/internal/store"
)

// ProgressFunc reports overall progress (0–100) as the pipeline advances.
type ProgressFunc func(progress int)

// Anonymizer runs the de-identification pipeline against a store.
type Anonymizer struct {
	store     *store.Store
	outputDir string
}

// New creates an Anonymizer that writes output beneath outputDir.
func New(s *store.Store, outputDir string) *Anonymizer {
	return &Anonymizer{store: s, outputDir: outputDir}
}

// Run executes the pipeline for the given mode ("pseudonymize" | "anonymize")
// and dataset ("students" | "guardians"). A non-nil error is a fatal failure
// (bad parameters, DB unavailable, output not writable, context cancelled).
func (a *Anonymizer) Run(
	ctx context.Context, jobID, mode, dataset string, progress ProgressFunc,
) (*Report, error) {
	if dataset == "" {
		dataset = "students"
	}
	if mode != "pseudonymize" && mode != "anonymize" {
		return nil, fmt.Errorf("invalid mode %q (expected pseudonymize|anonymize)", mode)
	}
	if dataset != "students" && dataset != "guardians" {
		return nil, fmt.Errorf("invalid dataset %q (expected students|guardians)", dataset)
	}

	outPath := filepath.Join(a.outputDir, "anonymized", jobID, dataset+".csv")
	progress(10)

	report := &Report{Mode: mode, Dataset: dataset, OutputPath: outPath}

	switch dataset {
	case "students":
		if err := a.runStudents(ctx, mode, outPath, report, progress); err != nil {
			return nil, err
		}
	case "guardians":
		if err := a.runGuardians(ctx, mode, outPath, report, progress); err != nil {
			return nil, err
		}
	}

	progress(95)
	return report, nil
}

// ── students ─────────────────────────────────────────────────────────────

func (a *Anonymizer) runStudents(
	ctx context.Context, mode, outPath string, report *Report, progress ProgressFunc,
) error {
	students, err := a.store.LoadStudents(ctx)
	if err != nil {
		return err
	}
	report.InputRecords = len(students)
	progress(35)

	if mode == "pseudonymize" {
		return a.pseudonymizeStudents(ctx, students, outPath, report, progress)
	}
	return a.anonymizeStudents(students, outPath, report, progress)
}

func (a *Anonymizer) pseudonymizeStudents(
	ctx context.Context, students []store.DecryptedStudent, outPath string,
	report *Report, progress ProgressFunc,
) error {
	header := []string{"id", "last_name", "first_name", "middle_name", "email", "phone", "birth_date"}
	rows := make([][]string, 0, len(students))
	tokenized := map[string]bool{}
	writes := 0
	var sampleToken, sampleOriginal string

	for _, s := range students {
		// field tag → (plaintext, output cell pointer)
		out := make([]string, len(header))
		out[0] = s.ID
		fields := []struct {
			idx   int
			tag   string
			name  string
			value *string
		}{
			{1, "nm", "last_name", s.LastName},
			{2, "nm", "first_name", s.FirstName},
			{3, "nm", "middle_name", s.MiddleName},
			{4, "eml", "email", s.Email},
			{5, "phn", "phone", s.Phone},
		}
		for _, f := range fields {
			if f.value == nil || *f.value == "" {
				continue // nothing to tokenize; leave output cell empty
			}
			token, err := newToken(f.tag)
			if err != nil {
				return err
			}
			effective, err := a.store.UpsertPseudonym(
				ctx, "student", s.ID, f.name, hashOriginal(*f.value), token)
			if err != nil {
				return err
			}
			out[f.idx] = effective
			tokenized[f.name] = true
			writes++
			if f.name == "email" && sampleToken == "" {
				sampleToken, sampleOriginal = effective, *f.value
			}
		}
		// birth_date is a quasi-identifier, not a direct one: kept unchanged —
		// pseudonymized data legally remains personal.
		if s.BirthDate != nil {
			out[6] = s.BirthDate.Format("2006-01-02")
		}
		rows = append(rows, out)
	}
	progress(70)

	if err := writeCSV(outPath, header, rows); err != nil {
		return err
	}
	report.OutputRecords = len(rows)

	stats := &PseudoStats{
		FieldsTokenized:    sortedKeys(tokenized),
		MappingsWritten:    writes,
		Reversible:         true,
		ReversibilityCheck: a.verifyReversible(ctx, sampleToken, sampleOriginal),
	}
	report.Pseudonymized = stats

	// k-anonymity on the retained exact birth date — informational: it shows
	// that pseudonymized data is still re-identifiable via quasi-identifiers,
	// which is precisely why it is not anonymization.
	report.KAnonymity = kAnonReport(
		[]string{"birth_date (exact)"}, birthKeys(students, false))
	report.Notes = append(report.Notes,
		"pseudonymized data remains personal and is reversible via vault.pseudonym_map; "+
			"k-anonymity below is informational only")
	return nil
}

func (a *Anonymizer) anonymizeStudents(
	students []store.DecryptedStudent, outPath string, report *Report, progress ProgressFunc,
) error {
	header := []string{"record", "email", "phone", "birth_date_generalized"}
	rows := make([][]string, 0, len(students))

	for i, s := range students {
		email, phone := "", ""
		if s.Email != nil && *s.Email != "" {
			email = maskEmail(*s.Email)
		}
		if s.Phone != nil && *s.Phone != "" {
			phone = maskPhone(*s.Phone)
		}
		band := "*"
		if s.BirthDate != nil {
			band = generalizeBirth(*s.BirthDate)
		}
		// id and full name (direct identifiers) are dropped entirely; the
		// surrogate "record" number carries no link back to core.
		rows = append(rows, []string{strconv.Itoa(i + 1), email, phone, band})
	}
	progress(70)

	if err := writeCSV(outPath, header, rows); err != nil {
		return err
	}
	report.OutputRecords = len(rows)
	report.Anonymized = &AnonStats{
		DirectIdentifiersRemoved: []string{"id", "last_name", "first_name", "middle_name"},
		MaskedFields:             []string{"email", "phone"},
		GeneralizedFields:        []string{"birth_date"},
		PseudonymMapWrites:       0, // never written in anonymize mode — proof of irreversibility
	}

	kr := kAnonReport([]string{"birth_date (5-year band)"}, birthKeys(students, true))
	// Compare against the un-generalized baseline to show generalization's effect.
	kBefore, _, _ := computeK(birthKeys(students, false))
	kr.KBeforeGeneralization = kBefore
	report.KAnonymity = kr
	return nil
}

// ── guardians ────────────────────────────────────────────────────────────

func (a *Anonymizer) runGuardians(
	ctx context.Context, mode, outPath string, report *Report, progress ProgressFunc,
) error {
	guardians, err := a.store.LoadGuardians(ctx)
	if err != nil {
		return err
	}
	report.InputRecords = len(guardians)
	progress(35)

	if mode == "pseudonymize" {
		return a.pseudonymizeGuardians(ctx, guardians, outPath, report, progress)
	}
	return a.anonymizeGuardians(guardians, outPath, report, progress)
}

func (a *Anonymizer) pseudonymizeGuardians(
	ctx context.Context, guardians []store.DecryptedGuardian, outPath string,
	report *Report, progress ProgressFunc,
) error {
	header := []string{"id", "last_name", "first_name", "middle_name", "email", "phone", "relation_type"}
	rows := make([][]string, 0, len(guardians))
	tokenized := map[string]bool{}
	writes := 0

	for _, g := range guardians {
		out := make([]string, len(header))
		out[0] = g.ID
		fields := []struct {
			idx   int
			tag   string
			name  string
			value *string
		}{
			{1, "nm", "last_name", g.LastName},
			{2, "nm", "first_name", g.FirstName},
			{3, "nm", "middle_name", g.MiddleName},
			{4, "eml", "email", g.Email},
			{5, "phn", "phone", g.Phone},
		}
		for _, f := range fields {
			if f.value == nil || *f.value == "" {
				continue
			}
			token, err := newToken(f.tag)
			if err != nil {
				return err
			}
			effective, err := a.store.UpsertPseudonym(
				ctx, "guardian", g.ID, f.name, hashOriginal(*f.value), token)
			if err != nil {
				return err
			}
			out[f.idx] = effective
			tokenized[f.name] = true
			writes++
		}
		out[6] = deref(g.RelationType) // category, not a direct identifier — kept
		rows = append(rows, out)
	}
	progress(70)

	if err := writeCSV(outPath, header, rows); err != nil {
		return err
	}
	report.OutputRecords = len(rows)
	report.Pseudonymized = &PseudoStats{
		FieldsTokenized:    sortedKeys(tokenized),
		MappingsWritten:    writes,
		Reversible:         true,
		ReversibilityCheck: "skipped (automated self-check runs for students only)",
	}
	report.Notes = append(report.Notes,
		"pseudonymized data remains personal and is reversible via vault.pseudonym_map")
	return nil
}

func (a *Anonymizer) anonymizeGuardians(
	guardians []store.DecryptedGuardian, outPath string, report *Report, progress ProgressFunc,
) error {
	header := []string{"record", "email", "phone", "relation_type"}
	rows := make([][]string, 0, len(guardians))
	relKeys := make([]string, 0, len(guardians))

	for i, g := range guardians {
		email, phone := "", ""
		if g.Email != nil && *g.Email != "" {
			email = maskEmail(*g.Email)
		}
		if g.Phone != nil && *g.Phone != "" {
			phone = maskPhone(*g.Phone)
		}
		rel := deref(g.RelationType)
		if rel == "" {
			rel = "*"
		}
		rows = append(rows, []string{strconv.Itoa(i + 1), email, phone, rel})
		relKeys = append(relKeys, rel)
	}
	progress(70)

	if err := writeCSV(outPath, header, rows); err != nil {
		return err
	}
	report.OutputRecords = len(rows)
	report.Anonymized = &AnonStats{
		DirectIdentifiersRemoved: []string{"id", "last_name", "first_name", "middle_name"},
		MaskedFields:             []string{"email", "phone"},
		GeneralizedFields:        []string{},
		PseudonymMapWrites:       0,
	}
	// Guardians have no birth date; relation_type is the available quasi-identifier.
	report.KAnonymity = kAnonReport([]string{"relation_type"}, relKeys)
	report.Notes = append(report.Notes,
		"guardians carry no birth-date quasi-identifier; k-anonymity is measured over relation_type")
	return nil
}

// ── helpers ──────────────────────────────────────────────────────────────

// verifyReversible takes one emitted token, restores it through the vault and
// confirms it recovers the original value, returning a human-readable verdict.
func (a *Anonymizer) verifyReversible(ctx context.Context, token, original string) string {
	if token == "" {
		return "no token emitted to verify"
	}
	restored, ok, err := a.store.RestorePseudonym(ctx, token)
	switch {
	case err != nil:
		return "error: " + err.Error()
	case !ok:
		return "failed: token not found in vault.pseudonym_map"
	case restored != original:
		return "failed: restored value does not match original"
	default:
		return fmt.Sprintf("ok: token %q restored to the original value via vault", token)
	}
}

// birthKeys returns one quasi-identifier key per student. When generalized is
// true each key is the 5-year band; otherwise it is the exact date. A missing
// birth date becomes "*" (top-level suppression), forming its own class.
func birthKeys(students []store.DecryptedStudent, generalized bool) []string {
	keys := make([]string, len(students))
	for i, s := range students {
		switch {
		case s.BirthDate == nil:
			keys[i] = "*"
		case generalized:
			keys[i] = generalizeBirth(*s.BirthDate)
		default:
			keys[i] = s.BirthDate.Format("2006-01-02")
		}
	}
	return keys
}

// sortedKeys returns the set's keys in a stable, sorted order.
func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	// canonical field order for readable, deterministic reports
	order := map[string]int{
		"last_name": 0, "first_name": 1, "middle_name": 2, "email": 3, "phone": 4,
	}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && order[out[j-1]] > order[out[j]]; j-- {
			out[j-1], out[j] = out[j], out[j-1]
		}
	}
	return out
}
