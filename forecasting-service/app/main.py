import os
import logging
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.api.v1.forecast import router as forecast_v1_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("forecasting-service")

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Demand Forecasting & Waste Reduction Service",
    description="Python FastAPI service for inventory demand prediction and waste analytics",
    version="0.2.0"
)

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(forecast_v1_router)


@app.get("/health", tags=["Health"])
def get_health():
    """
    Returns service health status for monitoring.
    """
    return {
        "status": "healthy",
        "service": "forecasting-service",
        "version": "0.2.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("FORECAST_SERVICE_PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
