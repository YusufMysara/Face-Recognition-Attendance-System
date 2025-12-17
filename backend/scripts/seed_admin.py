from app.database import SessionLocal
from app.models import User
from app.utils.security import get_password_hash


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter_by(email="admin@example.com").first()
        if existing:
            print("Admin already exists (admin@example.com)")
            return
        admin = User(
            name="Super Admin",
            email="admin@example.com",
            role="admin",
            password_hash=get_password_hash("Admin123!"),
        )
        db.add(admin)
        db.commit()
        print("Admin created: admin@example.com / Admin123!")
    finally:
        db.close()


if __name__ == "__main__":
    main()

