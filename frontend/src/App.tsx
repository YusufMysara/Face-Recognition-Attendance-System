import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Public pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageUsers from "./pages/admin/ManageUsers";
import ManageCourses from "./pages/admin/ManageCourses";
import AdminCourseDetails from "./pages/admin/CourseDetails";
import UploadPhotos from "./pages/admin/UploadPhotos";
import AttendanceRecords from "./pages/admin/AttendanceRecords";

// Teacher pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import Courses from "./pages/teacher/Courses";
import TeacherCourseDetails from "./pages/teacher/CourseDetails";
import LiveCamera from "./pages/teacher/LiveCamera";
import SessionReview from "./pages/teacher/SessionReview";
import SessionDetails from "./pages/teacher/SessionDetails";
import AttendanceLog from "./pages/teacher/AttendanceLog";
import Reports from "./pages/teacher/Reports";

// Student pages
import StudentDashboard from "./pages/student/StudentDashboard";
import AttendanceStats from "./pages/student/AttendanceStats";
import AttendanceHistory from "./pages/student/AttendanceHistory";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <DashboardLayout role="admin">
                    <AdminDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <DashboardLayout role="admin">
                    <ManageUsers />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <DashboardLayout role="admin">
                    <ManageCourses />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/course/:courseId"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <DashboardLayout role="admin">
                    <AdminCourseDetails />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/upload-photos"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <DashboardLayout role="admin">
                    <UploadPhotos />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/attendance"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <DashboardLayout role="admin">
                    <AttendanceRecords />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Teacher Routes */}
            <Route
              path="/teacher/dashboard"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <TeacherDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/courses"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <Courses />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/course/:courseId"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <TeacherCourseDetails />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/camera"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <LiveCamera />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/session/:sessionId/review"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <SessionReview />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/session/:sessionId"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <SessionDetails />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/attendance-log"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <AttendanceLog />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/reports"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <DashboardLayout role="teacher">
                    <Reports />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Student Routes */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute roles={["student"]}>
                  <DashboardLayout role="student">
                    <StudentDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/stats"
              element={
                <ProtectedRoute roles={["student"]}>
                  <DashboardLayout role="student">
                    <AttendanceStats />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/history"
              element={
                <ProtectedRoute roles={["student"]}>
                  <DashboardLayout role="student">
                    <AttendanceHistory />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />

            {/* Redirects */}
            <Route
              path="/admin"
              element={<Navigate to="/admin/dashboard" replace />}
            />
            <Route
              path="/teacher"
              element={<Navigate to="/teacher/dashboard" replace />}
            />
            <Route
              path="/student"
              element={<Navigate to="/student/dashboard" replace />}
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
