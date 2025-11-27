import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

interface Props {
  roles?: Array<"admin" | "teacher" | "student">;
}

const ProtectedRoute = ({ roles }: Props) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;

