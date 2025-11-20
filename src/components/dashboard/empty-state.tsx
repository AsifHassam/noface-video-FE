"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscriptionApi } from "@/lib/api/subscription";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

export const EmptyState = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const [canCreateVideo, setCanCreateVideo] = useState(true);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'paid' | null>(null);

  // Check subscription limits
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.id) {
        setCanCreateVideo(true); // Allow if not authenticated (for dev/testing)
        return;
      }
      
      try {
        setCheckingLimit(true);
        const result = await subscriptionApi.getSubscriptionInfo();
        setCanCreateVideo(result.subscription.canCreateVideo);
        setSubscriptionTier(result.subscription.tier);
      } catch (error) {
        console.error("Error checking subscription:", error);
        // On error, allow creation (don't block users)
        setCanCreateVideo(true);
        setSubscriptionTier('free');
      } finally {
        setCheckingLimit(false);
      }
    };

    checkSubscription();
  }, [user?.id]);

  const handleCreateNewVideo = async () => {
    if (!user?.id) {
      // If not authenticated, allow navigation (for dev/testing)
      router.push("/app/create");
      return;
    }

    // Check subscription limit before allowing navigation
    if (checkingLimit) {
      toast.info("Checking subscription limits...");
      return;
    }

    if (!canCreateVideo) {
      try {
        const result = await subscriptionApi.getSubscriptionInfo();
        const { tier, usage, limit } = result.subscription;
        
        if (tier === 'free') {
          toast.error(`You've reached your free plan limit of ${limit} videos.`, {
            description: "Upgrade to Pro to create unlimited videos!",
            action: {
              label: "Upgrade Now",
              onClick: () => {
                if (!user?.email) {
                  toast.error("Email address is required for upgrade");
                  return;
                }
                const redirectUrl = `${window.location.origin}/app/payment/success`;
                const paystackUrl = `https://paystack.shop/pay/up7whihnxl?email=${encodeURIComponent(user.email)}&callback_url=${encodeURIComponent(redirectUrl)}`;
                window.location.href = paystackUrl;
              }
            }
          });
        } else if (tier === 'paid') {
          toast.error(`You've reached your weekly limit of ${limit} videos. Your limit resets on Monday.`);
        } else {
          toast.error("You've reached your video creation limit.");
        }
      } catch (error) {
        toast.error("Failed to check subscription limits. Please try again.");
      }
      return;
    }

    router.push("/app/create");
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-primary/40 bg-white/70 p-12 text-center shadow-inner">
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </span>
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold text-foreground">
          {!canCreateVideo && user ? "You've reached your video limit" : "No videos yet—let&apos;s create one"}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {!canCreateVideo && user 
            ? "Upgrade to Pro to create unlimited videos and unlock premium features!"
            : "Craft a faceless conversation with two characters, add overlays, and simulate a final render."}
        </p>
      </div>
      {!canCreateVideo && user ? (
        subscriptionTier === 'free' ? (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <Button 
              className="h-11 rounded-2xl px-6 text-base"
              onClick={() => {
                if (!user?.email) {
                  toast.error("Email address is required for upgrade");
                  return;
                }
                const redirectUrl = `${window.location.origin}/app/payment/success`;
                const paystackUrl = `https://paystack.shop/pay/up7whihnxl?email=${encodeURIComponent(user.email)}&callback_url=${encodeURIComponent(redirectUrl)}`;
                window.location.href = paystackUrl;
              }}
            >
              Upgrade to Pro
            </Button>
            <Button 
              variant="outline"
              className="h-11 rounded-2xl px-6 text-base"
              onClick={handleCreateNewVideo}
              disabled={checkingLimit}
            >
              {checkingLimit ? "Checking..." : "Try anyway"}
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Your weekly limit resets every Monday. Come back then to create more videos!
            </p>
            <Button 
              variant="outline"
              className="h-11 rounded-2xl px-6 text-base"
              onClick={handleCreateNewVideo}
              disabled={checkingLimit}
            >
              {checkingLimit ? "Checking..." : "Try anyway"}
            </Button>
          </div>
        )
      ) : (
        <Button 
          className="h-11 rounded-2xl px-6 text-base"
          onClick={handleCreateNewVideo}
          disabled={checkingLimit || (!canCreateVideo && !!user?.id)}
        >
          {checkingLimit ? "Checking..." : "Create new video"}
        </Button>
      )}
    </div>
  );
};
