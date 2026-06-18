export type JobType = "import" | "anonymize";
export type JobStatus = "pending" | "processing" | "done" | "failed";
export type AnonymizeMode = "pseudonymize" | "anonymize";
export type Dataset = "students" | "guardians";

export interface JobPayload {
  file_path?: string;
  dataset_id?: string;
  mode?: AnonymizeMode;
  dataset?: Dataset;
}

// ── Import result (mirrors worker/internal/importer report) ──
export interface RowError {
  row: number;
  error: string;
}

export interface EntityReport {
  file: string;
  total: number;
  inserted: number;
  skipped: number;
  failed: number;
  errors?: RowError[];
  errors_truncated?: boolean;
}

export interface ImportResult {
  students?: EntityReport;
  guardians?: EntityReport;
  links?: EntityReport;
  notes?: string[];
}

// ── Anonymize result (mirrors worker/internal/anonymizer report) ──
export interface KAnonReport {
  quasi_identifiers: string[];
  k: number;
  threshold: number;
  compliant: boolean;
  equivalence_classes: number;
  total_records: number;
  k_before_generalization?: number;
  smallest_class_example?: string;
}

export interface PseudoStats {
  fields_tokenized: string[];
  mappings_written: number;
  reversible: boolean;
  reversibility_check: string;
}

export interface AnonStats {
  direct_identifiers_removed: string[];
  masked_fields: string[];
  generalized_fields: string[];
  pseudonym_map_writes: number;
}

export interface AnonymizeResult {
  mode: AnonymizeMode;
  dataset: Dataset;
  input_records: number;
  output_records: number;
  output_path: string;
  pseudonymization?: PseudoStats;
  anonymization?: AnonStats;
  k_anonymity?: KAnonReport;
  notes?: string[];
}

export type JobResult = ImportResult & AnonymizeResult & Record<string, unknown>;

export interface JobResponse {
  id: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  error?: string;
  result?: JobResult;
  created_at: string;
  updated_at: string;
}
