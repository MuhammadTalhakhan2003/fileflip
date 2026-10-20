import asyncio
import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.formparsers import MultiPartException

from app.api.deps import get_storage
from app.api.routes import router
from app.core.config import get_settings
from app.core.errors import AppError
from app.tools.office import warm_up_libreoffice

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("convertor")


async def _cleanup_loop(interval: int) -> None:
    storage = get_storage()
    while True:
        try:
            await asyncio.to_thread(storage.cleanup_expired)
        except Exception:
            log.exception("Cleanup failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    get_storage()  # creates the storage folder
    task = asyncio.create_task(_cleanup_loop(settings.cleanup_interval_seconds))
    warm_up = asyncio.create_task(asyncio.to_thread(warm_up_libreoffice))  # first Office conversion is fast too
    log.info("%s started (%s)", settings.app_name, settings.environment)
    yield
    task.cancel()
    warm_up.cancel()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="Free file conversion and PDF tools. No sign-up, files are deleted automatically.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url=None,
    )

    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition", "X-Request-ID", "Retry-After"],
        max_age=86400,
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        quiet = request.url.path == f"{settings.api_prefix}/health" or request.url.path.startswith(
            f"{settings.api_prefix}/progress/")  # polled every second while a file converts
        if not quiet:
            log.info("%s %s -> %s (%.0f ms) [%s]", request.method, request.url.path, response.status_code, elapsed,
                     request_id)
        return response

    def error(status: int, code: str, message: str, headers: dict | None = None) -> JSONResponse:
        return JSONResponse({"error": {"code": code, "message": message}}, status_code=status, headers=headers)

    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return error(exc.status_code, exc.code, exc.message, exc.headers)

    @app.exception_handler(MultiPartException)
    async def multipart_error(_: Request, exc: MultiPartException):
        return error(400, "bad_upload", f"The upload could not be read: {exc.message}")

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        return error(422, "invalid_request", first.get("msg", "Invalid request."))

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return error(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error", exc_info=exc)
        return error(500, "internal_error", "Something went wrong on our side. Please try again.")

    app.include_router(router, prefix=settings.api_prefix)

    @app.get("/", include_in_schema=False)
    def root() -> dict:
        return {"name": settings.app_name, "docs": "/docs", "tools": f"{settings.api_prefix}/tools"}

    return app


app = create_app()
