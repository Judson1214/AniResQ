import json
import logging
import re
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict

request_id_ctx_var: ContextVar[str] = ContextVar("request_id", default="")

# Patterns for sensitive tokens, credentials, connection strings, and PII
JWT_PATTERN = re.compile(r"eyJ[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]*\.[a-zA-Z0-9_\-]+")
BEARER_TOKEN_PATTERN = re.compile(r"(Bearer\s+)[a-zA-Z0-9_\-\.]+", re.IGNORECASE)
POSTGRES_CONN_PATTERN = re.compile(r"(postgres(?:ql)?://[^:]+:)([^@]+)(@)", re.IGNORECASE)
REDIS_CONN_PATTERN = re.compile(r"(redis[s]?://(?::|[^:]+:))([^@]+)(@)", re.IGNORECASE)
AUTH_HEADER_PATTERN = re.compile(r"(Authorization['\"]?\s*[:=]\s*['\"]?)([^'\",\s]+)", re.IGNORECASE)
PASSWORD_PATTERN = re.compile(r"(password['\"]?\s*[:=]\s*['\"]?)([^'\"&\s,]+)", re.IGNORECASE)
ID_CARD_PATTERN = re.compile(r"(?:id[_\s-]?card(?:[_\s-]?number)?|aadhaar|ssn)['\"]?\s*[:=]\s*['\"]?([a-zA-Z0-9\-\s]{6,16})", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(\+?\d[\d\s\-]{8,}\d)")

def redact_sensitive_string(text: str) -> str:
    """Masks tokens, JWTs, credentials, connection strings, and PII in log messages."""
    if not isinstance(text, str):
        return text

    # Mask Bearer tokens
    text = BEARER_TOKEN_PATTERN.sub(r"\1[REDACTED_TOKEN]", text)

    # Mask raw JWT strings
    text = JWT_PATTERN.sub("[REDACTED_JWT]", text)

    # Mask database and redis passwords in connection URLs
    text = POSTGRES_CONN_PATTERN.sub(r"\1***\3", text)
    text = REDIS_CONN_PATTERN.sub(r"\1***\3", text)

    # Mask Authorization headers and passwords
    text = AUTH_HEADER_PATTERN.sub(r"\1[REDACTED]", text)
    text = PASSWORD_PATTERN.sub(r"\1[REDACTED]", text)

    # Mask ID card and phone numbers
    text = ID_CARD_PATTERN.sub(r"id_card_number: [REDACTED_ID]", text)
    text = PHONE_PATTERN.sub("[REDACTED_PHONE]", text)

    return text

class LogScrubbingFilter(logging.Filter):
    """Logging filter that scrubs sensitive credentials and PII from log records before formatting."""
    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact_sensitive_string(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: redact_sensitive_string(v) if isinstance(v, str) else v for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(redact_sensitive_string(v) if isinstance(v, str) else v for v in record.args)
        return True

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
            log_data["exception"] = redact_sensitive_string(self.formatException(record.exc_info))

        return json.dumps(log_data)

def setup_logging(level: int = logging.INFO):
    """Configures structured JSON logging for the application with log scrubbing."""
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredJsonFormatter())
    handler.addFilter(LogScrubbingFilter())

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
