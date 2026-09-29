from database import engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router
from sqlalchemy import text

app = FastAPI(
    title="WeTravel API",
    description="Backend API for the WeTravel web application",
    version="0.1.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------

app.include_router(
    router,
    prefix="/api",
)


# ---------------------------------------------------------
# Health Checks
# ---------------- -----------------------------------------


@app.get("/")
def root():
    return {
        "message": "WeTravel API is running",
        "version": "0.1.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }


@app.get("/db-health")
def db_health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"status": "database connected"}
