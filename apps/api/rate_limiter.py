import time
import os
from typing import Dict, List, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class SlidingWindowRateLimiter:
    """
    Sliding window in-memory rate limiter with idle key eviction.
    Supports tiered limits for mutation/spam-sensitive endpoints.
    """
    def __init__(self, default_limit: int = 120, window_seconds: int = 60):
        self.default_limit = default_limit
        self.window_seconds = window_seconds
        # rate_key -> list of timestamps
        self.requests: Dict[str, List[float]] = {}
        self.last_cleanup = time.time()

    def evict_idle_keys(self, now: float):
        """Remove keys that have no timestamps in the active window."""
        window_start = now - self.window_seconds
        expired_keys = []
        for key, timestamps in list(self.requests.items()):
            valid = [t for t in timestamps if t > window_start]
            if not valid:
                expired_keys.append(key)
            else:
                self.requests[key] = valid
        for key in expired_keys:
            self.requests.pop(key, None)

    def is_allowed(self, client_ip: str, path: str = "/", method: str = "GET") -> Tuple[bool, int]:
        now = time.time()
        window_start = now - self.window_seconds

        # Periodic eviction of idle keys every 30 seconds
        if now - self.last_cleanup > 30:
            self.evict_idle_keys(now)
            self.last_cleanup = now

        # Tiered limits based on endpoint sensitivity
        method_upper = method.upper()
        norm_path = path.rstrip("/")
        if norm_path == "/api/animals/surrender":
            limit = 10
            tier = "surrender"
        elif norm_path in ["/api/rescues", "/api/lostfound"] and method_upper == "POST":
            limit = 15
            tier = "intake_post"
        elif method_upper in ["POST", "PATCH", "DELETE"]:
            limit = 40
            tier = "mutation"
        else:
            limit = self.default_limit
            tier = "read"

        rate_key = f"{client_ip}:{tier}"

        # Clean existing timestamps for this key
        timestamps = [t for t in self.requests.get(rate_key, []) if t > window_start]

        if len(timestamps) >= limit:
            oldest = timestamps[0]
            retry_after = max(1, int(self.window_seconds - (now - oldest)))
            self.requests[rate_key] = timestamps
            return False, retry_after

        timestamps.append(now)
        self.requests[rate_key] = timestamps
        return True, 0

    def reset(self):
        self.requests.clear()
        self.last_cleanup = time.time()


# Global default rate limiter instance
_DEFAULT_LIMIT = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
limiter = SlidingWindowRateLimiter(default_limit=_DEFAULT_LIMIT, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """
    Safely determine client IP.
    By default, strictly use request.client.host to prevent spoofed X-Forwarded-For headers from bypassing limits.
    Only trust X-Forwarded-For if explicitly configured via TRUST_PROXY_HEADERS.
    """
    trust_proxy = os.getenv("TRUST_PROXY_HEADERS", "false").lower() in ("true", "1", "yes")
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[-1].strip()

    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, rate_limiter: SlidingWindowRateLimiter = limiter, enabled: bool = True):
        super().__init__(app)
        self.limiter = rate_limiter
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        # Skip documentation and root health endpoints
        path = request.url.path
        if path in ["/", "/docs", "/openapi.json", "/redoc"]:
            return await call_next(request)

        client_ip = get_client_ip(request)
        allowed, retry_after = self.limiter.is_allowed(client_ip, path, request.method)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again later."},
                headers={"Retry-After": str(retry_after)}
            )

        return await call_next(request)
