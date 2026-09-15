import { requireSupabase } from "../lib/supabase";

const srmistEmailPattern = /^[^\s@]+@srmist\.edu\.in$/i;

const message = (error) => { throw new Error(error?.message || "Something went wrong. Please try again."); };

export async function startRegistration({ name, email }) {
  if (!name.trim()) throw new Error("Please enter your name.");
  if (!srmistEmailPattern.test(email.trim())) throw new Error("Please use your SRMIST email address ending in @srmist.edu.in.");
  const { error } = await requireSupabase().auth.signInWithOtp({ email: email.trim(), options: { data: { full_name: name.trim() }, shouldCreateUser: true } });
  if (error) message(error);
}

export async function completeRegistration({ email, code }) { return verify(email, code); }

export async function startLogin({ email }) {
  if (!srmistEmailPattern.test(email.trim())) throw new Error("Please use your SRMIST email address.");
  const { error } = await requireSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
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
