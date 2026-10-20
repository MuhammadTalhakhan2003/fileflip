"""Detection of optional external engines (LibreOffice, Ghostscript, Tesseract, AI)."""

import os
import shutil
import sys
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

LIBREOFFICE = "libreoffice"
GHOSTSCRIPT = "ghostscript"
TESSERACT = "tesseract"
AI = "ai"


def _first_existing(candidates: list[str | None]) -> str | None:
    for c in candidates:
        if not c:
            continue
        found = shutil.which(c) or (c if Path(c).is_file() else None)
        if found:
            return found
    return None


@lru_cache
def libreoffice_path() -> str | None:
    candidates = [get_settings().libreoffice_path, "soffice", "libreoffice"]
    if sys.platform == "win32":
        for base in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)")):
            if base:
                candidates.append(str(Path(base) / "LibreOffice" / "program" / "soffice.exe"))
    elif sys.platform == "darwin":
        candidates.append("/Applications/LibreOffice.app/Contents/MacOS/soffice")
    return _first_existing(candidates)


@lru_cache
def ghostscript_path() -> str | None:
    candidates = [get_settings().ghostscript_path, "gs", "gswin64c", "gswin32c"]
    if sys.platform == "win32":
        base = Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "gs"
        if base.is_dir():
            candidates += [str(p) for p in sorted(base.glob("*/bin/gswin64c.exe"), reverse=True)]
    return _first_existing(candidates)


@lru_cache
def tessdata_path() -> str | None:
    """Folder with Tesseract language files (*.traineddata). PyMuPDF has OCR built in and only needs these."""
    candidates = [get_settings().tessdata_path, os.environ.get("TESSDATA_PREFIX"), str(Path(__file__).resolve().parents[2] / "tessdata")]
    if sys.platform == "win32":
        for base in (os.environ.get("ProgramFiles"), os.environ.get("LOCALAPPDATA") and str(Path(os.environ["LOCALAPPDATA"]) / "Programs")):
            if base:
                candidates.append(str(Path(base) / "Tesseract-OCR" / "tessdata"))
    else:
        candidates += ["/usr/share/tesseract-ocr/5/tessdata", "/usr/share/tesseract-ocr/4.00/tessdata", "/usr/share/tessdata"]
    for c in candidates:
        if c and (Path(c) / "eng.traineddata").is_file():
            return c
    try:
        import pymupdf

        return pymupdf.get_tessdata() or None
    except Exception:
        return None


def tesseract_languages() -> set[str]:
    folder = tessdata_path()
    return {p.stem for p in Path(folder).glob("*.traineddata")} if folder else set()


def tesseract_available() -> bool:
    return tessdata_path() is not None


def ai_available() -> bool:
    if not get_settings().anthropic_api_key:
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def is_available(engine: str) -> bool:
    return {
        LIBREOFFICE: lambda: libreoffice_path() is not None,
        GHOSTSCRIPT: lambda: ghostscript_path() is not None,
        TESSERACT: tesseract_available,
        AI: ai_available,
    }[engine]()


def status() -> dict[str, bool]:
    return {name: is_available(name) for name in (LIBREOFFICE, GHOSTSCRIPT, TESSERACT, AI)}
