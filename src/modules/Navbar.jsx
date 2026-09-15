import { Link, NavLink } from "react-router-dom";
import { useAuth } from "./useAuth";
import "../styles/Navbar.css";

export default function Navbar() {
  const { isAuthenticated, isAdmin } = useAuth();
  const destination = isAdmin ? "/admin/dashboard" : "/dashboard";
  return (
    <header className="site-header">
      <nav className="site-nav container">
        <Link className="brand" to="/">Borrow<span>Hub</span></Link>
        <div className="nav-links">
          <NavLink to="/">Home</NavLink>
          {isAuthenticated ? <Link className="btn btn-sm btn-primary" to={destination}>Dashboard</Link> : <>
            <NavLink to="/login">Sign in</NavLink>
            <Link className="btn btn-sm btn-primary" to="/register">Create account</Link>
          </>}
        </div>
      </nav>
    </header>
  );
}
