export type CourseStatus = "draft" | "published" | "archived";
export type EnrollmentStatus = "active" | "completed" | "dropped";

export interface CourseSummary {
  id: string;
  title: string;
  direction: string | null;
  description: string | null;
  status: CourseStatus;
  author_id: string | null;
  groups_count: number;
  lessons_count: number;
}

export interface LessonItem {
  id: string;
  title: string;
  position: number;
  content: string | null;
  material_url: string | null;
}

export interface ModuleItem {
  id: string;
  title: string;
  position: number;
  lessons: LessonItem[];
}

export interface CourseGroupRef {
  id: string;
  name: string;
}

export interface CourseDetail extends CourseSummary {
  modules: ModuleItem[];
  groups: CourseGroupRef[];
}

export interface EnrollmentItem {
  id: string;
  student_id: string;
  group_id: string;
  status: EnrollmentStatus;
  progress: number;
  enrolled_at: string;
}
