import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import { supabase } from "../lib/supabase";
import { logout as signOut } from "../services/authService";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);
  const user = useMemo(() => session?.user ? { id: session.user.id, name: session.user.user_metadata.full_name || session.user.email, email: session.user.email, role: session.user.app_metadata.role || "user" } : null, [session]);
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), isAdmin: user?.role === "admin", loading, logout: signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
