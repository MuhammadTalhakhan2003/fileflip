"""PDF Security: unlock, protect, sign, redact, compare."""

import difflib
import io
import re
from datetime import date

import pymupdf
from PIL import Image

from app.core.errors import InvalidInput
from app.tools.common import IMAGE_EXTS, PASSWORD, ensure_wrapped, open_image, open_pdf, out_path, visual_rect
from app.tools.edit import _html_text
from app.tools.registry import Category, Context, ExtraInput, Option, Result, tool

# ---------------------------------------------------------------- unlock / protect


@tool(
    slug="unlock-pdf",
    name="Unlock PDF",
    category=Category.SECURITY,
    description="Remove the password and restrictions from a PDF you have the password for.",
    accepts=("pdf",),
    output="pdf",
    options=(Option("password", "str", default="", label="Current password", secret=True,
                    help="Leave empty if the file only has editing/printing restrictions"),),
)
def unlock_pdf(ctx: Context) -> Result:
    src = ctx.inputs[0]
    with open_pdf(src, ctx.options["password"]) as doc:
        was_encrypted = doc.is_encrypted or doc.needs_pass or bool(doc.metadata.get("encryption"))
        out = out_path(ctx.work_dir, f"{src.stem}_unlocked", ".pdf")
        doc.save(out, encryption=pymupdf.PDF_ENCRYPT_NONE, garbage=3, deflate=True)
    return Result(out, {"was_protected": was_encrypted})


@tool(
    slug="protect-pdf",
    name="Protect PDF",
    category=Category.SECURITY,
    description="Encrypt your PDF with a password (AES-256) and control printing and copying.",
    accepts=("pdf",),
    output="pdf",
    options=(
        Option("new_password", "str", label="Password to open", required=True, secret=True),
        Option("owner_password", "str", default="", label="Owner password (optional)", secret=True,
               help="Needed to change permissions. Defaults to a random one when restrictions are set."),
        Option("allow_print", "bool", default=True, label="Allow printing"),
        Option("allow_copy", "bool", default=True, label="Allow copying text"),
        Option("allow_edit", "bool", default=True, label="Allow editing"),
        PASSWORD,
    ),
)
def protect_pdf(ctx: Context) -> Result:
    import secrets

    o = ctx.options
    if len(o["new_password"]) < 4:
        raise InvalidInput("Use a password with at least 4 characters.")
    restricted = not (o["allow_print"] and o["allow_copy"] and o["allow_edit"])
    owner = o["owner_password"] or (secrets.token_urlsafe(24) if restricted else o["new_password"])

    perm = pymupdf.PDF_PERM_ACCESSIBILITY
    if o["allow_print"]:
        perm |= pymupdf.PDF_PERM_PRINT | pymupdf.PDF_PERM_PRINT_HQ
    if o["allow_copy"]:
        perm |= pymupdf.PDF_PERM_COPY
    if o["allow_edit"]:
        perm |= pymupdf.PDF_PERM_MODIFY | pymupdf.PDF_PERM_ANNOTATE | pymupdf.PDF_PERM_FORM | pymupdf.PDF_PERM_ASSEMBLE

    src = ctx.inputs[0]
    with open_pdf(src, o["password"]) as doc:
        out = out_path(ctx.work_dir, f"{src.stem}_protected", ".pdf")
        doc.save(out, encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw=o["new_password"], owner_pw=owner,
                 permissions=perm, garbage=3, deflate=True)
    return Result(out, {"encryption": "AES-256"})


# ---------------------------------------------------------------- sign


def _signature_png(path, remove_background: bool) -> bytes:
    with open_image(path) as img:
        img = img.convert("RGBA")
        if remove_background:
            # photos of a signature on paper: make the light paper transparent
            gray = img.convert("L")
            alpha = gray.point(lambda v: 0 if v > 200 else (255 if v < 140 else int((200 - v) * 255 / 60)))
            img.putalpha(Image.composite(alpha, Image.new("L", img.size, 0), img.getchannel("A")))
        bbox = img.getchannel("A").getbbox()
        if bbox:
            img = img.crop(bbox)
        buf = io.BytesIO()
        img.save(buf, "PNG")
        return buf.getvalue()


@tool(
    slug="sign-pdf",
    name="Sign PDF",
    category=Category.SECURITY,
    description="Sign a PDF yourself: place a drawn/uploaded signature or a typed name, initials and date.",
    accepts=("pdf",),
    output="pdf",
    extra_inputs=(ExtraInput("signature", accepts=IMAGE_EXTS, label="Signature image (drawn or photographed)"),),
    options=(
        Option("placements", "json", label="Where to sign", required=True,
               help='[{"page":1,"x":350,"y":700,"width":180,"height":60,"kind":"signature"}] - kind is '
                    "signature | text | date; text uses 'text'. Coordinates are points from the visual top-left."),
        Option("typed_name", "str", default="", label="Typed signature",
               help="Used when no signature image is uploaded"),
        Option("color", "color", default=(0.05, 0.1, 0.45), label="Ink color"),
        Option("remove_background", "bool", default=True, label="Remove white background from signature photo"),
        Option("date_format", "str", default="%d %b %Y", label="Date format"),
        PASSWORD,
    ),
)
def sign_pdf(ctx: Context) -> Result:
    o = ctx.options
    placements = o["placements"]
    if not isinstance(placements, list) or not placements:
        raise InvalidInput("Choose at least one place to sign.")
    image_path = ctx.extra("signature")
    if not image_path and not o["typed_name"]:
        raise InvalidInput("Upload or draw a signature, or type your name.")
    signature = _signature_png(image_path, o["remove_background"]) if image_path else None
    try:
        today = date.today().strftime(o["date_format"][:40])
    except ValueError:
        raise InvalidInput("Invalid date format.") from None

    src = ctx.inputs[0]
    with open_pdf(src, o["password"]) as doc:
        for i, pl in enumerate(placements[:200], start=1):
            try:
                page_no = int(pl["page"])
                x, y, w, h = (float(pl[k]) for k in ("x", "y", "width", "height"))
            except (KeyError, TypeError, ValueError):
                raise InvalidInput(f"Placement #{i} needs page, x, y, width and height.") from None
            if not 1 <= page_no <= doc.page_count:
                raise InvalidInput(f"Placement #{i}: page {page_no} does not exist.")
            page = doc[page_no - 1]
            ensure_wrapped(page)
            kind = pl.get("kind", "signature")
            box = pymupdf.Rect(x, y, x + w, y + h)
            if kind == "signature" and signature:
                page.insert_image(visual_rect(page, x, y, w, h), stream=signature, keep_proportion=True,
                                  rotate=page.rotation)
            else:
                text = {"date": today, "text": str(pl.get("text", ""))}.get(kind, o["typed_name"])
                if text:
                    serif_script = kind == "signature"
                    _html_text(page, box, text, size=max(8.0, min(h * 0.6, 48.0)), color=o["color"],
                               font="serif" if serif_script else "sans", italic=serif_script)
        out = out_path(ctx.work_dir, f"{src.stem}_signed", ".pdf")
        doc.save(out, garbage=3, deflate=True)
    return Result(out, {"placements": len(placements)})


# ---------------------------------------------------------------- redact

PATTERNS = {
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "phone": re.compile(r"\+?[\d()\-. ]{7,}\d"),
    "url": re.compile(r"(https?://|www\.)\S+", re.I),
    "card": re.compile(r"\b(?:\d[ -]?){13,19}\b"),
}


@tool(
    slug="redact-pdf",
    name="Redact PDF",
    category=Category.SECURITY,
    description="Permanently remove sensitive text, areas and metadata from a PDF.",
    accepts=("pdf",),
    output="pdf",
    options=(
        Option("terms", "json", default=None, label="Words or phrases to redact", help='["John Smith", "ACC-1234"]'),
        Option("patterns", "str", default="", label="Auto-detect",
               help="Comma separated: email, phone, url, card"),
        Option("areas", "json", default=None, label="Areas to redact",
               help='[{"page":1,"x":50,"y":100,"width":200,"height":20}] in points from the visual top-left'),
        Option("fill", "color", default=(0, 0, 0), label="Box color"),
        Option("remove_metadata", "bool", default=True, label="Remove document metadata"),
        PASSWORD,
    ),
)
def redact_pdf(ctx: Context) -> Result:
    o = ctx.options
    terms = o["terms"] or []
    if isinstance(terms, str):
        terms = [terms]
    if not isinstance(terms, list):
        raise InvalidInput("'terms' must be a list of words or phrases.")
    terms = [str(t) for t in terms if str(t).strip()][:500]
    patterns = [p.strip().lower() for p in o["patterns"].split(",") if p.strip()]
    for p in patterns:
        if p not in PATTERNS:
            raise InvalidInput(f"Unknown pattern '{p}'. Use: {', '.join(PATTERNS)}.")
    areas = o["areas"] or []
    if not isinstance(areas, list):
        raise InvalidInput("'areas' must be a list.")
    if not (terms or patterns or areas):
        raise InvalidInput("Tell us what to redact: words, patterns or areas.")

    src = ctx.inputs[0]
    count = 0
    with open_pdf(src, o["password"]) as doc:
        for page in doc:
            rects = []
            for term in terms:
                rects += page.search_for(term)
            if patterns:
                text_page = page.get_textpage()
                for line_text in {ln for ln in page.get_text("text", textpage=text_page).splitlines() if ln.strip()}:
                    for p in patterns:
                        for match in PATTERNS[p].finditer(line_text):
                            if p == "phone" and sum(c.isdigit() for c in match.group()) < 7:
                                continue
                            rects += page.search_for(match.group().strip(), textpage=text_page)
            for i, area in enumerate(areas, start=1):
                try:
                    if int(area["page"]) != page.number + 1:
                        continue
                    rects.append(visual_rect(page, *(float(area[k]) for k in ("x", "y", "width", "height"))))
                except (KeyError, TypeError, ValueError):
                    raise InvalidInput(f"Area #{i} needs page, x, y, width and height.") from None
            for r in rects:
                page.add_redact_annot(r, fill=o["fill"])
            if rects:
                page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_PIXELS)
                count += len(rects)
        if o["remove_metadata"]:
            doc.set_metadata({})
            doc.del_xml_metadata()
        out = out_path(ctx.work_dir, f"{src.stem}_redacted", ".pdf")
        doc.save(out, garbage=4, deflate=True, clean=True)
    return Result(out, {"redactions": count})


# ---------------------------------------------------------------- compare


def _words(doc: pymupdf.Document) -> list[tuple[int, pymupdf.Rect, str]]:
    words = []
    for page in doc:
        for x0, y0, x1, y1, text, *_ in page.get_text("words", sort=True):
            words.append((page.number, pymupdf.Rect(x0, y0, x1, y1), text))
    return words


@tool(
    slug="compare-pdf",
    name="Compare PDF",
    category=Category.SECURITY,
    description="Compare two PDFs side by side and highlight what was added or removed.",
    accepts=("pdf",),
    output="pdf",
    min_files=2,
    max_files=2,
    timeout=600,
    options=(
        Option("ignore_case", "bool", default=False, label="Ignore upper/lower case"),
        Option("removed_color", "color", default=(0.95, 0.25, 0.25), label="Removed text color"),
        Option("added_color", "color", default=(0.2, 0.75, 0.3), label="Added text color"),
        PASSWORD,
    ),
)
def compare_pdf(ctx: Context) -> Result:
    o = ctx.options
    old = open_pdf(ctx.inputs[0], o["password"])
    new = open_pdf(ctx.inputs[1], o["password"])
    try:
        old_words, new_words = _words(old), _words(new)
        if len(old_words) + len(new_words) > 400_000:
            raise InvalidInput("These documents are too large to compare.")
        if not old_words and not new_words:
            raise InvalidInput("No text was found in either file. Run 'OCR PDF' on scanned files first.")

        norm = (lambda s: s.lower()) if o["ignore_case"] else (lambda s: s)
        matcher = difflib.SequenceMatcher(None, [norm(w[2]) for w in old_words], [norm(w[2]) for w in new_words],
                                          autojunk=False)
        removed: dict[int, list] = {}
        added: dict[int, list] = {}
        removed_count = added_count = 0
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag in ("replace", "delete"):
                for page_no, rect, _ in old_words[i1:i2]:
                    removed.setdefault(page_no, []).append(rect)
                removed_count += i2 - i1
            if tag in ("replace", "insert"):
                for page_no, rect, _ in new_words[j1:j2]:
                    added.setdefault(page_no, []).append(rect)
                added_count += j2 - j1

        for doc, marks, color in ((old, removed, o["removed_color"]), (new, added, o["added_color"])):
            for page_no, rects in marks.items():
                page = doc[page_no]
                ensure_wrapped(page)
                for r in rects:
                    page.draw_rect(r, color=None, fill=color, fill_opacity=0.35, overlay=True)

        report = pymupdf.open()
        gap, header = 24, 36
        for i in range(max(old.page_count, new.page_count)):
            left = old[i].rect if i < old.page_count else None
            right = new[i].rect if i < new.page_count else None
            lw = left.width if left else (right.width if right else 595)
            rw = right.width if right else lw
            height = max(r.height for r in (left, right) if r) + header
            page = report.new_page(width=lw + gap + rw, height=height)
            page.insert_text((10, 24), f"Original - page {i + 1}" if left else "Original - (no page)", fontsize=12,
                             color=o["removed_color"])
            page.insert_text((lw + gap + 10, 24), f"Changed - page {i + 1}" if right else "Changed - (no page)",
                             fontsize=12, color=o["added_color"])
            if left:
                page.show_pdf_page(pymupdf.Rect(0, header, lw, header + left.height), old, i)
            if right:
                page.show_pdf_page(pymupdf.Rect(lw + gap, header, lw + gap + rw, header + right.height), new, i)
            page.draw_line((lw + gap / 2, 0), (lw + gap / 2, height), color=(0.75, 0.75, 0.75), width=0.5)

        out = out_path(ctx.work_dir, "comparison", ".pdf")
        report.save(out, garbage=3, deflate=True)
        report.close()
        changed_pages = sorted({p + 1 for p in removed} | {p + 1 for p in added})
        return Result(out, {
            "similarity": round(matcher.ratio() * 100, 1),
            "words_removed": removed_count,
            "words_added": added_count,
            "changed_pages_original": sorted(p + 1 for p in removed),
            "changed_pages_new": sorted(p + 1 for p in added),
            "identical": not changed_pages,
        })
    finally:
        old.close()
        new.close()
