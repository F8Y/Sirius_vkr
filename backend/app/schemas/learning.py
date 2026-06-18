"""Pydantic v2 DTOs for the learning portals (Batch 5).

These DTOs describe courses, groups, enrollments, the weekly schedule, the
student registry, analytics and the child/parent portal screens. None of them
carry raw PII: subject names are reconstructed server-side through
``vault.decrypt_pii`` before being placed into a DTO.
"""

import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, Field

# ── Courses ─────────────────────────────────────────────────


class CourseSummary(BaseModel):
    id: uuid.UUID
    title: str
    direction: str | None = None
    description: str | None = None
    status: str
    author_id: uuid.UUID | None = None
    groups_count: int = 0
    lessons_count: int = 0


class LessonItem(BaseModel):
    id: uuid.UUID
    title: str
    position: int
    content: str | None = None
    material_url: str | None = None


class ModuleItem(BaseModel):
    id: uuid.UUID
    title: str
    position: int
    lessons: list[LessonItem] = Field(default_factory=list)


class CourseDetail(CourseSummary):
    modules: list[ModuleItem] = Field(default_factory=list)


class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    direction: str | None = Field(default=None, max_length=120)
    description: str | None = None


# ── Groups ──────────────────────────────────────────────────


class GroupMember(BaseModel):
    enrollment_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str
    status: str
    progress: int


class GroupSummary(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    course_title: str
    direction: str | None = None
    name: str
    teacher_id: uuid.UUID | None = None
    members_count: int = 0


class GroupDetail(GroupSummary):
    members: list[GroupMember] = Field(default_factory=list)


class GroupMembersUpdate(BaseModel):
    """Move the listed students into this group (transfer within the course)."""

    student_ids: list[uuid.UUID] = Field(min_length=1)


# ── Enrollments ─────────────────────────────────────────────


class EnrollmentCreate(BaseModel):
    group_id: uuid.UUID


class EnrollmentItem(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    group_id: uuid.UUID
    status: str
    progress: int
    enrolled_at: datetime


# ── Schedule ────────────────────────────────────────────────


class ScheduleItem(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    group_name: str
    course_title: str
    direction: str | None = None
    weekday: int
    starts_at: time
    ends_at: time
    room: str | None = None
    teacher_id: uuid.UUID | None = None


# ── Analytics ───────────────────────────────────────────────


class DirectionStat(BaseModel):
    direction: str
    students: int
    courses: int
    completion_rate: float


class AnalyticsSummary(BaseModel):
    total_students: int
    active_students: int
    total_courses: int
    published_courses: int
    total_enrollments: int
    completion_rate: float
    by_direction: list[DirectionStat] = Field(default_factory=list)


# ── Student registry (teacher/admin) ────────────────────────


class StudentRegistryItem(BaseModel):
    id: uuid.UUID
    student_name: str
    birth_date: date | None = None
    directions: list[str] = Field(default_factory=list)
    courses_count: int
    avg_progress: int
    status: str
    xp: int
    level: int


# ── Child / parent portal ───────────────────────────────────


class DashboardCourse(BaseModel):
    course_id: uuid.UUID
    course_title: str
    direction: str | None = None
    group_name: str
    progress: int
    status: str


class DashboardResponse(BaseModel):
    student_id: uuid.UUID
    student_name: str
    xp: int
    level: int
    streak_days: int
    active_courses: int
    completed_courses: int
    courses: list[DashboardCourse] = Field(default_factory=list)


class BadgeItem(BaseModel):
    code: str
    title: str
    description: str | None = None
    icon: str | None = None
    earned: bool
    awarded_at: datetime | None = None


class AchievementsResponse(BaseModel):
    student_id: uuid.UUID
    xp: int
    level: int
    streak_days: int
    next_level_xp: int
    badges: list[BadgeItem] = Field(default_factory=list)


class ChildItem(BaseModel):
    student_id: uuid.UUID
    student_name: str
    xp: int
    level: int
    courses_count: int
    avg_progress: int
