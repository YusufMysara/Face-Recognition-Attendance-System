"""
Set minimum required env vars BEFORE any app module is imported.

app/config.py calls get_settings() at module level, which validates that
JWT_SECRET and DATABASE_URL exist.  Without these two lines the entire
test collection fails with a Pydantic ValidationError.
"""
import os

os.environ.setdefault("JWT_SECRET", "test-secret-key-not-used-in-tests")
# Use a file-based SQLite so SQLAlchemy picks QueuePool, which accepts
# pool_size / max_overflow (in-memory SQLite uses SingletonThreadPool, which rejects them).
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
