"use client";

import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

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

async function getSessionWithTimeout() {
  return await Promise.race([
    supabase.auth.getSession(),
    new Promise((_, reject) =>
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
      // Get current session
      const sessionResp = await getSessionWithTimeout();
      const session = (sessionResp as any)?.data?.session;

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
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async signInWithPassword(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async signUpWithPassword(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        return { error, needsEmailConfirmation: false };
      }
      const needsEmailConfirmation = !data.session;
      return { error: null, needsEmailConfirmation };
    } catch (error) {
      return { error: error as Error, needsEmailConfirmation: false };
    }
  },

  async resetPasswordForEmail(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async updatePassword(newPassword: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async signOut() {
    await supabase.auth.signOut();
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
