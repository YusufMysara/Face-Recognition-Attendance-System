import { Link, Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import AdminDashboard from "./pages/AdminDashboard";
import LoginPage from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";

const App = () => {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header style={{ padding: "1rem", display: "flex", justifyContent: "space-between" }}>
        <h1>Face Recognition Attendance</h1>
        <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          {user && (
            <>
              <Link to={`/${user.role}`}>Dashboard</Link>
              <button onClick={logout}>Logout</button>
            </>
          )}
        </nav>
      </header>

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route element={<ProtectedRoute roles={["teacher"]} />}>
          <Route path="/teacher" element={<TeacherDashboard />} />
        </Route>

        <Route element={<ProtectedRoute roles={["student"]} />}>
          <Route path="/student" element={<StudentDashboard />} />
        </Route>

        <Route
          path="/"
          element={
            user ? (
              <Navigate to={`/${user.role}`} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </div>
  );
};

export default App;

