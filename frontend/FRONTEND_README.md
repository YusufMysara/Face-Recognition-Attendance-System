# Face Recognition Attendance System - Frontend Documentation

## Overview
This document describes the updated frontend UI and the Start Session → Live Camera flow for the Face Recognition Attendance System.

## Key Changes Implemented

### 1. Student Dashboard
- **Removed**: "Perfect Days" card
- **Result**: 3-card layout (Enrolled Courses, Classes This Week, Overall Attendance)
- Cards are evenly distributed and balanced

### 2. Teacher Dashboard
- **Removed**: "Avg Attendance" card and "Today's Schedule" widget
- **Result**: 3-card layout (Courses Taught, Total Students, Sessions Today)
- Layout adjusted to show only Recent Sessions

### 3. Sessions Page
- **Removed**: "Retake" action button from sessions table
- **Added**: Confirmation modal for session deletion
- **Actions**: View and Delete only
- **Primary Action**: "Start New Session" button opens course selection modal

### 4. Start New Session Flow

#### Step-by-Step Process:
1. **Teacher clicks "Start New Session"**
   - Opens `CourseSelectionModal`
   
2. **Course Selection Modal**
   - Displays all courses assigned to the teacher
   - If only one course exists, it's auto-selected (modal still shows for confirmation)
   - Optional session name input field (e.g., "Week 5 Lecture")
   
3. **Start Button Action**
   - Frontend POSTs to `/api/sessions/start` with:
     ```json
     {
       "course_id": "selected_course_id",
       "teacher_id": "current_teacher_id",
       "session_name": "optional_name"
     }
     ```
   - Expected response:
     ```json
     {
       "session_id": "uuid",
       "started_at": "timestamp",
       "auto_end_minutes": 90
     }
     ```
   
4. **After Successful Start**
   - Shows success toast: "Session started"
   - Redirects to: `/teacher/camera?session_id={id}&course_id={id}`
   - Session context is preserved in URL parameters

### 5. Live Camera Page Logic

#### A. Page Load Behavior:

**With session_id in query params:**
- Fetches session details from `/api/sessions/{session_id}`
- If session is ongoing: Display camera interface with session context
- If session is ended: Show read-only view with "Start New Session" button

**Without session_id:**
- Shows two sections:
  1. **Active Sessions List**: 
     - Fetches from `/api/sessions?teacher_id={id}&status=ongoing`
     - Each session has a "Resume" button
  2. **Start New Session Button**: Opens course selection modal

#### B. Course Selection Rules:
- **Never auto-select** or auto-guess a course
- Always require explicit teacher selection or session resumption
- Display selected course name prominently near camera preview
- Show session name and start time for resumed sessions

#### C. Camera Controls:
- **Start Camera / Stop Camera**: Toggle camera feed
- **End Session**: Closes current session (with confirmation)
- **Recognition**: Only active when:
  - Camera is ON
  - Session status is "ongoing"
  - Backend confirms session is not closed

#### D. Conflict Prevention:
- Before starting new session, checks for existing ongoing sessions for the same course
- If conflict exists: Shows warning and requires resuming existing session
- Prevents duplicate sessions for the same course

### 6. Teacher Attendance Page
- **Removed**: "Overall" summary card
- **Kept**: Session-level attendance table
- **Added**: "Edit Attendance" button (opens editor modal)

### 7. NEW: Student Search Page
**Route**: `/teacher/course/:courseId/student-search`

**Features**:
- Search box for finding students by name or ID
- Server-side search: `GET /courses/{courseId}/students?query={q}`
- Results show: Name, Student ID, Group, "View Overall Attendance" button

**View Overall Attendance**:
- Displays a detailed card with:
  - Student name and ID
  - Total sessions vs Present sessions
  - Attendance percentage (with progress bar)
  - Timeline of all session dates with presence status
  
**API Endpoints Used**:
- `GET /courses/{courseId}/sessions/count` - Total sessions
- `GET /attendance/student/{studentId}/course/{courseId}/count` - Student attendance count
- Falls back to client-side aggregation if specific endpoint unavailable

## Component Architecture

### New Components Created:

1. **CourseSelectionModal** (`src/components/modals/CourseSelectionModal.tsx`)
   - Course selection with radio buttons
   - Optional session name input
   - Start/Cancel actions

2. **ConfirmationModal** (`src/components/modals/ConfirmationModal.tsx`)
   - Reusable confirmation dialog
   - Configurable title, description, buttons
   - Supports default and destructive variants

3. **StudentSearch** (`src/pages/teacher/StudentSearch.tsx`)
   - Student search interface
   - Attendance detail view
   - Session timeline display

### API Utility Functions

**Location**: `src/lib/api.ts`

**Functions**:
- `coursesApi.getTeacherCourses(teacherId)`
- `coursesApi.getCourseStudents(courseId, query?)`
- `coursesApi.getCourseSessionsCount(courseId)`
- `sessionsApi.startSession(data)`
- `sessionsApi.getSession(sessionId)`
- `sessionsApi.getTeacherSessions(teacherId, status?)`
- `sessionsApi.endSession(sessionId)`
- `sessionsApi.deleteSession(sessionId)`
- `attendanceApi.markAttendance(sessionId, formData)`
- `attendanceApi.getStudentCourseAttendance(studentId, courseId)`
- `attendanceApi.getSessionAttendance(sessionId)`

**Configuration**:
- Base URL is set to `/api` - update `BASE_URL` constant to match your backend

## Routes

### Public Routes:
- `/` - Landing page
- `/login` - Login page

### Admin Routes:
- `/admin/dashboard` - Admin dashboard
- `/admin/users` - User management
- `/admin/courses` - Course management
- `/admin/upload-photos` - Photo upload
- `/admin/reset-password` - Password reset
- `/admin/attendance` - Attendance records

### Teacher Routes:
- `/teacher/dashboard` - Teacher dashboard
- `/teacher/sessions` - Sessions management
- `/teacher/camera` - Live camera interface
- `/teacher/attendance` - Attendance view/edit
- `/teacher/course/:courseId/student-search` - Student search

### Student Routes:
- `/student/dashboard` - Student dashboard
- `/student/stats` - Attendance statistics
- `/student/history` - Attendance history

## UX Enhancements

### Toast Notifications:
- Session started successfully
- Session ended
- Error messages for failed operations
- Camera state changes

### Loading States:
- Spinner during API calls
- Disabled buttons during loading
- Loading message on initial page load

### Validation:
- Prevent starting session without course selection
- Prevent duplicate sessions for same course
- Confirm destructive actions (delete session)
- Block camera activation for closed sessions

## Backend Integration Notes

### Important:
- All API endpoints are **placeholder calls** using `fetch`
- Replace `BASE_URL` in `src/lib/api.ts` with actual backend URL
- Update authentication to use real user/teacher IDs from auth context
- Add proper error handling based on your backend response format

### Expected Response Formats:

**Start Session**:
```json
{
  "session_id": "uuid",
  "started_at": "2024-03-20T09:00:00Z",
  "auto_end_minutes": 90
}
```

**Get Session**:
```json
{
  "id": "uuid",
  "course": "CS101",
  "course_id": "uuid",
  "started_at": "timestamp",
  "status": "ongoing"
}
```

## Future Enhancements

- Real-time camera feed integration
- WebRTC for live video streaming
- Real facial recognition API integration
- Batch attendance marking
- Export attendance reports
- Email notifications for sessions

## Testing Recommendations

1. **Session Flow Testing**:
   - Start session with one course
   - Start session with multiple courses
   - Resume active session
   - Try starting duplicate session
   - End session
   - Delete session with confirmation

2. **Camera Testing**:
   - Camera activation/deactivation
   - Recognition while camera active
   - Block recognition on closed session
   - Session state persistence

3. **Student Search Testing**:
   - Search with various queries
   - View attendance details
   - Handle empty results
   - Test with large result sets

## Maintenance

### Adding New Routes:
1. Create page component in appropriate folder
2. Add route in `src/App.tsx`
3. Add navigation link in `src/components/layout/AppSidebar.tsx`

### Modifying API Calls:
1. Update functions in `src/lib/api.ts`
2. Update TypeScript interfaces if response format changes
3. Update error handling as needed

---

**Last Updated**: 2024-03-20  
**Version**: 2.0.0
