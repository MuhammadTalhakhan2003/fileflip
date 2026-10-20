import time
from collections import deque

from app.core.errors import RateLimited


class RateLimiter:
    """In-memory sliding-window limiter keyed by client IP.

    Good for a single process. When running several instances behind a load
    balancer, move this to Redis so the limit is shared.
    """

    def __init__(self, limit: int, window_seconds: float = 60.0):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> None:
        if self.limit <= 0:
            return
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            retry_after = int(self.window - (now - hits[0])) + 1
            raise RateLimited(
                f"Too many requests. Please wait {retry_after} seconds and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)
        if len(self._hits) > 10_000:
            self._prune(now)

    def _prune(self, now: float) -> None:
        stale = [k for k, q in self._hits.items() if not q or now - q[-1] > self.window]
        for k in stale:
            del self._hits[k]
