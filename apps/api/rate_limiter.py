import time
import os
from collections import defaultdict
from typing import Dict, List, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class SlidingWindowRateLimiter:
    """
    Sliding window in-memory rate limiter per IP / client.
    Thread-safe within async event loop.
    """
    def __init__(self, limit: int = 120, window_seconds: int = 60):
        self.limit = limit
        self.window_seconds = window_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - self.window_seconds
        
        # Purge entries outside window
        timestamps = [t for t in self.requests[key] if t > window_start]
        self.requests[key] = timestamps

        if len(timestamps) >= self.limit:
            oldest = timestamps[0]
            retry_after = max(1, int(self.window_seconds - (now - oldest)))
            return False, retry_after

        self.requests[key].append(now)
        return True, 0

    def reset(self):
        self.requests.clear()


# Global default rate limiter instance
_DEFAULT_LIMIT = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
limiter = SlidingWindowRateLimiter(limit=_DEFAULT_LIMIT, window_seconds=60)


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

        # Determine client identifier from headers or socket host
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip()
        elif request.client and request.client.host:
            client_ip = request.client.host
        else:
            client_ip = "127.0.0.1"

        allowed, retry_after = self.limiter.is_allowed(client_ip)
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again later."},
                headers={"Retry-After": str(retry_after)}
            )

        return await call_next(request)
