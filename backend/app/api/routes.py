import asyncio
import logging
import shutil
import tempfile
from pathlib import Path

import pymupdf
from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile

from app.api.deps import client_ip, get_job_slots, get_rate_limiter, get_storage
from app.core import engines
from app.core.config import get_settings
from app.core.errors import AppError, ConversionFailed, InvalidInput, JobTimeout, NotFound, TooLarge
from app.core.rate_limit import RateLimiter
from app.core.storage import Storage
from app.tools import CATEGORY_LABELS, TOOLS, get_tool
from app.tools.common import IMAGE_EXTS, open_image, open_pdf, safe_filename
from app.tools.edit import describe_form_fields
from app.tools.registry import Context, Tool

log = logging.getLogger(__name__)
router = APIRouter()

CHUNK = 1024 * 1024
OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
ZIP_FORMATS = {"docx", "docm", "dotx", "xlsx", "xlsm", "pptx", "ppsx", "odt", "ods", "odp"}
OLE_FORMATS = {"doc", "dot", "xls", "ppt", "pps"}


# ---------------------------------------------------------------- catalog


@router.get("/tools", summary="List every tool, grouped by category")
def list_tools() -> dict:
    categories = []
    for key, label in CATEGORY_LABELS.items():
        tools = [t.public() for t in TOOLS.values() if t.category == key and not t.hidden]
        if tools:
            categories.append({"id": key, "label": label, "tools": tools})
    return {"categories": categories, "count": sum(len(c["tools"]) for c in categories)}


@router.get("/tools/{slug}", summary="Details for one tool")
def tool_details(slug: str) -> dict:
    t = get_tool(slug)
    if not t:
        raise NotFound(f"Unknown tool '{slug}'.")
    return t.public()


# ---------------------------------------------------------------- uploads


def _limit_check(request: Request) -> None:
    settings = get_settings()
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.max_upload_bytes + 1024 * 1024:
        raise TooLarge(f"Upload is too large. The limit is {settings.max_upload_mb} MB per request.")


async def _save_upload(upload: UploadFile, dest_dir: Path, accepts: tuple[str, ...], budget: list[int]) -> Path:
    """Stream an upload to disk, enforcing the extension list and the per-request size budget."""
    original = upload.filename or "file"
    name = safe_filename(original)
    ext = Path(name).suffix.lower().lstrip(".")
    if ext not in accepts:
        pretty = ", ".join(a.upper() for a in accepts[:12]) + ("..." if len(accepts) > 12 else "")
        raise InvalidInput(f"'{original}' is not a supported file type here. Accepted: {pretty}.",
                           code="unsupported_file_type")

    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / name
    size = 0
    head = b""
    with dest.open("wb") as fh:
        while chunk := await upload.read(CHUNK):
            if not head:
                head = chunk[:2048]
            size += len(chunk)
            if size > budget[0]:
                raise TooLarge(f"Upload is too large. The limit is {get_settings().max_upload_mb} MB per request.")
            fh.write(chunk)
    budget[0] -= size

    if size == 0:
        raise InvalidInput(f"'{original}' is empty.")
    if ext == "pdf" and b"%PDF" not in head[:1024]:
        raise InvalidInput(f"'{original}' is not a real PDF file.", code="invalid_file")
    if ext in ZIP_FORMATS and not head.startswith(b"PK"):
        raise InvalidInput(f"'{original}' is not a valid {ext.upper()} file.", code="invalid_file")
    if ext in OLE_FORMATS and not (head.startswith(OLE_MAGIC) or head.startswith(b"PK") or head.startswith(b"{\\rtf")):
        raise InvalidInput(f"'{original}' is not a valid {ext.upper()} file.", code="invalid_file")
    return dest


def _uploads(form, field: str) -> list[UploadFile]:
    return [v for v in form.getlist(field) if isinstance(v, UploadFile) and (v.filename or v.size)]


# ---------------------------------------------------------------- convert


@router.post("/convert/{slug}", summary="Run a tool on uploaded files")
async def convert(
    slug: str,
    request: Request,
    storage: Storage = Depends(get_storage),
    limiter: RateLimiter = Depends(get_rate_limiter),
) -> dict:
    t = get_tool(slug)
    if not t:
        raise NotFound(f"Unknown tool '{slug}'.")
    if not t.available():
        raise AppError(f"'{t.name}' is temporarily unavailable on this server.", status_code=503,
                       code="tool_unavailable")
    limiter.check(client_ip(request))
    _limit_check(request)

    settings = get_settings()
    job = storage.create_job()
    try:
        form = await request.form(max_files=settings.max_files_per_request + 20, max_fields=100,
                                  max_part_size=8 * 1024 * 1024)
        try:
            ctx = await _build_context(t, form, job.input_dir, job.work_dir)
        finally:
            await form.close()

        result = await _run(t, ctx)
        if not result.path.is_file():
            raise ConversionFailed("The conversion produced no file.")
        record = storage.finalize(job, result.path, tool=t.slug, meta=result.meta)
    except BaseException:
        storage.discard(job)
        raise

    record["download_url"] = f"{settings.api_prefix}/download/{job.id}"
    return record


async def _build_context(t: Tool, form, input_dir: Path, work_dir: Path) -> Context:
    settings = get_settings()
    files = _uploads(form, "files") or _uploads(form, "file")
    if len(files) < t.min_files:
        raise InvalidInput(
            f"Please upload {'a file' if t.min_files == 1 else f'at least {t.min_files} files'}.", code="no_files"
        )
    max_files = min(t.max_files, settings.max_files_per_request)
    if len(files) > max_files:
        raise InvalidInput(f"Too many files. '{t.name}' accepts up to {max_files} at once.", code="too_many_files")

    budget = [settings.max_upload_bytes]
    inputs = []
    for i, upload in enumerate(files):
        # one folder per upload keeps original names and the upload order
        inputs.append(await _save_upload(upload, input_dir / f"{i:03d}", t.accepts, budget))

    extras: dict[str, list[Path]] = {}
    for extra in t.extra_inputs:
        uploads = _uploads(form, extra.name)
        if extra.required and not uploads:
            raise InvalidInput(f"Please upload the {extra.label or extra.name}.")
        if uploads and not extra.multiple:
            uploads = uploads[:1]
        extras[extra.name] = [
            await _save_upload(u, input_dir / f"{extra.name}_{i:03d}", extra.accepts, budget)
            for i, u in enumerate(uploads[:50])
        ]

    reserved = {"files", "file", *(e.name for e in t.extra_inputs)}
    raw_options = {k: v for k, v in form.multi_items() if k not in reserved and isinstance(v, str)}
    return Context(inputs=inputs, work_dir=work_dir, options=t.parse_options(raw_options), extras=extras)


async def _run(t: Tool, ctx: Context):
    timeout = t.timeout or get_settings().job_timeout_seconds
    async with get_job_slots():
        try:
            return await asyncio.wait_for(run_in_threadpool(t.handler, ctx), timeout=timeout)
        except AppError:
            raise
        except asyncio.TimeoutError:
            raise JobTimeout("This file took too long to process. Try a smaller file or fewer pages.") from None
        except Exception as exc:
            log.exception("Tool %s failed", t.slug)
            raise ConversionFailed(
                "Something went wrong while processing your file. It may be damaged or use unsupported features."
            ) from exc


# ---------------------------------------------------------------- results


@router.get("/jobs/{job_id}", summary="Result details")
def job_details(job_id: str, storage: Storage = Depends(get_storage)) -> dict:
    record, _ = storage.get(job_id)
    record["download_url"] = f"{get_settings().api_prefix}/download/{job_id}"
    return record


@router.get("/download/{job_id}", summary="Download a result", response_class=FileResponse)
def download(job_id: str, inline: bool = False, storage: Storage = Depends(get_storage)) -> FileResponse:
    record, path = storage.get(job_id)
    return FileResponse(
        path,
        media_type=record["media_type"],
        filename=record["file_name"],
        content_disposition_type="inline" if inline else "attachment",
        headers={"Cache-Control": "private, no-store"},
    )


@router.delete("/jobs/{job_id}", summary="Delete a result right away")
def delete_job(job_id: str, storage: Storage = Depends(get_storage)) -> dict:
    if not storage.delete(job_id):
        raise NotFound("File not found. It may already be deleted.")
    return {"deleted": True}


# ---------------------------------------------------------------- inspect


@router.post("/inspect", summary="Read page sizes, form fields and metadata (nothing is stored)")
async def inspect(request: Request, limiter: RateLimiter = Depends(get_rate_limiter)) -> dict:
    limiter.check(client_ip(request))
    _limit_check(request)
    tmp = Path(tempfile.mkdtemp(prefix="inspect-", dir=get_storage().root))
    try:
        form = await request.form(max_files=1, max_fields=10)
        try:
            files = _uploads(form, "file") or _uploads(form, "files")
            if not files:
                raise InvalidInput("Please upload a file.", code="no_files")
            path = await _save_upload(files[0], tmp, ("pdf", *IMAGE_EXTS), [get_settings().max_upload_bytes])
            password = form.get("password") if isinstance(form.get("password"), str) else ""
        finally:
            await form.close()
        return await run_in_threadpool(_inspect_file, path, password or "")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _inspect_file(path: Path, password: str) -> dict:
    if path.suffix.lower() != ".pdf":
        with open_image(path) as img:
            return {"type": "image", "format": (img.format or path.suffix.lstrip(".")).lower(),
                    "width": img.width, "height": img.height, "mode": img.mode,
                    "frames": getattr(img, "n_frames", 1)}

    try:
        probe = pymupdf.open(path, filetype="pdf")
        needs_password = probe.needs_pass
        probe.close()
    except Exception:
        raise InvalidInput("This file is not a valid PDF or is too damaged to open.") from None
    if needs_password and not password:
        return {"type": "pdf", "encrypted": True, "needs_password": True}

    with open_pdf(path, password) as doc:
        pages = [
            {"number": p.number + 1, "width": round(p.rect.width, 2), "height": round(p.rect.height, 2),
             "rotation": p.rotation, "has_text": bool(p.get_text("text").strip())}
            for p in doc
        ]
        return {
            "type": "pdf",
            "encrypted": doc.is_encrypted or needs_password,
            "needs_password": False,
            "page_count": doc.page_count,
            "pages": pages,
            "has_text": any(p["has_text"] for p in pages),
            "is_form": bool(doc.is_form_pdf),
            "form_fields": describe_form_fields(doc) if doc.is_form_pdf else [],
            "metadata": {k: v for k, v in (doc.metadata or {}).items() if v},
        }


# ---------------------------------------------------------------- health


@router.get("/health", summary="Service and engine status")
def health() -> dict:
    available = sum(1 for t in TOOLS.values() if t.available())
    return {"status": "ok", "engines": engines.status(), "tools_available": available, "tools_total": len(TOOLS)}
