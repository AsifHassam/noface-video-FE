"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { supabase } from "@/lib/supabase";
import { clearCachedToken } from "@/lib/utils/token-cache";

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { user, loading, initialize } = useAuthStore();

  // Initialize auth if not already initialized (redundant but safe -
  // main initialization happens in Providers, this is a fallback)
  useEffect(() => {
    if (loading) {
      initialize();
    }
  }, [initialize, loading]);

  // When user returns to the tab after idle, refresh session so tokens don't stay expired.
  // This prevents "buttons/features don't work until refresh" after ~5 min idle.
  useEffect(() => {
    const handleVisible = async () => {
      if (document.visibilityState !== "visible" || !user?.id) return;
      try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (!error && session?.access_token) {
          clearCachedToken(user.id);
        }
      } catch {
        // Ignore; next API call will still try 401 → refresh
      }
    };

    document.addEventListener("visibilitychange", handleVisible);
    return () => document.removeEventListener("visibilitychange", handleVisible);
  }, [user?.id]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Preparing your workspace…</p>
      </div>
    );
  }

  return <>{children}</>;
};
