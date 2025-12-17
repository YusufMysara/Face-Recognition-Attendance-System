#!/usr/bin/env python3

import sqlite3
import os

# Get the database path
db_path = os.path.join(os.path.dirname(__file__), '..', 'face_recognition_attendance.db')

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # Add the password_changed column if it doesn't exist
    cursor.execute("ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0")
    conn.commit()
    print("Migration completed successfully: Added password_changed column to users table")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e):
        print("Migration skipped: password_changed column already exists")
    else:
        print(f"Migration failed: {e}")
        conn.rollback()
finally:
    conn.close()