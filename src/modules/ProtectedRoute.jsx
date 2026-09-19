import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function ProtectedRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="route-loading" role="status">Loading your account…</div>;
  if (!isAuthenticated || isAdmin) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
