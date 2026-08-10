import os
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Optional, Tuple

from dotenv import load_dotenv


PROJECT_DIR = Path(__file__).resolve().parent
ENV_FILE = PROJECT_DIR / "customer-service-bot.env"

# Explicit process variables (for example systemd Environment=) take priority.
load_dotenv(ENV_FILE, override=False)


def _positive_int(
    environ: Mapping[str, str],
    name: str,
    default: int,
    maximum: Optional[int] = None,
) -> int:
    raw_value = environ.get(name, str(default)).strip()
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be an integer") from exc
    if value <= 0 or (maximum is not None and value > maximum):
        suffix = f" and no greater than {maximum}" if maximum is not None else ""
        raise ValueError(f"{name} must be greater than 0{suffix}")
    return value


def _positive_float(
    environ: Mapping[str, str], name: str, default: float
) -> float:
    raw_value = environ.get(name, str(default)).strip()
    try:
        value = float(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a number") from exc
    if value <= 0:
        raise ValueError(f"{name} must be greater than 0")
    return value


@dataclass(frozen=True)
class Settings:
    tg_bot_token: str
    tg_admin_id: str
    chat_api_key: str
    allowed_origins: Tuple[str, ...]
    allowed_origin_regex: Optional[str]
    db_file: Path
    app_host: str
    app_port: int
    poll_limit: int
    max_session_id_length: int
    max_nickname_length: int
    max_message_length: int
    max_upload_bytes: int
    tg_http_timeout_seconds: float
    tg_long_poll_timeout_seconds: int
    tg_poll_interval_seconds: float
    tg_retry_delay_seconds: float
    data_retention_hours: float
    cleanup_interval_seconds: float

    @property
    def telegram_enabled(self) -> bool:
        return bool(self.tg_bot_token and self.tg_admin_id)


def load_settings(environ: Optional[Mapping[str, str]] = None) -> Settings:
    values = os.environ if environ is None else environ

    db_file = Path(values.get("CHAT_DB_FILE", "chat.db").strip()).expanduser()
    if not db_file.is_absolute():
        db_file = PROJECT_DIR / db_file

    app_host = values.get("APP_HOST", "127.0.0.1").strip()
    if not app_host:
        raise ValueError("APP_HOST cannot be empty")

    app_port = _positive_int(values, "APP_PORT", 8000, 65535)
    origins = tuple(
        origin.strip()
        for origin in values.get(
            "CHAT_ALLOWED_ORIGINS", "https://api.api2cn.com"
        ).split(",")
        if origin.strip()
    )
    origin_regex = values.get(
        "CHAT_ALLOWED_ORIGIN_REGEX",
        r"(?i)^https?://(?:127\.0\.0\.1|localhost)(?::\d+)?$",
    ).strip()

    return Settings(
        tg_bot_token=values.get("TG_BOT_TOKEN", "").strip(),
        tg_admin_id=values.get("TG_ADMIN_ID", "").strip(),
        chat_api_key=values.get("CHAT_API_KEY", "").strip(),
        allowed_origins=origins,
        allowed_origin_regex=origin_regex or None,
        db_file=db_file.resolve(),
        app_host=app_host,
        app_port=app_port,
        poll_limit=_positive_int(values, "CHAT_POLL_LIMIT", 50, 500),
        max_session_id_length=_positive_int(
            values, "CHAT_MAX_SESSION_ID_LENGTH", 100, 500
        ),
        max_nickname_length=_positive_int(
            values, "CHAT_MAX_NICKNAME_LENGTH", 50, 500
        ),
        max_message_length=_positive_int(
            values, "CHAT_MAX_MESSAGE_LENGTH", 2000, 10000
        ),
        max_upload_bytes=_positive_int(
            values, "CHAT_MAX_UPLOAD_BYTES", 10 * 1024 * 1024
        ),
        tg_http_timeout_seconds=_positive_float(
            values, "TG_HTTP_TIMEOUT_SECONDS", 20
        ),
        tg_long_poll_timeout_seconds=_positive_int(
            values, "TG_LONG_POLL_TIMEOUT_SECONDS", 10, 50
        ),
        tg_poll_interval_seconds=_positive_float(
            values, "TG_POLL_INTERVAL_SECONDS", 1
        ),
        tg_retry_delay_seconds=_positive_float(
            values, "TG_RETRY_DELAY_SECONDS", 5
        ),
        data_retention_hours=_positive_float(
            values, "CHAT_DATA_RETENTION_HOURS", 24
        ),
        cleanup_interval_seconds=_positive_float(
            values, "CHAT_CLEANUP_INTERVAL_SECONDS", 3600
        ),
    )


settings = load_settings()
