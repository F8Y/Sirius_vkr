import type { EnrollmentStatus } from "@/entities/course";

export interface GroupSummary {
  id: string;
  course_id: string;
  course_title: string;
  direction: string | null;
  name: string;
  teacher_id: string | null;
  members_count: number;
}

export interface GroupMember {
  enrollment_id: string;
  student_id: string;
  student_name: string;
  status: EnrollmentStatus;
  progress: number;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
}
