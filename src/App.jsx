import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { AuthProvider } from "./modules/AuthContext.jsx";
import MainLayout from "./modules/MainLayout";
import DashboardLayout from "./modules/DashboardLayout";
import ProtectedRoute from "./modules/ProtectedRoute";
import AdminRoute from "./modules/AdminRoute";
import Home from "./modules/Home";
import Login from "./modules/Login";
import Register from "./modules/Register";
import UserDashboard from "./modules/UserDashboard";
import AdminLogin from "./modules/AdminLogin";
import AdminDashboard from "./modules/AdminDashboard";
import NotFound from "./modules/NotFound";

function MobileAppBanner() {
  const [show, setShow] = useState(false);
  const [appUrl, setAppUrl] = useState("");
  const [intentUrl, setIntentUrl] = useState("");
  const [isAuthLink, setIsAuthLink] = useState(false);
  const [authDismissed, setAuthDismissed] = useState(false);

  useEffect(() => {
    // Only active in mobile browser (not inside native Capacitor app)
    if (Capacitor.isNativePlatform()) return;

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isMobile) return;

    const isAndroid = /android/i.test(navigator.userAgent);
    const rawPath = window.location.pathname.replace(/^\//, "");
    const rawQuery = window.location.search;
    const rawHash = window.location.hash;

    const scheme = `borrowhub://${rawPath}${rawQuery}${rawHash}`;
    const intent = `intent://${rawPath}${rawQuery}${rawHash}#Intent;scheme=borrowhub;package=com.borrowhub.app;end`;

    setAppUrl(scheme);
    setIntentUrl(isAndroid ? intent : scheme);

    const hasAuthToken = rawHash.includes("access_token") || rawQuery.includes("code=");
    if (hasAuthToken) {
      setIsAuthLink(true);
      // Attempt automatic redirect on mobile
      try {
        window.location.href = isAndroid ? intent : scheme;
      } catch {
        // Redirect blocked by browser policy
      }
    }

    setShow(true);
  }, []);

  if (!show) return null;

  // High-priority full-screen modal when magic link arrives in mobile browser
  if (isAuthLink && !authDismissed) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.96)",
        backdropFilter: "blur(8px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        color: "#ffffff",
        textAlign: "center",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}>
        <div style={{
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "16px",
          padding: "2rem 1.5rem",
          maxWidth: "380px",
          width: "100%",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚡</div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "0.5rem", color: "#f8fafc" }}>
            Sign-in Link Verified!
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: "1.5rem" }}>
            Open BorrowHub app to continue with your authenticated session, or continue in this browser.
          </p>
          <a
            href={intentUrl || appUrl}
            style={{
              display: "block",
              background: "#059669",
              color: "#ffffff",
              padding: "0.85rem 1.25rem",
              borderRadius: "10px",
              fontWeight: "700",
              fontSize: "0.95rem",
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(5, 150, 105, 0.4)",
              marginBottom: "0.75rem",
            }}
          >
            🚀 Open in BorrowHub App
          </a>
          <button
            onClick={() => setAuthDismissed(true)}
            style={{
              background: "transparent",
              border: "1px solid #475569",
              color: "#cbd5e1",
              padding: "0.65rem 1.25rem",
              borderRadius: "10px",
              fontWeight: "600",
              fontSize: "0.82rem",
              width: "100%",
              cursor: "pointer",
            }}
          >
            Continue in Browser
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: "#0f172a",
      color: "#ffffff",
      padding: "0.55rem 1rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: "0.82rem",
      fontWeight: "600",
      position: "sticky",
      top: 0,
      zIndex: 9999,
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span>📱</span>
        <span>Have BorrowHub App installed?</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <a
          href={intentUrl || appUrl}
          style={{
            background: "#059669",
            color: "#ffffff",
            padding: "0.25rem 0.65rem",
            borderRadius: "6px",
            fontSize: "0.78rem",
            fontWeight: "700",
            textDecoration: "none",
          }}
        >
          Open App
        </a>
        <button
          onClick={() => setShow(false)}
          style={{
            background: "transparent",
            border: 0,
            color: "#94a3b8",
            fontSize: "1rem",
            cursor: "pointer",
            padding: "0 0.25rem",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <MobileAppBanner />
      <AuthProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<UserDashboard />} />
            </Route>
          </Route>

          <Route element={<AdminRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
