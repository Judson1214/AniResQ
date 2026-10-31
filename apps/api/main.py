import os
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from routers import rescues, users, animals, adoptions, lostfound, notifications

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("main")

app = FastAPI(
    title="AniResQ API",
    description="Backend API for AniResQ animal rescue, adoption, and lost-and-found management platform.",
    version="1.0.0"
)

# Safe CORS configuration
allowed_origins_env = os.getenv("CORS_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
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
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register all modular routers
app.include_router(rescues.router)
app.include_router(users.router)
app.include_router(animals.router)
app.include_router(adoptions.router)
app.include_router(lostfound.router)
app.include_router(notifications.router)

@app.get("/")
async def root():
    return {"message": "Welcome to AniResQ API", "docs": "/docs", "status": "healthy"}

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error for {request.method} {request.url.path}: {len(exc.errors())} error(s)")
    # Sanitize: Do not echo raw request body or private internals
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )
