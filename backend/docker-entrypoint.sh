#!/bin/sh
set -e

# Named volumes are mounted as empty directories — create subdirs we need.
mkdir -p /app/db /app/uploads

# Create all database tables (idempotent: safe to run on every startup).
# This must happen before seed_admin.py, which calls SessionLocal() directly.
python -c "
from app.database import Base, engine
Base.metadata.create_all(bind=engine)
print('Database tables ready.')
"

# Seed the super-admin account.
# The script is a no-op if the account already exists.
python scripts/seed_admin.py

# Hand off to uvicorn.
# PORT is injected by docker-compose (8000) or Railway (dynamic).
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
