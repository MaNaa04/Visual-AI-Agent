from fastapi import FastAPI
from contextlib import asynccontextmanager
from .db import connect_to_databases, close_databases
from .api import screenshots, events
import logging

logging.basicConfig(level=logging.INFO)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_databases()
    yield
    # Shutdown
    await close_databases()

app = FastAPI(title="Visual AI Agent Backend", lifespan=lifespan)

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

@app.get("/health")
async def health_check():
    return {"status": "ok"}
