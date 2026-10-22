"""Image tools: format conversion (JPG/PNG/WEBP/...), images to PDF, scan to PDF, resize, compress."""

import io
from pathlib import Path

import pymupdf
from PIL import Image, ImageFilter, ImageOps

from app.core.errors import InvalidInput
from app.tools.common import IMAGE_EXTS, bundle, flatten_alpha, open_image, out_path
from app.tools.registry import Category, Context, Option, Result, Tool, register, tool

OUTPUT_FORMATS = ("jpg", "png", "webp", "gif", "bmp", "tiff", "ico", "ppm", "pdf")
PAGE_SIZES = {"a4": pymupdf.paper_rect("a4"), "letter": pymupdf.paper_rect("letter"), "legal": pymupdf.paper_rect("legal")}
MARGINS = {"none": 0, "small": 20, "big": 50}

QUALITY = Option("quality", "int", default=90, label="Quality", min=10, max=100, help="For JPG and WEBP")


# ---------------------------------------------------------------- encoding


def save_image(img: Image.Image, dest: Path, fmt: str, quality: int = 90) -> Path:
    if getattr(img, "n_frames", 1) > 1 and fmt != "gif":
        img.seek(0)
    if fmt == "jpg":
        flatten_alpha(img).save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
    elif fmt == "png":
        if img.mode not in ("RGB", "RGBA", "L", "LA", "P", "1", "I", "I;16"):
            img = img.convert("RGBA")
        img.save(dest, "PNG", optimize=True)
    elif fmt == "webp":
        img = img.convert("RGBA") if img.mode in ("RGBA", "LA", "P") else img.convert("RGB")
        img.save(dest, "WEBP", quality=quality, method=4)
    elif fmt == "gif":
        img.save(dest, "GIF", save_all=getattr(img, "n_frames", 1) > 1, optimize=True)
    elif fmt == "bmp":
        flatten_alpha(img).save(dest, "BMP")
    elif fmt == "tiff":
        img.save(dest, "TIFF", compression="tiff_lzw")
    elif fmt == "ico":
        img = img.convert("RGBA")
        img.thumbnail((256, 256))
        sizes = [(s, s) for s in (16, 24, 32, 48, 64, 128, 256) if s <= max(img.size)] or [(16, 16)]
        img.save(dest, "ICO", sizes=sizes)
    elif fmt == "ppm":
        flatten_alpha(img).save(dest, "PPM")
    elif fmt == "pdf":
        flatten_alpha(img).save(dest, "PDF", resolution=96.0)
    else:  # pragma: no cover
        raise InvalidInput(f"Unsupported output format: {fmt}")
    return dest


def _convert_all(ctx: Context, fmt: str) -> Result:
    outputs = []
    for src in ctx.each(ctx.inputs, "Converting image {n} of {total}"):
        with open_image(src) as img:
            outputs.append(save_image(img, out_path(ctx.work_dir, src.stem, f".{fmt}"), fmt, ctx.options.get("quality", 90)))
    return Result(bundle(outputs, ctx.work_dir, f"converted_{fmt}"), {"files": len(outputs), "format": fmt})


@tool(
    slug="image-converter",
    name="Image Converter",
    category=Category.IMAGE,
    description="Convert images between JPG, PNG, WEBP, HEIC, SVG, GIF, BMP, TIFF, ICO and more.",
    accepts=IMAGE_EXTS,
    output="image",
    max_files=50,
    options=(Option("format", "choice", default="png", label="Convert to", choices=OUTPUT_FORMATS), QUALITY),
    aliases=("convert-image",),
)
def image_converter(ctx: Context) -> Result:
    return _convert_all(ctx, ctx.options["format"])


def _register_pair(src: str, dst: str, src_exts: tuple[str, ...]) -> None:
    label = src.upper()
    register(
        Tool(
            slug=f"{src}-to-{dst}",
            name=f"{label} to {dst.upper()}",
            category=Category.IMAGE,
            description=f"Convert {label} images to {dst.upper()} in seconds.",
            accepts=src_exts,
            output=dst,
            max_files=50,
            options=(QUALITY,) if dst in ("jpg", "webp") else (),
            handler=lambda ctx, _dst=dst: _convert_all(ctx, _dst),
        )
    )


_PAIR_SOURCES = {
    "jpg": ("jpg", "jpeg"),
    "png": ("png",),
    "webp": ("webp",),
    "gif": ("gif",),
    "bmp": ("bmp",),
    "tiff": ("tiff", "tif"),
    "heic": ("heic", "heif"),
    "svg": ("svg",),
}
for _src, _exts in _PAIR_SOURCES.items():
    if not set(_exts) <= set(IMAGE_EXTS):
        continue
    for _dst in ("jpg", "png", "webp"):
        if _dst != _src:
            _register_pair(_src, _dst, _exts)
_register_pair("png", "ico", ("png",))
_register_pair("jpg", "ico", ("jpg", "jpeg"))


# ---------------------------------------------------------------- images -> PDF

PDF_LAYOUT_OPTIONS = (
    Option("page_size", "choice", default="fit", label="Page size", choices=("fit", "a4", "letter", "legal")),
    Option("orientation", "choice", default="auto", label="Orientation", choices=("auto", "portrait", "landscape")),
    Option("margin", "choice", default="none", label="Margin", choices=tuple(MARGINS)),
    Option("merge", "bool", default=True, label="Merge all images into one PDF"),
)


# Longest side kept for a page image: A4/Letter at 300 DPI, so prints stay sharp. Phone photos
# are often bigger; shrinking them keeps PDFs small and memory low on small servers.
MAX_PAGE_PIXELS = 3508
# Upright JPEGs at most this big go into the PDF byte-for-byte, without decoding
PASSTHROUGH_BYTES = 6 * 1024 * 1024


def _page_image(src: Path, prepare=None, opts: dict | None = None) -> tuple[bytes, int, int, float]:
    """One image ready for a PDF page: (encoded bytes, width px, height px, dpi). Decodes as little as possible."""
    if src.suffix.lower() in (".jpg", ".jpeg") and prepare is None:
        try:
            with Image.open(src) as head:  # reads only the header
                upright = head.format == "JPEG" and head.getexif().get(0x0112, 1) == 1
                if upright and head.mode in ("RGB", "L", "CMYK") and max(head.size) <= MAX_PAGE_PIXELS                         and src.stat().st_size <= PASSTHROUGH_BYTES:
                    dpi = (head.info.get("dpi") or (96, 96))[0] or 96
                    return src.read_bytes(), head.width, head.height, float(dpi)
        except Exception:
            pass  # fall through to a full decode, which reports damaged files properly

    img = open_image(src, max_side=MAX_PAGE_PIXELS)
    try:
        if getattr(img, "n_frames", 1) > 1:
            img.seek(0)
        dpi = float((img.info.get("dpi") or (96, 96))[0] or 96)
        if prepare:
            img = prepare(img, opts)
        if max(img.size) > MAX_PAGE_PIXELS:
            scale = MAX_PAGE_PIXELS / max(img.size)
            dpi *= scale  # keep the same physical size on "fit" pages
            img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        if img.mode in ("RGBA", "LA", "P"):
            img.convert("RGBA").save(buf, "PNG")
        else:
            img.convert("RGB").save(buf, "JPEG", quality=92)
        return buf.getvalue(), img.width, img.height, dpi
    finally:
        img.close()


def images_to_pdf(sources: list[Path], dest: Path, opts: dict, prepare=None, report=None) -> int:
    """Build a PDF one image at a time, so memory stays flat however many photos there are."""
    doc = pymupdf.open()
    margin = MARGINS[opts["margin"]]
    for i, src in enumerate(sources):
        if report:
            report(0.05 + 0.85 * i / len(sources), f"Adding image {i + 1} of {len(sources)}")
        data, width, height, dpi = _page_image(src, prepare, opts)
        img_w = width * 72 / dpi
        img_h = height * 72 / dpi

        if opts["page_size"] == "fit":
            page_w, page_h = img_w + 2 * margin, img_h + 2 * margin
        else:
            paper = PAGE_SIZES[opts["page_size"]]
            page_w, page_h = paper.width, paper.height
            landscape = opts["orientation"] == "landscape" or (opts["orientation"] == "auto" and width > height)
            if landscape:
                page_w, page_h = page_h, page_w

        page = doc.new_page(width=page_w, height=page_h)
        area = pymupdf.Rect(margin, margin, page_w - margin, page_h - margin)
        page.insert_image(area, stream=data, keep_proportion=True)
        del data
    if report:
        report(0.92, "Saving your PDF")
    doc.save(dest, garbage=3, deflate=True)
    count = doc.page_count
    doc.close()
    return count


def _images_to_pdf_tool(ctx: Context, prepare=None) -> Result:
    opts = ctx.options
    stem = ctx.inputs[0].stem if len(ctx.inputs) == 1 else "images"
    if opts["merge"]:
        dest = out_path(ctx.work_dir, stem, ".pdf")
        pages = images_to_pdf(ctx.inputs, dest, opts, prepare, ctx.progress)
        return Result(dest, {"pages": pages})
    outputs = []
    for src in ctx.each(ctx.inputs, "Converting image {n} of {total}"):
        dest = out_path(ctx.work_dir, src.stem, ".pdf")
        images_to_pdf([src], dest, opts, prepare)
        outputs.append(dest)
    return Result(bundle(outputs, ctx.work_dir, "images_pdf"), {"files": len(outputs)})


@tool(
    slug="jpg-to-pdf",
    name="JPG to PDF",
    category=Category.TO_PDF,
    description="Convert JPG, PNG and other images to PDF. Adjust orientation and margins.",
    accepts=IMAGE_EXTS,
    output="pdf",
    max_files=100,
    options=PDF_LAYOUT_OPTIONS,
    aliases=("image-to-pdf", "png-to-pdf", "images-to-pdf"),
)
def jpg_to_pdf(ctx: Context) -> Result:
    return _images_to_pdf_tool(ctx)


def _scan_enhance(img: Image.Image, opts: dict) -> Image.Image:
    img = flatten_alpha(img)
    if opts["enhance"]:
        img = ImageOps.autocontrast(img, cutoff=1)
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=3))
    if opts["color"] == "grayscale":
        img = img.convert("L")
    elif opts["color"] == "bw":
        img = img.convert("L").point(lambda v: 255 if v > 150 else 0, mode="1").convert("L")
    return img


@tool(
    slug="scan-to-pdf",
    name="Scan to PDF",
    category=Category.ORGANIZE,
    description="Turn photos of documents into clean, readable PDFs.",
    accepts=IMAGE_EXTS,
    output="pdf",
    max_files=100,
    options=(
        Option("color", "choice", default="color", label="Color mode", choices=("color", "grayscale", "bw")),
        Option("enhance", "bool", default=True, label="Auto-enhance contrast and sharpness"),
        Option("page_size", "choice", default="a4", label="Page size", choices=("fit", "a4", "letter", "legal")),
        Option("orientation", "choice", default="auto", label="Orientation", choices=("auto", "portrait", "landscape")),
        Option("margin", "choice", default="none", label="Margin", choices=tuple(MARGINS)),
        Option("merge", "bool", default=True, label="Merge all scans into one PDF"),
    ),
)
def scan_to_pdf(ctx: Context) -> Result:
    return _images_to_pdf_tool(ctx, prepare=_scan_enhance)


# ---------------------------------------------------------------- resize / compress


@tool(
    slug="resize-image",
    name="Resize Image",
    category=Category.IMAGE,
    description="Resize images by pixels or percentage.",
    accepts=IMAGE_EXTS,
    output="image",
    max_files=50,
    options=(
        Option("width", "int", default=0, label="Width (px)", min=0, max=20_000),
        Option("height", "int", default=0, label="Height (px)", min=0, max=20_000),
        Option("percent", "int", default=0, label="Scale (%)", min=0, max=1000),
        Option("keep_aspect", "bool", default=True, label="Keep aspect ratio"),
        QUALITY,
    ),
)
def resize_image(ctx: Context) -> Result:
    o = ctx.options
    if not (o["width"] or o["height"] or o["percent"]):
        raise InvalidInput("Enter a width, a height or a percentage.")
    outputs = []
    for src in ctx.each(ctx.inputs, "Resizing image {n} of {total}"):
        with open_image(src) as img:
            w, h = img.size
            if o["percent"]:
                size = (max(1, round(w * o["percent"] / 100)), max(1, round(h * o["percent"] / 100)))
            elif o["keep_aspect"]:
                scale = min(o["width"] / w if o["width"] else float("inf"), o["height"] / h if o["height"] else float("inf"))
                size = (max(1, round(w * scale)), max(1, round(h * scale)))
            else:
                size = (o["width"] or w, o["height"] or h)
            if size[0] * size[1] > 200_000_000:
                raise InvalidInput("The requested size is too large.")
            resized = img.resize(size, Image.Resampling.LANCZOS)
            fmt = _format_of(src)
            outputs.append(save_image(resized, out_path(ctx.work_dir, f"{src.stem}_{size[0]}x{size[1]}", f".{fmt}"), fmt, o["quality"]))
    return Result(bundle(outputs, ctx.work_dir, "resized"), {"files": len(outputs)})


@tool(
    slug="compress-image",
    name="Compress Image",
    category=Category.IMAGE,
    description="Shrink JPG, PNG and WEBP files with minimal visible quality loss.",
    accepts=IMAGE_EXTS,
    output="image",
    max_files=50,
    options=(
        Option("quality", "int", default=75, label="Quality", min=10, max=100),
        Option("max_dimension", "int", default=0, label="Max width/height (px, 0 = keep)", min=0, max=20_000),
    ),
)
def compress_image(ctx: Context) -> Result:
    outputs = []
    before = after = 0
    for src in ctx.each(ctx.inputs, "Compressing image {n} of {total}"):
        with open_image(src) as img:
            if ctx.options["max_dimension"]:
                img.thumbnail((ctx.options["max_dimension"],) * 2, Image.Resampling.LANCZOS)
            fmt = _format_of(src)
            dest = out_path(ctx.work_dir, f"{src.stem}_compressed", f".{fmt}")
            if fmt == "png":
                # quantizing to 256 colors is what makes PNGs dramatically smaller
                quantized = img.convert("RGBA").quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
                quantized.save(dest, "PNG", optimize=True)
            else:
                save_image(img, dest, fmt, ctx.options["quality"])
        if dest.stat().st_size >= src.stat().st_size:
            dest.write_bytes(src.read_bytes())
        before += src.stat().st_size
        after += dest.stat().st_size
        outputs.append(dest)
    return Result(
        bundle(outputs, ctx.work_dir, "compressed_images"),
        {"original_size": before, "compressed_size": after, "saved_percent": round(100 * (before - after) / before, 1) if before else 0},
    )


def _format_of(src: Path) -> str:
    ext = src.suffix.lower().lstrip(".")
    # formats we can read but not write well are saved as the closest common format
    return {
        "jpeg": "jpg", "tif": "tiff", "heic": "jpg", "heif": "jpg",
        "svg": "png", "xbm": "png", "xpm": "png", "pgm": "png", "pbm": "png", "pnm": "png",
    }.get(ext, ext)
