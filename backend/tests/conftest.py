import io
import os
import tempfile

import pytest

os.environ["CONVERTOR_STORAGE_DIR"] = tempfile.mkdtemp(prefix="convertor-test-")
os.environ["CONVERTOR_RATE_LIMIT_PER_MINUTE"] = "0"
# tools run in-process here so tests can patch them; test_workers.py covers the worker processes
os.environ["CONVERTOR_ISOLATE_TOOLS"] = "false"
os.environ.pop("ANTHROPIC_API_KEY", None)

import pymupdf  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def make_pdf(pages: int = 3, text: str = "Hello page", table: bool = False) -> bytes:
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page(width=595, height=842)
        page.insert_text((72, 100), f"{text} {i + 1}", fontsize=18)
        page.insert_text((72, 140), "Contact: someone@example.com or +1 555 123 4567", fontsize=11)
        page.draw_rect(pymupdf.Rect(72, 300, 300, 400), color=(0.2, 0.4, 0.8), fill=(0.8, 0.9, 1))
        if table:
            x0, y0, cw, rh = 72, 450, 120, 24
            for r in range(4):
                for c in range(3):
                    cell = pymupdf.Rect(x0 + c * cw, y0 + r * rh, x0 + (c + 1) * cw, y0 + (r + 1) * rh)
                    page.draw_rect(cell, color=(0, 0, 0), width=0.8)
                    label = ["Item", "Qty", "Price"][c] if r == 0 else (f"Row {r}", str(r * 2), f"{r * 10.5:.2f}")[c]
                    page.insert_text((cell.x0 + 4, cell.y1 - 7), label, fontsize=10)
    data = doc.tobytes()
    doc.close()
    return data


def make_form_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    w = pymupdf.Widget()
    w.field_name, w.field_type, w.rect = "full_name", pymupdf.PDF_WIDGET_TYPE_TEXT, pymupdf.Rect(72, 72, 300, 92)
    page.add_widget(w)
    c = pymupdf.Widget()
    c.field_name, c.field_type, c.rect = "agree", pymupdf.PDF_WIDGET_TYPE_CHECKBOX, pymupdf.Rect(72, 120, 90, 138)
    page.add_widget(c)
    data = doc.tobytes()
    doc.close()
    return data


def make_image(fmt: str = "PNG", size=(320, 200), mode: str = "RGBA") -> bytes:
    img = Image.new(mode, size, (30, 120, 220, 255) if mode == "RGBA" else (30, 120, 220))
    for x in range(0, size[0], 20):
        for y in range(size[1]):
            img.putpixel((x, y), (255, 255, 255, 255) if mode == "RGBA" else (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, fmt)
    return buf.getvalue()
