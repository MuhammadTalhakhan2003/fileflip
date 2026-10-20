"""Convert to PDF: Word, Excel, PowerPoint and HTML.

Office formats are rendered with LibreOffice (headless), which gives the most
faithful free conversion. HTML falls back to MuPDF's built-in layout engine
when LibreOffice isn't installed.
"""

import logging
import os
import queue
import shutil
import subprocess
import tempfile
from pathlib import Path

import pymupdf

from app.core import engines
from app.core.config import get_settings, small_machine
from app.core.errors import ConversionFailed, EngineUnavailable, InvalidInput
from app.tools.common import bundle, out_path
from app.tools.registry import Category, Context, Result, tool

log = logging.getLogger(__name__)

WORD_EXTS = ("doc", "docx", "odt", "rtf", "txt", "wpd", "docm", "dot", "dotx")
EXCEL_EXTS = ("xls", "xlsx", "xlsm", "ods", "csv")
POWERPOINT_EXTS = ("ppt", "pptx", "pps", "ppsx", "odp")
HTML_EXTS = ("html", "htm")


# LibreOffice spends ~8 s creating a fresh user profile, so profiles are reused.
# A profile can't be shared by two running instances, hence a small pool: each
# conversion borrows one, and parallel conversions get different ones.
_PROFILE_POOL_SIZE = get_settings().libreoffice_pool_size or (
    1 if small_machine() else max(1, min(4, (os.cpu_count() or 2) // 2))
)
_free_profiles: queue.SimpleQueue[Path] = queue.SimpleQueue()
for _i in range(_PROFILE_POOL_SIZE):
    _free_profiles.put(Path(tempfile.gettempdir()) / "fileflip-lo-profiles" / f"{os.getpid()}-{_i}")  # per process: uvicorn may run several workers


def libreoffice_convert(src: Path, out_dir: Path, target: str = "pdf", *, infilter: str | None = None) -> Path:
    """Run LibreOffice headless on one file, using a profile borrowed from the pool."""
    exe = engines.libreoffice_path()
    if not exe:
        raise EngineUnavailable("Office conversion isn't available on this server right now.")

    out_dir.mkdir(parents=True, exist_ok=True)
    timeout = max(60, get_settings().job_timeout_seconds - 10)
    profile = _free_profiles.get()
    try:
        cmd = [
            exe,
            f"-env:UserInstallation={profile.as_uri()}",
            "--headless",
            "--invisible",
            "--nodefault",
            "--nofirststartwizard",
            "--nolockcheck",
            "--nologo",
            "--norestore",
        ]
        if infilter:
            cmd.append(f"--infilter={infilter}")
        cmd += ["--convert-to", target, "--outdir", str(out_dir), str(src)]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            # a killed instance can leave a broken profile behind - start that slot fresh
            shutil.rmtree(profile, ignore_errors=True)
            raise ConversionFailed(f"'{src.name}' took too long to convert.", status_code=504) from None
    finally:
        _free_profiles.put(profile)

    ext = target.split(":")[0]
    produced = out_dir / f"{src.stem}.{ext}"
    if proc.returncode != 0 or not produced.is_file() or produced.stat().st_size == 0:
        log.warning("LibreOffice failed (%s): %s", proc.returncode, proc.stderr.decode(errors="ignore")[-2000:])
        raise InvalidInput(f"'{src.name}' could not be converted. The file may be damaged or password protected.")
    return produced


def warm_up_libreoffice() -> None:
    """Create the pooled profiles ahead of the first real request (run in the background at startup)."""
    if not engines.libreoffice_path():
        return
    with tempfile.TemporaryDirectory(prefix="lo-warmup-") as tmp:
        sample = Path(tmp) / "warmup.txt"
        sample.write_text("FileFlip", encoding="utf-8")
        for i in range(_PROFILE_POOL_SIZE):
            try:
                libreoffice_convert(sample, Path(tmp) / f"out{i}")
            except Exception as exc:  # warm-up is best effort
                log.info("LibreOffice warm-up skipped: %s", exc)
                return


def _office_to_pdf(ctx: Context, label: str) -> Result:
    outputs = []
    label = "Converting your document" if len(ctx.inputs) == 1 else "Converting file {n} of {total}"
    for src in ctx.each(ctx.inputs, label):
        pdf = libreoffice_convert(src, ctx.work_dir / "parts")
        outputs.append(pdf.rename(out_path(ctx.work_dir, src.stem, ".pdf")))
    return Result(bundle(outputs, ctx.work_dir, f"{label}_pdfs"), {"files": len(outputs)})


@tool(
    slug="word-to-pdf",
    name="Word to PDF",
    category=Category.TO_PDF,
    description="Make DOC and DOCX files easy to read by converting them to PDF.",
    accepts=WORD_EXTS,
    output="pdf",
    max_files=10,
    requires=(engines.LIBREOFFICE,),
    aliases=("docx-to-pdf", "doc-to-pdf"),
)
def word_to_pdf(ctx: Context) -> Result:
    return _office_to_pdf(ctx, "word")


@tool(
    slug="excel-to-pdf",
    name="Excel to PDF",
    category=Category.TO_PDF,
    description="Turn spreadsheets into PDFs while preserving formatting.",
    accepts=EXCEL_EXTS,
    output="pdf",
    max_files=10,
    requires=(engines.LIBREOFFICE,),
    aliases=("xlsx-to-pdf", "xls-to-pdf"),
)
def excel_to_pdf(ctx: Context) -> Result:
    return _office_to_pdf(ctx, "excel")


@tool(
    slug="powerpoint-to-pdf",
    name="PowerPoint to PDF",
    category=Category.TO_PDF,
    description="Convert presentations to PDF for easy sharing and printing.",
    accepts=POWERPOINT_EXTS,
    output="pdf",
    max_files=10,
    requires=(engines.LIBREOFFICE,),
    aliases=("ppt-to-pdf", "pptx-to-pdf"),
)
def powerpoint_to_pdf(ctx: Context) -> Result:
    return _office_to_pdf(ctx, "powerpoint")


@tool(
    slug="html-to-pdf",
    name="HTML to PDF",
    category=Category.TO_PDF,
    description="Convert web pages (HTML files) to PDF.",
    accepts=HTML_EXTS,
    output="pdf",
    max_files=10,
)
def html_to_pdf(ctx: Context) -> Result:
    outputs = []
    for src in ctx.inputs:
        target = out_path(ctx.work_dir, src.stem, ".pdf")
        if engines.libreoffice_path():
            libreoffice_convert(src, ctx.work_dir / "parts", "pdf:writer_web_pdf_Export").rename(target)
        else:
            _html_with_mupdf(src, target)
        outputs.append(target)
    return Result(bundle(outputs, ctx.work_dir, "html_pdfs"), {"files": len(outputs)})


def _html_with_mupdf(src: Path, target: Path) -> None:
    html = src.read_bytes().decode("utf-8", errors="replace")
    story = pymupdf.Story(html=html)
    writer = pymupdf.DocumentWriter(str(target))
    mediabox = pymupdf.paper_rect("a4")
    where = mediabox + (36, 36, -36, -36)
    more = True
    pages = 0
    while more:
        device = writer.begin_page(mediabox)
        more, _ = story.place(where)
        story.draw(device)
        writer.end_page()
        pages += 1
        if pages > get_settings().max_pdf_pages:
            break
    writer.close()
