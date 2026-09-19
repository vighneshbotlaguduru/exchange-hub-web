import { useEffect, useMemo, useState } from "react";
import { AuthContext } from "./authContext";
import { supabase } from "../lib/supabase";
import { logout as signOut } from "../services/authService";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); setLoading(false); });

    // Handle deep link app opening on native Android
    let capListener;
    if (Capacitor.isNativePlatform()) {
      capListener = CapApp.addListener("appUrlOpen", async ({ url }) => {
        try {
          if (!url) return;
          // Check for hash parameters (#access_token=...)
          const hashIndex = url.indexOf("#");
          if (hashIndex !== -1) {
            const hash = url.substring(hashIndex + 1);
            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              const { data } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (data?.session) setSession(data.session);
            }
          }
          // Check for query code (?code=...)
          const queryIndex = url.indexOf("?");
          if (queryIndex !== -1) {
            const query = url.substring(queryIndex + 1);
            const params = new URLSearchParams(query);
            const code = params.get("code");
            if (code) {
              const { data } = await supabase.auth.exchangeCodeForSession(code);
              if (data?.session) setSession(data.session);
            }
          }
        } catch (err) {
          console.error("Deep link auth error:", err);
        }
      });
    }

    return () => {
      listener.subscription.unsubscribe();
      if (capListener && typeof capListener.then === "function") {
        capListener.then((sub) => sub.remove());
      }
    };
  }, []);

  const user = useMemo(() => session?.user ? { id: session.user.id, name: session.user.user_metadata.full_name || session.user.email, email: session.user.email, role: session.user.app_metadata.role || "user" } : null, [session]);
  const value = useMemo(() => ({ user, isAuthenticated: Boolean(user), isAdmin: user?.role === "admin", loading, logout: signOut }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
