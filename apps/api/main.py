from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import rescues, animals, adoptions, lostfound, users, notifications

app = FastAPI(title="AniResQ API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(rescues.router)
app.include_router(animals.router)
app.include_router(adoptions.router)
app.include_router(lostfound.router)
app.include_router(users.router)
app.include_router(notifications.router)

@app.get("/")
async def root():
    return {"message": "Welcome to AniResQ API", "docs": "/docs"}
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    logging.error(f"Validation error for request {request.method} {request.url}: {exc}")
    logging.error(f"Body: {await request.body()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc)},
    )
