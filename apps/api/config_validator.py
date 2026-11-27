import os
import logging
from typing import Optional, Dict

logger = logging.getLogger("config_validator")

def validate_production_config(env_dict: Optional[Dict[str, str]] = None) -> None:
    """
    Validates environment configurations when running in production (ENV=production).
    Refuses to start by raising RuntimeError if critical security configurations are missing
    or insecure.
    Guarantees: NEVER prints or logs secret values.
    """
    env = env_dict if env_dict is not None else os.environ

    env_mode = (env.get("ENV") or env.get("ENVIRONMENT") or "").strip().lower()
    if env_mode != "production":
        return

    errors = []

    # 1. SUPABASE_URL: must be present and use https://
    supabase_url = (env.get("SUPABASE_URL") or "").strip()
    if not supabase_url:
        errors.append("SUPABASE_URL is missing or empty.")
    elif not supabase_url.startswith("https://"):
        errors.append("SUPABASE_URL must use https:// protocol in production.")

    # 2. SUPABASE_SERVICE_ROLE_KEY: must be present
    service_key = (env.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not service_key:
        errors.append("SUPABASE_SERVICE_ROLE_KEY is missing or empty.")

    # 3. SUPABASE_JWT_SECRET: must be present and >= 32 characters
    jwt_secret = (env.get("SUPABASE_JWT_SECRET") or env.get("JWT_SECRET") or "").strip()
    if not jwt_secret:
        errors.append("SUPABASE_JWT_SECRET is missing or empty.")
    elif len(jwt_secret) < 32:
        errors.append("SUPABASE_JWT_SECRET must be at least 32 characters in production.")

    # 4. CORS_ORIGINS: must not be empty, no wildcards, all origins https://
    cors_raw = (env.get("CORS_ORIGINS") or "").strip()
    if not cors_raw:
        errors.append("CORS_ORIGINS must be explicitly configured with trusted domains in production.")
    else:
        origins = [o.strip() for o in cors_raw.split(",") if o.strip()]
        if "*" in origins:
            errors.append("CORS_ORIGINS cannot contain wildcard '*' in production.")
        for origin in origins:
            if not origin.startswith("https://"):
                errors.append(f"CORS origin '{origin}' must use https:// protocol.")

    # 5. TRUST_PROXY_HEADERS: must be explicitly declared true or false
    trust_proxy = (env.get("TRUST_PROXY_HEADERS") or "").strip().lower()
    if trust_proxy not in ("true", "false", "1", "0"):
        errors.append("TRUST_PROXY_HEADERS must be explicitly set ('true' or 'false') in production.")

    # 6. REDIS_URL and in-memory rate limiting fallback
    redis_url = (env.get("REDIS_URL") or "").strip()
    allow_in_memory = (env.get("ALLOW_IN_MEMORY_RATE_LIMIT") or "").strip().lower() in ("true", "1")
    if not redis_url:
        if allow_in_memory:
            logger.warning(
                "SECURITY WARNING: REDIS_URL is absent in production. "
                "Running with in-memory fallback rate limiting because ALLOW_IN_MEMORY_RATE_LIMIT=true."
            )
        else:
            errors.append(
                "REDIS_URL is required in production for shared distributed rate limiting. "
                "Set REDIS_URL or explicitly acknowledge risk with ALLOW_IN_MEMORY_RATE_LIMIT=true."
            )

    if errors:
        error_msg = "CRITICAL CONFIGURATION ERROR(S) PREVENTING PRODUCTION STARTUP:\n" + "\n".join(f" - {e}" for e in errors)
        logger.critical(error_msg)
        raise RuntimeError(error_msg)
