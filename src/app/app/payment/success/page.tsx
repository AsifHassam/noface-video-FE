"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Crown, Loader2, XCircle, Clock } from "lucide-react";
import { subscriptionApi } from "@/lib/api/subscription";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { config } from "@/lib/config";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);

  useEffect(() => {
    // Require user to be logged in
    if (!user) {
      // Try to initialize auth first
      const { user: currentUser } = useAuthStore.getState();
      if (!currentUser) {
        router.push("/");
        return;
      }
    }

    // Get reference from URL parameters
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');
    const status = searchParams.get('status');
    
    // Use either reference or trxref (Paystack uses both)
    const transactionReference = reference || trxref;

    if (status === 'success' || transactionReference) {
      // Payment was successful or we have a reference, verify payment
      verifyPayment(transactionReference);
    } else {
      // Payment failed or cancelled
      setVerificationError("No payment reference found. Please try again.");
      setLoading(false);
    }
  }, [searchParams, router, user]);

  const verifyPayment = async (transactionReference: string | null) => {
    if (!transactionReference) {
      setVerificationError("No transaction reference found. Please try again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Try to get or refresh the session
      let { data: { session } } = await supabase.auth.getSession();
      
      // If no session, try to refresh it
      if (!session) {
        try {
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          session = refreshedSession;
        } catch (refreshError) {
          console.warn('Failed to refresh session:', refreshError);
        }
      }
      
      const userToken = session?.access_token;

      // Call backend verification endpoint
      // Backend can work without auth token (identifies user by email from Paystack)
      const verificationUrl = `${config.remotionServerUrl}/api/subscription/verify-payment`;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      // Add auth token if available (optional - backend can work without it)
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }

      const response = await fetch(verificationUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reference: transactionReference })
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Payment verification failed: ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
          
          // If it's an auth error, provide helpful message
          if (errorJson.code === 'AUTH_REQUIRED' || errorJson.code === 'USER_NOT_FOUND') {
            errorMessage = errorJson.suggestion || errorMessage;
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const verificationResult = await response.json();

      if (verificationResult.success) {
        setPaymentVerified(true);
        setEmailVerified(verificationResult.email_verified || true);

        toast.success("Payment Verified! Your subscription is now active.");

        // Refresh subscription info
        try {
          await subscriptionApi.getSubscriptionInfo();
        } catch (err) {
          // Silently fail - subscription was updated anyway
        }

        // Redirect to dashboard after a delay
        setTimeout(() => {
          router.push("/app/dashboard");
        }, 3000);
      } else {
        setVerificationError(verificationResult.error || "Payment verification failed");
        toast.error(verificationResult.error || "Payment verification failed");
      }
    } catch (err: any) {
      console.error("Payment verification error:", err);
      const errorMessage = err?.message || "Failed to verify payment. Please contact support.";
      setVerificationError(errorMessage);
      
      // If it's an auth-related error, show specific message
      if (errorMessage.includes('sign in') || errorMessage.includes('session')) {
        toast.error(errorMessage, {
          duration: 5000,
          action: {
            label: "Sign In",
            onClick: () => router.push("/")
          }
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Verifying your payment...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show verification pending state (shouldn't happen, but just in case)
  if (!paymentVerified && !verificationError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-6 w-6 text-yellow-500" />
              <CardTitle>Payment Verification Pending</CardTitle>
            </div>
            <CardDescription>
              We're verifying your payment with Paystack...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state
  if (verificationError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Payment Verification Failed
            </CardTitle>
            <CardDescription>
              We couldn't verify your payment automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {verificationError}
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1">
                <Link href="/app/dashboard">Go to Dashboard</Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="mailto:support@noface.video">Contact Support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success state only after verification
  if (paymentVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Payment Successful!
                </CardTitle>
                <CardDescription className="mt-1">
                  Welcome to Pro Plan
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Email Verification Status */}
            <div className={`rounded-lg p-4 text-sm ${
              emailVerified 
                ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300'
                : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {emailVerified ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="font-medium">
                  {emailVerified ? "Email Verified" : "Email Mismatch Detected"}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
              <p className="font-medium">Your subscription is now active!</p>
              <p className="mt-1 text-xs">
                You can now create up to 3 videos per week. Redirecting to dashboard...
              </p>
            </div>
            <Button asChild className="w-full">
              <Link href="/app/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

