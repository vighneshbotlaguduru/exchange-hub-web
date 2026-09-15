import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import "../styles/DashboardLayout.css";

export default function DashboardLayout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/"); };
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand" to="/">Borrow<span>Hub</span></Link>
        <p className="sidebar-label">{isAdmin ? "Administration" : "Workspace"}</p>
        <Link to={isAdmin ? "/admin/dashboard" : "/dashboard"}>Overview</Link>
        <button className="sidebar-logout" onClick={handleLogout}>Sign out</button>
      </aside>
      <main className="dashboard-main">
        <div className="account-bar"><span>{user?.name}</span><small>{user?.email}</small></div>
        <Outlet />
      </main>
    </div>
  );
}
