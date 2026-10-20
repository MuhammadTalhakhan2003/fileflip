"""Tool registry.

Every conversion/edit tool is a plain function decorated with ``@tool(...)``.
The decorator records metadata (accepted formats, options, required engines)
which the API uses for validation and which the frontend reads from
``GET /api/v1/tools`` to build its pages automatically.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal

from app.core import engines
from app.core.errors import InvalidInput

OptionType = Literal["str", "int", "float", "bool", "choice", "json", "color"]


class Category:
    ORGANIZE = "organize"
    OPTIMIZE = "optimize"
    TO_PDF = "convert-to-pdf"
    FROM_PDF = "convert-from-pdf"
    EDIT = "edit"
    SECURITY = "security"
    INTELLIGENCE = "intelligence"
    IMAGE = "image"


CATEGORY_LABELS = {
    Category.ORGANIZE: "Organize PDF",
    Category.OPTIMIZE: "Optimize PDF",
    Category.TO_PDF: "Convert to PDF",
    Category.FROM_PDF: "Convert from PDF",
    Category.EDIT: "Edit PDF",
    Category.SECURITY: "PDF Security",
    Category.INTELLIGENCE: "PDF Intelligence",
    Category.IMAGE: "Image Tools",
}


@dataclass(frozen=True)
class Option:
    name: str
    type: OptionType
    default: Any = None
    label: str = ""
    help: str = ""
    choices: tuple[str, ...] | None = None
    min: float | None = None
    max: float | None = None
    required: bool = False
    secret: bool = False

    def parse(self, raw: str | None) -> Any:
        label = self.label or self.name
        is_empty = raw is None or (raw == "" if self.secret else raw.strip() == "")
        if is_empty:
            if self.required:
                raise InvalidInput(f"'{label}' is required.")
            return self.default

        value: Any
        if self.type == "str":
            if len(raw) > 10_000:
                raise InvalidInput(f"'{label}' is too long.")
            value = raw if self.secret else raw.strip()
        elif self.type in ("int", "float"):
            try:
                value = int(raw) if self.type == "int" else float(raw)
            except ValueError:
                raise InvalidInput(f"'{label}' must be a number.") from None
            if (self.min is not None and value < self.min) or (self.max is not None and value > self.max):
                raise InvalidInput(f"'{label}' must be between {_fmt(self.min)} and {_fmt(self.max)}.")
        elif self.type == "bool":
            value = raw.strip().lower() in ("1", "true", "yes", "on")
        elif self.type == "choice":
            value = raw.strip().lower()
            if self.choices and value not in self.choices:
                raise InvalidInput(f"'{label}' must be one of: {', '.join(self.choices)}.")
        elif self.type == "color":
            value = parse_color(raw, label)
        elif self.type == "json":
            if len(raw) > 2_000_000:
                raise InvalidInput(f"'{label}' is too large.")
            try:
                value = json.loads(raw)
            except json.JSONDecodeError:
                raise InvalidInput(f"'{label}' must be valid JSON.") from None
        else:  # pragma: no cover
            raise ValueError(self.type)
        return value

    def public(self) -> dict:
        data = {
            "name": self.name,
            "type": self.type,
            "label": self.label or self.name,
            "default": self.default if not isinstance(self.default, tuple) else list(self.default),
            "required": self.required,
        }
        if self.help:
            data["help"] = self.help
        if self.choices:
            data["choices"] = list(self.choices)
        if self.min is not None:
            data["min"] = self.min
        if self.max is not None:
            data["max"] = self.max
        if self.secret:
            data["secret"] = True
        return data


@dataclass(frozen=True)
class ExtraInput:
    """An additional upload field (e.g. a signature image or watermark logo)."""

    name: str
    accepts: tuple[str, ...]
    label: str = ""
    required: bool = False
    multiple: bool = False

    def public(self) -> dict:
        return {
            "name": self.name,
            "label": self.label or self.name,
            "accepts": list(self.accepts),
            "required": self.required,
            "multiple": self.multiple,
        }


@dataclass
class Context:
    inputs: list[Path]
    work_dir: Path
    options: dict[str, Any]
    extras: dict[str, list[Path]] = field(default_factory=dict)
    # progress(fraction 0..1, stage text) - shown live in the browser while the tool runs
    progress: Callable[..., None] = field(default=lambda *a, **k: None)

    def extra(self, name: str) -> Path | None:
        files = self.extras.get(name) or []
        return files[0] if files else None

    def steps(self, total: int, label: str, start: float = 0.05, end: float = 0.95):
        """Iterate 0..total-1, reporting progress: `for i in ctx.steps(n, "Page {n} of {total}")`."""
        from app.core.progress import steps

        return steps(self.progress, start, end, total, label)

    def each(self, items, label: str, start: float = 0.05, end: float = 0.95):
        """Like `steps`, but yields the items: `for src in ctx.each(ctx.inputs, "File {n} of {total}")`."""
        items = list(items)
        for i in self.steps(len(items), label, start, end):
            yield items[i]


@dataclass
class Result:
    path: Path
    meta: dict[str, Any] = field(default_factory=dict)


Handler = Callable[[Context], Result]


@dataclass(frozen=True)
class Tool:
    slug: str
    name: str
    category: str
    description: str
    accepts: tuple[str, ...]
    output: str
    handler: Handler
    min_files: int = 1
    max_files: int = 1
    options: tuple[Option, ...] = ()
    extra_inputs: tuple[ExtraInput, ...] = ()
    requires: tuple[str, ...] = ()
    aliases: tuple[str, ...] = ()
    timeout: int | None = None
    hidden: bool = False

    def available(self) -> bool:
        return all(engines.is_available(e) for e in self.requires)

    def parse_options(self, raw: dict[str, str]) -> dict[str, Any]:
        return {opt.name: opt.parse(raw.get(opt.name)) for opt in self.options}

    def public(self) -> dict:
        return {
            "slug": self.slug,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "accepts": list(self.accepts),
            "output": self.output,
            "min_files": self.min_files,
            "max_files": self.max_files,
            "options": [o.public() for o in self.options],
            "extra_inputs": [e.public() for e in self.extra_inputs],
            "requires": list(self.requires),
            "available": self.available(),
            "aliases": list(self.aliases),
        }


TOOLS: dict[str, Tool] = {}
_ALIASES: dict[str, str] = {}


def register(t: Tool) -> Tool:
    for key in (t.slug, *t.aliases):
        if key in TOOLS or key in _ALIASES:
            raise RuntimeError(f"Duplicate tool slug: {key}")
    TOOLS[t.slug] = t
    for alias in t.aliases:
        _ALIASES[alias] = t.slug
    return t


def tool(**kwargs) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        register(Tool(handler=fn, **kwargs))
        return fn

    return deco


def get_tool(slug: str) -> Tool | None:
    slug = slug.lower()
    return TOOLS.get(slug) or TOOLS.get(_ALIASES.get(slug, ""))


def parse_color(raw: str, label: str = "color") -> tuple[float, float, float]:
    value = raw.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    if len(value) != 6:
        raise InvalidInput(f"'{label}' must be a hex color like #ff0000.")
    try:
        r, g, b = (int(value[i : i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        raise InvalidInput(f"'{label}' must be a hex color like #ff0000.") from None
    return (r, g, b)


def _fmt(v: float | None) -> str:
    if v is None:
        return "any"
    return str(int(v)) if float(v).is_integer() else str(v)
