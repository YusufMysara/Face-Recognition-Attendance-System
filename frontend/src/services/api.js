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
    login: (email, password) => api.post("/auth/login", { email, password }).then((res) => res.data),
};
export const adminService = {
    createUser: (payload) => api.post("/admin/users", payload).then((res) => res.data),
    listUsers: () => api.get("/admin/users").then((res) => res.data),
    updateUser: (id, payload) => api.put(`/admin/users/${id}`, payload).then((res) => res.data),
    deleteUser: (id) => api.delete(`/admin/users/${id}`).then((res) => res.data),
    resetPassword: (payload) => api.post("/admin/reset-password", payload).then((res) => res.data),
    uploadPhoto: (studentId, file) => {
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
    create: (payload) => api.post("/courses", payload).then((res) => res.data),
    list: () => api.get("/courses").then((res) => res.data),
    assignStudent: (payload) => api.post("/courses/assign-student", payload).then((res) => res.data),
    assignTeacher: (payload) => api.post("/courses/assign-teacher", payload).then((res) => res.data),
};
export const sessionService = {
    start: (courseId) => api.post("/sessions/start", { course_id: courseId }).then((res) => res.data),
    end: (sessionId) => api.post("/sessions/end", null, { params: { session_id: sessionId } }).then((res) => res.data),
    submit: (sessionId) => api.post("/sessions/submit", null, { params: { session_id: sessionId } }).then((res) => res.data),
    remove: (sessionId) => api.delete(`/sessions/${sessionId}`).then((res) => res.data),
    byCourse: (courseId) => api.get(`/sessions/course/${courseId}`).then((res) => res.data),
};
export const attendanceService = {
    markFrame: (sessionId, file) => {
        const formData = new FormData();
        formData.append("session_id", String(sessionId));
        formData.append("file", file);
        return api
            .post("/attendance/mark", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        })
            .then((res) => res.data);
    },
    retake: (sessionId) => api.post("/attendance/retake", { session_id: sessionId }).then((res) => res.data),
    edit: (attendanceId, status) => api.put("/attendance/edit", { attendance_id: attendanceId, status }).then((res) => res.data),
    session: (sessionId) => api.get(`/attendance/session/${sessionId}`).then((res) => res.data),
    student: (studentId) => api.get(`/attendance/student/${studentId}`).then((res) => res.data),
};
export default api;
