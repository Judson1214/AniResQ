import os
import time
import logging
from typing import Dict, List, Tuple, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from logging_config import request_id_ctx_var

logger = logging.getLogger("rate_limiter")

# Atomic sliding window Lua script for Redis
LUA_SLIDING_WINDOW = """
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local random_id = ARGV[4] or tostring(math.random(100000, 999999))
local member = tostring(now) .. ':' .. tostring(random_id)
local clear_before = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clear_before)
local current_requests = redis.call('ZCARD', key)

if current_requests < limit then
    redis.call('ZADD', key, now, member)
    redis.call('EXPIRE', key, math.ceil(window) + 1)
    return {1, 0}
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest_score = tonumber(oldest[2]) or now
    local retry_after = math.max(1, math.ceil(window - (now - oldest_score)))
    return {0, retry_after}
end
"""

def mask_redis_url(url: str) -> str:
    """Mask password in Redis connection URL to prevent leaking credentials in logs."""
    if not url:
        return ""
    try:
        from urllib.parse import urlsplit, urlunsplit
        parsed = urlsplit(url)
        if parsed.password:
            netloc = parsed.netloc.replace(f":{parsed.password}@", ":***@")
            return urlunsplit(parsed._replace(netloc=netloc))
        return url
    except Exception:
        return "redis://***"

class BaseRateLimitStore:
    def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        raise NotImplementedError

    def reset(self):
        pass

class MemoryRateLimitStore(BaseRateLimitStore):
    """In-memory sliding window store with idle key eviction."""
    def __init__(self):
        self.requests: Dict[str, List[float]] = {}
        self.last_cleanup = time.time()

    def evict_idle_keys(self, now: Optional[float] = None, window_seconds: int = 60):
        if now is None:
            now = time.time()
        window_start = now - window_seconds
        expired_keys = []
        for key, timestamps in list(self.requests.items()):
            valid = [t for t in timestamps if t > window_start]
            if not valid:
                expired_keys.append(key)
            else:
                self.requests[key] = valid
        for key in expired_keys:
            self.requests.pop(key, None)

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - window_seconds

        if now - self.last_cleanup > 30:
            self.evict_idle_keys(now, window_seconds)
            self.last_cleanup = now

        timestamps = [t for t in self.requests.get(key, []) if t > window_start]
        if len(timestamps) >= limit:
            oldest = timestamps[0]
            retry_after = max(1, int(window_seconds - (now - oldest)))
            self.requests[key] = timestamps
            return False, retry_after

        timestamps.append(now)
        self.requests[key] = timestamps
        return True, 0

    def reset(self):
        self.requests.clear()
        self.last_cleanup = time.time()

class RedisRateLimitStore(BaseRateLimitStore):
    """Distributed Redis sliding window rate limiter using atomic Lua script."""
    def __init__(self, redis_client):
        self.client = redis_client
        self._script = self.client.register_script(LUA_SLIDING_WINDOW)

    def is_allowed(self, key: str, limit: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        import uuid
        random_id = uuid.uuid4().hex[:12]
        # Redis returns [allowed (1/0), retry_after]
        res = self._script(keys=[f"ratelimit:{key}"], args=[now, window_seconds, limit, random_id])
        allowed = bool(res[0])
        retry_after = int(res[1])
        return allowed, retry_after

    def reset(self):
        try:
            keys = self.client.keys("ratelimit:*")
            if keys:
                self.client.delete(*keys)
        except Exception as e:
            logger.warning(f"Failed to reset Redis rate limit store: {e}")

class SharedSlidingWindowRateLimiter:
    """
    Tiered sliding window rate limiter supporting Redis and fallback in-memory store.
    Handles fail-open for reads and fail-closed / local fallback for sensitive routes when store is down.
    """
    def __init__(self, store: Optional[BaseRateLimitStore] = None, window_seconds: int = 60, default_limit: int = 120):
        self.window_seconds = window_seconds
        self.default_limit = default_limit
        self.local_fallback = MemoryRateLimitStore()

        redis_url = os.getenv("REDIS_URL")
        env_mode = (os.getenv("ENV") or os.getenv("ENVIRONMENT") or "").lower()

        if store is not None:
            self.store = store
        elif redis_url:
            masked_url = mask_redis_url(redis_url)
            try:
                import redis
                redis_client = redis.Redis.from_url(redis_url, decode_responses=True, socket_timeout=1.5)
                # Test connectivity
                redis_client.ping()
                self.store = RedisRateLimitStore(redis_client)
                logger.info(f"Connected shared rate limiter to Redis at {masked_url}")
            except Exception as e:
                logger.error(f"Failed to connect to Redis at {masked_url}: {e}. Falling back to in-memory store.")
                self.store = self.local_fallback
        else:
            if env_mode == "production":
                logger.warning(
                    "SECURITY WARNING: Running in production mode (ENV=production) without REDIS_URL. "
                    "Rate limiting will be isolated per process and not shared across workers."
                )
            self.store = self.local_fallback

    def get_tier_config(self, tier: str) -> Tuple[int, int]:
        """Returns configured (limit, window_seconds) for the given rate tier."""
        tier_windows = {
            "user_export": 3600,   # 3 per hour
            "user_delete": 3600,   # 3 per hour
            "report_post": 3600,   # 10 per hour
        }
        window = tier_windows.get(tier, self.window_seconds)

        if tier == "read" and self.default_limit != 120:
            return self.default_limit, window

        # 1. Check dynamic runtime settings from system_settings if module available
        try:
            from routers.settings import get_system_setting
            setting_key = f"rateLimit_{tier}"
            runtime_val = get_system_setting(setting_key)
            if runtime_val is not None:
                return int(runtime_val), window
        except Exception:
            pass

        # 2. Check environment variable overrides with sensible defaults
        defaults = {
            "surrender": int(os.getenv("RATE_LIMIT_SURRENDER", "10")),
            "intake_post": int(os.getenv("RATE_LIMIT_INTAKE_POST", "15")),
            "clearance_request": int(os.getenv("RATE_LIMIT_CLEARANCE_REQUEST", "10")),
            "mutation": int(os.getenv("RATE_LIMIT_MUTATION", "40")),
            "read": int(os.getenv("RATE_LIMIT_READ", os.getenv("RATE_LIMIT_PER_MINUTE", "120"))),
            "user_export": int(os.getenv("RATE_LIMIT_USER_EXPORT", "3")),
            "user_delete": int(os.getenv("RATE_LIMIT_USER_DELETE", "3")),
            "report_post": int(os.getenv("RATE_LIMIT_REPORT_POST", "10")),
        }
        return defaults.get(tier, defaults["read"]), window

    def get_tier_limit(self, tier: str) -> int:
        """Returns the configured request limit for backwards compatibility."""
        return self.get_tier_config(tier)[0]

    def resolve_tier(self, path: str, method: str) -> str:
        method_upper = method.upper()
        norm_path = path.rstrip("/")
        if norm_path == "/api/animals/surrender":
            return "surrender"
        if norm_path in ["/api/rescues", "/api/lostfound"] and method_upper == "POST":
            return "intake_post"
        if norm_path == "/api/users/request-clearance" and method_upper in ["POST", "DELETE"]:
            return "clearance_request"
        if norm_path == "/api/users/me/export" and method_upper == "GET":
            return "user_export"
        if norm_path == "/api/users/me" and method_upper == "DELETE":
            return "user_delete"
        if norm_path == "/api/reports" and method_upper == "POST":
            return "report_post"
        if method_upper in ["POST", "PATCH", "DELETE"]:
            return "mutation"
        return "read"

    def is_allowed(self, identifier: str, path: str = "/", method: str = "GET") -> Tuple[bool, int]:
        tier = self.resolve_tier(path, method)
        limit, window_sec = self.get_tier_config(tier)
        rate_key = f"{identifier}:{tier}"

        try:
            return self.store.is_allowed(rate_key, limit, window_sec)
        except Exception as err:
            logger.error(f"Rate limit store failure for key {rate_key}: {err}")
            # Sensitive tiers: fail closed by falling back to local node limiter
            if tier in ("surrender", "intake_post", "clearance_request", "mutation", "user_export", "user_delete", "report_post"):
                try:
                    logger.warning(f"Falling back to local in-memory limiter for sensitive tier '{tier}'")
                    return self.local_fallback.is_allowed(rate_key, limit, window_sec)
                except Exception as fallback_err:
                    logger.error(f"Local rate limiter fallback failed: {fallback_err}")
                    return False, 60
            # Read endpoints: fail open with logged warning to prevent cascading outages
            logger.warning(f"Failing open for read endpoint '{path}' due to rate limit store unavailability")
            return True, 0

    @property
    def requests(self):
        """Backwards compatibility accessor for in-memory request store."""
        if hasattr(self.store, "requests"):
            return self.store.requests
        return self.local_fallback.requests

    def reset(self):
        if hasattr(self.store, "reset"):
            self.store.reset()
        self.local_fallback.reset()

    def evict_idle_keys(self, now: Optional[float] = None, window_seconds: Optional[int] = None):
        """Backwards compatibility eviction method for idle rate limit entries."""
        if now is None:
            now = time.time()
        if window_seconds is None:
            window_seconds = self.window_seconds
        if hasattr(self.store, "evict_idle_keys"):
            self.store.evict_idle_keys(now, window_seconds)
        self.local_fallback.evict_idle_keys(now, window_seconds)

# Alias for backwards compatibility with existing test suites
SlidingWindowRateLimiter = SharedSlidingWindowRateLimiter

# Global singleton rate limiter
limiter = SharedSlidingWindowRateLimiter()

def get_client_ip(request: Request) -> str:
    """
    Safely determine client IP.
    By default, strictly uses request.client.host to prevent spoofed X-Forwarded-For headers.
    When TRUST_PROXY_HEADERS is true, extracts the entry from the trusted proxy hop
    (configured via TRUSTED_PROXIES_COUNT, default 1: parts[-trusted_hops]).
    """
    trust_proxy = os.getenv("TRUST_PROXY_HEADERS", "false").lower() in ("true", "1", "yes")
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            hops = int(os.getenv("TRUSTED_PROXIES_COUNT", os.getenv("TRUSTED_HOPS", "1")))
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if len(parts) >= hops:
                return parts[-hops]
            elif parts:
                return parts[-1]

    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rate_limiter: SharedSlidingWindowRateLimiter = limiter, enabled: bool = True):
        super().__init__(app)
        self.limiter = rate_limiter
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        path = request.url.path
        # Skip health checks, liveness, readiness, and openapi documentation
        if path in ["/", "/health", "/ready", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)

        client_ip = get_client_ip(request)
        allowed, retry_after = self.limiter.is_allowed(client_ip, path, request.method)
        if not allowed:
            req_id = request_id_ctx_var.get() or getattr(request.state, "request_id", "")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please slow down and try again later.",
                    "code": "RATE_LIMIT_EXCEEDED",
                    "requestId": req_id
                },
                headers={"Retry-After": str(retry_after)}
            )

        return await call_next(request)
