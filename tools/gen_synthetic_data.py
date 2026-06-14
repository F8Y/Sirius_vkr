"""
Synthetic data generator for Сириус 27.

Generates realistic-looking (but entirely fake) Russian-locale PD for
students, guardians, and their M:N relationships. Output: three CSV files.

Usage:
    python gen_synthetic_data.py --count 100 --output ./output

Requirements: pip install faker  (or: uv pip install faker)
"""

import argparse
import csv
import math
import random
import uuid
from datetime import date
from pathlib import Path

from faker import Faker

fake = Faker("ru_RU")
Faker.seed(42)
random.seed(42)

RELATION_TYPES = ["mother", "father", "guardian"]


def _random_birth_date(min_age: int = 8, max_age: int = 18) -> date:
    today = date.today()
    birth_year = today.year - random.randint(min_age, max_age)
    birth_month = random.randint(1, 12)
    birth_day = random.randint(1, 28)  # capped at 28 to avoid invalid dates
    return date(birth_year, birth_month, birth_day)


def _phone_ru() -> str:
    """Generate a Russian mobile number in +7 9XX XXX XX XX format."""
    digits = "".join(str(random.randint(0, 9)) for _ in range(9))
    return f"+7 9{digits[0]}{digits[1]} {digits[2]}{digits[3]}{digits[4]} {digits[5]}{digits[6]} {digits[7]}{digits[8]}"


def generate_students(count: int) -> list[dict]:
    students = []
    for _ in range(count):
        sex = random.choice(["male", "female"])
        if sex == "male":
            last_name = fake.last_name_male()
            first_name = fake.first_name_male()
            middle_name = fake.middle_name_male()
        else:
            last_name = fake.last_name_female()
            first_name = fake.first_name_female()
            middle_name = fake.middle_name_female()

        students.append(
            {
                "id": str(uuid.uuid4()),
                "last_name": last_name,
                "first_name": first_name,
                "middle_name": middle_name,
                "email": fake.email(),
                "phone": _phone_ru(),
                "birth_date": _random_birth_date().isoformat(),
            }
        )
    return students


def generate_guardians(count: int) -> list[dict]:
    guardians = []
    for _ in range(count):
        relation = random.choice(RELATION_TYPES)
        if relation == "mother":
            last_name = fake.last_name_female()
            first_name = fake.first_name_female()
            middle_name = fake.middle_name_female()
        else:
            last_name = fake.last_name_male()
            first_name = fake.first_name_male()
            middle_name = fake.middle_name_male()

        guardians.append(
            {
                "id": str(uuid.uuid4()),
                "last_name": last_name,
                "first_name": first_name,
                "middle_name": middle_name,
                "email": fake.email(),
                "phone": _phone_ru(),
                "relation_type": relation,
            }
        )
    return guardians


def generate_links(students: list[dict], guardians: list[dict]) -> list[dict]:
    """
    Assign 1–2 guardians to each student.

    Most students get exactly one guardian; ~30 % get two (siblings-style
    pairs also share a second guardian from the pool).
    """
    links: list[dict] = []
    seen: set[tuple[str, str]] = set()

    guardian_ids = [g["id"] for g in guardians]

    for student in students:
        sid = student["id"]
        # Primary guardian — always assigned
        gid = random.choice(guardian_ids)
        pair = (sid, gid)
        if pair not in seen:
            links.append({"student_id": sid, "guardian_id": gid})
            seen.add(pair)

        # Secondary guardian for ~30 % of students
        if random.random() < 0.30:
            candidates = [g for g in guardian_ids if g != gid]
            if candidates:
                gid2 = random.choice(candidates)
                pair2 = (sid, gid2)
                if pair2 not in seen:
                    links.append({"student_id": sid, "guardian_id": gid2})
                    seen.add(pair2)

    return links


def write_csv(rows: list[dict], path: Path) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"  wrote {len(rows):>5} rows → {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic PD CSVs for Сириус 27")
    parser.add_argument("--count", type=int, default=100, help="Number of students to generate")
    parser.add_argument("--output", type=str, default="./output", help="Output directory")
    args = parser.parse_args()

    out = Path(args.output)
    n = args.count
    # Guardian pool: roughly 70 % of student count (realistic — one guardian
    # can appear as parent for multiple children).
    g_count = max(1, math.ceil(n * 0.7))

    print(f"Generating {n} students and {g_count} guardians …")

    students = generate_students(n)
    guardians = generate_guardians(g_count)
    links = generate_links(students, guardians)

    write_csv(students, out / "students.csv")
    write_csv(guardians, out / "guardians.csv")
    write_csv(links, out / "student_guardian.csv")

    print("Done.")


if __name__ == "__main__":
    main()
