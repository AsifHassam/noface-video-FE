"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  applySessionFromUrl,
  readSessionFromStorage,
} from "@/lib/auth-rest";
import { clearCachedToken } from "@/lib/utils/token-cache";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function AuthCallbackPage() {
  const redirected = useRef(false);

  useEffect(() => {
    const redirectOnce = (to: "/app/dashboard" | "/") => {
      if (redirected.current) return;
      redirected.current = true;
      // Use a document navigation here rather than Next router.replace().
      // This page is entered from an external Supabase verification URL and
      // may race with the global Providers auth initialization. A hard replace
      // guarantees the address bar leaves /auth/callback and the next page
      // boots with the freshly persisted impersonated session.
      window.location.replace(to);
    };

    (async () => {
      try {
        // 1. If a previous user's token is cached anywhere in memory, drop it
        //    so we don't accidentally send the old Bearer on the next request.
        try { clearCachedToken(); } catch { /* ignore */ }

        // 2. Consume `#access_token=…` (magic link / impersonate) or `?code=…`
        //    (PKCE) from the URL. This writes the NEW session to localStorage,
        //    overwriting any existing (admin) session. `detectSessionInUrl`
        //    on the supabase-js client normally handles this, but our custom
        //    REST helper is the source of truth for the app's auth-store, so
        //    we call its twin explicitly here.
        const urlSession = await applySessionFromUrl();
        if (urlSession?.access_token) {
          console.log("[auth/callback] Session applied from URL");
        }

        // 3. Ensure the in-memory auth store reflects the new session before
        //    we navigate, so /app/dashboard's gate sees the user immediately.
        try {
          await useAuthStore.getState().initialize();
        } catch (e) {
          console.warn("[auth/callback] auth-store initialize failed:", e);
        }

        // 4. Decide where to go.
        const stored = readSessionFromStorage();
        if (stored?.access_token || urlSession?.access_token) {
          redirectOnce("/app/dashboard");
          return;
        }

        // Fall back to supabase-js in case detectSessionInUrl beat us to it.
        const { data } = await supabase.auth.getSession();
        redirectOnce(data.session?.user ? "/app/dashboard" : "/");
      } catch (err) {
        console.error("[auth/callback] Failed to complete sign-in:", err);
        redirectOnce("/");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-lg font-medium">Signing you in...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Please wait while we complete your authentication.
        </p>
      </div>
    </div>
  );
}
