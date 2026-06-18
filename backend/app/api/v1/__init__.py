"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.data import router as data_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.privacy import router as privacy_router
from app.api.v1.users import router as users_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(users_router)
router.include_router(jobs_router)
router.include_router(data_router)
router.include_router(privacy_router)
