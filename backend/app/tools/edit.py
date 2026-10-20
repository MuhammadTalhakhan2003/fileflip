"""Edit PDF: rotate, page numbers, watermark, crop, free-form editor, form filling.

Coordinates sent by the frontend are always in PDF points, measured from the
top-left corner of the page *as the user sees it* (rotation applied). The
sizes to draw against come from POST /api/v1/inspect.
"""

import html
import io
from pathlib import Path

import pymupdf
from PIL import Image

from app.core.errors import InvalidInput
from app.tools.common import (
    IMAGE_EXTS,
    PAGES,
    PASSWORD,
    bundle,
    ensure_wrapped,
    open_image,
    open_pdf,
    out_path,
    parse_page_ranges,
    visual_rect,
)
from app.tools.registry import Category, Context, ExtraInput, Option, Result, parse_color, tool

FONT_CSS = {
    "sans": "sans-serif",
    "serif": "serif",
    "mono": "monospace",
}
BASE14 = {"sans": "helv", "serif": "tiro", "mono": "cour"}
BASE14_BOLD = {"sans": "hebo", "serif": "tibo", "mono": "cobo"}


def _hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{round(c * 255):02x}" for c in rgb)


def _html_text(
    page: pymupdf.Page,
    rect: pymupdf.Rect,
    text: str,
    *,
    size: float,
    color=(0, 0, 0),
    font: str = "sans",
    bold: bool = False,
    italic: bool = False,
    align: str = "left",
) -> None:
    """Write (possibly multi-line, non-Latin) text into a box given in visual coordinates."""
    body = html.escape(text).replace("\n", "<br>")
    css = (
        f"* {{font-family: {FONT_CSS.get(font, 'sans-serif')}; font-size: {size}px; color: {_hex(color)}; "
        f"text-align: {align}; font-weight: {'bold' if bold else 'normal'}; "
        f"font-style: {'italic' if italic else 'normal'}; margin: 0; padding: 0; line-height: 1.2;}}"
    )
    page.insert_htmlbox(rect * page.derotation_matrix, body, css=css, rotate=page.rotation)


# ---------------------------------------------------------------- rotate


@tool(
    slug="rotate-pdf",
    name="Rotate PDF",
    category=Category.EDIT,
    description="Rotate all or selected pages of your PDF.",
    accepts=("pdf",),
    output="pdf",
    max_files=20,
    options=(
        Option("angle", "choice", default="90", label="Rotate by", choices=("90", "180", "270", "-90")),
        Option(
            "rotations",
            "json",
            default=None,
            label="Per-page rotation",
            help='Optional, e.g. {"1": 90, "3": 180}. Overrides angle/pages.',
        ),
        PAGES,
        PASSWORD,
    ),
)
def rotate_pdf(ctx: Context) -> Result:
    outputs = []
    for src in ctx.inputs:
        with open_pdf(src, ctx.options["password"]) as doc:
            per_page = ctx.options["rotations"]
            if per_page:
                if not isinstance(per_page, dict):
                    raise InvalidInput("'rotations' must be an object like {\"1\": 90}.")
                plan = {}
                for k, v in per_page.items():
                    try:
                        page_no, angle = int(k), int(v)
                    except (TypeError, ValueError):
                        raise InvalidInput("'rotations' must map page numbers to angles.") from None
                    if not 1 <= page_no <= doc.page_count or angle % 90:
                        raise InvalidInput(f"Invalid rotation for page {k}.")
                    plan[page_no - 1] = angle
            else:
                angle = int(ctx.options["angle"])
                plan = {p: angle for p in parse_page_ranges(ctx.options["pages"], doc.page_count)}
            for p, angle in plan.items():
                page = doc[p]
                page.set_rotation((page.rotation + angle) % 360)
            outputs.append(out_path(ctx.work_dir, f"{src.stem}_rotated", ".pdf"))
            doc.save(outputs[-1], garbage=3, deflate=True)
    return Result(bundle(outputs, ctx.work_dir, "rotated"), {"files": len(outputs)})


# ---------------------------------------------------------------- page numbers

NUMBER_FORMATS = {
    "n": "{n}",
    "page-n": "Page {n}",
    "n-of-total": "{n} / {total}",
    "page-n-of-total": "Page {n} of {total}",
}
POSITIONS = ("bottom-center", "bottom-right", "bottom-left", "top-center", "top-right", "top-left")


@tool(
    slug="add-page-numbers",
    name="Add page numbers",
    category=Category.EDIT,
    description="Add page numbers to your PDF with your choice of position, format and style.",
    accepts=("pdf",),
    output="pdf",
    options=(
        Option("position", "choice", default="bottom-center", label="Position", choices=POSITIONS),
        Option("format", "choice", default="n", label="Format", choices=tuple(NUMBER_FORMATS)),
        Option("custom_format", "str", default="", label="Custom format", help="Use {n} and {total}, e.g. 'Sheet {n}'"),
        Option("start", "int", default=1, label="First number", min=0, max=100_000),
        Option("font_size", "int", default=11, label="Font size", min=6, max=72),
        Option("font", "choice", default="sans", label="Font", choices=tuple(FONT_CSS)),
        Option("color", "color", default=(0, 0, 0), label="Color"),
        Option("margin", "int", default=24, label="Margin (pt)", min=0, max=200),
        PAGES,
        PASSWORD,
    ),
)
def add_page_numbers(ctx: Context) -> Result:
    o = ctx.options
    template = o["custom_format"] or NUMBER_FORMATS[o["format"]]
    vertical, horizontal = o["position"].split("-")
    src = ctx.inputs[0]
    with open_pdf(src, o["password"]) as doc:
        pages = parse_page_ranges(o["pages"], doc.page_count)
        total = len(pages)
        for i, p in enumerate(pages):
            page = doc[p]
            ensure_wrapped(page)
            text = template.replace("{n}", str(o["start"] + i)).replace("{total}", str(o["start"] + total - 1))
            w, h = page.rect.width, page.rect.height
            box_h = o["font_size"] * 1.6
            y = o["margin"] if vertical == "top" else h - o["margin"] - box_h
            rect = pymupdf.Rect(o["margin"], y, w - o["margin"], y + box_h)
            align = {"center": "center", "left": "left", "right": "right"}[horizontal]
            _html_text(page, rect, text, size=o["font_size"], color=o["color"], font=o["font"], align=align)
        out = out_path(ctx.work_dir, f"{src.stem}_numbered", ".pdf")
        doc.save(out, garbage=3, deflate=True)
    return Result(out, {"pages_numbered": total})


# ---------------------------------------------------------------- watermark


def _faded_png(path: Path, opacity: float) -> bytes:
    with open_image(path) as img:
        img = img.convert("RGBA")
        if opacity < 1:
            alpha = img.getchannel("A").point(lambda a: int(a * opacity))
            img.putalpha(alpha)
        buf = io.BytesIO()
        img.save(buf, "PNG")
        return buf.getvalue()


@tool(
    slug="add-watermark",
    name="Add watermark",
    category=Category.EDIT,
    description="Stamp text or an image over your PDF. Choose position, opacity and rotation.",
    accepts=("pdf",),
    output="pdf",
    extra_inputs=(ExtraInput("image", accepts=IMAGE_EXTS, label="Watermark image (optional)"),),
    options=(
        Option("text", "str", default="", label="Watermark text"),
        Option("font_size", "int", default=48, label="Font size", min=6, max=300),
        Option("bold", "bool", default=True, label="Bold"),
        Option("color", "color", default=(0.8, 0.1, 0.1), label="Color"),
        Option("opacity", "float", default=0.3, label="Opacity", min=0.05, max=1.0),
        Option("rotation", "int", default=45, label="Rotation (degrees)", min=-180, max=180),
        Option("position", "choice", default="center", label="Position",
               choices=("center", "top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right", "tile")),
        Option("image_scale", "float", default=0.5, label="Image size (fraction of page width)", min=0.05, max=1.0),
        Option("layer", "choice", default="over", label="Layer", choices=("over", "under")),
        PAGES,
        PASSWORD,
    ),
)
def add_watermark(ctx: Context) -> Result:
    o = ctx.options
    image = ctx.extra("image")
    if not o["text"] and not image:
        raise InvalidInput("Enter watermark text or upload an image.")
    image_bytes = _faded_png(image, o["opacity"]) if image else None
    font = "hebo" if o["bold"] else "helv"

    src = ctx.inputs[0]
    with open_pdf(src, o["password"]) as doc:
        for p in parse_page_ranges(o["pages"], doc.page_count):
            page = doc[p]
            ensure_wrapped(page)
            for cx, cy in _anchor_points(page, o["position"]):
                if image_bytes:
                    with Image.open(io.BytesIO(image_bytes)) as im:
                        ratio = im.height / im.width
                    w = page.rect.width * o["image_scale"]
                    h = w * ratio
                    rect = pymupdf.Rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
                    page.insert_image(rect * page.derotation_matrix, stream=image_bytes, overlay=o["layer"] == "over",
                                      rotate=page.rotation)
                else:
                    _rotated_text(page, o["text"], (cx, cy), o["font_size"], font, o["color"], o["opacity"],
                                  o["rotation"], overlay=o["layer"] == "over")
        out = out_path(ctx.work_dir, f"{src.stem}_watermarked", ".pdf")
        doc.save(out, garbage=3, deflate=True)
    return Result(out, {})


def _anchor_points(page: pymupdf.Page, position: str) -> list[tuple[float, float]]:
    w, h = page.rect.width, page.rect.height
    if position == "tile":
        return [(w * x / 4, h * y / 6) for x in (1, 3) for y in (1, 3, 5)]
    vertical, _, horizontal = position.partition("-")
    if position == "center":
        return [(w / 2, h / 2)]
    x = {"left": w * 0.2, "center": w / 2, "right": w * 0.8}[horizontal]
    y = {"top": h * 0.12, "bottom": h * 0.88}[vertical]
    return [(x, y)]


def _rotated_text(page, text, center, size, font, color, opacity, angle, *, overlay=True):
    """Draw text centered on a visual point, rotated by `angle` degrees counter-clockwise as seen by the reader."""
    lines = text.splitlines() or [text]
    shape = page.new_shape()
    pivot = pymupdf.Point(center) * page.derotation_matrix
    # Lay the text out horizontally in unrotated space around the pivot, then turn it by the
    # reader's angle plus whatever the page rotation will undo when displayed.
    matrix = pymupdf.Matrix(angle + page.rotation)
    line_h = size * 1.2
    top = pivot.y - line_h * len(lines) / 2
    for i, line in enumerate(lines):
        width = pymupdf.get_text_length(line, fontname=font, fontsize=size)
        origin = pymupdf.Point(pivot.x - width / 2, top + line_h * (i + 0.8))
        shape.insert_text(origin, line, fontsize=size, fontname=font, color=color, fill_opacity=opacity,
                          stroke_opacity=opacity, morph=(pivot, matrix))
    shape.commit(overlay=overlay)


# ---------------------------------------------------------------- crop


@tool(
    slug="crop-pdf",
    name="Crop PDF",
    category=Category.EDIT,
    description="Trim the margins of your PDF pages or crop to a selected area.",
    accepts=("pdf",),
    output="pdf",
    options=(
        Option("box", "json", default=None, label="Crop box",
               help='Visible area as fractions of the page: {"x":0.1,"y":0.1,"width":0.8,"height":0.8}'),
        Option("top", "float", default=0, label="Top margin (%)", min=0, max=49),
        Option("right", "float", default=0, label="Right margin (%)", min=0, max=49),
        Option("bottom", "float", default=0, label="Bottom margin (%)", min=0, max=49),
        Option("left", "float", default=0, label="Left margin (%)", min=0, max=49),
        PAGES,
        PASSWORD,
    ),
)
def crop_pdf(ctx: Context) -> Result:
    o = ctx.options
    if o["box"] is not None:
        try:
            fx, fy, fw, fh = (float(o["box"][k]) for k in ("x", "y", "width", "height"))
        except (TypeError, KeyError, ValueError):
            raise InvalidInput("'box' must contain numeric x, y, width and height.") from None
    else:
        fx, fy = o["left"] / 100, o["top"] / 100
        fw, fh = 1 - fx - o["right"] / 100, 1 - fy - o["bottom"] / 100
    if not (0 <= fx < 1 and 0 <= fy < 1 and fw > 0.01 and fh > 0.01 and fx + fw <= 1.0001 and fy + fh <= 1.0001):
        raise InvalidInput("The crop area is outside the page.")

    src = ctx.inputs[0]
    with open_pdf(src, o["password"]) as doc:
        pages = parse_page_ranges(o["pages"], doc.page_count)
        for p in pages:
            page = doc[p]
            w, h = page.rect.width, page.rect.height
            area = visual_rect(page, fx * w, fy * h, fw * w, fh * h)
            # set_cropbox expects mediabox coordinates; page.rect is relative to the current cropbox
            area = (area + (page.cropbox.x0, page.cropbox.y0, page.cropbox.x0, page.cropbox.y0)) & page.mediabox
            page.set_cropbox(area)
        out = out_path(ctx.work_dir, f"{src.stem}_cropped", ".pdf")
        doc.save(out, garbage=3, deflate=True)
    return Result(out, {"pages_cropped": len(pages)})


# ---------------------------------------------------------------- editor

EDIT_HELP = (
    "List of operations. Every op has 'type' and 'page' (1-based); coordinates are in points from the "
    "visual top-left. Types: text{x,y,width,height,text,size,color,font,bold,italic,align}, "
    "rect{x,y,width,height,stroke,fill,stroke_width,opacity}, ellipse{...same as rect}, "
    "line{x1,y1,x2,y2,color,stroke_width,opacity}, ink{points:[[x,y],...],color,stroke_width}, "
    "highlight{x,y,width,height,color,opacity}, whiteout{x,y,width,height,color}, "
    "image{x,y,width,height,image: index into the 'images' uploads}, link{x,y,width,height,url}."
)


@tool(
    slug="edit-pdf",
    name="Edit PDF",
    category=Category.EDIT,
    description="Add text, shapes, drawings, highlights, images and links to your PDF.",
    accepts=("pdf",),
    output="pdf",
    extra_inputs=(ExtraInput("images", accepts=IMAGE_EXTS, label="Images to place", multiple=True),),
    options=(Option("operations", "json", label="Edits", help=EDIT_HELP, required=True), PASSWORD),
)
def edit_pdf(ctx: Context) -> Result:
    ops = ctx.options["operations"]
    if not isinstance(ops, list) or not ops:
        raise InvalidInput("'operations' must be a non-empty list.")
    if len(ops) > 5000:
        raise InvalidInput("Too many edits in one request.")
    images = ctx.extras.get("images", [])
    src = ctx.inputs[0]

    with open_pdf(src, ctx.options["password"]) as doc:
        touched = set()
        for i, op in enumerate(ops, start=1):
            if not isinstance(op, dict):
                raise InvalidInput(f"Edit #{i} must be an object.")
            page_no = _num(op, "page", i, int)
            if not 1 <= page_no <= doc.page_count:
                raise InvalidInput(f"Edit #{i}: page {page_no} does not exist.")
            page = doc[page_no - 1]
            if page_no not in touched:
                ensure_wrapped(page)
                touched.add(page_no)
            _apply_op(page, op, i, images)
        out = out_path(ctx.work_dir, f"{src.stem}_edited", ".pdf")
        doc.save(out, garbage=3, deflate=True)
    return Result(out, {"edits": len(ops)})


def _num(op: dict, key: str, index: int, cast=float, default=None):
    value = op.get(key, default)
    try:
        return cast(value)
    except (TypeError, ValueError):
        raise InvalidInput(f"Edit #{index}: '{key}' must be a number.") from None


def _color(op: dict, key: str, default):
    value = op.get(key, default)
    if value is None or value == "" or value == "transparent":
        return None
    return parse_color(value, key) if isinstance(value, str) else default


def _box(page, op, i) -> pymupdf.Rect:
    return visual_rect(page, _num(op, "x", i), _num(op, "y", i), _num(op, "width", i), _num(op, "height", i))


def _apply_op(page: pymupdf.Page, op: dict, i: int, images: list[Path]) -> None:
    kind = op.get("type")
    opacity = min(1.0, max(0.0, _num(op, "opacity", i, default=1)))
    stroke_width = _num(op, "stroke_width", i, default=1.5)

    if kind == "text":
        text = str(op.get("text", ""))
        if not text:
            return
        rect = pymupdf.Rect(_num(op, "x", i), _num(op, "y", i), 0, 0)
        size = _num(op, "size", i, default=12)
        rect.x1 = rect.x0 + _num(op, "width", i, default=page.rect.width - rect.x0)
        rect.y1 = rect.y0 + _num(op, "height", i, default=size * 1.4 * (text.count("\n") + 1))
        _html_text(page, rect, text, size=size, color=_color(op, "color", "#000000") or (0, 0, 0),
                   font=op.get("font", "sans"), bold=bool(op.get("bold")), italic=bool(op.get("italic")),
                   align=op.get("align", "left") if op.get("align") in ("left", "center", "right") else "left")
    elif kind in ("rect", "ellipse"):
        draw = page.draw_rect if kind == "rect" else page.draw_oval
        draw(_box(page, op, i), color=_color(op, "stroke", "#000000"), fill=_color(op, "fill", None),
             width=stroke_width, stroke_opacity=opacity, fill_opacity=opacity)
    elif kind == "line":
        a = pymupdf.Point(_num(op, "x1", i), _num(op, "y1", i)) * page.derotation_matrix
        b = pymupdf.Point(_num(op, "x2", i), _num(op, "y2", i)) * page.derotation_matrix
        page.draw_line(a, b, color=_color(op, "color", "#000000"), width=stroke_width, stroke_opacity=opacity)
    elif kind == "ink":
        points = op.get("points")
        if not isinstance(points, list) or len(points) < 2:
            raise InvalidInput(f"Edit #{i}: 'points' needs at least two [x, y] pairs.")
        try:
            pts = [pymupdf.Point(float(x), float(y)) * page.derotation_matrix for x, y in points[:20_000]]
        except (TypeError, ValueError):
            raise InvalidInput(f"Edit #{i}: 'points' must be [x, y] pairs.") from None
        page.draw_polyline(pts, color=_color(op, "color", "#000000"), width=stroke_width, stroke_opacity=opacity,
                           closePath=False, lineCap=1, lineJoin=1)
    elif kind == "highlight":
        page.draw_rect(_box(page, op, i), color=None, fill=_color(op, "color", "#ffeb3b"),
                       fill_opacity=min(opacity, 0.5) if "opacity" not in op else opacity)
    elif kind == "whiteout":
        page.draw_rect(_box(page, op, i), color=None, fill=_color(op, "color", "#ffffff"), fill_opacity=1)
    elif kind == "image":
        idx = _num(op, "image", i, int, default=0)
        if not 0 <= idx < len(images):
            raise InvalidInput(f"Edit #{i}: image {idx} was not uploaded.")
        page.insert_image(_box(page, op, i), stream=_faded_png(images[idx], opacity), keep_proportion=True,
                          rotate=page.rotation)
    elif kind == "link":
        url = str(op.get("url", ""))
        if not url.lower().startswith(("http://", "https://", "mailto:")):
            raise InvalidInput(f"Edit #{i}: links must start with http://, https:// or mailto:.")
        page.insert_link({"kind": pymupdf.LINK_URI, "from": _box(page, op, i), "uri": url})
    else:
        raise InvalidInput(f"Edit #{i}: unknown type '{kind}'.")


# ---------------------------------------------------------------- forms


@tool(
    slug="pdf-forms",
    name="PDF Forms",
    category=Category.EDIT,
    description="Fill in PDF forms online and download the completed document.",
    accepts=("pdf",),
    output="pdf",
    options=(
        Option("fields", "json", label="Field values", help='{"Full name": "Ali", "Agree": true}', required=True),
        Option("flatten", "bool", default=False, label="Flatten (make fields non-editable)"),
        PASSWORD,
    ),
    aliases=("fill-pdf-form",),
)
def pdf_forms(ctx: Context) -> Result:
    values = ctx.options["fields"]
    if not isinstance(values, dict):
        raise InvalidInput("'fields' must be an object of field name -> value.")
    src = ctx.inputs[0]
    filled = 0
    with open_pdf(src, ctx.options["password"]) as doc:
        if not doc.is_form_pdf:
            raise InvalidInput("This PDF has no fillable form fields.")
        for page in doc:
            for widget in page.widgets():
                if widget.field_name not in values:
                    continue
                value = values[widget.field_name]
                if widget.field_type in (pymupdf.PDF_WIDGET_TYPE_CHECKBOX, pymupdf.PDF_WIDGET_TYPE_RADIOBUTTON):
                    on = widget.on_state()
                    checked = value is True or str(value).lower() in ("true", "1", "yes", "on") or (
                        isinstance(value, str) and value == on
                    )
                    widget.field_value = on if checked else "Off"
                else:
                    widget.field_value = "" if value is None else str(value)
                widget.update()
                filled += 1
        if ctx.options["flatten"]:
            doc.bake(annots=False, widgets=True)
        out = out_path(ctx.work_dir, f"{src.stem}_filled", ".pdf")
        doc.save(out, garbage=3, deflate=True)
    unknown = sorted(set(values) - _field_names(out))
    meta = {"fields_filled": filled}
    if unknown and not ctx.options["flatten"]:
        meta["unknown_fields"] = unknown[:50]
    return Result(out, meta)


def _field_names(path: Path) -> set[str]:
    with pymupdf.open(path) as doc:
        return {w.field_name for page in doc for w in page.widgets()}


def describe_form_fields(doc: pymupdf.Document) -> list[dict]:
    fields = []
    for page in doc:
        for w in page.widgets():
            rect = w.rect * page.rotation_matrix
            field = {
                "name": w.field_name,
                "type": w.field_type_string.lower(),
                "value": w.field_value,
                "page": page.number + 1,
                "rect": [round(v, 2) for v in rect],
            }
            if w.choice_values:
                field["choices"] = w.choice_values
            if w.field_type in (pymupdf.PDF_WIDGET_TYPE_CHECKBOX, pymupdf.PDF_WIDGET_TYPE_RADIOBUTTON):
                field["on_value"] = w.on_state()
            fields.append(field)
    return fields
