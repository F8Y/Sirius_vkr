import { apiFetch } from "@/shared/api";
import type {
  ConsentItem,
  ConsentKpi,
  RequestStatus,
  RequestType,
  SubjectCard,
  SubjectRequestItem,
  SubjectSummary,
  SubjectType,
} from "../model/types";

export function fetchConsents(): Promise<ConsentItem[]> {
  return apiFetch<ConsentItem[]>("/api/v1/privacy/consents");
}

export function fetchConsentKpi(): Promise<ConsentKpi> {
  return apiFetch<ConsentKpi>("/api/v1/privacy/consents/kpi");
}

export function syncConsents(): Promise<{ created: number }> {
  return apiFetch<{ created: number }>("/api/v1/privacy/consents/sync", { method: "POST" });
}

export function fetchSubjects(): Promise<SubjectSummary[]> {
  return apiFetch<SubjectSummary[]>("/api/v1/privacy/subjects");
}

export function fetchSubjectCard(
  subjectType: SubjectType,
  subjectId: string
): Promise<SubjectCard> {
  return apiFetch<SubjectCard>(`/api/v1/privacy/subjects/${subjectType}/${subjectId}`);
}

export function fetchRequests(): Promise<SubjectRequestItem[]> {
  return apiFetch<SubjectRequestItem[]>("/api/v1/privacy/requests");
}

export function createRequest(input: {
  subject_type: SubjectType;
  subject_id: string;
  request_type: RequestType;
  note?: string;
}): Promise<SubjectRequestItem> {
  return apiFetch<SubjectRequestItem>("/api/v1/privacy/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateRequest(
  requestId: string,
  status: RequestStatus
): Promise<SubjectRequestItem> {
  return apiFetch<SubjectRequestItem>(`/api/v1/privacy/requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
