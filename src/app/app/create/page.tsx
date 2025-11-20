"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/create/stepper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, BookOpen } from "lucide-react";
import { subscriptionApi } from "@/lib/api/subscription";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

const steps = [
  { label: "Step 1", description: "Choose video type" },
  { label: "Step 2", description: "Configure characters & script" },
  { label: "Step 3", description: "Preview & render" },
];

const cards = [
  {
    title: "Reddit Story Narration",
    description: "AI voiceover with B-roll and motion captions.",
    icon: BookOpen,
    href: "#",
    disabled: true,
  },
  {
    title: "2 Characters Having a Conversation",
    description: "Pick two characters, write a script, add overlays, and share.",
    icon: MessageCircle,
    href: "/app/create/two-char/characters",
    disabled: false,
  },
  {
    title: "Normal Story Narration",
    description: "Traditional storytelling with one narrator and visual accents.",
    icon: Sparkles,
    href: "/app/create/story/script",
    disabled: false,
  },
];

export default function CreatePage() {
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

  const handleCardClick = async (card: typeof cards[0]) => {
    if (card.disabled) {
      return;
    }

    if (!user?.id) {
      // If not authenticated, allow navigation (for dev/testing)
      router.push(card.href);
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

    router.push(card.href);
  };

  return (
    <div className="flex h-full flex-col gap-8">
      <Stepper steps={steps} activeIndex={0} />
      
      {/* Upgrade Prompt when limit reached (only for free tier) */}
      {user && !canCreateVideo && !checkingLimit && subscriptionTier === 'free' && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                You've reached your video limit
              </h3>
              <p className="text-sm text-muted-foreground">
                Upgrade to Pro to create unlimited videos and unlock premium features!
              </p>
            </div>
            <Button
              onClick={() => {
                if (!user?.email) {
                  toast.error("Email address is required for upgrade");
                  return;
                }
                const redirectUrl = `${window.location.origin}/app/payment/success`;
                const paystackUrl = `https://paystack.shop/pay/up7whihnxl?email=${encodeURIComponent(user.email)}&callback_url=${encodeURIComponent(redirectUrl)}`;
                window.location.href = paystackUrl;
              }}
              className="rounded-2xl whitespace-nowrap"
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>
      )}
      
      {/* Limit reached message for paid tier (no upgrade option) */}
      {user && !canCreateVideo && !checkingLimit && subscriptionTier === 'paid' && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">
                You've reached your weekly video limit
              </h3>
              <p className="text-sm text-muted-foreground">
                Your limit of 3 videos per week resets every Monday. Come back then to create more videos!
              </p>
            </div>
          </div>
        </div>
      )}
      
      <section className="grid gap-6 md:grid-cols-3">
        {cards.map((card) => {
          const isDisabled = card.disabled || (checkingLimit || (!canCreateVideo && !!user?.id));
          
          const content = (
            <Card className={`group h-full rounded-3xl border-none bg-white/70 p-6 shadow-lg shadow-primary/5 transition ${
              isDisabled ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-1 hover:shadow-xl cursor-pointer'
            }`}>
              <CardHeader className="space-y-6 p-0">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <card.icon className="h-6 w-6" />
                </span>
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">
                    {card.title}
                  </CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="mt-6 flex items-center justify-between p-0">
                {card.disabled ? (
                  <Badge variant="outline" className="rounded-full">
                    Coming soon
                  </Badge>
                ) : card.title === "2 Characters Having a Conversation" ? (
                  <Badge className="rounded-full bg-primary/10 text-primary">
                    Most popular
                  </Badge>
                ) : null}
                <Button
                  variant={isDisabled ? "outline" : "default"}
                  className="rounded-2xl"
                  disabled={isDisabled}
                  onClick={() => handleCardClick(card)}
                >
                  {card.disabled ? "Locked" : checkingLimit ? "Checking..." : "Start"}
                </Button>
              </CardContent>
            </Card>
          );

          if (card.disabled) {
            return (
              <Tooltip key={card.title}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <div key={card.title} onClick={() => handleCardClick(card)} className="w-full">
              {content}
            </div>
          );
        })}
      </section>
    </div>
  );
}
