# Face Recognition Attendance System

Complete university attendance system with FastAPI backend and React frontend driven by face recognition.

## Requirements

- Python 3.11+
- Node.js 18+
- SQLite (included)
- `face_recognition` OS prerequisites (`cmake`, `dlib` build tools).

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # or source .venv/bin/activate
pip install -r requirements.txt
```

Run migrations (SQLite):

```bash
python -m app.database  # ensures DB file exists
sqlite3 face_recognition_attendance.db ".read migrations/001_initial.sql"
sqlite3 face_recognition_attendance.db ".read migrations/002_courses_nullable_teacher.sql"
```

Start API:

```bash
uvicorn app.main:app --reload
```

Environment overrides (optional) – create `.env`:

```
JWT_SECRET=change-me
DATABASE_URL=sqlite:///./face_recognition_attendance.db
UPLOAD_DIR=backend/uploads
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Set API base via `.env`:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Features

- Admin: manage users, upload photos, assign courses/groups, reset passwords, view attendance.
- Teacher: manage sessions, live camera capture, retake/submit/edit attendance, view course statuses.
- Student: view personal attendance history + per-course percentage.
- JWT auth, bcrypt hashing, role-based routing.
- Real face-recognition pipeline powered by `face_recognition`.

## Notes

- Upload directories auto-create under `backend/uploads`.
- Teacher camera capture streams frames via browser and posts to `/attendance/mark`.
- Attendance percentage formula: `(present_sessions / total_sessions) * 100`.

