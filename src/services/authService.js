import { requireSupabase } from "../lib/supabase";

const srmistEmailPattern = /^[^\s@]+@srmist\.edu\.in$/i;

const message = (error) => {
  const msg = error?.message || "";
  if (msg.includes("Error sending magic link") || msg.includes("rate limit") || msg.includes("over_email_send_rate_limit")) {
    throw new Error(
      "Supabase email rate limit reached (3 emails/hour on free tier) or SMTP is not configured. Please set up a custom SMTP provider (e.g., Resend, Brevo, or Gmail) in your Supabase Dashboard under Project Settings > Authentication > SMTP."
    );
  }
  if (msg.includes("Signups not allowed for otp") || msg.includes("User not found")) {
    throw new Error("No account found with this email. Please create an account on the Register page first.");
  }
  throw new Error(msg || "Something went wrong. Please try again.");
};

export async function startRegistration({ name, email }) {
  if (!name.trim()) throw new Error("Please enter your name.");
  if (!srmistEmailPattern.test(email.trim())) throw new Error("Please use your SRMIST email address ending in @srmist.edu.in.");
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
  const { error } = await requireSupabase().auth.signInWithOtp({
    email: email.trim(),
    options: {
      data: { full_name: name.trim() },
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) message(error);
}

export async function completeRegistration({ email, code }) { return verify(email, code); }

export async function startLogin({ email }) {
  if (!srmistEmailPattern.test(email.trim())) throw new Error("Please use your SRMIST email address.");
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
  const { error } = await requireSupabase().auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) message(error);
}

export async function completeLogin({ email, code }) { return verify(email, code); }

async function verify(email, code) {
  if (!/^\d{6,8}$/.test(code.trim())) throw new Error("Enter the verification code from your email.");
  const { data, error } = await requireSupabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
  if (error) message(error);
  return data.session;
}

export async function logout() { const { error } = await requireSupabase().auth.signOut(); if (error) message(error); }
export async function loginAdmin({ email, password }) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) message(error);
  if (data.user.app_metadata.role !== "admin") { await requireSupabase().auth.signOut(); throw new Error("This account is not an administrator."); }
  return data.session;
}
