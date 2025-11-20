"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { VideoCard } from "@/components/dashboard/video-card";
import { SubscriptionCard } from "@/components/dashboard/subscription-card";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscriptionApi } from "@/lib/api/subscription";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const VIDEOS_PER_PAGE = 10;

export const DashboardView = () => {
  const { projects, deleteProject, loadProjects, loading, clearDraft } = useProjectStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [canCreateVideo, setCanCreateVideo] = useState(true);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'paid' | null>(null);

  // Load projects from API on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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

  const userProjects = useMemo(
    () =>
      !user?.id
        ? projects
        : projects.filter(
            (project) => project.userId === user.id || project.userId === "seed-user",
          ),
    [projects, user?.id]
  );

  // Reset to page 1 when projects change
  useEffect(() => {
    setCurrentPage(1);
  }, [userProjects.length]);

  // Calculate pagination
  const totalPages = Math.ceil(userProjects.length / VIDEOS_PER_PAGE);
  const startIndex = (currentPage - 1) * VIDEOS_PER_PAGE;
  const endIndex = startIndex + VIDEOS_PER_PAGE;
  const paginatedProjects = userProjects.slice(startIndex, endIndex);

  const handleDelete = (id: string) => {
    deleteProject(id);
    toast.success("Project deleted");
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleCreateNewVideo = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      // If not authenticated, allow navigation (for dev/testing)
      clearDraft();
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

    clearDraft();
    router.push("/app/create");
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading your projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Your videos</h1>
          <p className="text-sm text-muted-foreground">
            Manage previews, iterate on scripts, and present a polished mock workflow.
          </p>
        </div>
        <Button 
          className="rounded-2xl"
          onClick={handleCreateNewVideo}
          disabled={checkingLimit || (!canCreateVideo && !!user?.id)}
        >
          {checkingLimit ? "Checking..." : "Create new video"}
        </Button>
      </div>
      
      {/* Subscription Card */}
      {user && <SubscriptionCard />}
      
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
      
      {userProjects.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {paginatedProjects.map((project) => (
              <VideoCard key={project.id} project={project} onDelete={handleDelete} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, userProjects.length)} of{" "}
                {userProjects.length} videos
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="rounded-xl"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    if (!showPage) {
                      // Show ellipsis
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <span key={page} className="px-2 text-muted-foreground">
                            ...
                          </span>
                        );
                      }
                      return null;
                    }

                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="rounded-xl min-w-[2.5rem]"
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="rounded-xl"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
