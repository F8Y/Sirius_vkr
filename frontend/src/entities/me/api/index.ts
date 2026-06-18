import { apiFetch } from "@/shared/api";
import type { AchievementsResponse, ChildItem, DashboardResponse } from "../model/types";

/** ``studentId`` lets a parent select which child to view (omitted for a child). */
export function fetchDashboard(studentId?: string): Promise<DashboardResponse> {
  const query = studentId ? `?student_id=${studentId}` : "";
  return apiFetch<DashboardResponse>(`/api/v1/me/dashboard${query}`);
}

export function fetchAchievements(studentId?: string): Promise<AchievementsResponse> {
  const query = studentId ? `?student_id=${studentId}` : "";
  return apiFetch<AchievementsResponse>(`/api/v1/me/achievements${query}`);
}

export function fetchChildren(): Promise<ChildItem[]> {
  return apiFetch<ChildItem[]>("/api/v1/children");
}
