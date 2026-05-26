# Attendify

A face-recognition attendance system for universities. Admins manage users and courses, teachers run live attendance sessions using the camera, and students monitor their attendance on web and mobile.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python, FastAPI, SQLAlchemy, SQLite, InsightFace (SCRFD + ArcFace), JWT |
| **Web frontend** | React, TypeScript, Vite, shadcn/ui |
| **Mobile** | Flutter |

---

## Live Demo (Railway)

> **Note:** Railway free tier sleeps idle services. The first request may take **30–60 seconds** while the container wakes up. Open the backend first, wait until it responds, then open the frontend.

| | URL |
|---|---|
| **Backend API** | https://face-recognition-attendance-system-production-0ed1.up.railway.app |
| **API Docs (Swagger)** | https://face-recognition-attendance-system-production-0ed1.up.railway.app/docs |
| **Web App** | https://face-recognition-attendance-system.up.railway.app/ |

**Demo credentials**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `Admin123!` |

**Warmup check:** `GET /ready` returns `{"ready": true}` once InsightFace has finished loading. If it returns `false`, wait a few seconds and try again.

---

## Architecture

The backend follows a strict three-layer separation:

```
Router  →  Service  →  Repository  →  Database
```

| Layer | Responsibility |
|---|---|
| **Router** | HTTP concerns only — `Depends()`, path params, schema validation, one service call |
| **Service** | Business logic — permission checks, state machine, raises `HTTPException` |
| **Repository** | Data access only — ORM queries, commits, refreshes. No business logic |

```
backend/app/
├── repositories/      # pure data-access (UserRepository, CourseRepository, …)
├── services/          # business logic (UserService, SessionService, …)
├── auth/              # JWT login endpoint + role-based dependencies
├── users/             # thin router → UserService
├── courses/           # thin router → CourseService
├── sessions/          # thin router → SessionService
├── attendance/        # thin router → AttendanceService
├── models/            # SQLAlchemy ORM entities
├── schemas/           # Pydantic request / response schemas
└── utils/             # face.py (InsightFace), security.py (bcrypt / JWT)
```

---

## Features

### Admin
- Create, update, and delete users (students, teachers, admins)
- Excel bulk import of users
- Course management — create courses, assign teachers and students
- Upload student face photos (triggers ArcFace embedding extraction)
- View all attendance records across all courses
- Reset and manage passwords

### Teacher
- Start, end, continue, and submit attendance sessions
- Live face recognition — browser captures frames, client-side SCRFD detects faces, server runs ArcFace recognition
- Manual attendance edits and retake support
- Per-session attendance reports

### Student (Web + Flutter)
- View enrolled courses and session history
- Per-course attendance percentage
- Low-attendance notification when below 75%
- Upload own face photo for enrollment

---

## Face Recognition Pipeline

1. **Enrollment:** Admin (or student) uploads a photo → server runs InsightFace to extract a 512-dim ArcFace embedding → stored in the database.
2. **Live session:** Browser runs SCRFD via ONNX Runtime Web to detect faces → sends cropped face images to `POST /attendance/mark-crops` → server runs ArcFace on each crop → cosine similarity match against enrolled students → attendance record upserted.

No dlib, no cmake, no C++ build environment needed — InsightFace ships pre-built ONNX models.

---

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:

```env
JWT_SECRET=change-me-in-production
DATABASE_URL=sqlite:///./face_recognition_attendance.db
UPLOAD_DIR=backend/uploads
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Optional — override the super-admin identity (defaults shown)
# SUPER_ADMIN_EMAIL=admin@example.com
# SUPER_ADMIN_NAME=Super Admin
```

Seed the initial admin account:

```bash
python scripts/seed_admin.py
```

Database tables are created automatically on first startup — no migration commands needed.

Start the server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

```bash
npm run dev
```

- Web app: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`

---

## Running the Tests

```bash
cd backend
python -m pytest tests/ -v
```

47 unit tests, all in-memory — no database, no running server, no InsightFace needed. Runs in under 2 seconds.

| File | Tests | What it covers |
|---|---|---|
| `tests/test_user_service.py` | 20 | Permission logic, cascade deletes, password flows |
| `tests/test_session_service.py` | 14 | Session state machine, ownership checks |
| `tests/test_attendance_service.py` | 13 | Retake/edit guards, notification threshold, recognition guards |

---

## API Reference

Full interactive documentation is available at `/docs` on a running server.

| Area | Key Endpoints |
|---|---|
| Auth | `POST /auth/login` |
| Users | `GET /admin/users` · `POST /admin/users` · `POST /admin/bulk-upload` |
| Photos | `POST /admin/users/photo` · `POST /admin/students/photo` |
| Courses | `GET /courses` · `POST /courses` · `POST /courses/assign-student` |
| Sessions | `POST /sessions/start` · `POST /sessions/submit` · `GET /sessions/{id}` |
| Attendance | `POST /attendance/mark-crops` · `GET /attendance/notifications` |
| Health | `GET /ready` |

---

## Security

| Area | Implementation |
|---|---|
| Passwords | bcrypt (cost factor 8 ≈ 25 ms per hash); old hashes upgraded transparently on login |
| Authentication | JWT bearer tokens, 12-hour expiry |
| Rate limiting | `/auth/login` limited to 10 requests/minute per IP |
| File uploads | Original filename never written to disk — UUID generated per upload (path-traversal prevention) |
| Super-admin | Identity configurable via `SUPER_ADMIN_EMAIL` env var instead of being hardcoded |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Frontend shows API errors | Confirm backend is running and `VITE_API_BASE_URL` is correct |
| Railway cold start timeout | Hit `/docs` first, poll `/ready` until `{"ready": true}`, then use the app |
| `{"ready": false}` | InsightFace still warming up — wait 30–60 s after a cold start |
| Face not recognised | Check the student has a photo enrolled and the photo contains one clear face |
| Login rate limit (429) | Wait 1 minute — the limit resets per IP per minute |
| Database errors | Confirm `DATABASE_URL` is set and the path is writable |
