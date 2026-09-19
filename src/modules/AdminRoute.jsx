import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function AdminRoute() {
  const { isAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="route-loading" role="status">Loading your account…</div>;
  return isAdmin ? <Outlet /> : <Navigate to="/admin/login" replace state={{ from: location }} />;
}
