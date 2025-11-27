import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import AdminDashboard from "./pages/AdminDashboard";
import LoginPage from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
const App = () => {
    const { user, logout } = useAuth();
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { style: { padding: "1rem", display: "flex", justifyContent: "space-between" }, children: [_jsx("h1", { children: "Face Recognition Attendance" }), _jsx("nav", { style: { display: "flex", gap: "1rem", alignItems: "center" }, children: user && (_jsxs(_Fragment, { children: [_jsx(Link, { to: `/${user.role}`, children: "Dashboard" }), _jsx("button", { onClick: logout, children: "Logout" })] })) })] }), _jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { element: _jsx(ProtectedRoute, { roles: ["admin"] }), children: _jsx(Route, { path: "/admin", element: _jsx(AdminDashboard, {}) }) }), _jsx(Route, { element: _jsx(ProtectedRoute, { roles: ["teacher"] }), children: _jsx(Route, { path: "/teacher", element: _jsx(TeacherDashboard, {}) }) }), _jsx(Route, { element: _jsx(ProtectedRoute, { roles: ["student"] }), children: _jsx(Route, { path: "/student", element: _jsx(StudentDashboard, {}) }) }), _jsx(Route, { path: "/", element: user ? (_jsx(Navigate, { to: `/${user.role}`, replace: true })) : (_jsx(Navigate, { to: "/login", replace: true })) })] })] }));
};
export default App;
