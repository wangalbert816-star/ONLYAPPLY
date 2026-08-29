import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getAuthRedirectUrl } from "../lib/supabase/authRedirect";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase/client";
import { clearPendingSave } from "../lib/pendingSave";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  signInWithEmail: (email: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const syncSession = async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (!mounted) return;
        setSession((prev) => {
          const next = data.session;
          if (prev?.access_token === next?.access_token && prev?.user?.id === next?.user?.id) return prev;
          return next;
        });
        setUser((prev) => {
          const next = data.session?.user ?? null;
          if (prev?.id === next?.id && prev?.email === next?.email) return prev;
          return next;
        });
      } catch (e) {
        // Never leave the app stuck on the loading screen if getSession rejects.
        if (import.meta.env.DEV) console.warn("[auth] getSession failed:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void syncSession();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession((prev) => {
        if (prev?.access_token === nextSession?.access_token && prev?.user?.id === nextSession?.user?.id) {
          return prev;
        }
        return nextSession;
      });
      setUser((prev) => {
        const next = nextSession?.user ?? null;
        if (prev?.id === next?.id && prev?.email === next?.email) return prev;
        return next;
      });
      setLoading(false);
    });

    const onFocus = () => void syncSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncSession();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith("sb-")) void syncSession();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      subscription.unsubscribe();
    };
  }, [configured]);

  const signInWithEmail = useCallback(async (email: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "auth_not_configured" };
    const trimmed = email.trim();
    if (!trimmed) return { error: "email_required" };

    const { error } = await sb.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: getAuthRedirectUrl(),
      },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) return { error: "auth_not_configured" };
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return { error: "email_required" };
    if (!password) return { error: "password_required" };

    const { error } = await sb.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return { error: "auth_not_configured" };

    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) return { error: error.message };
    return {};
  }, []);

  useEffect(() => {
    if (!session) return;
    const { hash, search } = window.location;
    if (
      hash.includes("access_token") ||
      hash.includes("error=") ||
      search.includes("code=") ||
      search.includes("error=")
    ) {
      window.history.replaceState(null, "", getAuthRedirectUrl());
    }
  }, [session]);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    clearPendingSave();
    await sb.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      configured,
      loading,
      user,
      session,
      signInWithEmail,
      signInWithGoogle,
      signInWithPassword,
      signOut,
    }),
    [configured, loading, user, session, signInWithEmail, signInWithGoogle, signInWithPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
