import { apiFetch } from "@/shared/api";
import type { AnalyticsSummary } from "../model/types";

export function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>("/api/v1/analytics/summary");
}
