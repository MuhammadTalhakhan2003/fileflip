"""Organize PDF: merge, split, remove pages, extract pages, organize (reorder/rotate/insert blanks)."""

import pymupdf

from app.core.errors import InvalidInput
from app.tools.common import PASSWORD, bundle, open_pdf, out_path, parse_page_ranges, parse_range_groups, save_pdf
from app.tools.registry import Category, Context, Option, Result, tool


@tool(
    slug="merge-pdf",
    name="Merge PDF",
    category=Category.ORGANIZE,
    description="Combine PDFs in the order you want into one file.",
    accepts=("pdf",),
    output="pdf",
    min_files=2,
    max_files=50,
    options=(PASSWORD,),
)
def merge_pdf(ctx: Context) -> Result:
    merged = pymupdf.open()
    total = 0
    for path in ctx.each(ctx.inputs, "Adding file {n} of {total}", end=0.8):
        with open_pdf(path, ctx.options["password"]) as src:
            merged.insert_pdf(src)
            total += src.page_count
    ctx.progress(0.85, "Saving the merged PDF")
    out = out_path(ctx.work_dir, "merged", ".pdf")
    save_pdf(merged, out)
    return Result(out, {"files": len(ctx.inputs), "pages": total})


@tool(
    slug="split-pdf",
    name="Split PDF",
    category=Category.ORGANIZE,
    description="Split a PDF into several files by page ranges, every N pages, or one file per page.",
    accepts=("pdf",),
    output="zip",
    options=(
        Option("mode", "choice", default="ranges", label="Split mode", choices=("ranges", "every", "all")),
        Option("ranges", "str", default="", label="Ranges", help="Each range becomes a file, e.g. 1-3,4-6,7-"),
        Option("every", "int", default=1, label="Pages per file", min=1, max=10_000),
        PASSWORD,
    ),
)
def split_pdf(ctx: Context) -> Result:
    src_path = ctx.inputs[0]
    opts = ctx.options
    with open_pdf(src_path, opts["password"]) as doc:
        n = doc.page_count
        if opts["mode"] == "all":
            groups = [[i] for i in range(n)]
        elif opts["mode"] == "every":
            step = opts["every"]
            groups = [list(range(i, min(i + step, n))) for i in range(0, n, step)]
        else:
            if not opts["ranges"]:
                raise InvalidInput("Enter the page ranges to split, e.g. 1-3,4-6.")
            groups = parse_range_groups(opts["ranges"], n)

        outputs = []
        for group in groups:
            part = pymupdf.open()
            for p in group:
                part.insert_pdf(doc, from_page=p, to_page=p)
            label = f"{group[0] + 1}" if len(group) == 1 else f"{group[0] + 1}-{group[-1] + 1}"
            outputs.append(save_pdf(part, out_path(ctx.work_dir, f"{src_path.stem}_pages_{label}", ".pdf")))
            part.close()

    return Result(bundle(outputs, ctx.work_dir, f"{src_path.stem}_split"), {"files": len(outputs)})


@tool(
    slug="remove-pages",
    name="Remove pages",
    category=Category.ORGANIZE,
    description="Delete the pages you don't need from a PDF.",
    accepts=("pdf",),
    output="pdf",
    options=(
        Option("pages", "str", label="Pages to remove", help="e.g. 2,5-7", required=True),
        PASSWORD,
    ),
)
def remove_pages(ctx: Context) -> Result:
    src = ctx.inputs[0]
    with open_pdf(src, ctx.options["password"]) as doc:
        remove = parse_page_ranges(ctx.options["pages"], doc.page_count)
        if len(remove) >= doc.page_count:
            raise InvalidInput("You can't remove every page - at least one page must remain.")
        doc.delete_pages(sorted(remove))
        out = save_pdf(doc, out_path(ctx.work_dir, src.stem, ".pdf"))
        remaining = doc.page_count
    return Result(out, {"removed": len(remove), "pages": remaining})


@tool(
    slug="extract-pages",
    name="Extract pages",
    category=Category.ORGANIZE,
    description="Pull selected pages out into a new PDF.",
    accepts=("pdf",),
    output="pdf",
    options=(
        Option("pages", "str", label="Pages to extract", help="e.g. 1,3-5", required=True),
        Option("separate", "bool", default=False, label="Save each page as a separate PDF"),
        PASSWORD,
    ),
)
def extract_pages(ctx: Context) -> Result:
    src = ctx.inputs[0]
    with open_pdf(src, ctx.options["password"]) as doc:
        pages = parse_page_ranges(ctx.options["pages"], doc.page_count)
        if not ctx.options["separate"]:
            doc.select(pages)
            return Result(save_pdf(doc, out_path(ctx.work_dir, f"{src.stem}_extracted", ".pdf")), {"pages": len(pages)})
        outputs = []
        for p in pages:
            part = pymupdf.open()
            part.insert_pdf(doc, from_page=p, to_page=p)
            outputs.append(save_pdf(part, out_path(ctx.work_dir, f"{src.stem}_page_{p + 1}", ".pdf")))
            part.close()
    return Result(bundle(outputs, ctx.work_dir, f"{src.stem}_extracted"), {"pages": len(pages)})


@tool(
    slug="organize-pdf",
    name="Organize PDF",
    category=Category.ORGANIZE,
    description="Reorder, rotate, delete or add blank pages - across one or several PDFs.",
    accepts=("pdf",),
    output="pdf",
    max_files=20,
    options=(
        Option(
            "order",
            "json",
            default=None,
            label="Page order",
            help='List of pages for the result, e.g. [{"file":0,"page":3,"rotate":90},{"blank":true},{"file":1,"page":1}]. '
            "Pages are 1-based, 'file' is the upload index. Pages left out are removed.",
        ),
        PASSWORD,
    ),
)
def organize_pdf(ctx: Context) -> Result:
    docs = [open_pdf(p, ctx.options["password"]) for p in ctx.inputs]
    try:
        order = ctx.options["order"]
        if order is None:
            order = [{"file": f, "page": p + 1} for f, d in enumerate(docs) for p in range(d.page_count)]
        if not isinstance(order, list) or not order:
            raise InvalidInput("'order' must be a non-empty list of pages.")
        if len(order) > 5000:
            raise InvalidInput("Too many pages in 'order'.")

        result = pymupdf.open()
        last_size = docs[0][0].rect
        for i, item in enumerate(order):
            if not isinstance(item, dict):
                raise InvalidInput(f"Item {i + 1} in 'order' must be an object.")
            if item.get("blank"):
                result.new_page(width=last_size.width, height=last_size.height)
                continue
            f = _int(item.get("file", 0), "file", i)
            p = _int(item.get("page"), "page", i)
            if not 0 <= f < len(docs):
                raise InvalidInput(f"Item {i + 1}: file {f} does not exist.")
            src = docs[f]
            if not 1 <= p <= src.page_count:
                raise InvalidInput(f"Item {i + 1}: page {p} does not exist (the file has {src.page_count} pages).")
            result.insert_pdf(src, from_page=p - 1, to_page=p - 1)
            page = result[-1]
            rotate = _int(item.get("rotate", 0), "rotate", i)
            if rotate % 90:
                raise InvalidInput(f"Item {i + 1}: rotation must be a multiple of 90.")
            if rotate:
                page.set_rotation((page.rotation + rotate) % 360)
            last_size = page.rect

        stem = ctx.inputs[0].stem if len(ctx.inputs) == 1 else "organized"
        out = save_pdf(result, out_path(ctx.work_dir, stem, ".pdf"))
        return Result(out, {"pages": result.page_count})
    finally:
        for d in docs:
            d.close()


def _int(value, name: str, index: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise InvalidInput(f"Item {index + 1} in 'order': '{name}' must be a number.") from None
