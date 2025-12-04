"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Video, CheckCircle, FileText, Calendar, RefreshCw, ShieldOff, ExternalLink, ChevronDown, ChevronUp, Play } from "lucide-react";
import { adminApi, type AdminUser, type AdminStats } from "@/lib/api/admin";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useAuthStore } from "@/lib/stores/auth-store";

const ADMIN_EMAIL = "asifhassam14@gmail.com";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set());
  const usersPerPage = 20;

  const toggleVideoExpansion = (videoId: string) => {
    setExpandedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const loadData = async (showToast = false) => {
    try {
      if (!refreshing) setLoading(true);
      
      const offset = (currentPage - 1) * usersPerPage;
      const [usersResult, statsResult] = await Promise.all([
        adminApi.getUsers(usersPerPage, offset),
        adminApi.getStats(),
      ]);

      setUsers(usersResult.users);
      setTotalUsers(usersResult.total);
      setStats(statsResult.stats);
      
      if (showToast) {
        toast.success("Admin dashboard refreshed");
      }
    } catch (error) {
      console.error("Failed to load admin data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Wait for auth to load before checking admin status
    const { loading: authLoading } = useAuthStore.getState();
    if (authLoading) {
      return; // Wait for auth to finish loading
    }

    // Check if user is admin
    if (!isAdmin) {
      toast.error("Access denied. Admin access required.");
      router.push("/app/dashboard");
      return;
    }
    loadData();
  }, [currentPage, isAdmin, router, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const totalPages = Math.ceil(totalUsers / usersPerPage);

  // Wait for auth to load
  const { loading: authLoading } = useAuthStore.getState();
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <ShieldOff className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
        <p className="text-xs text-muted-foreground">Your email: {user?.email || 'Not logged in'}</p>
        <Button onClick={() => router.push("/app/dashboard")} className="rounded-2xl">
          Go to Dashboard
        </Button>
      </div>
    );
  }

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage users and monitor video creation activity
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="rounded-2xl"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                {stats.usersToday} new today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
              <p className="text-xs text-muted-foreground">
                {stats.completedProjects} completed, {stats.draftProjects} drafts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Videos Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.projectsToday}</div>
              <p className="text-xs text-muted-foreground">
                Created in the last 24 hours
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Showing {users.length} of {totalUsers} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="rounded-2xl border border-border/40 bg-white/70 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{user.email}</h3>
                        <Badge variant="secondary" className="rounded-full">
                          {user.videoCount} {user.videoCount === 1 ? 'video' : 'videos'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        {user.createdAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                          </span>
                        )}
                        {user.lastSignIn && (
                          <span className="flex items-center gap-1">
                            Last active {formatDistanceToNow(new Date(user.lastSignIn), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {user.completedVideoCount} completed
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        <FileText className="h-3 w-3 mr-1" />
                        {user.draftCount} drafts
                      </Badge>
                    </div>
                  </div>

                  {/* Recent Videos */}
                  {user.videos.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                      <h4 className="text-sm font-medium text-foreground mb-2">Recent Videos</h4>
                      <div className="space-y-3">
                        {user.videos.map((video) => {
                          const isExpanded = expandedVideos.has(video.id);
                          const hasSubtitles = video.srt_text && video.srt_text.trim().length > 0;
                          const subtitleText = video.srt_text || 'No subtitles available';

                          return (
                            <div
                              key={video.id}
                              className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2 hover:bg-muted/40 transition-colors cursor-pointer"
                              onClick={() => {
                                // For draft videos, always expand subtitles if available. For completed videos, open video
                                if (!video.final_url) {
                                  // Draft video - show subtitles if available
                                  if (hasSubtitles) {
                                    toggleVideoExpansion(video.id);
                                  } else {
                                    // No subtitles available - show message
                                    toast.info('No subtitles available for this draft video');
                                  }
                                } else if (video.final_url) {
                                  // Completed video - open it
                                  window.open(video.final_url, '_blank');
                                } else if (video.preview_url) {
                                  // Preview available - open it
                                  window.open(video.preview_url, '_blank');
                                }
                              }}
                            >
                              <div 
                                className="flex items-start justify-between gap-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-foreground truncate">{video.title}</p>
                                    <span className="text-xs text-muted-foreground">
                                      by {user.email}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {video.final_url ? (
                                    <Badge variant="default" className="rounded-full">
                                      Completed
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="rounded-full">
                                      Draft
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Video Links */}
                              <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                                {video.preview_url && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl text-xs"
                                    onClick={() => window.open(video.preview_url!, '_blank')}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Preview
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </Button>
                                )}
                                {video.final_url && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl text-xs"
                                    onClick={() => window.open(video.final_url!, '_blank')}
                                  >
                                    <Video className="h-3 w-3 mr-1" />
                                    Final Video
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </Button>
                                )}
                                {hasSubtitles && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-xl text-xs"
                                    onClick={() => toggleVideoExpansion(video.id)}
                                  >
                                    {isExpanded ? (
                                      <>
                                        <ChevronUp className="h-3 w-3 mr-1" />
                                        Hide Subtitles
                                      </>
                                    ) : (
                                      <>
                                        <FileText className="h-3 w-3 mr-1" />
                                        {video.final_url ? 'Show Subtitles' : 'View Subtitles'}
                                      </>
                                    )}
                                  </Button>
                                )}
                                {!video.final_url && !video.preview_url && hasSubtitles && (
                                  <span className="text-xs text-muted-foreground italic">
                                    Click card to view subtitles
                                  </span>
                                )}
                              </div>

                              {/* Subtitles Display */}
                              {isExpanded && hasSubtitles && (
                                <div className="mt-2 pt-2 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
                                  <p className="text-xs font-medium text-foreground mb-2">Subtitles (SRT):</p>
                                  <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre-wrap">
                                    {subtitleText}
                                  </pre>
                                </div>
                              )}
                              {isExpanded && !hasSubtitles && (
                                <div className="mt-2 pt-2 border-t border-border/40 text-center text-sm text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                                  No subtitles available for this video
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-border/40 gap-4">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * usersPerPage) + 1} - {Math.min(currentPage * usersPerPage, totalUsers)} of {totalUsers} users
                </p>
                <span className="text-sm text-muted-foreground">•</span>
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="rounded-2xl"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-2xl"
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Go to:</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                      }
                    }}
                    className="w-20 h-8 text-center rounded-xl"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-2xl"
                >
                  Next
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="rounded-2xl"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

