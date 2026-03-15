"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AIUGCVideoEditor } from "@/components/create/ai-ugc-video-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Loader2 } from "lucide-react";
import { subscriptionApi } from "@/lib/api/subscription";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function AIUGCEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const { user, loading: authLoading } = useAuthStore();
  const [tierAllowed, setTierAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading || !user?.id) {
      if (!authLoading && !user?.id) setTierAllowed(false);
      return;
    }
    subscriptionApi.getSubscriptionInfo().then((res) => {
      setTierAllowed(res.subscription.tier === "premium");
    }).catch(() => setTierAllowed(false));
  }, [user?.id, authLoading]);

  if (tierAllowed === null || authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tierAllowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Crown className="h-5 w-5" />
              Premium feature
            </CardTitle>
            <CardDescription>
              AI UGC video creation is available on the Premium plan. Upgrade to unlock the full editor, scenes, and AI-powered UGC tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => {
                if (user?.email) {
                  const redirectUrl = `${window.location.origin}/app/payment/success`;
                  window.location.href = `https://paystack.shop/pay/noface-premium?email=${encodeURIComponent(user.email)}&callback_url=${encodeURIComponent(redirectUrl)}`;
                } else {
                  router.push("/app/settings");
                }
              }}
            >
              <Crown className="mr-2 h-4 w-4" />
              Upgrade to Premium ($60/mo)
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push("/app/create")}>
              Back to Create
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AIUGCVideoEditor projectId={projectId || undefined} />;
}

