import logging
from typing import Any, Optional

logger = logging.getLogger("errors")

class AppError(Exception):
    """Base application exception with standardized code and status."""
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = 500,
        detail: Optional[Any] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.detail = detail if detail is not None else message

class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", code: str = "NOT_FOUND"):
        super().__init__(message, code=code, status_code=404)

class ConflictError(AppError):
    def __init__(self, message: str = "Conflict with existing resource state", code: str = "CONFLICT"):
        super().__init__(message, code=code, status_code=409)

class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden: Insufficient privileges", code: str = "FORBIDDEN"):
        super().__init__(message, code=code, status_code=403)

class UnauthorizedError(AppError):
    def __init__(self, message: str = "Invalid or expired authentication credentials", code: str = "UNAUTHORIZED"):
        super().__init__(message, code=code, status_code=401)

class ValidationFailedError(AppError):
    def __init__(self, message: str = "Validation failed", code: str = "VALIDATION_FAILED", detail: Optional[Any] = None):
        super().__init__(message, code=code, status_code=422, detail=detail)

class UpstreamUnavailableError(AppError):
    def __init__(self, message: str = "Service temporarily unavailable", code: str = "UPSTREAM_UNAVAILABLE"):
        super().__init__(message, code=code, status_code=503)

class RateLimitExceededError(AppError):
    def __init__(self, message: str = "Too many requests. Please slow down and try again later.", retry_after: int = 60):
        super().__init__(message, code="RATE_LIMIT_EXCEEDED", status_code=429)
        self.retry_after = retry_after

def map_db_error(exc: Exception, context_msg: str = "Database operation failed") -> AppError:
    """
    Translates PostgreSQL and PostgREST database errors into typed AppErrors.
    Postgres error codes:
      - 23505 -> ConflictError (409 unique constraint violation)
      - 23503 -> NotFoundError / ConflictError (404/409 foreign key violation)
      - 23514 -> ValidationFailedError (422 check constraint violation)
      - 42501 -> ForbiddenError (403 permission denied)
      - PGRST116 -> NotFoundError (404 zero rows returned)
    """
    err_str = str(exc)
    err_lower = err_str.lower()

    if "23505" in err_str or "duplicate key" in err_lower or "unique constraint" in err_lower:
        return ConflictError("A record with these details already exists or conflict occurred")

    if "23503" in err_str or "foreign key" in err_lower:
        return NotFoundError("Referenced parent record does not exist")

    if "23514" in err_str or "check constraint" in err_lower:
        return ValidationFailedError("Database check constraint validation failed")

    if "42501" in err_str or "insufficient_privilege" in err_lower or "permission denied" in err_lower:
        return ForbiddenError("Permission denied for database resource")

    if "pgrst116" in err_lower or "0 rows" in err_lower:
        return NotFoundError("Requested resource was not found")

    logger.error(f"Unmapped database error during {context_msg}: {err_str}", exc_info=True)
    return AppError("Internal database error", code="INTERNAL_SERVER_ERROR", status_code=500)
