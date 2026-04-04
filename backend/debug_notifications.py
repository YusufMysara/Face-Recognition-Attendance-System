"""
Temporary debug script — logs in as a student and calls GET /notifications.
Run from the backend/ directory:  python debug_notifications.py
Edit EMAIL / PASSWORD to match an actual student account in your DB.
"""
import sys
import requests

BASE = "http://localhost:8000"

# ── change these to a real student account ───────────────────────────────────
EMAIL    = input("Student email: ").strip()
PASSWORD = input("Password     : ").strip()
# ─────────────────────────────────────────────────────────────────────────────

print("\n── 1. Login ──")
r = requests.post(f"{BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD})
if not r.ok:
    print(f"LOGIN FAILED {r.status_code}: {r.text}")
    sys.exit(1)

data = r.json()
token = data.get("token", {}).get("access_token")
user  = data.get("user", {})
print(f"Logged in as: id={user.get('id')}  role={user.get('role')}  email={user.get('email')}")

if user.get("role") != "student":
    print("ERROR: This account is not a student. Use a student account.")
    sys.exit(1)

print("\n── 2. GET /attendance/notifications ──")
r2 = requests.get(
    f"{BASE}/attendance/notifications",
    headers={"Authorization": f"Bearer {token}"},
)
print(f"Status : {r2.status_code}")
print(f"Response JSON: {r2.json()}")
print("\nCheck the uvicorn terminal for the detailed log output.")
