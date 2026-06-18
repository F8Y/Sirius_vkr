import { apiFetch } from "@/shared/api";
import type { ScheduleItem } from "../model/types";

export function fetchSchedule(): Promise<ScheduleItem[]> {
  return apiFetch<ScheduleItem[]>("/api/v1/schedule");
}
