import { apiFetch } from "@/shared/api";
import type { JobPayload, JobResponse, JobType } from "../model/types";

export async function createJob(type: JobType, payload: JobPayload): Promise<JobResponse> {
  return apiFetch<JobResponse>("/api/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
}

export async function fetchJob(jobId: string): Promise<JobResponse> {
  return apiFetch<JobResponse>(`/api/v1/jobs/${jobId}`);
}

/** Upload one or more dataset files (multipart) → returns the created import job. */
export async function uploadDataset(files: File[]): Promise<JobResponse> {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  return apiFetch<JobResponse>("/api/v1/data/upload", { method: "POST", body: form });
}
