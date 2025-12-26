"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Video, Calendar, CheckCircle2, XCircle, Coins } from "lucide-react";
import { subscriptionApi, type SubscriptionInfo } from "@/lib/api/subscription";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

export const SubscriptionCard = () => {
  const { user, loading: authLoading } = useAuthStore();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      setLoading(true);
      const result = await subscriptionApi.getSubscriptionInfo();
      setSubscription(result.subscription);
    } catch (error: any) {
      console.error("Error loading subscription:", error);
      
      // If it's a database migration issue, show a helpful message
      if (error?.message?.includes('column') || error?.message?.includes('migration')) {
        // Don't show error toast - just use default free tier
        setSubscription({
          tier: 'free',
          canCreateVideo: false,
          credits: 0,
          usage: { total: 0, monthly: 0 },
          limit: null,
          lastResetAt: null
        });
      } else {
        toast.error("Failed to load subscription information");
        // Set default values on error so UI doesn't break
        setSubscription({
          tier: 'free',
          canCreateVideo: false,
          credits: 0,
          usage: { total: 0, monthly: 0 },
          limit: null,
          lastResetAt: null
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait for auth to finish loading before attempting to load subscription
    if (authLoading) {
      return;
    }
    
    // If no user after auth has loaded, stop loading
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    // Load subscription info
    loadSubscriptionInfo();
  }, [user?.id, authLoading, loadSubscriptionInfo]);

  // Add a timeout safeguard to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading && !authLoading) {
        console.warn('Subscription loading timeout - stopping loader');
        setLoading(false);
        // Set default subscription on timeout
        setSubscription({
          tier: 'free',
          canCreateVideo: false,
          credits: 0,
          usage: { total: 0, monthly: 0 },
          limit: null,
          lastResetAt: null
        });
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [loading, authLoading]);

  const handleUpgrade = (tier: 'paid' | 'premium' = 'paid') => {
    if (!user?.email) {
      toast.error("Email address is required for upgrade");
      return;
    }

    // Build Paystack payment URL with user's email and redirect URL
    const redirectUrl = `${window.location.origin}/app/payment/success`;
    // Use different Paystack links for Pro and Premium
    const paystackSlug = tier === 'premium' ? 'noface-premium' : 'noface-pro1';
    const paystackUrl = `https://paystack.shop/pay/${paystackSlug}?email=${encodeURIComponent(user.email)}&callback_url=${encodeURIComponent(redirectUrl)}`;
    
    // Open Paystack in same window (Paystack will redirect back after payment)
    window.location.href = paystackUrl;
  };

  const handleDowngrade = async () => {
    try {
      setUpdating(true);
      await subscriptionApi.updateSubscription('free');
      toast.success("Downgraded to Free plan");
      await loadSubscriptionInfo();
    } catch (error) {
      console.error("Error downgrading:", error);
      toast.error("Failed to downgrade subscription");
    } finally {
      setUpdating(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return null;
  }

  const isPaid = subscription.tier === 'paid' || subscription.tier === 'premium';
  const isPremium = subscription.tier === 'premium';
  const credits = subscription.credits || 0;

  return (
    <Card className={isPaid ? "border-primary bg-gradient-to-br from-primary/5 to-primary/10" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isPremium ? (
                <>
                  <Crown className="h-5 w-5 text-primary" />
                  Premium Plan
                </>
              ) : isPaid ? (
                <>
                  <Crown className="h-5 w-5 text-primary" />
                  Pro Plan
                </>
              ) : (
                "Free Plan"
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Credits-based usage system
            </CardDescription>
          </div>
          <Badge variant={isPaid ? "default" : "secondary"} className="ml-2">
            {subscription.tier.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credits Balance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Credits Balance</span>
            </div>
            <span className="font-semibold text-lg">
              {credits.toFixed(2)}
            </span>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">
              Credit rates:
            </div>
            <div className="text-xs space-y-0.5">
              <div>• Flash speech: 0.2 credits/sec</div>
              <div>• Alpha speech: 0.35 credits/sec</div>
              <div>• Lip sync: 16 credits</div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 text-sm">
          {subscription.canCreateVideo ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">You have enough credits to create videos</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-destructive font-medium">
                Insufficient credits (need at least 0.2 credits)
              </span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="pt-2 space-y-2">
          {isPaid ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleDowngrade}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Downgrade to Free"
              )}
            </Button>
          ) : (
            <>
            <Button
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                onClick={() => handleUpgrade('paid')}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade to Pro ($29/mo)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                onClick={() => handleUpgrade('premium')}
              disabled={updating}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Crown className="mr-2 h-4 w-4" />
                    Upgrade to Premium ($60/mo)
                </>
              )}
            </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

