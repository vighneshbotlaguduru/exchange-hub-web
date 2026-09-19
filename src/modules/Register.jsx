import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startRegistration } from "../services/authService";
import { useAuth } from "./useAuth";
import "../styles/Register.css";

export default function Register() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({ name: "", email: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorDesc = hashParams.get("error_description");
      const errorCode = hashParams.get("error_code");
      if (errorCode || errorDesc) {
        setError(
          errorDesc?.replace(/\+/g, " ") ||
            "This verification link has expired or was already used. Please request a new link."
        );
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  const sendLink = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await startRegistration(form);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    setError("");
    setSending(true);
    try {
      await startRegistration(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-form">
        <p className="eyebrow">Join BorrowHub</p>
        <h1>Create your account</h1>

        {!sent ? (
          <form onSubmit={sendLink} noValidate>
            <p className="form-intro">
              Create a borrowing account with your SRMIST email. We will send
              you a secure verification link to sign in instantly.
            </p>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <label>
              Your name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                disabled={sending}
                autoComplete="name"
                placeholder="Full name"
              />
            </label>

            <label>
              SRMIST email address
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={sending}
                autoComplete="email"
                placeholder="name@srmist.edu.in"
                pattern="[^\s@]+@srmist\.edu\.in"
                title="Use an email address ending in @srmist.edu.in"
              />
            </label>

            <button
              className="btn btn-primary w-100"
              type="submit"
              disabled={sending}
            >
              {sending ? "Sending link..." : "Send verification link"}
            </button>
          </form>
        ) : (
          <div className="auth-success">
            <span className="auth-success-icon" aria-hidden="true">📬</span>
            <h2 className="auth-success-title">Verify your email</h2>
            <p className="auth-success-body">
              We sent a verification link to <strong>{form.email}</strong>. Open that link
              on your phone or browser to complete sign up.
            </p>

            {error && <div className="alert alert-danger w-100 mt-2" role="alert">{error}</div>}

            <p className="auth-success-hint">
              Didn't receive it?{" "}
              <button
                type="button"
                className="btn btn-link p-0 auth-resend-btn"
                onClick={resend}
                disabled={sending}
              >
                {sending ? "Resending..." : "Resend link"}
              </button>{" "}
              or check spam.
            </p>

            <button
              type="button"
              className="btn btn-outline-secondary w-100 mt-2"
              onClick={() => { setSent(false); setError(""); }}
            >
              Edit details
            </button>
          </div>
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}
