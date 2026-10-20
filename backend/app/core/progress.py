"""Live progress for running conversions.

The browser picks a random progress id, sends it with the upload and polls
`GET /progress/{id}` while the (synchronous) conversion runs. Progress lives in
small JSON files so every worker process can answer the poll.
"""

import json
import os
import re
import time
from pathlib import Path

from app.core.config import get_settings

_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def valid_id(progress_id: str | None) -> bool:
    return bool(progress_id and _ID.fullmatch(progress_id))


def _path(progress_id: str) -> Path:
    # inside the storage root, so the normal expiry sweep also removes stray files
    return get_settings().storage_dir.resolve() / "_progress" / f"{progress_id}.json"


class Reporter:
    """Writes progress for one job. Silently does nothing without a valid id."""

    # don't hit the disk more than this often; the browser polls about once a second
    MIN_INTERVAL = 0.25

    def __init__(self, progress_id: str | None):
        self.path = _path(progress_id) if valid_id(progress_id) else None
        self._last_write = 0.0
        self._percent = 0.0
        self._stage: str | None = None

    def __call__(self, fraction: float, stage: str | None = None, *, force: bool = False) -> None:
        if not self.path:
            return
        # never move backwards, and leave 100% for the finished response
        self._percent = max(self._percent, min(max(fraction, 0.0), 0.99))
        now = time.monotonic()
        # a new stage is always written; repeats of the same stage are throttled
        if not force and stage == self._stage and now - self._last_write < self.MIN_INTERVAL:
            return
        self._last_write = now
        self._stage = stage
        data = {"percent": round(self._percent * 100, 1), "stage": stage, "updated": time.time()}
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(f".{os.getpid()}.tmp")
            tmp.write_text(json.dumps(data), encoding="utf-8")
            os.replace(tmp, self.path)
        except OSError:
            pass  # progress is best effort; never fail a conversion over it

    def close(self) -> None:
        if not self.path:
            return
        try:
            self.path.unlink(missing_ok=True)
        except OSError:
            # Windows refuses while a poll is reading it; the expiry sweep removes it later
            pass


def read(progress_id: str) -> dict | None:
    if not valid_id(progress_id):
        return None
    try:
        return json.loads(_path(progress_id).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def steps(report, start: float, end: float, total: int, label: str):
    """Yield 0..total-1 while reporting progress between `start` and `end`.

    `label` may contain {n} and {total}, e.g. "Reading page {n} of {total}".
    """
    total = max(total, 1)
    for i in range(total):
        report(start + (end - start) * i / total, label.format(n=i + 1, total=total))
        yield i
    report(end, label.format(n=total, total=total))
