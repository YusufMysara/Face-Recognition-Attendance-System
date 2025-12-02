// API utility functions for backend communication
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Helper function to get auth token
const getToken = (): string | null => {
  return localStorage.getItem("token");
};

// Helper function to make authenticated requests
const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: headers as HeadersInit,
  });

  if (response.status === 401) {
    // Token expired or invalid, clear and redirect to login
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  return response;
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Invalid credentials" }));
      throw new Error(error.detail || "Login failed");
    }

    const data = await response.json();
    // Store token and user info
    if (data.token?.access_token) {
      localStorage.setItem("token", data.token.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },
};

// Admin API - Users
export const usersApi = {
  list: async () => {
    const response = await fetchWithAuth("/admin/users");
    if (!response.ok) throw new Error("Failed to fetch users");
    return response.json();
  },

  create: async (payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    group?: string;
  }) => {
    const response = await fetchWithAuth("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to create user" }));
      throw new Error(error.detail || "Failed to create user");
    }
    return response.json();
  },

  update: async (userId: number, payload: {
    name?: string;
    email?: string;
    role?: string;
    group?: string;
    password?: string;
  }) => {
    const response = await fetchWithAuth(`/admin/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to update user" }));
      throw new Error(error.detail || "Failed to update user");
    }
    return response.json();
  },

  delete: async (userId: number) => {
    const response = await fetchWithAuth(`/admin/users/${userId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to delete user" }));
      throw new Error(error.detail || "Failed to delete user");
    }
    return response.json();
  },

  uploadPhoto: async (studentId: number, file: File) => {
    const formData = new FormData();
    formData.append("student_id", String(studentId));
    formData.append("file", file);

    const token = getToken();
    const response = await fetch(`${BASE_URL}/admin/users/photo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to upload photo" }));
      throw new Error(error.detail || "Failed to upload photo");
    }
    return response.json();
  },

  resetPassword: async (userId: number, newPassword: string) => {
    const response = await fetchWithAuth("/admin/reset-password", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, new_password: newPassword }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to reset password" }));
      throw new Error(error.detail || "Failed to reset password");
    }
    return response.json();
  },
};

// Courses API
export const coursesApi = {
  list: async () => {
    const response = await fetchWithAuth("/courses");
    if (!response.ok) throw new Error("Failed to fetch courses");
    return response.json();
  },

  get: async (courseId: number) => {
    const response = await fetchWithAuth(`/courses/${courseId}`);
    if (!response.ok) throw new Error("Failed to fetch course");
    return response.json();
  },

  create: async (payload: {
    name: string;
    description: string;
    teacher_id?: number;
  }) => {
    const response = await fetchWithAuth("/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to create course" }));
      throw new Error(error.detail || "Failed to create course");
    }
    return response.json();
  },

  update: async (courseId: number, payload: {
    name?: string;
    description?: string;
    teacher_id?: number;
  }) => {
    const response = await fetchWithAuth(`/courses/${courseId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to update course" }));
      throw new Error(error.detail || "Failed to update course");
    }
    return response.json();
  },

  delete: async (courseId: number) => {
    const response = await fetchWithAuth(`/courses/${courseId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to delete course" }));
      throw new Error(error.detail || "Failed to delete course");
    }
    return response.json();
  },

  assignStudent: async (courseId: number, studentId: number) => {
    const response = await fetchWithAuth("/courses/assign-student", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, student_id: studentId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to assign student" }));
      throw new Error(error.detail || "Failed to assign student");
    }
    return response.json();
  },

  assignTeacher: async (courseId: number, teacherId: number) => {
    const response = await fetchWithAuth("/courses/assign-teacher", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, teacher_id: teacherId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to assign teacher" }));
      throw new Error(error.detail || "Failed to assign teacher");
    }
    return response.json();
  },

  getCourseSessions: async (courseId: number) => {
    const response = await fetchWithAuth(`/sessions/course/${courseId}`);
    if (!response.ok) throw new Error("Failed to fetch sessions");
    return response.json();
  },

  getCourseStudents: async (courseId: number) => {
    const response = await fetchWithAuth(`/courses/${courseId}/students`);
    if (!response.ok) throw new Error("Failed to fetch course students");
    return response.json();
  },

  removeStudent: async (courseId: number, studentId: number) => {
    const response = await fetchWithAuth("/courses/remove-student", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, student_id: studentId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to remove student" }));
      throw new Error(error.detail || "Failed to remove student");
    }
    return response.json();
  },
};

// Sessions API
export const sessionsApi = {
  get: async (sessionId: number) => {
    const response = await fetchWithAuth(`/sessions/${sessionId}`);
    if (!response.ok) throw new Error("Failed to fetch session");
    return response.json();
  },

  start: async (courseId: number) => {
    const response = await fetchWithAuth("/sessions/start", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to start session" }));
      throw new Error(error.detail || "Failed to start session");
    }
    return response.json();
  },

  end: async (sessionId: number) => {
    const response = await fetchWithAuth(`/sessions/end?session_id=${sessionId}`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to end session" }));
      throw new Error(error.detail || "Failed to end session");
    }
    return response.json();
  },

  submit: async (sessionId: number) => {
    const response = await fetchWithAuth(`/sessions/submit?session_id=${sessionId}`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to submit session" }));
      throw new Error(error.detail || "Failed to submit session");
    }
    return response.json();
  },

  delete: async (sessionId: number) => {
    const response = await fetchWithAuth(`/sessions/${sessionId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to delete session" }));
      throw new Error(error.detail || "Failed to delete session");
    }
    return response.json();
  },

  getCourseSessions: async (courseId: number) => {
    const response = await fetchWithAuth(`/sessions/course/${courseId}`);
    if (!response.ok) throw new Error("Failed to fetch sessions");
    return response.json();
  },
};

// Attendance API
export const attendanceApi = {
  mark: async (sessionId: number, file: Blob | File) => {
    const formData = new FormData();
    formData.append("session_id", String(sessionId));
    formData.append("file", file);

    const token = getToken();
    const response = await fetch(`${BASE_URL}/attendance/mark`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to mark attendance" }));
      throw new Error(error.detail || "Failed to mark attendance");
    }
    return response.json();
  },

  getSessionAttendance: async (sessionId: number) => {
    const response = await fetchWithAuth(`/attendance/session/${sessionId}`);
    if (!response.ok) throw new Error("Failed to fetch attendance");
    return response.json();
  },

  getStudentAttendance: async (studentId: number) => {
    const response = await fetchWithAuth(`/attendance/student/${studentId}`);
    if (!response.ok) throw new Error("Failed to fetch student attendance");
    return response.json();
  },

  edit: async (attendanceId: number, status: string) => {
    const response = await fetchWithAuth("/attendance/edit", {
      method: "PUT",
      body: JSON.stringify({ attendance_id: attendanceId, status }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to edit attendance" }));
      throw new Error(error.detail || "Failed to edit attendance");
    }
    return response.json();
  },

  retake: async (sessionId: number) => {
    const response = await fetchWithAuth("/attendance/retake", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to retake attendance" }));
      throw new Error(error.detail || "Failed to retake attendance");
    }
    return response.json();
  },

  createManual: async (sessionId: number, studentId: number, status: string) => {
    const formData = new FormData();
    formData.append("session_id", String(sessionId));
    formData.append("student_id", String(studentId));
    formData.append("status", status);

    const token = getToken();
    const response = await fetch(`${BASE_URL}/attendance/manual`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Failed to create manual attendance" }));
      throw new Error(error.detail || "Failed to create manual attendance");
    }
    return response.json();
  },

  getAll: async () => {
    const response = await fetchWithAuth("/attendance/all");
    if (!response.ok) throw new Error("Failed to fetch all attendance records");
    return response.json();
  },
};

// Helper function for error handling
export const handleApiError = (error: any): string => {
  if (error?.message) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
};
