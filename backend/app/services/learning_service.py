"""Learning-contour business logic: courses, groups, enrollments, schedule,
analytics and the child/parent portal screens.

Subject (student) names are reconstructed exclusively through the
``vault.decrypt_pii`` SQL function — the single sanctioned decryption path,
mirroring ``privacy_service``. Raw plaintext never lives in core tables, and no
DTO is ever populated from a ciphertext column directly.
"""

import uuid

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.learning import (
    AchievementsResponse,
    AnalyticsSummary,
    BadgeItem,
    ChildItem,
    CourseCreate,
    CourseDetail,
    CourseSummary,
    DashboardCourse,
    DashboardResponse,
    DirectionStat,
    EnrollmentItem,
    GroupDetail,
    GroupMember,
    GroupSummary,
    LessonItem,
    ModuleItem,
    ScheduleItem,
    StudentRegistryItem,
)

# Reconstruct a student's display name from the encrypted columns.
_NAME_EXPR = (
    "trim(vault.decrypt_pii(t.last_name) || ' ' || vault.decrypt_pii(t.first_name) "
    "|| coalesce(' ' || vault.decrypt_pii(t.middle_name), ''))"
)


class LearningError(Exception):
    """Recoverable learning-domain failure (mapped to HTTP errors in routers)."""


# ── Subject resolution ──────────────────────────────────────


async def resolve_student_for_user(db: AsyncSession, user_id: uuid.UUID) -> uuid.UUID | None:
    """The student record owned by a child account, if any."""
    row = await db.execute(
        text("SELECT id FROM core.students WHERE user_id = :uid LIMIT 1"),
        {"uid": user_id},
    )
    return row.scalar_one_or_none()


async def resolve_children_ids(db: AsyncSession, parent_user_id: uuid.UUID) -> list[uuid.UUID]:
    """Student ids observable by a parent (via guardian → student_guardian)."""
    rows = await db.execute(
        text(
            """
            SELECT DISTINCT s.id
            FROM core.students s
            JOIN core.student_guardian sg ON sg.student_id = s.id
            JOIN core.guardians g ON g.id = sg.guardian_id
            WHERE g.user_id = :uid
            """
        ),
        {"uid": parent_user_id},
    )
    return [r[0] for r in rows]


# ── Courses ─────────────────────────────────────────────────


async def list_courses(db: AsyncSession, direction: str | None = None) -> list[CourseSummary]:
    sql = text(
        """
        SELECT c.id, c.title, c.direction, c.description, c.status, c.author_id,
               (SELECT count(*) FROM core.groups g WHERE g.course_id = c.id) AS groups_count,
               (SELECT count(*) FROM core.lessons l
                JOIN core.modules m ON m.id = l.module_id
                WHERE m.course_id = c.id) AS lessons_count
        FROM core.courses c
        WHERE (CAST(:direction AS text) IS NULL OR c.direction = :direction)
        ORDER BY c.title
        """
    )
    rows = await db.execute(sql, {"direction": direction})
    return [CourseSummary(**dict(r._mapping)) for r in rows]


async def get_course_detail(db: AsyncSession, course_id: uuid.UUID) -> CourseDetail | None:
    course = (
        (
            await db.execute(
                text(
                    """
                SELECT c.id, c.title, c.direction, c.description, c.status, c.author_id,
                       (SELECT count(*) FROM core.groups g WHERE g.course_id = c.id)
                           AS groups_count,
                       (SELECT count(*) FROM core.lessons l
                        JOIN core.modules m ON m.id = l.module_id
                        WHERE m.course_id = c.id) AS lessons_count
                FROM core.courses c
                WHERE c.id = :cid
                """
                ),
                {"cid": course_id},
            )
        )
        .mappings()
        .one_or_none()
    )
    if course is None:
        return None

    lesson_rows = await db.execute(
        text(
            """
            SELECT m.id AS module_id, m.title AS module_title, m.position AS module_position,
                   l.id AS lesson_id, l.title AS lesson_title, l.position AS lesson_position,
                   l.content, l.material_url
            FROM core.modules m
            LEFT JOIN core.lessons l ON l.module_id = m.id
            WHERE m.course_id = :cid
            ORDER BY m.position, m.created_at, l.position, l.created_at
            """
        ),
        {"cid": course_id},
    )

    modules: dict[uuid.UUID, ModuleItem] = {}
    for r in lesson_rows.mappings():
        mod = modules.get(r["module_id"])
        if mod is None:
            mod = ModuleItem(
                id=r["module_id"], title=r["module_title"], position=r["module_position"]
            )
            modules[r["module_id"]] = mod
        if r["lesson_id"] is not None:
            mod.lessons.append(
                LessonItem(
                    id=r["lesson_id"],
                    title=r["lesson_title"],
                    position=r["lesson_position"],
                    content=r["content"],
                    material_url=r["material_url"],
                )
            )

    return CourseDetail(**dict(course), modules=list(modules.values()))


async def create_course(
    db: AsyncSession, body: CourseCreate, author_id: uuid.UUID
) -> CourseSummary:
    new_id = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO core.courses (id, title, direction, description, author_id, status)
            VALUES (:id, :title, :direction, :description, :author_id, 'draft')
            """
        ),
        {
            "id": new_id,
            "title": body.title,
            "direction": body.direction,
            "description": body.description,
            "author_id": author_id,
        },
    )
    await db.commit()
    return CourseSummary(
        id=new_id,
        title=body.title,
        direction=body.direction,
        description=body.description,
        status="draft",
        author_id=author_id,
        groups_count=0,
        lessons_count=0,
    )


async def publish_course(db: AsyncSession, course_id: uuid.UUID) -> CourseSummary | None:
    result = await db.execute(
        text(
            "UPDATE core.courses SET status = 'published', updated_at = now() "
            "WHERE id = :cid AND status <> 'archived'"
        ),
        {"cid": course_id},
    )
    await db.commit()
    if (result.rowcount or 0) == 0:
        return None
    courses = await list_courses(db)
    return next((c for c in courses if c.id == course_id), None)


# ── Groups ──────────────────────────────────────────────────


async def list_groups(db: AsyncSession, course_id: uuid.UUID | None = None) -> list[GroupSummary]:
    sql = text(
        """
        SELECT g.id, g.course_id, c.title AS course_title, c.direction, g.name, g.teacher_id,
               (SELECT count(*) FROM core.enrollments e WHERE e.group_id = g.id) AS members_count
        FROM core.groups g
        JOIN core.courses c ON c.id = g.course_id
        WHERE (CAST(:course_id AS uuid) IS NULL OR g.course_id = :course_id)
        ORDER BY c.title, g.name
        """
    )
    rows = await db.execute(sql, {"course_id": course_id})
    return [GroupSummary(**dict(r._mapping)) for r in rows]


async def _group_summary(db: AsyncSession, group_id: uuid.UUID) -> GroupSummary | None:
    groups = await list_groups(db)
    return next((g for g in groups if g.id == group_id), None)


async def _group_members(db: AsyncSession, group_id: uuid.UUID) -> list[GroupMember]:
    rows = await db.execute(
        text(
            f"""
            SELECT e.id AS enrollment_id, e.student_id, {_NAME_EXPR} AS student_name,
                   e.status, e.progress
            FROM core.enrollments e
            JOIN core.students t ON t.id = e.student_id
            WHERE e.group_id = :gid
            ORDER BY student_name
            """
        ),
        {"gid": group_id},
    )
    return [GroupMember(**dict(r._mapping)) for r in rows]


async def get_group_detail(db: AsyncSession, group_id: uuid.UUID) -> GroupDetail | None:
    summary = await _group_summary(db, group_id)
    if summary is None:
        return None
    members = await _group_members(db, group_id)
    return GroupDetail(**summary.model_dump(), members=members)


async def update_group_members(
    db: AsyncSession, group_id: uuid.UUID, student_ids: list[uuid.UUID]
) -> GroupDetail | None:
    """Transfer the listed students into ``group_id``.

    A student already enrolled in another group of the *same course* is moved
    (the existing enrollment's group is reassigned, preserving progress); a
    student with no enrollment in the course is enrolled fresh; a student
    already in the target group is left untouched. The operation is idempotent.
    """
    course_id = (
        await db.execute(
            text("SELECT course_id FROM core.groups WHERE id = :gid"), {"gid": group_id}
        )
    ).scalar_one_or_none()
    if course_id is None:
        return None

    existing = await db.execute(
        text(
            """
            SELECT e.id, e.group_id, e.student_id
            FROM core.enrollments e
            JOIN core.groups g ON g.id = e.group_id
            WHERE g.course_id = :cid AND e.student_id = ANY(CAST(:sids AS uuid[]))
            """
        ),
        {"cid": course_id, "sids": student_ids},
    )
    # student_id -> (enrollment_id, current_group_id)
    by_student = {r.student_id: (r.id, r.group_id) for r in existing}

    for sid in student_ids:
        current = by_student.get(sid)
        if current is None:
            await db.execute(
                text("INSERT INTO core.enrollments (student_id, group_id) VALUES (:sid, :gid)"),
                {"sid": sid, "gid": group_id},
            )
        elif current[1] != group_id:
            await db.execute(
                text("UPDATE core.enrollments SET group_id = :gid WHERE id = :eid"),
                {"gid": group_id, "eid": current[0]},
            )
    await db.commit()
    return await get_group_detail(db, group_id)


# ── Enrollments ─────────────────────────────────────────────


async def create_enrollment(
    db: AsyncSession, student_id: uuid.UUID, group_id: uuid.UUID
) -> EnrollmentItem:
    group_exists = (
        await db.execute(text("SELECT 1 FROM core.groups WHERE id = :gid"), {"gid": group_id})
    ).scalar_one_or_none()
    if group_exists is None:
        raise LearningError("Group not found")

    new_id = uuid.uuid4()
    try:
        await db.execute(
            text(
                "INSERT INTO core.enrollments (id, student_id, group_id) VALUES (:id, :sid, :gid)"
            ),
            {"id": new_id, "sid": student_id, "gid": group_id},
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise LearningError("Already enrolled in this group") from exc

    row = (
        (
            await db.execute(
                text(
                    "SELECT id, student_id, group_id, status, progress, enrolled_at "
                    "FROM core.enrollments WHERE id = :id"
                ),
                {"id": new_id},
            )
        )
        .mappings()
        .one()
    )
    return EnrollmentItem(**dict(row))


# ── Schedule ────────────────────────────────────────────────


async def list_schedule(
    db: AsyncSession, student_ids: list[uuid.UUID] | None = None
) -> list[ScheduleItem]:
    """Weekly timetable. When ``student_ids`` is given, only slots of groups the
    student(s) are enrolled in are returned (child / parent views)."""
    where = ""
    params: dict[str, object] = {}
    if student_ids is not None:
        where = (
            "WHERE g.id IN (SELECT e.group_id FROM core.enrollments e "
            "WHERE e.student_id = ANY(CAST(:sids AS uuid[])))"
        )
        params["sids"] = student_ids

    sql = text(
        f"""
        SELECT sl.id, sl.group_id, g.name AS group_name, c.title AS course_title,
               c.direction, sl.weekday, sl.starts_at, sl.ends_at, sl.room, g.teacher_id
        FROM core.schedule_slots sl
        JOIN core.groups g ON g.id = sl.group_id
        JOIN core.courses c ON c.id = g.course_id
        {where}
        ORDER BY sl.weekday, sl.starts_at
        """
    )
    rows = await db.execute(sql, params)
    return [ScheduleItem(**dict(r._mapping)) for r in rows]


# ── Analytics (teacher / admin) ─────────────────────────────


async def analytics_summary(db: AsyncSession) -> AnalyticsSummary:
    totals = (
        (
            await db.execute(
                text(
                    """
                SELECT
                    (SELECT count(*) FROM core.students) AS total_students,
                    (SELECT count(DISTINCT e.student_id) FROM core.enrollments e
                     WHERE e.status = 'active') AS active_students,
                    (SELECT count(*) FROM core.courses) AS total_courses,
                    (SELECT count(*) FROM core.courses WHERE status = 'published')
                        AS published_courses,
                    (SELECT count(*) FROM core.enrollments) AS total_enrollments,
                    (SELECT count(*) FROM core.enrollments WHERE status = 'completed')
                        AS completed_enrollments
                """
                )
            )
        )
        .mappings()
        .one()
    )

    enrollments = totals["total_enrollments"] or 0
    completion = round(totals["completed_enrollments"] / enrollments, 3) if enrollments else 0.0

    by_dir_rows = await db.execute(
        text(
            """
            SELECT COALESCE(c.direction, 'Без направления') AS direction,
                   count(DISTINCT c.id) AS courses,
                   count(DISTINCT e.student_id) AS students,
                   count(e.id) FILTER (WHERE e.status = 'completed') AS completed,
                   count(e.id) AS enrollments
            FROM core.courses c
            LEFT JOIN core.groups g ON g.course_id = c.id
            LEFT JOIN core.enrollments e ON e.group_id = g.id
            GROUP BY COALESCE(c.direction, 'Без направления')
            ORDER BY direction
            """
        )
    )
    by_direction = []
    for r in by_dir_rows.mappings():
        enr = r["enrollments"] or 0
        by_direction.append(
            DirectionStat(
                direction=r["direction"],
                students=r["students"],
                courses=r["courses"],
                completion_rate=round(r["completed"] / enr, 3) if enr else 0.0,
            )
        )

    return AnalyticsSummary(
        total_students=totals["total_students"],
        active_students=totals["active_students"],
        total_courses=totals["total_courses"],
        published_courses=totals["published_courses"],
        total_enrollments=enrollments,
        completion_rate=completion,
        by_direction=by_direction,
    )


# ── Student registry (teacher / admin) ──────────────────────


async def list_student_registry(db: AsyncSession) -> list[StudentRegistryItem]:
    rows = await db.execute(
        text(
            f"""
            SELECT t.id, {_NAME_EXPR} AS student_name, t.birth_date,
                   array_remove(array_agg(DISTINCT c.direction), NULL) AS directions,
                   count(DISTINCT c.id) AS courses_count,
                   COALESCE(round(avg(e.progress))::int, 0) AS avg_progress,
                   count(e.id) FILTER (WHERE e.status = 'active') AS active_count,
                   count(e.id) AS enroll_count,
                   COALESCE(st.xp, 0) AS xp,
                   COALESCE(st.level, 1) AS level
            FROM core.students t
            LEFT JOIN core.enrollments e ON e.student_id = t.id
            LEFT JOIN core.groups g ON g.id = e.group_id
            LEFT JOIN core.courses c ON c.id = g.course_id
            LEFT JOIN core.student_stats st ON st.student_id = t.id
            GROUP BY t.id, t.birth_date, st.xp, st.level
            ORDER BY student_name
            """
        )
    )
    items: list[StudentRegistryItem] = []
    for r in rows.mappings():
        if r["active_count"]:
            status = "active"
        elif r["enroll_count"]:
            status = "completed"
        else:
            status = "none"
        items.append(
            StudentRegistryItem(
                id=r["id"],
                student_name=r["student_name"] or "—",
                birth_date=r["birth_date"],
                directions=list(r["directions"] or []),
                courses_count=r["courses_count"],
                avg_progress=r["avg_progress"],
                status=status,
                xp=r["xp"],
                level=r["level"],
            )
        )
    return items


# ── Child / parent portal ───────────────────────────────────


async def _student_name(db: AsyncSession, student_id: uuid.UUID) -> str:
    name = (
        await db.execute(
            text(f"SELECT {_NAME_EXPR} FROM core.students t WHERE t.id = :sid"),
            {"sid": student_id},
        )
    ).scalar_one_or_none()
    return name or "—"


async def _stats(db: AsyncSession, student_id: uuid.UUID) -> tuple[int, int, int]:
    row = (
        await db.execute(
            text("SELECT xp, level, streak_days FROM core.student_stats WHERE student_id = :sid"),
            {"sid": student_id},
        )
    ).one_or_none()
    if row is None:
        return 0, 1, 0
    return row.xp, row.level, row.streak_days


async def get_dashboard(db: AsyncSession, student_id: uuid.UUID) -> DashboardResponse:
    name = await _student_name(db, student_id)
    xp, level, streak = await _stats(db, student_id)
    course_rows = await db.execute(
        text(
            """
            SELECT c.id AS course_id, c.title AS course_title, c.direction,
                   g.name AS group_name, e.progress, e.status
            FROM core.enrollments e
            JOIN core.groups g ON g.id = e.group_id
            JOIN core.courses c ON c.id = g.course_id
            WHERE e.student_id = :sid
            ORDER BY c.title
            """
        ),
        {"sid": student_id},
    )
    courses = [DashboardCourse(**dict(r._mapping)) for r in course_rows]
    return DashboardResponse(
        student_id=student_id,
        student_name=name,
        xp=xp,
        level=level,
        streak_days=streak,
        active_courses=sum(1 for c in courses if c.status == "active"),
        completed_courses=sum(1 for c in courses if c.status == "completed"),
        courses=courses,
    )


async def get_achievements(db: AsyncSession, student_id: uuid.UUID) -> AchievementsResponse:
    xp, level, streak = await _stats(db, student_id)
    badge_rows = await db.execute(
        text(
            """
            SELECT b.code, b.title, b.description, b.icon,
                   (sb.student_id IS NOT NULL) AS earned, sb.awarded_at
            FROM core.badges b
            LEFT JOIN core.student_badges sb
                ON sb.badge_id = b.id AND sb.student_id = :sid
            ORDER BY earned DESC, b.code
            """
        ),
        {"sid": student_id},
    )
    badges = [BadgeItem(**dict(r._mapping)) for r in badge_rows]
    return AchievementsResponse(
        student_id=student_id,
        xp=xp,
        level=level,
        streak_days=streak,
        next_level_xp=level * 100,
        badges=badges,
    )


async def list_children(db: AsyncSession, parent_user_id: uuid.UUID) -> list[ChildItem]:
    rows = await db.execute(
        text(
            f"""
            SELECT DISTINCT t.id AS student_id, {_NAME_EXPR} AS student_name,
                   COALESCE(st.xp, 0) AS xp, COALESCE(st.level, 1) AS level,
                   (SELECT count(*) FROM core.enrollments e WHERE e.student_id = t.id)
                       AS courses_count,
                   COALESCE((SELECT round(avg(e.progress))::int FROM core.enrollments e
                             WHERE e.student_id = t.id), 0) AS avg_progress
            FROM core.students t
            JOIN core.student_guardian sg ON sg.student_id = t.id
            JOIN core.guardians g ON g.id = sg.guardian_id
            LEFT JOIN core.student_stats st ON st.student_id = t.id
            WHERE g.user_id = :uid
            ORDER BY student_name
            """
        ),
        {"uid": parent_user_id},
    )
    return [ChildItem(**dict(r._mapping)) for r in rows]
