#!/bin/sh
set -e

mkdir -p /app/uploads

# Wait for PostgreSQL to accept connections before running migrations.
# DATABASE_URL format: postgresql://user:pass@host:port/dbname
if echo "$DATABASE_URL" | grep -q "^postgresql"; then
    # Extract host and port from the URL.
    DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
    DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    DB_PORT=${DB_PORT:-5432}

    echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT ..."
    until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
        sleep 1
    done
    echo "PostgreSQL is ready."
fi

# Apply all pending migrations (creates schema on first run, no-op thereafter).
python -m alembic upgrade head

# Seed the super-admin account (no-op if account already exists).
python scripts/seed_admin.py

# Hand off to uvicorn.
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
