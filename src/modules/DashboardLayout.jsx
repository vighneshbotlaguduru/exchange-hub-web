import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import "../styles/DashboardLayout.css";

export default function DashboardLayout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/"); };

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand-box">
          <Link className="brand" to="/">
            Borrow<span className="brand-dot">Hub</span>
          </Link>
          <span className="campus-tag">SRMIST</span>
        </div>

        <div className="sidebar-nav-section">
          <p className="sidebar-label">{isAdmin ? "Admin Controls" : "Main Navigation"}</p>
          <Link className="sidebar-link active" to={isAdmin ? "/admin/dashboard" : "/dashboard"}>
            <span className="nav-icon">📦</span>
            <span>{isAdmin ? "Admin Console" : "Borrow Catalog"}</span>
          </Link>
        </div>

        <div className="sidebar-user-footer">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <span className="user-name">{user?.name || "Member"}</span>
            <span className="user-email">{user?.email || ""}</span>
          </div>
          <button className="sidebar-logout" onClick={handleLogout} title="Sign out">
            <span>🚪</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="mobile-app-bar">
          <div className="mobile-brand-box">
            <Link className="brand" to="/">Borrow<span>Hub</span></Link>
            <span className="campus-pill">SRMIST</span>
          </div>
          <div className="mobile-user-actions">
            <div className="mobile-user-avatar" title={user?.email}>{initials}</div>
            <button className="btn-mobile-logout" onClick={handleLogout}>Sign out</button>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
