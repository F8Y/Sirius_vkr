export interface DirectionStat {
  direction: string;
  students: number;
  courses: number;
  completion_rate: number; // 0..1
}

export interface AnalyticsSummary {
  total_students: number;
  active_students: number;
  total_courses: number;
  published_courses: number;
  total_enrollments: number;
  completion_rate: number; // 0..1
  by_direction: DirectionStat[];
}
