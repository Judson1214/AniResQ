import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("sentry")

def sanitize_sentry_event(event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Sanitizes error events before transmission to Sentry.
    Strips Authorization headers, cookies, credentials, and request bodies.
    """
    if "request" in event:
        req = event["request"]
        if "headers" in req and isinstance(req["headers"], dict):
            # Scrub sensitive headers
            req["headers"] = {
                k: v for k, v in req["headers"].items()
                if k.lower() not in ("authorization", "cookie", "set-cookie", "apikey", "x-api-key")
            }
        # Strip request payload body completely to prevent accidental PII leakage
        if "data" in req:
            req["data"] = "[STRIPPED_FOR_PRIVACY]"

    return event

def init_sentry() -> bool:
    """
    Initializes Sentry monitoring if SENTRY_DSN is configured.
    Returns True if initialized, False otherwise.
    """
    dsn = (os.getenv("SENTRY_DSN") or "").strip()
    if not dsn:
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sample_rate = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1"))

        sentry_sdk.init(
            dsn=dsn,
            integrations=[FastApiIntegration(), StarletteIntegration()],
            send_default_pii=False,
            traces_sample_rate=sample_rate,
            before_send=sanitize_sentry_event,
        )
        logger.info("Sentry error monitoring and performance telemetry initialized.")
        return True
    except ImportError:
        logger.warning("SENTRY_DSN is configured, but 'sentry-sdk' is not installed. Sentry initialization skipped.")
        return False
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")
        return False
