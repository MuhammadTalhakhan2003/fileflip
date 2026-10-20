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
    max_concurrent_jobs: int = 4
    job_timeout_seconds: int = 300
    rate_limit_per_minute: int = 30
    trust_proxy_headers: bool = False

    cors_origins: list[str] = ["*"]

    # External engines (auto-detected when left empty)
    libreoffice_path: str | None = None
    ghostscript_path: str | None = None
    tessdata_path: str | None = None

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


@lru_cache
def get_settings() -> Settings:
    return Settings()
