# Attendify

Complete university attendance system with FastAPI backend and React frontend driven by face recognition.

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd face-recognition-attendance-system

# Run automated setup
python setup.py
```

### Option 2: Manual Setup

1. **Clone the repository**
2. **Backend Setup** (see Backend section below)
3. **Frontend Setup** (see Frontend section below)

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

**Default Admin Credentials:**
- Email: `admin@example.com`
- Password: `Admin123!`

## Prerequisites

- Python 3.11+
- Node.js 18+
- SQLite (included)
- `face_recognition` OS prerequisites (`cmake`, `dlib` build tools)

### Windows Prerequisites for face_recognition

```bash
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Install cmake
pip install cmake

# For Windows, you might need:
pip install dlib==19.24.0 --verbose
```

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
# or
source .venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
```

### Database Setup

1. Initialize database:
```bash
python -m app.database
```

2. Run migrations:
```bash
sqlite3 face_recognition_attendance.db ".read migrations/001_initial.sql"
python scripts/migrate_password_changed.py
```

3. Create admin user:
```bash
python scripts/seed_admin.py
```

### Start Backend Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Environment overrides (optional) – create `.env`:

```
JWT_SECRET=change-me
DATABASE_URL=sqlite:///./face_recognition_attendance.db
UPLOAD_DIR=backend/uploads
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Frontend Configuration

Create `.env` file in frontend directory:

```
VITE_API_BASE_URL=http://localhost:8000
```

The frontend will be available at `http://localhost:5173`

## Features

- **Admin Dashboard**: manage users (create, edit, delete), bulk upload users via Excel, upload photos, assign courses/groups, reset passwords, view attendance records, role-based filtering
- **Teacher Dashboard**: manage courses and sessions, live camera capture for attendance, retake/submit/edit attendance, view course statuses and reports
- **Student Dashboard**: view personal attendance history, per-course attendance percentage, complete profile (change password), upload photos
- **Authentication**: JWT tokens, bcrypt password hashing, role-based access control (Super Admin, Admin, Teacher, Student)
- **Face Recognition**: Real-time face detection and recognition using `face_recognition` library
- **User Management**: Hierarchical permissions, password completion flow for bulk-uploaded users, secure password changes

## Troubleshooting

### Backend Issues
- **Import errors**: Ensure all packages in `requirements.txt` are installed
- **Database errors**: Run migrations in order: `001_initial.sql` then `migrate_password_changed.py`
- **Face recognition not working**: Install system dependencies (cmake, dlib build tools)

### Frontend Issues
- **API connection failed**: Check if backend is running on port 8000 and `VITE_API_BASE_URL` is set correctly
- **Build errors**: Run `npm install` to ensure all dependencies are installed

### Common Setup Issues
- **Permission denied**: Run terminal as administrator (Windows) or use `sudo` (Linux/Mac)
- **Port already in use**: Change ports in startup commands or kill existing processes
- **Database locked**: Close any SQLite connections or restart the backend

## Notes

- Upload directories auto-create under `backend/uploads`
- Teacher camera capture streams frames via browser and posts to `/attendance/mark`
- Attendance percentage formula: `(present_sessions / total_sessions) * 100`
- Default admin account is created with email `admin@example.com` and password `Admin123!`

