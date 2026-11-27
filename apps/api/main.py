import os
import re
import uuid
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from errors import AppError
from logging_config import setup_logging, request_id_ctx_var
from rate_limiter import RateLimitMiddleware, limiter, get_client_ip
from config_validator import validate_production_config
from metrics import MetricsMiddleware, handle_metrics_endpoint
from sentry import init_sentry
from supabase_config import supabase
from routers import rescues, users, animals, adoptions, lostfound, notifications, audit, settings, reports

# Validate production environment security configuration
validate_production_config()

# Initialize optional Sentry monitoring if SENTRY_DSN is configured
init_sentry()

# Configure structured JSON logging
setup_logging(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(
    title="AniResQ API",
    description="Backend API for AniResQ animal rescue, adoption, and lost-and-found management platform.",
    version="1.0.0"
)

# -----------------------------------------------------------------------------
# 1. Request ID Middleware
# -----------------------------------------------------------------------------
SAFE_REQUEST_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]{1,64}$")

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming_id = request.headers.get("X-Request-ID")
        if incoming_id and SAFE_REQUEST_ID_REGEX.match(incoming_id):
            request_id = incoming_id
        else:
            request_id = uuid.uuid4().hex

        request.state.request_id = request_id
        token = request_id_ctx_var.set(request_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            request_id_ctx_var.reset(token)

app.add_middleware(RequestIdMiddleware)

# -----------------------------------------------------------------------------
# 2. Security Headers & Request Body Size Limit Middleware
# -----------------------------------------------------------------------------
MAX_REQUEST_BODY_BYTES = int(os.getenv("MAX_REQUEST_BODY_BYTES", str(10 * 1024 * 1024))) # 10 MB

class SecurityHeadersAndBodySizeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_BODY_BYTES:
                    req_id = getattr(request.state, "request_id", "")
                    return JSONResponse(
                        status_code=413,
                        content={
                            "detail": f"Payload exceeds maximum allowed size of {MAX_REQUEST_BODY_BYTES // (1024 * 1024)}MB",
                            "code": "PAYLOAD_TOO_LARGE",
                            "requestId": req_id
                        }
                    )
            except ValueError:
                pass

        response = await call_next(request)
        
        # Standard security response headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Cache control: Do not cache authenticated or mutation API endpoints
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        return response

app.add_middleware(SecurityHeadersAndBodySizeMiddleware)

# -----------------------------------------------------------------------------
# 3. Rate Limit Middleware & Metrics Middleware
# -----------------------------------------------------------------------------
app.add_middleware(MetricsMiddleware)
app.add_middleware(RateLimitMiddleware)

# -----------------------------------------------------------------------------
# 4. CORS Configuration
# -----------------------------------------------------------------------------
env_mode = (os.getenv("ENV") or os.getenv("ENVIRONMENT") or "").lower()
allowed_origins_env = os.getenv("CORS_ORIGINS", "")

if env_mode == "production":
    if not allowed_origins_env or allowed_origins_env.strip() == "*":
        raise RuntimeError(
            "CRITICAL SECURITY CONFIGURATION ERROR: CORS_ORIGINS must be explicitly configured "
            "with specific trusted domains in production. Wildcards ('*') or empty origins are forbidden."
        )
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    if allowed_origins_env:
        allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    else:
        allowed_origins = [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False, # Token authentication used via Bearer headers; cookies not used
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
)

# -----------------------------------------------------------------------------
# 5. Modular Routers
# -----------------------------------------------------------------------------
app.include_router(rescues.router)
app.include_router(users.router)
app.include_router(animals.router)
app.include_router(adoptions.router)
app.include_router(lostfound.router)
app.include_router(notifications.router)
app.include_router(audit.router)
app.include_router(audit.audit_alias)
app.include_router(settings.router)
app.include_router(reports.router)

# -----------------------------------------------------------------------------
# 6. Liveness and Readiness Endpoints
# -----------------------------------------------------------------------------
@app.get("/health", tags=["system"])
async def health_check():
    """Liveness probe: verifies the process is responsive."""
    return {"status": "ok", "service": "aniresq-api"}

@app.get("/ready", tags=["system"])
async def readiness_check(request: Request):
    """Readiness probe: verifies operational connectivity to database with rate limit (30/min per IP)."""
    client_ip = get_client_ip(request)
    try:
        allowed, retry_after = limiter.store.is_allowed(f"ready:{client_ip}", 30, 60)
    except Exception:
        allowed, retry_after = limiter.local_fallback.is_allowed(f"ready:{client_ip}", 30, 60)
    if not allowed:
        req_id = request_id_ctx_var.get() or getattr(request.state, "request_id", "")
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests to readiness probe. Please slow down and try again later.",
                "code": "RATE_LIMIT_EXCEEDED",
                "requestId": req_id
            },
            headers={"Retry-After": str(retry_after)}
        )

    try:
        res = supabase.table("users").select("id").limit(1).execute()
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": "Database connection unavailable"}
        )

@app.get("/metrics", include_in_schema=False)
async def metrics_endpoint(request: Request):
    """Operational metrics endpoint protected by METRICS_TOKEN."""
    return handle_metrics_endpoint(request)

@app.get("/")
async def root():
    return {"message": "Welcome to AniResQ API", "docs": "/docs", "status": "healthy"}

# -----------------------------------------------------------------------------
# 7. Global Exception Handlers
# -----------------------------------------------------------------------------
STATUS_CODE_TO_CODE = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    422: "VALIDATION_FAILED",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_SERVER_ERROR",
    503: "UPSTREAM_UNAVAILABLE",
}

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    req_id = request_id_ctx_var.get() or getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "code": exc.code,
            "requestId": req_id
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    req_id = request_id_ctx_var.get() or getattr(request.state, "request_id", "")
    code = STATUS_CODE_TO_CODE.get(exc.status_code, "ERROR")
    headers = exc.headers or {}
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "code": code,
            "requestId": req_id
        },
        headers=headers
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    req_id = request_id_ctx_var.get() or getattr(request.state, "request_id", "")
    logger.warning(f"Validation error for {request.method} {request.url.path} (request_id={req_id}): {len(exc.errors())} error(s)")
    sanitized_errors = [
        {
            "loc": list(err.get("loc", [])),
            "msg": str(err.get("msg", "")),
            "type": str(err.get("type", "")),
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "detail": sanitized_errors,
            "code": "VALIDATION_FAILED",
            "requestId": req_id
        },
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    req_id = request_id_ctx_var.get() or getattr(request.state, "request_id", "")
    logger.error(
        f"Unhandled server exception for [{req_id}] {request.method} {request.url.path}: {exc}",
        exc_info=True
    )
    # Never leak internal trace, SQL, table names or raw exceptions to client
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "code": "INTERNAL_SERVER_ERROR",
            "requestId": req_id
        }
    )
