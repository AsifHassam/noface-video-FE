"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { templatesApi, automationApi } from "@/lib/api/projects";
import { uploadImageToStorage } from "@/lib/api/ugc-videos";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getCachedToken, refreshToken } from "@/lib/utils/token-cache";
import { getInstagramLoginUrl } from "@/lib/instagram-oauth";
import { config } from "@/lib/config";
import type { VideoTemplate } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Instagram, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type AutomationRule = {
  id: string;
  name: string | null;
  timezone: string;
  schedule: {
    createTime?: string;
    postTime?: string;
    includeStockImages?: boolean;
    days?: number[];
  };
  enabled: boolean;
  template_id: string | null;
  project_type: string | null;
  created_at: string;
};

type ScriptQueueItem = {
  id: string;
  template_id: string;
  script: string;
  instagram_caption: string | null;
  create_at: string;
  post_at: string;
  status: string;
  video_url: string | null;
  error: string | null;
  created_at: string;
};

function isAutomationSupportedProjectType(projectType: string | undefined): boolean {
  if (!projectType) return true;
  const u = String(projectType).toUpperCase();
  if (u.includes("TEXTING")) return false;
  if (u.includes("UGC")) return false;
  if (u.includes("TWO_CHAR")) return true;
  const p = String(projectType).toLowerCase();
  return (
    p.includes("story") ||
    p === "normal_story" ||
    p === "reddit_story" ||
    p === "story_narration"
  );
}

function isTwoCharTemplate(projectType: string | undefined): boolean {
  if (!projectType) return false;
  return String(projectType).toUpperCase().includes("TWO_CHAR");
}

function templateRequiresImageOverlayUpload(template?: VideoTemplate | null): boolean {
  if (!template) return false;
  const extras = (template as any).templateExtras || {};
  const includes = extras?.includes || {};
  const snapshots = extras?.snapshots || {};
  const imageOverlays = Array.isArray(snapshots?.imageOverlays) ? snapshots.imageOverlays : [];
  return includes?.imageOverlays !== false && imageOverlays.length > 0;
}

function validateTwoCharScriptFormat(script: string): { valid: boolean; error?: string } {
  const rawLines = script
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (rawLines.length < 2) {
    return { valid: false, error: "Script must contain at least 2 dialogue lines." };
  }

  const speakers = new Set<string>();
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    // Accept:
    // 1) A: hello / B: hello
    // 2) [Elon]: hello / [Jensen]: hello
    const match = line.match(/^(?:([ABab])|\[([^\]]+)\])\s*:\s*(.+)$/);
    if (!match) {
      return {
        valid: false,
        error: `Line ${i + 1} is invalid. Use "A: text", "B: text", or "[Name]: text".`,
      };
    }

    const text = (match[3] || "").trim();
    if (!text) {
      return { valid: false, error: `Line ${i + 1} has no dialogue text after ":"` };
    }

    const speaker = (match[1] || match[2] || "").trim().toLowerCase();
    if (!speaker) {
      return { valid: false, error: `Line ${i + 1} has an invalid speaker label.` };
    }
    speakers.add(speaker);
  }

  if (speakers.size !== 2) {
    return {
      valid: false,
      error: "Script must have exactly 2 speakers across all lines.",
    };
  }

  return { valid: true };
}

function isLikelyAuthError(err: unknown): boolean {
  const message = (err as any)?.message ? String((err as any).message).toLowerCase() : "";
  const code = (err as any)?.code ? String((err as any).code).toLowerCase() : "";
  return (
    message.includes("jwt") ||
    message.includes("auth") ||
    message.includes("token") ||
    message.includes("unauthorized") ||
    message.includes("not authenticated") ||
    code.includes("401")
  );
}

export default function AutomatePage() {
  const REQUEST_TIMEOUT_MS = 15000;
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const userId = authUser?.id ?? null;
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [igConnected, setIgConnected] = useState<boolean | null>(null);
  const [igConnectedAccount, setIgConnectedAccount] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>("");
  const [timezone, setTimezone] = useState("UTC");
  const [videoCreateTime, setVideoCreateTime] = useState("17:00");
  const [postTime, setPostTime] = useState("18:00");
  const [includeStockImages, setIncludeStockImages] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const [queueSaving, setQueueSaving] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [activeAddRuleId, setActiveAddRuleId] = useState<string | null>(null);
  const [activeEditRuleId, setActiveEditRuleId] = useState<string | null>(null);
  const [editingRuleSaving, setEditingRuleSaving] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTemplateId, setEditTemplateId] = useState<string>("");
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [editCreateTime, setEditCreateTime] = useState("17:00");
  const [editPostTime, setEditPostTime] = useState("18:00");
  const [editIncludeStockImages, setEditIncludeStockImages] = useState(false);
  const [editEnabled, setEditEnabled] = useState(true);
  const [draftScript, setDraftScript] = useState("");
  const [draftCaption, setDraftCaption] = useState("");
  const [draftOverlayImageUrl, setDraftOverlayImageUrl] = useState("");
  const twoCharTemplates = templates.filter((t) => isTwoCharTemplate(t.projectType));
  const [overlayUploadBusy, setOverlayUploadBusy] = useState(false);
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const isLoadingRef = useRef(false);
  const scriptValidation = validateTwoCharScriptFormat(draftScript);

  const withTimeout = useCallback(
    async <T,>(promise: Promise<T>, errorMessage: string): Promise<T> => {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(errorMessage)), REQUEST_TIMEOUT_MS)
        ),
      ]);
    },
    []
  );

  const runSupabaseWithAuthRetry = useCallback(
    async <T,>(
      op: () => any,
      timeoutMessage: string
    ): Promise<{ data: T | null; error: any }> => {
      let result = await withTimeout(Promise.resolve(op()), timeoutMessage);
      if (result?.error && isLikelyAuthError(result.error)) {
        await withTimeout(
          supabase.auth.refreshSession(),
          "Session refresh timed out. Please try again."
        );
        result = await withTimeout(Promise.resolve(op()), timeoutMessage);
      }
      return result;
    },
    [withTimeout]
  );

  const supabaseRestGetWithAuthRetry = useCallback(
    async <T,>(pathWithQuery: string, timeoutMessage: string): Promise<T> => {
      const supabaseUrl = config.supabaseUrl;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase configuration missing");
      }

      const getOnce = async (token: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          return await fetch(`${supabaseUrl}/rest/v1/${pathWithQuery}`, {
            method: "GET",
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let token = await withTimeout(
        getCachedToken(userId || undefined),
        "Auth token lookup timed out"
      );
      if (!token) {
        throw new Error("No auth token available");
      }

      let response = await withTimeout(getOnce(token), timeoutMessage);
      if (response.status === 401) {
        const refreshed = await withTimeout(
          refreshToken(userId || undefined),
          "Session refresh timed out"
        );
        if (refreshed) {
          token = refreshed;
          response = await withTimeout(getOnce(token), timeoutMessage);
        }
      }
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Supabase REST failed (${response.status})`);
      }
      return (await response.json()) as T;
    },
    [withTimeout, userId]
  );

  const load = useCallback(async () => {
    if (!userId || isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoadingData(true);
    setLoading(true);
    try {
      const [tplRes, rulesRes, igRes] = await Promise.allSettled([
        templatesApi.list({ limit: 100 }),
        supabaseRestGetWithAuthRetry<AutomationRule[]>(
          `automation_rules?select=*&user_id=eq.${encodeURIComponent(
            userId
          )}&order=created_at.desc`,
          "Rules request timed out"
        ),
        supabaseRestGetWithAuthRetry<Array<{ id: string }>>(
          `user_instagram_connections?select=id&user_id=eq.${encodeURIComponent(
            userId
          )}&limit=1`,
          "Instagram status request timed out"
        ),
      ] as const);

      if (tplRes.status === "fulfilled") {
        setTemplates(tplRes.value.templates || []);
      } else {
        console.error("[automate/load] templates error:", tplRes.reason);
        setTemplates([]);
        toast.error("Templates failed to load", { id: "automate-templates-load-error" });
      }

      if (rulesRes.status === "fulfilled") {
        setRules((rulesRes.value as AutomationRule[]) || []);
      } else {
        console.error("[automate/load] rules error:", rulesRes.reason);
        setRules([]);
        toast.error("Rules failed to load", { id: "automate-rules-load-error" });
      }

      if (igRes.status === "fulfilled") {
        const igRows = igRes.value || [];
        const connected = igRows.length > 0;
        setIgConnected(connected);
        if (!connected) {
          setIgConnectedAccount(null);
        } else {
          try {
            const token = await getCachedToken(userId || undefined);
            if (token) {
              const connRes = await fetch("/api/auth/instagram/connection", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (connRes.ok) {
                const connJson = (await connRes.json()) as {
                  connected?: boolean;
                  username?: string | null;
                  igUserId?: string | null;
                };
                if (connJson.connected) {
                  setIgConnectedAccount(
                    connJson.username ? `@${connJson.username}` : connJson.igUserId || null
                  );
                } else {
                  setIgConnectedAccount(null);
                }
              } else {
                setIgConnectedAccount(null);
              }
            } else {
              setIgConnectedAccount(null);
            }
          } catch {
            setIgConnectedAccount(null);
          }
        }
      } else {
        console.error("[automate/load] instagram status error:", igRes.reason);
        setIgConnected(false);
        setIgConnectedAccount(null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load automation data", { id: "automate-load-error" });
    } finally {
      setLoading(false);
      setIsLoadingData(false);
      isLoadingRef.current = false;
    }
  }, [userId, supabaseRestGetWithAuthRetry]);

  useEffect(() => {
    if (!authLoading && userId) {
      load();
    }
    if (!authLoading && !userId) setLoading(false);
  }, [authLoading, userId, load]);

  const handleConnectInstagram = () => {
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem("ig_oauth_state", state);
      window.location.href = getInstagramLoginUrl(state);
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "Set NEXT_PUBLIC_INSTAGRAM_APP_ID (or META), META_APP_SECRET, NEXT_PUBLIC_META_REDIRECT_URI"
      );
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Sign in required");
      return;
    }
    if (!templateId) {
      toast.error("Choose a template");
      return;
    }
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) {
      toast.error("Invalid template");
      return;
    }
    if (!isAutomationSupportedProjectType(tpl.projectType)) {
      toast.error("Automation supports story or 2-character templates only.");
      return;
    }
    if (!isTwoCharTemplate(tpl.projectType)) {
      toast.error("Please choose a 2-character template.");
      return;
    }
    if (!videoCreateTime || !postTime) {
      toast.error("Set both video creation time and post time");
      return;
    }
    setSaving(true);
    try {
      const nextRun = new Date(Date.now() + 60 * 1000).toISOString();
      const { error } = await runSupabaseWithAuthRetry(
        () =>
          supabase.from("automation_rules").insert({
            user_id: userId,
            template_id: templateId,
            name: name.trim() || `Automation ${new Date().toLocaleDateString()}`,
            niche_prompt: "",
            timezone,
            schedule: {
              createTime: videoCreateTime,
              postTime,
              includeStockImages,
              days: [1, 2, 3, 4, 5, 6, 7],
            },
            enabled,
            project_type: tpl.projectType,
            next_run_at: nextRun,
          }),
        "Create rule request timed out"
      );
      if (error) throw error;
      toast.success("Automation rule created");
      setName("");
      load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: AutomationRule, on: boolean) => {
    const { error } = await runSupabaseWithAuthRetry(
      () => supabase.from("automation_rules").update({ enabled: on }).eq("id", rule.id),
      "Toggle rule request timed out"
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: on } : r)));
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this automation?")) return;
    const { error } = await runSupabaseWithAuthRetry(
      () => supabase.from("automation_rules").delete().eq("id", id),
      "Delete rule request timed out"
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Deleted");
  };

  const startEditRule = (rule: AutomationRule) => {
    setActiveEditRuleId(rule.id);
    setEditName(rule.name || "");
    setEditTemplateId(rule.template_id || "");
    setEditTimezone(rule.timezone || "UTC");
    setEditCreateTime(rule.schedule?.createTime || "17:00");
    setEditPostTime(rule.schedule?.postTime || "18:00");
    setEditIncludeStockImages(!!rule.schedule?.includeStockImages);
    setEditEnabled(!!rule.enabled);
  };

  const cancelEditRule = () => {
    setActiveEditRuleId(null);
    setEditingRuleSaving(false);
  };

  const saveEditRule = async (rule: AutomationRule) => {
    if (!editTemplateId) {
      toast.error("Choose a template");
      return;
    }
    const tpl = templates.find((t) => t.id === editTemplateId);
    if (!tpl) {
      toast.error("Invalid template");
      return;
    }
    if (!isAutomationSupportedProjectType(tpl.projectType)) {
      toast.error("Automation supports story or 2-character templates only.");
      return;
    }
    if (!isTwoCharTemplate(tpl.projectType)) {
      toast.error("Please choose a 2-character template.");
      return;
    }
    if (!editCreateTime || !editPostTime) {
      toast.error("Set both video creation time and post time");
      return;
    }
    setEditingRuleSaving(true);
    try {
      const { error } = await runSupabaseWithAuthRetry(
        () =>
          supabase
            .from("automation_rules")
            .update({
              name: editName.trim() || null,
              template_id: editTemplateId,
              timezone: editTimezone,
              enabled: editEnabled,
              project_type: tpl.projectType,
              schedule: {
                createTime: editCreateTime,
                postTime: editPostTime,
                includeStockImages: editIncludeStockImages,
                days: [1, 2, 3, 4, 5, 6, 7],
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", rule.id),
        "Save rule request timed out"
      );
      if (error) throw error;
      toast.success("Rule updated");
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id
            ? {
                ...r,
                name: editName.trim() || null,
                template_id: editTemplateId,
                timezone: editTimezone,
                enabled: editEnabled,
                project_type: tpl.projectType,
                schedule: {
                  createTime: editCreateTime,
                  postTime: editPostTime,
                  includeStockImages: editIncludeStockImages,
                  days: [1, 2, 3, 4, 5, 6, 7],
                },
              }
            : r
        )
      );
      cancelEditRule();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update rule");
      setEditingRuleSaving(false);
    }
  };

  const uploadOverlayImage = async (file: File | null) => {
    if (!file || !userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    setOverlayUploadBusy(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "png";
      const fileName = `automation-overlay-${crypto.randomUUID()}.${ext}`;
      const url = await uploadImageToStorage(file, fileName);
      if (!url) {
        throw new Error("Failed to resolve uploaded image URL");
      }

      setDraftOverlayImageUrl(url);

      toast.success("Overlay image uploaded");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to upload image");
    } finally {
      setOverlayUploadBusy(false);
    }
  };

  const handleQueueScriptForRule = async (rule: AutomationRule) => {
    if (authLoading) {
      toast.error("Auth is still loading. Please wait a second and try again.");
      return;
    }
    if (!userId) {
      toast.error("Sign in required");
      return;
    }
    if (!rule.template_id || !draftScript.trim()) {
      toast.error("Add script text");
      return;
    }
    if (!scriptValidation.valid) {
      toast.error(scriptValidation.error || "Invalid script format");
      return;
    }
    const createTime = rule.schedule?.createTime;
    const pTime = rule.schedule?.postTime;
    if (!createTime || !pTime) {
      toast.error("Rule must have both creation and post times");
      return;
    }
    const tpl = templates.find((t) => t.id === rule.template_id);
    if (!tpl || !isAutomationSupportedProjectType(tpl.projectType)) {
      toast.error("Pick a supported story or 2-character template");
      return;
    }
    if (templateRequiresImageOverlayUpload(tpl) && !draftOverlayImageUrl) {
      toast.error("Upload an overlay image for this script.");
      return;
    }

    const now = new Date();
    const [createH, createM] = createTime.split(":").map((n) => Number(n));
    const [postH, postM] = pTime.split(":").map((n) => Number(n));
    const createAt = new Date(now);
    createAt.setHours(createH, createM, 0, 0);
    const postAt = new Date(now);
    postAt.setHours(postH, postM, 0, 0);
    if (postAt.getTime() <= createAt.getTime()) {
      postAt.setDate(postAt.getDate() + 1);
    }

    setQueueSaving(true);
    try {
      const insertPayload = {
        user_id: userId,
        template_id: rule.template_id,
        project_type: tpl.projectType,
        script: draftScript.trim(),
        instagram_caption: draftCaption.trim() || null,
        overlay_image_url: draftOverlayImageUrl || null,
        create_at: createAt.toISOString(),
        post_at: postAt.toISOString(),
        status: "queued_create",
      };

      const supabaseUrl = config.supabaseUrl;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase configuration missing for queue insert.");
      }

      const postQueueItem = async (token: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          return await fetch(`${supabaseUrl}/rest/v1/automation_script_queue`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify(insertPayload),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let token = await withTimeout(
        getCachedToken(userId),
        "Auth token lookup timed out. Please retry."
      );
      if (!token) {
        throw new Error("No auth token available. Please sign in again.");
      }

      let response = await postQueueItem(token);
      if (response.status === 401) {
        const refreshed = await withTimeout(
          refreshToken(userId),
          "Session refresh timed out. Please retry."
        );
        if (refreshed) {
          token = refreshed;
          response = await postQueueItem(token);
        }
      }
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(errorText || `Queue request failed (${response.status})`);
      }

      toast.success("Script queued");
      setDraftScript("");
      setDraftCaption("");
      setDraftOverlayImageUrl("");
      setActiveAddRuleId(null);
      load();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to queue script");
    } finally {
      setQueueSaving(false);
    }
  };

  const handleGenerateCaptionForRule = async (rule: AutomationRule) => {
    if (!draftScript.trim()) {
      toast.error("Add a script first");
      return;
    }
    if (!scriptValidation.valid) {
      toast.error(scriptValidation.error || "Invalid script format");
      return;
    }
    const tpl = templates.find((t) => t.id === rule.template_id);
    setCaptionLoading(true);
    try {
      const res = await automationApi.generateCaptionFromScript(draftScript, tpl?.name);
      if (!res.success || !res.caption) {
        throw new Error("No caption returned");
      }
      setDraftCaption(res.caption);
      toast.success("Caption generated");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to generate caption");
    } finally {
      setCaptionLoading(false);
    }
  };

  if (!authLoading && !userId && !loading) {
    return <p className="text-muted-foreground">Please sign in.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automate</h1>
        <p className="text-muted-foreground mt-1">
          Manual script queue. Cron handles video creation and posting on your configured times.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Instagram</CardTitle>
            <CardDescription>
              Uses Instagram Login (<code className="text-xs">api.instagram.com</code>) with a
              Creator/Business account.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={igConnected ? "outline" : "default"}
            onClick={handleConnectInstagram}
          >
            <Instagram className="mr-2 h-4 w-4" />
            {igConnected ? "Reconnect" : "Connect"}
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Status: {igConnected === null ? "…" : igConnected ? "Connected" : "Not connected"}
          </p>
          {igConnected && igConnectedAccount ? (
            <p className="text-xs text-muted-foreground mt-1">
              Connected account: <span className="font-medium">{igConnectedAccount}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New automation</CardTitle>
          <CardDescription>
            Configure template + timezone + creation/post times. AI script generation has been removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 max-w-lg">
            <div className="grid gap-2">
              <Label htmlFor="auto-name">Name (optional)</Label>
              <Input
                id="auto-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Morning finance reel"
              />
            </div>
            <div className="grid gap-2">
              <Label>Template *</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select saved template" />
                </SelectTrigger>
                <SelectContent>
                  {[...twoCharTemplates]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.projectType})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only 2-character templates are available for automation.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tz">Timezone (IANA)</Label>
              <Input
                id="tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="UTC"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="create-time">Video creation time *</Label>
                <Input
                  id="create-time"
                  type="time"
                  value={videoCreateTime}
                  onChange={(e) => setVideoCreateTime(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="post-time">Post time *</Label>
                <Input
                  id="post-time"
                  type="time"
                  value={postTime}
                  onChange={(e) => setPostTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="en" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="en">Enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="stock-images"
                checked={includeStockImages}
                onCheckedChange={setIncludeStockImages}
              />
              <Label htmlFor="stock-images">Include stock images (Freepik auto overlays)</Label>
            </div>
            <Button type="submit" disabled={saving || loading || queueSaving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Create rule
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your rules</CardTitle>
          <CardDescription>Pause, resume, or remove automations.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rules yet.</p>
          ) : (
            <ul className="space-y-3">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <div>
                    <p className="font-medium">{r.name || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      TZ: {r.timezone || "UTC"} | Create: {r.schedule?.createTime || "—"} | Post:{" "}
                      {r.schedule?.postTime || "—"} | Stock images:{" "}
                      {r.schedule?.includeStockImages ? "On" : "Off"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        activeEditRuleId === r.id ? cancelEditRule() : startEditRule(r)
                      }
                    >
                      {activeEditRuleId === r.id ? "Close edit" : "Edit rule"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActiveAddRuleId((prev) => (prev === r.id ? null : r.id));
                        if (activeAddRuleId !== r.id) {
                          setDraftScript("");
                          setDraftCaption("");
                          setDraftOverlayImageUrl("");
                        }
                      }}
                    >
                      Add script
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `/app/automate/queue?ruleId=${encodeURIComponent(r.id)}&templateId=${encodeURIComponent(
                            r.template_id || ""
                          )}`,
                          "_blank"
                        )
                      }
                    >
                      Queue
                    </Button>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.enabled}
                        onCheckedChange={(v) => toggleRule(r, v)}
                      />
                      <span className="text-xs text-muted-foreground">On</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteRule(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {activeEditRuleId === r.id ? (
                    <div className="w-full mt-3 rounded-lg border p-3 space-y-3">
                      <div className="grid gap-2">
                        <Label htmlFor={`edit-name-${r.id}`}>Name</Label>
                        <Input
                          id={`edit-name-${r.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Rule name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Template</Label>
                        <Select value={editTemplateId} onValueChange={setEditTemplateId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {[...twoCharTemplates]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name} ({t.projectType})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`edit-tz-${r.id}`}>Timezone (IANA)</Label>
                        <Input
                          id={`edit-tz-${r.id}`}
                          value={editTimezone}
                          onChange={(e) => setEditTimezone(e.target.value)}
                        />
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label htmlFor={`edit-create-${r.id}`}>Video creation time</Label>
                          <Input
                            id={`edit-create-${r.id}`}
                            type="time"
                            value={editCreateTime}
                            onChange={(e) => setEditCreateTime(e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`edit-post-${r.id}`}>Post time</Label>
                          <Input
                            id={`edit-post-${r.id}`}
                            type="time"
                            value={editPostTime}
                            onChange={(e) => setEditPostTime(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`edit-stock-${r.id}`}
                          checked={editIncludeStockImages}
                          onCheckedChange={setEditIncludeStockImages}
                        />
                        <Label htmlFor={`edit-stock-${r.id}`}>Include stock images</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`edit-enabled-${r.id}`}
                          checked={editEnabled}
                          onCheckedChange={setEditEnabled}
                        />
                        <Label htmlFor={`edit-enabled-${r.id}`}>Enabled</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => saveEditRule(r)}
                          disabled={editingRuleSaving}
                        >
                          {editingRuleSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving…
                            </>
                          ) : (
                            "Save changes"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={cancelEditRule}
                          disabled={editingRuleSaving}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {activeAddRuleId === r.id ? (
                    <div className="w-full mt-3 rounded-lg border p-3 space-y-2">
                      {(() => {
                        const ruleTemplate = templates.find((t) => t.id === r.template_id);
                        const needsOverlay = templateRequiresImageOverlayUpload(ruleTemplate);
                        if (!needsOverlay) return null;
                        return (
                          <div className="grid gap-2">
                            <Label htmlFor={`queue-overlay-upload-${r.id}`}>Overlay image *</Label>
                            <Input
                              id={`queue-overlay-upload-${r.id}`}
                              type="file"
                              accept="image/*"
                              disabled={overlayUploadBusy}
                              onChange={(e) => uploadOverlayImage(e.target.files?.[0] || null)}
                            />
                            {draftOverlayImageUrl ? (
                              <p className="text-xs text-muted-foreground break-all">
                                Uploaded: {draftOverlayImageUrl}
                              </p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                This template contains image overlays. Upload the image for this script.
                              </p>
                            )}
                          </div>
                        );
                      })()}
                      <Label htmlFor={`script-${r.id}`}>Script</Label>
                      <Textarea
                        id={`script-${r.id}`}
                        value={draftScript}
                        onChange={(e) => setDraftScript(e.target.value)}
                        rows={6}
                        placeholder={'For two-char templates use A:/B: lines, e.g.\nA: Hey...\nB: ...'}
                      />
                      {draftScript.trim() && !scriptValidation.valid ? (
                        <p className="text-xs text-destructive">{scriptValidation.error}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Valid formats: <code>A: hello</code>, <code>B: hello</code> or{" "}
                          <code>[Name]: hello</code>. Exactly 2 speakers required.
                        </p>
                      )}
                      <Label htmlFor={`caption-${r.id}`}>Instagram caption (optional)</Label>
                      <Textarea
                        id={`caption-${r.id}`}
                        value={draftCaption}
                        onChange={(e) => setDraftCaption(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateCaptionForRule(r)}
                          disabled={captionLoading || !draftScript.trim() || !scriptValidation.valid}
                        >
                          {captionLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating caption…
                            </>
                          ) : (
                            "Generate caption"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleQueueScriptForRule(r)}
                          disabled={
                            authLoading ||
                            queueSaving ||
                            !draftScript.trim() ||
                            !r.template_id ||
                            !scriptValidation.valid
                          }
                        >
                          {queueSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Queueing…
                            </>
                          ) : (
                            "Add to queue"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setActiveAddRuleId(null);
                            setDraftScript("");
                            setDraftCaption("");
                            setDraftOverlayImageUrl("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
