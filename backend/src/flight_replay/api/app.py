from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from flight_replay.api.routes.flights import router as flights_router
from flight_replay.api.schemas import HealthResponse


def create_app() -> FastAPI:
    app = FastAPI(title="Flight Replay API", version="0.1.0")

    # Browsers block frontend (port 5173) → API (port 8000) without CORS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(flights_router)

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    return app


# Uvicorn looks for: flight_replay.api.app:app
app = create_app()
