import json
import logging
import re
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict

request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")

# Patterns for sensitive keys whose values should be redacted
REDACT_KEYS = {"password", "token", "access_token", "secret", "id_card_number", "idcardnumber"}
PHONE_PATTERN = re.compile(r"(\+?\d[\d\s\-]{8,}\d)")
JWT_PATTERN = re.compile(r"eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+")

def redact_sensitive_string(text: str) -> str:
    """Masks tokens, JWTs, and phone numbers in log messages."""
    if not isinstance(text, str):
        return text
    # Mask JWTs
    text = JWT_PATTERN.sub("[REDACTED_JWT]", text)
    # Mask passwords in URLs or query strings
    text = re.sub(r"(password=)[^&\s]+", r"\1[REDACTED]", text, flags=re.IGNORECASE)
    return text

class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as structured JSON with requestId and redacted PII."""
    def format(self, record: logging.LogRecord) -> str:
        req_id = request_id_ctx_var.get() or getattr(record, "request_id", "")
        raw_msg = record.getMessage()
        sanitized_msg = redact_sensitive_string(raw_msg)

        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": sanitized_msg,
        }
        if req_id:
            log_data["requestId"] = req_id

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)

def setup_logging(level: int = logging.INFO):
    """Configures structured JSON logging for the application."""
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredJsonFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    # Clear existing handlers to avoid duplicates
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
