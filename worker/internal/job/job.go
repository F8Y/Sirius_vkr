package job

// JobPayload represents the payload sent inside the job.
//
// FilePath drives "import" jobs. Mode and Dataset drive "anonymize" jobs:
// Mode is "pseudonymize" (reversible) or "anonymize" (irreversible); Dataset is
// the table to process ("students" or "guardians").
type JobPayload struct {
	FilePath  *string `json:"file_path,omitempty"`
	DatasetID *string `json:"dataset_id,omitempty"`
	Mode      *string `json:"mode,omitempty"`
	Dataset   *string `json:"dataset,omitempty"`
}

// JobStreamMessage mirrors the JobStreamMessage Pydantic model from FastAPI.
type JobStreamMessage struct {
	JobID     string     `json:"job_id"`
	Type      string     `json:"type"`
	Payload   JobPayload `json:"payload"`
	CreatedAt string     `json:"created_at"`
}
