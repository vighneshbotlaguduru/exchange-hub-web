import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function AdminRoute() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  return isAdmin ? <Outlet /> : <Navigate to="/admin/login" replace state={{ from: location }} />;
}
