import os
import time
import threading
import hashlib
import hmac
from typing import Dict, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

class MetricsCollector:
    """Thread-safe in-memory metrics collector for HTTP requests and latency with bounded cardinality."""
    def __init__(self, max_keys: int = 1000):
        self._lock = threading.Lock()
        self.max_keys = max_keys
        # Key: (method, route, status_code) -> [count, total_duration_seconds]
        self._metrics: Dict[Tuple[str, str, int], list] = {}

    def record(self, method: str, route: str, status_code: int, duration_seconds: float):
        method_norm = method.upper()
        route_norm = route if route else "__unmatched__"
        key = (method_norm, route_norm, status_code)

        with self._lock:
            if key in self._metrics:
                self._metrics[key][0] += 1
                self._metrics[key][1] += duration_seconds
                return

            # Key is not present yet. Check if cap is reached.
            if len(self._metrics) >= self.max_keys:
                overflow_key = (method_norm, "__overflow__", status_code)
                if overflow_key in self._metrics:
                    target_key = overflow_key
                else:
                    existing_overflow = next((k for k in self._metrics if k[1] == "__overflow__"), None)
                    if existing_overflow:
                        target_key = existing_overflow
                    else:
                        # Must make room so total distinct keys never exceed max_keys
                        # Preserve accumulated counts by transferring the evicted entry into the overflow bucket
                        popped_key, popped_val = self._metrics.popitem()
                        target_key = overflow_key
                        self._metrics[target_key] = [popped_val[0], popped_val[1]]
                self._metrics[target_key][0] += 1
                self._metrics[target_key][1] += duration_seconds
                return

            self._metrics[key] = [1, duration_seconds]

    def get_prometheus_text(self) -> str:
        lines = [
            "# HELP aniresq_http_requests_total Total number of HTTP requests processed.",
            "# TYPE aniresq_http_requests_total counter",
        ]
        with self._lock:
            for (method, route, status), (count, _) in sorted(self._metrics.items()):
                lines.append(f'aniresq_http_requests_total{{method="{method}",route="{route}",status="{status}"}} {count}')

            lines.append("# HELP aniresq_http_request_duration_seconds_total Total duration of HTTP requests in seconds.")
            lines.append("# TYPE aniresq_http_request_duration_seconds_total counter")
            for (method, route, status), (_, total_duration) in sorted(self._metrics.items()):
                lines.append(f'aniresq_http_request_duration_seconds_total{{method="{method}",route="{route}",status="{status}"}} {total_duration:.4f}')

            lines.append("# HELP aniresq_http_request_duration_seconds_avg Average request duration in seconds.")
            lines.append("# TYPE aniresq_http_request_duration_seconds_avg gauge")
            for (method, route, status), (count, total_duration) in sorted(self._metrics.items()):
                avg = (total_duration / count) if count > 0 else 0.0
                lines.append(f'aniresq_http_request_duration_seconds_avg{{method="{method}",route="{route}",status="{status}"}} {avg:.4f}')

        return "\n".join(lines) + "\n"

    def get_summary_dict(self) -> dict:
        summary = []
        with self._lock:
            for (method, route, status), (count, total_duration) in sorted(self._metrics.items()):
                avg_ms = ((total_duration / count) * 1000.0) if count > 0 else 0.0
                summary.append({
                    "method": method,
                    "route": route,
                    "status": status,
                    "count": count,
                    "totalDurationSec": round(total_duration, 4),
                    "avgDurationMs": round(avg_ms, 2),
                })
        return {"routes": summary}

    def reset(self):
        with self._lock:
            self._metrics.clear()

metrics_collector = MetricsCollector(max_keys=1000)

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time

        # Extract matched route template rather than raw URL path
        route_obj = request.scope.get("route")
        if route_obj and hasattr(route_obj, "path") and route_obj.path:
            route_label = route_obj.path
        else:
            route_label = "__unmatched__"

        metrics_collector.record(request.method, route_label, response.status_code, duration)
        return response

def handle_metrics_endpoint(request: Request) -> Response:
    """
    Exposes /metrics protected by METRICS_TOKEN.
    Returns 404 if METRICS_TOKEN is not configured.
    Returns 401 if token is missing or invalid (checked in constant time).
    """
    expected_token = os.getenv("METRICS_TOKEN", "").strip()
    if not expected_token:
        return JSONResponse(status_code=404, content={"detail": "Metrics endpoint is disabled."})

    auth_header = request.headers.get("Authorization", "").strip()
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    elif "X-Metrics-Token" in request.headers:
        token = request.headers["X-Metrics-Token"].strip()

    if not token:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized. Valid metrics token required."})

    # Compare fixed-length SHA-256 digests via hmac.compare_digest
    # to eliminate length and timing side-channels
    expected_digest = hashlib.sha256(expected_token.encode("utf-8")).digest()
    provided_digest = hashlib.sha256(token.encode("utf-8")).digest()

    if not hmac.compare_digest(expected_digest, provided_digest):
        return JSONResponse(status_code=401, content={"detail": "Unauthorized. Valid metrics token required."})

    accept = request.headers.get("Accept", "")
    if "application/json" in accept:
        return JSONResponse(content=metrics_collector.get_summary_dict())

    return Response(
        content=metrics_collector.get_prometheus_text(),
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )
