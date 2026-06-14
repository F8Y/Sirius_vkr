package importer

// maxErrorsPerEntity caps how many per-row errors are stored in jobs.result,
// to keep the JSONB payload bounded for large/dirty files.
const maxErrorsPerEntity = 100

// RowError is a single failed data row (1-based, excluding the header).
type RowError struct {
	Row   int    `json:"row"`
	Error string `json:"error"`
}

// EntityReport summarizes processing of one entity file.
type EntityReport struct {
	File            string     `json:"file"`
	Total           int        `json:"total"`    // data rows read (excluding header)
	Inserted        int        `json:"inserted"` // newly written rows
	Skipped         int        `json:"skipped"`  // duplicates skipped (idempotency)
	Failed          int        `json:"failed"`   // validation / insert errors
	Errors          []RowError `json:"errors"`
	ErrorsTruncated bool       `json:"errors_truncated,omitempty"`
}

// addError records a per-row error, capped at maxErrorsPerEntity.
func (e *EntityReport) addError(row int, err error) {
	e.Failed++
	if len(e.Errors) < maxErrorsPerEntity {
		e.Errors = append(e.Errors, RowError{Row: row, Error: err.Error()})
	} else {
		e.ErrorsTruncated = true
	}
}

// Report is the full import result written to jobs.result.
type Report struct {
	Students  *EntityReport `json:"students,omitempty"`
	Guardians *EntityReport `json:"guardians,omitempty"`
	Links     *EntityReport `json:"links,omitempty"`
	Notes     []string      `json:"notes,omitempty"`
}
