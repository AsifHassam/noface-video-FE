"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { applySessionFromUrl, readSessionFromStorage } from "@/lib/auth-rest";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await applySessionFromUrl();
        const session = readSessionFromStorage();

        if (session?.access_token) {
          router.replace("/app/dashboard");
        } else {
          router.replace("/");
        }
      } catch (error) {
        console.error("Error during auth callback:", error);
        router.replace("/");
      }
    };

    handleCallback();
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
