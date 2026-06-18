export type SubjectType = "student" | "guardian";
export type RequestType = "export" | "delete";
export type RequestStatus = "new" | "in_progress" | "done" | "rejected";

export interface ConsentItem {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  subject_name: string;
  purpose: string;
  granted: boolean;
  granted_at?: string | null;
  revoked_at?: string | null;
}

export interface ConsentKpi {
  subjects_total: number;
  consents_total: number;
  granted: number;
  revoked: number;
  subjects_without_consent: number;
}

export interface SubjectRequestItem {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  subject_name: string;
  request_type: RequestType;
  status: RequestStatus;
  note?: string | null;
  created_at: string;
  due_at: string;
  resolved_at?: string | null;
  overdue: boolean;
}

export interface SubjectSummary {
  subject_type: SubjectType;
  subject_id: string;
  subject_name: string;
}

export interface SubjectCard {
  subject: SubjectSummary;
  consents: ConsentItem[];
  requests: SubjectRequestItem[];
}
