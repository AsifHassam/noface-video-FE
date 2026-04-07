import { config } from "@/lib/config";
import { getAuthToken } from "@/lib/api/projects";

const API_BASE = config.remotionServerUrl;
const CLONE_TIMEOUT_MS = 120_000;

export type CloneFromVideoParams = {
  videoUrl: string;
  characterAName: string;
  characterBName: string;
};

export type CloneFromVideoResult = {
  success: boolean;
  scriptText?: string;
  hookUsed?: string;
  transcriptPreview?: string;
  creditsDeducted?: number;
  remainingCredits?: number | null;
  error?: string;
  code?: string;
};

/**
 * POST /api/two-char/clone-from-video — Supadata transcript + LLM remix (2 credits on Remotion server).
 */
export async function cloneScriptFromVideo(
  params: CloneFromVideoParams
): Promise<CloneFromVideoResult> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLONE_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/api/two-char/clone-from-video`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        videoUrl: params.videoUrl.trim(),
        characterAName: params.characterAName.trim(),
        characterBName: params.characterBName.trim(),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const d = data as { error?: string; message?: string; code?: string };
      return {
        success: false,
        error:
          d.message ||
          d.error ||
          `Request failed (${res.status})`,
        code: d.code,
      };
    }

    if (!data.success || typeof data.scriptText !== "string") {
      return {
        success: false,
        error: (data as { error?: string }).error || "Invalid response",
        code: (data as { code?: string }).code,
      };
    }

    return {
      success: true,
      scriptText: data.scriptText,
      hookUsed: data.hookUsed,
      transcriptPreview: data.transcriptPreview,
      creditsDeducted: data.creditsDeducted,
      remainingCredits: data.remainingCredits,
    };
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : "Request failed";
    if (msg.includes("abort") || msg === "The user aborted a request.") {
      return {
        success: false,
        error: "Request timed out — try a shorter video or try again.",
        code: "TIMEOUT",
      };
    }
    return { success: false, error: msg };
  }
}

export const CLONE_FROM_VIDEO_CREDITS = 2;
