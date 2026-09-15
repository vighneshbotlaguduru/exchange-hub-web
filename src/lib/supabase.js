import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://ocbczjqrnadrrhjpsqbr.supabase.co";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jYmN6anFybmFkcnJoanBzcWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MTkxMTgsImV4cCI6MjEwMjI5NTExOH0.jpM_tobG8uvNzKJdToy_o_uV8mZ98RhfhyJNzE5D9I4";

// Keeping startup safe makes the UI buildable before a Supabase project is configured.
export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.");
  return supabase;
}
