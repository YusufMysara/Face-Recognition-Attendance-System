# Attendify

**Face-recognition attendance system for universities** — admins manage users and courses, teachers run live sessions with camera-based check-in, and students track attendance on web and mobile.

| | |
|---|---|
| **Backend** | Python · FastAPI · SQLAlchemy · SQLite · JWT · `face_recognition` |
| **Web** | React · TypeScript · Vite · TanStack Query |
| **Mobile** | Flutter (student app) |

---

## Live demo (Railway)

> **Free tier cold start:** Railway sleeps idle services. The **first request can take ~30–60 seconds** while the container wakes.  
> **Recommended order:** open the **backend** first, wait until it responds, **then** open the **frontend** so API calls do not time out against a sleeping API.

| | URL |
|---|---|
| **API (backend)** | [https://face-recognition-attendance-system-production-0ed1.up.railway.app] |
| **Interactive API docs** | [https://face-recognition-attendance-system-production-0ed1.up.railway.app/docs] |
| **Web app (frontend)** | [https://face-recognition-attendance-system.up.railway.app/] |

**Quick wake-up:** visit the backend root or `/docs` until the page loads, then use the frontend.

**Demo login**

- Admin: `admin@example.com` / `Admin123!`  

---

## What this project demonstrates

- **Full-stack delivery:** REST API, SPA, and optional mobile client against the same API.
- **Auth & authorization:** JWT bearer tokens, bcrypt passwords, role-based access (admin, teacher, student).
- **Domain modeling:** courses, enrollments, sessions, attendance lifecycle (open → closed → submitted).
- **Face recognition pipeline:** store face embeddings on enrollment; match live camera frames to enrolled students during a session.
- **Ops awareness:** deployed to Railway with realistic constraints (cold starts, env-based config, CORS).

---

## Repository layout

```
backend/          # FastAPI app (app/main.py, routers, models, face utils)
frontend/         # React + Vite SPA
Student App/      # Flutter client 

```

---

## Core features

- **Admin:** users CRUD, Excel bulk import, course & enrollment management, student photo upload (embeddings), global attendance view, password policies.
- **Teacher:** start/end/submit sessions, live browser camera → `POST /attendance/mark`, manual edits, retake, reports.
- **Student (web + Flutter):** courses, attendance history, percentages, low-attendance notifications.

---

## Local development

### Prerequisites

- Python 3.11+
- Node.js 18+
- OS tooling for `face_recognition` / **dlib** (see [face_recognition](https://github.com/ageitgey/face_recognition) — Windows often needs Visual Studio Build Tools + cmake).

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
```

**Database (first time):**

```bash
python -m app.database
sqlite3 face_recognition_attendance.db ".read migrations/001_initial.sql"
python scripts/migrate_password_changed.py
python scripts/seed_admin.py
```

**Run:**

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**`.env` (example):**

```env
JWT_SECRET=change-me-in-production
DATABASE_URL=sqlite:///./face_recognition_attendance.db
UPLOAD_DIR=backend/uploads
CORS_ALLOWED_ORIGINS=http://localhost:5173
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

App: `http://localhost:5173` · API docs: `http://localhost:8000/docs`

---

## API surface (summary)

| Area | Examples |
|------|-----------|
| Auth | `POST /auth/login` |
| Admin | `/admin/users`, bulk upload, photo upload |
| Courses | `/courses`, assign teacher/student |
| Sessions | `/sessions/start`, `/sessions/submit`, … |
| Attendance | `/attendance/mark`, history, notifications |

Full contract: **`/docs`** on a running backend.

---

### Troubleshooting

| Issue | What to check |
|--------|----------------|
| Frontend cannot reach API | Backend running; `VITE_API_BASE_URL` / Railway env; CORS includes frontend origin |
| Railway first load slow | Cold start — hit `/docs` first, retry |
| Face recognition errors | dlib / cmake / image quality; students must have embeddings registered |
| DB errors | Migrations and `DATABASE_URL` path writable |
