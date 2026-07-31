from fastapi import FastAPI
from contextlib import asynccontextmanager
from .db import connect_to_databases, close_databases
from .api import screenshots, events, data_management
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

async def lifespan(app: FastAPI):
    # Startup
    await connect_to_databases()
    yield
    # Shutdown
    await close_databases()

app = FastAPI(title="Visual AI Agent Backend", lifespan=lifespan)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"422 Validation Error: {exc.errors()}")
    logger.error(f"Body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": exc.body},
    )

# CORS middleware if we were hitting this from a normal web app, 
# but chrome extensions can bypass CORS or we configure it as needed.
# For now, MVP assumes extension directly hits this with appropriate permissions.
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(screenshots.router)
app.include_router(events.router)
app.include_router(data_management.router)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
