"""Helpers shared by all tools."""

import re
import zipfile
from pathlib import Path

import pymupdf
from PIL import Image, ImageOps

from app.core.config import get_settings
from app.core.errors import InvalidInput
from app.tools.registry import Option

pymupdf.TOOLS.mupdf_display_errors(False)
pymupdf.TOOLS.mupdf_display_warnings(False)

try:  # HEIC / HEIF photos from iPhones
    from pillow_heif import register_heif_opener

    register_heif_opener()
    HEIF_SUPPORTED = True
except Exception:  # pragma: no cover
    HEIF_SUPPORTED = False

IMAGE_EXTS: tuple[str, ...] = (
    ("jpg", "jpeg", "png", "webp", "bmp", "gif", "tiff", "tif", "ico")
    + (("heic", "heif") if HEIF_SUPPORTED else ())
    # vector + classic Unix formats: SVG is rasterized with MuPDF, the rest Pillow reads natively
    + ("svg", "ppm", "pgm", "pbm", "pnm", "xbm", "xpm")
)
SVG_RENDER_SCALE = 2.0  # render SVGs at 2x their declared size so they stay crisp

# ---------------------------------------------------------------- options

PAGES = Option("pages", "str", default="all", label="Pages", help="All pages, or ranges like 1-3,5,8-")
PASSWORD = Option("password", "str", default="", label="PDF password", help="Only for protected PDFs", secret=True)

# ---------------------------------------------------------------- file names

_WINDOWS_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}


def safe_filename(name: str, fallback: str = "file") -> str:
    name = Path((name or "").replace("\\", "/")).name
    name = re.sub(r"[^\w.\- ()]+", "_", name).strip(" ._")
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    stem = stem[:120] or fallback
    if stem.upper() in _WINDOWS_RESERVED:
        stem = f"_{stem}"
    return f"{stem}.{ext.lower()}" if ext else stem


def out_path(directory: Path, stem: str, suffix: str) -> Path:
    """Build an output path like 'report.docx' that doesn't collide with existing files."""
    candidate = directory / f"{stem}{suffix}"
    n = 2
    while candidate.exists():
        candidate = directory / f"{stem}_{n}{suffix}"
        n += 1
    return candidate


# ---------------------------------------------------------------- page ranges


def _parse_part(part: str, page_count: int) -> tuple[int, int]:
    m = re.fullmatch(r"(\d*)\s*-\s*(\d*)", part)
    if m:
        start = int(m[1]) if m[1] else 1
        end = int(m[2]) if m[2] else page_count
    elif part.isdigit():
        start = end = int(part)
    else:
        raise InvalidInput(f"'{part}' is not a valid page range. Use something like 1-3,5,8-.")
    if start < 1 or end > page_count or start > end:
        raise InvalidInput(f"Page range '{part}' is outside this document (it has {page_count} pages).")
    return start - 1, end - 1


def parse_range_groups(spec: str, page_count: int) -> list[list[int]]:
    """'1-3,5' -> [[0,1,2],[4]] (0-based)."""
    spec = (spec or "").strip().lower()
    if spec in ("", "all"):
        return [list(range(page_count))]
    groups = []
    for part in spec.split(","):
        part = part.strip()
        if part:
            a, b = _parse_part(part, page_count)
            groups.append(list(range(a, b + 1)))
    if not groups:
        raise InvalidInput("Please choose at least one page.")
    return groups


def parse_page_ranges(spec: str, page_count: int) -> list[int]:
    """'1-3,5' -> [0,1,2,4] (0-based, unique, in the given order)."""
    seen: set[int] = set()
    pages = []
    for group in parse_range_groups(spec, page_count):
        for p in group:
            if p not in seen:
                seen.add(p)
                pages.append(p)
    return pages


# ---------------------------------------------------------------- PDFs


def open_pdf(path: Path, password: str = "") -> pymupdf.Document:
    try:
        doc = pymupdf.open(path, filetype="pdf")
    except Exception:
        raise InvalidInput(f"'{path.name}' is not a valid PDF or is too damaged to open. Try 'Repair PDF' first.") from None
    if doc.needs_pass:
        if not password:
            doc.close()
            raise InvalidInput(
                f"'{path.name}' is password protected. Enter its password to continue.", code="password_required"
            )
        if not doc.authenticate(password):
            doc.close()
            raise InvalidInput(f"Wrong password for '{path.name}'.", code="wrong_password")
    if doc.page_count == 0:
        doc.close()
        raise InvalidInput(f"'{path.name}' has no pages.")
    limit = get_settings().max_pdf_pages
    if doc.page_count > limit:
        doc.close()
        raise InvalidInput(f"'{path.name}' has {doc.page_count} pages. The limit is {limit}.")
    return doc


def save_pdf(doc: pymupdf.Document, path: Path, *, compact: bool = True) -> Path:
    if compact:
        doc.save(path, garbage=3, deflate=True, clean=False)
    else:
        doc.save(path)
    return path


def visual_rect(page: pymupdf.Page, x: float, y: float, w: float, h: float) -> pymupdf.Rect:
    """Convert a rectangle given in what the user *sees* (top-left origin, points,
    page rotation applied) into the page's internal unrotated coordinates."""
    return pymupdf.Rect(x, y, x + w, y + h) * page.derotation_matrix


def visual_point(page: pymupdf.Page, x: float, y: float) -> pymupdf.Point:
    return pymupdf.Point(x, y) * page.derotation_matrix


def ensure_wrapped(page: pymupdf.Page) -> None:
    """Isolate existing page content so our drawings aren't affected by its transforms."""
    if not page.is_wrapped:
        page.wrap_contents()


# ---------------------------------------------------------------- bundles


def zip_files(paths: list[Path], dest: Path) -> Path:
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        used: set[str] = set()
        for p in paths:
            arc = p.name
            n = 2
            while arc in used:
                arc = f"{p.stem}_{n}{p.suffix}"
                n += 1
            used.add(arc)
            zf.write(p, arc)
    return dest


def bundle(paths: list[Path], work_dir: Path, zip_stem: str) -> Path:
    """Return the single output as-is, or zip several outputs together."""
    if not paths:
        raise InvalidInput("Nothing was produced from this file.")
    if len(paths) == 1:
        return paths[0]
    parts_dir = paths[0].parent
    dest = zip_files(paths, work_dir / f"{zip_stem}.zip")
    if parts_dir != work_dir:
        for p in paths:
            p.unlink(missing_ok=True)
    return dest


# ---------------------------------------------------------------- images


def _rasterize_svg(path: Path) -> Image.Image:
    try:
        with pymupdf.open(path, filetype="svg") as doc:
            pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(SVG_RENDER_SCALE, SVG_RENDER_SCALE), alpha=True)
    except Exception:
        raise InvalidInput(f"'{path.name}' is not a valid SVG image.") from None
    if pix.width * pix.height > 100_000_000:
        raise InvalidInput(f"'{path.name}' is too large.")
    return Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)


def open_image(path: Path, max_side: int | None = None) -> Image.Image:
    """Open and decode an image, upright. With `max_side`, big JPEGs are decoded at a reduced
    scale straight away (a 12 MP photo then needs a quarter of the memory)."""
    if path.suffix.lower() == ".svg":
        return _rasterize_svg(path)
    try:
        img = Image.open(path)
        if max_side and img.format == "JPEG" and max(img.size) > max_side:
            img.draft("RGB", (max_side, max_side))
        img.load()
    except Image.DecompressionBombError:
        raise InvalidInput(f"'{path.name}' is too large (too many pixels).") from None
    except Exception:
        raise InvalidInput(f"'{path.name}' is not a valid image or is damaged.") from None
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    return img


def flatten_alpha(img: Image.Image, background=(255, 255, 255)) -> Image.Image:
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, background)
        bg.paste(rgba, mask=rgba.getchannel("A"))
        return bg
    return img.convert("RGB")
