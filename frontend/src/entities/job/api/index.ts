import type { JobPayload, JobResponse } from "../model/types";

export async function createJob(
  type: "import" | "anonymize",
  payload: JobPayload
): Promise<JobResponse> {
  const response = await fetch("/api/v1/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
  if (!response.ok) {
    throw new Error(`Не удалось создать задачу: ${response.statusText}`);
  }
  return response.json() as Promise<JobResponse>;
}

export async function fetchJob(jobId: string): Promise<JobResponse> {
  const response = await fetch(`/api/v1/jobs/${jobId}`);
  if (!response.ok) {
    throw new Error(`Не удалось получить задачу ${jobId}: ${response.statusText}`);
  }
  return response.json() as Promise<JobResponse>;
}
