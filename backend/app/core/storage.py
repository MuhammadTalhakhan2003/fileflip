import json
import logging
import mimetypes
import re
import secrets
import shutil
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.core.errors import NotFound

log = logging.getLogger(__name__)

_JOB_ID = re.compile(r"^[A-Za-z0-9_-]{20,64}$")

MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".zip": "application/zip",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".html": "text/html; charset=utf-8",
}


def media_type_for(path: Path) -> str:
    return MEDIA_TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"


@dataclass
class Job:
    id: str
    dir: Path

    @property
    def input_dir(self) -> Path:
        return self.dir / "in"

    @property
    def work_dir(self) -> Path:
        return self.dir / "work"

    @property
    def output_dir(self) -> Path:
        return self.dir / "out"

    @property
    def meta_file(self) -> Path:
        return self.dir / "job.json"


class Storage:
    """Short-lived file storage. Every job lives in its own folder and is deleted after the TTL.

    The job id is a long random token, so it doubles as the download secret:
    nobody can list or guess other people's files.
    """

    def __init__(self, root: Path, ttl_seconds: int):
        self.root = root.resolve()
        self.ttl = ttl_seconds
        self.root.mkdir(parents=True, exist_ok=True)

    def create_job(self) -> Job:
        job_id = secrets.token_urlsafe(18)
        job = Job(id=job_id, dir=self.root / job_id)
        for d in (job.input_dir, job.work_dir, job.output_dir):
            d.mkdir(parents=True)
        return job

    def finalize(self, job: Job, result_path: Path, *, tool: str, meta: dict) -> dict:
        """Move the result into the job's output folder, drop the inputs and write job.json."""
        final = job.output_dir / result_path.name
        shutil.move(str(result_path), final)
        shutil.rmtree(job.input_dir, ignore_errors=True)
        shutil.rmtree(job.work_dir, ignore_errors=True)

        created = time.time()
        record = {
            "job_id": job.id,
            "tool": tool,
            "file_name": final.name,
            "size": final.stat().st_size,
            "media_type": media_type_for(final),
            "created_at": _iso(created),
            "expires_at": _iso(created + self.ttl),
            "meta": meta,
        }
        job.meta_file.write_text(json.dumps(record), encoding="utf-8")
        return record

    def get(self, job_id: str) -> tuple[dict, Path]:
        if not _JOB_ID.match(job_id):
            raise NotFound("File not found. It may have expired - files are deleted automatically.")
        job_dir = self.root / job_id
        meta_file = job_dir / "job.json"
        if not meta_file.is_file():
            raise NotFound("File not found. It may have expired - files are deleted automatically.")
        record = json.loads(meta_file.read_text(encoding="utf-8"))
        path = job_dir / "out" / record["file_name"]
        if not path.is_file() or self._is_expired(job_dir):
            self.delete(job_id)
            raise NotFound("This file has expired. Please convert it again.")
        return record, path

    def delete(self, job_id: str) -> bool:
        if not _JOB_ID.match(job_id):
            return False
        job_dir = self.root / job_id
        if job_dir.is_dir():
            shutil.rmtree(job_dir, ignore_errors=True)
            return True
        return False

    def discard(self, job: Job) -> None:
        shutil.rmtree(job.dir, ignore_errors=True)

    def cleanup_expired(self) -> int:
        removed = 0
        for job_dir in self.root.iterdir():
            if job_dir.is_dir() and self._is_expired(job_dir):
                shutil.rmtree(job_dir, ignore_errors=True)
                removed += 1
        if removed:
            log.info("Cleaned up %d expired jobs", removed)
        return removed

    def _is_expired(self, job_dir: Path) -> bool:
        try:
            return time.time() - job_dir.stat().st_mtime > self.ttl
        except FileNotFoundError:
            return True


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(timespec="seconds")
