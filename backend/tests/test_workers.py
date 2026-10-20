"""Tools running in worker processes (the production setup)."""

import asyncio

import pymupdf
import pytest

from app.core import progress, workers
from app.core.errors import InvalidInput
from app.tools import get_tool
from app.tools.registry import Context
from tests.conftest import make_pdf


@pytest.fixture(autouse=True)
def fresh_pool():
    yield
    workers.stop()


def _ctx(tmp_path, slug, data, options=None, progress_id=None):
    src = tmp_path / "in.pdf"
    src.write_bytes(data)
    work = tmp_path / "work"
    work.mkdir(exist_ok=True)
    t = get_tool(slug)
    ctx = Context(inputs=[src], work_dir=work, options=t.parse_options(options or {}))
    if progress_id:
        ctx.progress = progress.Reporter(progress_id)
    return ctx


def test_worker_runs_tool_and_reports_progress(tmp_path):
    ctx = _ctx(tmp_path, "pdf-to-jpg", make_pdf(3), progress_id="worker-progress-1")
    result = asyncio.run(workers.run("pdf-to-jpg", ctx, timeout=120))
    assert result.path.is_file() and result.meta["pages"] == 3
    # the worker wrote progress the web process can read
    data = progress.read("worker-progress-1")
    assert data and data["percent"] > 50
    ctx.progress.close()


def test_worker_errors_keep_their_code(tmp_path):
    doc = pymupdf.open(stream=make_pdf(1), filetype="pdf")
    locked = doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="secret")
    ctx = _ctx(tmp_path, "unlock-pdf", locked, {"password": "wrong"})
    with pytest.raises(InvalidInput) as err:
        asyncio.run(workers.run("unlock-pdf", ctx, timeout=120))
    assert err.value.code == "wrong_password"
    assert err.value.status_code == 422


def test_runaway_job_is_killed_and_next_job_still_works(tmp_path):
    slow = _ctx(tmp_path, "pdf-to-png", make_pdf(40), {"dpi": "300"})
    with pytest.raises(asyncio.TimeoutError):
        asyncio.run(workers.run("pdf-to-png", slow, timeout=0.5))

    (tmp_path / "next").mkdir()
    quick = _ctx(tmp_path / "next", "pdf-to-jpg", make_pdf(1))
    result = asyncio.run(workers.run("pdf-to-jpg", quick, timeout=120))
    assert result.path.is_file()
