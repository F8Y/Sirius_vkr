import type { EnrollmentStatus } from "@/entities/course";

export interface DashboardCourse {
  course_id: string;
  course_title: string;
  direction: string | null;
  group_name: string;
  progress: number;
  status: EnrollmentStatus;
}

export interface DashboardResponse {
  student_id: string;
  student_name: string;
  xp: number;
  level: number;
  streak_days: number;
  active_courses: number;
  completed_courses: number;
  courses: DashboardCourse[];
}

export interface BadgeItem {
  code: string;
  title: string;
  description: string | null;
  icon: string | null;
  earned: boolean;
  awarded_at: string | null;
}

export interface AchievementsResponse {
  student_id: string;
  xp: number;
  level: number;
  streak_days: number;
  next_level_xp: number;
  badges: BadgeItem[];
}

export interface ChildItem {
  student_id: string;
  student_name: string;
  xp: number;
  level: number;
  courses_count: number;
  avg_progress: number;
}
