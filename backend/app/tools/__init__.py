"""Importing this package registers every tool in app.tools.registry.TOOLS."""

from app.tools import ai, edit, from_pdf, images, office, optimize, organize, security  # noqa: F401
from app.tools.registry import CATEGORY_LABELS, TOOLS, get_tool  # noqa: F401
