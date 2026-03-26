"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { automationApi } from "@/lib/api/projects";
import { useAuthStore } from "@/lib/stores/auth-store";
import { getCachedToken, refreshToken } from "@/lib/utils/token-cache";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type QueueItem = {
  id: string;
  template_id: string;
  script: string;
  instagram_caption: string | null;
  overlay_image_url?: string | null;
  create_at: string;
  post_at: string;
  status: string;
  render_job_id?: string | null;
  video_url: string | null;
  error: string | null;
  created_at: string;
};

type RenderJobLite = {
  id: string;
  status: string;
  result_url: string | null;
};

const TIMELINE_STEPS = [
  "queued_create",
  "creating",
  "rendering",
  "ready_to_post",
  "posting",
  "posted",
] as const;

function getEffectiveStatus(item: QueueItem, job?: RenderJobLite) {
  if (item.status === "rendering" && job?.status?.toLowerCase() === "completed") {
    return "ready_to_post";
  }
  return item.status;
}

function getStepState(step: (typeof TIMELINE_STEPS)[number], effectiveStatus: string) {
  if (effectiveStatus === "failed") return "pending";
  const currentIdx = TIMELINE_STEPS.indexOf(effectiveStatus as (typeof TIMELINE_STEPS)[number]);
  const stepIdx = TIMELINE_STEPS.indexOf(step);
  if (currentIdx === -1) return "pending";
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "current";
  return "pending";
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

export default function AutomationQueuePage() {
  const REQUEST_TIMEOUT_MS = 15000;
  const GENERATE_WAIT_TIMEOUT_MS = 8 * 60 * 1000;
  const GENERATE_POLL_INTERVAL_MS = 2000;
  const search = useSearchParams();
  const templateId = search.get("templateId");
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const userId = authUser?.id ?? null;
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renderById, setRenderById] = useState<Record<string, RenderJobLite>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const restRequest = useCallback(
    async <T,>(method: "GET" | "DELETE", pathWithQuery: string): Promise<T> => {
      const supabaseUrl = config.supabaseUrl;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error("Supabase configuration missing");
      }

      const callOnce = async (token: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          return await fetch(`${supabaseUrl}/rest/v1/${pathWithQuery}`, {
            method,
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
              Prefer: method === "DELETE" ? "return=minimal" : "return=representation",
            },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      };

      let token = await getCachedToken(userId || undefined);
      if (!token) throw new Error("No auth token available");

      let response = await callOnce(token);
      if (response.status === 401) {
        const refreshedToken = await refreshToken(userId || undefined);
        if (refreshedToken) {
          token = refreshedToken;
          response = await callOnce(token);
        }
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Queue request failed (${response.status})`);
      }

      if (method === "DELETE") {
        return null as T;
      }
      return (await response.json()) as T;
    },
    [userId]
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    const baseQueueQuery = `automation_script_queue?select=*&user_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.desc&limit=100`;
    const queueQuery = templateId
      ? `${baseQueueQuery}&template_id=eq.${encodeURIComponent(templateId)}`
      : baseQueueQuery;
    const queue = (await restRequest<QueueItem[]>("GET", queueQuery)) || [];
    setItems(queue);
    const renderIds = queue
      .map((x) => x.render_job_id)
      .filter((x): x is string => typeof x === "string" && x.length > 0);
    if (renderIds.length > 0) {
      const inClause = renderIds.join(",");
      const jobs = await restRequest<Array<{ id: string; status: string; result_url: string | null }>>(
        "GET",
        `render_jobs?select=id,status,result_url&id=in.(${inClause})`
      );
      const map: Record<string, RenderJobLite> = {};
      (jobs || []).forEach((j) => {
        map[j.id] = {
          id: j.id,
          status: String(j.status || ""),
          result_url: j.result_url || null,
        };
      });
      setRenderById(map);
    } else {
      setRenderById({});
    }
    setLastRefreshedAt(new Date());
    return queue;
  }, [templateId, userId, restRequest]);

  // Realtime push updates while a generate/post action is active.
  useEffect(() => {
    if (!busyId) return;
    const channel = supabase
      .channel(`queue-item-${busyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automation_script_queue",
          filter: `id=eq.${busyId}`,
        },
        () => {
          refresh().catch((e) => console.error("Realtime refresh failed", e));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [busyId, refresh]);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        await refresh();
      } catch (e) {
        console.error(e);
        toast.error("Failed to load queue");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId, templateId, refresh]);

  useEffect(() => {
    if (!userId) return;
    const id = setInterval(() => {
      refresh().catch((e) => console.error("Auto-refresh failed", e));
    }, 10000);
    return () => clearInterval(id);
  }, [userId, refresh]);

  const canDelete = useMemo(
    () => (status: string) => !["posting", "posted"].includes(status),
    []
  );

  const deleteItem = async (id: string) => {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    if (!canDelete(item.status)) {
      toast.error("Cannot delete item that is posting/posted");
      return;
    }
    await restRequest("DELETE", `automation_script_queue?id=eq.${encodeURIComponent(id)}`);
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast.success("Deleted queue item");
  };

  const handleGenerateNow = async (id: string) => {
    setBusyId(id);
    try {
      await automationApi.queueGenerateNow(id);
      toast.success("Video generation started");

      const startedAt = Date.now();
      let ready = false;
      while (!ready && Date.now() - startedAt < GENERATE_WAIT_TIMEOUT_MS) {
        const queue = (await refresh()) || [];
        const item = queue.find((x) => x.id === id);
        const directUrl = item?.video_url || null;
        const jobUrl =
          item?.render_job_id && renderById[item.render_job_id]
            ? renderById[item.render_job_id].result_url
            : null;
        if (directUrl || jobUrl) {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, GENERATE_POLL_INTERVAL_MS));
      }

      if (ready) {
        toast.success("Video ready to view");
      } else {
        toast.message("Still rendering. We will keep auto-refreshing every 10s.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate now failed");
    } finally {
      setBusyId(null);
    }
  };

  const handlePostNow = async (id: string) => {
    setBusyId(id);
    try {
      const res = await automationApi.queuePostNow(id);
      if (res?.skipped) {
        toast.message(`Post skipped: ${res.reason || "not ready yet"}`);
      } else if (res?.posted) {
        toast.success("Posted to Instagram");
      } else {
        toast.success("Post now triggered");
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Post now failed");
    } finally {
      setBusyId(null);
    }
  };

  if (!authLoading && !userId) {
    return <p className="text-muted-foreground">Please sign in.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Script Queue</h1>
        <p className="text-muted-foreground mt-1">All queued scripts and generated captions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Items</CardTitle>
          <CardDescription>
            {templateId ? `Filtered by template ${templateId}` : "All templates"}{" "}
            (auto-refresh every 10s)
          </CardDescription>
          {lastRefreshedAt ? (
            <p className="text-xs text-muted-foreground">
              Last refreshed: {lastRefreshedAt.toLocaleTimeString()}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No queue items found.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border p-3 space-y-2">
                  {(() => {
                    const job = item.render_job_id ? renderById[item.render_job_id] : undefined;
                    const effectiveVideoUrl = item.video_url || job?.result_url || null;
                    const effectiveStatus = getEffectiveStatus(item, job);
                    return (
                      <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs">{effectiveStatus}</span>
                    <div className="flex items-center gap-1">
                      {effectiveVideoUrl ? (
                        <a
                          href={effectiveVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium"
                        >
                          View
                        </a>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerateNow(item.id)}
                        disabled={!!busyId}
                      >
                        {busyId === item.id ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Working…
                          </>
                        ) : (
                          effectiveVideoUrl ? "Regenerate" : "Generate video now"
                        )}
                      </Button>
                      {effectiveStatus === "posted" ? (
                        <span className="inline-flex h-8 items-center rounded-md bg-green-100 px-3 text-xs font-semibold text-green-700">
                          Posted
                        </span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handlePostNow(item.id)}
                          disabled={!!busyId}
                        >
                          Post now
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-7 w-7"
                        onClick={() => deleteItem(item.id)}
                        disabled={!canDelete(item.status) || !!busyId}
                        title="Delete queue item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Create: {new Date(item.create_at).toLocaleString()} | Post:{" "}
                    {new Date(item.post_at).toLocaleString()}
                  </p>
                  <div className="rounded-md border bg-muted/20 p-2">
                    <p className="text-xs font-medium mb-2">Timeline</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {TIMELINE_STEPS.map((step) => {
                        const state = getStepState(step, effectiveStatus);
                        const classes =
                          state === "done"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : state === "current"
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-muted text-muted-foreground border-border";
                        return (
                          <span
                            key={`${item.id}-${step}`}
                            className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium ${classes}`}
                          >
                            {step}
                          </span>
                        );
                      })}
                      {effectiveStatus === "failed" ? (
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700">
                          failed
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-xs font-medium mb-1">Script</p>
                    <p className="text-xs whitespace-pre-wrap">{item.script}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-2">
                    <p className="text-xs font-medium mb-1">Caption</p>
                    <p className="text-xs whitespace-pre-wrap">
                      {item.instagram_caption || "—"}
                    </p>
                  </div>
                  {item.overlay_image_url ? (
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs font-medium mb-2">Overlay image</p>
                      <a
                        href={item.overlay_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block"
                      >
                        <img
                          src={item.overlay_image_url}
                          alt="Uploaded overlay"
                          className="h-24 w-auto rounded border"
                        />
                      </a>
                      <a
                        href={item.overlay_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block text-xs text-primary underline break-all"
                      >
                        {item.overlay_image_url}
                      </a>
                    </div>
                  ) : null}
                  {effectiveVideoUrl ? (
                    <a
                      href={effectiveVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs underline"
                    >
                      Video
                    </a>
                  ) : null}
                  {item.error ? <p className="text-xs text-destructive">{item.error}</p> : null}
                      </>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

