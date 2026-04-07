"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    const redirectOnce = (to: "/app/dashboard" | "/") => {
      if (redirected.current) return;
      redirected.current = true;
      router.replace(to);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        redirectOnce(session?.user ? "/app/dashboard" : "/");
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        redirectOnce("/app/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

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
