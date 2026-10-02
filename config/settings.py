import base64
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional
from dotenv import load_dotenv

# Automatically sanitize SSLKEYLOGFILE if pointing to non-existent folder
# (Avoids fatal Windows socket/ssl crash when SSLKEYLOGFILE env is stale)
_sslkeylogfile = os.environ.get("SSLKEYLOGFILE")
if _sslkeylogfile:
    _ssl_dir = os.path.dirname(_sslkeylogfile)
    if _ssl_dir and not os.path.exists(_ssl_dir):
        del os.environ["SSLKEYLOGFILE"]

# Load .env file from project root if present
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")


class Settings:
    """Application settings with smart fallback between local files and environment secrets."""

    def __init__(self) -> None:
        self.project_root: Path = _PROJECT_ROOT

        # Spreadsheet settings
        self.spreadsheet_id: str = os.getenv("SPREADSHEET_ID", "").strip()
        self.students_sheet_name: str = os.getenv("STUDENTS_SHEET_NAME", "Danh sách Học sinh").strip()
        self.progress_sheet_name: str = os.getenv("PROGRESS_SHEET_NAME", "Theo dõi Bài tập").strip()

        # Credentials settings
        self.sa_file_path: str = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json").strip()
        self.sa_raw_json: str = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
        # Fallback to GCP_SA_KEY commonly used in GitHub Actions secrets
        if not self.sa_raw_json:
            self.sa_raw_json = os.getenv("GCP_SA_KEY", "").strip()

        # Network and throttling settings
        self.request_delay_seconds: float = float(os.getenv("REQUEST_DELAY_SECONDS", "1.0"))
        self.request_timeout_seconds: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15"))
        self.max_retries: int = int(os.getenv("MAX_RETRIES", "3"))

        # Logging
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()

    def get_service_account_dict(self) -> Optional[Dict[str, Any]]:
        """
        Retrieves the Google Service Account credentials as a Python dictionary.
        Supports:
        1. Plain JSON string in GOOGLE_SERVICE_ACCOUNT_JSON or GCP_SA_KEY
        2. Base64-encoded JSON string
        3. Local file path in GOOGLE_SERVICE_ACCOUNT_FILE or service_account.json
        """
        # 1. Try raw JSON or Base64 in environment variable
        if self.sa_raw_json:
            raw = self.sa_raw_json.strip()
            # Strip accidental surrounding quotes or backticks
            if (raw.startswith("'") and raw.endswith("'")) or (raw.startswith("`") and raw.endswith("`")):
                raw = raw[1:-1].strip()

            # Self-heal missing brackets (e.g. if user missed opening { when copying)
            if not raw.startswith("{") and "type" in raw:
                idx = raw.find('"type"')
                if idx != -1:
                    raw = "{" + raw[idx:]
                else:
                    t_idx = raw.find("type")
                    raw = '{"' + raw[t_idx:]
            if not raw.endswith("}"):
                r_idx = raw.rfind("}")
                if r_idx != -1:
                    raw = raw[:r_idx + 1]
                else:
                    raw = raw + "}"

            if raw.startswith("{") and raw.endswith("}"):
                try:
                    return json.loads(raw)
                except Exception:
                    pass

            # Try base64 decoding as fallback
            try:
                decoded = base64.b64decode(raw).decode("utf-8")
                return json.loads(decoded)
            except Exception:
                pass

            # Final direct json load attempt
            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:
                raise ValueError("GCP_SA_KEY / GOOGLE_SERVICE_ACCOUNT_JSON không đúng định dạng JSON chuẩn. Vui lòng kiểm tra lại nội dung khóa trên GitHub Secrets!") from exc

        # 2. Try file path
        candidate_paths = [
            Path(self.sa_file_path),
            self.project_root / self.sa_file_path,
            self.project_root / "service_account.json",
            self.project_root / "credentials.json",
        ]

        for p in candidate_paths:
            if p.exists() and p.is_file():
                try:
                    with open(p, "r", encoding="utf-8") as f:
                        return json.load(f)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Service account file at {p} contains invalid JSON: {exc}") from exc

        return None


_settings_instance: Optional[Settings] = None


def get_settings() -> Settings:
    """Returns singleton Settings instance."""
    global _settings_instance
    if _settings_instance is None:
        _settings_instance = Settings()
    return _settings_instance
