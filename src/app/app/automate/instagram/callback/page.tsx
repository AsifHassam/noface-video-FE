"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCachedToken, refreshToken } from "@/lib/utils/token-cache";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState("Connecting Instagram…");

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const err = searchParams.get("error");

      if (err) {
        toast.error(`Instagram OAuth: ${searchParams.get("error_description") || err}`);
        router.replace("/app/automate");
        return;
      }

      const saved = sessionStorage.getItem("ig_oauth_state");
      if (state && saved && state !== saved) {
        toast.error("Invalid OAuth state. Try again.");
        router.replace("/app/automate");
        return;
      }
      sessionStorage.removeItem("ig_oauth_state");

      if (!code) {
        toast.error("Missing authorization code");
        router.replace("/app/automate");
        return;
      }

      // Avoid hanging on getSession() here; token-cache reads localStorage first.
      // Instagram callback should complete quickly even if Supabase auth APIs are slow.
      const token =
        (await Promise.race([
          getCachedToken(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ])) || (await refreshToken());

      if (!token) {
        toast.error("Please sign in first");
        router.replace("/app/automate");
        return;
      }

      setMsg("Exchanging Instagram token…");
      const res = await fetch("/api/auth/instagram/exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Connection failed");
        toast.error(json.error || "Connection failed");
        setTimeout(() => router.replace("/app/automate"), 2500);
        return;
      }

      toast.success("Instagram connected");
      router.replace("/app/automate");
    };

    run().catch((e) => {
      console.error(e);
      setMsg(e instanceof Error ? e.message : "Error");
      toast.error("Something went wrong");
      setTimeout(() => router.replace("/app/automate"), 2000);
    });
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">{msg}</p>
    </div>
  );
}

export default function InstagramCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
