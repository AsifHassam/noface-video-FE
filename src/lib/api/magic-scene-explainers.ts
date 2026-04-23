import { config } from "@/lib/config";
import { getCachedToken, refreshToken } from "@/lib/utils/token-cache";
import { getAccessTokenFromStorage } from "@/lib/auth-rest";

const API_BASE_URL = config.remotionServerUrl;

export type SceneExplainerCard = {
  sceneIndex: number;
  headline: string;
  subline: string;
  accentLabel?: string;
  accentHex?: string;
  /**
   * One of: fancy-split | fancy-minimal | subtitle-cinema
   *       | emphasis-explode | checklist-reveal | question-shrug
   *       | ticker-stack | vs-split | quote-card | reaction-burst
   */
  sceneStyle?: string;
  /** modern-sans | display-bold | elegant-serif */
  typographyStyle?: string;
  /** Verbatim script phrase; used to align beat start to narration */
  anchorText?: string;
  /** Set by server after Freepik search when the LLM requested a stock visual */
  stockImageUrl?: string;
  /** emphasis-explode: the single word that should dominate the frame. */
  heroWord?: string;
  /** checklist-reveal / ticker-stack: 2–5 short line items. */
  items?: string[];
  /** reaction-burst: a single emoji (or emoji pair) to explode in. */
  emoji?: string;
  /**
   * Contextual icon emoji that accents ANY card (topic badge, not a reaction).
   * Picked by the LLM from the script topic. Renders as a large motion element
   * on fancy-* / subtitle-cinema scenes. Falls back to nothing when unset.
   */
  iconEmoji?: string;
  /** vs-split: left-side label (e.g. "Myth"). */
  sideA?: string;
  /** vs-split: right-side label (e.g. "Truth"). */
  sideB?: string;
  /** Resolved Logo.dev image URL (set by server enrichment when a brand is detected). */
  logoUrl?: string;
  /** Display name of the detected brand (e.g. "Nvidia"). */
  logoBrand?: string;
};

async function getAuthToken(useCache = true): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    if (useCache) {
      const cached = await getCachedToken();
      if (cached) return cached;
    }
    return getAccessTokenFromStorage();
  } catch {
    return null;
  }
}

async function apiPost<T>(body: unknown, timeoutMs = 120000): Promise<T> {
  let token = await getAuthToken(true);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE_URL}/api/magic/scene-explainers`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const scriptChars =
    typeof body === "object" &&
    body !== null &&
    "script" in body &&
    typeof (body as { script: unknown }).script === "string"
      ? (body as { script: string }).script.length
      : 0;
  const sceneCount =
    typeof body === "object" &&
    body !== null &&
    "scenes" in body &&
    Array.isArray((body as { scenes: unknown }).scenes)
      ? (body as { scenes: unknown[] }).scenes.length
      : 0;
  console.log("[Magic explainer API] POST /api/magic/scene-explainers …", {
    scriptChars,
    sceneCount,
    timeoutMs,
    base: API_BASE_URL,
  });

  try {
    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 401) {
      const refreshed = await refreshToken();
      if (refreshed) {
        headers.Authorization = `Bearer ${refreshed}`;
        res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as { error?: string }).error || "Request failed");
    }
    const data = (await res.json()) as T;
    const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;
    const cardN =
      typeof data === "object" &&
      data !== null &&
      "cards" in data &&
      Array.isArray((data as { cards: unknown }).cards)
        ? (data as { cards: unknown[] }).cards.length
        : 0;
    console.log("[Magic explainer API] OK", { ms, cards: cardN });
    return data;
  } catch (e) {
    const ms = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;
    console.warn("[Magic explainer API] failed", { ms, error: e });
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

export const magicSceneExplainersApi = {
  /** Preferred: full script → many LLM beats (5–24 cards). */
  async getCardsFromScript(
    script: string
  ): Promise<{ success: boolean; cards: SceneExplainerCard[] }> {
    return apiPost<{ success: boolean; cards: SceneExplainerCard[] }>({ script });
  },

  /** Legacy: one card per scene chunk. */
  async getCards(scenes: string[]): Promise<{ success: boolean; cards: SceneExplainerCard[] }> {
    return apiPost<{ success: boolean; cards: SceneExplainerCard[] }>({ scenes });
  },
};
