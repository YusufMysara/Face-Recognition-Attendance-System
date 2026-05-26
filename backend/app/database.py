from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    # Keep one connection alive between requests — avoids reconnect overhead.
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    future=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, _connection_record):
    """Apply performance pragmas on every new SQLite connection."""
    cursor = dbapi_connection.cursor()
    # WAL mode: readers don't block writers and vice-versa.
    cursor.execute("PRAGMA journal_mode=WAL")
    # NORMAL sync is safe with WAL and skips most fsync calls.
    cursor.execute("PRAGMA synchronous=NORMAL")
    # 64 MB page cache (negative value = kibibytes).
    cursor.execute("PRAGMA cache_size=-65536")
    # Temp tables and indices live in RAM.
    cursor.execute("PRAGMA temp_store=MEMORY")
    # 128 MB memory-mapped I/O for sequential reads.
    cursor.execute("PRAGMA mmap_size=134217728")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("Database initialized.")

