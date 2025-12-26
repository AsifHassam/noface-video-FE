"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/stores/auth-store";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ExternalLink, Video } from "lucide-react";
import { toast } from "sonner";
import { renderJobsApi } from "@/lib/api/projects";
import type { RenderStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";

const ITEMS_PER_PAGE = 10;

type RenderQueueItem = {
  id: string;
  projectId: string | null;
  title: string;
  status: RenderStatus;
  finalUrl: string | null;
  videoUrl: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  type: string;
  errorMessage: string | null;
};

export default function RenderQueuePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [renderJobs, setRenderJobs] = useState<RenderQueueItem[]>([]);

  // Calculate pagination
  const totalPages = Math.ceil(renderJobs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedItems = renderJobs.slice(startIndex, endIndex);

  useEffect(() => {
    if (user?.id) {
      loadRenderQueue();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  // Auto-refresh for items that are still rendering
  useEffect(() => {
    const hasRenderingItems = renderJobs.some(
      (item) => item.status === "RENDERING" || item.status === "QUEUED"
    );

    if (!hasRenderingItems) return;

    const interval = setInterval(() => {
      loadRenderQueue(false); // Silent refresh
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [renderJobs, user?.id]);

  const loadRenderQueue = async (showToast = false) => {
    if (!user?.id) return;
    
    try {
      if (!refreshing) setLoading(true);
      const result = await renderJobsApi.list();
      
      // Format render jobs
      const formattedJobs: RenderQueueItem[] = result.renderJobs.map((job) => {
        // For UGC renders, use the project title if available, otherwise fallback
        const title = job.project?.title || 
                     (job.type === 'UGC_RENDER' ? `UGC Video ${job.id.substring(0, 8)}` : `Render Job ${job.id.substring(0, 8)}`);
        
        return {
        id: job.id,
        projectId: job.projectId,
          title,
        status: job.status,
        finalUrl: job.project?.finalUrl || job.videoUrl || null,
        videoUrl: job.videoUrl || null,
        progress: job.progress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        type: job.project?.type || job.type || 'TWO_CHAR_CONVO',
        errorMessage: job.errorMessage,
        };
      });

      setRenderJobs(formattedJobs);
      
      if (showToast) {
        toast.success("Render queue refreshed");
      }
    } catch (error) {
      console.error("Failed to load render queue:", error);
      if (showToast) {
        toast.error("Failed to refresh render queue");
      }
    } finally {
      if (!refreshing) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRenderQueue(true);
    setRefreshing(false);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      relative: formatDistanceToNow(date, { addSuffix: true }),
    };
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Loading render queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Render Queue</h1>
          <p className="text-sm text-muted-foreground">
            View your videos that are currently rendering or have completed rendering.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {renderJobs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="py-12 text-center">
              <Video className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No render jobs found
              </h3>
              <p className="text-sm text-muted-foreground">
                Your render queue is empty. Create a video and render it to see it here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedItems.map((item) => {
              const dateTime = formatDateTime(item.updatedAt);
              const createdDateTime = formatDateTime(item.createdAt);
              const videoUrl = item.finalUrl || item.videoUrl;
              
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{item.title}</CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-2">
                          <span className="text-xs">
                            Started: {createdDateTime.date} at {createdDateTime.time}
                          </span>
                          <span className="text-xs">
                            Updated: {dateTime.relative}
                          </span>
                          {item.progress > 0 && item.progress < 100 && (
                            <span className="text-xs">
                              Progress: {item.progress}%
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={item.status} />
                        {videoUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => window.open(videoUrl, "_blank")}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Video
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span>Type: {
                          item.type === "story" || item.type === "NORMAL_STORY" || item.type === "STORY_PREVIEW" || item.type === "STORY_FINAL" 
                            ? "Story" 
                            : item.type === "UGC_RENDER" 
                            ? "UGC" 
                            : "Two-Char"
                        }</span>
                        {item.status === "RENDERING" && (
                          <span className="flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Rendering... {item.progress > 0 && `${item.progress}%`}
                          </span>
                        )}
                        {item.status === "QUEUED" && (
                          <span>In queue...</span>
                        )}
                        {item.status === "FAILED" && item.errorMessage && (
                          <span className="text-destructive text-xs">
                            Error: {item.errorMessage.substring(0, 50)}
                            {item.errorMessage.length > 50 ? "..." : ""}
                          </span>
                        )}
                      </div>
                      {videoUrl && (
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs max-w-md truncate"
                        >
                          {videoUrl}
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, renderJobs.length)} of{" "}
                {renderJobs.length} render jobs
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
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    if (!showPage) {
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
}
