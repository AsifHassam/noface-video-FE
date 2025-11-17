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
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  loading: true,

  async initialize() {
    try {
      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
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
      });
    } catch (error) {
      console.error("Error initializing auth:", error);
      set({ user: null, loading: false });
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

  async signOut() {
    await supabase.auth.signOut();
    set({ user: null, loading: false });
  },
}));
