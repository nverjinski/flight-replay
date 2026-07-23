"""
DB session wiring for sync SQLAlchemy.

Engine -> pool of connections to Postgres
Session -> one request / CLI command's unit of work
get_db -> FastAPI Depends() helper 
"""

from __future__ import annotations

import os
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Default matches docker-compose.yml (user/password/db/port)
# The +psycopg bit selects the psycopg v3 driver (required with our deps)
DEFAULT_DATABASE_URL = (
    "postgresql+psycopg://flight:flight@localhost:5432/flight_replay"
)

def get_database_url() -> str:
    """
    Resolve the connection string.

    Prefer DATABASE_URL from the environment (Compose, CI, later hosted Postgres).
    Fall back to the local Compose default so Day 1 REPL works with zero config.
    """
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)

# Engine = connection pool. Create once at import time for this process.
engine = create_engine(
    get_database_url(), 
    pool_pre_ping=True, # drop dead connections (helpful after laptop sleep)
    echo=True, # print SQL to the console. Turn off later
)

# sessionmaker is a factory: SessionLocal() -> a new Session bound to `engine`.
# autoflush/autocommit defaults are fine for SQLAlchemy learning
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Iterator[Session]:
    """
    FastAPI dependency pattern (same ideas as flight_store_dep):

        def route(db: Session = Depends(get_db)):
            ...
        
    Yield gives the route a Session; `finally` always closes it -
    even if the handler raises HTTPException or a bug.
    We will wire Depends(get_db) later; writing it now keeps the habit.
    """

    db = SessionLocal();
    try:
        yield db
    finally:
        db.close();