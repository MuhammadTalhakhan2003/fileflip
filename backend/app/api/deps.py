import asyncio
from functools import lru_cache

from fastapi import Request

from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.core.storage import Storage


@lru_cache
def get_storage() -> Storage:
    s = get_settings()
    return Storage(s.storage_dir, s.file_ttl_minutes * 60)


@lru_cache
def get_rate_limiter() -> RateLimiter:
    return RateLimiter(get_settings().rate_limit_per_minute)


@lru_cache
def get_job_slots() -> asyncio.Semaphore:
    """Caps how many conversions run at once so one burst can't starve the server."""
    return asyncio.Semaphore(get_settings().job_slots)


def client_ip(request: Request) -> str:
    if get_settings().trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real = request.headers.get("x-real-ip")
        if real:
            return real.strip()
    return request.client.host if request.client else "unknown"
