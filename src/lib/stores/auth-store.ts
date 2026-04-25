"use client";

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  applySessionFromUrl,
  persistAndSyncSession,
  readSessionFromStorage,
  refreshSessionIfStale,
  signInWithOtpRest,
  signInWithPasswordRest,
  signUpRest,
  resetPasswordForEmailRest,
  updateUserPasswordRest,
  signOutRest,
} from "@/lib/auth-rest";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null }>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
};

let authListenerInitialized = false;
const SESSION_INIT_TIMEOUT_MS = 10000;

function getUserFromPersistedToken(): AuthUser | null {
  try {
    if (typeof window === "undefined") return null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const projectRef = supabaseUrl?.split(".")[0]?.split("//")[1];
    if (!projectRef) return null;
    const raw = window.localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token;
    if (!token || typeof token !== "string") return null;
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    const id = payload?.sub || payload?.user_id;
    const email = payload?.email || "";
    if (!id) return null;
    return { id: String(id), email: String(email) };
  } catch {
    return null;
  }
}

async function resolveInitialSession(): Promise<Session | null> {
  return await Promise.race([
    (async () => {
      const session = await refreshSessionIfStale();
      if (!session?.access_token) return null;
      await persistAndSyncSession(session);
      return session;
    })(),
    new Promise<Session | null>((_, reject) =>
      setTimeout(() => reject(new Error("auth_session_timeout")), SESSION_INIT_TIMEOUT_MS)
    ),
  ]);
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  loading: true,

  async initialize() {
    // Prevent multiple initializations
    if (authListenerInitialized && !get().loading) {
      return;
    }

    try {
      // If the URL carries a fresh auth payload (magic-link `#access_token=...`
      // or PKCE `?code=...`) consume it FIRST so it overwrites any existing
      // session in localStorage. Without this, admin impersonate links land on
      // the page with `#access_token=...` but the auth store keeps reading the
      // old (admin) session from storage and the user is never switched.
      try {
        const urlSession = await applySessionFromUrl();
        if (urlSession?.access_token) {
          console.log("[auth] Consumed session from URL hash");
        }
      } catch (urlErr) {
        console.warn("[auth] applySessionFromUrl failed:", urlErr);
      }

      // Get current session
      const session = await resolveInitialSession();

      if (session?.user) {
        // Fetch profile data
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        set({
          user: {
            id: session.user.id,
            email: session.user.email || "",
            name: profile?.name || undefined,
          },
          loading: false,
        });
      } else {
        set({ user: null, loading: false });
      }

    } catch (error) {
      console.error("Error initializing auth:", error);
      // New-tab recovery: if getSession hangs/times out, restore from persisted token
      // so auth-gated routes don't redirect to "/" incorrectly.
      const recoveredUser = getUserFromPersistedToken();
      set({ user: recoveredUser, loading: false });
    }

    // Only set up listener once (must run even if initialization timed out)
    if (!authListenerInitialized) {
      authListenerInitialized = true;
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          set({
            user: {
              id: session.user.id,
              email: session.user.email || "",
              name: profile?.name || undefined,
            },
            loading: false,
          });
        } else {
          set({ user: null, loading: false });
        }
      });
    }
  },

  async signInWithMagicLink(email: string) {
    try {
      return await signInWithOtpRest(
        email.trim().toLowerCase(),
        `${window.location.origin}/auth/callback`
      );
    } catch (error) {
      return { error: error as Error };
    }
  },

  async signInWithPassword(email: string, password: string) {
    try {
      return await signInWithPasswordRest(email.trim().toLowerCase(), password);
    } catch (error) {
      return { error: error as Error };
    }
  },

  async signUpWithPassword(email: string, password: string) {
    try {
      return await signUpRest(
        email.trim().toLowerCase(),
        password,
        `${window.location.origin}/auth/callback`
      );
    } catch (error) {
      return { error: error as Error, needsEmailConfirmation: false };
    }
  },

  async resetPasswordForEmail(email: string) {
    try {
      return await resetPasswordForEmailRest(
        email.trim().toLowerCase(),
        `${window.location.origin}/auth/reset-password`
      );
    } catch (error) {
      return { error: error as Error };
    }
  },

  async updatePassword(newPassword: string) {
    try {
      return await updateUserPasswordRest(newPassword);
    } catch (error) {
      return { error: error as Error };
    }
  },

  async signOut() {
    await signOutRest();
    // Clear token cache on sign out
    try {
      const { clearCachedToken } = await import('@/lib/utils/token-cache');
      clearCachedToken();
    } catch (e) {
      // Ignore if token-cache module not available
    }
    set({ user: null, loading: false });
  },
}));
