import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
const ProtectedRoute = ({ roles }) => {
    const { user } = useAuth();
    if (!user) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    if (roles && !roles.includes(user.role)) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    return _jsx(Outlet, {});
};
export default ProtectedRoute;
