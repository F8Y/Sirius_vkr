"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.analytics import router as analytics_router
from app.api.v1.auth import router as auth_router
from app.api.v1.courses import router as courses_router
from app.api.v1.data import router as data_router
from app.api.v1.enrollments import router as enrollments_router
from app.api.v1.groups import router as groups_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.portal import router as portal_router
from app.api.v1.privacy import router as privacy_router
from app.api.v1.schedule import router as schedule_router
from app.api.v1.students import router as students_router
from app.api.v1.users import router as users_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(jobs_router)
router.include_router(data_router)
router.include_router(privacy_router)
router.include_router(courses_router)
router.include_router(groups_router)
router.include_router(enrollments_router)
router.include_router(schedule_router)
router.include_router(analytics_router)
router.include_router(students_router)
router.include_router(portal_router)
