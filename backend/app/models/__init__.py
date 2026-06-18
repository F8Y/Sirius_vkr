# Import all models so Alembic metadata is complete when env.py loads this package.
from app.models.base import Base
from app.models.consent import Consent
from app.models.job import Job
from app.models.learning import Activity, Course, Enrollment, Group
from app.models.pseudonym import PseudonymMap
from app.models.student import Guardian, Student, StudentGuardian
from app.models.subject_request import SubjectRequest
from app.models.user import Role, User, UserRole

__all__ = [
    "Activity",
    "Base",
    "Consent",
    "Course",
    "Enrollment",
    "Group",
    "Guardian",
    "Job",
    "PseudonymMap",
    "Role",
    "Student",
    "StudentGuardian",
    "SubjectRequest",
    "User",
    "UserRole",
]
