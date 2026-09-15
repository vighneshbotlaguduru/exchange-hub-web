import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { completeLogin, startLogin } from "../services/authService";
import "../styles/Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) return;
    setError("");
    setVerifying(true);
    try {
      await completeLogin({ email, code: otpCode.trim() });
      navigate(_from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  // Preserve the intended destination so the user can navigate there after clicking the link
  const _from = location.state?.from?.pathname || "/dashboard";

  return (
    <section className="auth-page">
      <div className="auth-form">
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in to borrow</h1>

        {!sent ? (
          <form onSubmit={sendLink} noValidate>
            <p className="form-intro">
              Enter your SRMIST email address and we will send you a secure
              sign-in link & verification code.
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
          </form>
        ) : (
          <div className="auth-success">
            <span className="auth-success-icon" aria-hidden="true">📬</span>
            <h2 className="auth-success-title">Check your email</h2>
            <p className="auth-success-body">
              We sent a sign-in link & 6-digit code to <strong>{email}</strong>.
            </p>

            {error && <div className="alert alert-danger w-100 mt-2" role="alert">{error}</div>}

            {/* Direct OTP input for mobile users where link doesn't redirect */}
            <form className="otp-verification-box" onSubmit={handleVerifyOtp}>
              <p className="otp-title">Or enter the verification code:</p>
              <div className="otp-input-group">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="Enter 6-digit code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  disabled={verifying}
                  className="otp-input"
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn btn-success otp-btn"
                  disabled={verifying || !otpCode.trim()}
                >
                  {verifying ? "Verifying..." : "Verify & Sign in"}
                </button>
              </div>
            </form>

            <p className="auth-success-hint">
              Didn't receive it?{" "}
              <button
                type="button"
                className="btn btn-link p-0 auth-resend-btn"
                onClick={resend}
                disabled={sending}
              >
                {sending ? "Resending..." : "Resend code"}
              </button>{" "}
              or check spam.
            </p>

            <button
              type="button"
              className="btn btn-outline-secondary w-100 mt-2"
              onClick={() => { setSent(false); setError(""); setOtpCode(""); }}
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
      </div>
    </section>
  );
}
