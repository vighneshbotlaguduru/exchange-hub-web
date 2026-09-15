import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { startLogin } from "../services/authService";
import "../styles/Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();

  const sendLink = async (e) => {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      await startLogin({ email });
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
      await startLogin({ email });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  // Preserve the intended destination so the user can navigate there after clicking the link
  const _from = location.state?.from?.pathname || "/dashboard";

  return (
    <section className="auth-page">
      <form className="auth-form" onSubmit={sendLink} noValidate>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to borrow</h1>

        {!sent ? (
          <>
            <p className="form-intro">
              Enter your SRMIST email address and we will send you a secure
              sign-in link — no password needed.
            </p>

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <label>
              SRMIST email address
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@srmist.edu.in"
                pattern="[^\s@]+@srmist\.edu\.in"
                title="Use an email address ending in @srmist.edu.in"
                disabled={sending}
              />
            </label>

            <button
              className="btn btn-primary w-100"
              type="submit"
              disabled={sending}
            >
              {sending ? "Sending link..." : "Send sign-in link"}
            </button>
          </>
        ) : (
          <div className="auth-success">
            <span className="auth-success-icon" aria-hidden="true">📬</span>
            <h2 className="auth-success-title">Check your email</h2>
            <p className="auth-success-body">
              We sent a sign-in link to <strong>{email}</strong>.
              Click the link in the email to sign in to BorrowHub.
            </p>
            <p className="auth-success-hint">
              The link expires shortly. Didn't receive it?{" "}
              <button
                type="button"
                className="btn btn-link p-0 auth-resend-btn"
                onClick={resend}
                disabled={sending}
              >
                {sending ? "Resending..." : "Resend link"}
              </button>{" "}
              or check your spam folder.
            </p>

            {error && <div className="alert alert-danger w-100 mt-2" role="alert">{error}</div>}

            <button
              type="button"
              className="btn btn-outline-secondary w-100"
              onClick={() => { setSent(false); setError(""); }}
            >
              Use a different email
            </button>
          </div>
        )}

        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
        <Link className="admin-link" to="/admin/login">
          Administrator sign in
        </Link>
      </form>
    </section>
  );
}
