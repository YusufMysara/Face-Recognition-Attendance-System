import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }).then((res) => res.data),
};

export const adminService = {
  createUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    group?: string;
  }) => api.post("/admin/users", payload).then((res) => res.data),
  listUsers: () => api.get("/admin/users").then((res) => res.data),
  updateUser: (id: number, payload: Record<string, unknown>) =>
    api.put(`/admin/users/${id}`, payload).then((res) => res.data),
  deleteUser: (id: number) =>
    api.delete(`/admin/users/${id}`).then((res) => res.data),
  resetPassword: (payload: { user_id: number; new_password: string }) =>
    api.post("/admin/reset-password", payload).then((res) => res.data),
  uploadPhoto: (studentId: number, file: File) => {
    const formData = new FormData();
    formData.append("student_id", String(studentId));
    formData.append("file", file);
    return api
      .post("/admin/users/photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data);
  },
};

export const courseService = {
  create: (payload: { name: string; description: string; teacher_id: number }) =>
    api.post("/courses", payload).then((res) => res.data),
  list: () => api.get("/courses").then((res) => res.data),
  delete: (id: number) => api.delete(`/courses/${id}`).then((res) => res.data),
  assignStudent: (payload: { student_id: number; course_id: number }) =>
    api.post("/courses/assign-student", payload).then((res) => res.data),
  assignTeacher: (payload: { teacher_id: number; course_id: number }) =>
    api.post("/courses/assign-teacher", payload).then((res) => res.data),
};

export const sessionService = {
  start: (courseId: number) =>
    api.post("/sessions/start", { course_id: courseId }).then((res) => res.data),
  end: (sessionId: number) =>
    api.post("/sessions/end", null, { params: { session_id: sessionId } }).then((res) => res.data),
  submit: (sessionId: number) =>
    api.post("/sessions/submit", null, { params: { session_id: sessionId } }).then((res) => res.data),
  remove: (sessionId: number) => api.delete(`/sessions/${sessionId}`).then((res) => res.data),
  byCourse: (courseId: number) =>
    api.get(`/sessions/course/${courseId}`).then((res) => res.data),
};

export const attendanceService = {
  markFrame: (sessionId: number, file: Blob) => {
    const formData = new FormData();
    formData.append("session_id", String(sessionId));
    formData.append("file", file);
    return api
      .post("/attendance/mark", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data);
  },
  retake: (sessionId: number) => api.post("/attendance/retake", { session_id: sessionId }).then((res) => res.data),
  edit: (attendanceId: number, status: string) =>
    api.put("/attendance/edit", { attendance_id: attendanceId, status }).then((res) => res.data),
  session: (sessionId: number) =>
    api.get(`/attendance/session/${sessionId}`).then((res) => res.data),
  student: (studentId: number) =>
    api.get(`/attendance/student/${studentId}`).then((res) => res.data),
};

export default api;

