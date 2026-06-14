package job

// JobPayload represents the payload payload sent inside the job.
type JobPayload struct {
	FilePath  *string `json:"file_path,omitempty"`
	DatasetID *string `json:"dataset_id,omitempty"`
}

// JobStreamMessage mirrors the JobStreamMessage Pydantic model from FastAPI.
type JobStreamMessage struct {
	JobID     string     `json:"job_id"`
	Type      string     `json:"type"`
	Payload   JobPayload `json:"payload"`
	CreatedAt string     `json:"created_at"`
}
