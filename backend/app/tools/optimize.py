"""Optimize PDF: compress, repair, OCR."""

import logging
import re
import shutil
import subprocess

import pymupdf

from app.core import engines
from app.core.errors import ConversionFailed, InvalidInput
from app.tools.common import PAGES, PASSWORD, bundle, open_pdf, out_path, parse_page_ranges
from app.tools.registry import Category, Context, Option, Result, tool

log = logging.getLogger(__name__)

# level -> (only touch images above this dpi, target dpi, jpeg quality)
COMPRESSION_LEVELS = {
    "low": (200, 150, 85),
    "recommended": (150, 120, 70),
    "extreme": (96, 72, 45),
}


@tool(
    slug="compress-pdf",
    name="Compress PDF",
    category=Category.OPTIMIZE,
    description="Reduce file size while keeping the best possible quality.",
    accepts=("pdf",),
    output="pdf",
    max_files=20,
    options=(
        Option("level", "choice", default="recommended", label="Compression", choices=tuple(COMPRESSION_LEVELS)),
        Option("grayscale", "bool", default=False, label="Convert images to grayscale"),
        PASSWORD,
    ),
)
def compress_pdf(ctx: Context) -> Result:
    outputs = []
    before_total = after_total = 0
    threshold, target, quality = COMPRESSION_LEVELS[ctx.options["level"]]

    count = len(ctx.inputs)
    for k, src in enumerate(ctx.inputs):
        before = src.stat().st_size
        out = out_path(ctx.work_dir, f"{src.stem}_compressed", ".pdf")
        which = f" ({k + 1} of {count})" if count > 1 else ""

        def stage(fraction: float, text: str) -> None:
            ctx.progress((k + fraction) / count, text + which)

        with open_pdf(src, ctx.options["password"]) as doc:
            stage(0.05, "Optimizing images")
            try:
                doc.rewrite_images(
                    dpi_threshold=threshold,
                    dpi_target=target,
                    quality=quality,
                    set_to_gray=ctx.options["grayscale"],
                )
            except Exception:  # very old or exotic image types - continue with structural compression
                log.warning("Image rewrite failed for %s", src.name, exc_info=True)
            stage(0.6, "Slimming down fonts")
            try:
                doc.subset_fonts()
            except Exception:
                log.debug("Font subsetting skipped", exc_info=True)
            stage(0.75, "Packing the smaller PDF")
            doc.save(out, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True, use_objstms=1)

        after = out.stat().st_size
        if after >= before:  # already optimal - never hand back a bigger file
            shutil.copyfile(src, out)
            after = before
        before_total += before
        after_total += after
        outputs.append(out)

    saved = before_total - after_total
    return Result(
        bundle(outputs, ctx.work_dir, "compressed"),
        {
            "original_size": before_total,
            "compressed_size": after_total,
            "saved_bytes": saved,
            "saved_percent": round(100 * saved / before_total, 1) if before_total else 0,
        },
    )


@tool(
    slug="repair-pdf",
    name="Repair PDF",
    category=Category.OPTIMIZE,
    description="Recover data from a damaged or corrupt PDF.",
    accepts=("pdf",),
    output="pdf",
    options=(PASSWORD,),
)
def repair_pdf(ctx: Context) -> Result:
    src = ctx.inputs[0]
    out = out_path(ctx.work_dir, f"{src.stem}_repaired", ".pdf")
    try:
        doc = pymupdf.open(src, filetype="pdf")
    except Exception:
        doc = None

    if doc is not None and doc.page_count > 0:
        if doc.needs_pass and not doc.authenticate(ctx.options["password"] or ""):
            raise InvalidInput("This PDF is password protected. Enter its password to repair it.", code="password_required")
        repaired = doc.is_repaired
        doc.save(out, garbage=4, deflate=True, clean=True)
        pages = doc.page_count
        doc.close()
        return Result(out, {"pages": pages, "was_damaged": repaired, "engine": "mupdf"})

    # MuPDF couldn't read it at all - Ghostscript can sometimes salvage more.
    gs = engines.ghostscript_path()
    if not gs:
        raise InvalidInput("This file is too damaged to recover.")
    proc = subprocess.run(
        [gs, "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=pdfwrite", f"-sOutputFile={out}", str(src)],
        capture_output=True,
        timeout=240,
    )
    if proc.returncode != 0 or not out.is_file() or out.stat().st_size == 0:
        raise InvalidInput("This file is too damaged to recover.")
    return Result(out, {"was_damaged": True, "engine": "ghostscript"})


@tool(
    slug="ocr-pdf",
    name="OCR PDF",
    category=Category.OPTIMIZE,
    description="Make scanned PDFs searchable and selectable by recognizing their text.",
    accepts=("pdf",),
    output="pdf",
    requires=(engines.TESSERACT,),
    timeout=900,
    options=(
        Option("language", "str", default="eng", label="Document language(s)", help="Tesseract codes, e.g. eng, urd, ara, eng+urd"),
        Option("force", "bool", default=False, label="OCR pages that already contain text"),
        Option("dpi", "int", default=300, label="Scan resolution", min=150, max=400),
        PAGES,
        PASSWORD,
    ),
)
def ocr_pdf(ctx: Context) -> Result:
    language = ctx.options["language"].lower()
    if not re.fullmatch(r"[a-z_]{3,10}(\+[a-z_]{3,10}){0,4}", language):
        raise InvalidInput("Language must be Tesseract codes like 'eng' or 'eng+urd'.")

    missing = set(language.split("+")) - engines.tesseract_languages()
    if missing:
        raise InvalidInput(f"OCR language not available: {', '.join(sorted(missing))}. Installed: {', '.join(sorted(engines.tesseract_languages() - {'osd'}))}.")

    src = ctx.inputs[0]
    recognized = skipped = 0
    with open_pdf(src, ctx.options["password"]) as doc:
        pages = parse_page_ranges(ctx.options["pages"], doc.page_count)
        for i in ctx.steps(len(pages), "Reading text on page {n} of {total}", end=0.9):
            index = pages[i]
            page = doc[index]
            if not ctx.options["force"] and page.get_text("text").strip():
                skipped += 1
                continue
            try:
                textpage = page.get_textpage_ocr(dpi=ctx.options["dpi"], full=True, language=language, tessdata=engines.tessdata_path())
            except Exception as exc:
                raise ConversionFailed(
                    f"OCR failed. Make sure the language pack '{language}' is installed on the server."
                ) from exc
            _add_invisible_text(page, page.get_text("words", textpage=textpage))
            recognized += 1

        ctx.progress(0.92, "Saving your searchable PDF")
        out = out_path(ctx.work_dir, f"{src.stem}_ocr", ".pdf")
        doc.save(out, garbage=3, deflate=True)
    return Result(out, {"pages_recognized": recognized, "pages_skipped_with_text": skipped})


def _add_invisible_text(page: pymupdf.Page, words: list) -> None:
    """Lay an invisible text layer over the scan so it can be searched and copied."""
    if not words:
        return
    if not page.is_wrapped:
        page.wrap_contents()
    shape = page.new_shape()
    for x0, y0, x1, y1, text, *_ in words:
        height = y1 - y0
        width = x1 - x0
        if height <= 0 or width <= 0 or not text.strip():
            continue
        fontsize = height * 0.85
        natural = pymupdf.get_text_length(text, fontname="helv", fontsize=fontsize)
        # word boxes from text extraction are already in unrotated page space
        origin = pymupdf.Point(x0, y1 - height * 0.2)
        morph = (origin, pymupdf.Matrix(width / natural, 1)) if natural > 0 else None
        shape.insert_text(origin, text, fontsize=fontsize, fontname="helv", render_mode=3, morph=morph)
    shape.commit()
