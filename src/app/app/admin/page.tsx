"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  Video,
  FileText,
  RefreshCw,
  ShieldOff,
  ExternalLink,
  ChevronUp,
  Play,
  DollarSign,
  TrendingUp,
  Activity,
  Upload,
  Zap,
  LayoutDashboard,
  UserCircle,
  Film,
  ListVideo,
  Receipt,
  ChevronLeft,
  ChevronRight,
  LogIn,
  UserPlus,
  Trash2,
  ImagePlus,
  Volume2,
  Pencil,
} from "lucide-react";
import { adminApi, type AdminUser, type AdminStats, type AdminActivity, type AdminUserTransaction, type GlobalCharacter } from "@/lib/api/admin";
import { TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT } from "@/lib/utils/resize-image";
import { CharacterImageCropEditor } from "@/components/create/character-image-crop-editor";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { useAuthStore } from "@/lib/stores/auth-store";

const ADMIN_EMAIL = "asifhassam14@gmail.com";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<AdminActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [expandedVideos, setExpandedVideos] = useState<Set<string>>(new Set());
  const [viewVideosUser, setViewVideosUser] = useState<AdminUser | null>(null);
  const [billingUser, setBillingUser] = useState<AdminUser | null>(null);
  const [billingTransactions, setBillingTransactions] = useState<AdminUserTransaction[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [impersonateUser, setImpersonateUser] = useState<AdminUser | null>(null);
  const [impersonatePassword, setImpersonatePassword] = useState("");
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [paidOnlyFilter, setPaidOnlyFilter] = useState(false);
  const [testUserFilter, setTestUserFilter] = useState<'exclude_test' | 'test_only' | 'all'>('exclude_test');
  const [activeTab, setActiveTab] = useState("overview");
  const [togglingTestUserId, setTogglingTestUserId] = useState<string | null>(null);
  const usersPerPage = 20;
  // Paystack billing backfill
  const [paystackTransactions, setPaystackTransactions] = useState<Array<{ id: number; reference: string; amount: number; currency: string; status: string; customer_email: string; created_at: string; paid_at: string | null }>>([]);
  const [paystackMeta, setPaystackMeta] = useState<{ total: number; page: number; perPage: number; pageCount: number } | null>(null);
  const [paystackLoading, setPaystackLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [selectedBackfillRefs, setSelectedBackfillRefs] = useState<Set<string>>(new Set());
  const [paystackPage, setPaystackPage] = useState(1);
  // Global characters (2-char flow)
  const [globalCharacters, setGlobalCharacters] = useState<GlobalCharacter[]>([]);
  const [globalCharactersLoading, setGlobalCharactersLoading] = useState(false);
  const [charName, setCharName] = useState("");
  const [charVoiceId, setCharVoiceId] = useState("");
  const [charImage, setCharImage] = useState<File | null>(null);
  const [charImagePreview, setCharImagePreview] = useState<string | null>(null);
  const [charImageForCrop, setCharImageForCrop] = useState<string | null>(null);
  const [charPlaceholderVoice, setCharPlaceholderVoice] = useState(false);
  const [charVoiceSample, setCharVoiceSample] = useState<File | null>(null);
  const [charSubmitting, setCharSubmitting] = useState(false);
  const [charDeletingId, setCharDeletingId] = useState<string | null>(null);
  const [charUpdatingVoiceId, setCharUpdatingVoiceId] = useState<string | null>(null);
  const [editingVoiceChar, setEditingVoiceChar] = useState<GlobalCharacter | null>(null);
  const [editPlaceholderVoice, setEditPlaceholderVoice] = useState(false);
  const [editVoiceSample, setEditVoiceSample] = useState<File | null>(null);
  const editVoiceInputRef = useRef<HTMLInputElement>(null);
  const charFileInputRef = useRef<HTMLInputElement>(null);
  const charVoiceInputRef = useRef<HTMLInputElement>(null);

  const toggleVideoExpansion = (videoId: string) => {
    setExpandedVideos((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const openBilling = async (u: AdminUser) => {
    setBillingUser(u);
    setBillingTransactions([]);
    setBillingLoading(true);
    try {
      const res = await adminApi.getUserTransactions(u.id);
      setBillingTransactions(res.transactions || []);
    } catch (e) {
      console.error("Failed to load billing:", e);
      toast.error("Failed to load transactions");
    } finally {
      setBillingLoading(false);
    }
  };

  const handleImpersonateSubmit = async () => {
    if (!impersonateUser?.email || !impersonatePassword.trim()) {
      toast.error("Enter the impersonate password");
      return;
    }
    setImpersonateLoading(true);
    try {
      const res = await adminApi.impersonate(impersonateUser.email, impersonatePassword);
      if (res.success && res.loginLink) {
        toast.success("Redirecting to sign in as " + impersonateUser.email);
        window.location.href = res.loginLink;
        return;
      }
      toast.error(res.error || "Invalid password or failed to generate link");
    } catch (e) {
      console.error("Impersonate error:", e);
      toast.error("Failed to get login link");
    } finally {
      setImpersonateLoading(false);
    }
  };

  const loadData = async (showToast = false) => {
    try {
      if (!refreshing) setLoading(true);
      const offset = (currentPage - 1) * usersPerPage;
      const [usersResult, statsResult, activityResult] = await Promise.all([
        adminApi.getUsers(usersPerPage, offset, {
          paidOnly: paidOnlyFilter,
          excludeTestUsers: testUserFilter === 'exclude_test',
          testUsersOnly: testUserFilter === 'test_only',
        }),
        adminApi.getStats(),
        adminApi.getActivity(20),
      ]);
      setUsers(usersResult.users);
      setTotalUsers(usersResult.total);
      setStats(statsResult.stats);
      setActivity(activityResult.activity);
      if (showToast) toast.success("Dashboard refreshed");
    } catch (error) {
      console.error("Failed to load admin data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const { loading: authLoading } = useAuthStore.getState();
    if (authLoading) return;
    if (!isAdmin) {
      toast.error("Access denied. Admin access required.");
      router.push("/app/dashboard");
      return;
    }
    loadData();
  }, [currentPage, isAdmin, router, user, paidOnlyFilter, testUserFilter]);

  useEffect(() => {
    if (activeTab === "characters" && isAdmin) fetchGlobalCharacters();
  }, [activeTab, isAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleSetTestUser = async (userId: string, isTestUser: boolean) => {
    try {
      setTogglingTestUserId(userId);
      await adminApi.setTestUser(userId, isTestUser);
      toast.success(isTestUser ? "Marked as test user" : "Removed from test users");
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setTogglingTestUserId(null);
    }
  };

  const fetchPaystackTransactions = async (page = 1) => {
    try {
      setPaystackLoading(true);
      const result = await adminApi.getPaystackTransactions(page, 50);
      setPaystackTransactions(result.transactions || []);
      setPaystackMeta(result.meta || null);
      setPaystackPage(page);
      setSelectedBackfillRefs(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch Paystack transactions");
      setPaystackTransactions([]);
      setPaystackMeta(null);
    } finally {
      setPaystackLoading(false);
    }
  };

  const toggleBackfillRef = (ref: string) => {
    setSelectedBackfillRefs((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const selectAllBackfillRefs = () => {
    if (selectedBackfillRefs.size === paystackTransactions.length) {
      setSelectedBackfillRefs(new Set());
    } else {
      setSelectedBackfillRefs(new Set(paystackTransactions.map((t) => t.reference)));
    }
  };

  const fetchGlobalCharacters = async () => {
    setGlobalCharactersLoading(true);
    try {
      const res = await adminApi.getGlobalCharacters();
      setGlobalCharacters(res.characters || []);
    } catch (e) {
      console.error("Failed to load global characters:", e);
      toast.error("Failed to load characters");
    } finally {
      setGlobalCharactersLoading(false);
    }
  };

  const handleCharImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setCharImageForCrop(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCharCropApply = (file: File) => {
    setCharImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setCharImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    setCharImageForCrop(null);
  };

  const handleCharCropCancel = () => {
    setCharImageForCrop(null);
    if (charFileInputRef.current) charFileInputRef.current.value = "";
  };

  const handleCharImageRemove = () => {
    setCharImage(null);
    setCharImagePreview(null);
    setCharImageForCrop(null);
    if (charFileInputRef.current) charFileInputRef.current.value = "";
  };

  const handleUpdateCharacterVoice = async (id: string, isPlaceholderVoice: boolean, voiceSample: File | null) => {
    setCharUpdatingVoiceId(id);
    try {
      const res = await adminApi.updateGlobalCharacter(id, {
        isPlaceholderVoice,
        ...(voiceSample ? { voiceSample } : {}),
      });
      if (res.success && res.character) {
        setGlobalCharacters((prev) => prev.map((c) => (c.id === id ? res.character! : c)));
        setEditingVoiceChar(null);
        setEditVoiceSample(null);
        if (editVoiceInputRef.current) editVoiceInputRef.current.value = "";
        toast.success("Voice updated");
      } else {
        toast.error(res.error || "Update failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setCharUpdatingVoiceId(null);
    }
  };

  const handleCreateGlobalCharacter = async () => {
    if (!charName.trim() || !charVoiceId.trim() || !charImage) {
      toast.error("Name, Voice ID, and image are required");
      return;
    }
    setCharSubmitting(true);
    try {
      const res = await adminApi.createGlobalCharacter({
        name: charName.trim(),
        voiceId: charVoiceId.trim(),
        image: charImage,
        isPlaceholderVoice: charPlaceholderVoice,
        voiceSample: charVoiceSample || undefined,
      });
      if (res.success && res.character) {
        toast.success("Character created");
        setCharName("");
        setCharVoiceId("");
        setCharImage(null);
        setCharImagePreview(null);
        setCharImageForCrop(null);
        setCharPlaceholderVoice(false);
        setCharVoiceSample(null);
        if (charFileInputRef.current) charFileInputRef.current.value = "";
        if (charVoiceInputRef.current) charVoiceInputRef.current.value = "";
        setGlobalCharacters((prev) => [res.character!, ...prev]);
      } else {
        toast.error(res.error || "Create failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCharSubmitting(false);
    }
  };

  const handleDeleteGlobalCharacter = async (id: string) => {
    setCharDeletingId(id);
    try {
      const res = await adminApi.deleteGlobalCharacter(id);
      if (res.success) {
        setGlobalCharacters((prev) => prev.filter((c) => c.id !== id));
        toast.success("Character deleted");
      } else {
        toast.error(res.error || "Delete failed");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setCharDeletingId(null);
    }
  };

  const handleBackfillTransactions = async () => {
    if (selectedBackfillRefs.size === 0) {
      toast.error("Select at least one transaction");
      return;
    }
    try {
      setBackfillLoading(true);
      const result = await adminApi.backfillTransactions(Array.from(selectedBackfillRefs));
      toast.success(result.message);
      if (result.errors?.length) {
        result.errors.slice(0, 3).forEach((e) => toast.warning(`${e.reference}: ${e.error}`));
      }
      setSelectedBackfillRefs(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBackfillLoading(false);
    }
  };

  const totalPages = Math.ceil(totalUsers / usersPerPage);

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
        <p className="text-muted-foreground">You don&apos;t have permission to access this page.</p>
        <p className="text-xs text-muted-foreground">Your email: {user?.email || "Not logged in"}</p>
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
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track revenue, users, videos, and usage at a glance
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => router.push("/app/admin/backgrounds")}
            variant="outline"
            size="sm"
            className="rounded-2xl"
          >
            <Video className="h-4 w-4 mr-2" />
            Backgrounds
          </Button>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="rounded-2xl"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl"
            onClick={() => window.open("/login-as", "_blank")}
          >
            <UserCircle className="h-4 w-4 mr-2" />
            Login as user
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="rounded-2xl bg-muted/60 p-1">
          <TabsTrigger value="overview" className="rounded-xl gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl gap-2">
            <UserCircle className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-xl gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="billing-backfill" className="rounded-xl gap-2">
            <Receipt className="h-4 w-4" />
            Billing backfill
          </TabsTrigger>
          <TabsTrigger value="characters" className="rounded-xl gap-2">
            <UserPlus className="h-4 w-4" />
            Characters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {stats && (
            <>
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">At a glance</h2>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Total users
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalUsers}</div>
                      <p className="text-xs text-muted-foreground">
                        +{stats.usersToday} today
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        Active (7d)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.activeUsersLast7Days ?? "—"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Users with activity
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        Paying users
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {stats.payingUsers ?? "—"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pro / Premium
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Video className="h-4 w-4 text-muted-foreground" />
                        Total videos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalProjects}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.completedProjects} done · {stats.projectsToday} today
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">Videos & renders</h2>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{stats.completedProjects}</div>
                      <p className="text-xs text-muted-foreground">With final export</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Drafts</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{stats.draftProjects}</div>
                      <p className="text-xs text-muted-foreground">In progress</p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        Renders
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{stats.renderJobsCompleted ?? "—"}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.renderJobsPending ?? 0} pending · {stats.renderJobsFailed ?? 0} failed
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Film className="h-4 w-4 text-muted-foreground" />
                        UGC projects
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold">{stats.ugcProjectsTotal ?? "—"}</div>
                      <p className="text-xs text-muted-foreground">
                        {stats.ugcCompletedTotal ?? 0} done · {stats.ugcProjectsToday ?? 0} today
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {(stats.userUploadsTotal != null && stats.userUploadsTotal > 0) && (
                <Card className="rounded-2xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      User uploads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{stats.userUploadsTotal}</div>
                    <p className="text-xs text-muted-foreground">Images, videos, audio</p>
                  </CardContent>
                </Card>
              )}

              {activity && (activity.recentProjects.length > 0 || activity.recentRenderJobs.length > 0) && (
                <Card className="rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Recent activity (last 24h)
                    </CardTitle>
                    <CardDescription>New projects and render completions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {activity.recentProjects.slice(0, 8).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-sm"
                        >
                          <div>
                            <span className="font-medium truncate block max-w-[200px]" title={p.title}>
                              {p.title || "Untitled"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                              {p.final_url ? " · Completed" : " · Draft"}
                            </span>
                          </div>
                          {p.final_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-lg shrink-0"
                              onClick={() => window.open(p.final_url!, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {activity.recentRenderJobs.slice(0, 5).map((j) => (
                        <div
                          key={j.id}
                          className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-sm"
                        >
                          <span className="text-muted-foreground">
                            Render {j.status === "completed" ? "completed" : "failed"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(j.updated_at), { addSuffix: true })}
                          </span>
                          <Badge variant={j.status === "completed" ? "default" : "destructive"} className="rounded-full text-xs">
                            {j.status}
                          </Badge>
                        </div>
                      ))}
                      {activity.recentProjects.length === 0 && activity.recentRenderJobs.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4">No recent activity</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Users</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Showing {users.length} of {totalUsers} users · Page {currentPage} of {totalPages || 1}
                    {paidOnlyFilter && " · Paid only"}
                    {testUserFilter === "exclude_test" && " · Test users excluded"}
                    {testUserFilter === "test_only" && " · Test users only"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={paidOnlyFilter}
                      onChange={(e) => {
                        setPaidOnlyFilter(e.target.checked);
                        setCurrentPage(1);
                      }}
                      className="rounded border-border"
                    />
                    Paid only
                  </label>
                  <span className="text-xs text-muted-foreground">Test users:</span>
                  <select
                    value={testUserFilter}
                    onChange={(e) => {
                      setTestUserFilter(e.target.value as 'exclude_test' | 'test_only' | 'all');
                      setCurrentPage(1);
                    }}
                    className="text-xs rounded-lg border border-border bg-background px-2 py-1"
                  >
                    <option value="exclude_test">Exclude (default)</option>
                    <option value="test_only">Test only</option>
                    <option value="all">Show all</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  No users found
                </div>
              ) : (
                <div className="rounded-xl border border-border/40 overflow-x-auto overflow-y-hidden">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/30 text-[11px] font-medium text-muted-foreground border-b border-border/40 min-w-[720px]">
                    <div className="col-span-3">Email</div>
                    <div className="col-span-2">Last active</div>
                    <div className="col-span-1">Tier</div>
                    <div className="col-span-1">Credits</div>
                    <div className="col-span-1">Amount</div>
                    <div className="col-span-1">Videos (mo)</div>
                    <div className="col-span-1">Test</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={`grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-border/40 last:border-0 hover:bg-muted/20 text-xs min-w-[720px] ${u.payment_blocked ? "bg-destructive/10 border-l-4 border-l-destructive" : ""}`}
                    >
                      <div className="col-span-3 font-medium text-foreground truncate text-xs" title={u.email}>
                        {u.email}
                      </div>
                      <div className="col-span-2 text-muted-foreground text-xs">
                        {u.lastSignIn
                          ? formatDistanceToNow(new Date(u.lastSignIn), { addSuffix: true })
                          : "—"}
                      </div>
                      <div className="col-span-1 text-xs capitalize">
                        {u.subscription_tier ?? "—"}
                      </div>
                      <div className="col-span-1 text-xs">
                        {u.credits != null ? Number(u.credits).toFixed(1) : "—"}
                      </div>
                      <div className="col-span-1 text-xs">
                        {u.amountPaying != null && u.amountPaying > 0 ? `$${u.amountPaying}` : "—"}
                      </div>
                      <div className="col-span-1 text-xs">
                        {u.videosCreatedThisMonth ?? 0}
                      </div>
                      <div className="col-span-1 flex items-center gap-1">
                        {u.is_test_user ? (
                          <Badge variant="secondary" className="text-[10px] px-1 rounded">Test</Badge>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1 text-muted-foreground hover:text-foreground"
                          disabled={togglingTestUserId === u.id}
                          onClick={() => handleSetTestUser(u.id, !u.is_test_user)}
                        >
                          {togglingTestUserId === u.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : u.is_test_user ? (
                            "Unmark"
                          ) : (
                            "Mark test"
                          )}
                        </Button>
                      </div>
                      <div className="col-span-2 text-right flex items-center justify-end gap-1 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-7 text-[11px] px-2"
                          onClick={() => {
                            setImpersonateUser(u);
                            setImpersonatePassword("");
                          }}
                          title="Login as this user (requires impersonate password)"
                        >
                          <LogIn className="h-3 w-3 mr-1" />
                          Login as
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-7 text-[11px] px-2"
                          onClick={() => openBilling(u)}
                        >
                          <Receipt className="h-3 w-3 mr-1" />
                          Billing
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-7 text-[11px] px-2"
                          onClick={() => setViewVideosUser(u)}
                        >
                          <ListVideo className="h-3 w-3 mr-1" />
                          View videos
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-4 border-t border-border/40 gap-4">
                  <p className="text-sm text-muted-foreground">
                    {((currentPage - 1) * usersPerPage) + 1}–{Math.min(currentPage * usersPerPage, totalUsers)} of {totalUsers}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded-2xl">First</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-2xl">Prev</Button>
                    <span className="flex items-center gap-2 px-2">
                      <span className="text-sm text-muted-foreground">Page</span>
                      <Input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={currentPage}
                        onChange={(e) => {
                          const p = parseInt(e.target.value, 10);
                          if (p >= 1 && p <= totalPages) setCurrentPage(p);
                        }}
                        className="w-16 h-8 text-center rounded-xl"
                      />
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-2xl">Next</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded-2xl">Last</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6 space-y-6">
          {activity && (
            <>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Recent projects (last 24h)</CardTitle>
                  <CardDescription>Newly created or updated projects</CardDescription>
                </CardHeader>
                <CardContent>
                  {activity.recentProjects.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6">No projects in the last 24 hours</p>
                  ) : (
                    <div className="space-y-2">
                      {activity.recentProjects.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                          <div>
                            <p className="font-medium">{p.title || "Untitled"}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(p.created_at), "MMM d, HH:mm")} · {p.final_url ? "Completed" : "Draft"}
                            </p>
                          </div>
                          {p.final_url && (
                            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => window.open(p.final_url!, "_blank")}>
                              <ExternalLink className="h-3 w-3 mr-1" /> Open
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle>Recent render jobs</CardTitle>
                  <CardDescription>Completed or failed renders</CardDescription>
                </CardHeader>
                <CardContent>
                  {activity.recentRenderJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6">No recent render jobs</p>
                  ) : (
                    <div className="space-y-2">
                      {activity.recentRenderJobs.map((j) => (
                        <div key={j.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                          <span className="text-sm text-muted-foreground">Job {j.id.slice(0, 8)}…</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(j.updated_at), { addSuffix: true })}
                            </span>
                            <Badge variant={j.status === "completed" ? "default" : "destructive"} className="rounded-full">
                              {j.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="billing-backfill" className="mt-6 space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Paystack billing backfill</CardTitle>
              <CardDescription>
                Fetch Paystack transactions (success and failed). Select which to add to users&apos; billing tab. Failed ones will generate a payment link for the user so they see &quot;Pay now&quot; on the dashboard until paid.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => fetchPaystackTransactions(1)}
                  disabled={paystackLoading}
                  className="rounded-2xl"
                >
                  {paystackLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4 mr-2" />
                  )}
                  Fetch Paystack transactions
                </Button>
                {paystackMeta && (
                  <span className="text-sm text-muted-foreground">
                    Page {paystackMeta.page} of {paystackMeta.pageCount} · {paystackMeta.total} total
                  </span>
                )}
              </div>
              {paystackTransactions.length > 0 && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBackfillRefs.size === paystackTransactions.length && paystackTransactions.length > 0}
                        onChange={selectAllBackfillRefs}
                        className="rounded"
                      />
                      Select all on this page
                    </label>
                    <Button
                      onClick={handleBackfillTransactions}
                      disabled={backfillLoading || selectedBackfillRefs.size === 0}
                      className="rounded-2xl"
                    >
                      {backfillLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Add selected to billing ({selectedBackfillRefs.size})
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/60">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="p-2 w-10"></th>
                          <th className="p-2">Reference</th>
                          <th className="p-2">Status</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">Amount</th>
                          <th className="p-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paystackTransactions.map((t) => (
                          <tr key={t.reference} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedBackfillRefs.has(t.reference)}
                                onChange={() => toggleBackfillRef(t.reference)}
                                className="rounded"
                              />
                            </td>
                            <td className="p-2 font-mono text-xs">{t.reference}</td>
                            <td className="p-2">
                              <Badge variant={t.status === "success" ? "default" : "destructive"} className="rounded-full text-xs">
                                {t.status === "success" ? "Success" : "Failed"}
                              </Badge>
                            </td>
                            <td className="p-2">{t.customer_email || "—"}</td>
                            <td className="p-2">{(t.amount / 100).toFixed(2)} {t.currency}</td>
                            <td className="p-2 text-muted-foreground">
                              {t.paid_at ? format(new Date(t.paid_at), "MMM d, yyyy") : t.created_at ? format(new Date(t.created_at), "MMM d, yyyy") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {paystackMeta && paystackMeta.pageCount > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={paystackPage <= 1 || paystackLoading}
                        onClick={() => fetchPaystackTransactions(paystackPage - 1)}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {paystackPage} of {paystackMeta.pageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={paystackPage >= paystackMeta.pageCount || paystackLoading}
                        onClick={() => fetchPaystackTransactions(paystackPage + 1)}
                      >
                        Next <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </>
              )}
              {!paystackLoading && paystackTransactions.length === 0 && paystackMeta === null && (
                <p className="text-sm text-muted-foreground py-4">Click &quot;Fetch Paystack transactions&quot; to load successful payments from Paystack.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="characters" className="mt-6 space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>2-character conversation characters</CardTitle>
              <CardDescription>
                Create exactly 2 global characters for the 2-character conversation flow. Add name, ElevenLabs voice ID, and an avatar image.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="e.g. Alex"
                    value={charName}
                    onChange={(e) => setCharName(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voice ID (ElevenLabs)</label>
                  <Input
                    placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                    value={charVoiceId}
                    onChange={(e) => setCharVoiceId(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2 flex flex-col">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Volume2 className="h-4 w-4" /> Voice
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={charPlaceholderVoice}
                        onCheckedChange={(v) => setCharPlaceholderVoice(v === true)}
                      />
                      Placeholder voice
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        ref={charVoiceInputRef}
                        type="file"
                        accept="audio/*"
                        className="rounded-xl max-w-[200px]"
                        onChange={(e) => setCharVoiceSample(e.target.files?.[0] ?? null)}
                      />
                      {charVoiceSample && (
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{charVoiceSample.name}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Optional: upload a voice sample (stored in Supabase) for preview.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <ImagePlus className="h-4 w-4" /> Avatar image
                  </label>
                  {charImageForCrop ? (
                    <div className="max-w-sm">
                      <CharacterImageCropEditor
                        imageUrl={charImageForCrop}
                        onApply={handleCharCropApply}
                        onCancel={handleCharCropCancel}
                        compact
                      />
                    </div>
                  ) : charImagePreview ? (
                    <div className="relative inline-block">
                      <img
                        src={charImagePreview}
                        alt="Preview"
                        className="h-20 w-20 rounded-xl border border-border/60 object-cover"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {TARGET_IMAGE_WIDTH}×{TARGET_IMAGE_HEIGHT}px
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive/90 text-destructive-foreground hover:bg-destructive"
                        onClick={handleCharImageRemove}
                        disabled={charSubmitting}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Input
                      ref={charFileInputRef}
                      type="file"
                      accept="image/*"
                      className="rounded-xl"
                      onChange={handleCharImageChange}
                    />
                  )}
                </div>
                <Button
                  onClick={handleCreateGlobalCharacter}
                  disabled={charSubmitting || globalCharacters.length >= 2 || !charName.trim() || !charVoiceId.trim() || !charImage}
                  className="rounded-xl"
                >
                  {charSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {charSubmitting ? " Creating…" : " Create character"}
                </Button>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Global characters ({globalCharacters.length})</h3>
                {globalCharactersLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : globalCharacters.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No characters yet. Create one above.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {globalCharacters.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl border border-border/60 p-3 bg-muted/20"
                      >
                        <img src={c.avatar_url} alt={c.name} className="h-12 w-12 rounded-full object-cover" />
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{c.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate">{c.voice_id}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.is_placeholder_voice && (
                              <Badge variant="secondary" className="rounded-full text-xs">Placeholder voice</Badge>
                            )}
                            {c.voice_sample_url && (
                              <a
                                href={c.voice_sample_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Play className="h-3 w-3" /> Sample
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg"
                            disabled={charUpdatingVoiceId === c.id}
                            onClick={() => {
                              setEditingVoiceChar(c);
                              setEditPlaceholderVoice(!!c.is_placeholder_voice);
                              setEditVoiceSample(null);
                              if (editVoiceInputRef.current) editVoiceInputRef.current.value = "";
                            }}
                          >
                            {charUpdatingVoiceId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-destructive hover:text-destructive"
                            disabled={charDeletingId === c.id}
                            onClick={() => handleDeleteGlobalCharacter(c.id)}
                          >
                            {charDeletingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingVoiceChar} onOpenChange={(open) => !open && setEditingVoiceChar(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit voice</DialogTitle>
            <DialogDescription>
              {editingVoiceChar?.name} — toggle placeholder voice or upload a new voice sample.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={editPlaceholderVoice}
                onCheckedChange={(v) => setEditPlaceholderVoice(v === true)}
              />
              Placeholder voice
            </label>
            <div className="space-y-2">
              <label className="text-sm font-medium">Voice sample (optional)</label>
              <Input
                ref={editVoiceInputRef}
                type="file"
                accept="audio/*"
                className="rounded-xl"
                onChange={(e) => setEditVoiceSample(e.target.files?.[0] ?? null)}
              />
              {editVoiceSample && <p className="text-xs text-muted-foreground">{editVoiceSample.name}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditingVoiceChar(null)}>
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              disabled={charUpdatingVoiceId !== null}
              onClick={() => editingVoiceChar && handleUpdateCharacterVoice(editingVoiceChar.id, editPlaceholderVoice, editVoiceSample)}
            >
              {charUpdatingVoiceId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!viewVideosUser} onOpenChange={(open) => !open && setViewVideosUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Videos</SheetTitle>
            <SheetDescription>
              {viewVideosUser?.email} · {viewVideosUser?.videoCount ?? 0} total
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 pr-6">
            {viewVideosUser?.videos.length ? (
              viewVideosUser.videos.map((video) => {
                const isExpanded = expandedVideos.has(video.id);
                const hasSubtitles = video.srt_text && video.srt_text.trim().length > 0;
                const subtitleText = video.srt_text || "No subtitles available";
                return (
                  <div
                    key={video.id}
                    className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-foreground text-sm truncate flex-1" title={video.title}>
                        {video.title || "Untitled"}
                      </p>
                      <Badge variant={video.final_url ? "default" : "secondary"} className="rounded-full shrink-0 text-xs">
                        {video.final_url ? "Completed" : "Draft"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {video.preview_url && (
                        <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => window.open(video.preview_url!, "_blank")}>
                          <Play className="h-3 w-3 mr-1" /> Preview <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                      {video.final_url && (
                        <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => window.open(video.final_url!, "_blank")}>
                          <Video className="h-3 w-3 mr-1" /> Final <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                      {hasSubtitles && (
                        <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => toggleVideoExpansion(video.id)}>
                          {isExpanded ? <><ChevronUp className="h-3 w-3 mr-1" /> Hide</> : <><FileText className="h-3 w-3 mr-1" /> Subtitles</>}
                        </Button>
                      )}
                    </div>
                    {isExpanded && hasSubtitles && (
                      <div className="pt-2 border-t border-border/40">
                        <p className="text-xs font-medium mb-2">Subtitles (SRT):</p>
                        <pre className="text-xs bg-muted/60 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                          {subtitleText}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground py-4">No videos</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!billingUser} onOpenChange={(open) => !open && setBillingUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Billing</SheetTitle>
            <SheetDescription>
              {billingUser?.email} · Payment history
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 pr-2">
            {billingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : billingTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No transactions</p>
            ) : (
              <div className="rounded-xl border border-border/40 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[11px] font-medium text-muted-foreground border-b border-border/40">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-4 truncate">Reference</div>
                  <div className="col-span-2 text-right">Type</div>
                </div>
                {billingTransactions.map((t) => (
                  <div
                    key={t.id}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 items-center border-b border-border/30 last:border-0 text-xs ${t.status === "failed" ? "bg-destructive/10" : ""}`}
                  >
                    <div className="col-span-2 text-muted-foreground">
                      {format(new Date(t.createdAt), "MMM d, yyyy")}
                    </div>
                    <div className="col-span-2 font-medium">
                      {t.currency} {(t.amountCents / 100).toFixed(2)}
                    </div>
                    <div className="col-span-2">
                      <Badge variant={t.status === "success" ? "default" : t.status === "failed" ? "destructive" : "secondary"} className="text-[10px] rounded">
                        {t.status}
                      </Badge>
                    </div>
                    <div className="col-span-4 truncate text-muted-foreground" title={t.reference}>
                      {t.reference}
                    </div>
                    <div className="col-span-2 text-right text-muted-foreground text-[11px]">
                      {t.eventType ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!impersonateUser} onOpenChange={(open) => !open && setImpersonateUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Login as user</DialogTitle>
            <DialogDescription>
              You will be signed in as <span className="font-medium text-foreground">{impersonateUser?.email}</span>. Enter the special admin impersonate password to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium text-muted-foreground">Password</label>
            <Input
              type="password"
              placeholder="Impersonate password"
              value={impersonatePassword}
              onChange={(e) => setImpersonatePassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleImpersonateSubmit()}
              className="rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setImpersonateUser(null)} disabled={impersonateLoading} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleImpersonateSubmit} disabled={impersonateLoading || !impersonatePassword.trim()} className="rounded-xl">
              {impersonateLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating link…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Continue
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
