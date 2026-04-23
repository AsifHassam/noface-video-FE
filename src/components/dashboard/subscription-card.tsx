"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Video, Calendar, CheckCircle2, XCircle, Coins } from "lucide-react";
import { subscriptionApi, type SubscriptionInfo, type OutstandingItem } from "@/lib/api/subscription";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

export const SubscriptionCard = () => {
  const { user, loading: authLoading } = useAuthStore();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [outstandingList, setOutstandingList] = useState<OutstandingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [payingRowId, setPayingRowId] = useState<string | null>(null);

  const handlePayOutstanding = async (rowId: string) => {
    setPayingRowId(rowId);
    try {
      const result = await subscriptionApi.refreshOutstandingLink(rowId);
      if (result.success && result.paymentLink) {
        window.location.href = result.paymentLink;
        return;
      }
      toast.error(result.error || "Could not start payment. Please try again in a moment.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setPayingRowId(null);
    }
  };

  const handlePayProfileOutstanding = async () => {
    setPayingRowId("profile");
    try {
      const result = await subscriptionApi.refreshOutstandingProfileLink();
      if (result.success && result.paymentLink) {
        window.location.href = result.paymentLink;
        return;
      }
      toast.error(result.error || "Could not start payment. Please try again in a moment.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
    } finally {
      setPayingRowId(null);
    }
  };

  const loadSubscriptionInfo = useCallback(async () => {
    try {
      setLoading(true);
      const [subResult, outResult] = await Promise.all([
        subscriptionApi.getSubscriptionInfo(),
        subscriptionApi.getOutstanding().catch(() => ({ success: true, outstanding: [] })),
      ]);
      setSubscription(subResult.subscription);
      setOutstandingList(outResult.outstanding || []);
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

  const handleCancelSubscription = async () => {
    if (!confirm("Cancel your subscription? You will keep your current credits until the end of the billing period, then move to Free. You can resubscribe anytime.")) {
      return;
    }
    try {
      setUpdating(true);
      const result = await subscriptionApi.cancelSubscription();
      if (result.success) {
        toast.success("Subscription cancelled. You’re now on the Free plan.");
        await loadSubscriptionInfo();
      } else {
        toast.error(result.error || "Failed to cancel subscription");
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast.error("Failed to cancel subscription");
    } finally {
      setUpdating(false);
    }
  };

  const handleUpgradeToPremium = async () => {
    try {
      setUpdating(true);
      const result = await subscriptionApi.upgradeToPremium();
      if (result.success) {
        if (result.alreadyPremium) {
          toast.success("You’re already on Premium.");
        } else {
          toast.success(result.message || "Upgraded to Premium. Your billing day stays the same.");
        }
        await loadSubscriptionInfo();
      } else {
        toast.error(result.error || "Upgrade failed");
      }
    } catch (error) {
      console.error("Error upgrading to Premium:", error);
      toast.error("Failed to upgrade to Premium");
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
        {/* Payment overdue: block access until outstanding is paid (list or single from profile) */}
        {subscription.paymentBlocked && (outstandingList.length > 0 || subscription.outstandingPaymentLink) && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-2">
            <p className="text-sm font-medium text-destructive">
              A recurring payment failed. Your access is paused until the outstanding amount(s) are paid.
            </p>
            {outstandingList.length > 0 ? (
              <ul className="space-y-2">
                {outstandingList.map((item) => (
                  <li key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      ~${Math.round(item.amountCents / 100 / 18)} USD
                      {item.createdAt && (
                        <span className="ml-2 text-xs">({new Date(item.createdAt).toLocaleDateString()})</span>
                      )}
                    </span>
                    <Button
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handlePayOutstanding(item.id)}
                      disabled={payingRowId === item.id}
                    >
                      {payingRowId === item.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Starting…
                        </>
                      ) : (
                        "Pay outstanding amount"
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                {subscription.outstandingAmountCents != null && (
                  <p className="text-xs text-muted-foreground">
                    Amount due: ~${Math.round(subscription.outstandingAmountCents / 100 / 18)} USD
                  </p>
                )}
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handlePayProfileOutstanding}
                  disabled={payingRowId === "profile" || !subscription.outstandingPaymentLink}
                >
                  {payingRowId === "profile" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting…
                    </>
                  ) : (
                    "Pay outstanding amount"
                  )}
                </Button>
              </>
            )}
          </div>
        )}
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
            <>
              {!isPremium && (
                <Button
                  className="w-full border-yellow-500 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20"
                  onClick={handleUpgradeToPremium}
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
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={handleCancelSubscription}
                disabled={updating}
              >
                {updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Cancel subscription"
                )}
              </Button>
            </>
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

