from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All settings can be overridden with CONVERTOR_<NAME> environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="CONVERTOR_", extra="ignore")

    app_name: str = "FileFlip API"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    # Where uploads and results live. Everything in here is temporary.
    storage_dir: Path = Path("./storage")
    file_ttl_minutes: int = 60
    cleanup_interval_seconds: int = 300

    # Abuse protection (no accounts, so limits are per IP)
    max_upload_mb: int = 100
    max_files_per_request: int = 20
    max_pdf_pages: int = 1000
    max_concurrent_jobs: int = 4  # also the number of worker processes; capped at 1 on small (<1.5 GB) machines
    job_timeout_seconds: int = 300
    # run tools in worker processes so heavy jobs can't freeze the API (health checks, progress polls)
    isolate_tools: bool = True
    # OCR resolution cap; 0 = 400 normally, 200 on small machines
    ocr_max_dpi: int = 0
    rate_limit_per_minute: int = 30
    trust_proxy_headers: bool = False

    cors_origins: list[str] = ["*"]

    # External engines (auto-detected when left empty)
    libreoffice_path: str | None = None
    ghostscript_path: str | None = None
    tessdata_path: str | None = None
    # parallel LibreOffice instances per worker (each needs ~200 MB of RAM); 0 = pick from CPU count (1 on small machines)
    libreoffice_pool_size: int = 0

    # AI tools
    anthropic_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("CONVERTOR_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"),
    )
    ai_model: str = "claude-opus-5-5"
    ai_max_chars: int = 600_000
    ai_max_translate_pages: int = 50

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def job_slots(self) -> int:
        return 1 if small_machine() else max(1, self.max_concurrent_jobs)

    @property
    def ocr_dpi_cap(self) -> int:
        return self.ocr_max_dpi or (200 if small_machine() else 400)


def memory_limit_bytes() -> int | None:
    """The container's memory limit (cgroup v2 or v1), or None when unlimited / not in a container."""
    for path in ("/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes"):
        try:
            value = Path(path).read_text().strip()
        except OSError:
            continue
        if value.isdigit() and int(value) < 1 << 50:
            return int(value)
    return None


@lru_cache
def small_machine() -> bool:
    """Free hosting plans (512 MB) can only afford one heavy job at a time."""
    limit = memory_limit_bytes()
    return limit is not None and limit < 1536 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
