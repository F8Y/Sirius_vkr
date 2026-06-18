import { apiFetch } from "@/shared/api";
import type { StudentRegistryItem } from "../model/types";

export function fetchStudents(): Promise<StudentRegistryItem[]> {
  return apiFetch<StudentRegistryItem[]>("/api/v1/students");
}
