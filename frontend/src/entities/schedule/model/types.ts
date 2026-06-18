export interface ScheduleItem {
  id: string;
  group_id: string;
  group_name: string;
  course_title: string;
  direction: string | null;
  weekday: number; // 0 = Monday … 6 = Sunday
  starts_at: string; // "HH:MM:SS"
  ends_at: string;
  room: string | null;
  teacher_id: string | null;
}
