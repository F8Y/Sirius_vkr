import { apiFetch } from "@/shared/api";
import type { GroupDetail, GroupSummary } from "../model/types";

export function fetchGroups(courseId?: string): Promise<GroupSummary[]> {
  const query = courseId ? `?course_id=${encodeURIComponent(courseId)}` : "";
  return apiFetch<GroupSummary[]>(`/api/v1/groups${query}`);
}

export function fetchGroup(id: string): Promise<GroupDetail> {
  return apiFetch<GroupDetail>(`/api/v1/groups/${id}`);
}

/** Transfer the listed students into this group (within the same course). */
export function updateGroupMembers(id: string, studentIds: string[]): Promise<GroupDetail> {
  return apiFetch<GroupDetail>(`/api/v1/groups/${id}/members`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_ids: studentIds }),
  });
}
