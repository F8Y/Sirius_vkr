import { apiFetch } from "@/shared/api";
import type { CourseDetail, CourseSummary, EnrollmentItem } from "../model/types";

export function fetchCourses(direction?: string): Promise<CourseSummary[]> {
  const query = direction ? `?direction=${encodeURIComponent(direction)}` : "";
  return apiFetch<CourseSummary[]>(`/api/v1/courses${query}`);
}

export function fetchCourse(id: string): Promise<CourseDetail> {
  return apiFetch<CourseDetail>(`/api/v1/courses/${id}`);
}

export function createCourse(input: {
  title: string;
  direction?: string | null;
  description?: string | null;
}): Promise<CourseSummary> {
  return apiFetch<CourseSummary>("/api/v1/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function publishCourse(id: string): Promise<CourseSummary> {
  return apiFetch<CourseSummary>(`/api/v1/courses/${id}/publish`, { method: "PUT" });
}

/** Enrol the current child into a group. Backend returns 409 if already enrolled. */
export function enroll(groupId: string): Promise<EnrollmentItem> {
  return apiFetch<EnrollmentItem>("/api/v1/enrollments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_id: groupId }),
  });
}
