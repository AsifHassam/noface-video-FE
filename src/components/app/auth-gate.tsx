"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

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
