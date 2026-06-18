"""Idempotent demo seed for the learning portals (Batch 5).

Populates the learning contour (courses → modules → lessons, groups, schedule,
activities, enrollments with progress, gamification) and provisions known
teacher / child / parent accounts so the student and staff portals are not empty
during the defence.

Runs on startup when ``settings.seed_demo`` is true, and can also be executed
standalone inside the backend container::

    python -m app.seed_demo

PII discipline: student/guardian names are inserted **through**
``vault.encrypt_pii`` — plaintext never lands in the core columns, exactly as the
import pipeline does it. Account passwords are bcrypt-hashed via the auth layer.
"""

import asyncio
import logging
import random
import uuid
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session_factory
from app.schemas.auth import RoleName
from app.services.auth_service import get_user_by_email, register_user

logger = logging.getLogger(__name__)

# Deterministic output across runs.
_rng = random.Random(2027)

DEMO_TEACHER_EMAIL = "teacher@sirius27.local"
DEMO_CHILD_EMAIL = "child@sirius27.local"
DEMO_PARENT_EMAIL = "parent@sirius27.local"

# Small Russian name pools — no Faker dependency in the backend image.
_LAST_M = ["Иванов", "Петров", "Смирнов", "Кузнецов", "Соколов", "Попов", "Лебедев", "Козлов"]
_LAST_F = ["Иванова", "Петрова", "Смирнова", "Кузнецова", "Соколова", "Попова", "Лебедева"]
_FIRST_M = ["Артём", "Дмитрий", "Максим", "Иван", "Егор", "Михаил", "Никита", "Тимофей"]
_FIRST_F = ["Анна", "Мария", "София", "Дарья", "Виктория", "Полина", "Алиса", "Ева"]
_MID_M = ["Александрович", "Сергеевич", "Дмитриевич", "Иванович", "Андреевич"]
_MID_F = ["Александровна", "Сергеевна", "Дмитриевна", "Ивановна", "Андреевна"]

# Course catalogue: one published course per ВКР direction.
COURSES: list[dict] = [
    {
        "title": "Юные исследователи",
        "direction": "Наука",
        "description": "Экспериментальная физика и химия для любознательных.",
        "modules": [
            {
                "title": "Введение в эксперимент",
                "lessons": [
                    {"title": "Лабораторный журнал", "content": "Как фиксировать наблюдения."},
                    {"title": "Техника безопасности", "content": "Правила работы в лаборатории."},
                ],
            },
            {
                "title": "Первые опыты",
                "lessons": [
                    {
                        "title": "Кристаллы",
                        "content": "Выращиваем кристаллы соли.",
                        "material": True,
                    },
                    {"title": "Плотность жидкостей", "content": "Слоёная радуга в стакане."},
                ],
            },
        ],
        "groups": ["Наука-А", "Наука-Б"],
        "schedule": [(0, "16:00", "17:30", "Лаб. 201"), (2, "16:00", "17:30", "Лаб. 201")],
    },
    {
        "title": "Студия изобразительного искусства",
        "direction": "Искусство",
        "description": "Рисунок, живопись и композиция для начинающих художников.",
        "modules": [
            {
                "title": "Основы рисунка",
                "lessons": [
                    {"title": "Линия и форма", "content": "Учимся видеть силуэт."},
                    {"title": "Светотень", "content": "Объём через тон.", "material": True},
                ],
            },
            {
                "title": "Цвет",
                "lessons": [
                    {"title": "Цветовой круг", "content": "Тёплые и холодные цвета."},
                ],
            },
        ],
        "groups": ["Искусство-А", "Искусство-Б"],
        "schedule": [(1, "15:00", "16:30", "Мастерская 1"), (3, "15:00", "16:30", "Мастерская 1")],
    },
    {
        "title": "Спортивная гимнастика",
        "direction": "Спорт",
        "description": "Общая физическая подготовка и основы гимнастики.",
        "modules": [
            {
                "title": "ОФП",
                "lessons": [
                    {"title": "Разминка", "content": "Базовый комплекс упражнений."},
                    {"title": "Растяжка", "content": "Гибкость и профилактика травм."},
                ],
            },
        ],
        "groups": ["Спорт-А", "Спорт-Б"],
        "schedule": [(1, "17:30", "19:00", "Зал 3"), (4, "17:30", "19:00", "Зал 3")],
    },
]

BADGES: list[dict] = [
    {
        "code": "first_step",
        "title": "Первый шаг",
        "description": "Записался на первый курс.",
        "icon": "rocket",
    },
    {
        "code": "halfway",
        "title": "На полпути",
        "description": "Прогресс по курсу достиг 50%.",
        "icon": "flag",
    },
    {
        "code": "course_done",
        "title": "Курс пройден",
        "description": "Завершил курс на 100%.",
        "icon": "trophy",
    },
    {
        "code": "streak_7",
        "title": "Неделя подряд",
        "description": "Серия активности 7 дней.",
        "icon": "fire",
    },
    {
        "code": "explorer",
        "title": "Исследователь",
        "description": "Записан на курсы трёх направлений.",
        "icon": "compass",
    },
]


def _phone() -> str:
    return (
        f"+7 9{_rng.randint(10, 99)} {_rng.randint(100, 999)} {_rng.randint(10, 99)} "
        f"{_rng.randint(10, 99)}"
    )


def _person(female: bool | None = None) -> dict:
    female = _rng.choice([True, False]) if female is None else female
    if female:
        ln, fn, mn = _rng.choice(_LAST_F), _rng.choice(_FIRST_F), _rng.choice(_MID_F)
    else:
        ln, fn, mn = _rng.choice(_LAST_M), _rng.choice(_FIRST_M), _rng.choice(_MID_M)
    return {"last_name": ln, "first_name": fn, "middle_name": mn}


def _birth_date(min_age: int = 9, max_age: int = 17) -> date:
    today = datetime.now(tz=UTC).date()
    year = today.year - _rng.randint(min_age, max_age)
    return date(year, _rng.randint(1, 12), _rng.randint(1, 28))


async def _ensure_user(db: AsyncSession, email: str, role: RoleName) -> uuid.UUID:
    existing = await get_user_by_email(db, email)
    if existing is not None:
        return existing.id
    user = await register_user(db, email, settings.seed_demo_password, [role])
    return user.id


async def _insert_student(
    db: AsyncSession, person: dict, user_id: uuid.UUID | None = None
) -> uuid.UUID:
    sid = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO core.students
                (id, last_name, first_name, middle_name, email, phone, birth_date, user_id)
            VALUES (:id, vault.encrypt_pii(:ln), vault.encrypt_pii(:fn),
                    vault.encrypt_pii(:mn), vault.encrypt_pii(:em), vault.encrypt_pii(:ph),
                    :bd, :uid)
            """
        ),
        {
            "id": sid,
            "ln": person["last_name"],
            "fn": person["first_name"],
            "mn": person["middle_name"],
            "em": f"{translit(person['first_name'])}@example.org",
            "ph": _phone(),
            "bd": _birth_date(),
            "uid": user_id,
        },
    )
    return sid


async def _insert_guardian(
    db: AsyncSession, person: dict, user_id: uuid.UUID, student_id: uuid.UUID
) -> None:
    gid = uuid.uuid4()
    await db.execute(
        text(
            """
            INSERT INTO core.guardians
                (id, last_name, first_name, middle_name, email, phone, relation_type, user_id)
            VALUES (:id, vault.encrypt_pii(:ln), vault.encrypt_pii(:fn),
                    vault.encrypt_pii(:mn), vault.encrypt_pii(:em), vault.encrypt_pii(:ph),
                    'mother', :uid)
            """
        ),
        {
            "id": gid,
            "ln": person["last_name"],
            "fn": person["first_name"],
            "mn": person["middle_name"],
            "em": f"{translit(person['first_name'])}.parent@example.org",
            "ph": _phone(),
            "uid": user_id,
        },
    )
    await db.execute(
        text("INSERT INTO core.student_guardian (student_id, guardian_id) VALUES (:sid, :gid)"),
        {"sid": student_id, "gid": gid},
    )


_TRANSLIT = str.maketrans(
    {
        "А": "A",
        "Б": "B",
        "В": "V",
        "Г": "G",
        "Д": "D",
        "Е": "E",
        "Ж": "Zh",
        "З": "Z",
        "И": "I",
        "К": "K",
        "Л": "L",
        "М": "M",
        "Н": "N",
        "О": "O",
        "П": "P",
        "Р": "R",
        "С": "S",
        "Т": "T",
        "У": "U",
        "Ф": "F",
        "Х": "H",
        "Ц": "C",
        "Ч": "Ch",
        "Ш": "Sh",
        "Э": "E",
        "Ю": "Yu",
        "Я": "Ya",
    }
)


def translit(name: str) -> str:
    return name.translate(_TRANSLIT).lower()


async def _award_badge(db: AsyncSession, student_id: uuid.UUID, code: str) -> None:
    await db.execute(
        text(
            """
            INSERT INTO core.student_badges (student_id, badge_id)
            SELECT :sid, b.id FROM core.badges b WHERE b.code = :code
            ON CONFLICT DO NOTHING
            """
        ),
        {"sid": student_id, "code": code},
    )


async def _set_stats(
    db: AsyncSession, student_id: uuid.UUID, xp: int, level: int, streak: int
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO core.student_stats (student_id, xp, level, streak_days)
            VALUES (:sid, :xp, :level, :streak)
            ON CONFLICT (student_id) DO UPDATE
            SET xp = EXCLUDED.xp, level = EXCLUDED.level,
                streak_days = EXCLUDED.streak_days, updated_at = now()
            """
        ),
        {"sid": student_id, "xp": xp, "level": level, "streak": streak},
    )


async def seed(db: AsyncSession) -> None:
    """Run the full idempotent demo seed."""
    # ── badge catalogue (idempotent by unique code) ──────────
    for b in BADGES:
        await db.execute(
            text(
                """
                INSERT INTO core.badges (code, title, description, icon)
                VALUES (:code, :title, :description, :icon)
                ON CONFLICT (code) DO NOTHING
                """
            ),
            b,
        )

    # ── demo accounts ────────────────────────────────────────
    teacher_id = await _ensure_user(db, DEMO_TEACHER_EMAIL, RoleName.TEACHER)
    child_user_id = await _ensure_user(db, DEMO_CHILD_EMAIL, RoleName.CHILD)
    parent_user_id = await _ensure_user(db, DEMO_PARENT_EMAIL, RoleName.PARENT)
    await db.commit()

    # ── demo child's student + parent's guardian link ────────
    demo_student_id = (
        await db.execute(
            text("SELECT id FROM core.students WHERE user_id = :uid LIMIT 1"),
            {"uid": child_user_id},
        )
    ).scalar_one_or_none()
    if demo_student_id is None:
        child_person = _person(female=False) | {
            "last_name": "Соколов",
            "first_name": "Егор",
            "middle_name": "Андреевич",
        }
        demo_student_id = await _insert_student(db, child_person, child_user_id)
        parent_person = {"last_name": "Соколова", "first_name": "Мария", "middle_name": "Ивановна"}
        await _insert_guardian(db, parent_person, parent_user_id, demo_student_id)
        await db.commit()

    # ── learning content (only once — guard on empty catalogue) ─
    course_count = (await db.execute(text("SELECT count(*) FROM core.courses"))).scalar_one()
    if course_count == 0:
        await _seed_learning(db, teacher_id, demo_student_id)

    _log_credentials()


async def _seed_learning(
    db: AsyncSession, teacher_id: uuid.UUID, demo_student_id: uuid.UUID
) -> None:
    # Extra students to make the registry / analytics meaningful.
    extra_students: list[uuid.UUID] = []
    for _ in range(15):
        extra_students.append(await _insert_student(db, _person()))

    all_group_ids: list[uuid.UUID] = []

    for course in COURSES:
        course_id = uuid.uuid4()
        await db.execute(
            text(
                """
                INSERT INTO core.courses (id, title, direction, description, author_id, status)
                VALUES (:id, :title, :direction, :description, :author, 'published')
                """
            ),
            {
                "id": course_id,
                "title": course["title"],
                "direction": course["direction"],
                "description": course["description"],
                "author": teacher_id,
            },
        )

        for m_pos, module in enumerate(course["modules"]):
            module_id = uuid.uuid4()
            await db.execute(
                text(
                    "INSERT INTO core.modules (id, course_id, title, position) "
                    "VALUES (:id, :cid, :title, :pos)"
                ),
                {"id": module_id, "cid": course_id, "title": module["title"], "pos": m_pos},
            )
            for l_pos, lesson in enumerate(module["lessons"]):
                material = (
                    f"/materials/{translit(course['title'])[:8]}-{m_pos}-{l_pos}.pdf"
                    if lesson.get("material")
                    else None
                )
                await db.execute(
                    text(
                        """
                        INSERT INTO core.lessons
                            (module_id, title, position, content, material_url)
                        VALUES (:mid, :title, :pos, :content, :material)
                        """
                    ),
                    {
                        "mid": module_id,
                        "title": lesson["title"],
                        "pos": l_pos,
                        "content": lesson["content"],
                        "material": material,
                    },
                )

        # Groups + weekly schedule. The first group of every course is taught
        # by the demo teacher; both groups share the course's schedule.
        course_group_ids: list[uuid.UUID] = []
        for idx, gname in enumerate(course["groups"]):
            group_id = uuid.uuid4()
            await db.execute(
                text(
                    "INSERT INTO core.groups (id, course_id, name, teacher_id) "
                    "VALUES (:id, :cid, :name, :tid)"
                ),
                {
                    "id": group_id,
                    "cid": course_id,
                    "name": gname,
                    "tid": teacher_id if idx == 0 else None,
                },
            )
            course_group_ids.append(group_id)
            all_group_ids.append(group_id)
            for weekday, starts, ends, room in course["schedule"]:
                await db.execute(
                    text(
                        """
                        INSERT INTO core.schedule_slots
                            (group_id, weekday, starts_at, ends_at, room)
                        VALUES (:gid, :wd, :starts, :ends, :room)
                        """
                    ),
                    {
                        "gid": group_id,
                        "wd": weekday,
                        "starts": time.fromisoformat(starts),
                        "ends": time.fromisoformat(ends),
                        "room": room,
                    },
                )

        # Enroll a slice of the extra students into this course's first group.
        cohort = _rng.sample(extra_students, _rng.randint(5, 9))
        for sid in cohort:
            progress = _rng.choice([0, 20, 40, 60, 80, 100, 100])
            status = "completed" if progress == 100 else "active"
            await db.execute(
                text(
                    """
                    INSERT INTO core.enrollments (student_id, group_id, status, progress)
                    VALUES (:sid, :gid, :status, :progress)
                    ON CONFLICT (student_id, group_id) DO NOTHING
                    """
                ),
                {"sid": sid, "gid": course_group_ids[0], "status": status, "progress": progress},
            )

    # ── activities (конкурсы / события) ──────────────────────
    now = datetime.now(tz=UTC)
    activities = [
        ("Региональная олимпиада по физике", "competition", now + timedelta(days=14)),
        ("Выставка детского рисунка", "event", now + timedelta(days=7)),
        ("Открытый турнир по гимнастике", "competition", now + timedelta(days=21)),
    ]
    for title, atype, starts in activities:
        await db.execute(
            text(
                """
                INSERT INTO core.activities (title, type, description, starts_at, ends_at)
                VALUES (:title, :type, :descr, :starts, :ends)
                """
            ),
            {
                "title": title,
                "type": atype,
                "descr": "Демо-мероприятие центра.",
                "starts": starts,
                "ends": starts + timedelta(hours=3),
            },
        )

    # ── enroll the demo child across directions + gamify ─────
    demo_groups = _rng.sample(all_group_ids, 3)
    for i, gid in enumerate(demo_groups):
        progress = [100, 60, 30][i]
        status = "completed" if progress == 100 else "active"
        await db.execute(
            text(
                """
                INSERT INTO core.enrollments (student_id, group_id, status, progress)
                VALUES (:sid, :gid, :status, :progress)
                ON CONFLICT (student_id, group_id) DO NOTHING
                """
            ),
            {"sid": demo_student_id, "gid": gid, "status": status, "progress": progress},
        )

    await _set_stats(db, demo_student_id, xp=420, level=4, streak=7)
    for code in ("first_step", "halfway", "course_done", "streak_7", "explorer"):
        await _award_badge(db, demo_student_id, code)

    # Light stats/badges for a handful of other students.
    for sid in extra_students[:6]:
        await _set_stats(
            db, sid, xp=_rng.randint(50, 300), level=_rng.randint(1, 3), streak=_rng.randint(0, 5)
        )
        await _award_badge(db, sid, "first_step")

    await db.commit()


def _log_credentials() -> None:
    pwd = settings.seed_demo_password
    banner = (
        "\n"
        "  ──────────────────────────────────────────────────────────\n"
        "  ДЕМО-АККАУНТЫ «Сириус 27» (пароль у всех одинаковый)\n"
        "  ──────────────────────────────────────────────────────────\n"
        f"    teacher : {DEMO_TEACHER_EMAIL}\n"
        f"    child   : {DEMO_CHILD_EMAIL}\n"
        f"    parent  : {DEMO_PARENT_EMAIL}\n"
        f"    пароль  : {pwd}\n"
        "  (admin — из BOOTSTRAP_ADMIN_EMAIL/PASSWORD)\n"
        "  ──────────────────────────────────────────────────────────"
    )
    logger.info(banner)
    print(banner, flush=True)


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    async with async_session_factory() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
