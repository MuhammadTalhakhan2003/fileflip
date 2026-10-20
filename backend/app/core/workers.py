"""Run tools in worker processes.

PyMuPDF, Tesseract and friends hold Python's GIL while they work, so a heavy job
running inside the web process freezes it: health checks time out, progress polls
hang and the host may restart the whole service. Worker processes keep the API
responsive, and a job that runs too long (or eats all the memory) can be killed
without taking the web server down with it.
"""

import asyncio
import logging
import multiprocessing
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool

from app.core.config import get_settings

log = logging.getLogger(__name__)

_pool: ProcessPoolExecutor | None = None


def _execute(slug: str, ctx):
    from app.tools import get_tool  # imported in the worker; registers every tool

    return get_tool(slug).handler(ctx)


def _warm_up() -> None:
    from app.tools.office import warm_up_libreoffice

    warm_up_libreoffice()


def _get_pool() -> ProcessPoolExecutor:
    global _pool
    if _pool is None:
        _pool = ProcessPoolExecutor(
            max_workers=get_settings().job_slots,
            # spawn: a clean interpreter, never a fork of the threaded web server
            mp_context=multiprocessing.get_context("spawn"),
            # recycle workers now and then so memory from big files is handed back
            max_tasks_per_child=25,
        )
    return _pool


def reset() -> None:
    """Kill every worker (used after a timeout or a crash); the next job starts fresh ones."""
    global _pool
    pool, _pool = _pool, None
    if pool is None:
        return
    for process in list(getattr(pool, "_processes", {}).values()):
        try:
            process.kill()
        except Exception:  # already gone
            pass
    pool.shutdown(wait=False, cancel_futures=True)


async def run(slug: str, ctx, timeout: float):
    """Run one tool in a worker. Raises asyncio.TimeoutError or BrokenProcessPool like the executor would."""
    loop = asyncio.get_running_loop()
    future = loop.run_in_executor(_get_pool(), _execute, slug, ctx)
    try:
        return await asyncio.wait_for(future, timeout=timeout)
    except (asyncio.TimeoutError, BrokenProcessPool):
        reset()
        raise


def start() -> None:
    """Start a worker and warm up LibreOffice inside it, so the first real job is quick."""
    try:
        _get_pool().submit(_warm_up)
    except Exception:
        log.warning("Couldn't start the worker processes", exc_info=True)


def stop() -> None:
    global _pool
    pool, _pool = _pool, None
    if pool is not None:
        pool.shutdown(wait=False, cancel_futures=True)
