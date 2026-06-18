export type RegistryStatus = "active" | "completed" | "none";

export interface StudentRegistryItem {
  id: string;
  student_name: string;
  birth_date: string | null;
  directions: string[];
  courses_count: number;
  avg_progress: number;
  status: RegistryStatus;
  xp: number;
  level: number;
}
