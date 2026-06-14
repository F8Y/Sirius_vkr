export interface JobPayload {
  file_path?: string;
  dataset_id?: string;
}

export interface JobResult {
  processed_records?: number;
  elapsed_ms?: number;
  message?: string;
}

export interface JobResponse {
  id: string;
  type: "import" | "anonymize";
  status: "pending" | "processing" | "done" | "failed";
  progress: number;
  error?: string;
  result?: JobResult;
  created_at: string;
  updated_at: string;
}
