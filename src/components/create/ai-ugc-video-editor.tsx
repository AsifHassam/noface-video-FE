"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Play, 
  Pause, 
  Plus, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon,
  Music,
  Type,
  FileText,
  Mic,
  Film,
  Volume2,
  VolumeX,
  Undo2,
  Redo2,
  Share2,
  Bell,
  HelpCircle,
  Settings,
  Maximize,
  ZoomIn,
  ZoomOut,
  Scissors,
  Hand,
  User,
  Move,
  RotateCw,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Gauge,
  X,
  Trash2,
  Loader2,
  Wand2,
  Download,
  CheckCircle2,
  Save,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Pencil,
  Sparkles,
  Snail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { v4 as uuid } from "uuid";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type { SubtitleSegment, SubtitleStyle, SubtitlePosition, SubtitleFontFamily } from "@/types";
import { CANVAS_SUBTITLE_DRAG_Z, CANVAS_SUBTITLE_Z } from "@/lib/canvas-subtitle-z";
import { SubtitleStyleSelector } from "./subtitle-style-selector";
import { getSubtitleStyle, OUTLINED_STYLE, STYLE_KARAOKE_PINK, STYLE_MAGIC_LOOPS, STYLE_BOLD_GREEN, STYLE_FANCY, STYLE_CHIP_TEXT, STYLE_CHIP_PILL } from "@/lib/data/subtitle-styles";
import { SubtitlesEditor } from "./subtitles-editor";
import { serializeSrt, parseSrtText } from "@/lib/utils/srt";
import { bRollsApi, type BRoll, type SceneStockBRollRow } from "@/lib/api/b-rolls";
import {
  magicSceneExplainersApi,
  type SceneExplainerCard,
} from "@/lib/api/magic-scene-explainers";
import { MagicSceneExplainerGraphic } from "./magic-scene-explainer-graphic";
import {
  createUGCProject,
  getUGCProject,
  updateUGCProject,
  saveVoiceGeneration,
  saveGeneratedVideo,
  getUserGeneratedVideos,
  uploadVideoToStorage,
  uploadAudioToStorage,
  getUserUploadedImages,
  getUserUploadedVideos,
  getUserUploadedAudios,
  deleteUploadedImage,
  deleteUploadedVideo,
  deleteUploadedAudio,
  deleteGeneratedVideo,
  base64ToBlob
} from "@/lib/api/ugc-videos";
import { subscriptionApi } from "@/lib/api/subscription";
import { listCharacters } from "@/lib/api/avatar";
import { checkApiKey } from "@/lib/api/custom-characters";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useProjectStore } from "@/lib/stores/project-store";
import type { UGCVideoProject, UGCGeneratedVideo } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/** Convert WebM (or other MediaRecorder) blob to WAV data URL for APIs that require mp3/wav/etc. */
async function convertWebmBlobToWavDataUrl(blob: Blob): Promise<string> {
  const ctx = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const dataLength = audioBuffer.length * numChannels * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataLength, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, dataLength, true);
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c));
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const s = Math.max(-1, Math.min(1, channels[c][i]));
        view.setInt16(44 + (i * numChannels + c) * 2, s < 0 ? s * 32768 : s * 32767, true);
      }
    }
    const wavBlob = new Blob([buffer], { type: "audio/wav" });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(wavBlob);
    });
  } finally {
    await ctx.close();
  }
}

/** Stub: split script into timed caption segments for Magic create (beta). */
function buildMagicCreateSubtitleSegments(script: string, totalMs: number): SubtitleSegment[] {
  const trimmed = script.trim();
  if (!trimmed || !Number.isFinite(totalMs) || totalMs <= 0) return [];
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const chunks =
    sentences.length > 0
      ? sentences
      : trimmed.match(/.{1,80}(\s|$)/g)?.map((s) => s.trim()) ?? [trimmed];
  const n = Math.max(1, chunks.length);
  const slice = totalMs / n;
  return chunks.slice(0, 40).map((text, i) => ({
    startMs: Math.round(i * slice),
    endMs: Math.round((i + 1) * slice),
    speaker: "A" as const,
    text: text.slice(0, 500),
  }));
}

/** Normalize STT /transcribe segment times (seconds) — API may use startSec/endSec, start/end, or snake_case. */
function sttSegmentTimesSec(seg: {
  startSec?: unknown;
  endSec?: unknown;
  start?: unknown;
  end?: unknown;
  start_sec?: unknown;
  end_sec?: unknown;
}): { startSec: number; endSec: number } | null {
  const num = (v: unknown): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  };
  const pickFirst = (...vals: unknown[]) => {
    for (const v of vals) {
      const n = num(v);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  };
  const startSec = pickFirst(seg.startSec, seg.start, seg.start_sec);
  const endSec = pickFirst(seg.endSec, seg.end, seg.end_sec);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) return null;
  return { startSec, endSec };
}

/** Transcribe a video URL via STT server → timeline subtitle segments (same rules as Generate Subtitles). */
async function transcribeUrlToSubtitleSegments(
  videoUrl: string,
  ctx: { timelineStartMs: number; videoStartOffsetMs: number; elementDurationMs: number }
): Promise<SubtitleSegment[]> {
  try {
    const res = await fetch(`${config.sttServerUrl}/transcribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioPath: videoUrl,
        language: "en",
        wordTimestamps: true,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { segments?: unknown[] };
    const segments = Array.isArray(data.segments) ? data.segments : [];
    const out: SubtitleSegment[] = [];
    const offSec = ctx.videoStartOffsetMs / 1000;
    const maxSec = ctx.elementDurationMs / 1000;
    for (const seg of segments) {
      const times = sttSegmentTimesSec(seg as Record<string, unknown>);
      if (!times) continue;
      const rawText =
        typeof (seg as { text?: unknown }).text === "string"
          ? (seg as { text: string }).text
          : "";
      const line = rawText.trim();
      if (!line) continue;
      const adjStart = times.startSec - offSec;
      const adjEnd = times.endSec - offSec;
      if (adjStart < 0 || adjEnd > maxSec + 0.05) continue;
      const startMs = Math.round(ctx.timelineStartMs + adjStart * 1000);
      const endMs = Math.round(ctx.timelineStartMs + adjEnd * 1000);
      if (endMs <= startMs) continue;
      out.push({ startMs, endMs, speaker: "A", text: line });
    }
    return out;
  } catch {
    return [];
  }
}

function captionTextForTimeRange(
  startMs: number,
  endMs: number,
  segments: SubtitleSegment[]
): string {
  if (!segments.length) return "";
  const overlapping = segments.filter((s) => s.endMs > startMs && s.startMs < endMs);
  if (overlapping.length === 0) return "";
  return overlapping
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Fill subtitle-cinema explainer layers with real caption lines for their timeline window. */
function applyCaptionTextToCinemaExplainers(
  elements: CanvasElement[],
  segments: SubtitleSegment[]
): CanvasElement[] {
  if (!segments.length) return elements;
  return elements.map((el) => {
    if (!el.magicSceneExplainer || el.explainerSceneStyle !== "subtitle-cinema") {
      return el;
    }
    const start = el.startTime ?? 0;
    const end = start + (el.duration ?? 5000);
    const cap = captionTextForTimeRange(start, end, segments);
    if (!cap) return el;
    return {
      ...el,
      text: cap,
      explainerSubline: undefined,
    };
  });
}

/**
 * Extend each subtitle-cinema beat until overlapping STT/caption segments finish; push later
 * explainer layers forward so the dimmed overlay does not cut off while speech continues.
 */
function stretchCinemaExplainerTimingsToCaptions(
  explainerElements: CanvasElement[],
  captionSegments: SubtitleSegment[],
  totalMs: number
): CanvasElement[] {
  if (!captionSegments.length || !explainerElements.length) {
    return explainerElements;
  }

  const out = explainerElements.map((e) => ({ ...e }));
  const sorted = out
    .filter((e) => e.magicSceneExplainer)
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

  if (sorted.length === 0) return out;

  for (let i = 0; i < sorted.length; i++) {
    const el = sorted[i]!;
    if (el.explainerSceneStyle !== "subtitle-cinema") continue;

    const start = el.startTime ?? 0;
    const nextEl = sorted[i + 1];
    const nextStart = nextEl ? nextEl.startTime ?? 0 : totalMs;

    const overlapping = captionSegments.filter(
      (s) => s.endMs > start && s.startMs < nextStart
    );
    let speechEnd = nextStart;
    if (overlapping.length > 0) {
      speechEnd = Math.max(speechEnd, ...overlapping.map((s) => s.endMs));
    }
    speechEnd = Math.min(speechEnd, totalMs);
    let newDur = Math.max(600, speechEnd - start);
    newDur = Math.min(CINEMA_BLACK_OVERLAY_MS, newDur);
    el.duration = newDur;
    el.explainerSegmentDurationMs = newDur;
    const effectiveEnd = start + newDur;

    const v = el.explainerGraphicVariant;
    if (v !== undefined) {
      for (const o of out) {
        if (o.magicSceneExplainerStock && o.explainerGraphicVariant === v) {
          o.duration = newDur;
          o.startTime = el.startTime;
        }
      }
    }

    if (effectiveEnd > nextStart + 0.5 && nextEl) {
      const shift = effectiveEnd - nextStart;
      for (let j = i + 1; j < sorted.length; j++) {
        const sib = sorted[j]!;
        sib.startTime = (sib.startTime ?? 0) + shift;
        const sv = sib.explainerGraphicVariant;
        if (sv !== undefined) {
          for (const o of out) {
            if (o.magicSceneExplainerStock && o.explainerGraphicVariant === sv) {
              o.startTime = sib.startTime;
            }
          }
        }
      }
    }
  }

  return out;
}

/**
 * Fixed intro sequence (first 9 seconds):
 *   0s – 4s : 50/50 split (main in bottom half + b-roll in top half)
 *   4s – 7s : subtitle-cinema (black full-frame overlay; main hidden)
 *   7s – 9s : full-screen b-roll (main hidden behind full-frame b-roll)
 * After 9s the layout scheduler takes over and the LLM-picked `mainMediaLayout`
 * drives each beat, capped by the 15% main-visible budget.
 */
const OPENING_SPLIT_MS = 4000;
/** Intro black-overlay length (4s→7s). Kept separate from the general cinema cap. */
const OPENING_CINEMA_MS = 3000;
/** Intro full-screen b-roll length (7s→9s). */
const OPENING_BROLL_FULL_MS = 2000;
/** End of the fixed intro. Post-intro scheduling starts here. */
const OPENING_TOTAL_MS = OPENING_SPLIT_MS + OPENING_CINEMA_MS + OPENING_BROLL_FULL_MS;

/** Each full-frame black (subtitle-cinema) overlay duration — fixed 2s for non-intro beats. */
const CINEMA_BLACK_OVERLAY_MS = 2000;
const MAX_EXPLAINER_SCENE_MS = 4000;

// NOTE: an earlier iteration enforced a hard 15% cap on main-video visibility
// post-intro. That was dropped because every text card MUST render against
// the main video (never b-roll) — b-roll only fills cinema tails / raw gaps.

/**
 * Align scene switches to spoken-phrase boundaries.
 *
 * The LLM picks anchor phrases in the script and we linearly map their char
 * offset to ms — which lands mid-sentence more often than not. That produces
 * a jumpcut feel when the layout flips (e.g. circle PiP → 50/50 → black
 * overlay) while the presenter is mid-word. This snaps each explainer beat's
 * start to the closest caption segment boundary (start or end of a phrase
 * line) within a window, so transitions fall on natural pauses instead.
 *
 * Stock-image companions (`magicSceneExplainerStock`) are shifted with their
 * parent beat. Durations are rebuilt to fill to the next beat's new start,
 * capped per-style; downstream `stretchCinemaExplainerTimingsToCaptions` and
 * `enforceExplainerOpeningAndMaxSceneDuration` still run afterwards.
 */
function snapExplainerStartsToCaptionBoundaries(
  explainerElements: CanvasElement[],
  captionSegments: SubtitleSegment[],
  totalMs: number,
  maxSnapMs = 1200
): CanvasElement[] {
  if (!captionSegments.length || !explainerElements.length) {
    return explainerElements;
  }

  const out = explainerElements.map((e) => ({ ...e }));
  const beats = out
    .filter((e) => e.magicSceneExplainer && !e.magicSceneExplainerStock)
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  if (beats.length === 0) return out;

  const boundaries = Array.from(
    new Set(
      captionSegments.flatMap((s) => [
        Math.max(0, Math.round(s.startMs)),
        Math.max(0, Math.round(s.endMs)),
      ])
    )
  )
    .filter((m) => Number.isFinite(m) && m >= 0 && m <= totalMs)
    .sort((a, b) => a - b);
  if (boundaries.length === 0) return out;

  const MIN_STEP = 600;

  const nearestBoundary = (t: number): number | null => {
    let lo = 0;
    let hi = boundaries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (boundaries[mid]! < t) lo = mid + 1;
      else hi = mid;
    }
    const candidates = [boundaries[lo]!];
    if (lo > 0) candidates.push(boundaries[lo - 1]!);
    let best = candidates[0]!;
    for (const c of candidates) {
      if (Math.abs(c - t) < Math.abs(best - t)) best = c;
    }
    return Math.abs(best - t) <= maxSnapMs ? best : null;
  };

  for (let i = 0; i < beats.length; i++) {
    const el = beats[i]!;
    const orig = Math.max(0, el.startTime ?? 0);
    if (i === 0 && orig < 400) continue;
    const snapped = nearestBoundary(orig);
    if (snapped == null) continue;
    const nextStart =
      i < beats.length - 1 ? beats[i + 1]!.startTime ?? totalMs : totalMs;
    if (snapped >= nextStart - MIN_STEP) continue;
    el.startTime = snapped;
  }

  for (let i = 1; i < beats.length; i++) {
    const prev = beats[i - 1]!.startTime ?? 0;
    if ((beats[i]!.startTime ?? 0) < prev + MIN_STEP) {
      beats[i]!.startTime = prev + MIN_STEP;
    }
  }

  for (let i = 0; i < beats.length; i++) {
    const el = beats[i]!;
    const start = Math.max(0, el.startTime ?? 0);
    const nextStart =
      i < beats.length - 1 ? beats[i + 1]!.startTime ?? totalMs : totalMs;
    const window = Math.max(MIN_STEP, Math.min(totalMs, nextStart) - start);
    const maxForStyle =
      el.explainerSceneStyle === "subtitle-cinema"
        ? CINEMA_BLACK_OVERLAY_MS
        : MAX_EXPLAINER_SCENE_MS;
    const dur = Math.max(MIN_STEP, Math.min(maxForStyle, window));
    el.duration = dur;
    el.explainerSegmentDurationMs = dur;

    const v = el.explainerGraphicVariant;
    if (v !== undefined) {
      for (const o of out) {
        if (o.magicSceneExplainerStock && o.explainerGraphicVariant === v) {
          o.startTime = start;
          o.duration = dur;
        }
      }
    }
  }

  return out;
}

/**
 * Force the new 3-stage opening sequence for explainer beats:
 *   0s – 4s  : main+b-roll 50/50 split (no explainer yet)
 *   4s – 7s  : first explainer beat, forced subtitle-cinema (black overlay, 3s)
 *   7s – 9s  : full-screen b-roll (main hidden; no explainer)
 *   9s+      : remaining LLM beats flow from OPENING_TOTAL_MS onward
 * Also hard-caps each explainer beat; non-intro subtitle-cinema beats are capped
 * at CINEMA_BLACK_OVERLAY_MS (2s) elsewhere, but the intro cinema is 3s.
 */
function enforceExplainerOpeningAndMaxSceneDuration(
  explainerElements: CanvasElement[],
  totalMs: number
): CanvasElement[] {
  if (!explainerElements.length || totalMs <= 0) return explainerElements;

  const out = explainerElements.map((e) => ({ ...e }));
  const textBeats = out
    .filter((e) => e.magicSceneExplainer)
    .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  if (!textBeats.length) return out;

  const introSplitEnd = Math.min(Math.max(0, OPENING_SPLIT_MS), totalMs);
  const introCinemaEnd = Math.min(totalMs, introSplitEnd + OPENING_CINEMA_MS);
  const introBrollEnd = Math.min(totalMs, introCinemaEnd + OPENING_BROLL_FULL_MS);
  const cinemaDur = Math.max(600, introCinemaEnd - introSplitEnd);

  // No explainer beat should begin before the split-screen intro has played.
  for (const beat of textBeats) {
    if ((beat.startTime ?? 0) < introSplitEnd) beat.startTime = introSplitEnd;
  }

  // Force the first explainer beat to be a 3s subtitle-cinema block at 4s→7s.
  const first = textBeats[0]!;
  first.startTime = introSplitEnd;
  first.duration = cinemaDur;
  first.explainerSegmentDurationMs = cinemaDur;
  first.explainerSceneStyle = "subtitle-cinema";
  first.height = 100;
  first.zIndex = 945;
  first.fontColor = "#ffffff";

  // Remaining beats must start AFTER the full 9s intro (split + cinema + full
  // b-roll). The 7s→9s full-frame b-roll window owns that slice on its own, so
  // no explainer overlay should compete with it.
  for (let i = 1; i < textBeats.length; i++) {
    const prev = textBeats[i - 1]!;
    const cur = textBeats[i]!;
    const prevStart = prev.startTime ?? 0;
    const prevDur = prev.duration ?? 600;
    const minStart = Math.max(introBrollEnd, prevStart + Math.max(600, prevDur));
    if ((cur.startTime ?? 0) < minStart) {
      cur.startTime = minStart;
    }
  }

  // Cap each beat to its available window; black overlay (cinema) max 2s.
  for (let i = 0; i < textBeats.length; i++) {
    const cur = textBeats[i]!;
    const start = Math.max(0, cur.startTime ?? 0);
    const nextStart = i < textBeats.length - 1 ? (textBeats[i + 1]!.startTime ?? totalMs) : totalMs;
    const window = Math.max(600, Math.min(totalMs - start, nextStart - start));
    const maxForStyle =
      cur.explainerSceneStyle === "subtitle-cinema"
        ? CINEMA_BLACK_OVERLAY_MS
        : MAX_EXPLAINER_SCENE_MS;
    const capped = Math.min(maxForStyle, window);
    cur.duration = Math.max(600, capped);
    cur.explainerSegmentDurationMs = cur.duration;

    const v = cur.explainerGraphicVariant;
    if (v !== undefined) {
      for (const o of out) {
        if (o.magicSceneExplainerStock && o.explainerGraphicVariant === v) {
          o.startTime = cur.startTime;
          o.duration = cur.duration;
        }
      }
    }
  }

  return out;
}

/** Full-frame subtitle-cinema explainer is on screen (hide duplicate STT captions; drop circle PiP). */
function isMagicCinemaExplainerActiveAt(tMs: number, elements: CanvasElement[]): boolean {
  return elements.some((el) => {
    if (!el.magicSceneExplainer || el.explainerSceneStyle !== "subtitle-cinema") return false;
    const t0 = el.startTime ?? 0;
    const t1 = t0 + (el.duration ?? 0);
    return tMs >= t0 && tMs < t1;
  });
}

/** Active full-frame subtitle-cinema explainer at time, if any. */
function getActiveMagicCinemaExplainerAt(
  tMs: number,
  elements: CanvasElement[]
): CanvasElement | null {
  for (const el of elements) {
    if (!el.magicSceneExplainer || el.explainerSceneStyle !== "subtitle-cinema") continue;
    const t0 = el.startTime ?? 0;
    const t1 = t0 + (el.duration ?? 0);
    if (tMs >= t0 && tMs < t1) return el;
  }
  return null;
}

/** Main video uses centered circle + caption bar (no B-roll underlay). */
function isMagicCircleLayoutActiveAt(tMs: number, elements: CanvasElement[]): boolean {
  const main = elements.find((el) => el.type === "video" && el.magicLayoutSegments?.length);
  if (!main?.magicLayoutSegments?.length) return false;
  const seg = main.magicLayoutSegments.find((s) => tMs >= s.startMs && tMs < s.endMs);
  return seg?.mode === "circle-pip";
}

/**
 * True when the main video is in a "topSlot" segment (authored to pair with a
 * top explainer card) BUT that card is no longer present (user deleted it).
 * In this state the main video sits in the bottom-half rectangle and the top
 * half renders as empty white canvas — so the subtitle should be anchored to
 * the canvas middle rather than to the bottom of a centered circle.
 */
function isMagicTopSlotNoCardAt(tMs: number, elements: CanvasElement[]): boolean {
  const main = elements.find((el) => el.type === "video" && el.magicLayoutSegments?.length);
  if (!main?.magicLayoutSegments?.length) return false;
  const seg = main.magicLayoutSegments.find((s) => tMs >= s.startMs && tMs < s.endMs);
  if (!seg?.topSlot) return false;
  // topSlot only matters when there's no active card covering the top half.
  return !isMagicTopTextCardExplainerActiveAt(tMs, elements);
}

/** Fancy-split / fancy-minimal explainer (text card on top) — not full-frame cinema. */
function isMagicTopTextCardExplainerActiveAt(tMs: number, elements: CanvasElement[]): boolean {
  return elements.some((el) => {
    if (el.type !== "text" || !el.magicSceneExplainer) return false;
    if (el.explainerSceneStyle === "subtitle-cinema") return false;
    const t0 = el.startTime ?? 0;
    const t1 = t0 + (el.duration ?? 0);
    return tMs >= t0 && tMs < t1;
  });
}

/** Up to 3 words for the active caption segment, advancing in step groups over the segment. */
function captionThreeWordsAtTime(
  segments: SubtitleSegment[],
  tMs: number
): string {
  const seg = segments.find((s) => s && tMs >= s.startMs && tMs < s.endMs);
  if (!seg?.text?.trim()) return "";
  const words = seg.text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const dur = Math.max(1, seg.endMs - seg.startMs);
  const t = Math.max(0, Math.min(1, (tMs - seg.startMs) / dur));
  const n = words.length;
  const nGroups = Math.max(1, Math.ceil(n / 3));
  const gi = Math.min(nGroups - 1, Math.floor(t * nGroups));
  const start = gi * 3;
  return words.slice(start, Math.min(start + 3, n)).join(" ");
}

/** Smooth main video rect across Magic layout segment boundaries (circle ↔ bottom split, etc.). Longer = softer; 700ms keeps the shift clearly visible without looking sluggish. */
const MAGIC_LAYOUT_BLEND_MS = 700;

type MagicLayoutBox = { lx: number; ly: number; lw: number; lh: number; lz: number };

function smoothstep01(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function magicLayoutBoxForSegment(
  seg: { mode: "split-bottom" | "circle-pip"; topSlot?: boolean } | undefined,
  baseZ: number,
  cinemaCovers: boolean,
  topTextCard: boolean
): MagicLayoutBox {
  let lz = baseZ;
  if (!seg) {
    return { lx: 0, ly: 0, lw: 100, lh: 100, lz };
  }
  if (seg.mode === "split-bottom") {
    return { lx: 0, ly: 50, lw: 100, lh: 50, lz };
  }
  if (seg.mode === "circle-pip" && !cinemaCovers) {
    lz = Math.max(lz, 920);
    // `topSlot` means this segment was authored to pair with a top explainer card.
    // Even if the user deleted that card, keep the main video in the bottom-half
    // slot (vacated top area renders as canvas white) rather than expanding the
    // circle to fill the frame.
    if (topTextCard || seg.topSlot) {
      return { lx: 0, ly: 50, lw: 100, lh: 50, lz };
    }
    return { lx: 0, ly: 0, lw: 100, lh: 100, lz };
  }
  return { lx: 0, ly: 0, lw: 100, lh: 100, lz };
}

function blendMagicMainVideoLayout(
  segments: { startMs: number; endMs: number; mode: "split-bottom" | "circle-pip"; topSlot?: boolean }[],
  tMs: number,
  baseZ: number,
  cinemaCovers: boolean,
  topTextCard: boolean
): MagicLayoutBox {
  if (!segments.length) {
    return magicLayoutBoxForSegment(undefined, baseZ, cinemaCovers, topTextCard);
  }
  const blend = MAGIC_LAYOUT_BLEND_MS;
  for (let i = 0; i < segments.length - 1; i++) {
    const prev = segments[i]!;
    const next = segments[i + 1]!;
    const boundary = next.startMs;
    if (tMs >= boundary - blend / 2 && tMs <= boundary + blend / 2) {
      const u = (tMs - (boundary - blend / 2)) / blend;
      const e = smoothstep01(u);
      const A = magicLayoutBoxForSegment(prev, baseZ, cinemaCovers, topTextCard);
      const B = magicLayoutBoxForSegment(next, baseZ, cinemaCovers, topTextCard);
      return {
        lx: A.lx + (B.lx - A.lx) * e,
        ly: A.ly + (B.ly - A.ly) * e,
        lw: A.lw + (B.lw - A.lw) * e,
        lh: A.lh + (B.lh - A.lh) * e,
        lz: Math.round(A.lz + (B.lz - A.lz) * e),
      };
    }
  }
  const active = segments.find((s) => tMs >= s.startMs && tMs < s.endMs);
  return magicLayoutBoxForSegment(active, baseZ, cinemaCovers, topTextCard);
}

// Types
type Scene = {
  id: string;
  name: string;
  thumbnail?: string;
  duration: number;
};

type Asset = {
  id: string;
  name: string;
  type: "audio" | "image" | "video";
  url: string;
  thumbnail?: string;
};

type Caption = {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
};

type TimelineTrack = {
  id: string;
  type: "video" | "audio" | "overlay";
  assetId?: string;
  startTime: number;
  endTime: number;
  layer: number;
};

type CanvasElement = {
  id: string;
  type: "video" | "image" | "text" | "audio";
  url?: string;
  text?: string;
  x: number; // Canvas position in percentage (0-100) - SPATIAL
  y: number; // Canvas position in percentage (0-100) - SPATIAL
  width: number; // Canvas width in percentage - SPATIAL
  height: number; // Canvas height in percentage - SPATIAL
  rotation: number; // Rotation in degrees
  opacity: number; // Opacity 0-1
  zIndex: number; // Layer order
  fontSize?: number; // For text elements
  fontColor?: string; // For text elements
  fontFamily?: string; // For text elements
  // Image panning (for positioning image content within element bounds)
  imageOffsetX?: number; // Image position offset X in percentage (-100 to 100)
  imageOffsetY?: number; // Image position offset Y in percentage (-100 to 100)
  // Image cropping (for cropping image content)
  cropX?: number; // Crop area X position in percentage (0-100)
  cropY?: number; // Crop area Y position in percentage (0-100)
  cropWidth?: number; // Crop area width in percentage (0-100)
  cropHeight?: number; // Crop area height in percentage (0-100)
  // Timeline properties (TEMPORAL - separate from canvas position)
  startTime?: number; // Start time in milliseconds (for timeline)
  duration?: number; // Duration in milliseconds (for timeline)
  thumbnail?: string; // Thumbnail URL for timeline display
  muted?: boolean; // Mute state for video elements
  videoStartOffset?: number; // Offset in milliseconds - where in the video file to start playing from (for trimming)
  audioStartOffset?: number; // Offset in milliseconds - where in the audio file to start playing from (for trimming)
  circleFrame?: boolean; // When true, clip video/image to a circular frame (e.g. PiP style)
  /**
   * How the video/image should fit inside its element box.
   *   - `cover` (default): fill the box, cropping the overflow — used by avatars,
   *     b-rolls, magic main videos, and anything else that should fill its slot.
   *   - `contain`: show the whole asset without cropping; the element box shows
   *     letterbox/pillarbox bars as needed. Set by `addElementToCanvas` for media
   *     the user drags in from the Media panel so their upload isn't cropped.
   */
  objectFit?: "cover" | "contain";
  /** SVG / tricky URLs: render with <img> instead of Next/Image */
  intrinsicSize?: boolean;
  /** B-roll from Super data / jump cuts — top-half TikTok split overlays */
  bRollOverlay?: boolean;
  /** Magic B-roll: per-clip color grade / mood (rotates by scene) */
  bRollSceneVibe?: string;
  /**
   * Origin of the b-roll clip (e.g. `freepik-12345`). Lets the server refresh
   * short-lived signed URLs (Freepik `cdnpk.net` tokens) right before render
   * so a long editor session doesn't 403 at the final render step.
   */
  bRollSourceId?: string;
  /** Magic explainer: match card tint to scene vibe */
  explainerSceneVibe?: string;
  /** Magic create: bold outlined “viral” caption styling */
  magicViralStyle?: boolean;
  /** Magic create: typography beat (fancy text or full-frame subtitle overlay) */
  magicSceneExplainer?: boolean;
  /** Magic create: Freepik image paired with the same explainerGraphicVariant beat */
  magicSceneExplainerStock?: boolean;
  explainerIllustrationUrl?: string;
  /** Beat order; used to resolve defaults */
  explainerGraphicVariant?: number;
  explainerLevel?: number;
  explainerAccentLabel?: string;
  explainerSubline?: string;
  explainerSceneStyle?: string;
  explainerTypographyStyle?: string;
  explainerAccentHex?: string;
  /** Segment length for enter/exit motion (defaults to duration) */
  explainerSegmentDurationMs?: number;
  /** emphasis-explode: single-word punchline drawn oversized. */
  explainerHeroWord?: string;
  /** checklist-reveal + ticker-stack: 2–5 short list items. */
  explainerItems?: string[];
  /** reaction-burst: single emoji (or short emoji pair). */
  explainerEmoji?: string;
  /** vs-split: left-side short label. */
  explainerSideA?: string;
  /** vs-split: right-side short label. */
  explainerSideB?: string;
  /** Contextual topic emoji rendered as a BIG motion accent on fancy-* / subtitle-cinema / emphasis-explode / ticker-stack / question-shrug cards. */
  explainerIconEmoji?: string;
  /** Resolved Logo.dev URL when the classifier detected a brand on this beat. */
  explainerLogoUrl?: string;
  /** Full-area background behind text (e.g. white hook card) */
  textBackgroundColor?: string;
  /** Red on white hook style — no black stroke */
  magicWhiteSlide?: boolean;
  /**
   * Magic rhythm: one main video plays 0→duration; layout switches by timeline (overlays on top).
   * `split-bottom` = bottom 50%; `circle-pip` = large centered circle + caption strip (no B-roll).
   * `circleScale` (0.4–1.2) overrides the circle-pip diameter. Default 1.0 matches the
   * original 96% / 400px cap — set via the on-canvas resize handle when the user clicks
   * the circle to edit it.
   */
  magicLayoutSegments?: {
    startMs: number;
    endMs: number;
    mode: "split-bottom" | "circle-pip";
    circleScale?: number;
    /**
     * True when this segment was authored with a top explainer card in its upper half
     * (post-intro card beats). Keeps the main video in the bottom-half position even
     * if the user deletes the card — the vacated top area just renders as canvas white
     * rather than the main video expanding to fill it.
     */
    topSlot?: boolean;
  }[];
  /** Auto-placed 2s subtitle-cinema beats at each jump-cut time (editor tool) */
  magicJumpCutCinema?: boolean;
};

/**
 * Full-frame black overlays with caption text at each jump-cut instant (same cadence as B-roll jump cuts).
 */
function generateJumpCutCinemaOverlays(
  totalDurationMs: number,
  intervalSeconds: number,
  segments: SubtitleSegment[]
): CanvasElement[] {
  if (intervalSeconds <= 0 || totalDurationMs <= 0) return [];
  const totalDurationSeconds = totalDurationMs / 1000;
  const out: CanvasElement[] = [];
  let variant = 9000;
  for (let time = intervalSeconds; time < totalDurationSeconds; time += intervalSeconds) {
    const startMs = Math.round(time * 1000);
    const dur = CINEMA_BLACK_OVERLAY_MS;
    if (startMs + dur > totalDurationMs) break;
    const cap = captionTextForTimeRange(startMs, startMs + dur, segments).trim();
    const text = cap.length > 0 ? cap : " ";
    out.push({
      id: uuid(),
      type: "text",
      text,
      explainerSceneStyle: "subtitle-cinema",
      explainerTypographyStyle: "modern-sans",
      explainerAccentHex: "#6366f1",
      explainerSegmentDurationMs: dur,
      magicSceneExplainer: true,
      magicJumpCutCinema: true,
      explainerGraphicVariant: variant,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      opacity: 1,
      zIndex: 1150 + (variant % 50),
      startTime: startMs,
      duration: dur,
      fontSize: 21,
      fontColor: "#ffffff",
      fontFamily: "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif",
    });
    variant += 1;
  }
  return out;
}

/** Split script into scenes (paragraphs first; otherwise sentence chunks). Max 15. */
function splitScriptIntoScenes(script: string): string[] {
  const t = script.trim();
  if (!t) return [];
  const paras = t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (paras.length >= 2) return paras.slice(0, 15);
  const sentences = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 1) return [t];
  const scenes: string[] = [];
  let buf = "";
  const maxChunk = 220;
  for (const s of sentences) {
    const next = buf ? `${buf} ${s}` : s;
    if (next.length > maxChunk && buf) {
      scenes.push(buf.trim());
      buf = s;
    } else {
      buf = next;
    }
  }
  if (buf.trim()) scenes.push(buf.trim());
  return scenes.slice(0, 15);
}

function buildSceneTimings(
  sceneTexts: string[],
  totalMs: number
): { startMs: number; endMs: number; sceneIndex: number }[] {
  const n = sceneTexts.length;
  if (n === 0 || totalMs <= 0) return [];
  const weights = sceneTexts.map((s) => Math.max(1, s.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return sceneTexts.map((_, i) => {
    const startMs = Math.round((acc / sum) * totalMs);
    acc += weights[i];
    const endMs = i === n - 1 ? totalMs : Math.round((acc / sum) * totalMs);
    return { startMs, endMs, sceneIndex: i };
  });
}

function sceneIndexAtTime(
  tMs: number,
  timings: { startMs: number; endMs: number; sceneIndex: number }[]
): number {
  for (const seg of timings) {
    if (tMs >= seg.startMs && tMs < seg.endMs) {
      return seg.sceneIndex;
    }
  }
  return timings.length ? timings[timings.length - 1].sceneIndex : 0;
}

/** Magic B-roll: max clip length on canvas (ms) */
const MAGIC_BROLL_CLIP_MS = 3000;

const MAGIC_BROLL_VIBES = [
  "warm",
  "cool",
  "cinematic",
  "neon",
  "soft",
  "dramatic",
  "golden",
  "mono",
] as const;

const BROLL_VIBE_STYLES: Record<
  string,
  { filter: string; overlayGradient?: string }
> = {
  warm: {
    filter: "sepia(0.22) saturate(1.18) contrast(1.06)",
    overlayGradient:
      "linear-gradient(180deg, rgba(255,130,70,0.24) 0%, rgba(255,60,40,0.07) 100%)",
  },
  cool: {
    filter: "hue-rotate(178deg) saturate(0.9) brightness(1.03)",
    overlayGradient:
      "linear-gradient(160deg, rgba(30,110,255,0.22) 0%, rgba(20,40,120,0.05) 100%)",
  },
  cinematic: {
    filter: "contrast(1.14) saturate(0.88) brightness(0.94)",
    overlayGradient:
      "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 55%)",
  },
  neon: {
    filter: "saturate(1.4) contrast(1.18) hue-rotate(-6deg)",
    overlayGradient:
      "linear-gradient(90deg, rgba(200,0,255,0.14) 0%, rgba(0,220,255,0.1) 100%)",
  },
  soft: {
    filter: "brightness(1.05) saturate(0.92)",
    overlayGradient:
      "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0.06) 100%)",
  },
  dramatic: {
    filter: "contrast(1.22) brightness(0.86)",
    overlayGradient:
      "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.38) 100%)",
  },
  golden: {
    filter: "sepia(0.4) saturate(1.15) contrast(1.05)",
    overlayGradient:
      "linear-gradient(200deg, rgba(255,210,100,0.28) 0%, rgba(180,90,20,0.1) 100%)",
  },
  mono: {
    filter: "grayscale(0.92) contrast(1.1)",
    overlayGradient:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.14) 100%)",
  },
};

function bRollVibeForStartMs(
  startTime: number,
  sceneTimings: { startMs: number; endMs: number; sceneIndex: number }[]
): string {
  if (sceneTimings.length) {
    const idx = sceneIndexAtTime(startTime, sceneTimings);
    return MAGIC_BROLL_VIBES[idx % MAGIC_BROLL_VIBES.length];
  }
  const slot = Math.max(0, Math.floor(startTime / MAGIC_BROLL_CLIP_MS));
  return MAGIC_BROLL_VIBES[slot % MAGIC_BROLL_VIBES.length];
}

/** Seeking on tiny drift fights the decoder — Magic stacks many clips; use looser B-roll tolerance */
const VIDEO_SYNC_DRIFT_SEC = 0.32;
const BROLL_VIDEO_SYNC_DRIFT_SEC = 0.65;

/**
 * Returns the "active" <video> element for a canvas element and, critically,
 * pauses + mutes any duplicates that may linger in the DOM.
 *
 * Why this exists:
 * The main Magic video has 4 mutually-exclusive JSX branches (split-bottom,
 * circle-pip with/without top-text card, default). When `magicLayoutSegments`
 * flips mid-playback (e.g. split-bottom → circle-pip) React swaps between
 * these branches. In some Chromium/WebKit builds the *removed* <video>
 * continues emitting audio for a short time, producing a delayed echo of
 * the exact same track — this helper kills those ghosts on every tick.
 *
 * We always keep the LAST match (most recently mounted = the visible one)
 * and hard-pause/mute every earlier duplicate.
 */
function getActiveCanvasVideo(elementId: string): HTMLVideoElement | null {
  const nodes = document.querySelectorAll<HTMLVideoElement>(
    `video[id="canvas-video-${elementId}"]`
  );
  if (nodes.length === 0) return null;
  if (nodes.length === 1) return nodes[0];
  // Duplicate <video> tags for the same canvas element should not exist.
  // When they do, silence every stale one so only the last one plays audio.
  for (let i = 0; i < nodes.length - 1; i++) {
    try {
      nodes[i].pause();
      nodes[i].muted = true;
    } catch (_) {
      /* noop */
    }
  }
  return nodes[nodes.length - 1];
}

function BrollVibeVideoWrap({
  vibeKey,
  children,
}: {
  vibeKey?: string;
  children: React.ReactNode;
}) {
  const style =
    vibeKey && BROLL_VIBE_STYLES[vibeKey] ? BROLL_VIBE_STYLES[vibeKey] : null;
  if (!style) return <>{children}</>;
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-sm"
      style={{ contain: "paint", isolation: "isolate" }}
    >
      {style.overlayGradient ? (
        <div
          className="pointer-events-none absolute inset-0 z-[2] mix-blend-soft-light"
          style={{ background: style.overlayGradient }}
          aria-hidden
        />
      ) : null}
      <div
        className="relative z-[1] h-full w-full [&_video]:h-full [&_video]:w-full"
        style={{ filter: style.filter }}
      >
        {children}
      </div>
    </div>
  );
}

function chunkWords(text: string, maxLen: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const out: string[] = [];
  let buf: string[] = [];
  let len = 0;
  for (const w of words) {
    const add = buf.length ? w.length + 1 : w.length;
    if (len + add > maxLen && buf.length) {
      out.push(buf.join(" "));
      buf = [w];
      len = w.length;
    } else {
      buf.push(w);
      len += add;
    }
  }
  if (buf.length) out.push(buf.join(" "));
  return out.length ? out : [text.trim()].filter(Boolean);
}

/** Fallback beats when LLM fails: many short chunks from script. */
function fallbackExplainerCardsFromScript(script: string): SceneExplainerCard[] {
  const t = script.trim();
  if (!t) return [];
  const paras = t.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  let chunks: string[] = [];
  if (paras.length >= 2) {
    chunks = paras.flatMap((p) => chunkWords(p, 100));
  } else {
    const sentences = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    chunks = sentences.length > 1 ? sentences : chunkWords(t, 90);
  }
  const accents = ["#6366f1", "#0d9488", "#ea580c", "#db2777", "#7c3aed", "#0ea5e9"];
  /** Bias toward subtitle-cinema (black overlay) ~2/3 of beats when LLM is unavailable. */
  const sceneStylesHeavyCinema = [
    "subtitle-cinema",
    "subtitle-cinema",
    "fancy-split",
    "subtitle-cinema",
    "fancy-minimal",
    "subtitle-cinema",
  ] as const;
  const typos = ["modern-sans", "display-bold", "elegant-serif"] as const;
  return chunks.slice(0, 24).map((text, i) => {
    const headline =
      text.split(/\s+/).slice(0, 8).join(" ").slice(0, 72) || `Point ${i + 1}`;
    return {
      sceneIndex: i,
      headline,
      subline: "",
      accentLabel: "",
      accentHex: accents[i % accents.length],
      sceneStyle: sceneStylesHeavyCinema[i % sceneStylesHeavyCinema.length],
      typographyStyle: typos[i % typos.length],
      anchorText: text.trim().slice(0, 80),
    };
  });
}

/** Target minimum on-screen time per explainer beat so text can finish before the next beat vs main video. */
const MIN_EXPLAINER_BEAT_MS = 3200;

/**
 * If spreading all LLM beats across the video would make each beat shorter than MIN_EXPLAINER_BEAT_MS,
 * evenly subsample beats so on-screen time matches the main video better.
 */
function pickExplainerCardsForTimeline(
  cards: SceneExplainerCard[],
  totalMs: number
): SceneExplainerCard[] {
  const sorted = [...cards]
    .filter((c) => c.headline?.trim())
    .sort((a, b) => (a.sceneIndex ?? 0) - (b.sceneIndex ?? 0));
  if (sorted.length === 0 || totalMs <= 0) return [];
  const segmentIfAll = totalMs / sorted.length;
  if (segmentIfAll >= MIN_EXPLAINER_BEAT_MS) return sorted;
  const targetCount = Math.max(1, Math.floor(totalMs / MIN_EXPLAINER_BEAT_MS));
  const n = Math.min(sorted.length, targetCount);
  if (n >= sorted.length) return sorted;
  const out: SceneExplainerCard[] = [];
  const last = sorted.length - 1;
  for (let j = 0; j < n; j++) {
    const idx = n <= 1 ? 0 : Math.round((j / (n - 1)) * last);
    out.push({ ...sorted[idx]!, sceneIndex: j });
  }
  return out;
}

function normalizeScriptForAnchorMatch(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** First match position in normalized script, or -1. */
function findAnchorCharOffset(anchorRaw: string, scriptRaw: string): number {
  const needle = normalizeScriptForAnchorMatch(anchorRaw);
  const hay = normalizeScriptForAnchorMatch(scriptRaw);
  if (!needle || !hay) return -1;
  let idx = hay.indexOf(needle);
  if (idx >= 0) return idx;
  const words = needle.split(" ").filter(Boolean);
  for (let w = Math.min(words.length, 10); w >= 3; w--) {
    const probe = words.slice(0, w).join(" ");
    idx = hay.indexOf(probe);
    if (idx >= 0) return idx;
  }
  if (words.length >= 2) {
    idx = hay.indexOf(words.slice(0, 2).join(" "));
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Map each card to a start time from anchor phrases in the script; interpolate gaps.
 */
function computeExplainerStartTimesFromAnchors(
  cards: SceneExplainerCard[],
  script: string,
  totalMs: number
): number[] {
  const n = cards.length;
  const hay = normalizeScriptForAnchorMatch(script);
  const L = Math.max(hay.length, 1);
  const rawMs: (number | null)[] = cards.map((c) => {
    const primary = (c.anchorText || "").trim();
    const fallback = (c.headline || "").trim();
    let off =
      primary.length >= 6 ? findAnchorCharOffset(primary, script) : -1;
    if (off < 0 && fallback.length >= 6) {
      off = findAnchorCharOffset(fallback, script);
    }
    if (off < 0) return null;
    return Math.round((off / L) * totalMs);
  });
  if (!rawMs.some((x) => x != null)) {
    const seg = totalMs / Math.max(n, 1);
    return cards.map((_, i) => Math.round(i * seg));
  }
  const out: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (rawMs[i] != null) {
      out[i] = rawMs[i]!;
      continue;
    }
    let l = i - 1;
    while (l >= 0 && rawMs[l] == null) l--;
    let r = i + 1;
    while (r < n && rawMs[r] == null) r++;
    const leftT = l >= 0 ? rawMs[l]! : 0;
    const rightT = r < n ? rawMs[r]! : totalMs;
    const leftIdx = l >= 0 ? l : 0;
    const rightIdx = r < n ? r : n - 1;
    const span = Math.max(1, rightIdx - leftIdx);
    const frac = (i - leftIdx) / span;
    out[i] = Math.round(leftT + (rightT - leftT) * frac);
  }
  const MIN_STEP = 550;
  for (let i = 1; i < n; i++) {
    if (out[i]! < out[i - 1]! + MIN_STEP) {
      out[i] = out[i - 1]! + MIN_STEP;
    }
  }
  const maxStart = Math.max(0, totalMs - 400);
  for (let i = 0; i < n; i++) {
    out[i] = Math.min(out[i]!, maxStart);
  }
  for (let i = n - 2; i >= 0; i--) {
    if (out[i]! > out[i + 1]! - MIN_STEP) {
      out[i] = Math.max(0, out[i + 1]! - MIN_STEP);
    }
  }
  return out;
}

function buildExplainerCanvasElementsFromSchedule(
  sorted: SceneExplainerCard[],
  totalMs: number,
  startTimesMs: number[]
): CanvasElement[] {
  const n = sorted.length;
  const out: CanvasElement[] = [];
  for (let i = 0; i < n; i++) {
    const card = sorted[i]!;
    const startMs = Math.round(Math.min(startTimesMs[i]!, totalMs - 400));
    const endMs = i < n - 1 ? Math.round(Math.min(startTimesMs[i + 1]!, totalMs)) : totalMs;
    const cinema = card.sceneStyle === "subtitle-cinema";
    const rawDur = Math.max(600, endMs - startMs);
    const dur = cinema
      ? Math.min(CINEMA_BLACK_OVERLAY_MS, rawDur)
      : rawDur;
    const vibe = MAGIC_BROLL_VIBES[i % MAGIC_BROLL_VIBES.length];
    const stockUrl = card.stockImageUrl?.trim();
    const stockHttps =
      stockUrl && /^https?:\/\//i.test(stockUrl) ? stockUrl : undefined;

    const heroWord =
      card.sceneStyle === "emphasis-explode" && typeof card.heroWord === "string"
        ? card.heroWord.trim()
        : "";
    const wantsItems =
      card.sceneStyle === "checklist-reveal" || card.sceneStyle === "ticker-stack";
    const items =
      wantsItems && Array.isArray(card.items)
        ? card.items
            .map((s) => (typeof s === "string" ? s.trim() : ""))
            .filter((s) => s.length >= 2)
            .slice(0, 5)
        : [];
    const emoji =
      card.sceneStyle === "reaction-burst" && typeof card.emoji === "string"
        ? card.emoji.trim().slice(0, 8)
        : "";
    const sideA =
      card.sceneStyle === "vs-split" && typeof card.sideA === "string"
        ? card.sideA.trim().slice(0, 32)
        : "";
    const sideB =
      card.sceneStyle === "vs-split" && typeof card.sideB === "string"
        ? card.sideB.trim().slice(0, 32)
        : "";
    const iconEmoji =
      typeof card.iconEmoji === "string" ? card.iconEmoji.trim().slice(0, 8) : "";
    const logoUrl =
      typeof card.logoUrl === "string" && /^https?:\/\//i.test(card.logoUrl)
        ? card.logoUrl
        : "";

    out.push({
      id: uuid(),
      type: "text",
      text: card.headline.trim(),
      explainerSubline: card.subline?.trim() || undefined,
      explainerGraphicVariant: i,
      explainerLevel: i + 1,
      explainerAccentLabel: card.accentLabel?.trim() || undefined,
      explainerSceneStyle: card.sceneStyle,
      explainerTypographyStyle: card.typographyStyle,
      explainerAccentHex: card.accentHex,
      explainerSegmentDurationMs: dur,
      magicSceneExplainer: true,
      explainerSceneVibe: vibe,
      ...(stockHttps ? { explainerIllustrationUrl: stockHttps } : {}),
      ...(heroWord ? { explainerHeroWord: heroWord } : {}),
      ...(items.length > 0 ? { explainerItems: items } : {}),
      ...(emoji ? { explainerEmoji: emoji } : {}),
      ...(sideA ? { explainerSideA: sideA } : {}),
      ...(sideB ? { explainerSideB: sideB } : {}),
      ...(iconEmoji ? { explainerIconEmoji: iconEmoji } : {}),
      ...(logoUrl ? { explainerLogoUrl: logoUrl } : {}),
      x: 0,
      y: 0,
      width: 100,
      height: cinema ? 100 : 50,
      rotation: 0,
      opacity: 1,
      zIndex: cinema ? 945 : 932,
      startTime: Math.max(0, startMs),
      duration: dur,
      fontSize: cinema ? 21 : 22,
      fontColor: cinema ? "#ffffff" : "#0a0a0a",
      fontFamily: "var(--font-montserrat), ui-sans-serif, system-ui, sans-serif",
    });
  }
  return out;
}

/** Evenly distribute explainer cards (fallback when script anchors unavailable). */
function buildMagicExplainerElementsEven(totalMs: number, cards: SceneExplainerCard[]): CanvasElement[] {
  const sorted = pickExplainerCardsForTimeline(cards, totalMs);
  const n = sorted.length;
  if (n === 0 || totalMs <= 0) return [];
  const segment = totalMs / n;
  const starts = sorted.map((_, i) => Math.round(i * segment));
  return buildExplainerCanvasElementsFromSchedule(sorted, totalMs, starts);
}

/**
 * Place explainer beats on the timeline using LLM anchor phrases in the script when possible;
 * otherwise fall back to even spacing + subsampling.
 */
function buildMagicExplainerElements(
  totalMs: number,
  cards: SceneExplainerCard[],
  script?: string
): CanvasElement[] {
  const sorted = [...cards]
    .filter((c) => c.headline?.trim())
    .sort((a, b) => (a.sceneIndex ?? 0) - (b.sceneIndex ?? 0));
  if (sorted.length === 0 || totalMs <= 0) return [];

  const scriptTrim = script?.trim() ?? "";
  if (scriptTrim.length < 16) {
    return buildMagicExplainerElementsEven(totalMs, sorted);
  }

  const starts = computeExplainerStartTimesFromAnchors(sorted, scriptTrim, totalMs);
  return buildExplainerCanvasElementsFromSchedule(sorted, totalMs, starts);
}

type MagicRhythmSceneMode = {
  sceneTexts: string[];
  sceneStockBRolls: Array<{ sceneIndex: number; bRoll: BRoll | null }>;
};

/**
 * Magic layout scheduler:
 *   INTRO (fixed, 0–9s):
 *     0–4s : split-bottom (main in bottom half, b-roll in top half)
 *     4–7s : NO layout segment — intro subtitle-cinema explainer covers main
 *     7–9s : NO layout segment — full-frame b-roll covers main
 *   POST-INTRO (9s → end):
 *     Every text-card beat shows the MAIN video behind the card — never a
 *     b-roll. Layouts alternate for rhythm:
 *       - circle-pip : main visible in circle + caption bar (card on top)
 *       - split-5050 : card on top half + main video on bottom half
 *     subtitle-cinema beats keep their own black full-frame overlay, and any
 *     post-cinema tail (before the next beat starts) is covered with a
 *     full-frame b-roll so there's no raw main-video cut.
 */
function buildMagicRhythmElements(
  mainVideoUrl: string,
  totalMs: number,
  bRollPool: BRoll[],
  _script: string,
  thumbnail?: string,
  sceneMode?: MagicRhythmSceneMode,
  explainerEls: CanvasElement[] = []
): { elements: CanvasElement[]; primaryMainId: string; usedBRollIds: string[] } {
  console.log('[B-roll] buildMagicRhythmElements start', {
    totalMs,
    mainVideoPrefix: mainVideoUrl.slice(0, 80),
    poolSize: bRollPool.length,
    scriptLen: _script.length,
    sceneMode: !!sceneMode?.sceneTexts?.length,
    explainerBeats: explainerEls.filter(
      (e) => e.magicSceneExplainer && !e.magicSceneExplainerStock
    ).length,
  });

  let sceneTimings: { startMs: number; endMs: number; sceneIndex: number }[] = [];
  let bRollBySceneIndex: (BRoll | null)[] = [];
  if (
    sceneMode?.sceneTexts?.length &&
    sceneMode.sceneStockBRolls?.length
  ) {
    sceneTimings = buildSceneTimings(sceneMode.sceneTexts, totalMs);
    const n = sceneMode.sceneTexts.length;
    bRollBySceneIndex = Array.from({ length: n }, (_, i) => {
      const row = sceneMode.sceneStockBRolls.find((r) => r.sceneIndex === i);
      return row?.bRoll ?? null;
    });
  }

  const magicLayoutSegments: {
    startMs: number;
    endMs: number;
    mode: "split-bottom" | "circle-pip";
    topSlot?: boolean;
  }[] = [];
  const elements: CanvasElement[] = [];
  const usedSet = new Set<string>();
  let brollLayer = 0;

  const pickBRoll = (atTimeMs: number): BRoll | null => {
    if (sceneTimings.length && bRollBySceneIndex.length) {
      const idx = sceneIndexAtTime(atTimeMs, sceneTimings);
      const br = bRollBySceneIndex[idx];
      if (br?.url) return br;
    }
    const pool = bRollPool.filter((b) => b.url);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)]!;
  };

  /**
   * Push a single b-roll clip.
   *   fullScreen=true  → height: 100 (covers main video; used for broll-full beats)
   *   fullScreen=false → height: 50 (top half, pairs with split-bottom main)
   * Duration is capped at MAGIC_BROLL_CLIP_MS; callers needing to cover a
   * longer window should use `pushBrollChain` below, which stitches multiple
   * b-rolls back-to-back.
   */
  const pushBroll = (startTime: number, durMs: number, bRoll: BRoll, fullScreen: boolean) => {
    if (!bRoll.url) return;
    usedSet.add(bRoll.id);
    const cappedDur = Math.min(Math.max(200, durMs), MAGIC_BROLL_CLIP_MS);
    const clipSec = cappedDur / 1000;
    const bDur = bRoll.durationSeconds || 12;
    const maxOff = Math.max(0, bDur - clipSec);
    const rOff = maxOff > 0 ? Math.random() * maxOff : 0;
    const vibe = bRollVibeForStartMs(startTime, sceneTimings);
    console.log('[B-roll] pushBroll canvas clip', {
      id: bRoll.id,
      name: bRoll.name,
      startTime,
      durMs: cappedDur,
      fullScreen,
      vibe,
      videoStartOffsetMs: rOff * 1000,
      hasThumb: !!bRoll.thumbnailUrl,
    });
    elements.push({
      id: uuid(),
      type: "video",
      url: bRoll.url,
      thumbnail: bRoll.thumbnailUrl || undefined,
      x: 0,
      y: 0,
      width: 100,
      height: fullScreen ? 100 : 50,
      rotation: 0,
      opacity: 1,
      zIndex: 850 + brollLayer,
      startTime,
      duration: cappedDur,
      videoStartOffset: rOff * 1000,
      muted: true,
      bRollOverlay: true,
      bRollSceneVibe: vibe,
      bRollSourceId: bRoll.id,
    });
    brollLayer += 1;
  };

  /**
   * Cover [startMs, endMs) fully with one or more b-roll clips, each ≤
   * MAGIC_BROLL_CLIP_MS. Each sub-window gets an independently-picked b-roll
   * so long beats get visual variety instead of a single static clip.
   */
  const pushBrollChain = (startMs: number, endMs: number, fullScreen: boolean) => {
    if (endMs <= startMs) return;
    let cursor = startMs;
    let guard = 0;
    while (cursor < endMs && guard < 16) {
      const slice = Math.min(MAGIC_BROLL_CLIP_MS, endMs - cursor);
      const br = pickBRoll(cursor);
      if (!br) return;
      pushBroll(cursor, slice, br, fullScreen);
      cursor += slice;
      guard += 1;
    }
  };

  const pushLayout = (
    startMs: number,
    endMs: number,
    mode: "split-bottom" | "circle-pip",
    topSlot?: boolean
  ) => {
    if (endMs <= startMs) return;
    magicLayoutSegments.push({ startMs, endMs, mode, topSlot });
  };

  // ─── INTRO (0–9s, fixed) ──────────────────────────────────────────────
  const introSplitEnd = Math.min(OPENING_SPLIT_MS, totalMs);         // 4s
  const introCinemaEnd = Math.min(introSplitEnd + OPENING_CINEMA_MS, totalMs); // 7s
  const introBrollEnd = Math.min(introCinemaEnd + OPENING_BROLL_FULL_MS, totalMs); // 9s

  // 0–4s: main in bottom half, b-roll in top half. Chain multiple b-rolls
  // here so the top half stays live for the full 4 seconds (single b-rolls
  // are capped at MAGIC_BROLL_CLIP_MS = 3s).
  pushLayout(0, introSplitEnd, "split-bottom");
  if (introSplitEnd > 0) {
    pushBrollChain(0, introSplitEnd, false);
  }

  // 4–7s: NO layout segment. The intro subtitle-cinema explainer (injected by
  // enforceExplainerOpeningAndMaxSceneDuration) covers the main video.

  // 7–9s: NO layout segment. Full-frame b-roll covers the main video so the
  // jumpcut into post-intro is hidden behind motion.
  if (introBrollEnd > introCinemaEnd) {
    const br7 = pickBRoll(introCinemaEnd);
    if (br7) {
      pushBroll(introCinemaEnd, introBrollEnd - introCinemaEnd, br7, true);
    }
  }

  // ─── POST-INTRO (9s → end) ────────────────────────────────────────────
  // Walk the pre-scheduled explainer beats and assign each window a layout.
  // For every non-cinema beat we either:
  //   • cover the main with a full-frame b-roll (default — maximizes coverage)
  //   • promote to split-5050 or circle-pip (main visible) until the
  //     MAIN_VISIBLE_REMAINING_RATIO budget is exhausted.
  const postIntroStart = introBrollEnd;
  if (postIntroStart < totalMs) {
    const beats = explainerEls
      .filter(
        (e) => e.magicSceneExplainer && !e.magicSceneExplainerStock && (e.startTime ?? 0) >= postIntroStart - 50
      )
      .sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));

    // Build beat windows (each beat covers [startMs, nextBeatStartOrEnd)).
    type BeatWin = {
      el: CanvasElement;
      startMs: number;
      endMs: number;
      isCinema: boolean;
    };
    const windows: BeatWin[] = [];
    for (let i = 0; i < beats.length; i++) {
      const el = beats[i]!;
      const s = Math.max(postIntroStart, el.startTime ?? postIntroStart);
      const nextStart =
        i < beats.length - 1 ? beats[i + 1]!.startTime ?? totalMs : totalMs;
      const e = Math.min(totalMs, nextStart);
      if (e <= s) continue;
      windows.push({
        el,
        startMs: s,
        endMs: e,
        isCinema: el.explainerSceneStyle === "subtitle-cinema",
      });
    }

    // If the LLM returned nothing for post-intro, still cover the tail with
    // rotating b-rolls / circle segments so the viewer isn't staring at raw
    // main-video cuts.
    if (windows.length === 0) {
      windows.push({
        el: { id: "", type: "text", x: 0, y: 0, width: 0, height: 0 } as CanvasElement,
        startMs: postIntroStart,
        endMs: totalMs,
        isCinema: false,
      });
    }

    // Rule (per user): whenever a text card is on screen, the background MUST
    // be the main (talking-head) video — NEVER a b-roll. B-roll-full only
    // covers raw gaps (e.g. after a cinema beat ended before the next beat
    // started). Circle-pip and split-5050 (main visible) alternate across
    // card beats purely for visual rhythm — with a 2:1 circle-pip bias so
    // the circle layout (most dynamic) dominates.
    //
    // To inject more black-overlay + broll-full variety beyond what the LLM
    // picked, every 3rd non-cinema card is client-side demoted to
    // subtitle-cinema: its text becomes a black-overlay punchline for ~2s
    // and the remainder of the window is covered by a full-frame b-roll.
    let nonCinemaSeen = 0;
    let cardBeatCount = 0;
    let forcedCinemaCount = 0;
    let cinemaGapMs = 0;
    let circleCount = 0;
    let splitCount = 0;

    for (const w of windows) {
      const windowDur = w.endMs - w.startMs;
      if (windowDur <= 0) continue;

      let isCinema = w.isCinema;
      if (!isCinema) {
        nonCinemaSeen += 1;
        // Every 3rd non-cinema beat → force cinema (black overlay) + broll tail.
        // This diversifies a sequence of otherwise-identical fancy-* cards.
        if (nonCinemaSeen % 3 === 0) {
          w.el.explainerSceneStyle = "subtitle-cinema";
          w.el.height = 100;
          w.el.zIndex = Math.max(945, w.el.zIndex ?? 0);
          w.el.fontColor = w.el.fontColor || "#ffffff";
          // Cap cinema to CINEMA_BLACK_OVERLAY_MS; the tail will be broll-full.
          const newDur = Math.min(CINEMA_BLACK_OVERLAY_MS, windowDur);
          w.el.duration = newDur;
          w.el.explainerSegmentDurationMs = newDur;
          // Subtitle-cinema is a clean dark overlay — hide the paired stock
          // illustration so we don't get a random icon floating on black.
          const variant = w.el.explainerGraphicVariant;
          if (variant !== undefined) {
            for (const o of explainerEls) {
              if (o.magicSceneExplainerStock && o.explainerGraphicVariant === variant) {
                o.opacity = 0;
                o.duration = 0;
              }
            }
          }
          isCinema = true;
          forcedCinemaCount += 1;
        }
      }

      if (isCinema) {
        // Cinema explainer covers [startMs, startMs + el.duration). The tail
        // after the cinema overlay would otherwise expose a raw main-video
        // cut — fill it with a full-frame b-roll.
        const cinemaDur = Math.min(windowDur, Math.max(600, w.el.duration ?? 0));
        const cinemaEnd = w.startMs + cinemaDur;
        const gap = w.endMs - cinemaEnd;
        if (gap > 200 && bRollPool.length) {
          pushBrollChain(cinemaEnd, w.endMs, true);
          cinemaGapMs += gap;
        } else if (gap > 200) {
          pushLayout(cinemaEnd, w.endMs, "circle-pip");
        }
        continue;
      }

      // Card beat → always show main video behind the card. Bias 2:1 toward
      // circle-pip because it's the most dynamic layout. `topSlot: true` keeps
      // the main video anchored to the bottom half even if the user deletes
      // the card on this beat (the vacated top area renders as canvas white).
      cardBeatCount += 1;
      const useCircle = cardBeatCount % 3 !== 0;
      if (useCircle) {
        pushLayout(w.startMs, w.endMs, "circle-pip", true);
        circleCount += 1;
      } else {
        pushLayout(w.startMs, w.endMs, "split-bottom", true);
        splitCount += 1;
      }
    }

    console.log("[B-roll] post-intro layout plan", {
      remainingMs: totalMs - postIntroStart,
      windows: windows.length,
      cardBeats: cardBeatCount,
      circlePip: circleCount,
      split5050: splitCount,
      forcedCinema: forcedCinemaCount,
      cinemaGapBrollMs: cinemaGapMs,
    });
  }

  const mainId = uuid();
  elements.unshift({
    id: mainId,
    type: "video",
    url: mainVideoUrl,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
    zIndex: 8,
    startTime: 0,
    duration: totalMs,
    videoStartOffset: 0,
    thumbnail,
    muted: false,
    magicLayoutSegments,
  });

  console.log('[B-roll] buildMagicRhythmElements done', {
    elementCount: elements.length,
    primaryMainId: mainId,
    usedBRollIds: [...usedSet],
  });
  return {
    elements,
    primaryMainId: mainId,
    usedBRollIds: [...usedSet],
  };
}

/** Default script when opening Magic create (user can edit or replace). */
const MAGIC_CREATE_SAMPLE_SCRIPT = `Wait — nobody told you this about going viral on Reels?

Here's the one thing every faceless creator wishes they knew before posting. The algorithm looks random — but it's actually testing hooks first. Nail the first two seconds, and watch time follows.

Save this. Comment "HOOK" and I'll send you my full script template.`;

type SidebarSection = "avatars" | "media" | "templates" | "elements" | "audio" | "text" | "captions" | "brolls";

type Avatar = {
  id: string;
  name: string;
  url: string;
  /** Preset voice name (e.g. "Rachel") — saved with avatar_characters row. Used by Magic Create wizard to pre-pick an ElevenLabs voice. */
  presetVoiceName?: string | null;
};

const DEFAULT_AVATAR_IDS = new Set(["avatar_1", "avatar_2", "avatar_3", "avatar_4", "avatar_5", "avatar_6", "avatar_7"]);

/** Freepik often returns .mov; browsers usually cannot decode that in video/canvas for thumbnails. */
function isVideoUrlUnlikelyToDecodeForThumbnail(url: string): boolean {
  const u = url.toLowerCase();
  if (u.includes(".mov") || u.includes(".mxf")) return true;
  if (/[?&]filename=[^&]*\.mov/i.test(u)) return true;
  return false;
}

// Component to generate thumbnail for videos that don't have one yet
const VideoThumbnailGenerator = ({ 
  videoUrl, 
  elementId, 
  onThumbnailGenerated,
  posterUrl,
}: { 
  videoUrl: string; 
  elementId: string; 
  onThumbnailGenerated: (thumbnail: string) => void;
  /** Static image (e.g. Freepik thumbnail) — avoids canvas grab from .mov CDN URLs */
  posterUrl?: string | null;
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  // Use API-provided poster image immediately (no video element decode).
  useEffect(() => {
    if (thumbnail || error) return;
    const p = posterUrl?.trim();
    if (p && p.startsWith("http")) {
      setThumbnail(p);
      onThumbnailGenerated(p);
    }
  }, [posterUrl, thumbnail, error, onThumbnailGenerated]);

  useEffect(() => {
    if (!videoRef.current || thumbnail || error) return;
    if (posterUrl?.trim()?.startsWith("http")) return;

    if (isVideoUrlUnlikelyToDecodeForThumbnail(videoUrl)) {
      setError(true);
      return;
    }

    const video = videoRef.current;
    let timeoutId: NodeJS.Timeout;
    
    const handleLoadedMetadata = () => {
      // Seek to the very beginning (0 seconds) for thumbnail
      video.currentTime = 0;
      // Set timeout in case seeked doesn't fire
      timeoutId = setTimeout(() => {
        if (!thumbnail) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 90;
            const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha channel
            if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
              // Clear canvas with transparent background
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // Draw video frame
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // Use PNG format to preserve transparency
              const thumb = canvas.toDataURL('image/png');
              setThumbnail(thumb);
              onThumbnailGenerated(thumb);
            }
          } catch (err) {
            console.error('Error generating thumbnail (timeout):', err);
            setError(true);
          }
        }
      }, 2000);
    };

    const handleSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha channel for transparency
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          // Clear canvas with transparent background
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Draw video frame (will preserve transparency if video has alpha)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Use PNG format to preserve transparency
          const thumb = canvas.toDataURL('image/png');
          setThumbnail(thumb);
          onThumbnailGenerated(thumb);
          if (timeoutId) clearTimeout(timeoutId);
        } else {
          // If video dimensions aren't ready, wait a bit
          setTimeout(() => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              const canvas = document.createElement('canvas');
              canvas.width = 160;
              canvas.height = 90;
              const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha channel
              if (ctx) {
                // Clear canvas with transparent background
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Draw video frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Use PNG format to preserve transparency
                const thumb = canvas.toDataURL('image/png');
                setThumbnail(thumb);
                onThumbnailGenerated(thumb);
              }
            }
          }, 500);
        }
      } catch (err) {
        console.error('Error generating thumbnail:', err);
        setError(true);
      }
    };

    const handleError = () => {
      // Common for .mov / exotic codecs — avoid console noise; timeline shows placeholder.
      if (process.env.NODE_ENV === "development") {
        console.debug("[thumbnail] video decode not available:", videoUrl.slice(0, 120));
      }
      setError(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [videoUrl, posterUrl, thumbnail, onThumbnailGenerated, error]);

  if (thumbnail) {
    return (
      <div 
        className="h-full w-full"
        style={{ 
          backgroundImage: `url(${thumbnail})`,
          backgroundSize: '50px 100%',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center'
        }}
      />
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted text-[8px] text-muted-foreground rounded">
        Clip
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        muted
        preload="metadata"
        crossOrigin="anonymous"
        playsInline
      />
      <div className="h-full w-full flex items-center justify-center bg-gray-200 text-[8px] text-gray-500 rounded">
        Loading...
      </div>
    </>
  );
};

// Audio Waveform Component
const AudioWaveform: React.FC<{
  audioUrl?: string;
  audioStartOffset: number;
  duration: number;
  width: string;
  height: string;
}> = ({ audioUrl, audioStartOffset, duration, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 200;
      canvas.height = rect.height || 40;
    };
    updateCanvasSize();

    // Initialize Web Audio API
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let audioSource: MediaElementAudioSourceNode | null = null;
    let animationFrameId: number;

    const initAudio = async () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Smaller FFT for more bars
        analyser.smoothingTimeConstant = 0.8;

        const audio = new Audio(audioUrl);
        audio.crossOrigin = 'anonymous';
        audio.preload = 'metadata';
        
        audioSource = audioContext.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioContext.destination);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        // Draw waveform using frequency data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          if (!analyser || !ctx) return;
          
          analyser.getByteFrequencyData(dataArray);
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          
          const barCount = Math.min(50, Math.floor(canvas.width / 4)); // Limit bars for performance
          const barWidth = canvas.width / barCount;
          const centerY = canvas.height / 2;
          
          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * bufferLength);
            const barHeight = (dataArray[dataIndex] / 255) * (canvas.height * 0.8);
            const x = i * barWidth;
            
            // Draw symmetrical waveform bars
            ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
          }
          
          animationFrameId = requestAnimationFrame(draw);
        };

        // Start drawing when audio metadata loads
        audio.addEventListener('loadedmetadata', () => {
          draw();
        });

        // Fallback: Generate synthetic waveform if audio doesn't load
        setTimeout(() => {
          if (!analyserRef.current) {
            const numBars = Math.max(20, Math.floor(canvas.width / 3));
            const bars: number[] = [];
            
            for (let i = 0; i < numBars; i++) {
              // Generate wave-like pattern (sine wave with variation)
              const wave = Math.sin((i / numBars) * Math.PI * 4) * 0.3 + 0.5;
              bars.push(Math.max(0.2, Math.min(1.0, wave + (Math.random() * 0.2 - 0.1))));
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            
            const barWidth = canvas.width / bars.length;
            const centerY = canvas.height / 2;
            
            bars.forEach((barHeight, i) => {
              const x = i * barWidth;
              const barHeightPx = (barHeight * canvas.height) / 2;
              ctx.fillRect(x, centerY - barHeightPx, barWidth - 1, barHeightPx * 2);
            });
          }
        }, 1000);
      } catch (error) {
        console.error('Error initializing audio waveform:', error);
        // Fallback to synthetic waveform
        const numBars = Math.max(20, Math.floor(canvas.width / 3));
        const bars: number[] = [];
        
        for (let i = 0; i < numBars; i++) {
          const wave = Math.sin((i / numBars) * Math.PI * 4) * 0.3 + 0.5;
          bars.push(Math.max(0.2, Math.min(1.0, wave + (Math.random() * 0.2 - 0.1))));
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        
        const barWidth = canvas.width / bars.length;
        const centerY = canvas.height / 2;
        
        bars.forEach((barHeight, i) => {
          const x = i * barWidth;
          const barHeightPx = (barHeight * canvas.height) / 2;
          ctx.fillRect(x, centerY - barHeightPx, barWidth - 1, barHeightPx * 2);
        });
      }
    };

    initAudio();

    // Handle window resize
    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext) {
        audioContext.close();
      }
      if (audioSource) {
        audioSource.disconnect();
      }
    };
  }, [audioUrl, audioStartOffset, duration]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ width, height, pointerEvents: 'none' }}
    />
  );
};

export function AIUGCVideoEditor({ projectId: initialProjectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // Current time in ms
  const [duration, setDuration] = useState(10000); // Duration in ms (default: 10 seconds, will be calculated from elements)
  const [zoom, setZoom] = useState(80);
  const [canvasZoom, setCanvasZoom] = useState(90); // Canvas zoom level (percentage)
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  /** Slower word-by-word + beat fade on magic explainer text layers (preview only). */
  const [magicExplainerSlowAnimations, setMagicExplainerSlowAnimations] = useState(false);
  const mainVideoPlayerRef = useRef<HTMLVideoElement>(null);
  /**
   * Tracks the currently-mounted <video> DOM node for each canvas element id.
   *
   * The Magic main video renders through one of four mutually-exclusive JSX
   * branches (split-bottom / circle-pip w/ top card / circle-pip / default).
   * When `magicSeg.mode` flips at a beat boundary React unmounts the old
   * branch's <video> and mounts a new one; in some browsers the unmounted
   * node can keep decoding audio for a moment, producing a delayed echo.
   *
   * IMPORTANT: the ref callback lives on an inline `(videoEl) =>` arrow, so
   * React re-creates it every render → React calls the OLD ref with `null`
   * and then the NEW ref with the SAME node on every render cycle. We must
   * not treat the `null` as a real unmount (doing so stripped `src` on the
   * live video and broke all playback). Instead, we only act when we see a
   * REAL replacement: the new `videoEl` is a node that differs from the one
   * currently tracked for this element id. Null calls are ignored.
   */
  const activeCanvasVideoRefsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const attachCanvasVideoRef = useCallback(
    (elementId: string, videoEl: HTMLVideoElement | null) => {
      // Ignore detach-style callbacks — with inline refs these fire on every
      // render even though the underlying DOM node is unchanged.
      if (!videoEl) return;
      const map = activeCanvasVideoRefsRef.current;
      const prev = map.get(elementId);
      if (prev && prev !== videoEl) {
        // Genuine branch-swap: React mounted a new <video> for the same
        // element id. Hard-silence the outgoing node so its audio can't
        // linger as a delayed copy of the main track.
        try {
          prev.pause();
          prev.muted = true;
        } catch (_) {
          /* noop */
        }
      }
      map.set(elementId, videoEl);
      if ("preservesPitch" in videoEl) (videoEl as any).preservesPitch = true;
      try {
        videoEl.setAttribute("preservespitch", "true");
      } catch (_) {
        /* noop */
      }
    },
    []
  );
  const [activeSidebarSection, setActiveSidebarSection] = useState<SidebarSection>("captions");
  const [avatarsDialogOpen, setAvatarsDialogOpen] = useState(false);
  const [savedAvatars, setSavedAvatars] = useState<Avatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [creatingProjectFromAvatar, setCreatingProjectFromAvatar] = useState(false);
  const [avatarNextError, setAvatarNextError] = useState<string | null>(null);
  const [showSpeechGeneration, setShowSpeechGeneration] = useState(false);
  const [currentStep, setCurrentStep] = useState<"speech" | "lipsync">("speech");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [speechText, setSpeechText] = useState<string>("");
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0); // Speed multiplier (0.25 to 4.0, default 1.0)
  const [selectedModel, setSelectedModel] = useState<"flash" | "alpha3">("flash"); // Model selection: flash or alpha 3
  const [emotionsEnabled, setEmotionsEnabled] = useState<boolean>(false); // Whether emotions are enabled for alpha 3
  const [generatedSpeechUrl, setGeneratedSpeechUrl] = useState<string | null>(null);
  const [generatedSpeechVoiceId, setGeneratedSpeechVoiceId] = useState<string | null>(null);
  const [generatingSpeech, setGeneratingSpeech] = useState(false);
  const [generatingLipSync, setGeneratingLipSync] = useState(false);
  const [lipSyncVideoUrl, setLipSyncVideoUrl] = useState<string | null>(null);
  const generatingLipSyncRef = useRef(false); // Ref to track generation state to prevent race conditions
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ voice_id: string; name: string; category?: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [userSavedVoices, setUserSavedVoices] = useState<Array<{ id: string; name: string; eleven_labs_voice_id: string }>>([]);
  const [loadingUserVoices, setLoadingUserVoices] = useState(false);
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
  const [addVoiceDialogOpen, setAddVoiceDialogOpen] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState("");
  const [newVoiceId, setNewVoiceId] = useState("");
  const [savingNewVoice, setSavingNewVoice] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const uploadOwnVoiceInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const { user } = useAuthStore();
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Load user credits when component mounts or user changes
  useEffect(() => {
    const loadUserCredits = async () => {
      if (!user?.id) {
        setUserCredits(null);
        return;
      }
      
      try {
        const result = await subscriptionApi.getSubscriptionInfo();
        setUserCredits(result.subscription.credits || 0);
      } catch (error) {
        console.error("Error loading user credits:", error);
        setUserCredits(null);
      }
    };

    loadUserCredits();
  }, [user?.id]);

  // Calculate estimated credits for speech generation
  const calculateEstimatedCredits = useMemo(() => {
    if (!speechText || speechText.trim().length === 0) {
      return 0;
    }

    // Estimate duration: average speaking rate is ~150 words per minute = 2.5 words per second
    // Account for speech speed
    const words = speechText.trim().split(/\s+/).length;
    const estimatedSeconds = (words / 2.5) / speechSpeed; // Divide by speed (faster = shorter duration)
    
    // Credit rates: Flash = 0.2 credits/sec, Alpha = 0.35 credits/sec
    const creditRate = selectedModel === "flash" ? 0.2 : 0.35;
    const estimatedCredits = estimatedSeconds * creditRate;
    
    return Math.max(0.01, estimatedCredits); // Minimum 0.01 credits
  }, [speechText, selectedModel, speechSpeed]);

  // Check if user has enough credits
  const hasEnoughCredits = userCredits !== null && userCredits >= calculateEstimatedCredits;
  // Mutual exclusivity in speech step: once user picks a path, disable the other
  const ownVoiceChosen = !!(generatedSpeechUrl && !generatedSpeechVoiceId);
  const aiVoiceChosen = !!selectedVoice;
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [lipSyncStatus, setLipSyncStatus] = useState<string>(""); // Status message for lip sync
  const [lipSyncProgress, setLipSyncProgress] = useState<number>(0); // Progress percentage
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  
  // UGC Project state
  const [currentProject, setCurrentProject] = useState<UGCVideoProject | null>(null);
  const currentProjectRef = useRef<UGCVideoProject | null>(null);
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [voiceGenerationId, setVoiceGenerationId] = useState<string | null>(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadedVideos, setUploadedVideos] = useState<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>>([]);
  const [loadingUploadedVideos, setLoadingUploadedVideos] = useState(false);
  const [uploadedAudios, setUploadedAudios] = useState<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>>([]);
  const [loadingAudios, setLoadingAudios] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  // B-rolls state
  const [bRolls, setBRolls] = useState<BRoll[]>([]);
  const [loadingBRolls, setLoadingBRolls] = useState(false);
  const [selectedBRollIds, setSelectedBRollIds] = useState<string[]>([]); // Max 5 selected
  const [jumpCutInterval, setJumpCutInterval] = useState<number | null>(null); // In seconds
  const [fillJumpCutsDialogOpen, setFillJumpCutsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [generatedVideos, setGeneratedVideos] = useState<UGCGeneratedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [magicCreateOpen, setMagicCreateOpen] = useState(false);
  const [magicCreateScript, setMagicCreateScript] = useState("");
  const [magicCreateLoading, setMagicCreateLoading] = useState(false);
  const [magicCreateTranscribeLoading, setMagicCreateTranscribeLoading] = useState(false);
  /**
   * True once Transcribe has completed successfully for the currently selected
   * main video. Required before the user can advance past Step 2B — we don't
   * let them skip transcription with hand-typed text because the rest of the
   * Magic pipeline relies on word-timestamped SRT data that only STT produces.
   */
  const [magicCreateTranscribed, setMagicCreateTranscribed] = useState(false);
  /** `gen:${id}` or `upload:${id}` — main video for Magic create (not forced to latest lip-sync) */
  const [magicCreateMainVideoKey, setMagicCreateMainVideoKey] = useState<string | null>(null);
  /** Wizard step for the Magic Create 3-step flow. */
  type MagicWizardStep = "source" | "media" | "generate";
  const [magicWizardStep, setMagicWizardStep] = useState<MagicWizardStep>("source");
  /** Source chosen in Step 1: `"avatar"` or `"media"` */
  const [magicSource, setMagicSource] = useState<"avatar" | "media" | null>(null);
  /**
   * Set when the user picked "Select an Avatar" in Step 1 and we delegated to the existing
   * Avatars → Speech → Lipsync flow. When lipsync completes we reopen Magic Create on Step 3.
   */
  const [magicPendingReopenOnLipsync, setMagicPendingReopenOnLipsync] = useState(false);
  /**
   * When true, the media dialog is being used as a Magic Create picker (for choosing the
   * main video) rather than for adding media directly to the canvas. Selections route to
   * setMagicCreateMainVideoKey + close the media dialog, leaving the wizard open.
   */
  const [magicMediaPickerActive, setMagicMediaPickerActive] = useState(false);
  // Track where to insert a new element (after which element)
  const [insertAfterElementId, setInsertAfterElementId] = useState<string | null>(null);
  /** Dedupe concurrent Supabase project creates (client insert has no built-in timeout) */
  const ensureProjectInFlightRef = useRef<Promise<UGCVideoProject> | null>(null);

  // Track timeline container width to calculate scale that fits on screen
  const [timelineContainerWidth, setTimelineContainerWidth] = useState<number>(0);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  /** When canvas <video> fails (e.g. MOV in Chrome), show thumbnail; keyed by element id + failed url */
  const [canvasVideoFailedUrlByElementId, setCanvasVideoFailedUrlByElementId] = useState<
    Record<string, string>
  >({});

  const magicMainVideoOptions = useMemo(() => {
    const gen = [...generatedVideos]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      .map((v) => ({
        key: `gen:${v.id}` as const,
        label: `Lip sync · ${new Date(v.created_at).toLocaleString()}`,
        url: v.video_url,
        created_at: v.created_at,
        duration_seconds: v.duration_seconds,
      }));
    const up = uploadedVideos.map((v) => ({
      key: `upload:${v.id}` as const,
      label: `Upload · ${v.name || "Video"}`,
      url: v.url,
      created_at: v.created_at,
      duration_seconds: null as number | null,
    }));
    return [...gen, ...up];
  }, [generatedVideos, uploadedVideos]);

  useEffect(() => {
    if (!magicCreateOpen || magicMainVideoOptions.length === 0) return;
    setMagicCreateMainVideoKey((k) => {
      if (k && magicMainVideoOptions.some((o) => o.key === k)) return k;
      return magicMainVideoOptions[0]!.key;
    });
  }, [magicCreateOpen, magicMainVideoOptions]);

  // Whenever the user picks a different main video, the existing transcript
  // no longer matches — force them to re-run Transcribe before advancing.
  useEffect(() => {
    setMagicCreateTranscribed(false);
  }, [magicCreateMainVideoKey]);

  // Load project if projectId is provided
  useEffect(() => {
    if (initialProjectId && !currentProject) {
      const loadProject = async () => {
        try {
          console.log('[Load] Loading project from URL:', initialProjectId);
          const project = await getUGCProject(initialProjectId);
          setCurrentProject(project);
          console.log('[Load] Project loaded:', project.id);
        } catch (error: any) {
          console.error('[Load] Error loading project:', error);
          alert(`Failed to load project: ${error.message}`);
        }
      };
      loadProject();
    }
  }, [initialProjectId]); // Only run when initialProjectId changes
  
  // Measure timeline container width to ensure it fits on screen
  useEffect(() => {
    const updateContainerWidth = () => {
      if (timelineContainerRef.current) {
        const rect = timelineContainerRef.current.getBoundingClientRect();
        // Account for track controls (80px) and padding (16px)
        const availableWidth = rect.width - 80 - 16;
        if (availableWidth > 0 && availableWidth !== timelineContainerWidth) {
          setTimelineContainerWidth(availableWidth);
        }
      }
    };
    
    // Initial measurement
    const timeoutId = setTimeout(updateContainerWidth, 100);
    
    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });
    
    if (timelineContainerRef.current) {
      resizeObserver.observe(timelineContainerRef.current);
    }
    
    // Fallback to window resize
    window.addEventListener('resize', updateContainerWidth);
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateContainerWidth);
    };
  }, [timelineContainerWidth]);
  
  // Calculate dynamic scale factor for timeline (pixels per second)
  // Scale is calculated to fit the timeline within the available screen width
  const timelineScale = useMemo(() => {
    if (!duration || duration === 0) return 50; // Default 50px per second
    
    const durationSeconds = duration / 1000;
    
    // If we have container width, calculate scale to fit exactly
    if (timelineContainerWidth > 0) {
      // Calculate scale so timeline fits: durationSeconds * scale <= availableWidth
      // Use 95% of width to ensure it fits comfortably with some padding
      const calculatedScale = (timelineContainerWidth * 0.95) / durationSeconds;
      
      // Set minimum and maximum scale bounds for readability
      const minScale = 5; // Minimum 5px per second (very compressed)
      const maxScale = 100; // Maximum 100px per second (very detailed)
      
      // Clamp to bounds
      return Math.max(minScale, Math.min(maxScale, calculatedScale));
    }
    
    // Fallback: use duration-based scale if container width not available yet
    if (durationSeconds <= 30) {
      return 50; // 50px per second for short videos
    } else if (durationSeconds <= 120) {
      return 20; // 20px per second for medium videos
    } else {
      return 10; // 10px per second for long videos
    }
  }, [duration, timelineContainerWidth]);
  
  // Calculate timeline width - always use 100% to fit container, scale handles the calibration
  const timelineWidth = useMemo(() => {
    // Always use 100% width - the scale factor ensures proper calibration
    // The timeline will fit within the container without scrolling
    return '100%';
  }, []);
  
  // Calculate thumbnail width based on timeline scale
  // Thumbnails should be proportional to the timeline scale
  const thumbnailWidth = useMemo(() => {
    // Base thumbnail size scales with timeline scale
    // Scale thumbnails proportionally to maintain visual consistency
    // Use approximately 1:1 ratio with scale (1 second = scale pixels)
    const baseThumbnailSize = Math.max(20, Math.min(60, timelineScale));
    return baseThumbnailSize;
  }, [timelineScale]);
  
  // Asset management
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  
  // Subtitles
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [originalSubtitleSegments, setOriginalSubtitleSegments] = useState<SubtitleSegment[]>([]); // Store original for restore
  const [subtitleSrtText, setSubtitleSrtText] = useState<string>("");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("outlined");
  const [subtitlePosition, setSubtitlePosition] = useState<SubtitlePosition>({ x: 50, y: 85 });
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(100);
  const [subtitleFontFamily, setSubtitleFontFamily] = useState<SubtitleFontFamily>("bebas-neue");
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);
  const [karaokePillColor, setKaraokePillColor] = useState<string>("#E96BA8");
  const [boldGreenColor, setBoldGreenColor] = useState<string>("#63E443");
  const [subtitleSingleLine, setSubtitleSingleLine] = useState(false);
  const [subtitleSingleWord, setSubtitleSingleWord] = useState(false);
  
  // Timeline
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrack[]>([]);
  
  // Canvas elements
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPanning, setIsPanning] = useState(false); // For panning image content within element
  const [isCropping, setIsCropping] = useState(false); // For cropping images
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null); // Crop selection start position
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // Current crop area being drawn
  const [resizeDirection, setResizeDirection] = useState<string | null>(null); // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimElementId, setTrimElementId] = useState<string | null>(null);
  const [trimEdge, setTrimEdge] = useState<'left' | 'right' | null>(null);
  const [trimStart, setTrimStart] = useState({ x: 0 }); // Only track initial mouse position
  const trimStartRef = useRef({ x: 0, startTime: 0, duration: 0, videoStartOffset: 0, audioStartOffset: 0 }); // Ref to avoid stale closures - store initial element state
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [draggingTimelineElementId, setDraggingTimelineElementId] = useState<string | null>(null);
  const [dragTimelineStart, setDragTimelineStart] = useState({ x: 0, startTime: 0 });
  // Store original media durations for hard stop enforcement
  const originalMediaDurationsRef = useRef<Map<string, number>>(new Map());
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, imageOffsetX: 50, imageOffsetY: 50 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 }); // Initial pan position
  const [timelineHeight, setTimelineHeight] = useState(160); // Timeline height in pixels (default: 160px = h-40)
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  // ---------------------------------------------------------------------------
  // Magic layout circle editing (the "Circle" on the canvas during circle-pip).
  // `selectedLayoutSegmentIdx` points into the main video's magicLayoutSegments
  // array while the user has that specific circle-pip segment selected for
  // editing. `isResizingCircle` + `circleResizeStartRef` drive the drag-resize
  // handle on the bottom-right of the circle.
  // ---------------------------------------------------------------------------
  const [selectedLayoutSegmentIdx, setSelectedLayoutSegmentIdx] = useState<number | null>(null);
  const [isResizingCircle, setIsResizingCircle] = useState(false);
  const circleResizeStartRef = useRef<{ x: number; y: number; scale: number; canvasWidth: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastPlayingStateRef = useRef<boolean>(false);
  const [removingBackground, setRemovingBackground] = useState<string | null>(null); // Element ID being processed
  const loadingImagesRef = useRef<boolean>(false); // Track if images are currently loading
  const loadingVideosRef = useRef<boolean>(false); // Track if videos are currently loading
  const loadingUploadedVideosRef = useRef<boolean>(false); // Track if uploaded videos are currently loading
  const [contextMenuElementId, setContextMenuElementId] = useState<string | null>(null); // Element ID for context menu
  const [isExporting, setIsExporting] = useState(false); // Export state
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null); // Exported video URL for download
  const [renderJobId, setRenderJobId] = useState<string | null>(null); // Render job ID for progress tracking
  const [renderProgress, setRenderProgress] = useState<number>(0); // Render progress percentage
  const [renderStatus, setRenderStatus] = useState<'QUEUED' | 'RENDERING' | 'READY' | 'FAILED' | null>(null); // Render status
  
  // Get subscribeToRenderJob from project store
  const { subscribeToRenderJob } = useProjectStore();
  const renderJobSubscriptionRef = useRef<any>(null); // Store subscription reference
  const [trimOverlapIndicator, setTrimOverlapIndicator] = useState<{ time: number; type: 'start' | 'end' } | null>(null); // Blue line indicator when trimming approaches another element
  
  // Subscribe to render job updates for UGC renders
  useEffect(() => {
    if (!renderJobId) return;
    
    // Unsubscribe from any existing subscription
    if (renderJobSubscriptionRef.current) {
      supabase.removeChannel(renderJobSubscriptionRef.current);
      renderJobSubscriptionRef.current = null;
    }
    
    console.log('[UGC Render] Subscribing to render job updates:', renderJobId);
    const channel = supabase
      .channel(`ugc-render-job-${renderJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'render_jobs',
          filter: `id=eq.${renderJobId}`,
        },
        (payload) => {
          const renderJob = payload.new as any;
          console.log('[UGC Render] Render job update received:', renderJob);
          
          if (!renderJob) return;
          
          const jobStatus = (renderJob.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
          
          // Map backend status to frontend status
          let frontendStatus: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
          if (jobStatus === 'completed') {
            frontendStatus = 'READY';
            setRenderProgress(100);
            if (renderJob.result_url) {
              setExportedVideoUrl(renderJob.result_url);
            }
          } else if (jobStatus === 'failed') {
            frontendStatus = 'FAILED';
          } else if (jobStatus === 'processing') {
            frontendStatus = 'RENDERING';
            setRenderProgress(renderJob.progress || 0);
          } else {
            frontendStatus = 'QUEUED';
            setRenderProgress(0);
          }
          
          setRenderStatus(frontendStatus);
          
          // Unsubscribe when completed or failed
          if (jobStatus === 'completed' || jobStatus === 'failed') {
            if (renderJobSubscriptionRef.current) {
              supabase.removeChannel(renderJobSubscriptionRef.current);
              renderJobSubscriptionRef.current = null;
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[UGC Render] Subscribed to render job updates');
        } else if (err) {
          console.error('[UGC Render] Subscription error:', err);
        }
      });
    
    renderJobSubscriptionRef.current = channel;
    
    // Cleanup on unmount or when renderJobId changes
    return () => {
      if (renderJobSubscriptionRef.current) {
        supabase.removeChannel(renderJobSubscriptionRef.current);
        renderJobSubscriptionRef.current = null;
      }
    };
  }, [renderJobId]);
  
  // Undo/Redo History
  interface HistoryState {
    canvasElements: CanvasElement[];
    subtitleSegments: SubtitleSegment[];
    subtitleStyle: SubtitleStyle;
    subtitlePosition: SubtitlePosition;
    subtitleFontSize: number;
    subtitleFontFamily: SubtitleFontFamily;
    subtitleSingleLine: boolean;
    subtitleSingleWord: boolean;
    karaokePillColor: string;
    boldGreenColor: string;
    zoom: number;
  }
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50; // Maximum number of history states to keep
  const isUndoRedoRef = useRef(false); // Flag to prevent saving history during undo/redo
  const exportedVideoUrlRef = useRef<string | null>(null); // Ref to always have the latest URL
  
  // Keep ref in sync with state
  useEffect(() => {
    exportedVideoUrlRef.current = exportedVideoUrl;
    console.log('[Export URL Sync] Updated ref to:', exportedVideoUrl);
  }, [exportedVideoUrl]);

  // Sync currentProject state to ref
  useEffect(() => {
    currentProjectRef.current = currentProject;
    console.log('[Project Ref Sync] Updated ref to:', currentProject?.id);
  }, [currentProject]);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    if (isUndoRedoRef.current) return; // Don't save during undo/redo
    
    const currentState: HistoryState = {
      canvasElements: JSON.parse(JSON.stringify(canvasElements)), // Deep clone
      subtitleSegments: JSON.parse(JSON.stringify(subtitleSegments)), // Deep clone
      subtitleStyle,
      subtitlePosition: { ...subtitlePosition },
      subtitleFontSize,
      subtitleFontFamily,
      subtitleSingleLine,
      subtitleSingleWord,
      karaokePillColor,
      boldGreenColor,
      zoom,
    };
    
    setHistory(prev => {
      // Remove any states after current index (when user does new action after undo)
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      const updatedHistory = [...newHistory, currentState];
      // Limit history size
      if (updatedHistory.length > maxHistorySize) {
        return updatedHistory.slice(-maxHistorySize);
      }
      return updatedHistory;
    });
    
    setHistoryIndex(prev => {
      const newIndex = prev + 1;
      // Limit index to history size
      return Math.min(newIndex, maxHistorySize - 1);
    });
  }, [
    canvasElements,
    subtitleSegments,
    subtitleStyle,
    subtitlePosition,
    subtitleFontSize,
    subtitleFontFamily,
    subtitleSingleLine,
    subtitleSingleWord,
    karaokePillColor,
    boldGreenColor,
    zoom,
    historyIndex,
  ]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return; // No history to undo to
    
    isUndoRedoRef.current = true;
    const previousState = history[historyIndex - 1];
    
    if (previousState) {
      setCanvasElements(previousState.canvasElements);
      setSubtitleSegments(previousState.subtitleSegments);
      setSubtitleStyle(previousState.subtitleStyle);
      setSubtitlePosition(previousState.subtitlePosition);
      setSubtitleFontSize(previousState.subtitleFontSize);
      setSubtitleFontFamily(previousState.subtitleFontFamily);
      setSubtitleSingleLine(previousState.subtitleSingleLine);
      setSubtitleSingleWord(previousState.subtitleSingleWord);
      setKaraokePillColor(previousState.karaokePillColor);
      setBoldGreenColor(previousState.boldGreenColor);
      setZoom(previousState.zoom);
    }
    
    setHistoryIndex(prev => prev - 1);
    
    // Reset flag after state updates
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return; // No history to redo to
    
    isUndoRedoRef.current = true;
    const nextState = history[historyIndex + 1];
    
    if (nextState) {
      setCanvasElements(nextState.canvasElements);
      setSubtitleSegments(nextState.subtitleSegments);
      setSubtitleStyle(nextState.subtitleStyle);
      setSubtitlePosition(nextState.subtitlePosition);
      setSubtitleFontSize(nextState.subtitleFontSize);
      setSubtitleFontFamily(nextState.subtitleFontFamily);
      setSubtitleSingleLine(nextState.subtitleSingleLine);
      setSubtitleSingleWord(nextState.subtitleSingleWord);
      setKaraokePillColor(nextState.karaokePillColor);
      setBoldGreenColor(nextState.boldGreenColor);
      setZoom(nextState.zoom);
    }
    
    setHistoryIndex(prev => prev + 1);
    
    // Reset flag after state updates
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [history, historyIndex]);

  // Initialize history with current state on mount
  useEffect(() => {
    if (history.length === 0) {
      const initialState: HistoryState = {
        canvasElements: JSON.parse(JSON.stringify(canvasElements)),
        subtitleSegments: JSON.parse(JSON.stringify(subtitleSegments)),
        subtitleStyle,
        subtitlePosition: { ...subtitlePosition },
        subtitleFontSize,
        subtitleFontFamily,
        subtitleSingleLine,
        subtitleSingleWord,
        karaokePillColor,
        boldGreenColor,
        zoom,
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, []); // Only run once on mount

  // Save to history when state changes (debounced to avoid too many saves)
  // Only save after user actions, not during undo/redo or initial load
  const saveHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (history.length === 0 || isUndoRedoRef.current) return; // Skip if no history yet or during undo/redo
    
    // Clear previous timeout
    if (saveHistoryTimeoutRef.current) {
      clearTimeout(saveHistoryTimeoutRef.current);
    }
    
    // Debounce history saves to avoid saving on every tiny change
    saveHistoryTimeoutRef.current = setTimeout(() => {
      if (!isUndoRedoRef.current) {
        saveToHistory();
      }
    }, 500); // Wait 500ms after last change before saving
    
    return () => {
      if (saveHistoryTimeoutRef.current) {
        clearTimeout(saveHistoryTimeoutRef.current);
      }
    };
  }, [
    canvasElements,
    subtitleSegments,
    subtitleStyle,
    subtitlePosition,
    subtitleFontSize,
    subtitleFontFamily,
    subtitleSingleLine,
    subtitleSingleWord,
    karaokePillColor,
    boldGreenColor,
    zoom,
    saveToHistory,
  ]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y or Cmd+Shift+Z or Cmd+Y for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  // Format time
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      const fileType = file.type.split("/")[0];
      if (fileType === "image" || fileType === "video" || fileType === "audio") {
        try {
          setUploadingFileName(file.name);
          
          if (fileType === "image") {
            // Upload image via backend endpoint
            const formData = new FormData();
            formData.append('image', file);

            // Get auth token from cache (avoids hanging getSession calls)
            const { getCachedToken } = await import('@/lib/utils/token-cache');
            const cachedToken = await getCachedToken();
            const headers: HeadersInit = {};
            if (cachedToken) {
              headers['Authorization'] = `Bearer ${cachedToken}`;
            }

            const response = await fetch(`${config.remotionServerUrl}/user/upload-image`, {
              method: 'POST',
              headers,
              body: formData,
              // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success && data.url) {
              const newAsset: Asset = {
                id: uuid(),
                name: file.name,
                type: "image",
                url: data.url,
              };
              setAssets([...assets, newAsset]);
              
              // Reload uploaded images list (non-blocking)
              loadUploadedImages().catch(err => console.error("Failed to reload images:", err));
              setUploadingFileName(null);
            } else {
              throw new Error(data.error || 'Failed to upload image');
            }
          } else if (fileType === "video") {
            // Upload video via backend endpoint
            const formData = new FormData();
            formData.append('video', file);

            // Get auth token from cache (avoids hanging getSession calls)
            const { getCachedToken } = await import('@/lib/utils/token-cache');
            const cachedToken = await getCachedToken();
            const headers: HeadersInit = {};
            if (cachedToken) {
              headers['Authorization'] = `Bearer ${cachedToken}`;
            }

            const response = await fetch(`${config.remotionServerUrl}/user/upload-video`, {
              method: 'POST',
              headers,
              body: formData,
              // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success && data.url) {
              const newAsset: Asset = {
                id: uuid(),
                name: file.name,
                type: "video",
                url: data.url,
              };
              setAssets([...assets, newAsset]);
              
              // Reload uploaded videos list (non-blocking)
              loadUploadedVideos().catch(err => console.error("Failed to reload videos:", err));
              setUploadingFileName(null);
            } else {
              throw new Error(data.error || 'Failed to upload video');
            }
          } else if (fileType === "audio") {
            // Upload audio via Supabase Storage
            ensureProjectExists();
            const projectId = currentProject?.id || uuid();
            
            const fileName = `audio-${uuid()}.${file.name.split('.').pop()}`;
            const audioUrl = await uploadAudioToStorage(file, projectId, fileName);
            
            // Save metadata to database using REST API (avoids hanging Supabase client calls)
            const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
            let token = await getCachedToken();
            
            if (token) {
              try {
                // Extract userId from token
                const payload = JSON.parse(atob(token.split('.')[1]));
                const userId = payload.sub || payload.user_id;
                
                if (userId) {
                  const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
                  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                  
                  if (supabaseUrl && supabaseAnonKey) {
              const storagePath = `ugc-audio/${projectId}/${fileName}`;
                    const insertUrl = `${supabaseUrl}/rest/v1/user_uploads`;
                    
                    const makeRequest = async (authToken: string) => {
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 10000);
                      try {
                        const response = await fetch(insertUrl, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                            'apikey': supabaseAnonKey,
                            'Prefer': 'return=minimal'
                          },
                          body: JSON.stringify({
                            user_id: userId,
                file_name: fileName,
                file_type: 'audio',
                storage_path: storagePath,
                storage_url: audioUrl,
                file_size: file.size,
                mime_type: file.type,
                metadata: {}
                          }),
                          signal: controller.signal
                        });
                        clearTimeout(timeoutId);
                        return response;
                      } catch (err) {
                        clearTimeout(timeoutId);
                        throw err;
                      }
                    };
                    
                    let response = await makeRequest(token);
                    
                    // Handle 401 - refresh token and retry
                    if (response.status === 401) {
                      const refreshedToken = await refreshToken();
                      if (refreshedToken) {
                        response = await makeRequest(refreshedToken);
                      }
                    }
                    
                    if (!response.ok) {
                      console.warn('[Audio Upload] Failed to save metadata:', response.status);
                    }
                  }
                }
              } catch (error) {
                console.warn('[Audio Upload] Error saving metadata:', error);
                // Continue even if metadata save fails
              }
            }
            
            // Calculate startTime: place after the last audio element, but ensure it fits within timeline
            const existingAudioElements = canvasElements.filter(el => el.type === "audio");
            let audioStartTime = 0;
            if (existingAudioElements.length > 0) {
              // Find the last audio element's end time
              const lastAudio = existingAudioElements.reduce((latest, el) => {
                const elEndTime = (el.startTime || 0) + (el.duration || 5000);
                const latestEndTime = (latest.startTime || 0) + (latest.duration || 5000);
                return elEndTime > latestEndTime ? el : latest;
              });
              const calculatedStartTime = (lastAudio.startTime || 0) + (lastAudio.duration || 5000);
              // Ensure the audio fits within the timeline
              // If it would exceed, place it at the start instead
              audioStartTime = Math.max(0, Math.min(calculatedStartTime, duration - 5000)); // Leave room for at least 5s duration
            }
            
            // Add to canvas as audio element
            const audioElement: CanvasElement = {
              id: uuid(),
              type: "audio",
              url: audioUrl,
              x: 50,
              y: 50,
              width: 50,
              height: 50,
              startTime: audioStartTime,
              duration: 5000, // Will be updated when audio loads
              audioStartOffset: 0, // Initialize audio start offset for trimming
              muted: false,
              rotation: 0,
              opacity: 1,
              zIndex: canvasElements.length,
            };
            
            setCanvasElements([...canvasElements, audioElement]);
            await loadUploadedAudios();
            setUploadingFileName(null);
          }
        } catch (error) {
          console.error(`Error uploading ${fileType}:`, error);
          alert(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setUploadingFileName(null);
        }
      }
    }
    
    setIsUploading(false);
    setUploadingFileName(null);
    
    // Reset input
    event.target.value = '';
  };

  // Load uploaded images from Supabase
  const loadUploadedImages = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingImagesRef.current) {
      console.log('[Media] Already loading images, skipping...');
      return;
    }
    
    loadingImagesRef.current = true;
    setLoadingImages(true);
    try {
      // Add timeout to prevent infinite loading (60 seconds - increased for slow connections)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 60000)
      );
      
      const images = await Promise.race([
        getUserUploadedImages(),
        timeoutPromise
      ]);
      
      console.log("Loaded uploaded images:", images);
      setUploadedImages(images);
    } catch (error: any) {
      console.error("Error loading uploaded images:", error);
      // Set empty array on error so UI doesn't stay in loading state
      setUploadedImages([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load uploaded images, continuing with empty list");
      }
    } finally {
      loadingImagesRef.current = false;
      setLoadingImages(false);
    }
  }, []);

  const loadUploadedVideos = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingUploadedVideosRef.current) {
      console.log('[Media] Already loading uploaded videos, skipping...');
      return;
    }
    
    loadingUploadedVideosRef.current = true;
    setLoadingUploadedVideos(true);
    try {
      // Add timeout to prevent infinite loading (60 seconds - increased for slow connections)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 60000)
      );
      
      const videos = await Promise.race([
        getUserUploadedVideos(),
        timeoutPromise
      ]);
      
      console.log("Loaded uploaded videos:", videos);
      setUploadedVideos(videos);
    } catch (error: any) {
      console.error("Error loading uploaded videos:", error);
      // Set empty array on error so UI doesn't stay in loading state
      setUploadedVideos([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load uploaded videos, continuing with empty list");
      }
    } finally {
      loadingUploadedVideosRef.current = false;
      setLoadingUploadedVideos(false);
    }
  }, []);

  // Delete handlers
  const handleDeleteImage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }
    try {
      await deleteUploadedImage(id);
      setUploadedImages(uploadedImages.filter(img => img.id !== id));
    } catch (error) {
      console.error("Error deleting image:", error);
      alert('Failed to delete image. Please try again.');
    }
  };

  const handleDeleteVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }
    try {
      await deleteUploadedVideo(id);
      setUploadedVideos(uploadedVideos.filter(vid => vid.id !== id));
    } catch (error) {
      console.error("Error deleting video:", error);
      alert('Failed to delete video. Please try again.');
    }
  };

  const handleDeleteGeneratedVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this generated video?')) {
      return;
    }
    try {
      await deleteGeneratedVideo(id);
      setGeneratedVideos(generatedVideos.filter(vid => vid.id !== id));
    } catch (error) {
      console.error("Error deleting generated video:", error);
      alert('Failed to delete generated video. Please try again.');
    }
  };

  const loadUploadedAudios = async () => {
    setLoadingAudios(true);
    try {
      // Add timeout to prevent infinite loading (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      const audios = await Promise.race([
        getUserUploadedAudios(),
        timeoutPromise
      ]);
      
      console.log("Loaded uploaded audios:", audios);
      setUploadedAudios(audios);
    } catch (error: any) {
      console.error("Error loading uploaded audios:", error);
      // Set empty array on error so UI doesn't stay in loading state
      setUploadedAudios([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load uploaded audios, continuing with empty list");
      }
    } finally {
      setLoadingAudios(false);
    }
  };

  const handleDeleteAudio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this audio?')) {
      return;
    }
    try {
      await deleteUploadedAudio(id);
      setUploadedAudios(uploadedAudios.filter(audio => audio.id !== id));
    } catch (error) {
      console.error("Error deleting audio:", error);
      alert('Failed to delete audio. Please try again.');
    }
  };

  const loadBRolls = useCallback(async () => {
    console.log('[B-roll] loadBRolls: start (stockOnly=true)');
    setLoadingBRolls(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      const result = await Promise.race([
        bRollsApi.list({ stockOnly: true }),
        timeoutPromise
      ]);
      
      console.log('[B-roll] loadBRolls: success', {
        count: result.bRolls?.length ?? 0,
        stockSearchTerm: result.stockSearchTerm ?? null,
        ids: (result.bRolls || []).slice(0, 12).map((b) => b.id),
      });
      setBRolls(result.bRolls || []);
    } catch (error: any) {
      console.error('[B-roll] loadBRolls: error', error);
      setBRolls([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load B-rolls, continuing with empty list");
      }
    } finally {
      console.log('[B-roll] loadBRolls: finished');
      setLoadingBRolls(false);
    }
  }, []);

  // Load B-rolls when B-rolls section is activated
  useEffect(() => {
    if (activeSidebarSection === "brolls" && bRolls.length === 0 && !loadingBRolls) {
      loadBRolls();
    }
  }, [activeSidebarSection, bRolls.length, loadingBRolls, loadBRolls]);

  /**
   * Generate B-roll clips at specified intervals
   * @param totalDurationMs - Total video duration in milliseconds
   * @param intervalSeconds - Jump cut interval in seconds
   * @param selectedBRolls - Array of selected B-roll objects
   * @returns Array of CanvasElement objects for B-roll clips
   */
  const generateBRollClips = (
    totalDurationMs: number,
    intervalSeconds: number,
    selectedBRolls: BRoll[]
  ): CanvasElement[] => {
    console.log('[B-roll] generateBRollClips start', {
      totalDurationMs,
      intervalSeconds,
      selectedBRollsCount: selectedBRolls.length,
      selectedBRolls: selectedBRolls.map(b => ({ id: b.id, name: b.name, url: b.url, durationSeconds: b.durationSeconds }))
    });

    if (selectedBRolls.length === 0 || intervalSeconds <= 0) {
      console.warn('[B-roll] generateBRollClips: invalid input', { selectedBRollsLength: selectedBRolls.length, intervalSeconds });
      return [];
    }

    const clips: CanvasElement[] = [];
    const intervalMs = intervalSeconds * 1000;
    const clipDurationMs = 3000; // 3 seconds per clip
    const totalDurationSeconds = totalDurationMs / 1000;

    console.log('[B-roll] generateBRollClips timing', {
      totalDurationSeconds,
      intervalSeconds,
      expectedClips: Math.floor((totalDurationSeconds - intervalSeconds) / intervalSeconds) + 1
    });

    // Round-robin through selected B-rolls so the same clip is not chosen back-to-back
    let rr = 0;
    for (let time = intervalSeconds; time < totalDurationSeconds; time += intervalSeconds) {
      console.log('[B-roll] generateBRollClips interval', { timeSec: time });
      const randomBRoll = selectedBRolls[rr % selectedBRolls.length]!;
      rr += 1;

      if (!randomBRoll || !randomBRoll.url) {
        console.warn('[B-roll] generateBRollClips: missing URL', randomBRoll);
        continue;
      }

      // Calculate random start offset within the B-roll video
      // Ensure we can play at least 3 seconds from the start point
      const bRollDurationSeconds = randomBRoll.durationSeconds || 10; // Default 10s if not available
      const maxStartOffsetSeconds = Math.max(0, bRollDurationSeconds - 3); // Leave 3s for clip
      const randomStartOffsetSeconds = Math.random() * maxStartOffsetSeconds;
      const videoStartOffsetMs = randomStartOffsetSeconds * 1000;

      // Create clip element
      const clip: CanvasElement = {
        id: uuid(),
        type: "video",
        url: randomBRoll.url,
        thumbnail: randomBRoll.thumbnailUrl || undefined,
        x: 0, // Full screen overlay
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 1000 + clips.length, // High z-index to be on top
        startTime: time * 1000, // Start at the interval time
        duration: clipDurationMs, // 3 seconds
        videoStartOffset: videoStartOffsetMs, // Random start point in the B-roll video
        muted: true, // B-rolls are overlays, typically muted
      };

      clips.push(clip);
      console.log('[B-roll] generateBRollClips pushed clip', {
        clipId: clip.id,
        bRollId: randomBRoll.id,
        startTimeMs: clip.startTime,
        videoStartOffsetMs,
      });
    }

    console.log('[B-roll] generateBRollClips done', { clipCount: clips.length });
    return clips;
  };

  // Toggle playback
  const togglePlayback = () => {
    if (mainVideoPlayerRef.current) {
      if (isPlaying) {
        mainVideoPlayerRef.current.pause();
      } else {
        mainVideoPlayerRef.current.play().catch((err) => {
          // Ignore AbortError - it's expected when play() is interrupted by pause()
          if (err.name !== 'AbortError') {
            console.error('Error playing main video:', err);
          }
        });
      }
      setIsPlaying(!isPlaying);
    } else {
      // If no main video, toggle canvas video elements
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
          if (video) {
            // Apply playback rate with preservesPitch
            setVideoPlaybackRate(video, playbackRate);
            if (isPlaying) {
              video.pause();
            } else {
              video.play().catch((err) => {
                // Ignore AbortError - it's expected when play() is interrupted by pause()
                if (err.name !== 'AbortError') {
                  console.error('Error playing canvas video:', err);
                }
              });
            }
          }
        }
      });
      setIsPlaying(!isPlaying);
    }
  };

  // Handle timeline scrub
  const handleTimelineScrub = (newTime: number) => {
    const clampedTime = Math.max(0, Math.min(duration, newTime));
    setCurrentTime(clampedTime);
    
    if (mainVideoPlayerRef.current) {
      mainVideoPlayerRef.current.currentTime = clampedTime / 1000;
    }
    
    // Update all canvas video elements - account for each element's startTime
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video) {
          const elementStartTime = element.startTime || 0;
          const elementDuration = element.duration || (video.duration * 1000 || 5000);
          const elementEndTime = elementStartTime + elementDuration;
          
          // Only update video if timeline is within its startTime range
          if (clampedTime >= elementStartTime && clampedTime < elementEndTime) {
            const videoStartOffset = element.videoStartOffset || 0;
            const videoTime = (videoStartOffset + (clampedTime - elementStartTime)) / 1000;
            
            // Calculate trimmed start and end times
            const trimmedStartTime = videoStartOffset / 1000;
            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
            // Clamp video time to trimmed range
            const clampedVideoTime = Math.max(
              trimmedStartTime,
              Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
            );
            
            if (video.readyState >= 2) {
              // During scrubbing, ONLY update currentTime - don't touch playbackRate
              // This prevents audio glitches
              video.currentTime = clampedVideoTime;
              
              // Only set playbackRate when video actually starts playing (not during scrubbing)
              if (isPlaying && video.paused && clampedVideoTime < trimmedEndTime - 0.1) {
                // Video is about to start playing - set playbackRate and preservesPitch before playing
                if ('preservesPitch' in video) {
                  (video as any).preservesPitch = true;
                }
                if (video.playbackRate !== playbackRate) {
                  video.playbackRate = playbackRate;
                }
                video.play().catch((err) => {
                  // Ignore AbortError - it's expected when play() is interrupted
                  if (err.name !== 'AbortError') {
                    console.error('Error playing video:', err);
                  }
                });
              }
            }
          } else {
            // Timeline is outside video's range - pause it
            if (!video.paused) {
              video.pause();
            }
            if (clampedTime < elementStartTime) {
              // Timeline is before video starts - reset to trimmed start
              const videoStartOffset = element.videoStartOffset || 0;
              video.currentTime = videoStartOffset / 1000;
            } else if (clampedTime >= elementEndTime && video.duration) {
              // Timeline is after video ends - set to trimmed end
              const videoStartOffset = element.videoStartOffset || 0;
              const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
              video.currentTime = Math.min(trimmedEndTime, video.duration);
            }
          }
        }
      }
      
      // Update audio elements - account for each element's startTime
      if (element.type === "audio" && element.url) {
        const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
        if (audio) {
          const elementStartTime = element.startTime || 0;
          const elementDuration = element.duration || (audio.duration * 1000 || 5000);
          const elementEndTime = elementStartTime + elementDuration;
          const audioStartOffset = element.audioStartOffset || 0;
          
          // Only update audio if timeline is within its startTime range
          if (clampedTime >= elementStartTime && clampedTime < elementEndTime) {
            // Calculate audio's internal time based on timeline position and audioStartOffset
            const audioTime = (audioStartOffset + (clampedTime - elementStartTime)) / 1000;
            const clampedAudioTime = Math.max(0, Math.min(audioTime, audio.duration || Infinity));
            
            if (audio.readyState >= 2) {
              audio.currentTime = clampedAudioTime;
            }
          } else {
            // Timeline is outside audio's range - pause it
            if (!audio.paused) {
              audio.pause();
            }
            // Reset audio time appropriately
            if (clampedTime < elementStartTime) {
              audio.currentTime = audioStartOffset / 1000; // Set to audio start offset
            } else if (clampedTime >= elementEndTime && audio.duration) {
              audio.currentTime = Math.min((audioStartOffset + elementDuration) / 1000, audio.duration);
            }
          }
        }
      }
    });
  };

  // Helper function to safely set playbackRate with preservesPitch
  // skipPauseResume: if true, don't pause/resume (use during scrubbing to avoid audio glitches)
  const setVideoPlaybackRate = (video: HTMLVideoElement, rate: number, skipPauseResume: boolean = false) => {
    if (!video) return;
    
    // Set preservesPitch BEFORE setting playbackRate to prevent audio distortion
    // Try both property and attribute methods for maximum compatibility
    if ('preservesPitch' in video) {
      (video as any).preservesPitch = true;
    }
    // Also try setting as attribute (some browsers need this)
    try {
      video.setAttribute('preservespitch', 'true');
    } catch (e) {
      // Ignore if attribute setting fails
    }
    
    // During scrubbing, don't pause/resume - just set playbackRate directly
    // This prevents audio glitches when the user is dragging the timeline
    if (skipPauseResume) {
      video.playbackRate = rate;
      return;
    }
    
    // For non-scrubbing operations, pause before changing to prevent audio glitches
    const wasPlaying = !video.paused;
    if (wasPlaying) {
      video.pause();
    }
    
    // Set playbackRate
    video.playbackRate = rate;
    
    // Resume playback if it was playing
    if (wasPlaying) {
      video.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error resuming video after playbackRate change:', err);
        }
      });
    }
  };

  // Apply playback rate to all videos when playbackRate changes
  useEffect(() => {
    // Apply to main video player
    if (mainVideoPlayerRef.current) {
      setVideoPlaybackRate(mainVideoPlayerRef.current, playbackRate);
    }
    
    // Apply to all canvas video elements
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video && video.playbackRate !== playbackRate) {
          setVideoPlaybackRate(video, playbackRate);
        }
      }
    });
  }, [playbackRate]); // Only depend on playbackRate to avoid frequent updates
  
  // Apply playback rate to new videos when they're added (with a small delay to ensure DOM is ready)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
          if (video && video.playbackRate !== playbackRate) {
            setVideoPlaybackRate(video, playbackRate);
          }
        }
      });
    }, 100); // Small delay to ensure video element is in DOM
    
    return () => clearTimeout(timeoutId);
  }, [canvasElements, playbackRate]); // Run when canvasElements change (new videos added)

  // Toggle mute for all videos (global) - only affects videos that aren't individually muted
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (mainVideoPlayerRef.current) {
      mainVideoPlayerRef.current.muted = !isMuted;
    }
    
    // Update all canvas video elements - respect individual mute state
    // If a video is individually muted, keep it muted. Otherwise, apply global mute.
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video) {
          // If video is individually muted, keep it muted. Otherwise, apply global mute state.
          const isIndividuallyMuted = element.muted ?? false;
          video.muted = isIndividuallyMuted || isMuted;
        }
      }
    });
  };

  // Toggle mute for a specific video element
  const toggleVideoMute = (elementId: string) => {
    const element = canvasElements.find(el => el.id === elementId);
    if (element && element.type === "video") {
      const newMutedState = !(element.muted ?? false);
      updateCanvasElement(elementId, { muted: newMutedState });
      
      // Update the actual video element - respect both individual and global mute
      const video = document.querySelector(`#canvas-video-${elementId}`) as HTMLVideoElement;
      if (video) {
        // If globally muted, keep it muted. Otherwise, use individual mute state.
        video.muted = isMuted || newMutedState;
      }
    }
  };

  // Update duration when media loads - calculate based on longest element (video, audio, or image)
  // Timeline should always match the longest element and shrink/expand dynamically
  // Calculate timeline duration based on longest element + 20% padding
  useEffect(() => {
    if (isTrimming) {
      // Don't recalculate during trimming to avoid jumps
      return;
    }

    if (canvasElements.length === 0) {
      // Default to 10 seconds if no elements
      setDuration(10000);
      return;
    }

    // Find the longest element (considering startTime + duration)
    let maxEndTime = 0;
    canvasElements.forEach(element => {
      const startTime = element.startTime || 0;
      const elementDuration = element.duration || 5000; // Default 5s if not set
      const endTime = startTime + elementDuration;
      maxEndTime = Math.max(maxEndTime, endTime);
    });

    // Add 20% padding
    const calculatedDuration = Math.max(10000, maxEndTime * 1.2); // Minimum 10 seconds
    
    // Only update if the calculated duration is significantly different (avoid constant updates)
    if (Math.abs(duration - calculatedDuration) > 1000) {
      setDuration(calculatedDuration);
    }
  }, [canvasElements, isTrimming, duration]); // Recalculate when elements change

  // Update individual video element durations when their metadata loads
  // Only update if element doesn't already have a duration set (to preserve trimmed durations)
  useEffect(() => {
    const cleanupFunctions: Array<() => void> = [];
    
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video) {
          const updateElementDuration = () => {
            if (video.duration && video.duration > 0) {
              const actualDuration = video.duration * 1000; // Convert to milliseconds
              // Store original duration for hard stop enforcement
              originalMediaDurationsRef.current.set(element.id, actualDuration);
              console.log(`[Video Duration] Stored original duration for ${element.id}: ${actualDuration}ms`);
              // Only update if element doesn't have a duration set yet (initial load)
              // Don't override if duration is already set (preserves trimmed durations)
              if (!element.duration || element.duration === 0) {
                updateCanvasElement(element.id, { duration: actualDuration });
              }
            }
          };
          
          if (video.duration && video.duration > 0) {
            updateElementDuration();
          } else {
            video.addEventListener('loadedmetadata', updateElementDuration);
            cleanupFunctions.push(() => video.removeEventListener('loadedmetadata', updateElementDuration));
          }
          
          // Sync muted state - respect individual mute state, but also apply global mute if active
          const isIndividuallyMuted = element.muted ?? false;
          video.muted = isIndividuallyMuted || isMuted;
        }
      }
      
      // Update individual audio element durations when their metadata loads
      // Only update if element doesn't already have a duration set (to preserve trimmed durations)
      if (element.type === "audio" && element.url) {
        // Use a small timeout to ensure audio element is in DOM
        const timeoutId = setTimeout(() => {
          const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
          if (audio) {
            const updateElementDuration = () => {
              if (audio.duration && audio.duration > 0) {
                const actualDuration = audio.duration * 1000; // Convert to milliseconds
                // Store original duration for hard stop enforcement
                originalMediaDurationsRef.current.set(element.id, actualDuration);
                console.log(`[Audio Duration] Stored original duration for ${element.id}: ${actualDuration}ms`);
                console.log(`[Audio Duration] Updating audio ${element.id}: ${element.duration}ms -> ${actualDuration}ms`);
                // Update if duration is not set, is 0, or is still the default 5000ms placeholder
                // This ensures we update from the default placeholder to the actual duration
                // Don't override if duration is already set to a non-default value (preserves trimmed durations)
                if (!element.duration || element.duration === 0 || element.duration === 5000) {
                  updateCanvasElement(element.id, { duration: actualDuration });
                }
              }
            };
            
            if (audio.duration && audio.duration > 0) {
              updateElementDuration();
            } else {
              // If metadata not loaded yet, wait for it
              const handleLoadedMetadata = () => {
                updateElementDuration();
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
              };
              audio.addEventListener('loadedmetadata', handleLoadedMetadata);
              cleanupFunctions.push(() => audio.removeEventListener('loadedmetadata', handleLoadedMetadata));
            }
            
            // Sync muted state
            audio.muted = element.muted || false;
          }
        }, 100); // Small delay to ensure audio element is in DOM
        
        cleanupFunctions.push(() => clearTimeout(timeoutId));
      }
    });
    
    // Return cleanup function for all listeners and timeouts
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [canvasElements, isMuted]);

  // Sync video playback with timeline - sync time only when starting playback or when new videos are added
  useEffect(() => {
    const hasCanvasVideos = canvasElements.some(el => el.type === "video" && el.url);
    const wasPlaying = lastPlayingStateRef.current;
    const justStartedPlaying = isPlaying && !wasPlaying;

    // Echo guard: every tick, sweep the DOM for orphan <video> tags that no
    // longer correspond to a current canvasElement (e.g. React left one
    // behind after a magicLayoutSegments branch swap). Hard-mute them so
    // their audio can't linger as a delayed copy of the main track.
    {
      const liveIds = new Set<string>(
        canvasElements.filter(el => el.type === "video" && el.url).map(el => el.id)
      );
      const allCanvasVideos = document.querySelectorAll<HTMLVideoElement>(
        'video[id^="canvas-video-"]'
      );
      allCanvasVideos.forEach((node) => {
        const id = node.id.replace(/^canvas-video-/, "");
        if (!liveIds.has(id)) {
          try {
            node.pause();
            node.muted = true;
          } catch (_) {
            /* noop */
          }
        }
      });
    }

    if (isPlaying) {
      // Start playing all canvas videos
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = getActiveCanvasVideo(element.id);
          if (video) {
            const elementStartTime = element.startTime || 0;
            const elementDuration = element.duration || (video.duration * 1000 || 5000);
            const elementEndTime = elementStartTime + elementDuration;
            
            // Only play video if timeline is within its startTime range
            // Use tolerance for smooth transitions between sequential videos
            const tolerance = 50; // 50ms tolerance
            const isInRange = currentTime >= (elementStartTime - tolerance) && currentTime < (elementEndTime + tolerance);
            
            if (isInRange) {
              // Calculate video's internal time based on timeline position and videoStartOffset
              const videoStartOffset = element.videoStartOffset || 0;
              const videoTime = (videoStartOffset + (currentTime - elementStartTime)) / 1000;
              
              // Ensure video has loaded metadata
              if (video.readyState >= 2) {
                // Calculate trimmed start and end times
                const trimmedStartTime = videoStartOffset / 1000;
                const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                // Clamp video time to trimmed range
                const clampedVideoTime = Math.max(
                  trimmedStartTime,
                  Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
                );
                
                const driftTol = element.bRollOverlay
                  ? BROLL_VIDEO_SYNC_DRIFT_SEC
                  : VIDEO_SYNC_DRIFT_SEC;
                // Sync time when just starting playback or if video is paused (newly added)
                if (
                  justStartedPlaying ||
                  video.paused ||
                  Math.abs(video.currentTime - clampedVideoTime) > driftTol
                ) {
                  video.currentTime = clampedVideoTime;
                }
                
                // Check if video has reached trimmed end - only pause if we're past the end (with tolerance)
                if (currentTime >= elementEndTime + tolerance) {
                  video.pause();
                } else if (video.currentTime >= trimmedEndTime - 0.1) {
                  // Video reached its trimmed end, pause it
                  video.pause();
                } else if (video.paused) {
                  video.play().catch((err) => {
                    // Ignore AbortError - it's expected when play() is interrupted by pause()
                    if (err.name !== 'AbortError') {
                      console.error('Error playing trimmed video:', err);
                    }
                  });
                }
              } else {
                // Wait for video to load
                const handleLoadedData = () => {
                  const trimmedStartTime = videoStartOffset / 1000;
                  const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                  const clampedVideoTime = Math.max(
                    trimmedStartTime,
                    Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
                  );
                  video.currentTime = clampedVideoTime;
                  if (video.paused && currentTime < elementEndTime) {
                    video.play().catch((err) => {
                      // Ignore AbortError - it's expected when play() is interrupted by pause()
                      if (err.name !== 'AbortError') {
                        console.error('Error playing video:', err);
                      }
                    });
                  }
                  video.removeEventListener('loadeddata', handleLoadedData);
                };
                video.addEventListener('loadeddata', handleLoadedData);
              }
            } else {
              // Timeline is outside video's range - pause it
              if (!video.paused) {
                video.pause();
              }
              // If timeline is before startTime, reset to trimmed start; if after, set to trimmed end
              if (currentTime < elementStartTime) {
                const videoStartOffset = element.videoStartOffset || 0;
                video.currentTime = videoStartOffset / 1000; // Set to trimmed start
              } else if (currentTime >= elementEndTime && video.duration) {
                const videoStartOffset = element.videoStartOffset || 0;
                const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                video.currentTime = Math.min(trimmedEndTime, video.duration);
              }
            }
          }
        }
      });
      
      // Only play main video player if there are NO canvas videos (to avoid echo)
      if (mainVideoPlayerRef.current && !hasCanvasVideos) {
        if (justStartedPlaying) {
          mainVideoPlayerRef.current.currentTime = currentTime / 1000;
        }
        if (mainVideoPlayerRef.current.paused) {
          mainVideoPlayerRef.current.play().catch(console.error);
        }
      } else if (mainVideoPlayerRef.current && hasCanvasVideos) {
        // If canvas videos exist, pause and mute the main player to prevent echo
        mainVideoPlayerRef.current.pause();
        mainVideoPlayerRef.current.muted = true;
      }
    } else {
      // Pause all videos
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
          if (video && !video.paused) {
            video.pause();
          }
        }
        
        // Pause all audio elements
        if (element.type === "audio" && element.url) {
          const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
          if (audio && !audio.paused) {
            audio.pause();
          }
        }
      });
      
      if (mainVideoPlayerRef.current && !mainVideoPlayerRef.current.paused) {
        mainVideoPlayerRef.current.pause();
      }
    }
    
    // Update ref to track playing state
    lastPlayingStateRef.current = isPlaying;
  }, [isPlaying, canvasElements]);

  // Watch currentTime and start/pause videos as timeline moves
  useEffect(() => {
    if (!isPlaying) return; // Only handle when playing
    
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = getActiveCanvasVideo(element.id);
        if (!video) return;
        
        const elementStartTime = element.startTime || 0;
        const elementDuration = element.duration || (video.duration * 1000 || 5000);
        const elementEndTime = elementStartTime + elementDuration;
        
        // Check if timeline is within video's time range
        // Use a small tolerance (50ms) to ensure smooth transitions between sequential videos
        const tolerance = 50; // 50ms tolerance for smooth transitions
        const isInRange = currentTime >= (elementStartTime - tolerance) && currentTime < (elementEndTime + tolerance);
        
        if (isInRange) {
          // Calculate video's internal time based on timeline position and videoStartOffset
          const videoStartOffset = element.videoStartOffset || 0;
          const videoTime = (videoStartOffset + (currentTime - elementStartTime)) / 1000;
          
          // Ensure video has loaded metadata before setting time
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            // Calculate trimmed end time
            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
            const clampedVideoTime = Math.max(
              videoStartOffset / 1000, 
              Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
            );
            
            const driftTol = element.bRollOverlay
              ? BROLL_VIDEO_SYNC_DRIFT_SEC
              : VIDEO_SYNC_DRIFT_SEC;
            // Sync only on meaningful drift — micro-seeks every frame cause visible jerk
            if (Math.abs(video.currentTime - clampedVideoTime) > driftTol) {
              video.currentTime = clampedVideoTime;
            }
            
            // Check if video has reached trimmed end - only pause if we're past the end (with tolerance)
            if (currentTime >= elementEndTime + tolerance) {
              video.pause();
            } else if (video.currentTime >= trimmedEndTime - 0.1) {
              // Video reached its trimmed end, pause it
              video.pause();
            } else if (video.paused) {
              // Start playing if paused and not at end
              video.play().catch((err) => {
                // Ignore AbortError - it's expected when play() is interrupted by pause()
                if (err.name !== 'AbortError') {
                  console.error('Error playing trimmed video:', err);
                }
              });
            }
          } else {
            // Wait for video to load, then set time
            const handleLoadedData = () => {
              const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
              const clampedVideoTime = Math.max(
                videoStartOffset / 1000,
                Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
              );
              video.currentTime = clampedVideoTime;
              if (video.paused && currentTime < elementEndTime) {
                video.play().catch((err) => {
                  // Ignore AbortError - it's expected when play() is interrupted by pause()
                  if (err.name !== 'AbortError') {
                    console.error('Error playing video:', err);
                  }
                });
              }
              video.removeEventListener('loadeddata', handleLoadedData);
            };
            video.addEventListener('loadeddata', handleLoadedData);
          }
        } else {
          // Timeline is outside video's range - pause it
          if (!video.paused) {
            video.pause();
          }
          // Reset video time appropriately
          if (currentTime < elementStartTime) {
            const videoStartOffset = element.videoStartOffset || 0;
            video.currentTime = videoStartOffset / 1000; // Set to trimmed start
          } else if (currentTime >= elementEndTime && video.duration) {
            const videoStartOffset = element.videoStartOffset || 0;
            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
            video.currentTime = Math.min(trimmedEndTime, video.duration);
          }
        }
      }
      
      // Handle audio elements
      if (element.type === "audio" && element.url) {
        const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
        if (!audio) return;
        
        const elementStartTime = element.startTime || 0;
        const elementDuration = element.duration || (audio.duration * 1000 || 5000);
        const elementEndTime = elementStartTime + elementDuration;
        const audioStartOffset = element.audioStartOffset || 0;
        
        // Check if timeline is within audio's time range
        const tolerance = 50; // 50ms tolerance for smooth transitions
        const isInRange = currentTime >= (elementStartTime - tolerance) && currentTime < (elementEndTime + tolerance);
        
        if (isInRange) {
          // Calculate audio's internal time based on timeline position and audioStartOffset
          const audioTime = (audioStartOffset + (currentTime - elementStartTime)) / 1000;
          
          // Ensure audio has loaded metadata before setting time
          if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            const clampedAudioTime = Math.max(0, Math.min(audioTime, audio.duration || Infinity));
            
            // Sync audio time if it's significantly different
            if (Math.abs(audio.currentTime - clampedAudioTime) > 0.1) {
              audio.currentTime = clampedAudioTime;
            }
            
            // Check if audio has reached end - only pause if we're past the end (with tolerance)
            if (currentTime >= elementEndTime + tolerance) {
              audio.pause();
            } else if (audio.currentTime >= ((audioStartOffset + elementDuration) / 1000) - 0.1) {
              // Audio reached its end (audioStartOffset + duration), pause it
              audio.pause();
            } else if (audio.paused) {
              // Start playing if paused and not at end
              audio.play().catch((err) => {
                // Ignore AbortError - it's expected when play() is interrupted by pause()
                if (err.name !== 'AbortError') {
                  console.error('Error playing audio:', err);
                }
              });
            }
          } else {
            // Wait for audio to load, then set time
            const handleLoadedData = () => {
              const clampedAudioTime = Math.max(0, Math.min(audioTime, audio.duration || Infinity));
              audio.currentTime = clampedAudioTime;
              if (audio.paused && currentTime < elementEndTime) {
                audio.play().catch((err) => {
                  // Ignore AbortError - it's expected when play() is interrupted by pause()
                  if (err.name !== 'AbortError') {
                    console.error('Error playing audio:', err);
                  }
                });
              }
              audio.removeEventListener('loadeddata', handleLoadedData);
            };
            audio.addEventListener('loadeddata', handleLoadedData);
          }
        } else {
          // Timeline is outside audio's range - pause it
          if (!audio.paused) {
            audio.pause();
          }
          // Reset audio time appropriately
          if (currentTime < elementStartTime) {
            audio.currentTime = audioStartOffset / 1000; // Set to audio start offset
          } else if (currentTime >= elementEndTime && audio.duration) {
            audio.currentTime = Math.min((audioStartOffset + elementDuration) / 1000, audio.duration);
          }
        }
      }
    });
  }, [currentTime, isPlaying, canvasElements]);

  // Get the end time of the last element (video or image) in the timeline
  const getLastElementEndTime = useCallback((): number => {
    if (canvasElements.length === 0) {
      return 0;
    }
    // Calculate the maximum end time (startTime + duration) among all elements
    const endTimes = canvasElements.map(el => {
      const startTime = el.startTime || 0;
      const duration = el.duration || 5000;
      return startTime + duration;
    });
    return Math.max(...endTimes);
  }, [canvasElements]);


  // Continuously advance timeline when playing (ensures smooth transitions between videos)
  useEffect(() => {
    if (!isPlaying) return;
    
    let animationFrameId: number;
    let lastTime = Date.now();
    
    const advanceTimeline = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;
      
      // Get the end time of the last element
      const lastElementEndTime = getLastElementEndTime();
      
      // Advance timeline by the elapsed time, accounting for playback rate
      setCurrentTime(prevTime => {
        const newTime = prevTime + (delta * playbackRate);
        // Don't go past the end of the last element
        const maxTime = lastElementEndTime > 0 ? lastElementEndTime : (duration || Infinity);
        if (newTime >= maxTime) {
          // Stop playback when we reach the end
          setIsPlaying(false);
          return maxTime;
        }
        return newTime;
      });
      
      animationFrameId = requestAnimationFrame(advanceTimeline);
    };
    
    animationFrameId = requestAnimationFrame(advanceTimeline);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, duration, getLastElementEndTime, playbackRate]);

  // Check for timeline end (not individual video end - videos can be sequential)
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      // Get the end time of the last element
      const lastElementEndTime = getLastElementEndTime();
      
      // Only stop playback if we've reached the end of the last element
      // Don't stop when individual videos end - they should transition to the next video
      if (lastElementEndTime > 0 && currentTime >= lastElementEndTime - 50) {
        // We've reached the end of the last element
        setIsPlaying(false);
        // Don't reset to 0, keep at the end
        // Reset all videos to their start positions
        canvasElements.forEach(el => {
          if (el.type === "video" && el.url) {
            const vid = document.querySelector(`#canvas-video-${el.id}`) as HTMLVideoElement;
            if (vid) {
              const videoStartOffset = el.videoStartOffset || 0;
              vid.currentTime = videoStartOffset / 1000; // Reset to trimmed start
              vid.pause();
            }
          }
        });
        if (mainVideoPlayerRef.current) {
          mainVideoPlayerRef.current.currentTime = 0;
        }
      }
    }, 200); // Check every 200ms for timeline end
    
    return () => clearInterval(interval);
  }, [isPlaying, canvasElements, currentTime, duration]);

  // Keyboard event listeners for delete (Backspace/Delete keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if an element is selected and not typing in an input/textarea
      if (selectedElementId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          // Delete the selected element
          setCanvasElements(elements => {
            const filtered = elements.filter(el => el.id !== selectedElementId);
            return filtered;
          });
          setSelectedElementId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElementId]);

  // Load saved characters when the avatar dialog OR the Magic Create wizard opens.
  useEffect(() => {
    if (!avatarsDialogOpen && !magicCreateOpen) return;
    let cancelled = false;
    listCharacters()
      .then(({ characters }) => {
        if (cancelled) return;
        const list: Avatar[] = (characters || [])
          .map((c: Record<string, unknown>) => {
            const videoUrl = (c.animationVideoUrl as string) || (c.selectedAvatarUrl as string) || "";
            const url = !videoUrl ? "" : videoUrl.startsWith("http") ? videoUrl : `${config.remotionServerUrl}${videoUrl}`;
            return {
              id: (c._id as string) || `char-${c.createdAt}`,
              name: (c.characterName as string) || "My avatar",
              url,
              presetVoiceName: (c.presetVoiceName as string) ?? null,
            };
          })
          .filter((a: Avatar) => a.url);
        setSavedAvatars(list);
      })
      .catch((err) => {
        if (!cancelled) console.warn("[Avatars] Failed to load saved characters:", err);
      });
    return () => { cancelled = true; };
  }, [avatarsDialogOpen, magicCreateOpen]);

  const defaultAvatars: Avatar[] = [
    { id: "avatar_1", name: "Avatar 1", url: `${config.remotionServerUrl}/avatars/Avatar_1.mp4` },
    { id: "avatar_2", name: "Avatar 2", url: `${config.remotionServerUrl}/avatars/Avatar_2.mp4` },
    { id: "avatar_3", name: "Avatar 3", url: `${config.remotionServerUrl}/avatars/Avatar_3.mp4` },
    { id: "avatar_4", name: "Avatar 4", url: `${config.remotionServerUrl}/avatars/Avatar_4.mp4` },
    { id: "avatar_5", name: "Avatar 5", url: `${config.remotionServerUrl}/avatars/Avatar_5.mp4` },
    { id: "avatar_6", name: "Avatar 6", url: `${config.remotionServerUrl}/avatars/Avatar_6.mp4` },
    { id: "avatar_7", name: "Avatar 7", url: `${config.remotionServerUrl}/avatars/Avatar_7.mp4` },
  ];
  const avatars: Avatar[] = [...savedAvatars, ...defaultAvatars];

  // Handle avatar selection
  const handleAvatarSelect = (avatar: Avatar) => {
    setSelectedAvatar(avatar);
    // Don't close dialog immediately - wait for Next button
  };

  // Handle Next button - go to speech generation screen
  const AVATAR_NEXT_TIMEOUT_MS = 20000; // 20s so we don't stay stuck on "Creating…"
  const handleNextToSpeechGeneration = async () => {
    if (!selectedAvatar) return;
    setAvatarNextError(null);
    setCreatingProjectFromAvatar(true);
      try {
      const createAndUpdate = async () => {
        const project = await createUGCProject(
          `UGC Video - ${new Date().toLocaleDateString()}`,
          `Avatar: ${selectedAvatar.name}`
        );
        if (!project?.id) {
          throw new Error("Project was not created");
        }
        console.log('[Project] Created project:', project.id, project.title);
        const updatedProject = await updateUGCProject(project.id, {
          avatar_id: selectedAvatar.id,
          avatar_url: selectedAvatar.url,
        });
        if (!updatedProject) {
          throw new Error("Failed to update project with avatar");
        }
        return updatedProject;
      };
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), AVATAR_NEXT_TIMEOUT_MS);
      });
      const updatedProject = await Promise.race([createAndUpdate(), timeoutPromise]);

      setCurrentProject(updatedProject);
      setProjectTitle(updatedProject.title || updatedProject.id);
      console.log('[Project] Project set in state:', updatedProject.id);
        
        setAvatarsDialogOpen(false);
        setShowSpeechGeneration(true);
        setCurrentStep("speech");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      console.error("[Avatar] Next error:", error);
      setAvatarNextError(message);
      alert(`Failed to continue: ${message}. Please try again or refresh the page.`);
    } finally {
      setCreatingProjectFromAvatar(false);
    }
  };

  // Handle speech generation
  const handleGenerateSpeech = async () => {
    if (!selectedVoice || !speechText || !selectedAvatar) {
      alert("Please select a voice and enter your script");
      return;
    }

    if (speechText.trim().length === 0) {
      alert("Please enter some text for the script");
      return;
    }

    // Check credits before generating
    if (userCredits !== null && !hasEnoughCredits) {
      alert(`Insufficient credits! You need ${calculateEstimatedCredits.toFixed(2)} credits but only have ${userCredits.toFixed(2)}.`);
      return;
    }

    setGeneratingSpeech(true);
    try {
      console.log("Generating speech with voice:", selectedVoice, "text length:", speechText.length);
      
      // Get cached token for long-running speech generation operation
      // This prevents token expiration issues during processing
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      const cachedToken = await getCachedToken();
      
      const headers: HeadersInit = {
          'Content-Type': 'application/json',
      };
      
      // Add authorization header if user is authenticated
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }
      
      // Call API to generate speech using ElevenLabs with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      let response;
      try {
        response = await fetch(`${config.remotionServerUrl}/voices/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          voice_id: selectedVoice,
          text: speechText,
          speed: speechSpeed,
          model_id: selectedModel === "alpha3" ? "eleven_v3" : "eleven_flash_v2_5",
        }),
          signal: controller.signal
      });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - speech generation took too long. Please try again.');
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      let data;
      try {
        const responseText = await response.text();
        console.log("[Speech Generation] Raw response text length:", responseText.length);
        console.log("[Speech Generation] Raw response preview:", responseText.substring(0, 200));
        
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error("[Speech Generation] ❌ Failed to parse JSON response:", parseError);
        throw new Error(`Invalid response from server: ${parseError?.message || 'Failed to parse response'}`);
      }
      
      console.log("[Speech Generation] API Response:", {
        success: data.success,
        hasAudio: !!data.audio,
        audioLength: data.audio?.length,
        audioType: typeof data.audio,
        voice_id: data.voice_id,
        credits_deducted: data.credits_deducted,
        model_used: data.model_used,
        error: data.error,
        message: data.message,
        fullResponseKeys: Object.keys(data)
      });
      
      // Update credits after successful generation
      if (data.credits_deducted !== undefined && user?.id) {
        try {
          const result = await subscriptionApi.getSubscriptionInfo();
          setUserCredits(result.subscription.credits || 0);
          console.log("[Speech Generation] Credits updated:", result.subscription.credits);
        } catch (error) {
          console.error("Error updating credits:", error);
        }
      }
      
      // Handle response - check for success flag OR just audio presence (for backward compatibility)
      // Also check if audio is a string (base64 data URL) or object
      const hasAudio = data.audio && (typeof data.audio === 'string' || typeof data.audio === 'object');
      const isSuccess = data.success !== false && !data.error;
      
      console.log("[Speech Generation] Response validation:", {
        isSuccess,
        hasAudio,
        successFlag: data.success,
        hasError: !!data.error,
        willProceed: isSuccess && hasAudio
      });
      
      if (isSuccess && hasAudio) {
        // Store the generated speech URL and voice ID
        console.log("[Speech Generation] Setting generated speech URL...");
        setGeneratedSpeechUrl(data.audio);
        setGeneratedSpeechVoiceId(selectedVoice);
        
        console.log("[Speech Generation] ✅ Speech generated successfully:", {
          voice_id: data.voice_id,
          text_length: data.text_length,
          audio_size: data.audio_size,
          audioUrlLength: data.audio?.length,
          audioPreview: data.audio?.substring(0, 50) + "..."
        });
        
        // Move to lip sync step first (so user can see the audio is ready)
        setCurrentStep("lipsync");
        setGeneratingSpeech(false); // Reset loading state immediately after speech is generated
        
        // Save voice generation to database (non-blocking but with error reporting)
        if (currentProject) {
          // Run database save in background without blocking UI
          (async () => {
          try {
            console.log("Saving voice generation to database...", {
              projectId: currentProject.id,
              voiceId: selectedVoice,
              scriptLength: speechText.length
            });
            
            // Convert base64 to blob and upload to storage
            console.log("Converting base64 to blob...");
            const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
            console.log("Audio blob size:", (audioBlob.size / 1024).toFixed(2), "KB");
            
            const audioFileName = `voice-${uuid()}.mp3`;
            console.log("Uploading audio to Supabase Storage...");
            const audioStorageUrl = await uploadAudioToStorage(
              audioBlob,
              currentProject.id,
              audioFileName
            );
            
            if (!audioStorageUrl) {
              throw new Error("Failed to upload audio to storage");
            }
            
            console.log("Audio uploaded to storage:", audioStorageUrl);
              
              // Save to user_uploads table so it appears in "My Audio" using REST API
              const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
              let token = await getCachedToken();
              
              if (token) {
                try {
                  // Extract userId from token
                  const payload = JSON.parse(atob(token.split('.')[1]));
                  const userId = payload.sub || payload.user_id;
                  
                  if (userId) {
                    const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
                    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                    
                    if (supabaseUrl && supabaseAnonKey) {
                const storagePath = `ugc-audio/${currentProject.id}/${audioFileName}`;
                      const insertUrl = `${supabaseUrl}/rest/v1/user_uploads`;
                      
                      const makeRequest = async (authToken: string) => {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);
                        try {
                          const response = await fetch(insertUrl, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${authToken}`,
                              'apikey': supabaseAnonKey,
                              'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({
                              user_id: userId,
                  file_name: audioFileName,
                  file_type: 'audio',
                  storage_path: storagePath,
                  storage_url: audioStorageUrl,
                  file_size: audioBlob.size,
                  mime_type: 'audio/mpeg',
                  metadata: {
                    voice_id: selectedVoice,
                    voice_name: getVoiceName(selectedVoice) || null,
                    generated_with: 'elevenlabs'
                  }
                            }),
                            signal: controller.signal
                          });
                          clearTimeout(timeoutId);
                          return response;
                        } catch (err) {
                          clearTimeout(timeoutId);
                          throw err;
                        }
                      };
                      
                      let response = await makeRequest(token);
                      
                      // Handle 401 - refresh token and retry
                      if (response.status === 401) {
                        const refreshedToken = await refreshToken();
                        if (refreshedToken) {
                          response = await makeRequest(refreshedToken);
                        }
                      }
                      
                      if (response.ok) {
                console.log("Audio saved to user_uploads table");
                      } else {
                        console.warn('[Speech Generation] Failed to save audio metadata:', response.status);
                      }
                    }
                  }
                } catch (error) {
                  console.warn('[Speech Generation] Error saving audio metadata:', error);
                  // Continue even if metadata save fails
                }
              }
            
            // Get voice name from the list
            const voiceName = getVoiceName(selectedVoice) || null;
            
            // Calculate duration (rough estimate from audio size or use API response)
            const durationSeconds = data.duration_seconds || null;
            
            // Save to database
            console.log("Saving voice generation to database...");
            const voiceGen = await saveVoiceGeneration(
              currentProject.id,
              selectedVoice,
              voiceName,
              speechText,
              audioStorageUrl, // Use storage URL instead of base64
              `ugc-audio/${currentProject.id}/${audioFileName}`,
              durationSeconds
            );
            
            setVoiceGenerationId(voiceGen.id);
            console.log("✅ Voice generation saved to database:", voiceGen.id);
          } catch (error: any) {
            console.error("❌ Error saving voice generation:", error);
            console.error("Error details:", {
              message: error.message,
              stack: error.stack,
              projectId: currentProject?.id
            });
              // Show alert so user knows there was an issue
            alert(`Voice generated successfully, but failed to save to database: ${error.message}\n\nCheck console for details.`);
          }
          })();
        } else {
          console.warn("Cannot save voice generation - no current project");
          alert("Warning: No project found. Voice generation will not be saved to database.");
        }
      } else {
        console.error("[Speech Generation] ❌ Failed to generate speech:", {
          success: data.success,
          hasAudio: !!data.audio,
          hasError: !!data.error,
          error: data.error,
          message: data.message,
          fullResponse: data,
          responseKeys: Object.keys(data)
        });
        
        // More detailed error message
        const errorMessage = data.error || data.message || data.details?.message || 'Unknown error';
        alert(`Failed to generate speech: ${errorMessage}\n\nPlease check the console for more details.`);
      }
    } catch (error: any) {
      console.error("[Speech Generation] ❌ Error generating speech:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        response: error.response
      });
      alert(`Error generating speech: ${error.message || 'Network error'}`);
    } finally {
      setGeneratingSpeech(false);
    }
  };

  // Fetch ElevenLabs voices and user saved voices when speech generation screen opens
  const fetchUserSavedVoices = useCallback(async () => {
    if (!user?.id) return;
    setLoadingUserVoices(true);
    try {
      const { data, error } = await supabase
        .from("user_saved_voices")
        .select("id, name, eleven_labs_voice_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setUserSavedVoices(data ?? []);
    } catch (e) {
      console.error("Failed to fetch user saved voices:", e);
      setUserSavedVoices([]);
    } finally {
      setLoadingUserVoices(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!showSpeechGeneration && !magicCreateOpen) return;
    if (elevenLabsVoices.length === 0 && !loadingVoices) fetchElevenLabsVoices();
    fetchUserSavedVoices();
    checkApiKey("elevenlabs").then((r) => setHasElevenLabsKey(r.hasKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSpeechGeneration, magicCreateOpen]);

  // Handle lip sync generation
  const handleGenerateLipSync = useCallback(async (e?: React.MouseEvent) => {
    // Prevent event propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Prevent multiple simultaneous calls - check state directly
    if (generatingLipSync) {
      console.log("[Lip Sync] Already generating, ignoring click");
      return;
    }

    // Double-check with a ref to prevent race conditions
    const isCurrentlyGenerating = generatingLipSync;
    if (isCurrentlyGenerating) {
      console.log("[Lip Sync] Race condition detected - already generating");
      return;
    }

    if (!generatedSpeechUrl || !selectedAvatar) {
      console.error("[Lip Sync] Missing requirements:", {
        hasSpeech: !!generatedSpeechUrl,
        hasAvatar: !!selectedAvatar
      });
      alert("Please generate speech first and select an avatar");
      return;
    }

    console.log("[Lip Sync] Starting generation...", {
      hasSpeech: !!generatedSpeechUrl,
      hasAvatar: !!selectedAvatar,
      avatarUrl: selectedAvatar.url,
      speechUrlLength: generatedSpeechUrl.length
    });

    // Set state and ref immediately to prevent double-clicks
    generatingLipSyncRef.current = true;
    setGeneratingLipSync(true);
    setLipSyncStatus('Initializing lip sync generation...');
    setLipSyncProgress(5);

    // Saved avatars (UUID id): send avatarCharacterId so server fetches video server-side and never receives Supabase URL
    const isSavedAvatar = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAvatar.id);

    try {
      console.log("[Lip Sync] Preparing API call...", {
        audio: generatedSpeechUrl.substring(0, 50) + "...",
        isSavedAvatar,
        ...(isSavedAvatar ? { avatarCharacterId: selectedAvatar.id } : { video: selectedAvatar.url }),
        serverUrl: config.remotionServerUrl
      });

      // Get auth token from Supabase
      // Get cached token for long-running lip sync operation
      // This prevents token expiration issues during processing
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      let cachedToken: string | null = null;
      try {
        cachedToken = await getCachedToken();
        console.log("[Lip Sync] Cached token retrieved:", { hasToken: !!cachedToken });
      } catch (tokenError) {
        console.error("[Lip Sync] Error getting cached token:", tokenError);
        // Continue without auth if token retrieval fails
      }

      const headers: HeadersInit = {
          'Content-Type': 'application/json',
      };
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }

      const requestBody: Record<string, unknown> = {
          audio: generatedSpeechUrl, // Base64 data URL
          seed: 0,
          guidance_scale: 1
      };
      if (isSavedAvatar) {
        requestBody.avatarCharacterId = selectedAvatar.id;
      } else {
        requestBody.video = selectedAvatar.url;
      }

      console.log("[Lip Sync] Making API call to:", `${config.remotionServerUrl}/lipsync/generate`);
      console.log("[Lip Sync] Request body:", {
        audioLength: typeof requestBody.audio === 'string' ? requestBody.audio.length : 0,
        ...(isSavedAvatar ? { avatarCharacterId: requestBody.avatarCharacterId } : { video: requestBody.video }),
        hasHeaders: !!headers['Authorization']
      });

      // Ensure we're still in generating state before making the call
      if (!generatingLipSyncRef.current) {
        console.warn("[Lip Sync] Generation was cancelled before API call");
        return;
      }

      // Call API to generate lip sync using Replicate
      console.log("[Lip Sync] Fetch call starting...");
      const fetchStartTime = Date.now();
      const response = await fetch(`${config.remotionServerUrl}/lipsync/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      const fetchDuration = Date.now() - fetchStartTime;
      
      console.log("[Lip Sync] API response received:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration: `${fetchDuration}ms`
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[Lip Sync] API response:", { success: data.success, status: data.status, hasVideoUrl: !!data.video_url });
      
      if (data.success && data.video_url) {
        const videoUrl = data.video_url;
        setLipSyncVideoUrl(videoUrl);
        setLipSyncStatus('Lip sync completed!');
        setLipSyncProgress(100);
        console.log("Lip sync generated successfully:", videoUrl);
        generatingLipSyncRef.current = false;
        setGeneratingLipSync(false);
        
        // Save generated video to database and storage
        if (currentProject && videoUrl) {
          (async () => {
            try {
              console.log("[Lip Sync] Saving generated video to database (immediate)...", {
                projectId: currentProject.id,
                videoUrl: videoUrl.substring(0, 80) + "...",
                voiceGenerationId,
                isSupabaseUrl: videoUrl.includes('supabase.co/storage')
              });
              
              let videoStorageUrl = videoUrl;
              let videoStoragePath: string | null = null;
              let durationSeconds: number | null = null;
              
              // Check if video is already in Supabase Storage (from backend)
              if (videoUrl.includes('supabase.co/storage')) {
                console.log("[Lip Sync] Video is already in Supabase Storage, skipping download/re-upload");
                
                // Extract storage path from Supabase URL
                const urlMatch = videoUrl.match(/\/storage\/v1\/object\/public\/videos\/(.+)$/);
                if (urlMatch) {
                  videoStoragePath = urlMatch[1];
                  console.log("[Lip Sync] Extracted storage path:", videoStoragePath);
                }
                
                // Get video duration from the Supabase URL
                try {
                  const video = document.createElement('video');
                  video.preload = 'metadata';
                  video.crossOrigin = 'anonymous';
                  video.src = videoUrl;
                  await new Promise((resolve, reject) => {
                    video.onloadedmetadata = () => {
                      durationSeconds = video.duration;
                      resolve(null);
                    };
                    video.onerror = reject;
                    setTimeout(() => {
                      resolve(null); // Resolve anyway if metadata doesn't load
                    }, 5000); // Increased timeout for large videos
                  });
                  console.log("[Lip Sync] Video duration:", durationSeconds, "seconds");
                } catch (e) {
                  console.warn("[Lip Sync] Could not get video duration:", e);
                }
              } else {
                // Video is from Replicate, need to download and upload to Supabase
                console.log("[Lip Sync] Video is from Replicate, downloading and uploading...");
                
                // Use AbortController with timeout for download
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
                
                try {
                  const videoResponse = await fetch(videoUrl, { signal: controller.signal });
                  clearTimeout(timeoutId);
                  
              if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.statusText}`);
              }
              
              const videoBlob = await videoResponse.blob();
                  console.log("[Lip Sync] Video downloaded, size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");
              
              const videoFileName = `lipsync-${uuid()}.mp4`;
                  console.log("[Lip Sync] Uploading to Supabase Storage...");
                  videoStorageUrl = await uploadVideoToStorage(
                videoBlob,
                currentProject.id,
                videoFileName
              );
              
              if (!videoStorageUrl) {
                throw new Error("Failed to upload video to storage");
              }
              
                  videoStoragePath = `ugc-videos/${currentProject.id}/${videoFileName}`;
                  console.log("[Lip Sync] Video uploaded to storage:", videoStorageUrl);
              
              // Get video duration from the video blob
              try {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.src = URL.createObjectURL(videoBlob);
                await new Promise((resolve, reject) => {
                  video.onloadedmetadata = () => {
                    durationSeconds = video.duration;
                    URL.revokeObjectURL(video.src);
                    resolve(null);
                  };
                  video.onerror = reject;
                  setTimeout(() => {
                    URL.revokeObjectURL(video.src);
                    resolve(null); // Resolve anyway if metadata doesn't load
                  }, 2000);
                });
              } catch (e) {
                    console.warn("[Lip Sync] Could not get video duration:", e);
                  }
                } catch (fetchError: any) {
                  clearTimeout(timeoutId);
                  if (fetchError.name === 'AbortError') {
                    throw new Error("Video download timed out after 5 minutes");
                  }
                  throw fetchError;
                }
              }
              
              // Save to database with timeout and retry logic
              console.log("[Lip Sync] Saving to database...");
              const savedVideo = await saveGeneratedVideo(
                currentProject.id,
                voiceGenerationId,
                videoStorageUrl,
                videoStoragePath,
                null, // thumbnail (can be generated later)
                durationSeconds
              );
              
              console.log("[Lip Sync] ✅ Generated video saved successfully:", savedVideo.id);
              
              // Reload generated videos list so it appears in media
              await loadGeneratedVideos();
              console.log("[Lip Sync] ✅ Generated videos list reloaded");
            } catch (error: any) {
              console.error("[Lip Sync] ❌ Error saving generated video:", error);
              console.error("[Lip Sync] Error details:", {
                message: error.message,
                stack: error.stack,
                projectId: currentProject?.id,
                videoUrl: videoUrl?.substring(0, 80)
              });
              alert(`Video generated successfully, but failed to save to database: ${error.message}. The video is still available in the preview.`);
            }
          })();
        } else {
          console.warn("Cannot save video - missing project or video URL", {
            hasProject: !!currentProject,
            hasVideoUrl: !!videoUrl
          });
        }
      } else if (data.status === 'processing' || data.status === 'starting') {
        // If still processing, poll for completion
        console.log("Lip sync is processing, polling for completion...");
        setLipSyncStatus('Processing...');
        setLipSyncProgress(10);
        pollLipSyncStatus(data.prediction_id);
      } else {
        console.error("Failed to generate lip sync:", data.error || data.message);
        setLipSyncStatus(`Failed: ${data.error || data.message || 'Unknown error'}`);
        setLipSyncProgress(0);
        generatingLipSyncRef.current = false;
        setGeneratingLipSync(false);
        alert(`Failed to generate lip sync: ${data.error || data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("[Lip Sync] Error generating lip sync:", error);
      console.error("[Lip Sync] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      setLipSyncStatus(`Error: ${error.message || 'Network error'}`);
      setLipSyncProgress(0);
      setGeneratingLipSync(false);
      alert(`Error generating lip sync: ${error.message || 'Network error'}`);
    }
  }, [generatingLipSync, generatedSpeechUrl, selectedAvatar, currentProject, voiceGenerationId]);

  // Add generated video to canvas
  const handleAddVideoToScene = async () => {
    if (!lipSyncVideoUrl) {
      alert("No lip sync video available. Please generate one first.");
      return;
    }

    // Add video to canvas using the existing addElementToCanvas function
    await addElementToCanvas("video", lipSyncVideoUrl);
    
    // Clear the generated speech URL since the video already contains the synced audio
    setGeneratedSpeechUrl(null);
    setGeneratedSpeechVoiceId(null);
    
    // Don't close the dialog - let user continue working
    // setShowSpeechGeneration(false); // REMOVED - modal should stay open
    
    console.log("Added lip sync video to canvas:", lipSyncVideoUrl);
  };

  // Poll Replicate prediction status
  const pollLipSyncStatus = async (predictionId: string) => {
    if (!predictionId) return;

    const maxAttempts = 180; // Poll for up to 15 minutes (5 second intervals = 180 * 5 = 900 seconds)
    let attempts = 0;

    const poll = async () => {
      try {
        // Use cached token for polling (prevents expiration during long lip sync operations)
        const { getCachedToken } = await import('@/lib/utils/token-cache');
        const cachedToken = await getCachedToken();
        
        const headers: HeadersInit = {};
        if (cachedToken) {
          headers['Authorization'] = `Bearer ${cachedToken}`;
        }

        // Always use our backend endpoint to avoid CORS issues
        const pollUrl = `${config.remotionServerUrl}/lipsync/status/${predictionId}`;
        const response = await fetch(pollUrl, {
          headers
        });
        const data = await response.json();

        // Update status message
        const statusMessages: Record<string, string> = {
          'starting': 'Starting lip sync generation...',
          'processing': 'Processing lip sync...',
          'succeeded': 'Lip sync completed!',
          'failed': 'Lip sync generation failed',
          'canceled': 'Lip sync generation canceled'
        };
        setLipSyncStatus(statusMessages[data.status] || `Status: ${data.status}`);
        
        // Calculate progress (rough estimate based on attempts)
        const progress = Math.min((attempts / maxAttempts) * 90, 90); // Cap at 90% until succeeded
        setLipSyncProgress(progress);

        // Handle all possible statuses: starting, processing, succeeded, failed, canceled
        if (data.status === 'succeeded' && data.output) {
          const videoUrl = typeof data.output === 'string' 
            ? data.output 
            : data.output.url || data.output;
          setLipSyncVideoUrl(videoUrl);
          generatingLipSyncRef.current = false;
          setGeneratingLipSync(false);
          setLipSyncStatus('Lip sync completed!');
          setLipSyncProgress(100);
          console.log("Lip sync completed:", videoUrl);
          
          // Save generated video to database and storage
          if (currentProject && videoUrl) {
            try {
              console.log("[Lip Sync] Saving generated video to database...", {
                projectId: currentProject.id,
                videoUrl: videoUrl.substring(0, 80) + "...",
                voiceGenerationId,
                isSupabaseUrl: videoUrl.includes('supabase.co/storage')
              });
              
              let videoStorageUrl = videoUrl;
              let videoStoragePath: string | null = null;
              let durationSeconds: number | null = null;
              
              // Check if video is already in Supabase Storage (from backend)
              if (videoUrl.includes('supabase.co/storage')) {
                console.log("[Lip Sync] Video is already in Supabase Storage, skipping download/re-upload");
                
                // Extract storage path from Supabase URL
                // Format: https://xxx.supabase.co/storage/v1/object/public/videos/user-uploads/...
                const urlMatch = videoUrl.match(/\/storage\/v1\/object\/public\/videos\/(.+)$/);
                if (urlMatch) {
                  videoStoragePath = urlMatch[1];
                  console.log("[Lip Sync] Extracted storage path:", videoStoragePath);
                }
                
                // Get video duration from the Supabase URL
                try {
                  const video = document.createElement('video');
                  video.preload = 'metadata';
                  video.crossOrigin = 'anonymous';
                  video.src = videoUrl;
                  await new Promise((resolve, reject) => {
                    video.onloadedmetadata = () => {
                      durationSeconds = video.duration;
                      resolve(null);
                    };
                    video.onerror = reject;
                    setTimeout(() => {
                      resolve(null); // Resolve anyway if metadata doesn't load
                    }, 5000); // Increased timeout for large videos
                  });
                  console.log("[Lip Sync] Video duration:", durationSeconds, "seconds");
                } catch (e) {
                  console.warn("[Lip Sync] Could not get video duration:", e);
                }
              } else {
                // Video is from Replicate, need to download and upload to Supabase
                console.log("[Lip Sync] Video is from Replicate, downloading and uploading...");
                
                // Use AbortController with timeout for download
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
                
                try {
                  const videoResponse = await fetch(videoUrl, { signal: controller.signal });
                  clearTimeout(timeoutId);
                  
              if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.statusText}`);
              }
              
              const videoBlob = await videoResponse.blob();
                  console.log("[Lip Sync] Video downloaded, size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");
              
              const videoFileName = `lipsync-${uuid()}.mp4`;
                  console.log("[Lip Sync] Uploading to Supabase Storage...");
                  videoStorageUrl = await uploadVideoToStorage(
                videoBlob,
                currentProject.id,
                videoFileName
              );
              
              if (!videoStorageUrl) {
                throw new Error("Failed to upload video to storage");
              }
              
                  videoStoragePath = `ugc-videos/${currentProject.id}/${videoFileName}`;
                  console.log("[Lip Sync] Video uploaded to storage:", videoStorageUrl);
              
              // Get video duration from the video blob
              try {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.src = URL.createObjectURL(videoBlob);
                await new Promise((resolve, reject) => {
                  video.onloadedmetadata = () => {
                    durationSeconds = video.duration;
                    URL.revokeObjectURL(video.src);
                    resolve(null);
                  };
                  video.onerror = reject;
                  setTimeout(() => {
                    URL.revokeObjectURL(video.src);
                    resolve(null); // Resolve anyway if metadata doesn't load
                  }, 2000);
                });
              } catch (e) {
                    console.warn("[Lip Sync] Could not get video duration:", e);
                  }
                } catch (fetchError: any) {
                  clearTimeout(timeoutId);
                  if (fetchError.name === 'AbortError') {
                    throw new Error("Video download timed out after 5 minutes");
                  }
                  throw fetchError;
                }
              }
              
              // Save to database with timeout and retry logic
              console.log("[Lip Sync] Saving to database...");
              const savedVideo = await saveGeneratedVideo(
                currentProject.id,
                voiceGenerationId,
                videoStorageUrl,
                videoStoragePath,
                null, // thumbnail (can be generated later)
                durationSeconds
              );
              
              console.log("[Lip Sync] ✅ Generated video saved successfully:", savedVideo.id);
              
              // Reload generated videos list so it appears in media
              await loadGeneratedVideos();
              console.log("[Lip Sync] ✅ Generated videos list reloaded");
            } catch (error: any) {
              console.error("[Lip Sync] ❌ Error saving generated video:", error);
              console.error("[Lip Sync] Error details:", {
                message: error.message,
                stack: error.stack,
                projectId: currentProject?.id,
                videoUrl: videoUrl?.substring(0, 80)
              });
              // Show user-friendly error but don't block the UI
              alert(`Video generated successfully, but failed to save to database: ${error.message}. The video is still available in the preview.`);
            }
          } else {
            console.warn("Cannot save video - missing project or video URL", {
              hasProject: !!currentProject,
              hasVideoUrl: !!videoUrl
            });
          }
        } else if (data.status === 'failed' || data.error) {
          generatingLipSyncRef.current = false;
          setGeneratingLipSync(false);
          setLipSyncStatus(`Failed: ${data.error || 'Unknown error'}`);
          setLipSyncProgress(0);
          alert(`Lip sync generation failed: ${data.error || 'Unknown error'}`);
        } else if (data.status === 'canceled') {
          generatingLipSyncRef.current = false;
          setGeneratingLipSync(false);
          setLipSyncStatus('Canceled');
          setLipSyncProgress(0);
          alert("Lip sync generation was canceled.");
        } else if (data.status === 'starting' || data.status === 'processing') {
          // Still processing, poll again after 5 seconds
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 5000);
          } else {
            generatingLipSyncRef.current = false;
            setGeneratingLipSync(false);
            setLipSyncStatus('Timeout - taking longer than expected');
            setLipSyncProgress(0);
            alert("Lip sync generation is taking longer than expected. Please check back later.");
          }
        } else {
          // Unknown status, continue polling if we have attempts left
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 5000);
          } else {
            generatingLipSyncRef.current = false;
            setGeneratingLipSync(false);
            setLipSyncStatus(`Unknown status: ${data.status}`);
            setLipSyncProgress(0);
            alert(`Lip sync generation status: ${data.status}. Please check back later.`);
          }
        }
      } catch (error: any) {
        console.error("Error polling lip sync status:", error);
        generatingLipSyncRef.current = false;
        setGeneratingLipSync(false);
        setLipSyncStatus(`Error: ${error.message}`);
        setLipSyncProgress(0);
        alert(`Error checking lip sync status: ${error.message}`);
      }
    };

    // Start polling
    setTimeout(poll, 5000);
  };

  const fetchElevenLabsVoices = async () => {
    setLoadingVoices(true);
    try {
      const response = await fetch(`${config.remotionServerUrl}/voices`);
      const data = await response.json();
      
      if (data.voices && Array.isArray(data.voices)) {
        // Filter out voices that should not be shown
        const excludedVoiceNames = [
          'New Pet Loud',
          'New Cartoon Male Pet',
          'Cartoon M',
          'Asif',
          'Stwie Girf'
        ];
        
        const filteredVoices = data.voices.filter((voice: { name: string }) => 
          !excludedVoiceNames.includes(voice.name)
        );
        
        setElevenLabsVoices(filteredVoices);
      } else if (data.error) {
        console.error("Error fetching voices:", data.error);
        // Set some default voices if API fails
        setElevenLabsVoices([
          { voice_id: "default1", name: "Default Voice 1", category: "default" },
          { voice_id: "default2", name: "Default Voice 2", category: "default" },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch ElevenLabs voices:", error);
      // Set default voices on error
      setElevenLabsVoices([
        { voice_id: "default1", name: "Default Voice 1", category: "default" },
        { voice_id: "default2", name: "Default Voice 2", category: "default" },
      ]);
    } finally {
      setLoadingVoices(false);
    }
  };

  // Combined list: user saved voices first, then Eleven Labs API voices (for dropdown)
  const combinedVoices = useMemo(() => {
    const saved = userSavedVoices.map((v) => ({
      voice_id: v.eleven_labs_voice_id,
      name: v.name,
      category: "Saved" as const,
    }));
    return [...saved, ...elevenLabsVoices];
  }, [userSavedVoices, elevenLabsVoices]);

  const getVoiceName = useCallback(
    (voiceId: string) =>
      userSavedVoices.find((v) => v.eleven_labs_voice_id === voiceId)?.name ??
      elevenLabsVoices.find((v) => v.voice_id === voiceId)?.name ??
      null,
    [userSavedVoices, elevenLabsVoices]
  );

  const handleSaveNewVoice = useCallback(async () => {
    const name = newVoiceName.trim();
    const voiceId = newVoiceId.trim();
    if (!name || !voiceId || !user?.id) return;
    setSavingNewVoice(true);
    try {
      const { error } = await supabase.from("user_saved_voices").insert({
        user_id: user.id,
        name,
        eleven_labs_voice_id: voiceId,
      });
      if (error) throw error;
      setAddVoiceDialogOpen(false);
      setNewVoiceName("");
      setNewVoiceId("");
      await fetchUserSavedVoices();
    } catch (e) {
      console.error("Failed to save voice:", e);
      alert(e instanceof Error ? e.message : "Failed to save voice");
    } finally {
      setSavingNewVoice(false);
    }
  }, [newVoiceName, newVoiceId, user?.id, fetchUserSavedVoices]);

  // Preview voice function
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoice(voiceId);
    try {
      const response = await fetch(`${config.remotionServerUrl}/voices/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice_id: voiceId,
          text: "Hello, this is a preview of this voice."
        }),
      });

      const data = await response.json();
      
      if (data.success && data.audio) {
        setPreviewAudio(data.audio);
        // Auto-play the preview
        setTimeout(() => {
          if (previewAudioRef.current) {
            previewAudioRef.current.play().catch(console.error);
          }
        }, 100);
      } else {
        console.error("Failed to generate preview:", data.error);
      }
    } catch (error) {
      console.error("Error previewing voice:", error);
    } finally {
      setPreviewingVoice(null);
    }
  };

  // Use own voice: set audio (data URL or URL) and go to lip sync step
  const applyOwnVoiceAudio = useCallback((audioDataUrlOrUrl: string) => {
    setGeneratedSpeechUrl(audioDataUrlOrUrl);
    setGeneratedSpeechVoiceId(null); // not from TTS
    setCurrentStep("lipsync");
  }, []);

  const handleOwnVoiceUploadClick = useCallback(() => {
    uploadOwnVoiceInputRef.current?.click();
  }, []);

  const onOwnVoiceFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") applyOwnVoiceAudio(result);
      };
      reader.readAsDataURL(file);
    },
    [applyOwnVoiceAudio]
  );

  const handleStartRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        try {
          const wavDataUrl = await convertWebmBlobToWavDataUrl(blob);
          applyOwnVoiceAudio(wavDataUrl);
        } catch (e) {
          console.error("Convert recording to WAV failed:", e);
        }
      };
      recorder.start();
      setIsRecordingVoice(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }, [applyOwnVoiceAudio]);

  const handleStopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      setIsRecordingVoice(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
    };
  }, []);

  const sidebarSections: { id: SidebarSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "avatars", label: "Avatars", icon: User },
    { id: "media", label: "Media", icon: Film },
    { id: "templates", label: "Templates", icon: Sparkles },
    { id: "audio", label: "Audio", icon: Music },
    { id: "captions", label: "Captions", icon: FileText },
    { id: "brolls", label: "B-rolls", icon: VideoIcon },
  ];

  // Calculate active subtitle based on current time
  const activeSubtitle = useMemo(() => {
    try {
      if (!showSubtitles || !subtitleSegments || subtitleSegments.length === 0) return null;
    return subtitleSegments.find(
        (segment) => segment && currentTime >= segment.startMs && currentTime < segment.endMs
      ) || null;
    } catch (error) {
      console.error('[Subtitles] Error calculating active subtitle:', error);
      return null;
    }
  }, [currentTime, showSubtitles, subtitleSegments]);

  const magicCinemaExplainerCoversVideo = useMemo(
    () => isMagicCinemaExplainerActiveAt(currentTime, canvasElements),
    [currentTime, canvasElements]
  );
  const activeMagicCinemaExplainer = useMemo(
    () => getActiveMagicCinemaExplainerAt(currentTime, canvasElements),
    [currentTime, canvasElements]
  );
  /** Pre-warm circle layout just before black overlay ends to avoid a visible pop. */
  const cinemaToCirclePrewarm = useMemo(() => {
    if (!activeMagicCinemaExplainer) return false;
    const endMs =
      (activeMagicCinemaExplainer.startTime ?? 0) +
      (activeMagicCinemaExplainer.duration ?? 0);
    return endMs - currentTime <= 260;
  }, [activeMagicCinemaExplainer, currentTime]);

  const magicCircleLayoutActive = useMemo(
    () => isMagicCircleLayoutActiveAt(currentTime, canvasElements),
    [currentTime, canvasElements]
  );

  const magicTopTextCardActive = useMemo(
    () => isMagicTopTextCardExplainerActiveAt(currentTime, canvasElements),
    [currentTime, canvasElements]
  );

  // "Top slot, no card" = the segment was authored to pair with a top explainer
  // card (topSlot=true) but the user deleted that card. The main video stays in
  // the bottom-half rectangle and the top half renders as empty white canvas.
  // We pin the subtitle to the canvas middle (50%) so it visually sits in the
  // centre of the frame, rather than dropping to the user's default y (which
  // would bury it inside the video).
  const magicTopSlotNoCardActive = useMemo(
    () => isMagicTopSlotNoCardAt(currentTime, canvasElements),
    [currentTime, canvasElements]
  );

  // "Full circle" = centered circle-pip with no explainer card on top AND no
  // topSlot reservation (so the circle really does fill the frame). In that
  // layout we pin the subtitle near the bottom of the circle so it reads like
  // a caption on the pip itself.
  const magicFullCircleActive =
    magicCircleLayoutActive && !magicTopTextCardActive && !magicTopSlotNoCardActive;

  // Subtitle drag handlers
  const handleSubtitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingSubtitle(true);
  };

  const handleCanvasMouseMoveForSubtitle = (e: React.MouseEvent) => {
    if (!isDraggingSubtitle || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Clamp values to keep content within bounds (0-100%)
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    
    setSubtitlePosition({ x, y });
  };

  const handleCanvasMouseUpForSubtitle = () => {
    setIsDraggingSubtitle(false);
  };

  // Generate subtitles from video elements using STT server
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  
  const handleGenerateSubtitles = async () => {
    try {
      setIsGeneratingSubtitles(true);
      
      // Get all video elements from canvas
      const videoElements = canvasElements.filter(el => el.type === 'video' && el.url);
      
      if (videoElements.length === 0) {
        alert('No video elements found. Add videos to the canvas first.');
        setIsGeneratingSubtitles(false);
        return;
      }

      console.log('[Subtitles] Generating subtitles for', videoElements.length, 'video(s)');

      // Process each video element
      const allSegments: SubtitleSegment[] = [];
      
      for (const element of videoElements) {
        if (!element.url) continue;
        
        const elementStartTime = element.startTime || 0;
        const elementDuration = element.duration || 5000;
        const videoStartOffset = element.videoStartOffset || 0;
        
        // Calculate the actual start time in the timeline
        const timelineStartTime = elementStartTime;
        
        try {
          console.log('[Subtitles] Transcribing video:', element.url);
          
          // Call STT server
          const response = await fetch(`${config.sttServerUrl}/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audioPath: element.url,
              language: 'en',
              wordTimestamps: true,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[Subtitles] STT server error:', response.status, response.statusText, errorText);
            continue;
          }

          const data = await response.json();
          const segments = data.segments || [];

          console.log('[Subtitles] Received', segments.length, 'segments for video', element.url);
          
          if (segments.length === 0) {
            console.warn('[Subtitles] No segments returned for video:', element.url, '- video may not have audio or speech');
          }

          // Convert STT segments to subtitle segments
          // STT returns segments in seconds relative to the video file start
          // We need to map them to timeline milliseconds, accounting for:
          // 1. videoStartOffset (trim start)
          // 2. elementStartTime (timeline position)
          const videoStartOffsetSeconds = videoStartOffset / 1000;
          
          for (const seg of segments) {
            const times = sttSegmentTimesSec(seg);
            if (!times) {
              console.warn("[Subtitles] Skip segment with invalid times:", seg);
              continue;
            }
            const rawText = typeof (seg as { text?: unknown }).text === "string" ? (seg as { text: string }).text : "";
            const line = rawText.trim();
            if (!line) continue;

            // Times are relative to the video file start — adjust for videoStartOffset (trim start)
            const adjustedStartSec = times.startSec - videoStartOffsetSeconds;
            const adjustedEndSec = times.endSec - videoStartOffsetSeconds;

            // Only include segments that are within the trimmed portion
            if (adjustedStartSec < 0 || adjustedEndSec > elementDuration / 1000) {
              continue;
            }

            const segmentStartMs = timelineStartTime + adjustedStartSec * 1000;
            const segmentEndMs = timelineStartTime + adjustedEndSec * 1000;

            if (
              segmentStartMs >= timelineStartTime &&
              segmentEndMs <= timelineStartTime + elementDuration &&
              Number.isFinite(segmentStartMs) &&
              Number.isFinite(segmentEndMs)
            ) {
              allSegments.push({
                startMs: Math.round(segmentStartMs),
                endMs: Math.round(segmentEndMs),
                speaker: "A",
                text: line,
              });
            }
          }
        } catch (error) {
          console.error('[Subtitles] Error transcribing video:', element.url, error);
          // Continue with other videos
        }
      }

      // Sort segments by start time
      allSegments.sort((a, b) => a.startMs - b.startMs);

      console.log('[Subtitles] Generated', allSegments.length, 'subtitle segments');
      
      if (allSegments.length === 0) {
        const videoCount = videoElements.length;
        alert(
          `No subtitles could be generated from ${videoCount} video(s).\n\n` +
          `Possible reasons:\n` +
          `• Videos may not have audio tracks\n` +
          `• Videos may be silent (no speech)\n` +
          `• STT server may be unavailable (check ${config.sttServerUrl})\n` +
          `• Network issues downloading videos`
        );
      } else {
        // Store both segments and SRT text, and save original for restore
        setSubtitleSegments(allSegments);
        setOriginalSubtitleSegments([...allSegments]); // Deep copy for restore
        const srtText = serializeSrt(allSegments);
        setSubtitleSrtText(srtText);
        setShowSubtitles(true);
        alert(`Successfully generated ${allSegments.length} subtitle segments from ${videoElements.length} video(s)!`);
      }
    } catch (error) {
      console.error('[Subtitles] Error generating subtitles:', error);
      alert(`Failed to generate subtitles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  // Handle subtitle SRT text changes from editor
  const handleSubtitleSrtChange = useCallback((newSrtText: string) => {
    try {
      if (!newSrtText || typeof newSrtText !== 'string') {
        setSubtitleSrtText('');
        setSubtitleSegments([]);
        return;
      }
      setSubtitleSrtText(newSrtText);
      const parsed = parseSrtText(newSrtText);
      if (Array.isArray(parsed)) {
        setSubtitleSegments(parsed);
      } else {
        console.warn('[Subtitles] Parsed result is not an array:', parsed);
        setSubtitleSegments([]);
      }
    } catch (error) {
      console.error('[Subtitles] Error parsing SRT text:', error);
      // Keep the text but don't update segments if parsing fails
    }
  }, []);

  // Restore original subtitles
  const handleRestoreSubtitles = useCallback(() => {
    try {
      if (!originalSubtitleSegments || originalSubtitleSegments.length === 0) {
        alert('No original subtitles to restore. Generate subtitles first.');
        return;
      }
      const restored = [...originalSubtitleSegments];
      setSubtitleSegments(restored);
      const srtText = serializeSrt(restored);
      setSubtitleSrtText(srtText);
    } catch (error) {
      console.error('[Subtitles] Error restoring subtitles:', error);
      alert('Failed to restore subtitles. Please try generating them again.');
    }
  }, [originalSubtitleSegments]);

  // Sync subtitleSegments to SRT text when segments change externally (but not from editor)
  useEffect(() => {
    try {
      if (subtitleSegments && subtitleSegments.length > 0) {
        const currentSrt = serializeSrt(subtitleSegments);
        // Only update if different to avoid infinite loops
        // Use a ref or compare more carefully to avoid loops
        setSubtitleSrtText(prev => {
          if (prev !== currentSrt) {
            return currentSrt;
          }
          return prev;
        });
      } else if (subtitleSegments && subtitleSegments.length === 0) {
        // Clear SRT text if segments are cleared
        setSubtitleSrtText('');
      }
    } catch (error) {
      console.error('[Subtitles] Error syncing segments to SRT:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleSegments]);

  // Load generated videos from database
  const loadGeneratedVideos = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingVideosRef.current) {
      console.log('[Media] Already loading generated videos, skipping...');
      return;
    }
    
    loadingVideosRef.current = true;
    setLoadingVideos(true);
    try {
      console.log("Loading generated videos from database...");
      
      // Add timeout to prevent infinite loading (60 seconds - increased for slow connections)
      // Note: apiRequest already has a 25s timeout, but we add an extra safety timeout here
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 60000)
      );
      
      const videos = await Promise.race([
        getUserGeneratedVideos(),
        timeoutPromise
      ]);
      
      console.log("Loaded videos:", videos.length, videos);
      setGeneratedVideos(videos);
      
      if (videos.length === 0) {
        console.warn("No videos found. Possible reasons:");
        console.warn("1. Database tables not created (run migration)");
        console.warn("2. Videos not saved due to errors");
        console.warn("3. User authentication issue");
      }
    } catch (error: any) {
      console.error("Error loading generated videos:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack
      });
      
      // Set empty array on error so UI doesn't stay in loading state
      setGeneratedVideos([]);
      
      // Only show alert for non-timeout errors
      if (error.message === 'Request timeout') {
        console.warn("Request timed out, continuing with empty list");
      } else if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        alert(`Database tables not found. Please run the migration SQL in Supabase:\n\n${error.message}\n\nSee: supabase/migrations/create_ugc_tables.sql`);
      } else {
        console.warn("Failed to load videos, continuing with empty list");
      }
    } finally {
      loadingVideosRef.current = false;
      setLoadingVideos(false);
    }
  }, []);

  // Load media when dialog opens
  // Note: Functions are memoized with useCallback and empty deps, so they're stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mediaDialogOpen) {
      // Wait for auth to be ready before loading media
      const loadMediaWithAuth = async () => {
        // Clear any previous errors
        setMediaError(null);
        
        // Check if auth is initialized
        const { user, loading: authLoading } = useAuthStore.getState();
        
        // Wait for auth to initialize (max 3 seconds)
        let attempts = 0;
        while (authLoading && attempts < 6) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const state = useAuthStore.getState();
          if (!state.loading) break;
          attempts++;
        }
        
        // Try to get session token - check localStorage first as fallback
        let session = null;
        let hasTokenInStorage = false;
        
        // Check localStorage directly as a fallback
        try {
          const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
          if (supabaseProjectRef) {
            const storageKey = `sb-${supabaseProjectRef}-auth-token`;
            const storedData = localStorage.getItem(storageKey);
            if (storedData) {
              try {
                const parsed = JSON.parse(storedData);
                if (parsed?.access_token) {
                  hasTokenInStorage = true;
                  console.log('[Media] Found token in localStorage');
                }
              } catch (e) {
                console.error('[Media] Failed to parse stored token:', e);
              }
            }
          }
        } catch (e) {
          console.error('[Media] Error checking localStorage:', e);
        }
        
        // Get token from cache (avoids hanging getSession/refreshSession calls)
        const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
        let token = await getCachedToken();
        
        // If no token but token exists in storage, try refreshing
        if (!token && hasTokenInStorage) {
          console.log('[Media] Token in storage but not in cache, attempting to refresh...');
          try {
            token = await refreshToken();
            if (token) {
              console.log('[Media] Token refreshed successfully');
            }
          } catch (refreshError) {
            console.error('[Media] Failed to refresh token:', refreshError);
          }
        }
        
        // Create session-like object from token for compatibility
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            session = {
              access_token: token,
              user: {
                id: payload.sub || payload.user_id,
                email: payload.email
              }
            };
          } catch (parseError) {
            console.error('[Media] Failed to parse token:', parseError);
            session = null;
          }
        } else {
          session = null;
        }
        
        // If still no session token, handle error
        if (!session?.access_token) {
          console.warn('[Media] No auth session available, skipping media load');
          
          // Reset loading states so UI doesn't stay in loading state
          setLoadingVideos(false);
          setLoadingImages(false);
          setLoadingUploadedVideos(false);
          
          // Set empty arrays so UI shows empty state instead of loading
          setGeneratedVideos([]);
          setUploadedImages([]);
          setUploadedVideos([]);
          
          // Set error message for UI display
          setMediaError('Please sign in to load your media. If you are signed in, try refreshing the page.');
          
          return;
        }
        
        // Clear error if we successfully got a session
        setMediaError(null);
        
        // Now load media in parallel with timeout protection
        // Use Promise.allSettled so one failure doesn't block others
        Promise.allSettled([
          loadGeneratedVideos(),
          loadUploadedImages(),
          loadUploadedVideos()
        ]).then((results) => {
          const errors = results.filter(r => r.status === 'rejected');
          if (errors.length > 0) {
            console.warn("Some media failed to load:", errors);
            // Check if errors are auth-related
            const authErrors = errors.filter(r => 
              r.reason?.message?.includes('401') || 
              r.reason?.message?.includes('AUTH_REQUIRED') ||
              r.reason?.message?.includes('Authentication')
            );
            if (authErrors.length > 0) {
              setMediaError('Authentication failed. Please sign in again.');
            }
          } else {
            // Clear error on successful load
            setMediaError(null);
          }
        });
      };
      
      loadMediaWithAuth();
    } else {
      // Reset loading refs when dialog closes to prevent stuck state
      // This ensures refs are ready for the next time the dialog opens
      loadingVideosRef.current = false;
      loadingImagesRef.current = false;
      loadingUploadedVideosRef.current = false;
      
      // Also reset loading states
      setLoadingVideos(false);
      setLoadingImages(false);
      setLoadingUploadedVideos(false);
    }
  }, [mediaDialogOpen]); // Only depend on mediaDialogOpen since functions are stable

  // Reset avatar generation states when avatar dialog closes (if user cancels without selecting)
  useEffect(() => {
    if (!avatarsDialogOpen && !showSpeechGeneration) {
      // Only reset if speech generation dialog is also closed
      // This prevents clearing states when transitioning from avatar selection to speech generation
      console.log('[Avatar Dialog] Dialog closed without proceeding, resetting states');
      
      // Reset avatar selection states
      setSelectedAvatar(null);
      setCurrentStep("speech");
      
      // Reset speech generation states
      setSelectedVoice("");
      setSpeechText("");
      setSpeechSpeed(1.0);
      setSelectedModel("flash");
      setEmotionsEnabled(false);
      setGeneratedSpeechUrl(null);
      setGeneratedSpeechVoiceId(null);
      setGeneratingSpeech(false);
      
      // Reset lip sync states
      setGeneratingLipSync(false);
      setLipSyncVideoUrl(null);
      generatingLipSyncRef.current = false;
      
      // Reset voice loading states
      setElevenLabsVoices([]);
      setLoadingVoices(false);
      setPreviewAudio(null);
      setPreviewingVoice(null);
    }
  }, [avatarsDialogOpen, showSpeechGeneration]);

  // Reset avatar generation states when speech generation dialog closes
  useEffect(() => {
    if (!showSpeechGeneration) {
      // Reset all avatar generation related states when speech generation dialog closes
      console.log('[Speech Generation Dialog] Dialog closed, resetting states');
      
      // Reset speech generation states
      setSelectedVoice("");
      setSpeechText("");
      setSpeechSpeed(1.0);
      setSelectedModel("flash");
      setEmotionsEnabled(false);
      setGeneratedSpeechUrl(null);
      setGeneratedSpeechVoiceId(null);
      setGeneratingSpeech(false);
      
      // Reset lip sync states
      setGeneratingLipSync(false);
      setLipSyncVideoUrl(null);
      generatingLipSyncRef.current = false;
      
      // Reset voice loading states
      setElevenLabsVoices([]);
      setLoadingVoices(false);
      setPreviewAudio(null);
      setPreviewingVoice(null);
      
      // Reset step
      setCurrentStep("speech");
      
      // Note: We don't reset selectedAvatar here as it might be used elsewhere
      // If the user wants to start fresh, they can close the avatar dialog too
    }
  }, [showSpeechGeneration]);

  // Handle selecting a generated video from media dialog
  const handleSelectGeneratedVideo = async (video: UGCGeneratedVideo) => {
    // If the media dialog is being used as a Magic Create picker, just set the
    // main-video key and return to the wizard — don't add the video to the canvas.
    if (magicMediaPickerActive) {
      setMagicCreateMainVideoKey(`gen:${video.id}`);
      setMagicMediaPickerActive(false);
      setMediaDialogOpen(false);
      return;
    }
    setMediaDialogOpen(false);

    setAssets((prev) => [
      ...prev,
      {
        id: uuid(),
        name: `Generated Video ${new Date(video.created_at).toLocaleDateString()}`,
        type: "video",
        url: video.video_url,
      },
    ]);

    let thumbnail: string | undefined;
    let videoDuration =
      video.duration_seconds != null && video.duration_seconds > 0
        ? Math.round(video.duration_seconds * 1000)
        : 5000;

    try {
      const [thumb, dur] = await Promise.all([
        generateVideoThumbnail(video.video_url),
        getVideoDuration(video.video_url),
      ]);
      thumbnail = thumb;
      videoDuration = dur;
    } catch (error) {
      console.error("Failed to get video metadata:", error);
    }

    const afterId = insertAfterElementId;
    if (afterId) setInsertAfterElementId(null);

    await ensureProjectExists();

    const newId = uuid();

    setCanvasElements((prev) => {
      let videoStartTime = 0;
      if (afterId) {
        const afterElement = prev.find((el) => el.id === afterId);
        if (afterElement) {
          const elementStartTime = afterElement.startTime || 0;
          const elementDuration =
            afterElement.duration || (afterElement.type === "video" ? 5000 : 3000);
          videoStartTime = elementStartTime + elementDuration;
        }
      } else {
        const videoElements = prev.filter((el) => el.type === "video");
        if (videoElements.length > 0) {
          const endTimes = videoElements.map((el) => {
            const startTime = el.startTime || 0;
            const dur = el.duration || 5000;
            return startTime + dur;
          });
          videoStartTime = Math.max(...endTimes);
        }
      }

      const newElement: CanvasElement = {
        id: newId,
        type: "video",
        url: video.video_url,
        x: 50,
        y: 50,
        width: 80,
        height: 80,
        rotation: 0,
        opacity: 1,
        zIndex: prev.length,
        startTime: videoStartTime,
        duration: videoDuration,
        thumbnail,
        muted: false,
      };

      return [...prev, newElement];
    });

    setSelectedElementId(newId);
  };

  // Get video duration from URL (no crossOrigin — avoids CORS blocking metadata on some CDNs)
  const getVideoDuration = async (videoUrl: string): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.src = videoUrl;

      const TIMEOUT_MS = 12000;
      const fallbackMs = 10000;
      const timer = window.setTimeout(() => {
        cleanup();
        resolve(fallbackMs);
      }, TIMEOUT_MS);

      const handleLoadedMetadata = () => {
        if (video.duration && video.duration > 0 && isFinite(video.duration)) {
          window.clearTimeout(timer);
          cleanup();
          resolve(video.duration * 1000);
        }
      };

      const handleError = () => {
        window.clearTimeout(timer);
        cleanup();
        resolve(fallbackMs);
      };

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("error", handleError);
        video.removeAttribute("src");
        video.load();
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("error", handleError);
      video.load();
    });
  };

  // Generate thumbnail from video (anonymous CORS when needed for canvas; fallback to URL)
  const generateVideoThumbnail = async (videoUrl: string): Promise<string> => {
    const tryThumbnail = (useCors: boolean) =>
      new Promise<string>((resolve, reject) => {
        const video = document.createElement("video");
        if (useCors) video.crossOrigin = "anonymous";
        video.src = videoUrl;
        video.muted = true;
        video.preload = "metadata";

        const TIMEOUT_MS = 12000;
        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error("thumbnail timeout"));
        }, TIMEOUT_MS);

        const cleanup = () => {
          window.clearTimeout(timer);
          video.removeEventListener("loadedmetadata", onMeta);
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onErr);
          video.removeAttribute("src");
          video.load();
        };

        const onMeta = () => {
          video.currentTime = 0;
        };

        const onSeeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = 160;
            canvas.height = 90;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              cleanup();
              resolve(canvas.toDataURL("image/jpeg", 0.8));
            } else {
              cleanup();
              reject(new Error("no canvas context"));
            }
          } catch {
            cleanup();
            reject(new Error("draw failed"));
          }
        };

        const onErr = () => {
          cleanup();
          reject(new Error("video error"));
        };

        video.addEventListener("loadedmetadata", onMeta);
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onErr);
        video.load();
      });

    try {
      return await tryThumbnail(true);
    } catch {
      try {
        return await tryThumbnail(false);
      } catch {
        return videoUrl;
      }
    }
  };

  /** Speech-to-text: transcribe latest generated video into the Magic create script box (uses STT server, e.g. localhost:5009). */
  const handleMagicTranscribeScriptFromVideo = async () => {
    setMagicCreateTranscribeLoading(true);
    try {
      const opt =
        magicMainVideoOptions.find((o) => o.key === magicCreateMainVideoKey) ||
        magicMainVideoOptions[0];
      if (!opt) {
        alert(
          "No videos in Media. Generate a lip-sync clip or upload a video, then transcribe."
        );
        return;
      }
      const url = opt.url;

      const res = await fetch(`${config.sttServerUrl}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioPath: url,
          language: "en",
          wordTimestamps: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(
          errText.trim() ||
            `STT request failed (${res.status}). Start the STT server: cd saas/stt-server && .venv/bin/uvicorn app:app --host 127.0.0.1 --port 5009 — or set NEXT_PUBLIC_STT_SERVER_URL (${config.sttServerUrl}).`
        );
      }

      const data = (await res.json()) as { segments?: Array<{ text?: string }> };
      const segs = data.segments || [];
      const text = segs
        .map((s) => (s.text || "").trim())
        .filter(Boolean)
        .join(" ");

      if (!text.trim()) {
        alert(
          `No speech detected in that video. Check audio, or verify STT at ${config.sttServerUrl}.`
        );
        return;
      }

      setMagicCreateScript(text);
      setMagicCreateTranscribed(true);
    } catch (e) {
      console.error("[Magic create transcribe]", e);
      alert(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setMagicCreateTranscribeLoading(false);
    }
  };

  /**
   * Magic Create wizard — clear the avatar-delegation flag if the user bailed out.
   * If both the avatars picker and the speech/lipsync panels are closed without a lipsync
   * landing, drop the pending-reopen flag so we don't auto-reopen later on some unrelated
   * lipsync.
   */
  useEffect(() => {
    if (!magicPendingReopenOnLipsync) return;
    if (avatarsDialogOpen || showSpeechGeneration) return;
    if (generatingLipSync) return; // lipsync in progress — wait for completion watcher
    if (lipSyncVideoUrl) return; // success path — let the completion watcher handle it
    // All avatar-flow dialogs are closed and there's no lipsync — user cancelled.
    const t = setTimeout(() => setMagicPendingReopenOnLipsync(false), 200);
    return () => clearTimeout(t);
  }, [
    magicPendingReopenOnLipsync,
    avatarsDialogOpen,
    showSpeechGeneration,
    generatingLipSync,
    lipSyncVideoUrl,
  ]);

  /**
   * Magic Create wizard — completion watcher for the Avatar branch.
   *
   * When the user picked "Select an Avatar" in Step 1, we hand off to the existing
   * (working) Avatars → Speech → Lipsync flow. `magicPendingReopenOnLipsync` remembers
   * that we should jump them back into Magic Create once the lipsync lands.
   *
   * We fire when `lipSyncVideoUrl` becomes truthy, pre-pick that fresh clip as the main
   * video, copy the typed script (from `speechText`) into `magicCreateScript`, and reopen
   * the wizard straight on Step 3 (Generate).
   */
  useEffect(() => {
    if (!magicPendingReopenOnLipsync) return;
    if (!lipSyncVideoUrl) return;
    // Wait a tick for the lipsync save to register in generatedVideos → magicMainVideoOptions.
    const t = setTimeout(() => {
      const latest = magicMainVideoOptions[0];
      if (latest) setMagicCreateMainVideoKey(latest.key);
      if (speechText.trim()) setMagicCreateScript(speechText);
      setMagicPendingReopenOnLipsync(false);
      setMagicWizardStep("generate");
      setMagicCreateOpen(true);
      // Clean up the other open dialogs from the avatar flow.
      setShowSpeechGeneration(false);
    }, 600);
    return () => clearTimeout(t);
  }, [magicPendingReopenOnLipsync, lipSyncVideoUrl, magicMainVideoOptions, speechText]);

  /**
   * Magic create: 3s half/half (main + B-roll), then centered circle + caption bar (no B-roll).
   * Subtitles off by default.
   */
  const handleMagicCreate = async () => {
    const script = magicCreateScript.trim();
    if (!script) {
      alert("Paste your script first.");
      return;
    }
    const runT0 = performance.now();
    const mcLog = (step: string, extra?: Record<string, unknown>) => {
      console.log(`[Magic create] ${step}`, {
        elapsedMs: Math.round(performance.now() - runT0),
        ...extra,
      });
    };

    setMagicCreateLoading(true);
    try {
      mcLog("start", { scriptChars: script.length });
      mcLog("step:ensureProject (await)");
      await ensureProjectExists();
      mcLog("step:ensureProject done");

      const mainPick =
        magicMainVideoOptions.find((o) => o.key === magicCreateMainVideoKey) ||
        magicMainVideoOptions[0];
      if (!mainPick) {
        alert(
          "No videos in Media. Generate a lip-sync clip or upload a video under Media, then run Magic create."
        );
        return;
      }
      mcLog("step:mainVideo", {
        key: magicCreateMainVideoKey,
        urlPrefix: mainPick.url?.slice(0, 72),
      });

      const sceneTexts = splitScriptIntoScenes(script);
      mcLog("step:scenes split", { sceneCount: sceneTexts.length });

      mcLog("step:explainer API (script → many cards, started in parallel)");
      const explainerPromise =
        !script.trim()
          ? Promise.resolve([] as SceneExplainerCard[])
          : magicSceneExplainersApi
              .getCardsFromScript(script.trim())
              .then((r) => r.cards || [])
              .catch((e) => {
                console.warn("[Magic create] explainer API failed:", e);
                return [] as SceneExplainerCard[];
              });

      let bRollPool: BRoll[] = [];
      let sceneRows: SceneStockBRollRow[] = [];
      try {
        mcLog("step:B-roll fetch (await) — per-scene stock can take up to ~180s server timeout");
        console.log('[B-roll] Magic create: requesting stock (per-scene)', {
          scriptLen: script.length,
          sceneCount: sceneTexts.length,
        });
        const res = await bRollsApi.list({ scenes: sceneTexts, stockOnly: true });
        sceneRows = res.sceneStockBRolls || [];
        bRollPool = (res.bRolls || []).filter((b) => !!b.url);
        mcLog("step:B-roll fetch done", {
          poolSize: bRollPool.length,
          sceneRows: sceneRows.length,
        });
        console.log('[B-roll] Magic create: pool ready', {
          count: bRollPool.length,
          sceneRows: sceneRows.length,
          stockSearchTerms: res.stockSearchTerms?.length ?? 0,
        });
        setBRolls(bRollPool);
        if (bRollPool.length === 0) {
          alert(
            "No Freepik B-roll clips could be loaded. Check that the Remotion server is running (see NEXT_PUBLIC_REMOTION_SERVER_URL), FREEPIK_API_KEY or FREEPICK_API_KEY is set on the server, and try Magic create again."
          );
        }
      } catch (e) {
        mcLog("step:B-roll fetch error", {
          message: e instanceof Error ? e.message : String(e),
        });
        console.warn("[Magic create] B-roll list failed, continuing without B-roll:", e);
        alert(
          `Could not load Freepik B-rolls: ${e instanceof Error ? e.message : "Unknown error"}. Magic layout will run without stock overlays.`
        );
      }

      const pick = mainPick;

      let totalMs =
        pick.duration_seconds != null && pick.duration_seconds > 0
          ? Math.round(pick.duration_seconds * 1000)
          : 10_000;

      let thumbnail: string | undefined;
      try {
        mcLog("step:thumbnail+duration (await) — may be slow on large videos");
        const [thumb, dur] = await Promise.all([
          generateVideoThumbnail(pick.url),
          getVideoDuration(pick.url),
        ]);
        thumbnail = thumb;
        totalMs = dur;
        mcLog("step:thumbnail+duration done", { totalMs, hasThumb: !!thumb });
      } catch (e) {
        mcLog("step:thumbnail+duration warn", {
          message: e instanceof Error ? e.message : String(e),
        });
        console.warn("[Magic create] metadata:", e);
      }

      const fallbackMs =
        pick.duration_seconds != null && pick.duration_seconds > 0
          ? Math.round(pick.duration_seconds * 1000)
          : 10_000;
      const safeTotalMs =
        Number.isFinite(totalMs) && totalMs > 500 ? totalMs : fallbackMs;

      const sttPromise = transcribeUrlToSubtitleSegments(pick.url, {
        timelineStartMs: 0,
        videoStartOffsetMs: 0,
        elementDurationMs: safeTotalMs,
      });

      mcLog("step:explainer await (if still in flight — up to ~120s for long scripts)", {});
      let explainerCards: SceneExplainerCard[] = await explainerPromise;
      mcLog("step:explainer await done", { cardCount: explainerCards.length });
      if (!explainerCards.length) {
        explainerCards = fallbackExplainerCardsFromScript(script);
        mcLog("step:explainer fallback from script chunks", {
          cardCount: explainerCards.length,
        });
      }
      let explainerEls = buildMagicExplainerElements(
        safeTotalMs,
        explainerCards,
        script.trim()
      );

      const sttCaptionSegments = await sttPromise;
      const captionSegments =
        sttCaptionSegments.length > 0
          ? sttCaptionSegments
          : buildMagicCreateSubtitleSegments(script, safeTotalMs);
      if (sttCaptionSegments.length > 0) {
        mcLog("step:STT captions for cinema overlays", {
          segmentCount: sttCaptionSegments.length,
        });
      } else {
        mcLog("step:STT empty — cinema overlays use script-timed stub captions", {
          stubSegments: captionSegments.length,
        });
      }
      explainerEls = snapExplainerStartsToCaptionBoundaries(
        explainerEls,
        captionSegments,
        safeTotalMs
      );
      mcLog("step:snapped scene switches to phrase boundaries", {
        beats: explainerEls.filter((e) => e.magicSceneExplainer && !e.magicSceneExplainerStock).length,
        captions: captionSegments.length,
      });
      explainerEls = stretchCinemaExplainerTimingsToCaptions(
        explainerEls,
        captionSegments,
        safeTotalMs
      );
      explainerEls = enforceExplainerOpeningAndMaxSceneDuration(explainerEls, safeTotalMs);
      explainerEls = applyCaptionTextToCinemaExplainers(explainerEls, captionSegments);

      console.log("[Magic create] scene explainer cards", {
        count: explainerCards.length,
        canvasEls: explainerEls.length,
      });

      const sceneMode: MagicRhythmSceneMode | undefined =
        sceneTexts.length > 0 && sceneRows.length > 0
          ? {
              sceneTexts,
              sceneStockBRolls: sceneRows.map((r) => ({
                sceneIndex: r.sceneIndex,
                bRoll: r.bRoll,
              })),
            }
          : undefined;

      mcLog("step:buildMagicRhythmElements");
      const { elements: rhythmEls, primaryMainId, usedBRollIds } = buildMagicRhythmElements(
        pick.url,
        safeTotalMs,
        bRollPool,
        script,
        thumbnail,
        sceneMode,
        explainerEls
      );

      console.log('[B-roll] Magic create: rhythm elements', {
        clipCount: rhythmEls.length,
        primaryMainId,
        usedBRollIds,
      });
      mcLog("step:rhythm built", {
        rhythmClipCount: rhythmEls.length,
        explainerEls: explainerEls.length,
      });

      if (usedBRollIds.length > 0) {
        setSelectedBRollIds(usedBRollIds.slice(0, 5));
      }

      mcLog("step:React setState (canvas + assets)");
      setAssets((prev) => [
        ...prev,
        {
          id: uuid(),
          name: `Magic ${new Date(pick.created_at).toLocaleDateString()}`,
          type: "video",
          url: pick.url,
        },
      ]);

      setCanvasElements((prev) => [...prev, ...rhythmEls, ...explainerEls]);
      setSelectedElementId(primaryMainId || rhythmEls[0]?.id || null);

      setSubtitleSegments(captionSegments);
      // Keep subtitles ON so they reach the final render. Circle-pip beats and
      // subtitle-cinema beats already have their own built-in caption overlays;
      // the main subtitle layer is gated against both in the editor canvas AND
      // in UGCVideoComposition, so turning this off here silently drops every
      // non-cinema / non-circle scene's captions from the exported MP4.
      setShowSubtitles(true);
      setActiveSidebarSection(bRollPool.length > 0 ? "brolls" : "media");
      setMagicCreateOpen(false);
      setMagicCreateScript("");
      mcLog("complete OK", { totalElapsedMs: Math.round(performance.now() - runT0) });
    } catch (e) {
      console.error("[Magic create]", e);
      mcLog("FAILED", {
        message: e instanceof Error ? e.message : String(e),
        totalElapsedMs: Math.round(performance.now() - runT0),
      });
      alert(e instanceof Error ? e.message : "Magic create failed");
    } finally {
      mcLog("finally: closing modal loading state");
      setMagicCreateLoading(false);
    }
  };

  // Helper function to calculate the end time of the last video in the timeline
  const getLastVideoEndTime = (): number => {
    const videoElements = canvasElements.filter(el => el.type === "video");
    if (videoElements.length === 0) {
      return 0;
    }
    // Calculate the maximum end time (startTime + duration) among all videos
    const endTimes = videoElements.map(el => {
      const startTime = el.startTime || 0;
      const duration = el.duration || 5000;
      return startTime + duration;
    });
    return Math.max(...endTimes);
  };

  // Ensure a project exists - auto-create if needed
  const ensureProjectExists = useCallback(async () => {
    if (currentProject) {
      console.log('[Project] Already open — skip create', { id: currentProject.id });
      return currentProject;
    }

    if (ensureProjectInFlightRef.current) {
      console.log('[Project] Create already in flight — awaiting same promise');
      return ensureProjectInFlightRef.current;
    }

    const started = (async () => {
      try {
        console.log('[Project] No project yet — Auto-creating via Supabase (25s timeout on insert)…');
        const project = await createUGCProject(
          `UGC Video - ${new Date().toLocaleDateString()}`,
          'Auto-created project'
        );
        setCurrentProject(project);
        setProjectTitle(project.title || project.id);
        console.log('[Project] Auto-created project:', project.id);
        return project;
      } catch (error: any) {
        console.error('[Project] Error auto-creating project:', error);
        throw error;
      } finally {
        ensureProjectInFlightRef.current = null;
      }
    })();

    ensureProjectInFlightRef.current = started;
    return started;
  }, [currentProject]);

  // Add element to canvas
  const addElementToCanvas = async (type: "video" | "image" | "text", url?: string) => {
    try {
      console.log("[Media add] start", {
        type,
        urlPrefix: url?.slice(0, 80),
        insertAfterElementId,
        currentTime,
      });
      let width = 30;
      let height = 30;
      let x = 50;
      let y = 50;

      if (type === "image") {
        width = 100;
        height = 100;
        x = 0;
        y = 0;
      } else if (type === "video") {
        width = 90;
        height = 90;
        x = 5;
        y = 5;
      } else if (type === "text") {
        width = 30;
        height = 10;
        x = 50;
        y = 50;
      }

      const afterId = insertAfterElementId;
      if (afterId) setInsertAfterElementId(null);

      // Do not block adding clips on project row — Supabase client insert can hang indefinitely;
      // canvas/timeline should still update. Project is created in the background for save/export.
      void ensureProjectExists().catch((err) => {
        console.warn(
          '[Project] Background auto-create failed (media still added). Save may prompt again:',
          err
        );
      });

      let defaultDuration = type === "image" ? 3000 : type === "text" ? 3000 : 5000;
      let thumbnail: string | undefined;

      if (type === "video" && url) {
        try {
          const [thumb, dur] = await Promise.all([
            generateVideoThumbnail(url),
            getVideoDuration(url),
          ]);
          thumbnail = thumb;
          defaultDuration = dur;
        } catch (error) {
          console.error("Failed to get video metadata:", error);
          thumbnail = url;
          defaultDuration = 5000;
        }
      } else if (type === "image" && url) {
        thumbnail = url;
      }

      const newId = uuid();
      // Compute insertion time from current snapshot so we can seek there immediately.
      let defaultStartTime = 0;
      if (afterId) {
        const afterElement = canvasElements.find((el) => el.id === afterId);
        if (afterElement) {
          const elementStartTime = afterElement.startTime || 0;
          const elementDuration =
            afterElement.duration || (type === "video" ? 5000 : 3000);
          defaultStartTime = elementStartTime + elementDuration;
        }
      } else if (type === "video") {
        const videoEls = canvasElements.filter((el) => el.type === "video");
        if (videoEls.length > 0) {
          const endTimes = videoEls.map((el) => {
            const st = el.startTime || 0;
            const dur = el.duration || 5000;
            return st + dur;
          });
          defaultStartTime = Math.max(...endTimes);
        }
      } else {
        defaultStartTime = currentTime || 0;
      }

      setCanvasElements((prev) => {
        const newElement: CanvasElement = {
          id: newId,
          type,
          url,
          text: type === "text" ? "Double click to edit" : undefined,
          x,
          y,
          width,
          height,
          rotation: 0,
          opacity: 1,
          zIndex: prev.length,
          fontSize: type === "text" ? 24 : undefined,
          fontColor: type === "text" ? "#000000" : undefined,
          fontFamily: type === "text" ? "Arial" : undefined,
          imageOffsetX: type === "image" ? 50 : undefined,
          imageOffsetY: type === "image" ? 50 : undefined,
          startTime: defaultStartTime,
          duration: defaultDuration,
          thumbnail,
          muted: type === "video" ? false : undefined,
          // User-added media from the Media panel should show the whole frame
          // (no cropping). Other element sources (avatars, magic main video,
          // b-rolls, etc.) leave this undefined → default to `cover`.
          objectFit: type === "video" || type === "image" ? "contain" : undefined,
        };

        return [...prev, newElement];
      });

      setSelectedElementId(newId);
      // Jump playhead to the newly inserted element so it appears immediately on canvas.
      setCurrentTime(defaultStartTime);
      setIsPlaying(false);
      console.log("[Media add] inserted", {
        id: newId,
        type,
        startTime: defaultStartTime,
        duration: defaultDuration,
      });
    } catch (e) {
      console.error("[addElementToCanvas]", e);
      alert(e instanceof Error ? e.message : "Could not add media to the timeline.");
    }
  };

  // Update canvas element - memoized to prevent stale closures
  const updateCanvasElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setCanvasElements(elements =>
      elements.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  }, []);

  // Delete canvas element
  const deleteCanvasElement = (id: string) => {
    setCanvasElements(elements => elements.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  // Find the main magic-rhythm video element (the one carrying layout segments).
  const getMainMagicVideo = useCallback(() => {
    return canvasElements.find(
      (el) => el.type === "video" && el.magicLayoutSegments?.length
    );
  }, [canvasElements]);

  // Mutate one segment on the main video's magicLayoutSegments array by index.
  // Passing `null` as the patch removes the segment (used by "Full Screen" and
  // the delete button in the circle toolbar).
  const updateMagicLayoutSegment = useCallback(
    (
      idx: number,
      patch:
        | Partial<{ mode: "split-bottom" | "circle-pip"; circleScale: number; startMs: number; endMs: number }>
        | null
    ) => {
      setCanvasElements((prev) =>
        prev.map((el) => {
          if (el.type !== "video" || !el.magicLayoutSegments?.length) return el;
          const segs = el.magicLayoutSegments.slice();
          if (idx < 0 || idx >= segs.length) return el;
          if (patch === null) {
            segs.splice(idx, 1);
          } else {
            segs[idx] = { ...segs[idx], ...patch };
          }
          return { ...el, magicLayoutSegments: segs };
        })
      );
    },
    []
  );

  // Delete a magic scene-explainer card together with its paired stock-image
  // companion (matched by `explainerGraphicVariant`). Used by the Scenes track.
  const deleteExplainerCardWithCompanion = (cardId: string) => {
    setCanvasElements(elements => {
      const card = elements.find(el => el.id === cardId);
      if (!card) return elements;
      const variant = card.explainerGraphicVariant;
      return elements.filter(el => {
        if (el.id === cardId) return false;
        if (
          variant !== undefined &&
          el.magicSceneExplainerStock &&
          el.explainerGraphicVariant === variant
        ) {
          return false;
        }
        return true;
      });
    });
    if (selectedElementId === cardId) setSelectedElementId(null);
  };

  // Split video/image element at current playhead time
  const splitElementAtPlayhead = (elementId: string) => {
    const element = canvasElements.find(el => el.id === elementId);
    if (!element || (element.type !== "video" && element.type !== "image")) return;
    const startTime = element.startTime ?? 0;
    const elementDuration = element.duration ?? 5000;
    const endTime = startTime + elementDuration;
    if (currentTime <= startTime || currentTime >= endTime) return; // playhead must be inside clip
    const leftDuration = currentTime - startTime;
    const rightDuration = endTime - currentTime;
    const videoStartOffset = element.videoStartOffset ?? 0;
    const audioStartOffset = element.audioStartOffset ?? 0;
    const rightVideoStartOffset = videoStartOffset + leftDuration;
    const rightAudioStartOffset = audioStartOffset + leftDuration;
    setCanvasElements(prev => {
      const idx = prev.findIndex(el => el.id === elementId);
      if (idx === -1) return prev;
      const el = prev[idx];
      const left: CanvasElement = { ...el, duration: leftDuration };
      const right: CanvasElement = {
        ...el,
        id: uuid(),
        startTime: currentTime,
        duration: rightDuration,
        videoStartOffset: rightVideoStartOffset,
        audioStartOffset: rightAudioStartOffset,
      };
      return [...prev.slice(0, idx), left, right, ...prev.slice(idx + 1)];
    });
    setSelectedElementId(null); // deselect so user can click the new clip if needed
  };

  // Bring element to front (highest z-index)
  const bringToFront = (id: string) => {
    if (canvasElements.length === 0) return;
    const maxZIndex = Math.max(...canvasElements.map(el => el.zIndex ?? 0), 0);
    updateCanvasElement(id, { zIndex: maxZIndex + 1 });
  };

  // Send element to back (lowest z-index). Use 0 as floor so element stays visible; re-normalize others above it.
  const sendToBack = (id: string) => {
    if (canvasElements.length === 0) return;
    const others = canvasElements.filter(el => el.id !== id);
    if (others.length === 0) {
      updateCanvasElement(id, { zIndex: 0 });
      return;
    }
    // Sort others by zIndex ascending; assign 1, 2, 3, ... so they stay above the sent element at 0
    const sorted = [...others].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    setCanvasElements((prev) => {
      const next = prev.map((el) => {
        if (el.id === id) return { ...el, zIndex: 0 };
        const rank = sorted.findIndex((o) => o.id === el.id);
        return { ...el, zIndex: rank + 1 };
      });
      return next;
    });
  };

  // Fill canvas with video (set to 100% width and height, centered)
  const fillCanvas = (id: string) => {
    updateCanvasElement(id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  };

  // Download exported video
  const handleDownloadVideo = useCallback(async () => {
    // Always read from ref first (most up-to-date), then fallback to state
    // This ensures we get the latest URL even if there's a closure issue
    const currentExportedUrl = exportedVideoUrlRef.current || exportedVideoUrl;
    console.log('[Download] ========================================');
    console.log('[Download] Download button clicked');
    console.log('[Download] exportedVideoUrl state:', exportedVideoUrl);
    console.log('[Download] exportedVideoUrlRef.current:', exportedVideoUrlRef.current);
    console.log('[Download] Will download from URL:', currentExportedUrl);
    console.log('[Download] ========================================');
    
    if (!currentExportedUrl) {
      console.warn('[Download] No exported video URL available');
      alert('No video available to download. Please export a video first.');
      return;
    }
    
    try {
      console.log('[Download] Fetching video from:', currentExportedUrl);
      const response = await fetch(currentExportedUrl, {
        cache: 'no-store', // Ensure we don't get cached version
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('[Download] Video blob size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');
      console.log('[Download] Video blob type:', blob.type);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      console.log('[Download] ✅ Download completed successfully');
    } catch (error) {
      console.error('[Download] ❌ Error downloading video:', error);
      // Fallback: open in new tab
      console.log('[Download] Falling back to opening URL in new tab:', currentExportedUrl);
      window.open(currentExportedUrl, '_blank');
    }
  }, [exportedVideoUrl]);

  // Save project canvas state
  const handleSaveProject = useCallback(async () => {
    console.log('[Save] ========================================');
    console.log('[Save] handleSaveProject function called');
    console.log('[Save] ========================================');
    
    // Always read from ref first (most up-to-date), then fallback to state
    // This ensures we get the latest project even if there's a closure issue
    const project = currentProjectRef.current || currentProject;
    
    console.log('[Save] Save button clicked');
    console.log('[Save] currentProject state:', currentProject?.id);
    console.log('[Save] currentProjectRef.current:', currentProjectRef.current?.id);
    console.log('[Save] Will save project:', project?.id);
    
    if (!project) {
      console.warn('[Save] No project found');
      alert('No project found. Please create a project first by selecting an avatar.');
      return;
    }

    // Check network connectivity first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn('[Save] No internet connection');
      alert('No internet connection. Please check your network and try again.');
      return;
    }

    // Verify we have a token before attempting save
    let token: string | null = null;
    try {
      console.log('[Save] Checking for token...');
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      token = await getCachedToken();
      console.log('[Save] Token check result:', token ? '✅ Token found' : '❌ No token');
      if (!token) {
        console.warn('[Save] No token available, but continuing - API will handle auth');
        // Don't return early - let the API call handle the auth error
        // This allows the save to proceed and show a proper error message
      }
    } catch (tokenError) {
      console.error('[Save] Token check error:', tokenError);
      // Continue anyway - the API call will handle auth errors
    }

    try {
      console.log('[Save] Saving project canvas state...', {
        projectId: project.id,
        elementsCount: canvasElements.length,
        hasMetadata: !!project.metadata
      });

      // Prepare canvas state to save - capture all current state values
      const canvasState = {
        elements: canvasElements,
        duration: duration,
        currentTime: currentTime,
        playbackRate: playbackRate,
        isMuted: isMuted,
        subtitleSegments: subtitleSegments,
        subtitleStyle: subtitleStyle,
        subtitlePosition: subtitlePosition,
        subtitleFontSize: subtitleFontSize,
        subtitleFontFamily: subtitleFontFamily,
        subtitleSingleLine: subtitleSingleLine,
        subtitleSingleWord: subtitleSingleWord,
        showSubtitles: showSubtitles,
        karaokePillColor: karaokePillColor,
        boldGreenColor: boldGreenColor,
        // B-roll state
        selectedBRollIds: selectedBRollIds,
        jumpCutInterval: jumpCutInterval,
        savedAt: new Date().toISOString()
      };

      // Update project metadata with canvas state
      // Ensure metadata is always an object before spreading
      const existingMetadata = project.metadata && typeof project.metadata === 'object' 
        ? project.metadata 
        : {};
      
      await updateUGCProject(project.id, {
        metadata: {
          ...existingMetadata,
          canvasState: canvasState
        }
      });

      // Update local state with the saved project
      const updatedProject = await getUGCProject(project.id);
      setCurrentProject(updatedProject);
      currentProjectRef.current = updatedProject;

      console.log('[Save] ✅ Project saved successfully');
      alert('Project saved successfully!');
    } catch (error: any) {
      console.error('[Save] ❌ Error saving project:', error);
      console.error('[Save] Error details:', {
        message: error.message,
        stack: error.stack,
        projectId: project?.id
      });
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Authentication required') || errorMessage.includes('Session expired')) {
        errorMessage = 'Session expired. Please refresh the page and try again.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      alert(`Failed to save project: ${errorMessage}`);
    }
  }, [currentProject, canvasElements, duration, currentTime, playbackRate, isMuted, subtitleSegments, subtitleStyle, subtitlePosition, subtitleFontSize, subtitleFontFamily, subtitleSingleLine, subtitleSingleWord, showSubtitles, karaokePillColor, boldGreenColor, selectedBRollIds, jumpCutInterval]);

  // Autosave function (silent, no alerts)
  const handleAutosave = useCallback(async () => {
    const project = currentProjectRef.current || currentProject;
    
    if (!project) {
      return; // No project to save
    }

    // Check network connectivity
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Autosave] Skipping - no internet connection');
      return;
    }

    try {
      // Prepare canvas state to save
      const canvasState = {
        elements: canvasElements,
        duration: duration,
        currentTime: currentTime,
        playbackRate: playbackRate,
        isMuted: isMuted,
        subtitleSegments: subtitleSegments,
        subtitleStyle: subtitleStyle,
        subtitlePosition: subtitlePosition,
        subtitleFontSize: subtitleFontSize,
        subtitleFontFamily: subtitleFontFamily,
        subtitleSingleLine: subtitleSingleLine,
        subtitleSingleWord: subtitleSingleWord,
        showSubtitles: showSubtitles,
        karaokePillColor: karaokePillColor,
        boldGreenColor: boldGreenColor,
        // B-roll state
        selectedBRollIds: selectedBRollIds,
        jumpCutInterval: jumpCutInterval,
        savedAt: new Date().toISOString()
      };

      // Update project metadata with canvas state
      const existingMetadata = project.metadata && typeof project.metadata === 'object' 
        ? project.metadata 
        : {};
      
      await updateUGCProject(project.id, {
        metadata: {
          ...existingMetadata,
          canvasState: canvasState
        }
      });

      // Update local state with the saved project
      const updatedProject = await getUGCProject(project.id);
      setCurrentProject(updatedProject);
      currentProjectRef.current = updatedProject;

      console.log('[Autosave] ✅ Project autosaved successfully');
    } catch (error: any) {
      // Silently fail for autosave - don't show alerts
      console.warn('[Autosave] ⚠️ Autosave failed (silent):', error.message);
    }
  }, [currentProject, canvasElements, duration, currentTime, playbackRate, isMuted, subtitleSegments, subtitleStyle, subtitlePosition, subtitleFontSize, subtitleFontFamily, subtitleSingleLine, subtitleSingleWord, showSubtitles, karaokePillColor, boldGreenColor, selectedBRollIds, jumpCutInterval]);

  // Autosave every 60 seconds
  useEffect(() => {
    if (!currentProject) {
      return; // No project to autosave
    }

    console.log('[Autosave] Setting up autosave interval (60 seconds)');
    const autosaveInterval = setInterval(() => {
      handleAutosave();
    }, 60000); // 60 seconds

    return () => {
      console.log('[Autosave] Cleaning up autosave interval');
      clearInterval(autosaveInterval);
    };
  }, [currentProject, handleAutosave]);

  // Load project canvas state
  const loadProjectState = useCallback(async (project: UGCVideoProject) => {
    try {
      console.log('[Load] Loading project canvas state...', {
        projectId: project.id,
        hasMetadata: !!project.metadata,
        hasCanvasState: !!(project.metadata?.canvasState)
      });

      if (project.metadata?.canvasState) {
        const canvasState = project.metadata.canvasState;
        
        // Restore canvas elements
        if (canvasState.elements && Array.isArray(canvasState.elements)) {
          setCanvasElements(canvasState.elements);
          console.log('[Load] Restored', canvasState.elements.length, 'canvas elements');
        }

        // Restore timeline state
        if (canvasState.duration !== undefined) {
          setDuration(canvasState.duration);
        }
        if (canvasState.currentTime !== undefined) {
          setCurrentTime(canvasState.currentTime);
        }
        if (canvasState.playbackRate !== undefined) {
          setPlaybackRate(canvasState.playbackRate);
        }
        if (canvasState.isMuted !== undefined) {
          setIsMuted(canvasState.isMuted);
        }

        // Restore subtitle settings
        if (canvasState.subtitleSegments) {
          setSubtitleSegments(canvasState.subtitleSegments);
        }
        if (canvasState.subtitleStyle) {
          setSubtitleStyle(canvasState.subtitleStyle);
        }
        if (canvasState.subtitlePosition) {
          setSubtitlePosition(canvasState.subtitlePosition);
        }
        if (canvasState.subtitleFontSize !== undefined) {
          setSubtitleFontSize(canvasState.subtitleFontSize);
        }
        if (canvasState.subtitleFontFamily) {
          setSubtitleFontFamily(canvasState.subtitleFontFamily);
        }
        if (canvasState.subtitleSingleLine !== undefined) {
          setSubtitleSingleLine(canvasState.subtitleSingleLine);
        }
        if (canvasState.subtitleSingleWord !== undefined) {
          setSubtitleSingleWord(canvasState.subtitleSingleWord);
        }
        if (canvasState.showSubtitles !== undefined) {
          setShowSubtitles(canvasState.showSubtitles);
        }
        if (canvasState.karaokePillColor) {
          setKaraokePillColor(canvasState.karaokePillColor);
        }
        if (canvasState.boldGreenColor) {
          setBoldGreenColor(canvasState.boldGreenColor);
        }

        // Restore B-roll state
        if (canvasState.selectedBRollIds && Array.isArray(canvasState.selectedBRollIds)) {
          setSelectedBRollIds(canvasState.selectedBRollIds);
          console.log('[Load] Restored B-roll selections:', canvasState.selectedBRollIds.length);
        }
        if (canvasState.jumpCutInterval !== undefined && canvasState.jumpCutInterval !== null) {
          setJumpCutInterval(canvasState.jumpCutInterval);
          console.log('[Load] Restored jump cut interval:', canvasState.jumpCutInterval);
        }

        console.log('[Load] Project state loaded successfully');
      } else {
        console.log('[Load] No saved canvas state found, starting with empty canvas');
      }
    } catch (error: any) {
      console.error('[Load] Error loading project state:', error);
    }
  }, []);

  // Load project state when currentProject changes
  useEffect(() => {
    if (currentProject) {
      console.log('[Project] useEffect triggered, loading project state:', currentProject.id, currentProject.title);
      loadProjectState(currentProject);
      setProjectTitle(currentProject.title || currentProject.id);
    } else {
      console.log('[Project] No current project in useEffect');
    }
  }, [currentProject?.id, loadProjectState]); // Only reload when project ID changes
  
  // Debug: Log currentProject changes
  useEffect(() => {
    console.log('[Project] currentProject state changed:', {
      hasProject: !!currentProject,
      projectId: currentProject?.id,
      projectTitle: currentProject?.title
    });
  }, [currentProject]);

  // Keyboard shortcut: Ctrl+S (or Cmd+S on Mac) to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+S (or Cmd+S on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        
        // Only save if we have a project
        if (currentProject) {
          console.log('[Save] Keyboard shortcut triggered (Ctrl+S)');
          // Call save function with proper error handling
          handleSaveProject().catch((error) => {
            console.error('[Save] Error in keyboard shortcut handler:', error);
            // Error already handled in handleSaveProject
          });
        } else {
          console.log('[Save] No project to save');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentProject, handleSaveProject]); // Include handleSaveProject in dependencies

  // Export final video from canvas
  const handleExportVideo = async () => {
    // Prevent multiple simultaneous exports
    if (isExporting) {
      console.log('[Export] Export already in progress, ignoring click');
      return;
    }

    try {
      if (canvasElements.length === 0) {
        alert('No elements to export. Add videos, images, or text to the canvas first.');
        return;
      }

      setIsExporting(true);
      setExportedVideoUrl(null); // Clear previous export when starting new one (ref will sync via useEffect)
      console.log('[Export] Starting video export...');
      console.log('[Export] Canvas elements:', canvasElements.length);

      // Get cached token at the start of long-running operation
      // This prevents token expiration issues during video rendering
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      const cachedToken = await getCachedToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }

      // Prepare elements for export (only include elements with URLs or text)
      const exportElements = canvasElements
        .filter(el => {
          if (el.type === 'text') return !!el.text;
          if (el.type === 'audio') return !!el.url;
          return !!el.url;
        })
        .map((el) => ({
          id: el.id,
          type: el.type,
          url: el.url,
          text: el.text,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation || 0,
          opacity: el.opacity !== undefined ? el.opacity : 1,
          zIndex: el.zIndex || 0,
          startTime: el.startTime || 0,
          duration: el.duration || 5000,
          videoStartOffset: el.videoStartOffset || 0,
          audioStartOffset: el.audioStartOffset || 0,
          muted: el.muted || false,
          imageOffsetX: el.imageOffsetX,
          imageOffsetY: el.imageOffsetY,
          cropX: el.cropX,
          cropY: el.cropY,
          cropWidth: el.cropWidth,
          cropHeight: el.cropHeight,
          circleFrame: el.circleFrame || false,
          objectFit: el.objectFit,
          fontSize: el.fontSize,
          fontColor: el.fontColor,
          fontFamily: el.fontFamily,
          thumbnail: el.thumbnail,
          intrinsicSize: el.intrinsicSize,
          // Magic rhythm + B-roll (must match Remotion UGCVideoComposition)
          magicLayoutSegments: el.magicLayoutSegments,
          bRollOverlay: el.bRollOverlay,
          bRollSceneVibe: el.bRollSceneVibe,
          explainerSceneVibe: el.explainerSceneVibe,
          magicViralStyle: el.magicViralStyle,
          magicWhiteSlide: el.magicWhiteSlide,
          magicSceneExplainer: el.magicSceneExplainer,
          magicSceneExplainerStock: el.magicSceneExplainerStock,
          magicJumpCutCinema: el.magicJumpCutCinema,
          explainerIllustrationUrl: el.explainerIllustrationUrl,
          explainerGraphicVariant: el.explainerGraphicVariant,
          explainerLevel: el.explainerLevel,
          explainerAccentLabel: el.explainerAccentLabel,
          explainerSubline: el.explainerSubline,
          explainerSceneStyle: el.explainerSceneStyle,
          explainerTypographyStyle: el.explainerTypographyStyle,
          explainerAccentHex: el.explainerAccentHex,
          explainerSegmentDurationMs: el.explainerSegmentDurationMs,
          explainerHeroWord: el.explainerHeroWord,
          explainerItems: el.explainerItems,
          explainerEmoji: el.explainerEmoji,
          explainerSideA: el.explainerSideA,
          explainerSideB: el.explainerSideB,
          explainerIconEmoji: el.explainerIconEmoji,
          explainerLogoUrl: el.explainerLogoUrl,
          textBackgroundColor: el.textBackgroundColor,
        }));

      if (exportElements.length === 0) {
        alert('No valid elements to export. Please add videos, images, or text with content.');
        setIsExporting(false);
        return;
      }

      console.log('[Export] Exporting elements:', exportElements.length);
      console.log('[Export] API URL:', `${config.remotionServerUrl}/api/ugc/render-video`);

      // Calculate the actual duration from the last element's end time
      const actualDuration = getLastElementEndTime();
      console.log('[Export] Actual duration from last element:', actualDuration, 'ms');

      // Prepare subtitle data for export
      const subtitleData = showSubtitles && subtitleSegments.length > 0 ? {
        segments: subtitleSegments,
        style: subtitleStyle,
        position: subtitlePosition,
        fontSize: subtitleFontSize,
        fontFamily: subtitleFontFamily,
        singleLine: subtitleSingleLine,
        singleWord: subtitleSingleWord,
        karaokePillColor,
        boldGreenColor,
      } : null;

      const response = await fetch(`${config.remotionServerUrl}/api/ugc/render-video`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          elements: exportElements,
          projectId: currentProject?.id || null,
          subtitles: subtitleData,
          playbackRate: playbackRate, // Include playback rate in render request
          duration: actualDuration, // Send the actual duration from the canvas
        }),
      });

      console.log('[Export] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Export] Response data:', data);

      if (data.success) {
        // Check if we got a render_job_id (Lambda/Fargate pipeline)
        if (data.render_job_id) {
          console.log('[Export] Render job created:', data.render_job_id);
          setRenderJobId(data.render_job_id);
          setRenderStatus('QUEUED');
          setRenderProgress(0);
          
          // Subscribe to render job updates (like 2-char renders)
          const projectId = currentProject?.id || data.project_id;
          if (projectId) {
            console.log('[Export] Subscribing to render job updates for project:', projectId);
            subscribeToRenderJob(data.render_job_id, projectId);
          }
          
          // Also poll for updates as fallback
          const pollRenderStatus = async () => {
            try {
              const { getRenderJobStatus } = await import('@/lib/api/projects');
              const status = await getRenderJobStatus(projectId, data.render_job_id);
              if (status.render_job) {
                const job = status.render_job;
                const jobStatus = (job.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
                
                // Map backend status to frontend status
                if (jobStatus === 'completed') {
                  setRenderProgress(100);
                  if (job.result_url || job.video_url) {
                    setExportedVideoUrl(job.result_url || job.video_url);
                    setRenderStatus('READY');
                    return; // Stop polling
                  }
                } else if (jobStatus === 'failed') {
                  setRenderStatus('FAILED');
                  return; // Stop polling
                } else if (jobStatus === 'processing') {
                  setRenderStatus('RENDERING');
                  setRenderProgress(job.progress || 0);
                  // Continue polling
                  setTimeout(pollRenderStatus, 3000); // Poll every 3 seconds
                } else {
                  // pending
                  setRenderStatus('QUEUED');
                  setRenderProgress(0);
                  // Continue polling
                  setTimeout(pollRenderStatus, 3000); // Poll every 3 seconds
                }
              }
            } catch (error) {
              console.error('[Export] Error polling render status:', error);
              // Continue polling on error
              setTimeout(pollRenderStatus, 5000);
            }
          };
          
          // Start polling after a short delay
          setTimeout(pollRenderStatus, 2000);
        } else if (data.video_url) {
          // Local rendering - video is ready immediately
        console.log('[Export] Setting exportedVideoUrl to:', data.video_url);
          setExportedVideoUrl(data.video_url);
          setRenderStatus('READY');
          setRenderProgress(100);
        } else {
          throw new Error(data.error || 'Export failed - no video URL or render job ID');
        }
      } else {
        throw new Error(data.error || 'Export failed');
      }
    } catch (error) {
      console.error('[Export] Error:', error);
      alert(`Failed to export video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setExportedVideoUrl(null); // Clear exported video on error (ref will sync via useEffect)
    } finally {
      // Always reset exporting state, even if there was an error
      console.log('[Export] Resetting export state');
      setIsExporting(false);
    }
  };

  // Remove background from video
  const handleRemoveBackground = useCallback(async (elementId: string) => {
    console.log('[Background Removal] Function called with elementId:', elementId);
    
    // Get current element from state using a ref or by reading directly
    // We'll use a ref to store the latest canvasElements
    const element = canvasElements.find(el => el.id === elementId);
    console.log('[Background Removal] Element found:', element ? { id: element.id, type: element.type, url: element.url } : 'NOT FOUND');
    
    if (!element || element.type !== "video" || !element.url) {
      console.warn('[Background Removal] Early return - element:', element, 'type:', element?.type, 'url:', element?.url);
      alert(`Cannot remove background: ${!element ? 'Element not found' : element.type !== "video" ? 'Not a video element' : 'No video URL'}`);
      return;
    }

    setRemovingBackground(elementId);
    try {
      console.log('[Background Removal] Starting background removal for:', element.url);
      console.log('[Background Removal] API URL:', `${config.remotionServerUrl}/video/remove-background`);
      
      // Get cached token at the start of long-running operation
      // This prevents token expiration issues during processing
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      const cachedToken = await getCachedToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }
      
      // Call backend API to remove background
      const apiUrl = `${config.remotionServerUrl}/video/remove-background`;
      const requestBody = {
        video_url: element.url,
      };
      
      console.log('[Background Removal] Making API call to:', apiUrl);
      console.log('[Background Removal] Request body:', requestBody);
      console.log('[Background Removal] Using cached token:', cachedToken ? '✅' : '❌');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('[Background Removal] Fetch completed, response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Background Removal] Response data:', data);
      
      if (data.success) {
        if (data.video_url) {
          // Background removal completed immediately
          console.log('[Background Removal] Completed immediately, updating element with:', data.video_url);
          updateCanvasElement(elementId, { url: data.video_url });
          alert('Background removed successfully!');
          setRemovingBackground(null);
        } else if (data.job_id) {
          // Background removal is queued/processing, poll for status using job_id
          console.log('[Background Removal] Job queued, job ID:', data.job_id);
          // Inform user about expected processing time
          alert('Background removal started! This process typically takes ~8 minutes. Please wait...');
          let pollAttempts = 0;
          const maxPollAttempts = 180; // 15 minutes max (180 * 5 seconds = 900 seconds)
          
          const pollStatus = async () => {
            pollAttempts++;
            console.log(`[Background Removal] Polling attempt ${pollAttempts}/${maxPollAttempts} for job: ${data.job_id}`);
            
            try {
              // Use cached token for polling (prevents expiration during long operations)
              const { getCachedToken } = await import('@/lib/utils/token-cache');
              const cachedToken = await getCachedToken();
              
              const headers: HeadersInit = {
                'Content-Type': 'application/json',
              };
              if (cachedToken) {
                headers['Authorization'] = `Bearer ${cachedToken}`;
              }
              
              const statusResponse = await fetch(`${config.remotionServerUrl}/video/remove-background-status/${data.job_id}`, {
                headers,
              });
              
              if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.status}`);
              }
              
              const statusData = await statusResponse.json();
              console.log('[Background Removal] Status data:', statusData);
              
              if (statusData.success) {
                if (statusData.status === 'completed' && statusData.video_url) {
                  // Job completed successfully
                console.log('[Background Removal] Completed, updating element with:', statusData.video_url);
                updateCanvasElement(elementId, { url: statusData.video_url });
                alert('Background removed successfully!');
                setRemovingBackground(null);
                } else if (statusData.status === 'failed') {
                  // Job failed
                throw new Error(statusData.error || 'Background removal failed');
              } else if (pollAttempts >= maxPollAttempts) {
                  // Timeout
                  throw new Error('Background removal timed out after 15 minutes');
              } else {
                  // Still processing (queued or processing), poll again
                  console.log(`[Background Removal] Status: ${statusData.status}, polling again in 5s...`);
                setTimeout(pollStatus, 5000);
                }
              } else {
                throw new Error(statusData.error || 'Failed to get job status');
              }
            } catch (pollError: any) {
              console.error('[Background Removal] Error polling status:', pollError);
              alert(`Failed to check background removal status: ${pollError.message}`);
              setRemovingBackground(null);
            }
          };
          
          // Start polling after 5 seconds
          setTimeout(pollStatus, 5000);
          return; // Don't set removingBackground to null yet
        } else {
          throw new Error('No video URL or job ID returned');
        }
      } else {
        throw new Error(data.error || 'Failed to remove background');
      }
    } catch (error: any) {
      console.error('[Background Removal] Error:', error);
      alert(`Failed to remove background: ${error.message}`);
      setRemovingBackground(null);
    }
  }, [canvasElements, updateCanvasElement]); // Include canvasElements and updateCanvasElement in deps

  // Handle canvas mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent, elementId: string) => {
    if (!canvasRef.current) return;
    e.stopPropagation();
    setSelectedElementId(elementId);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const element = canvasElements.find(el => el.id === elementId);
    if (!element) return;

    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Check if clicking on resize handle (bottom-right corner)
    const elementX = element.x;
    const elementY = element.y;
    const elementW = element.width;
    const elementH = element.height;
    
    // Check if clicking on resize handle (any edge or corner)
    const handleSize = 3; // 3% of canvas for handle detection
    
    // Determine which edge/corner is being clicked
    const isNearLeft = mouseX >= elementX && mouseX <= elementX + handleSize;
    const isNearRight = mouseX >= elementX + elementW - handleSize && mouseX <= elementX + elementW;
    const isNearTop = mouseY >= elementY && mouseY <= elementY + handleSize;
    const isNearBottom = mouseY >= elementY + elementH - handleSize && mouseY <= elementY + elementH;
    
    let direction: string | null = null;
    if (isNearTop && isNearLeft) direction = 'nw';
    else if (isNearTop && isNearRight) direction = 'ne';
    else if (isNearBottom && isNearLeft) direction = 'sw';
    else if (isNearBottom && isNearRight) direction = 'se';
    else if (isNearTop) direction = 'n';
    else if (isNearBottom) direction = 's';
    else if (isNearLeft) direction = 'w';
    else if (isNearRight) direction = 'e';
    
    // Handle resize first, then dragging, then panning for images
    if (direction) {
      setIsResizing(true);
      setResizeDirection(direction);
      
      // For images, determine the anchor point based on resize direction
      // Store initial offsets to maintain anchor during resize
      let initialImageOffsetX = element.imageOffsetX ?? 50;
      let initialImageOffsetY = element.imageOffsetY ?? 50;
      
      if (element.type === "image") {
        // Set anchor point based on resize direction (opposite edge)
        // This ensures cropping happens only from the direction being resized
        if (direction.includes('e')) {
          // Resizing from right (east) - anchor image to left edge (0%)
          // This means the left part of the image stays visible, right gets cropped
          initialImageOffsetX = 0;
        } else if (direction.includes('w')) {
          // Resizing from left (west) - anchor image to right edge (100%)
          // This means the right part of the image stays visible, left gets cropped
          initialImageOffsetX = 100;
        }
        // If resizing from both sides (shouldn't happen with single direction), keep current offset
        
        if (direction.includes('s')) {
          // Resizing from bottom (south) - anchor image to top edge (0%)
          // This means the top part of the image stays visible, bottom gets cropped
          initialImageOffsetY = 0;
        } else if (direction.includes('n')) {
          // Resizing from top (north) - anchor image to bottom edge (100%)
          // This means the bottom part of the image stays visible, top gets cropped
          initialImageOffsetY = 100;
        }
        // If resizing from both top/bottom (shouldn't happen), keep current offset
      }
      
      // Store element's position, size, and image offsets for resize calculation
      setResizeStart({ 
        x: elementX, 
        y: elementY, 
        width: elementW, 
        height: elementH,
        imageOffsetX: initialImageOffsetX,
        imageOffsetY: initialImageOffsetY
      });
      // Store initial mouse position separately for delta calculation
      setDragStart({ x: mouseX, y: mouseY });
    } else if (element.type === "image" && e.ctrlKey) {
      // Ctrl + drag for images = start crop selection
      setIsCropping(true);
      setCropStart({ x: mouseX, y: mouseY });
      setCropArea({ x: 0, y: 0, width: 0, height: 0 });
      e.preventDefault();
      e.stopPropagation();
    } else if (element.type === "image" && e.altKey) {
      // Alt + drag for images = pan image content
      setIsPanning(true);
      setPanStart({
        x: element.imageOffsetX || 50, // Default center position (50%)
        y: element.imageOffsetY || 50
      });
      setDragStart({ x: mouseX, y: mouseY });
    } else {
      // Normal drag = move element position (for all elements including images)
      setIsDragging(true);
      setDragStart({ 
        x: mouseX - elementX, 
        y: mouseY - elementY 
      });
    }
  };

  // Handle canvas mouse move
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    // Handle crop selection
    if (isCropping && cropStart && selectedElementId) {
      const element = canvasElements.find(el => el.id === selectedElementId);
      if (element && element.type === "image") {
        // Calculate crop area relative to element bounds
        const elementX = element.x;
        const elementY = element.y;
        const elementW = element.width;
        const elementH = element.height;
        
        // Convert mouse position to element-relative coordinates
        const relX = mouseX - elementX;
        const relY = mouseY - elementY;
        const relStartX = cropStart.x - elementX;
        const relStartY = cropStart.y - elementY;
        
        // Calculate crop area (ensure it's within element bounds)
        const cropX = Math.max(0, Math.min(relStartX, relX));
        const cropY = Math.max(0, Math.min(relStartY, relY));
        const cropWidth = Math.max(0, Math.min(elementW, Math.abs(relX - relStartX)));
        const cropHeight = Math.max(0, Math.min(elementH, Math.abs(relY - relStartY)));
        
        // Convert to percentage of element size
        const cropXPercent = (cropX / elementW) * 100;
        const cropYPercent = (cropY / elementH) * 100;
        const cropWidthPercent = (cropWidth / elementW) * 100;
        const cropHeightPercent = (cropHeight / elementH) * 100;
        
        setCropArea({
          x: cropXPercent,
          y: cropYPercent,
          width: cropWidthPercent,
          height: cropHeightPercent
        });
      }
      return;
    }

    if ((!isDragging && !isResizing && !isPanning) || !selectedElementId) return;

    if (isPanning) {
      // Pan the image content within the element
      const deltaX = mouseX - dragStart.x;
      const deltaY = mouseY - dragStart.y;
      
      // Calculate new offset (in percentage, allow negative and >100 to push image outside bounds)
      // The offset represents the center point of the image (50% = center)
      // Allow values from -100 to 200 to push image outside canvas
      const newOffsetX = panStart.x + deltaX;
      const newOffsetY = panStart.y + deltaY;
      
      updateCanvasElement(selectedElementId, { 
        imageOffsetX: newOffsetX, 
        imageOffsetY: newOffsetY 
      });
    } else if (isDragging) {
      // Allow elements to move freely beyond canvas boundaries (like CapCut)
      const newX = mouseX - dragStart.x;
      const newY = mouseY - dragStart.y;
      updateCanvasElement(selectedElementId, { x: newX, y: newY });
    } else if (isResizing && resizeDirection) {
      const element = canvasElements.find(el => el.id === selectedElementId);
      if (!element) return;
      
      // Calculate mouse movement delta from initial mouse position
      const deltaX = mouseX - dragStart.x;
      const deltaY = mouseY - dragStart.y;
      
      let newX = resizeStart.x;
      let newY = resizeStart.y;
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      
      const minSize = 5; // Minimum size in percentage
      
      // For images, use the anchor point stored at resize start
      // This ensures the image stays anchored to the opposite edge throughout the resize
      // The anchor point is set once at resize start and never changes during resize
      let newImageOffsetX = resizeStart.imageOffsetX;
      let newImageOffsetY = resizeStart.imageOffsetY;
      
      // Handle different resize directions
      // Horizontal resizing
      if (resizeDirection.includes('e')) {
        // East (right) edge or corner - resize width from right, keep left edge fixed
        // Image is anchored to left (imageOffsetX = 0), so only right side gets cropped
        newWidth = Math.max(minSize, resizeStart.width + deltaX);
        // Keep imageOffsetX at 0 (left anchor) - don't change it
      }
      if (resizeDirection.includes('w')) {
        // West (left) edge or corner - resize width from left, adjust x to keep right edge fixed
        // Image is anchored to right (imageOffsetX = 100), so only left side gets cropped
        newX = resizeStart.x + deltaX;
        newWidth = Math.max(minSize, resizeStart.width - deltaX);
        // Keep imageOffsetX at 100 (right anchor) - don't change it
      }
      
      // Vertical resizing
      if (resizeDirection.includes('s')) {
        // South (bottom) edge or corner - resize height from bottom, keep top edge fixed
        // Image is anchored to top (imageOffsetY = 0), so only bottom side gets cropped
        newHeight = Math.max(minSize, resizeStart.height + deltaY);
        // Keep imageOffsetY at 0 (top anchor) - don't change it
      }
      if (resizeDirection.includes('n')) {
        // North (top) edge or corner - resize height from top, adjust y to keep bottom edge fixed
        // Image is anchored to bottom (imageOffsetY = 100), so only top side gets cropped
        newY = resizeStart.y + deltaY;
        newHeight = Math.max(minSize, resizeStart.height - deltaY);
        // Keep imageOffsetY at 100 (bottom anchor) - don't change it
      }
      
      // Ensure minimum size
      newWidth = Math.max(minSize, newWidth);
      newHeight = Math.max(minSize, newHeight);
      
      // Update element with position, size, and image offset (for images)
      const updates: Partial<CanvasElement> = {
        x: newX, 
        y: newY, 
        width: newWidth, 
        height: newHeight 
      };
      
      if (element.type === "image") {
        updates.imageOffsetX = newImageOffsetX;
        updates.imageOffsetY = newImageOffsetY;
      }
      
      updateCanvasElement(selectedElementId, updates);
    }
  };

  // Handle canvas mouse up
  const handleCanvasMouseUp = () => {
    // Apply crop if we were cropping
    if (isCropping && cropArea && selectedElementId && cropArea.width > 0 && cropArea.height > 0) {
      const element = canvasElements.find(el => el.id === selectedElementId);
      if (element && element.type === "image" && element.url) {
        // Apply crop to element
        updateCanvasElement(selectedElementId, {
          cropX: cropArea.x,
          cropY: cropArea.y,
          cropWidth: cropArea.width,
          cropHeight: cropArea.height
        });
      }
    }
    
    // Don't reset trimming here - it's handled by timeline trim handlers
    if (!isTrimming) {
      setIsDragging(false);
      setIsResizing(false);
      setIsPanning(false);
      setIsCropping(false);
      setCropStart(null);
      setCropArea(null);
      setResizeDirection(null);
    }
  };

  // Handle timeline trim mouse move
  const handleTimelineTrimMove = (e: MouseEvent) => {
    console.log('🔧 TRIM MOVE - Entry:', { isTrimming, trimElementId, trimEdge });
    
    if (!isTrimming || !trimElementId || !trimEdge) {
      console.log('❌ TRIM MOVE - Blocked: Missing state', { isTrimming, trimElementId, trimEdge });
      return;
    }

    const element = canvasElements.find(el => el.id === trimElementId);
    console.log('🔍 TRIM MOVE - Element found:', { element: element ? { id: element.id, type: element.type } : null });

    if (!element) {
      console.log('❌ TRIM MOVE - Blocked: Invalid element', { element: 'not found' });
      return;
    }
    const isExplainerCardTrim = element.type === "text" && !!element.magicSceneExplainer;
    if (
      element.type !== "video" &&
      element.type !== "image" &&
      element.type !== "audio" &&
      !isExplainerCardTrim
    ) {
      console.log('❌ TRIM MOVE - Blocked: Invalid element', { element: element.type });
      return;
    }

    // Explainer scene cards (type === "text" + magicSceneExplainer) have no media
    // file, so trimming is a simple startTime/duration adjustment with a minimum
    // beat length. The paired stock-image companion (matched by
    // explainerGraphicVariant) is kept aligned to the card's window.
    if (isExplainerCardTrim) {
      const tracksContainerSimple =
        document.querySelector('.timeline-tracks-container')?.parentElement as HTMLElement | null;
      if (!tracksContainerSimple) return;
      const rectSimple = tracksContainerSimple.getBoundingClientRect();
      const contentWidthSimple = rectSimple.width - 80 - 16;
      const deltaMouseXSimple = e.clientX - trimStartRef.current.x;
      const deltaTimeSimple =
        (deltaMouseXSimple / contentWidthSimple) * (duration || 1000);
      const MIN_CARD_MS = 600; // Keep every scene on screen at least ~0.6s.
      const initStart = trimStartRef.current.startTime;
      const initDur = trimStartRef.current.duration;
      let newStart = initStart;
      let newDur = initDur;
      if (trimEdge === "left") {
        newStart = Math.max(0, Math.min(initStart + initDur - MIN_CARD_MS, initStart + deltaTimeSimple));
        newDur = initDur - (newStart - initStart);
      } else {
        newDur = Math.max(MIN_CARD_MS, Math.min((duration || Infinity) - initStart, initDur + deltaTimeSimple));
      }
      setCanvasElements(prev =>
        prev.map(el => {
          if (el.id === trimElementId) {
            // Keep the scene's enter/exit animation window in sync with the
            // new clip duration — otherwise beatEnvelope fades the card out
            // at the *original* end time and the tail of an extended scene
            // renders invisible.
            return {
              ...el,
              startTime: newStart,
              duration: newDur,
              explainerSegmentDurationMs: newDur,
            };
          }
          if (
            element.explainerGraphicVariant !== undefined &&
            el.magicSceneExplainerStock &&
            el.explainerGraphicVariant === element.explainerGraphicVariant
          ) {
            return {
              ...el,
              startTime: newStart,
              duration: newDur,
              explainerSegmentDurationMs: newDur,
            };
          }
          return el;
        })
      );
      // When the user extends a non-cinema card, stretch the matching main-video
      // layout segment so the split / circle-pip window follows the card. Without
      // this the main video snaps back to full-frame (or the next segment's mode)
      // halfway through the newly extended scene.
      const origStart = trimStartRef.current.startTime;
      const origEnd = origStart + trimStartRef.current.duration;
      setCanvasElements(prev =>
        prev.map(el => {
          if (el.type !== 'video' || !el.magicLayoutSegments?.length) return el;
          const segs = el.magicLayoutSegments.slice();
          let matchIdx = segs.findIndex((s) => Math.abs(s.startMs - origStart) <= 250);
          if (matchIdx < 0) {
            matchIdx = segs.findIndex((s) => origStart >= s.startMs && origStart < s.endMs);
          }
          if (matchIdx < 0) return el;
          const seg = segs[matchIdx]!;
          const isCinema =
            element.explainerSceneStyle === 'subtitle-cinema';
          const newSegStart = isCinema ? seg.startMs : newStart;
          const newSegEnd = isCinema
            ? seg.endMs
            : Math.max(seg.endMs, newStart + newDur);
          if (newSegStart === seg.startMs && newSegEnd === seg.endMs) return el;
          segs[matchIdx] = { ...seg, startMs: newSegStart, endMs: newSegEnd };
          return { ...el, magicLayoutSegments: segs };
        })
      );
      return;
    }

    // Find the tracks container - it's the parent of the timeline tracks
    const tracksContainer = document.querySelector('.timeline-tracks-container')?.parentElement as HTMLElement;
    console.log('🔍 TRIM MOVE - Tracks container:', { found: !!tracksContainer });
    
    if (!tracksContainer) {
      console.log('❌ TRIM MOVE - Blocked: Tracks container not found');
      return;
    }

    const rect = tracksContainer.getBoundingClientRect();
    const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
    
    // Calculate delta from initial mouse position (use ref to avoid stale closure)
    const initialMouseX = trimStartRef.current.x;
    const deltaMouseX = e.clientX - initialMouseX;
    
    // Match mouse movement 1:1 - no sensitivity reduction
    const trimSensitivity = 1.0; // 1.0 = 100% sensitivity (mouse movement matches trim movement exactly)
    const deltaTime = (deltaMouseX / contentWidth) * (duration || 1000) * trimSensitivity;

    // Use initial element state from when trimming started (stored in ref) to prevent accumulation
    const initialStartTime = trimStartRef.current.startTime;
    const initialDuration = trimStartRef.current.duration;
    const initialVideoStartOffset = trimStartRef.current.videoStartOffset;

    console.log('📊 TRIM MOVE - Calculations:', {
      initialMouseX,
      currentMouseX: e.clientX,
      deltaMouseX,
      contentWidth,
      duration,
      trimSensitivity: 1.0,
      deltaTime,
      initialStartTime,
      initialDuration,
      initialVideoStartOffset
    });

    // Get video/audio element to check constraints (only for videos and audio)
    const video = element.type === "video" ? document.querySelector(`#canvas-video-${trimElementId}`) as HTMLVideoElement : null;
    const audio = element.type === "audio" ? document.querySelector(`#canvas-audio-${trimElementId}`) as HTMLAudioElement : null;
    
    // Get actual video/audio duration - prioritize stored original duration, fallback to DOM element
    let maxVideoDuration = Infinity;
    let maxAudioDuration = Infinity;
    
    // First, try to get from stored original duration (most reliable)
    const storedOriginalDuration = originalMediaDurationsRef.current.get(trimElementId);
    if (storedOriginalDuration && storedOriginalDuration > 0) {
      if (element.type === "video") {
        maxVideoDuration = storedOriginalDuration;
      } else if (element.type === "audio") {
        maxAudioDuration = storedOriginalDuration;
      }
    }
    
    // Fallback: try to get from DOM element if stored value not available
    if (element.type === "video" && video && maxVideoDuration === Infinity) {
      if (video.duration && video.duration > 0 && !isNaN(video.duration)) {
        maxVideoDuration = video.duration * 1000;
        // Store it for future use
        originalMediaDurationsRef.current.set(trimElementId, maxVideoDuration);
      }
    }
    
    if (element.type === "audio" && audio && maxAudioDuration === Infinity) {
      if (audio.duration && audio.duration > 0 && !isNaN(audio.duration)) {
        maxAudioDuration = audio.duration * 1000;
        // Store it for future use
        originalMediaDurationsRef.current.set(trimElementId, maxAudioDuration);
      }
    }
    
    const isImage = element.type === "image";
    const isAudio = element.type === "audio";
    const maxMediaDuration = isAudio ? maxAudioDuration : maxVideoDuration;
    
    console.log('🎥 TRIM MOVE - Element:', { 
      type: element.type,
      elementId: trimElementId,
      found: !!video || !!audio, 
      videoDuration: video?.duration, 
      audioDuration: audio?.duration,
      storedOriginalDuration,
      maxVideoDuration,
      maxAudioDuration,
      maxMediaDuration,
      isImage,
      isAudio,
      hasValidDuration: maxMediaDuration !== Infinity
    });
    
    // CRITICAL: If we can't get the actual duration, we can't enforce hard stops
    // Log a warning but don't block - this should be rare
    if (!isImage && maxMediaDuration === Infinity) {
      console.warn('⚠️ TRIM MOVE - Cannot enforce hard stops: video/audio duration not available');
      console.warn('⚠️ This might allow extending beyond original duration. Video/Audio might not be loaded yet.');
    }

    if (trimEdge === 'left') {
      console.log('⬅️ TRIM MOVE - Left edge trim');
      // Trimming left edge: move startTime forward, decrease duration
      // For videos: also increase videoStartOffset
      // For audio: also increase audioStartOffset
      // For images: no offset
      // Calculate from initial state to prevent accumulation
      const initialAudioStartOffset = trimStartRef.current.audioStartOffset || 0;
      let newStartTime = Math.max(0, initialStartTime + deltaTime);
      let newDuration = Math.max(100, initialDuration - deltaTime); // Min 100ms
      let newVideoStartOffset = isImage ? 0 : (isAudio ? 0 : Math.max(0, initialVideoStartOffset + deltaTime));
      let newAudioStartOffset = isImage ? 0 : (isAudio ? Math.max(0, initialAudioStartOffset + deltaTime) : 0);
      
      // HARD STOP: Prevent dragging beyond original video/audio duration
      // If trim would exceed original length, don't allow the drag to work at all
      if (!isImage && maxMediaDuration !== Infinity) {
        if (isAudio) {
          const wouldExceed = newAudioStartOffset + newDuration > maxAudioDuration;
          if (wouldExceed) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original audio duration');
            return;
          }
        } else {
          const wouldExceed = newVideoStartOffset + newDuration > maxVideoDuration;
          if (wouldExceed) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original video duration');
            return;
          }
        }
      }
      
      // Don't extend past the previous clip's end (add-back is limited by adjacent clip)
      const prevClips = canvasElements.filter(el =>
        el.id !== trimElementId && (el.type === "video" || el.type === "image" || el.type === "audio") &&
        (el.startTime || 0) + (el.duration || 5000) <= initialStartTime + 50
      );
      const prevEnd = prevClips.length ? Math.max(...prevClips.map(el => (el.startTime || 0) + (el.duration || 5000))) : 0;
      newStartTime = Math.max(newStartTime, prevEnd);
      newDuration = Math.max(100, initialStartTime + initialDuration - newStartTime);
      // When extending left we show more from start of media, so offset decreases
      if (!isImage && !isAudio) newVideoStartOffset = Math.max(0, initialVideoStartOffset - (initialStartTime - newStartTime));
      if (isAudio) newAudioStartOffset = Math.max(0, initialAudioStartOffset - (initialStartTime - newStartTime));
      // Clamp to media duration after adjacent-clip cap
      if (!isImage && maxMediaDuration !== Infinity) {
        if (isAudio) {
          const maxDur = maxAudioDuration - newAudioStartOffset;
          if (newDuration > maxDur) newDuration = Math.max(100, maxDur);
        } else {
          const maxDur = maxVideoDuration - newVideoStartOffset;
          if (newDuration > maxDur) newDuration = Math.max(100, maxDur);
        }
      }
      
      console.log('📐 TRIM MOVE - Left edge values (after clamping):', {
        newStartTime,
        newDuration,
        newVideoStartOffset,
        maxVideoDuration,
        sum: newVideoStartOffset + newDuration
      });
      
      // Constraints:
      // 1. Timeline: newStartTime >= 0 (can't go before timeline start)
      // 2. Timeline: newStartTime + newDuration <= total duration (but allow slight overflow for better UX)
      // 3. Media: newVideoStartOffset + newDuration <= media file duration (for videos), or newDuration <= audio file duration (for audio)
      // 4. Minimum duration: 100ms
      // 5. Non-negative offset (only for videos)
      const constraint1 = newStartTime >= 0;
      // For audio, allow trimming even if element extends slightly beyond timeline
      // This allows trimming from left even when element is at the end
      const maxAllowedEnd = isAudio ? duration * 1.1 : duration; // Allow 10% overflow for audio
      const constraint2 = newStartTime + newDuration <= maxAllowedEnd;
      const constraint3 = newDuration >= 100;
      const constraint4 = (isImage || isAudio) || newVideoStartOffset >= 0; // Always true for images and audio
      const constraint5 = (isImage || isAudio) || maxVideoDuration === Infinity || (newVideoStartOffset + newDuration <= maxVideoDuration);
      // For audio, check that audioStartOffset + duration doesn't exceed audio file duration
      // But if audio hasn't loaded yet (maxAudioDuration is Infinity), allow it
      const constraint6 = isAudio ? (maxAudioDuration === Infinity || (newAudioStartOffset + newDuration <= maxAudioDuration)) : true;
      
      console.log('✅ TRIM MOVE - Left edge constraints:', {
        constraint1,
        constraint2,
        constraint3,
        constraint4,
        constraint5,
        constraint6,
        allPass: constraint1 && constraint2 && constraint3 && constraint4 && constraint5 && constraint6,
        newStartTimePlusDuration: newStartTime + newDuration,
        totalDuration: duration,
        videoOffsetPlusDuration: newVideoStartOffset + newDuration,
        maxVideoDuration,
        maxAudioDuration,
        isImage,
        isAudio
      });
      
      // Calculate trimmed seconds (only meaningful for videos and audio)
      if (isAudio) {
        const originalAudioDuration = maxAudioDuration !== Infinity ? maxAudioDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const audioStartSeconds = (newAudioStartOffset / 1000).toFixed(2);
        const audioEndSeconds = ((newAudioStartOffset + newDuration) / 1000).toFixed(2);
        
        console.log('✂️ TRIM INFO - Left Edge (Audio):', {
          'Audio start (in file)': `${audioStartSeconds}s`,
          'Audio end (in file)': `${audioEndSeconds}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Original audio duration': `${originalAudioDuration.toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else if (!isImage) {
        const trimmedFromStart = (newVideoStartOffset / 1000).toFixed(2);
        const originalVideoDuration = maxVideoDuration !== Infinity ? maxVideoDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const trimmedFromEnd = maxVideoDuration !== Infinity 
          ? ((maxVideoDuration - newVideoStartOffset - newDuration) / 1000).toFixed(2)
          : '0.00';
        
        console.log('✂️ TRIM INFO - Left Edge (Video):', {
          'Trimmed from start': `${trimmedFromStart}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Trimmed from end': `${trimmedFromEnd}s`,
          'Original video duration': `${originalVideoDuration.toFixed(2)}s`,
          'Video start offset': `${(newVideoStartOffset / 1000).toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else {
        console.log('✂️ TRIM INFO - Left Edge (Image):', {
          'Start time': `${(newStartTime / 1000).toFixed(2)}s`,
          'Duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      }
      
      // Check for nearby elements to show overlap indicator
      const newEndTime = newStartTime + newDuration;
      const nearbyElements = canvasElements.filter(el => 
        el.id !== trimElementId && 
        (el.type === "video" || el.type === "image" || el.type === "audio" || el.type === "text")
      );
      
      let closestOverlap: { time: number; type: 'start' | 'end' } | null = null;
      let minDistance = Infinity;
      
      nearbyElements.forEach(otherEl => {
        const otherStart = otherEl.startTime || 0;
        const otherEnd = otherStart + (otherEl.duration || 5000);
        
        // Check distance from new start time to other element's start
        const distanceToOtherStartFromNewStart = Math.abs(newStartTime - otherStart);
        if (distanceToOtherStartFromNewStart < 500 && distanceToOtherStartFromNewStart < minDistance) {
          minDistance = distanceToOtherStartFromNewStart;
          closestOverlap = { time: otherStart, type: 'start' };
        }
        
        // Check distance from new start time to other element's end
        const distanceToOtherEndFromNewStart = Math.abs(newStartTime - otherEnd);
        if (distanceToOtherEndFromNewStart < 500 && distanceToOtherEndFromNewStart < minDistance) {
          minDistance = distanceToOtherEndFromNewStart;
          closestOverlap = { time: otherEnd, type: 'end' };
        }
        
        // Check distance from new end time to other element's start
        const distanceToOtherStartFromNewEnd = Math.abs(newEndTime - otherStart);
        if (distanceToOtherStartFromNewEnd < 500 && distanceToOtherStartFromNewEnd < minDistance) {
          minDistance = distanceToOtherStartFromNewEnd;
          closestOverlap = { time: otherStart, type: 'start' };
        }
        
        // Check distance from new end time to other element's end
        const distanceToOtherEndFromNewEnd = Math.abs(newEndTime - otherEnd);
        if (distanceToOtherEndFromNewEnd < 500 && distanceToOtherEndFromNewEnd < minDistance) {
          minDistance = distanceToOtherEndFromNewEnd;
          closestOverlap = { time: otherEnd, type: 'end' };
        }
      });
      
      setTrimOverlapIndicator(closestOverlap);
      
      if (constraint1 && constraint2 && constraint3 && constraint4 && constraint5 && constraint6) {
        // Update offsets for videos and audio, not images
        const updates: Partial<CanvasElement> = {
          startTime: newStartTime,
          duration: newDuration
        };
        if (!isImage && !isAudio) {
          updates.videoStartOffset = newVideoStartOffset;
        } else if (isAudio) {
          updates.audioStartOffset = newAudioStartOffset;
        }
        console.log('✅ TRIM MOVE - Updating element (LEFT):', {
          trimElementId,
          updates
        });
        updateCanvasElement(trimElementId, updates);
        console.log('✅ TRIM MOVE - Element updated successfully (LEFT)');
      } else {
        console.log('❌ TRIM MOVE - Constraints failed (LEFT), not updating');
      }
    } else if (trimEdge === 'right') {
      console.log('➡️ TRIM MOVE - Right edge trim');
      // Trimming right edge: change duration only (no change to videoStartOffset or startTime)
      // Calculate from initial state to prevent accumulation
      let newDuration = Math.max(100, initialDuration + deltaTime); // Min 100ms
      
      // HARD STOP: Prevent dragging beyond original video/audio duration
      // If trim would exceed original length, don't allow the drag to work at all
      if (!isImage && maxMediaDuration !== Infinity) {
        if (isAudio) {
          const initialAudioStartOffset = trimStartRef.current.audioStartOffset || 0;
          if (initialAudioStartOffset + newDuration > maxAudioDuration) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original audio duration');
            return;
          }
        } else {
          if (initialVideoStartOffset + newDuration > maxVideoDuration) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original video duration');
            return;
          }
        }
      }
      
      // Don't extend past the next clip's start (add-back is limited by adjacent clip)
      const nextClips = canvasElements.filter(el =>
        el.id !== trimElementId && (el.type === "video" || el.type === "image" || el.type === "audio") &&
        (el.startTime || 0) >= initialStartTime + initialDuration - 50
      );
      const nextStart = nextClips.length ? Math.min(...nextClips.map(el => el.startTime || 0)) : duration;
      const maxEndTime = Math.min(duration, nextStart);
      newDuration = Math.min(newDuration, Math.max(100, maxEndTime - initialStartTime));
      
      console.log('📐 TRIM MOVE - Right edge values:', {
        newDuration,
        initialVideoStartOffset,
        maxVideoDuration,
        maxAudioDuration,
        isImage,
        isAudio,
        maxAllowedDuration: isImage ? Infinity : (isAudio ? (maxAudioDuration - (trimStartRef.current.audioStartOffset || 0)) : (maxVideoDuration - initialVideoStartOffset))
      });
      
      // Constraints:
      // 1. Timeline: initialStartTime + newDuration <= total duration
      // 2. Minimum duration: 100ms
      // 3. HARD STOP: videoStartOffset + newDuration <= original video duration (for videos)
      // 4. HARD STOP: audioStartOffset + newDuration <= original audio duration (for audio)
      const constraint1 = initialStartTime + newDuration <= duration;
      const constraint2 = newDuration >= 100;
      const constraint3 = (isImage || isAudio) || maxVideoDuration === Infinity || (initialVideoStartOffset + newDuration <= maxVideoDuration);
      const constraint4 = isAudio ? (maxAudioDuration === Infinity || ((trimStartRef.current.audioStartOffset || 0) + newDuration <= maxAudioDuration)) : true;
      
      console.log('✅ TRIM MOVE - Right edge constraints:', {
        constraint1,
        constraint2,
        constraint3,
        constraint4,
        allPass: constraint1 && constraint2 && constraint3 && constraint4,
        initialStartTimePlusDuration: initialStartTime + newDuration,
        totalDuration: duration,
        newDuration,
        maxVideoDuration,
        maxAudioDuration,
        isImage,
        isAudio
      });
      
      // Calculate trimmed seconds (only meaningful for videos and audio)
      if (isAudio) {
        const originalAudioDuration = maxAudioDuration !== Infinity ? maxAudioDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const initialAudioStartOffset = trimStartRef.current.audioStartOffset || 0;
        const audioStartSeconds = (initialAudioStartOffset / 1000).toFixed(2);
        const audioEndSeconds = ((initialAudioStartOffset + newDuration) / 1000).toFixed(2);
        
        console.log('✂️ TRIM INFO - Right Edge (Audio):', {
          'Audio start (in file)': `${audioStartSeconds}s`,
          'Audio end (in file)': `${audioEndSeconds}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Original audio duration': `${originalAudioDuration.toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else if (!isImage) {
        const trimmedFromStart = (initialVideoStartOffset / 1000).toFixed(2);
        const originalVideoDuration = maxVideoDuration !== Infinity ? maxVideoDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const trimmedFromEnd = maxVideoDuration !== Infinity 
          ? ((maxVideoDuration - initialVideoStartOffset - newDuration) / 1000).toFixed(2)
          : '0.00';
        
        console.log('✂️ TRIM INFO - Right Edge (Video):', {
          'Trimmed from start': `${trimmedFromStart}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Trimmed from end': `${trimmedFromEnd}s`,
          'Original video duration': `${originalVideoDuration.toFixed(2)}s`,
          'Video start offset': `${(initialVideoStartOffset / 1000).toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else {
        console.log('✂️ TRIM INFO - Right Edge (Image):', {
          'Start time': `${(initialStartTime / 1000).toFixed(2)}s`,
          'Duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      }
      
      // Check for nearby elements to show overlap indicator
      const newEndTime = initialStartTime + newDuration;
      const nearbyElements = canvasElements.filter(el => 
        el.id !== trimElementId && 
        (el.type === "video" || el.type === "image" || el.type === "audio" || el.type === "text")
      );
      
      let closestOverlap: { time: number; type: 'start' | 'end' } | null = null;
      let minDistance = Infinity;
      
      nearbyElements.forEach(otherEl => {
        const otherStart = otherEl.startTime || 0;
        const otherEnd = otherStart + (otherEl.duration || 5000);
        
        // Check distance from new end time to other element's start
        const distanceToOtherStart = Math.abs(newEndTime - otherStart);
        if (distanceToOtherStart < 500 && distanceToOtherStart < minDistance) { // Within 500ms
          minDistance = distanceToOtherStart;
          closestOverlap = { time: otherStart, type: 'start' };
        }
        
        // Check distance from new end time to other element's end
        const distanceToOtherEnd = Math.abs(newEndTime - otherEnd);
        if (distanceToOtherEnd < 500 && distanceToOtherEnd < minDistance) {
          minDistance = distanceToOtherEnd;
          closestOverlap = { time: otherEnd, type: 'end' };
        }
      });
      
      setTrimOverlapIndicator(closestOverlap);
      
      if (constraint1 && constraint2 && constraint3 && constraint4) {
        console.log('✅ TRIM MOVE - Updating element (RIGHT):', {
          trimElementId,
          updates: { duration: newDuration }
        });
        updateCanvasElement(trimElementId, {
          duration: newDuration
        });
        console.log('✅ TRIM MOVE - Element updated successfully (RIGHT)');
      } else {
        console.log('❌ TRIM MOVE - Constraints failed (RIGHT), not updating');
      }
    }
  };

  // Handle timeline trim mouse up
  const handleTimelineTrimUp = () => {
    console.log('🖱️ TRIM UP - Ending trim operation');
    setIsTrimming(false);
    setTrimElementId(null);
    setTrimEdge(null);
    setTrimOverlapIndicator(null); // Clear overlap indicator
    console.log('✅ TRIM UP - Trim state cleared');
  };

  // Handle timeline drag move (for moving videos and images on timeline)
  const handleTimelineDragMove = (e: MouseEvent) => {
    if (!isDraggingTimeline || !draggingTimelineElementId) return;

    const element = canvasElements.find(el => el.id === draggingTimelineElementId);
    if (!element) return;
    const isExplainerCard = element.type === "text" && !!element.magicSceneExplainer;
    if (
      element.type !== "video" &&
      element.type !== "image" &&
      element.type !== "audio" &&
      !isExplainerCard
    ) {
      return;
    }

    // Find the tracks container - it's the parent of the timeline tracks
    const tracksContainer = document.querySelector('.timeline-tracks-container')?.parentElement as HTMLElement;
    if (!tracksContainer) return;

    const rect = tracksContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 80; // Account for track controls width (80px)
    const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
    const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
    const newTime = (percentage / 100) * (duration || 1000);

    // Calculate new startTime based on drag delta
    const deltaX = e.clientX - dragTimelineStart.x;
    const deltaTime = (deltaX / contentWidth) * (duration || 1000);
    const elementDuration = element.duration || 5000;
    
    // Calculate new startTime, but clamp it so the element doesn't go before 00:00
    let newStartTime = dragTimelineStart.startTime + deltaTime;
    
    // Clamp to ensure element doesn't go before timeline start (00:00)
    const maxStartTime = duration; // Allow dragging to the end of timeline
    const minStartTime = 0; // Don't allow dragging before 00:00
    
    newStartTime = Math.max(minStartTime, Math.min(maxStartTime, newStartTime));
    
    // Explainer scene cards (type === "text" + magicSceneExplainer) have no backing
    // media file, so skip every constraint based on original video/audio duration.
    if (isExplainerCard) {
      const prevStart = element.startTime || 0;
      const shift = newStartTime - prevStart;
      // Move the card and keep its paired stock-image companion in lock-step so
      // the illustration stays glued to the scene window visually.
      setCanvasElements(prev =>
        prev.map(el => {
          if (el.id === draggingTimelineElementId) {
            return { ...el, startTime: newStartTime };
          }
          if (
            element.explainerGraphicVariant !== undefined &&
            el.magicSceneExplainerStock &&
            el.explainerGraphicVariant === element.explainerGraphicVariant
          ) {
            return {
              ...el,
              startTime: Math.max(0, (el.startTime || 0) + shift),
            };
          }
          return el;
        })
      );
      return;
    }

    // HARD STOP: Ensure video/audio doesn't exceed original duration even after moving
    // Get video/audio element to check original duration - prioritize stored duration
    const video = element.type === "video" ? document.querySelector(`#canvas-video-${draggingTimelineElementId}`) as HTMLVideoElement : null;
    const audio = element.type === "audio" ? document.querySelector(`#canvas-audio-${draggingTimelineElementId}`) as HTMLAudioElement : null;
    
    // Get original duration from stored ref first, then fallback to DOM element
    const storedOriginalDuration = originalMediaDurationsRef.current.get(draggingTimelineElementId);
    let maxVideoDuration = storedOriginalDuration && element.type === "video" ? storedOriginalDuration : Infinity;
    let maxAudioDuration = storedOriginalDuration && element.type === "audio" ? storedOriginalDuration : Infinity;
    
    // Fallback to DOM element if stored value not available
    if (element.type === "video" && video && maxVideoDuration === Infinity) {
      if (video.duration && video.duration > 0 && !isNaN(video.duration)) {
        maxVideoDuration = video.duration * 1000;
        originalMediaDurationsRef.current.set(draggingTimelineElementId, maxVideoDuration);
      }
    }
    if (element.type === "audio" && audio && maxAudioDuration === Infinity) {
      if (audio.duration && audio.duration > 0 && !isNaN(audio.duration)) {
        maxAudioDuration = audio.duration * 1000;
        originalMediaDurationsRef.current.set(draggingTimelineElementId, maxAudioDuration);
      }
    }
    
    const isImage = element.type === "image";
    const isAudio = element.type === "audio";
    
    // Check if current videoStartOffset + duration would exceed original video duration
    // Moving the video doesn't change videoStartOffset or duration, but we need to ensure
    // the constraint is still valid after the move
    if (!isImage && (maxVideoDuration !== Infinity || maxAudioDuration !== Infinity)) {
      const currentVideoStartOffset = element.videoStartOffset || 0;
      const currentAudioStartOffset = element.audioStartOffset || 0;
      const currentDuration = element.duration || 5000;
      
      if (isAudio) {
        // For audio: ensure audioStartOffset + duration doesn't exceed original audio duration
        if (currentAudioStartOffset + currentDuration > maxAudioDuration) {
          console.log('❌ DRAG MOVE - Blocked: Audio would exceed original duration', {
            currentAudioStartOffset,
            currentDuration,
            maxAudioDuration,
            sum: currentAudioStartOffset + currentDuration
          });
          return; // Don't allow drag - element is already at max
        }
      } else {
        // For videos: ensure videoStartOffset + duration doesn't exceed original video duration
        if (currentVideoStartOffset + currentDuration > maxVideoDuration) {
          console.log('❌ DRAG MOVE - Blocked: Video would exceed original duration', {
            currentVideoStartOffset,
            currentDuration,
            maxVideoDuration,
            sum: currentVideoStartOffset + currentDuration
          });
          return; // Don't allow drag - element is already at max
        }
      }
    }
    
      updateCanvasElement(draggingTimelineElementId, {
        startTime: newStartTime
      });
  };

  // Handle timeline drag mouse up
  const handleTimelineDragUp = () => {
    setIsDraggingTimeline(false);
    setDraggingTimelineElementId(null);
  };

  // -- Circle-resize drag handlers -------------------------------------------
  // The bottom-right handle on the selected circle-pip segment drives this.
  // We translate horizontal mouse movement into a scale multiplier on the
  // segment's `circleScale`, clamped to 0.4–1.2.
  const handleCircleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizingCircle || selectedLayoutSegmentIdx === null) return;
      const start = circleResizeStartRef.current;
      if (!start) return;
      // Use the rendered canvas width to translate pixels into scale: the circle
      // grows from ~24% of canvas width at scale 0.4 to ~100% at scale ~1.2.
      const deltaX = e.clientX - start.x;
      const deltaY = e.clientY - start.y;
      const delta = (deltaX + deltaY) / 2; // average diagonal drag
      const pxPerScaleUnit = Math.max(80, start.canvasWidth * 0.5); // tuned for gentle resize
      const nextScale = Math.max(0.4, Math.min(1.2, start.scale + delta / pxPerScaleUnit));
      updateMagicLayoutSegment(selectedLayoutSegmentIdx, { circleScale: nextScale });
    },
    [isResizingCircle, selectedLayoutSegmentIdx, updateMagicLayoutSegment]
  );

  const handleCircleResizeUp = useCallback(() => {
    setIsResizingCircle(false);
    circleResizeStartRef.current = null;
  }, []);

  useEffect(() => {
    if (!isResizingCircle) return;
    window.addEventListener("mousemove", handleCircleResizeMove);
    window.addEventListener("mouseup", handleCircleResizeUp);
    return () => {
      window.removeEventListener("mousemove", handleCircleResizeMove);
      window.removeEventListener("mouseup", handleCircleResizeUp);
    };
  }, [isResizingCircle, handleCircleResizeMove, handleCircleResizeUp]);

  // Handle playhead drag move
  const handlePlayheadDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPlayhead) return;

    // Find the time ruler container - it has pl-20 (80px padding) for track controls
    const timeRuler = document.querySelector('.h-6.border-b.border-gray-200.bg-white')?.querySelector('.flex.items-center.h-full') as HTMLElement;
    if (!timeRuler) {
      // Fallback: find any time ruler
      const fallback = document.querySelector('.h-6.border-b.border-gray-200') as HTMLElement;
      if (!fallback) return;
      const rect = fallback.getBoundingClientRect();
      const clickX = e.clientX - rect.left - 80; // Subtract 80px for track controls
      const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
      const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
      const newTime = (percentage / 100) * (duration || 1000);
      handleTimelineScrub(newTime);
      return;
    }

    const rect = timeRuler.getBoundingClientRect();
    // The time ruler has pl-20 (80px padding), so we need to account for that
    const clickX = e.clientX - rect.left - 80; // Subtract 80px for track controls (pl-20)
    const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
    const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
    const newTime = (percentage / 100) * (duration || 1000);
    
    handleTimelineScrub(newTime);
  }, [isDraggingPlayhead, duration]);

  // Handle playhead drag up
  const handlePlayheadDragUp = () => {
    setIsDraggingPlayhead(false);
  };

  // Add event listeners for timeline trimming
  useEffect(() => {
    console.log('🎧 TRIM EFFECT - Setup:', { isTrimming, trimElementId, trimEdge });
    if (isTrimming) {
      console.log('✅ TRIM EFFECT - Adding event listeners');
      const handleMove = (e: MouseEvent) => handleTimelineTrimMove(e);
      const handleUp = () => handleTimelineTrimUp();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      return () => {
        console.log('🧹 TRIM EFFECT - Removing event listeners');
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    } else {
      console.log('⏸️ TRIM EFFECT - Not trimming, no listeners added');
    }
  }, [isTrimming, trimElementId, trimEdge, canvasElements, duration]);

  // Add event listeners for timeline dragging
  useEffect(() => {
    if (isDraggingTimeline) {
      window.addEventListener('mousemove', handleTimelineDragMove);
      window.addEventListener('mouseup', handleTimelineDragUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineDragMove);
        window.removeEventListener('mouseup', handleTimelineDragUp);
      };
    }
  }, [isDraggingTimeline, draggingTimelineElementId, dragTimelineStart, canvasElements, duration]);

  // Add event listeners for playhead dragging
  useEffect(() => {
    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handlePlayheadDragMove);
      window.addEventListener('mouseup', handlePlayheadDragUp);
      return () => {
        window.removeEventListener('mousemove', handlePlayheadDragMove);
        window.removeEventListener('mouseup', handlePlayheadDragUp);
      };
    }
  }, [isDraggingPlayhead, duration, handlePlayheadDragMove]);

  // Handle timeline resize
  const handleTimelineResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingTimeline) return;
    
    const deltaY = resizeStart.y - e.clientY; // Negative because we're dragging up
    const newHeight = Math.max(160, Math.min(window.innerHeight * 0.8, resizeStart.height + deltaY));
    setTimelineHeight(newHeight);
  }, [isResizingTimeline, resizeStart]);

  const handleTimelineResizeUp = useCallback(() => {
    setIsResizingTimeline(false);
  }, []);

  // Add event listeners for timeline resizing
  useEffect(() => {
    if (isResizingTimeline) {
      window.addEventListener('mousemove', handleTimelineResizeMove);
      window.addEventListener('mouseup', handleTimelineResizeUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineResizeMove);
        window.removeEventListener('mouseup', handleTimelineResizeUp);
      };
    }
  }, [isResizingTimeline, handleTimelineResizeMove, handleTimelineResizeUp]);

  // Handle canvas click (deselect)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedElementId(null);
      setContextMenuElementId(null);
    }
  };

  // Handle canvas drop
  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    
    try {
      const assetData = e.dataTransfer.getData('asset');
      if (assetData) {
        const asset: Asset = JSON.parse(assetData);
        if (asset.type === "video" || asset.type === "image") {
          const rect = canvasRef.current.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          
          // For video/image, make it fit the canvas (9:16)
          let width = 30;
          let height = 30;
          let finalX = Math.max(0, Math.min(100 - 30, x - 15));
          let finalY = Math.max(0, Math.min(100 - 30, y - 15));
          
          if (asset.type === "video" || asset.type === "image") {
            width = 90;
            height = 90;
            finalX = 5; // Center: (100 - 90) / 2
            finalY = 5; // Center: (100 - 90) / 2
          }
          
          // Calculate default timeline position
          // For videos: start after the last video ends
          // For other elements: start at current playhead
          let defaultStartTime: number;
          if (asset.type === "video") {
            const videoElements = canvasElements.filter(el => el.type === "video");
            if (videoElements.length === 0) {
              defaultStartTime = 0;
            } else {
              const endTimes = videoElements.map(el => {
                const startTime = el.startTime || 0;
                // Use actual duration if available
                const duration = el.duration || 5000;
                return startTime + duration;
              });
              defaultStartTime = Math.max(...endTimes);
            }
          } else {
            defaultStartTime = currentTime || 0;
          }
          
          // Get actual video duration for videos, default for others
          let defaultDuration = (asset.type === "image") ? 5000 : (asset.type === "video" ? 5000 : 3000);
          
          // Generate thumbnail and get duration for videos/images
          let thumbnail: string | undefined;
          if (asset.type === "video" && asset.url) {
            try {
              // Get both thumbnail and duration in parallel
              const [thumb, duration] = await Promise.all([
                generateVideoThumbnail(asset.url).catch(() => asset.url),
                getVideoDuration(asset.url).catch(() => 5000)
              ]);
              thumbnail = thumb;
              defaultDuration = duration; // Use actual video duration
            } catch (error) {
              console.error("Failed to get video metadata:", error);
              thumbnail = asset.url;
              defaultDuration = 5000; // Fallback duration
            }
          } else if (asset.type === "image" && asset.url) {
            thumbnail = asset.url;
          }
          
          const newElement: CanvasElement = {
            id: uuid(),
            type: asset.type,
            url: asset.url,
            x: finalX,
            y: finalY,
            width,
            height,
            rotation: 0,
            opacity: 1,
            zIndex: canvasElements.length,
            // Image panning (default center position)
            imageOffsetX: asset.type === "image" ? 50 : undefined,
            imageOffsetY: asset.type === "image" ? 50 : undefined,
      // Timeline properties (TEMPORAL - independent from canvas position)
      startTime: defaultStartTime,
      duration: defaultDuration, // Use actual video duration for videos
      thumbnail,
      // Audio: videos are unmuted by default (can be muted individually via timeline)
      muted: asset.type === "video" ? false : undefined,
    };
          
          // Ensure project exists before adding element
          await ensureProjectExists();
          
          setCanvasElements([...canvasElements, newElement]);
          setSelectedElementId(newElement.id);
        }
      }
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex h-full w-full flex-col bg-white overflow-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Top Header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b bg-white px-4 relative z-50">
        <div className="flex items-center gap-4">
          {currentProject ? (
            isEditingProjectTitle ? (
              <Input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                onBlur={async () => {
                  if (projectTitle.trim() && projectTitle !== currentProject.title) {
                    try {
                      await updateUGCProject(currentProject.id, { title: projectTitle.trim() });
                      setCurrentProject({ ...currentProject, title: projectTitle.trim() });
                    } catch (error: any) {
                      console.error('[Rename] Error renaming project:', error);
                      alert(`Failed to rename project: ${error.message}`);
                      setProjectTitle(currentProject.title);
                    }
                  } else {
                    setProjectTitle(currentProject.title);
                  }
                  setIsEditingProjectTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setProjectTitle(currentProject.title);
                    setIsEditingProjectTitle(false);
                  }
                }}
                className="w-64 h-8 text-sm font-semibold border-gray-300 focus:border-blue-500"
                autoFocus
              />
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                onClick={() => {
                  setProjectTitle(currentProject.title);
                  setIsEditingProjectTitle(true);
                }}
                title="Click to rename project"
              >
                <span className="text-sm font-semibold text-gray-900">
                  {currentProject.title || currentProject.id}
                </span>
                <span className="text-xs text-gray-500">({currentProject.id})</span>
              </div>
            )
          ) : (
            <div className="text-sm text-gray-500 font-semibold">
              No Project
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={togglePlayback} className="h-8 w-8 p-0">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Hand className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={magicExplainerSlowAnimations ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1 px-2"
            onClick={() => setMagicExplainerSlowAnimations((v) => !v)}
            title="Slow down explainer text animations (word-by-word + beat fade)"
          >
            <Snail className="h-4 w-4 shrink-0" />
            <span className="hidden text-xs text-gray-700 sm:inline">Slow anim</span>
          </Button>
          <div className="text-xs text-gray-600">{zoom}%</div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 text-xs text-white hover:from-violet-700 hover:to-fuchsia-700"
            onClick={() => {
              if (!magicCreateScript.trim()) {
                setMagicCreateScript(MAGIC_CREATE_SAMPLE_SCRIPT);
              }
              setMagicCreateOpen(true);
            }}
            title="Magic create: pick main video from Media; B-roll from Freepik for the first 3s split only; then centered circle + caption bar."
          >
            <Sparkles className="h-3.5 w-3.5" />
            Magic create
          </Button>
          {/* Save Button - Always visible */}
          <Button 
            size="sm" 
            variant="outline"
            className={`h-8 text-xs relative z-10 ${!currentProject ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Save] Button clicked, currentProject:', !!currentProject, currentProject?.id);
              if (!currentProject) {
                alert('No project found. Please create a project first by selecting an avatar.');
                return;
              }
              try {
                await handleSaveProject();
              } catch (error) {
                console.error('[Save] Error in onClick handler:', error);
                // Error already handled in handleSaveProject, but log it here too
              }
            }}
            title={currentProject ? "Save Project (Ctrl+S)" : "Create a project first by selecting an avatar"}
            type="button"
          >
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          {exportedVideoUrl ? (
            <Button 
              size="sm" 
              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Download Button] Clicked, exportedVideoUrl state:', exportedVideoUrl);
                console.log('[Download Button] exportedVideoUrlRef.current:', exportedVideoUrlRef.current);
                // Always use the ref value which is guaranteed to be latest
                const latestUrl = exportedVideoUrlRef.current || exportedVideoUrl;
                console.log('[Download Button] Will download from:', latestUrl);
                await handleDownloadVideo();
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Download Video
            </Button>
          ) : (
            <Button 
              size="sm" 
              className="h-8 text-xs"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Export] Button clicked, isExporting:', isExporting, 'canvasElements:', canvasElements.length);
                // Always call handleExportVideo - it has its own guard for isExporting
                // This ensures the function is called even if state appears stale
                await handleExportVideo();
            }}
            disabled={isExporting || canvasElements.length === 0}
          >
              {isExporting || renderStatus === 'RENDERING' || renderStatus === 'QUEUED' ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {renderStatus === 'QUEUED' ? 'Queued...' : renderStatus === 'RENDERING' ? `Rendering... ${renderProgress}%` : 'Exporting...'}
              </>
            ) : (
              'Export'
            )}
          </Button>
          )}
        </div>
        
        {/* Render Progress Bar - Show when rendering */}
        {renderStatus && renderStatus !== null && (
          <div className="flex flex-1 flex-col gap-2 px-4">
            <div className="flex items-center gap-2">
              <Progress value={renderProgress} className="h-2 rounded-full bg-muted flex-1" />
              {(renderStatus === "QUEUED" || renderStatus === "RENDERING") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    router.push('/app/render-queue');
                  }}
                >
                  View Render Queue
          </Button>
              )}
        </div>
            <span className={`text-xs ${
              renderStatus === "FAILED" ? "text-destructive font-medium" 
              : renderStatus === "READY" ? "text-green-600 font-medium"
              : "text-muted-foreground"
            }`}>
              {renderStatus === "RENDERING" && renderProgress > 0
                ? `Rendering... ${Math.round(renderProgress)}%`
                : renderStatus === "QUEUED"
                ? `Queued - Starting render...`
                : renderStatus === "FAILED" 
                ? "Failed - Try again" 
                : renderStatus === "READY" && exportedVideoUrl
                ? "Ready - Click Download"
                : renderStatus ?? "IDLE"}
            </span>
      </div>
        )}
          </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar - Main App Style */}
        <div className="w-64 flex-shrink-0 rounded-3xl border border-border/60 bg-white/70 p-6 shadow-xl shadow-primary/5 backdrop-blur-xl flex flex-col overflow-hidden">
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-2 min-h-0 flex flex-col gap-2">
            {sidebarSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSidebarSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    if (section.id === "avatars") {
                      setCreatingProjectFromAvatar(false);
                      setAvatarNextError(null);
                      setAvatarsDialogOpen(true);
                    } else {
                      setActiveSidebarSection(section.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Content Area for Selected Section */}
          {activeSidebarSection === "captions" && (
            <div className="border-t border-border/60 flex flex-col overflow-hidden" style={{ height: "40%", minHeight: 0, maxHeight: "40%" }}>
              <ScrollArea className="h-full w-full">
                <div className="p-3 space-y-3 pb-4">
                  {/* Generate Subtitles Button */}
                  <Button
                    onClick={handleGenerateSubtitles}
                    disabled={isGeneratingSubtitles || canvasElements.filter(el => el.type === 'video' && el.url).length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    {isGeneratingSubtitles ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate Subtitles
                      </>
                    )}
                  </Button>

                  {/* Subtitle Toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Show Subtitles</Label>
                    <button
                      onClick={() => setShowSubtitles(!showSubtitles)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        showSubtitles ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          showSubtitles ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  {/* Subtitle Style Selector */}
                  {showSubtitles && (
                    <>
                      <SubtitleStyleSelector
                        value={subtitleStyle}
                        onChange={setSubtitleStyle}
                        fontSize={subtitleFontSize}
                        onFontSizeChange={setSubtitleFontSize}
                        fontFamily={subtitleFontFamily}
                        onFontFamilyChange={setSubtitleFontFamily}
                        singleLine={subtitleSingleLine}
                        onSingleLineChange={setSubtitleSingleLine}
                        singleWord={subtitleSingleWord}
                        onSingleWordChange={setSubtitleSingleWord}
                        karaokePillColor={karaokePillColor}
                        onKaraokePillColorChange={setKaraokePillColor}
                        boldGreenColor={boldGreenColor}
                        onBoldGreenColorChange={setBoldGreenColor}
                      />

                      {/* Subtitle Position Info */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Position</Label>
                        <div className="text-xs text-muted-foreground">
                          Drag subtitle on canvas to reposition
                        </div>
                        <div className="text-xs text-muted-foreground">
                          X: {subtitlePosition.x.toFixed(1)}% Y: {subtitlePosition.y.toFixed(1)}%
                        </div>
                      </div>

                    </>
                  )}
                                </div>
              </ScrollArea>
                        </div>
                      )}

          {activeSidebarSection === "brolls" && (
            <div className="border-t border-border/60 relative z-10 flex min-h-[220px] min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
              <div className="pointer-events-auto space-y-2 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  B-roll clips come from the Freepik stock library. Magic create splits your script into scenes and picks a unique stock clip per scene; jump cuts use the clips you select below (round-robin so clips do not repeat back-to-back).
                </p>

                {/* Fill Jump Cuts Button */}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setFillJumpCutsDialogOpen(true);
                    loadBRolls(); // Load B-rolls when opening modal
                  }}
                >
                  Fill Jump cuts
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full border border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90"
                  title="Adds a 2s full-screen black subtitle overlay at each jump-cut time. Uses your jump cut interval if set, otherwise 5s."
                  disabled={duration <= 0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (duration <= 0) {
                      alert("Add a video and ensure the project has a duration first.");
                      return;
                    }
                    const intervalSec =
                      jumpCutInterval && jumpCutInterval > 0 ? jumpCutInterval : 5;
                    const overlays = generateJumpCutCinemaOverlays(
                      duration,
                      intervalSec,
                      subtitleSegments
                    );
                    if (overlays.length === 0) {
                      alert(
                        "No jump-cut times fit in the current duration. Try a shorter interval in Fill Jump cuts or a longer video."
                      );
                      return;
                    }
                    setCanvasElements((prev) => {
                      const rest = prev.filter((el) => !el.magicJumpCutCinema);
                      return [...rest, ...overlays];
                    });
                    console.log("[Jump cut cinema] added overlays:", overlays.length, {
                      intervalSec,
                    });
                  }}
                >
                  Black overlays at jump cuts (2s)
                </Button>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Every{" "}
                  <strong>
                    {jumpCutInterval && jumpCutInterval > 0 ? `${jumpCutInterval}s` : "5s (default)"}
                  </strong>{" "}
                  — set interval in Fill Jump cuts to match B-roll jump cuts. Full-screen black + captions
                  when subtitles exist.
                </p>
              </div>
            </div>
          )}

          {activeSidebarSection === "media" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploadingFileName ? `Uploading ${uploadingFileName}...` : 'Uploading...'}
                    </>
                  ) : (
                    <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    setMediaDialogOpen(true);
                    // Load all media in parallel with timeout protection
                    // Use Promise.allSettled so one failure doesn't block others
                    Promise.allSettled([
                      loadGeneratedVideos(),
                      loadUploadedImages(),
                      loadUploadedVideos()
                    ]).then((results) => {
                      const errors = results.filter(r => r.status === 'rejected');
                      if (errors.length > 0) {
                        console.warn("Some media failed to load:", errors);
                      }
                    });
                  }}
                >
                  <VideoIcon className="h-4 w-4 mr-2" />
                  All Media
                </Button>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {/* Upload Progress Indicator */}
                  {isUploading && uploadingFileName && (
                    <div className="flex items-center gap-2 p-2 rounded bg-blue-900/30 border border-blue-700/50">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span className="text-xs text-blue-300 truncate">
                        Uploading: {uploadingFileName}
                      </span>
                    </div>
                  )}
                  
                  {/* Show current session assets */}
                  {assets.length > 0 && (
                    <>
                      <div className="text-xs text-gray-500 px-2 py-1">Current Session</div>
                      {assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-primary/10 cursor-pointer"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('asset', JSON.stringify(asset));
                          }}
                          onClick={() => {
                            if (asset.type === "video" || asset.type === "image") {
                              addElementToCanvas(asset.type, asset.url);
                            }
                          }}
                        >
                          {asset.type === "image" && <ImageIcon className="h-4 w-4 text-gray-400" />}
                          {asset.type === "video" && <VideoIcon className="h-4 w-4 text-gray-400" />}
                          {asset.type === "audio" && <Music className="h-4 w-4 text-gray-400" />}
                          <span className="text-xs text-gray-300 truncate">{asset.name}</span>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {assets.length === 0 && (
                    <div className="text-center text-xs text-gray-500 py-8">
                      No media files in this session
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeSidebarSection === "templates" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4">
                <div className="text-center text-muted-foreground py-8">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Coming Soon</p>
                </div>
              </div>
            </div>
          )}

          {activeSidebarSection === "text" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => addElementToCanvas("text")}
                >
                  <Type className="h-4 w-4 mr-2" />
                  Add Text
                </Button>
              </div>
            </div>
          )}

          {activeSidebarSection === "audio" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById("audio-upload")?.click()}
                  disabled={isUploading}
                >
                  {isUploading && uploadingFileName?.endsWith('.mp3') ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Audio
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    setAudioDialogOpen(true);
                    await loadUploadedAudios();
                  }}
                >
                  <Music className="h-4 w-4 mr-2" />
                  My Audio
                </Button>
                <Input
                  id="audio-upload"
                  type="file"
                  accept="audio/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    setIsUploading(true);
                    setUploadingFileName(file.name);
                    
                    try {
                      ensureProjectExists();
                      const projectId = currentProject?.id || uuid();
                      
                      const fileName = `audio-${uuid()}.${file.name.split('.').pop()}`;
                      const audioUrl = await uploadAudioToStorage(file, projectId, fileName);
                      
                      // Save metadata to database using REST API (avoids hanging Supabase client calls)
                      const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
                      let token = await getCachedToken();
                      
                      if (token) {
                        try {
                          // Extract userId from token
                          const payload = JSON.parse(atob(token.split('.')[1]));
                          const userId = payload.sub || payload.user_id;
                          
                          if (userId) {
                            const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
                            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                            
                            if (supabaseUrl && supabaseAnonKey) {
                        const storagePath = `ugc-audio/${projectId}/${fileName}`;
                              const insertUrl = `${supabaseUrl}/rest/v1/user_uploads`;
                              
                              const makeRequest = async (authToken: string) => {
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 10000);
                                try {
                                  const response = await fetch(insertUrl, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${authToken}`,
                                      'apikey': supabaseAnonKey,
                                      'Prefer': 'return=minimal'
                                    },
                                    body: JSON.stringify({
                                      user_id: userId,
                          file_name: fileName,
                          file_type: 'audio',
                          storage_path: storagePath,
                          storage_url: audioUrl,
                          file_size: file.size,
                          mime_type: file.type,
                          metadata: {}
                                    }),
                                    signal: controller.signal
                                  });
                                  clearTimeout(timeoutId);
                                  return response;
                                } catch (err) {
                                  clearTimeout(timeoutId);
                                  throw err;
                                }
                              };
                              
                              let response = await makeRequest(token);
                              
                              // Handle 401 - refresh token and retry
                              if (response.status === 401) {
                                const refreshedToken = await refreshToken();
                                if (refreshedToken) {
                                  response = await makeRequest(refreshedToken);
                                }
                              }
                              
                              if (!response.ok) {
                                console.warn('[Audio Upload] Failed to save metadata:', response.status);
                              }
                            }
                          }
                        } catch (error) {
                          console.warn('[Audio Upload] Error saving metadata:', error);
                          // Continue even if metadata save fails
                        }
                      }
                      
                      // Calculate startTime: place after the last audio element, but ensure it fits within timeline
                      const existingAudioElements = canvasElements.filter(el => el.type === "audio");
                      let audioStartTime = 0;
                      if (existingAudioElements.length > 0) {
                        // Find the last audio element's end time
                        const lastAudio = existingAudioElements.reduce((latest, el) => {
                          const elEndTime = (el.startTime || 0) + (el.duration || 5000);
                          const latestEndTime = (latest.startTime || 0) + (latest.duration || 5000);
                          return elEndTime > latestEndTime ? el : latest;
                        });
                        const calculatedStartTime = (lastAudio.startTime || 0) + (lastAudio.duration || 5000);
                        // Ensure the audio fits within the timeline
                        // If it would exceed, place it at the start instead
                        audioStartTime = Math.max(0, Math.min(calculatedStartTime, duration - 5000)); // Leave room for at least 5s duration
                      }
                      
                      // Add to canvas as audio element
                      const audioElement: CanvasElement = {
                        id: uuid(),
                        type: "audio",
                        url: audioUrl,
                        x: 50,
                        y: 50,
                        width: 50,
                        height: 50,
                        startTime: audioStartTime,
                        duration: 5000, // Will be updated when audio loads
                        audioStartOffset: 0, // Initialize audio start offset for trimming
                        muted: false,
                        rotation: 0,
                        opacity: 1,
                        zIndex: canvasElements.length,
                      };
                      
                      setCanvasElements([...canvasElements, audioElement]);
                      await loadUploadedAudios();
                      setUploadingFileName(null);
                    } catch (error) {
                      console.error("Error uploading audio:", error);
                      alert(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setIsUploading(false);
                      setUploadingFileName(null);
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area - Canvas (CapCut Style) */}
        <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
          <div className="flex-1 flex items-center justify-center py-8 px-4 min-h-0 overflow-visible relative">
            {/* Canvas Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasZoom(Math.max(25, canvasZoom - 10))}
                className="h-8 w-8 p-0"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="text-xs font-mono min-w-[50px] text-center">
                {canvasZoom}%
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasZoom(Math.min(200, canvasZoom + 10))}
                className="h-8 w-8 p-0"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasZoom(90)}
                className="h-8 px-2 text-xs"
                title="Reset Zoom"
              >
                Reset
              </Button>
            </div>
            
            {/* Canvas Container with Zoom */}
            <div 
              className="flex items-center justify-center"
              style={{ 
                transform: `scale(${canvasZoom / 100})`, 
                transformOrigin: 'center',
                transition: 'transform 0.2s ease',
                overflow: 'visible'
              }}
            >
              {/* Canvas Container - TikTok Size (9:16 aspect ratio) */}
              <div 
                ref={canvasRef}
                className="relative rounded-lg shadow-lg"
                style={{
                  width: 'min(100vw, 400px)', // Max width for TikTok size
                  aspectRatio: '9 / 16', // TikTok aspect ratio
                  // Canvas root is always white so that any uncovered area
                  // (e.g. when the user deletes the top scene card of a split
                  // layout) renders as a clean white fill rather than a dark
                  // void. Full-bleed scenes (b-roll, circle-pip with card,
                  // subtitle-cinema, etc.) still cover the frame exactly the
                  // same way — only truly empty regions pick up this color.
                  backgroundColor: '#ffffff',
                  overflow: 'hidden' // Clip elements that go outside canvas bounds
                }}
                onClick={handleCanvasClick}
                onMouseMove={(e) => {
                  handleCanvasMouseMove(e);
                  handleCanvasMouseMoveForSubtitle(e);
                }}
                onMouseUp={() => {
                  handleCanvasMouseUp();
                  handleCanvasMouseUpForSubtitle();
                }}
                onMouseLeave={() => {
                  handleCanvasMouseUp();
                  handleCanvasMouseUpForSubtitle();
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
              >
              {/* Canvas Elements - Exclude audio elements (they only appear in timeline); sort by zIndex so stacking order is correct */}
              {[...canvasElements]
                .filter(element => element.type !== "audio") // Filter out audio elements from canvas
                .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)) // Lower z-index first so higher renders on top
                .map((element) => {
                const isSelected = selectedElementId === element.id;
                
                // Initialize transition opacity (default to 1 for non-videos or when no transition)
                let transitionOpacity: number | undefined = undefined;
                let shouldRender = true;
                
                // For video, image, and text elements, only show when timeline is within their time range
                if (element.type === "video" || element.type === "image" || element.type === "text") {
                  const elementStartTime = element.startTime || 0;
                  const elementDuration = element.duration || 5000;
                  const elementEndTime = elementStartTime + elementDuration;
                  
                  // Default render check
                  shouldRender = currentTime >= elementStartTime && currentTime < elementEndTime;
                  
                  if (element.type === "video") {
                    const transitionDuration = element.bRollOverlay ? 400 : 300;

                    if (element.bRollOverlay) {
                      // B-roll overlays ALWAYS fade in at start and fade out
                      // at end (regardless of whether another b-roll neighbors
                      // them). This prevents jump-cuts when b-roll appears or
                      // disappears on bare layout boundaries (e.g. intro's
                      // 0-4s split b-roll ending at 4s, 7-9s full-frame b-roll
                      // ending at 9s, post-cinema gap fillers, etc.).
                      const fadeInEnd = elementStartTime + transitionDuration;
                      const fadeOutStart = elementEndTime - transitionDuration;
                      let op = 1;
                      if (currentTime < fadeInEnd) {
                        op = Math.min(1, Math.max(0, (currentTime - elementStartTime) / transitionDuration));
                      } else if (currentTime >= fadeOutStart) {
                        op = Math.min(1, Math.max(0, (elementEndTime - currentTime) / transitionDuration));
                      }
                      transitionOpacity = op;
                      // Keep mounted a little past the edges so the fade is visible.
                      shouldRender =
                        currentTime >= elementStartTime - transitionDuration &&
                        currentTime < elementEndTime + transitionDuration;
                    } else {
                    const sameTrackVideos = canvasElements.filter(el => 
                      el.type === "video" && 
                      el.id !== element.id &&
                      el.x === element.x &&
                      el.y === element.y &&
                      el.width === element.width &&
                      el.height === element.height
                    );
                    
                    const nextVideo = sameTrackVideos.find(el => {
                      const elStartTime = el.startTime || 0;
                      return Math.abs(elStartTime - elementEndTime) < 100;
                    });
                    
                    const prevVideo = sameTrackVideos.find(el => {
                      const elStartTime = el.startTime || 0;
                      const elEndTime = elStartTime + (el.duration || 5000);
                      return Math.abs(elEndTime - elementStartTime) < 100;
                    });
                    
                    if (nextVideo) {
                      const fadeOutStart = elementEndTime - transitionDuration;
                      if (currentTime >= fadeOutStart && currentTime < elementEndTime) {
                        const fadeProgress = (currentTime - fadeOutStart) / transitionDuration;
                        transitionOpacity = Math.max(0, 1 - fadeProgress);
                        shouldRender = true;
                      }
                    }
                    
                    if (prevVideo) {
                      const fadeInEnd = elementStartTime + transitionDuration;
                      if (currentTime >= elementStartTime && currentTime < fadeInEnd) {
                        const fadeProgress = (currentTime - elementStartTime) / transitionDuration;
                        transitionOpacity = Math.min(1, fadeProgress);
                        shouldRender = true;
                      }
                    }
                    
                    const transitionMargin = transitionDuration;
                    if (nextVideo || prevVideo) {
                      shouldRender = currentTime >= (elementStartTime - transitionMargin) && 
                                    currentTime < (elementEndTime + transitionMargin);
                    }
                    }
                  }
                  
                  // Magic scene companions (stock illustrations, hero images
                  // paired with explainer cards) hard-pop without this — fade
                  // them in/out over ~320ms so scene swaps feel continuous.
                  if (
                    element.type === "image" &&
                    element.magicSceneExplainerStock
                  ) {
                    const fadeMs = 320;
                    const fadeInEnd = elementStartTime + fadeMs;
                    const fadeOutStart = elementEndTime - fadeMs;
                    if (currentTime < fadeInEnd) {
                      transitionOpacity = Math.min(1, Math.max(0, (currentTime - elementStartTime) / fadeMs));
                      shouldRender = currentTime >= elementStartTime - fadeMs;
                    } else if (currentTime >= fadeOutStart) {
                      transitionOpacity = Math.min(1, Math.max(0, (elementEndTime - currentTime) / fadeMs));
                      shouldRender = currentTime < elementEndTime + fadeMs;
                    }
                  }

                  // Text magic-scene explainer cards: wrapper fade so the
                  // outer DIV cross-blends while the inner SceneTransitionShell
                  // handles type reveals. Prevents hard shell pops.
                  if (
                    element.type === "text" &&
                    element.magicSceneExplainer &&
                    !element.magicSceneExplainerStock
                  ) {
                    const fadeMs = 260;
                    const fadeInEnd = elementStartTime + fadeMs;
                    const fadeOutStart = elementEndTime - fadeMs;
                    if (currentTime < fadeInEnd) {
                      transitionOpacity = Math.min(1, Math.max(0, (currentTime - elementStartTime) / fadeMs));
                      shouldRender = currentTime >= elementStartTime - fadeMs;
                    } else if (currentTime >= fadeOutStart) {
                      transitionOpacity = Math.min(1, Math.max(0, (elementEndTime - currentTime) / fadeMs));
                      shouldRender = currentTime < elementEndTime + fadeMs;
                    }
                  }

                  // Don't render element if timeline is outside its range (unless transitioning)
                  if (!shouldRender) {
                    return null;
                  }
                }

                if (
                  element.bRollOverlay &&
                  isMagicCircleLayoutActiveAt(currentTime, canvasElements)
                ) {
                  return null;
                }
                
                // Calculate final opacity with transition
                const baseOpacity = element.opacity || 1;
                const finalOpacity = transitionOpacity !== undefined
                  ? transitionOpacity * baseOpacity
                  : baseOpacity;

                const magicSegIdx =
                  element.type === "video" && element.magicLayoutSegments?.length
                    ? element.magicLayoutSegments.findIndex(
                        (s) => currentTime >= s.startMs && currentTime < s.endMs
                      )
                    : -1;
                const magicSeg =
                  element.type === "video" && element.magicLayoutSegments?.length && magicSegIdx >= 0
                    ? element.magicLayoutSegments[magicSegIdx]
                    : undefined;

                let layoutX = element.x;
                let layoutY = element.y;
                let layoutW = element.width;
                let layoutH = element.height;
                let layoutZ = element.zIndex ?? 0;
                if (element.type === "video" && element.magicLayoutSegments?.length) {
                  const box = blendMagicMainVideoLayout(
                    element.magicLayoutSegments,
                    currentTime,
                    element.zIndex ?? 0,
                    magicCinemaExplainerCoversVideo && !cinemaToCirclePrewarm,
                    magicTopTextCardActive
                  );
                  layoutX = box.lx;
                  layoutY = box.ly;
                  layoutW = box.lw;
                  layoutH = box.lh;
                  layoutZ = box.lz;
                }

                // `topSlot` means this segment was authored to pair with a top card.
                // Even if the user deleted that card, keep treating it like a "split-with-card"
                // scene: render the main video as a bottom-half rect (not a centered circle).
                const segTopSlot = magicSeg?.topSlot === true;
                const useMagicCircle =
                  element.type === "video" &&
                  magicSeg?.mode === "circle-pip" &&
                  (!magicCinemaExplainerCoversVideo || cinemaToCirclePrewarm) &&
                  !magicTopTextCardActive &&
                  !segTopSlot;
                
                return (
                  <div
                    key={element.id}
                    className={cn(
                      "absolute cursor-move",
                      isSelected && "ring-2 ring-blue-500"
                    )}
                    style={{
                      left: `${layoutX}%`,
                      top: `${layoutY}%`,
                      width: `${layoutW}%`,
                      height: `${layoutH}%`,
                      transform: `rotate(${element.rotation}deg)`,
                      opacity: finalOpacity,
                      zIndex: layoutZ,
                      overflow: "visible", // Allow buttons to show outside element bounds
                      /* Magic layout: position/size updated every frame via blendMagicMainVideoLayout — avoid CSS layout transition (caused glitches with inner tree swaps). Opacity cross-fade is applied uniformly so any transitionOpacity (b-roll, stock image, card wrapper) lands smoothly even on coarse frame steps. */
                      transition:
                        element.type === "video"
                          ? element.magicLayoutSegments?.length
                            ? transitionOpacity !== undefined
                              ? "opacity 0.1s linear"
                              : "opacity 0.06s linear"
                            : "opacity 0.05s linear"
                          : transitionOpacity !== undefined
                          ? "opacity 0.12s linear"
                          : undefined,
                    }}
                    onMouseDown={(e) => handleCanvasMouseDown(e, element.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedElementId(element.id);
                      setContextMenuElementId(element.id);
                    }}
                  >
                    {/* Element Content Container - Clips content but allows buttons to show */}
                    {/* When circleFrame: use a square (min dimension) centered wrapper so we get a true circle, not an oval */}
                    <div
                      className={cn(
                        "w-full h-full overflow-hidden",
                        !element.circleFrame &&
                          !useMagicCircle &&
                          !(element.type === "text" && element.magicSceneExplainer) &&
                          "rounded"
                      )}
                    >
                      {(magicTopTextCardActive || segTopSlot) &&
                      magicSeg?.mode === "circle-pip" &&
                      !magicCinemaExplainerCoversVideo &&
                      element.type === "video" &&
                      element.url ? (
                        // No dedicated caption band — just render the main
                        // video full-bleed in the bottom half of the split
                        // layout and let the global subtitle overlay handle
                        // the caption like it does on b-roll scenes.
                        // `segTopSlot` keeps this branch active even if the
                        // user deleted the top card (top area stays white).
                        <div className="relative h-full w-full overflow-hidden">
                          <div className="h-full w-full overflow-hidden">
                            <BrollVibeVideoWrap
                              vibeKey={element.bRollOverlay ? element.bRollSceneVibe : undefined}
                            >
                              {canvasVideoFailedUrlByElementId[element.id] === element.url &&
                              element.thumbnail ? (
                                <img
                                  src={element.thumbnail}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  draggable={false}
                                />
                              ) : (
                                <video
                                  id={`canvas-video-${element.id}`}
                                  src={element.url}
                                  poster={element.thumbnail}
                                  className="h-full w-full object-cover"
                                  loop={false}
                                  muted={(element.muted ?? false) || isMuted}
                                  playsInline
                                  ref={(videoEl) => attachCanvasVideoRef(element.id, videoEl)}
                                  onError={() => {
                                    console.warn(
                                      "[Canvas video] load/decode error — showing poster or thumbnail fallback",
                                      element.id,
                                      element.url?.slice(0, 96)
                                    );
                                    setCanvasVideoFailedUrlByElementId((p) => ({
                                      ...p,
                                      [element.id]: element.url!,
                                    }));
                                  }}
                                  onTimeUpdate={(e) => {
                                    if (isPlaying) {
                                      const video = e.currentTarget;
                                      const elementStartTime = element.startTime || 0;
                                      const elementDuration = element.duration || 5000;
                                      const videoStartOffset = element.videoStartOffset || 0;
                                      const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                                      if (video.currentTime >= trimmedEndTime - 0.1) video.pause();
                                    }
                                  }}
                                  onLoadedMetadata={(e) => {
                                    const video = e.currentTarget;
                                    if (video.playbackRate !== playbackRate)
                                      setVideoPlaybackRate(video, playbackRate);
                                    if (duration === 0 && video.duration) setDuration(video.duration * 1000);
                                  }}
                                  onEnded={(e) => {
                                    const elementEndTime =
                                      (element.startTime || 0) + (element.duration || 5000);
                                    if (currentTime >= elementEndTime - 100) e.currentTarget.pause();
                                  }}
                                />
                              )}
                            </BrollVibeVideoWrap>
                          </div>
                        </div>
                      ) : useMagicCircle && element.type === "video" && element.url ? (
                        (() => {
                          // Circle-pip segment editing controls:
                          // - Click the circle → select this segment (blue ring).
                          // - Bottom-right handle drag-resizes (circleScale 0.4-1.2).
                          // - Floating toolbar offers "Full screen", "Bottom half", "Delete".
                          const circleSeg = magicSeg; // narrow non-null for the closure
                          const circleScale = circleSeg?.circleScale ?? 1;
                          // Base cap: min(96%, 400px). Scale multiplies the 400px side and
                          // lets the circle also grow past 96% up to 100% at 1.2×.
                          const scaledPx = Math.round(400 * circleScale);
                          const widthCssCap = `min(${Math.min(100, Math.round(96 * Math.max(1, circleScale)))}%, ${scaledPx}px)`;
                          const isSegSelected =
                            magicSegIdx >= 0 && selectedLayoutSegmentIdx === magicSegIdx;
                          return (
                            <div className="relative flex h-full w-full flex-col items-center overflow-y-auto bg-black">
                              {/* Circle + caption: vertically centered as a group; scroll if taller than frame */}
                              <div
                                className="relative my-auto flex shrink-0 flex-col items-stretch gap-3 px-[4%] py-4"
                                style={{ width: "100%", maxWidth: widthCssCap }}
                              >
                                <div
                                  className={cn(
                                    "relative w-full shrink-0 overflow-visible",
                                    isSegSelected && "outline-none"
                                  )}
                                  // Padding-bottom: 100% trick guarantees the box is a
                                  // perfect square even inside flex containers where
                                  // `aspect-ratio: 1/1` can be overridden by sibling
                                  // height distribution. Without this the circle can
                                  // render as a tall oval in certain layouts.
                                  style={{ paddingBottom: "100%", height: 0 }}
                                  onMouseDown={(e) => {
                                    // Only intercept clicks that are inside the actual
                                    // circle area — the toolbar buttons / resize handle
                                    // live outside this node and stopPropagation themselves.
                                    const tgt = e.target as HTMLElement;
                                    if (tgt.closest(".circle-resize-handle") || tgt.closest(".circle-toolbar-btn")) return;
                                    e.stopPropagation();
                                    if (magicSegIdx >= 0) setSelectedLayoutSegmentIdx(magicSegIdx);
                                  }}
                                >
                                  <div
                                    className={cn(
                                      "absolute inset-0 overflow-hidden rounded-full shadow-[0_8px_40px_rgba(0,0,0,0.45)]",
                                      isSegSelected && "ring-4 ring-blue-500"
                                    )}
                                  >
                              <BrollVibeVideoWrap
                                vibeKey={element.bRollOverlay ? element.bRollSceneVibe : undefined}
                              >
                                {canvasVideoFailedUrlByElementId[element.id] === element.url &&
                                element.thumbnail ? (
                                  <img
                                    src={element.thumbnail}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                  />
                                ) : (
                                  <video
                                    id={`canvas-video-${element.id}`}
                                    src={element.url}
                                    poster={element.thumbnail}
                                    className="h-full w-full object-cover"
                                    loop={false}
                                    muted={(element.muted ?? false) || isMuted}
                                    playsInline
                                    ref={(videoEl) => attachCanvasVideoRef(element.id, videoEl)}
                                    onError={() => {
                                      console.warn(
                                        "[Canvas video] load/decode error — showing poster or thumbnail fallback",
                                        element.id,
                                        element.url?.slice(0, 96)
                                      );
                                      setCanvasVideoFailedUrlByElementId((p) => ({
                                        ...p,
                                        [element.id]: element.url!,
                                      }));
                                    }}
                                    onTimeUpdate={(e) => {
                                      if (isPlaying) {
                                        const video = e.currentTarget;
                                        const elementStartTime = element.startTime || 0;
                                        const elementDuration = element.duration || 5000;
                                        const videoStartOffset = element.videoStartOffset || 0;
                                        const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                                        if (video.currentTime >= trimmedEndTime - 0.1) video.pause();
                                      }
                                    }}
                                    onLoadedMetadata={(e) => {
                                      const video = e.currentTarget;
                                      if (video.playbackRate !== playbackRate)
                                        setVideoPlaybackRate(video, playbackRate);
                                      if (duration === 0 && video.duration) setDuration(video.duration * 1000);
                                    }}
                                    onEnded={(e) => {
                                      const elementEndTime =
                                        (element.startTime || 0) + (element.duration || 5000);
                                      if (currentTime >= elementEndTime - 100) e.currentTarget.pause();
                                    }}
                                  />
                                )}
                                  </BrollVibeVideoWrap>
                                  </div>

                                  {/* -- Selected-segment overlay UI ---------- */}
                                  {isSegSelected ? (
                                    <>
                                      {/* Floating toolbar (above the circle) */}
                                      <div
                                        className="absolute left-1/2 -top-10 z-[150] flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/95 px-2 py-1 shadow-lg"
                                        onMouseDown={(e) => e.stopPropagation()}
                                      >
                                        <button
                                          type="button"
                                          className="circle-toolbar-btn rounded-full px-2 py-1 text-[11px] font-medium text-neutral-800 hover:bg-neutral-100"
                                          title="Make full-screen for this beat (removes this segment)"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateMagicLayoutSegment(magicSegIdx, null);
                                            setSelectedLayoutSegmentIdx(null);
                                          }}
                                        >
                                          Full screen
                                        </button>
                                        <button
                                          type="button"
                                          className="circle-toolbar-btn rounded-full px-2 py-1 text-[11px] font-medium text-neutral-800 hover:bg-neutral-100"
                                          title="Switch this beat to a bottom-half B-roll split"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateMagicLayoutSegment(magicSegIdx, { mode: "split-bottom" });
                                          }}
                                        >
                                          Bottom half
                                        </button>
                                        <button
                                          type="button"
                                          className="circle-toolbar-btn rounded-full px-2 py-1 text-[11px] font-medium text-neutral-800 hover:bg-neutral-100"
                                          title="Reset circle size"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateMagicLayoutSegment(magicSegIdx, { circleScale: 1 });
                                          }}
                                        >
                                          Reset size
                                        </button>
                                        <button
                                          type="button"
                                          className="circle-toolbar-btn rounded-full bg-red-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                                          title="Delete this layout segment"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateMagicLayoutSegment(magicSegIdx, null);
                                            setSelectedLayoutSegmentIdx(null);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                      {/* Scale readout chip (top-right) */}
                                      <div className="pointer-events-none absolute right-0 top-0 z-[140] rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                                        {Math.round(circleScale * 100)}%
                                      </div>
                                      {/* Resize handle (bottom-right). Drag to scale. */}
                                      <div
                                        className="circle-resize-handle absolute bottom-1 right-1 z-[150] h-5 w-5 cursor-nwse-resize rounded-full border-2 border-white bg-blue-500 shadow-md hover:scale-110 transition-transform"
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          if (magicSegIdx < 0) return;
                                          setIsResizingCircle(true);
                                          circleResizeStartRef.current = {
                                            x: e.clientX,
                                            y: e.clientY,
                                            scale: circleScale,
                                            canvasWidth:
                                              canvasRef.current?.getBoundingClientRect().width || 400,
                                          };
                                        }}
                                        title="Drag to resize circle"
                                      />
                                    </>
                                  ) : null}
                                </div>
                                {/* Caption card removed — rely on the global
                                    subtitle overlay so the circle-pip scene
                                    shares the same caption treatment as b-roll. */}
                              </div>
                            </div>
                          );
                        })()
                      ) : element.circleFrame || useMagicCircle ? (
                        <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center">
                          {/* Square wrapper (flex + aspect-ratio so side = min(width, height)) then rounded-full = true circle */}
                          <div
                            className="min-h-0 min-w-0 overflow-hidden rounded-full"
                            style={{ flex: "1 1 0", aspectRatio: "1", maxWidth: "100%", maxHeight: "100%" }}
                          >
                      {element.type === "video" && element.url && (
                        <BrollVibeVideoWrap
                          vibeKey={element.bRollOverlay ? element.bRollSceneVibe : undefined}
                        >
                        {canvasVideoFailedUrlByElementId[element.id] === element.url &&
                        element.thumbnail ? (
                          <img
                            src={element.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                        <video
                          id={`canvas-video-${element.id}`}
                          src={element.url}
                          poster={element.thumbnail}
                          className="w-full h-full object-cover"
                          loop={false}
                          muted={(element.muted ?? false) || isMuted}
                          playsInline
                                ref={(videoEl) => attachCanvasVideoRef(element.id, videoEl)}
                                onError={() => {
                                  console.warn(
                                    "[Canvas video] load/decode error — showing poster or thumbnail fallback",
                                    element.id,
                                    element.url?.slice(0, 96)
                                  );
                                  setCanvasVideoFailedUrlByElementId((p) => ({
                                    ...p,
                                    [element.id]: element.url!,
                                  }));
                                }}
                                onTimeUpdate={(e) => {
                                  if (isPlaying) {
                                    const video = e.currentTarget;
                                    const elementStartTime = element.startTime || 0;
                                    const elementDuration = element.duration || 5000;
                                    const videoStartOffset = element.videoStartOffset || 0;
                                    const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                                    if (video.currentTime >= trimmedEndTime - 0.1) video.pause();
                                  }
                                }}
                                onLoadedMetadata={(e) => {
                                  const video = e.currentTarget;
                                  if (video.playbackRate !== playbackRate) setVideoPlaybackRate(video, playbackRate);
                                  if (duration === 0 && video.duration) setDuration(video.duration * 1000);
                                }}
                                onEnded={(e) => {
                                  const elementEndTime = (element.startTime || 0) + (element.duration || 5000);
                                  if (currentTime >= elementEndTime - 100) e.currentTarget.pause();
                                }}
                              />
                        )
                        }
                        </BrollVibeVideoWrap>
                            )}
                            {element.type === "image" && element.url && (
                              <img
                                src={element.url}
                                alt=""
                                className="w-full h-full object-cover"
                                draggable={false}
                                style={{
                                  objectPosition: `${element.imageOffsetX || 50}% ${element.imageOffsetY || 50}%`,
                                  clipPath: element.cropX !== undefined && element.cropY !== undefined && element.cropWidth !== undefined && element.cropHeight !== undefined
                                    ? `inset(${element.cropY}% ${100 - (element.cropX + element.cropWidth)}% ${100 - (element.cropY + element.cropHeight)}% ${element.cropX}%)`
                                    : undefined
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                      <>
                      {element.type === "video" && element.url && (
                        <BrollVibeVideoWrap
                          vibeKey={element.bRollOverlay ? element.bRollSceneVibe : undefined}
                        >
                        {canvasVideoFailedUrlByElementId[element.id] === element.url &&
                        element.thumbnail ? (
                          <img
                            src={element.thumbnail}
                            alt=""
                            className={cn("w-full h-full", element.objectFit === "contain" ? "object-contain" : "object-cover")}
                            draggable={false}
                          />
                        ) : (
                        <video
                          id={`canvas-video-${element.id}`}
                          src={element.url}
                          poster={element.thumbnail}
                          className={cn("w-full h-full", element.objectFit === "contain" ? "object-contain" : "object-cover")}
                          loop={false}
                          muted={(element.muted ?? false) || isMuted}
                          playsInline
                          ref={(videoEl) => attachCanvasVideoRef(element.id, videoEl)}
                        onError={() => {
                          console.warn(
                            "[Canvas video] load/decode error — showing poster or thumbnail fallback",
                            element.id,
                            element.url?.slice(0, 96)
                          );
                          setCanvasVideoFailedUrlByElementId((p) => ({
                            ...p,
                            [element.id]: element.url!,
                          }));
                        }}
                        onTimeUpdate={(e) => {
                          // Update timeline from video playback - account for element's startTime and videoStartOffset
                          if (isPlaying) {
                            const video = e.currentTarget;
                            const elementStartTime = element.startTime || 0;
                            const elementDuration = element.duration || 5000;
                            const videoStartOffset = element.videoStartOffset || 0;
                            
                            // Check if video has reached trimmed end
                            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                            const elementEndTime = elementStartTime + elementDuration;
                            
                            if (video.currentTime >= trimmedEndTime - 0.1) {
                              // Video reached its trimmed end - pause it
                              // Don't return early - let timeline continue advancing via animation frame
                              video.pause();
                              // Timeline will continue advancing via the animation frame loop
                              // which will trigger the next video to start when currentTime reaches its startTime
                            } else {
                              // Video is still playing - but let the animation frame loop drive the timeline
                              // The onTimeUpdate is mainly for detecting when video reaches trimmed end
                              // Don't sync timeline from video when playbackRate is active, as it can cause conflicts
                              // The animation frame loop already accounts for playbackRate
                            }
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          const video = e.currentTarget;
                          // Apply playback rate when video loads (with preservesPitch)
                          if (video.playbackRate !== playbackRate) {
                            setVideoPlaybackRate(video, playbackRate);
                          }
                          if (duration === 0 && video.duration) {
                            setDuration(video.duration * 1000);
                          }
                        }}
                        onEnded={(e) => {
                          // Check if video reached its trimmed end (not just natural end)
                          const elementStartTime = element.startTime || 0;
                          const elementDuration = element.duration || 5000;
                          const elementEndTime = elementStartTime + elementDuration;
                          
                          // Only reset if we've reached the trimmed end time
                          if (currentTime >= elementEndTime - 100) { // 100ms tolerance
                            // When video reaches its trimmed end, pause it
                            const video = e.currentTarget;
                            video.pause();
                            // Don't reset timeline, just pause this video
                            // Other videos might still be playing
                          }
                        }}
                      />
                        )
                        }
                        </BrollVibeVideoWrap>
                    )}
                    {element.type === "image" && element.url && (
                      <>
                      <img
                        src={element.url}
                        alt=""
                        className={cn(
                          "w-full h-full",
                          element.objectFit === "contain" ? "object-contain" : "object-cover",
                          element.circleFrame ? "rounded-full" : "rounded"
                        )}
                        draggable={false}
                        style={{
                            objectPosition: `${element.imageOffsetX || 50}% ${element.imageOffsetY || 50}%`,
                            clipPath: element.cropX !== undefined && element.cropY !== undefined && element.cropWidth !== undefined && element.cropHeight !== undefined
                              ? `inset(${element.cropY}% ${100 - (element.cropX + element.cropWidth)}% ${100 - (element.cropY + element.cropHeight)}% ${element.cropX}%)`
                              : undefined
                          }}
                        />
                        {/* Crop selection overlay */}
                        {isCropping && cropArea && cropArea.width > 0 && cropArea.height > 0 && (
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none z-30"
                            style={{
                              left: `${cropArea.x}%`,
                              top: `${cropArea.y}%`,
                              width: `${cropArea.width}%`,
                              height: `${cropArea.height}%`
                            }}
                          >
                            {/* Crop handles */}
                            <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                          </div>
                        )}
                      </>
                    )}
                    </>
                    )}
                                       {element.type === "text" && (
                      element.magicSceneExplainer ? (
                        <div className="relative h-full w-full overflow-hidden rounded-none">
                          {(() => {
                            const start = element.startTime || 0;
                            const tRel = Math.max(0, currentTime - start);
                            // Prefer the live clip duration so trimming the
                            // scene pill on the timeline immediately extends
                            // (or shortens) the enter/exit animation window.
                            // Falling back to `explainerSegmentDurationMs`
                            // is only useful for legacy / unset data.
                            const segDur =
                              element.duration ??
                              element.explainerSegmentDurationMs ??
                              5000;
                            const isCinema =
                              element.explainerSceneStyle === "subtitle-cinema";
                            const activeCap =
                              isCinema && subtitleSegments.length > 0
                                ? subtitleSegments.find(
                                    (s) =>
                                      s &&
                                      currentTime >= s.startMs &&
                                      currentTime < s.endMs
                                  )
                                : undefined;
                            const cinemaSync = Boolean(
                              isCinema && activeCap?.text?.trim()
                            );
                            const capText = activeCap?.text?.trim() ?? "";
                            const titleForGraphic = cinemaSync
                              ? capText
                              : element.text || "";
                            const karaokeTRel =
                              cinemaSync && activeCap
                                ? Math.max(0, currentTime - activeCap.startMs)
                                : undefined;
                            const karaokeSegDur =
                              cinemaSync && activeCap
                                ? Math.max(1, activeCap.endMs - activeCap.startMs)
                                : undefined;

                            return (
                              <MagicSceneExplainerGraphic
                                sceneStyle={element.explainerSceneStyle}
                                typographyStyle={element.explainerTypographyStyle}
                                accentHex={element.explainerAccentHex}
                                beatIndex={element.explainerGraphicVariant ?? 0}
                                title={titleForGraphic}
                                subline={element.explainerSubline}
                                accentLabel={element.explainerAccentLabel}
                                stockImageUrl={element.explainerIllustrationUrl}
                                heroWord={element.explainerHeroWord}
                                items={element.explainerItems}
                                emoji={element.explainerEmoji}
                                sideA={element.explainerSideA}
                                sideB={element.explainerSideB}
                                iconEmoji={element.explainerIconEmoji}
                                logoUrl={element.explainerLogoUrl}
                                tRelMs={tRel}
                                segmentDurationMs={segDur}
                                karaokeTRelMs={karaokeTRel}
                                karaokeSegmentDurationMs={karaokeSegDur}
                                cinemaCaptionSync={cinemaSync}
                                masterOpacity={shouldRender ? 1 : 0}
                                titleColor={element.fontColor || "#0a0a0a"}
                                widthPct={element.width}
                                fontSizeBase={element.fontSize || 20}
                                animationPace={
                                  magicExplainerSlowAnimations ? "slow" : "normal"
                                }
                              />
                            );
                          })()}
                        </div>
                      ) : (
                      <div className="relative w-full h-full overflow-hidden">
                        {element.textBackgroundColor ? (
                          <div
                            className="absolute inset-0 rounded-none"
                            style={{ backgroundColor: element.textBackgroundColor }}
                            aria-hidden
                          />
                        ) : null}
                        <div
                          className="relative z-[1] w-full h-full flex items-center justify-center px-2 text-center leading-tight"
                          style={{
                            fontSize: `${(element.fontSize || 24) * (element.width / 28)}px`,
                            color: element.fontColor || "#000000",
                            fontFamily: element.fontFamily || "Arial",
                            fontWeight: element.magicViralStyle || element.magicWhiteSlide ? 800 : "bold",
                            textTransform:
                              element.magicViralStyle || element.magicWhiteSlide ? "uppercase" : undefined,
                            letterSpacing: element.magicWhiteSlide ? "-0.02em" : undefined,
                            textShadow: element.magicWhiteSlide
                              ? undefined
                              : element.magicViralStyle
                                ? "2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 12px rgba(0,0,0,0.85)"
                                : undefined,
                          }}
                        >
                          {element.text || "Double click to edit"}
                        </div>
                      </div>
                      )
                    )}
                    </div>
                    
                    {/* Right-click Context Menu */}
                    {isSelected && contextMenuElementId === element.id && (
                      <DropdownMenu open={true} onOpenChange={(open) => {
                        if (!open) setContextMenuElementId(null);
                      }}>
                        <DropdownMenuTrigger asChild>
                          <div className="absolute inset-0" style={{ pointerEvents: 'none' }} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {element.type === "video" && (
                            <DropdownMenuItem onClick={() => {
                              fillCanvas(element.id);
                              setContextMenuElementId(null);
                            }}>
                              Fill canvas
                            </DropdownMenuItem>
                          )}
                          {(element.type === "video" || element.type === "image") && (
                            <DropdownMenuItem onClick={() => {
                              updateCanvasElement(element.id, { circleFrame: !element.circleFrame });
                              setContextMenuElementId(null);
                            }}>
                              {element.circleFrame ? "Remove circle frame" : "Circle frame"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            bringToFront(element.id);
                            setContextMenuElementId(null);
                          }}>
                            Bring to Front
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            sendToBack(element.id);
                            setContextMenuElementId(null);
                          }}>
                            Send to Back
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    
                    {/* Resize Handles - All sides and corners */}
                    {isSelected && (
                      <>
                        {/* Action Buttons */}
                        <div className="absolute -top-10 right-0 flex items-center gap-2 z-20">
                          {/* Remove Background Button (only for videos) */}
                          {element.type === "video" && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('[Background Removal] Button clicked for element:', element.id, 'URL:', element.url);
                                handleRemoveBackground(element.id);
                              }}
                              disabled={removingBackground === element.id}
                              className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                              title="Remove Background"
                            >
                              {removingBackground === element.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <Wand2 className="w-3 h-3" />
                                  <span>Remove BG</span>
                                </>
                              )}
                            </button>
                          )}
                          
                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCanvasElement(element.id);
                            }}
                            className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-20"
                            title="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Corner Handles */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-10" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-10" />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-10" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-10" />
                        
                        {/* Edge Handles */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize z-10" />
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize z-10" />
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize z-10" />
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize z-10" />
                      </>
                    )}
                  </div>
                );
              })}
              
              {/* Hidden audio elements for playback (not visible/selectable on canvas) */}
              {canvasElements
                .filter(element => element.type === "audio" && element.url)
                .map((element) => (
                  <audio
                    key={`audio-${element.id}`}
                    id={`canvas-audio-${element.id}`}
                    src={element.url}
                    preload="metadata"
                    muted={element.muted || false}
                    style={{ display: 'none', position: 'absolute', pointerEvents: 'none' }}
                    onLoadedMetadata={(e) => {
                      const audio = e.currentTarget;
                      // Update element duration if not set or if it's still the default 5000ms
                      // This ensures we update from the default placeholder to the actual duration
                      if (audio.duration && audio.duration > 0) {
                        const actualDuration = audio.duration * 1000;
                        // Update if duration is not set, is 0, or is still the default 5000ms placeholder
                        if (!element.duration || element.duration === 0 || element.duration === 5000) {
                          updateCanvasElement(element.id, { duration: actualDuration });
                        }
                      }
                    }}
                  />
                ))}
              
              {/* Render Subtitles — Fancy: fixed bottom half + gradient (no drag) */}
              {activeSubtitle &&
                showSubtitles &&
                !magicCinemaExplainerCoversVideo &&
                subtitleStyle === "fancy" && (
                <div
                  className="pointer-events-none absolute bottom-0 left-0 right-0 flex h-1/2 flex-col justify-end"
                  style={{ zIndex: CANVAS_SUBTITLE_Z }}
                  aria-hidden
                >
                  <div
                    className="flex min-h-full w-full flex-col justify-end px-3 pb-4 pt-10"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.12) 78%, transparent 100%)",
                    }}
                  >
                    <p
                      className="w-full max-w-[100%] text-balance text-center font-black uppercase leading-[1.02] tracking-tight text-white"
                      style={{
                        ...STYLE_FANCY,
                        fontSize: `${Math.min(72, Math.max(20, subtitleFontSize * 0.52))}px`,
                        fontFamily:
                          subtitleFontFamily === "impact"
                            ? "var(--font-impact)"
                            : subtitleFontFamily === "montserrat"
                              ? "var(--font-montserrat)"
                              : subtitleFontFamily === "poppins"
                                ? "var(--font-poppins)"
                                : subtitleFontFamily === "futura"
                                  ? "var(--font-futura)"
                                  : subtitleFontFamily === "roboto"
                                    ? "var(--font-roboto)"
                                    : subtitleFontFamily === "inter"
                                      ? "var(--font-inter)"
                                      : subtitleFontFamily === "zy-resolve"
                                        ? "var(--font-zy-resolve)"
                                        : "var(--font-bebas-neue), Arial Black, system-ui, sans-serif",
                      }}
                    >
                      {activeSubtitle.text}
                    </p>
                  </div>
                </div>
              )}

              {activeSubtitle &&
                showSubtitles &&
                !magicCinemaExplainerCoversVideo &&
                subtitleStyle !== "fancy" && (
                <div
                  data-subtitle-element="true"
                  className={cn(
                    "absolute select-none transition-all",
                    !magicFullCircleActive && !magicTopSlotNoCardActive && "cursor-grab",
                    isDraggingSubtitle && "cursor-grabbing opacity-90 scale-105"
                  )}
                  style={{
                    left: `${subtitlePosition.x}%`,
                    // Circle-pip (full, no top card) forces the subtitle to sit
                    // near the bottom edge of the centered circle (~72%) so it
                    // reads as a caption on the pip rather than floating in the
                    // middle of the face. When the segment had a topSlot card
                    // that got deleted the video occupies only the bottom half
                    // — pin the subtitle to the canvas middle (50%) so it sits
                    // at the boundary between the empty top and the video.
                    top: magicFullCircleActive
                      ? "72%"
                      : magicTopSlotNoCardActive
                        ? "50%"
                        : `${subtitlePosition.y}%`,
                    transform: "translate(-50%, -50%)",
                    width: "95%",
                    maxWidth: "95%",
                    pointerEvents:
                      magicFullCircleActive || magicTopSlotNoCardActive ? "none" : "auto",
                    zIndex: isDraggingSubtitle ? CANVAS_SUBTITLE_DRAG_Z : CANVAS_SUBTITLE_Z,
                  }}
                  onMouseDown={
                    magicFullCircleActive || magicTopSlotNoCardActive
                      ? undefined
                      : handleSubtitleMouseDown
                  }
                >
                  <div
                    className={cn(
                      getSubtitleStyle(subtitleStyle).containerClassName || "rounded-2xl",
                      "w-full"
                    )}
                    style={{ textAlign: 'center' }}
                  >
                    <p
                      className={cn(
                        getSubtitleStyle(subtitleStyle).className
                          .replace(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/g, '')
                          .replace(/font-(sans|serif|mono|black|bold|semibold|medium|normal|light|thin|extralight)/g, ''),
                        subtitleStyle === 'magic-loops' ? "text-center w-full" :
                          subtitleStyle === 'chip' ? "break-words text-center" : "break-words text-center w-full"
                      )}
                      style={{
                        fontSize: `${subtitleFontSize / 100 * 24}px`,
                        wordWrap: subtitleStyle === 'magic-loops' ? 'normal' : 'break-word',
                        overflowWrap: subtitleStyle === 'magic-loops' ? 'normal' : 'break-word',
                        textAlign: 'center',
                        fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                   subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                   subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                   subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                   subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                   subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                   subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                   'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                        ...(subtitleStyle === "outlined"
                          ? OUTLINED_STYLE
                          : subtitleStyle === "elegant"
                          ? { WebkitTextStroke: '4px #000000', paintOrder: 'stroke fill', textShadow: '0px 2px 4px rgba(0,0,0,0.3)' }
                          : subtitleStyle === "karaoke-pink"
                          ? STYLE_KARAOKE_PINK
                          : subtitleStyle === "magic-loops"
                          ? { ...STYLE_MAGIC_LOOPS, display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, textTransform: 'uppercase' as const, whiteSpace: 'normal' as const }
                          : subtitleStyle === "bold-green"
                          ? { ...STYLE_BOLD_GREEN, textTransform: 'uppercase' as const }
                          : subtitleStyle === "chip"
                          ? {
                              ...STYLE_CHIP_TEXT,
                              ...STYLE_CHIP_PILL,
                              // hug the text, center the pill
                              width: 'auto' as const,
                              maxWidth: '92%',
                              margin: '0 auto',
                            }
                          : {})
                      }}
                    >
                      {(() => {
                        // For non-single-line mode, render text directly
                        if (!subtitleSingleLine) {
                          if (subtitleStyle === 'karaoke-pink') {
                            const words = activeSubtitle.text.split(' ').filter(Boolean);
                            const middleIndex = Math.floor(words.length / 2);
                            return words.map((word, idx) => (
                              <span
                                key={idx}
                                style={{
                                  color: '#FFFFFF',
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  marginRight: '2px',
                                  display: 'inline-block',
                                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease-out',
                                  ...(idx === middleIndex ? {
                                    backgroundColor: karaokePillColor,
                                    padding: '4px 4px',
                                    borderRadius: '6px',
                                    transform: 'scale(1.12)',
                                  } : {})
                                }}
                              >
                                {word}
                              </span>
                            ));
                          }
                          if (subtitleStyle === 'magic-loops') {
                            const words = activeSubtitle.text.split(' ').filter(Boolean);
                            const middleIndex = Math.floor(words.length / 2);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                {words.map((word, wordIndex) => {
                                  const isActive = wordIndex === middleIndex;
                                  return (
                                    <div 
                                      key={wordIndex}
                                      style={{ 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        alignItems: 'center',
                                        width: '100%', 
                                        marginBottom: '0px',
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: isActive ? '#6CE846' : '#FFFFFF',
                                          WebkitTextStroke: '2.5px #000000',
                                          paintOrder: 'stroke fill',
                                          display: 'inline-block',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                          transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                          transform: isActive ? 'scale(1.3)' : 'scale(1)',
                                          transformOrigin: 'center center',
                                          verticalAlign: 'baseline',
                                        }}
                                      >
                                        {word}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          if (subtitleStyle === 'bold-green') {
                            const words = activeSubtitle.text.split(' ').filter(Boolean);
                            const middleIndex = Math.floor(words.length / 2);
                            return (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', gap: '10px', flexWrap: 'wrap' }}>
                                {words.map((word, idx) => {
                                  const isActive = idx === middleIndex;
                                  return (
                                    <span
                                      key={idx}
                                      style={{
                                        color: isActive ? boldGreenColor : '#FFFFFF',
                                        WebkitTextStroke: '2.5px #000000',
                                        paintOrder: 'stroke fill',
                                        display: 'inline-block',
                                        whiteSpace: 'nowrap',
                                        transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        textShadow: '2px 2px 0px #000000',
                                        fontWeight: '900',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.2px',
                                        lineHeight: '1.0',
                                        WebkitFontSmoothing: 'antialiased',
                                        MozOsxFontSmoothing: 'grayscale',
                                        fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                                   subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                                   subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                                   subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                                   subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                                   subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                                   subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                                   subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                                   'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          }
                          return activeSubtitle.text;
                        }
                        
                        // Single-line mode: compute current word index based on time
                        const words = activeSubtitle.text.split(' ').filter(Boolean);
                        if (words.length === 0) return '';
                        
                        const segmentDuration = Math.max(activeSubtitle.endMs - activeSubtitle.startMs, 1);
                        const progress = Math.max(0, Math.min(1, (currentTime - activeSubtitle.startMs) / segmentDuration));
                        const currentWordIndex = Math.max(0, Math.min(words.length - 1, Math.floor(progress * words.length)));
                        
                        const isKaraokePinkStyle = subtitleStyle === 'karaoke-pink';
                        const isMagicLoopsStyle = subtitleStyle === 'magic-loops';
                        const isBoldGreenStyle = subtitleStyle === 'bold-green';
                        
                        if (subtitleSingleWord) {
                          const currentWord = words[currentWordIndex] ?? '';
                          return (
                            <span 
                              key={`word-${currentWordIndex}-${currentWord}`}
                              className="mx-1"
                              style={{
                                ...(isKaraokePinkStyle ? {
                                  color: '#FFFFFF',
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  backgroundColor: karaokePillColor,
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  marginRight: '2px',
                                  display: 'inline-block',
                                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease-out',
                                  transform: 'scale(1.12)',
                                } : {}),
                                ...(isMagicLoopsStyle ? {
                                  color: '#6CE846',
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  marginRight: '0px',
                                  display: 'inline-block',
                                  transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                  transform: 'scale(1.3)',
                                  transformOrigin: 'center center',
                                  verticalAlign: 'baseline',
                                } : {}),
                                ...(isBoldGreenStyle ? {
                                  color: boldGreenColor,
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  display: 'inline-block',
                                  textShadow: '2px 2px 0px #000000',
                                  fontWeight: '900',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.2px',
                                  lineHeight: '1.0',
                                  WebkitFontSmoothing: 'antialiased',
                                  MozOsxFontSmoothing: 'grayscale',
                                  fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                             subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                             subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                             subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                             subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                             subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                             subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                             subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                             'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                } : {})
                              }}
                            >
                              {currentWord}
                            </span>
                          );
                        }
                        
                        // 3-word chunk
                        const chunkStart = Math.floor(currentWordIndex / 3) * 3;
                        const from = chunkStart;
                        const to = Math.min(words.length - 1, chunkStart + 2);
                        const chunkWords = words.slice(from, to + 1);
                        
                        if (isMagicLoopsStyle) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                              {chunkWords.map((word, i) => {
                                const idx = from + i;
                                const isActive = idx === currentWordIndex;
                                return (
                                  <div 
                                    key={idx}
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'center', 
                                      alignItems: 'center',
                                      width: '100%', 
                                      marginBottom: '0px',
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: isActive ? '#6CE846' : '#FFFFFF',
                                        WebkitTextStroke: '5px #000000',
                                        paintOrder: 'stroke fill',
                                        display: 'inline-block',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        textShadow: `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 2px 4px rgba(0,0,0,0.40)`,
                                        fontWeight: '800',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.4px',
                                        lineHeight: '1.05',
                                        WebkitFontSmoothing: 'antialiased',
                                        MozOsxFontSmoothing: 'grayscale',
                                        transform: isActive ? 'scale(1.3)' : 'scale(1)',
                                        transformOrigin: 'center center',
                                        verticalAlign: 'baseline',
                                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                                   subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                                   subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                                   subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                                   subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                                   subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                                   subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                                   subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                                   'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                      }}
                                    >
                                      {word}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        return chunkWords.map((word, i) => {
                          const idx = from + i;
                          const isActive = idx === currentWordIndex;
                          return (
                            <span
                              key={`chunk-${idx}-${word}-${isActive}`}
                              className="px-1"
                              style={{
                                color: isKaraokePinkStyle ? '#FFFFFF' : isBoldGreenStyle ? (isActive ? boldGreenColor : '#FFFFFF') : undefined,
                                WebkitTextStroke: isKaraokePinkStyle ? '2.5px #000000' : isBoldGreenStyle ? '2.5px #000000' : undefined,
                                paintOrder: (isKaraokePinkStyle || isBoldGreenStyle) ? 'stroke fill' : undefined,
                                marginRight: (isKaraokePinkStyle || isBoldGreenStyle) ? (isBoldGreenStyle ? '10px' : '2px') : undefined,
                                display: (isKaraokePinkStyle || isBoldGreenStyle) ? 'inline-block' : undefined,
                                transition: isKaraokePinkStyle ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease-out' : isBoldGreenStyle ? 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
                                ...(isKaraokePinkStyle && isActive ? {
                                  backgroundColor: karaokePillColor,
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  transform: 'scale(1.12)',
                                } : {}),
                                ...(isBoldGreenStyle ? {
                                  textShadow: '2px 2px 0px #000000',
                                  fontWeight: '900',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.2px',
                                  lineHeight: '1.0',
                                  WebkitFontSmoothing: 'antialiased',
                                  MozOsxFontSmoothing: 'grayscale',
                                  fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                             subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                             subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                             subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                             subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                             subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                             subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                             subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                             'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                } : {})
                              }}
                            >
                              {word}
                            </span>
                          );
                        });
                      })()}
                    </p>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {canvasElements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center space-y-4">
                    <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Drag elements from the sidebar to add them to the canvas</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-2xl"
                        onClick={() => {
                          setActiveSidebarSection("media");
                          setMediaDialogOpen(true);
                        }}
                      >
                        <VideoIcon className="h-4 w-4" />
                        Add media
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-2xl"
                        onClick={() => {
                          setActiveSidebarSection("avatars");
                          setAvatarsDialogOpen(true);
                        }}
                      >
                        <User className="h-4 w-4" />
                        Create avatar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Properties (when element selected) or Subtitles Editor (when captions active) */}
        {(selectedElementId || (activeSidebarSection === "captions" && subtitleSegments && subtitleSegments.length > 0)) && (
          <div className="w-80 flex-shrink-0 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">
                {activeSidebarSection === "captions" && subtitleSegments && subtitleSegments.length > 0 ? "Subtitles" : "Properties"}
              </h3>
            </div>
            <ScrollArea className="flex-1 p-4 min-h-0">
              <div className="h-full flex flex-col">
                {activeSidebarSection === "captions" && subtitleSegments && subtitleSegments.length > 0 ? (
                  <SubtitlesEditor
                    value={subtitleSrtText || ''}
                    onChange={handleSubtitleSrtChange}
                    onReset={handleRestoreSubtitles}
                    segments={subtitleSegments}
                  />
                ) : selectedElementId ? (() => {
                const element = canvasElements.find(el => el.id === selectedElementId);
                if (!element) return null;
                
                return (
                  <div className="space-y-4">
                    {/* Position */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Position</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">X</Label>
                          <Input
                            type="number"
                            value={element.x.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { x: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Y</Label>
                          <Input
                            type="number"
                            value={element.y.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { y: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Size */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Size</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Width</Label>
                          <Input
                            type="number"
                            value={element.width.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { width: parseFloat(e.target.value) || 10 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Height</Label>
                          <Input
                            type="number"
                            value={element.height.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { height: parseFloat(e.target.value) || 10 })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Rotation */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Rotation: {element.rotation}°</Label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={element.rotation}
                        onChange={(e) => updateCanvasElement(selectedElementId, { rotation: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    
                    {/* Opacity */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Opacity: {Math.round(element.opacity * 100)}%</Label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={element.opacity}
                        onChange={(e) => updateCanvasElement(selectedElementId, { opacity: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    
                    {/* Layer order */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs rounded-xl"
                        onClick={() => bringToFront(selectedElementId)}
                      >
                        Bring to Front
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs rounded-xl"
                        onClick={() => sendToBack(selectedElementId)}
                      >
                        Send to Back
                      </Button>
                    </div>
                    
                    {/* Circle frame (video / image only) */}
                    {(element.type === "video" || element.type === "image") && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="circle-frame"
                          checked={!!element.circleFrame}
                          onChange={(e) => updateCanvasElement(selectedElementId, { circleFrame: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="circle-frame" className="text-xs text-gray-600 cursor-pointer">Circle frame</Label>
                      </div>
                    )}
                    
                    {/* Text Properties (if text element) */}
                    {element.type === "text" && (
                      <>
                        {element.magicSceneExplainer && (
                          <div>
                            <Label className="text-xs text-gray-600 mb-2 block">Subline (explainer)</Label>
                            <Input
                              value={element.explainerSubline || ""}
                              onChange={(e) =>
                                updateCanvasElement(selectedElementId, {
                                  explainerSubline: e.target.value || undefined,
                                })
                              }
                              className="h-8 text-xs"
                              placeholder="Optional short line under headline"
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Text</Label>
                          <Input
                            value={element.text || ""}
                            onChange={(e) => updateCanvasElement(selectedElementId, { text: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Font Size</Label>
                          <Input
                            type="number"
                            value={element.fontSize || 24}
                            onChange={(e) => updateCanvasElement(selectedElementId, { fontSize: parseInt(e.target.value) || 24 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Color</Label>
                          <Input
                            type="color"
                            value={element.fontColor || "#000000"}
                            onChange={(e) => updateCanvasElement(selectedElementId, { fontColor: e.target.value })}
                            className="h-8"
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })() : null}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Bottom Timeline Panel - CapCut Style - Expandable */}
      <div 
        className="flex-shrink-0 border-t border-gray-200 bg-white flex flex-col relative"
        style={{ height: `${timelineHeight}px`, minHeight: '160px', maxHeight: '80vh' }}
      >
        {/* Resize Handle - Drag to resize timeline */}
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-gray-300 hover:bg-blue-500 cursor-ns-resize z-50 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizingTimeline(true);
            setResizeStart({ 
              x: 0, 
              y: e.clientY, 
              width: 0, 
              height: timelineHeight,
              imageOffsetX: 50,
              imageOffsetY: 50
            });
          }}
          title="Drag to resize timeline"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
            <GripVertical className="h-3 w-3 text-gray-500" />
            <GripVertical className="h-3 w-3 text-gray-500" />
          </div>
        </div>
        
        {/* Top Controls Bar - CapCut Style */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 bg-white">
          {/* Left: Play Button + Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayback}
              className="w-8 h-8 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 text-white" />
              ) : (
                <Play className="h-4 w-4 text-white ml-0.5" />
              )}
            </button>
            <div className="text-xs font-mono text-gray-900 font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          {/* Right: Tool Icons */}
          <div className="flex items-center gap-2">
            {/* Save Button */}
            {currentProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[Save] Save button clicked (top bar)');
                  try {
                    await handleSaveProject();
                  } catch (error) {
                    console.error('[Save] Error in onClick handler (top bar):', error);
                    // Error already handled in handleSaveProject
                  }
                }}
                className="h-7 px-3 text-xs border-gray-300 bg-white hover:bg-gray-50"
                title="Save Project"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>
            )}
            {/* Playback Speed Control */}
            <Select value={playbackRate.toString()} onValueChange={(value) => setPlaybackRate(parseFloat(value))}>
              <SelectTrigger className="h-7 w-16 text-xs border-gray-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="1.7">1.7x</SelectItem>
                <SelectItem value="1.75">1.75x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="2.5">2.5x</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={toggleMute}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-gray-600" />
              ) : (
                <Volume2 className="h-4 w-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Timeline Area - CapCut Style */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Time Ruler */}
          <div className="h-6 border-b border-gray-200 bg-white relative overflow-hidden">
            {/* Track Controls Spacer - matches track controls width (w-20 = 80px) */}
            <div className="absolute left-0 top-0 bottom-0 w-20 border-r border-gray-200 bg-gray-50"></div>
            <div 
              className="flex items-center h-full pl-20 pr-4 min-w-full relative cursor-pointer" 
              style={{ width: '100%' }}
              onClick={(e) => {
                // Don't scrub if clicking on the playhead
                const target = e.target as HTMLElement;
                if (target.closest('.cursor-ew-resize')) {
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left - 80; // Account for pl-20 (80px) padding
                const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
                const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
                const newTime = (percentage / 100) * (duration || 1000);
                handleTimelineScrub(newTime);
                console.log('🖱️ Time ruler clicked:', { clickX, contentWidth, percentage, newTime });
              }}
            >
              {(() => {
                // Calculate time mark interval based on timeline scale
                // More marks for detailed view (short videos), fewer for compressed view (long videos)
                let intervalSeconds = 30; // Default 30 seconds
                if (timelineScale >= 50) {
                  intervalSeconds = 10; // 10 second marks for detailed view
                } else if (timelineScale >= 20) {
                  intervalSeconds = 30; // 30 second marks for medium view
                } else {
                  intervalSeconds = 60; // 60 second (1 minute) marks for compressed view
                }
                
                const durationSeconds = (duration || 60000) / 1000;
                const numMarks = Math.ceil(durationSeconds / intervalSeconds) + 1;
                
                return Array.from({ length: numMarks }, (_, i) => {
                  const time = i * intervalSeconds;
                  const minutes = Math.floor(time / 60);
                  const seconds = time % 60;
                  const timeMs = time * 1000;
                  // Position starts at 80px (after track controls), then add percentage of content width
                  // Content width = 100% - 80px (left padding) - 16px (right padding)
                  const leftPercent = duration > 0 ? (timeMs / duration) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="absolute flex flex-col items-center"
                      style={{ 
                        left: `calc(80px + ${leftPercent}% * (100% - 96px) / 100%)`,
                        transform: 'translateX(-50%)' // Center the time mark on the exact time position
                      }}
                    >
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5 whitespace-nowrap">
                        {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                      </div>
                      <div className="w-px h-3 bg-gray-300"></div>
                    </div>
                  );
                });
              })()}
              
              {/* Playhead - Red Line with Circle - Only in Time Ruler - Draggable */}
              <div
                className="absolute top-0 bottom-0 z-40"
                style={{ 
                  // Position starts at 80px (after track controls), then add percentage of content width
                  left: duration > 0 
                    ? `calc(80px + ${(currentTime / duration) * 100}% * (100% - 96px) / 100%)` 
                    : '80px',
                  transform: 'translateX(-50%)' // Center the playhead on the exact time position
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsDraggingPlayhead(true);
                  console.log('🖱️ Playhead drag started');
                }}
              >
              
              {/* Blue Overlap Indicator - Shows when trimming approaches another element */}
              {trimOverlapIndicator && isTrimming && (
                <div
                  className="absolute top-0 bottom-0 z-35 pointer-events-none"
                  style={{ 
                    // Position starts at 80px (after track controls), then add percentage of content width
                    left: duration > 0 
                      ? `calc(80px + ${(trimOverlapIndicator.time / duration) * 100}% * (100% - 96px) / 100%)` 
                      : '80px',
                    transform: 'translateX(-50%)', // Center the line on the exact time position
                    width: '2px',
                    backgroundColor: '#3b82f6', // Blue color
                    boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)' // Subtle glow
                  }}
                />
              )}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-red-500 pointer-events-none"></div>
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform cursor-ew-resize"></div>
              </div>
            </div>
          </div>

          {/* Tracks Container */}
          <div 
            ref={timelineContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden relative bg-white"
          >
            {/* Blue Overlap Indicator - Shows when trimming approaches another element (spans all tracks) */}
            {trimOverlapIndicator && isTrimming && (
              <div
                className="absolute top-0 bottom-0 z-35 pointer-events-none"
                style={{ 
                  // Position starts at 80px (after track controls), then add percentage of content width
                  left: duration > 0 
                    ? `calc(80px + ${(trimOverlapIndicator.time / duration) * 100}% * (100% - 96px) / 100%)` 
                    : '80px',
                  transform: 'translateX(-50%)', // Center the line on the exact time position
                  width: '2px',
                  backgroundColor: '#3b82f6', // Blue color
                  boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)' // Subtle glow
                }}
              />
            )}
            
            {(() => {
              // Calculate total height needed for all tracks
              const mediaElements = canvasElements.filter(el => el.type === "video" || el.type === "image").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
              const mediaTracks: Array<Array<typeof mediaElements[0]>> = [];
              mediaElements.forEach((element) => {
                let placed = false;
                for (const track of mediaTracks) {
                  const canPlace = track.every(existing => {
                    const existingStart = existing.startTime || 0;
                    const existingEnd = existingStart + (existing.duration || 5000);
                    const elementStart = element.startTime || 0;
                    const elementEnd = elementStart + (element.duration || 5000);
                    return elementEnd <= existingStart || elementStart >= existingEnd;
                  });
                  if (canPlace) {
                    track.push(element);
                    placed = true;
                    break;
                  }
                }
                if (!placed) {
                  mediaTracks.push([element]);
                }
              });
              
              const audioElements = canvasElements.filter(el => el.type === "audio");
              const hasAudio = audioElements.length > 0;
              // Magic scene-explainer cards (the title/subline text slides auto-placed by
              // Magic Create). Each one gets its own row in the timeline so the user can
              // click to edit it, trim its duration, drag it, or delete it.
              const explainerCards = canvasElements.filter(
                el => el.type === "text" && !!el.magicSceneExplainer && !el.magicSceneExplainerStock
              );
              const hasExplainerTrack = explainerCards.length > 0;
              const totalTracks =
                mediaTracks.length + (hasExplainerTrack ? 1 : 0) + (hasAudio ? 1 : 0);
              const minHeight = Math.max(200, totalTracks * 56); // 56px per track, minimum 200px
              
              return (
                <div className="relative pl-20 pr-4" style={{ width: '100%', minHeight: `${minHeight}px` }}>
              {/* Clickable Background for Scrubbing - Exclude track controls area (first 80px) */}
              {/* Only handle clicks when not clicking on video/image items or trim handles */}
              <div
                className="absolute left-20 right-0 top-0 bottom-0 cursor-pointer z-10"
                onClick={(e) => {
                  // Don't scrub if clicking on a video/image item or trim handle
                  const target = e.target as HTMLElement;
                  if (target.closest('.group') || target.closest('[class*="z-20"]') || target.closest('.trim-handle')) {
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  // left-20 means 80px offset, so clickX is already relative to the content area
                  const clickX = e.clientX - rect.left;
                  const contentWidth = rect.width; // This is already the content width (left-20 excludes the 80px)
                  const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
                  const newTime = (percentage / 100) * (duration || 1000);
                  console.log('🖱️ Timeline tracks clicked:', { clickX, contentWidth, percentage, newTime });
                  handleTimelineScrub(newTime);
                }}
                onMouseMove={(e) => {
                  // Only scrub on drag if not dragging a timeline item, trimming, or playhead
                  if (e.buttons === 1 && !isDraggingTimeline && !isTrimming && !isDraggingPlayhead) {
                    const target = e.target as HTMLElement;
                    if (target.closest('.group') || target.closest('[class*="z-20"]') || target.closest('.trim-handle')) {
                      return;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                    const newTime = (percentage / 100) * (duration || 1000);
                    handleTimelineScrub(newTime);
                  }
                }}
              />

              {/* Media Tracks - Group sequential videos and images on the same track */}
              {(() => {
                // Group videos and images into tracks - elements that are sequential (one starts right after another) go on the same track
                const mediaElements = canvasElements.filter(el => el.type === "video" || el.type === "image").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                const tracks: Array<Array<typeof mediaElements[0]>> = [];
                
                mediaElements.forEach((element) => {
                  // Find a track where this element can fit (doesn't overlap with existing elements)
                  let placed = false;
                  for (const track of tracks) {
                    // Check if this element can be placed on this track (no overlap)
                    const canPlace = track.every(existing => {
                      const existingStart = existing.startTime || 0;
                      const existingEnd = existingStart + (existing.duration || 5000);
                      const elementStart = element.startTime || 0;
                      const elementEnd = elementStart + (element.duration || 5000);
                      // No overlap: element ends before existing starts, or element starts after existing ends
                      return elementEnd <= existingStart || elementStart >= existingEnd;
                    });
                    
                    if (canPlace) {
                      track.push(element);
                      placed = true;
                      break;
                    }
                  }
                  
                  // If couldn't place on existing track, create new track
                  if (!placed) {
                    tracks.push([element]);
                  }
                });
                
                return tracks.map((track, trackIdx) => (
                  <div 
                    key={`track-${trackIdx}`}
                    className="absolute left-0 right-0 h-14 border-b border-gray-200 bg-white"
                    style={{ top: `${trackIdx * 56}px` }} // 56px = 14 * 4 (h-14 = 3.5rem = 56px)
                  >
                    <div className="h-full flex items-center">
                      {/* Track Controls (Left Side) */}
                      <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center gap-1">
                        <div className="text-xs text-gray-600 font-medium">
                          Track {trackIdx + 1}
                        </div>
                        {/* Mute button for first video in track (only show for videos, not images) */}
                        {track.length > 0 && track[0].type === "video" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              toggleVideoMute(track[0].id);
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors z-20 relative"
                            title={track[0].muted ? "Unmute" : "Mute"}
                          >
                            {track[0].muted ? (
                              <VolumeX className="h-3 w-3 text-gray-600" />
                            ) : (
                              <Volume2 className="h-3 w-3 text-gray-600" />
                            )}
                          </button>
                        )}
                      </div>
                      
                      {/* Track Content */}
                      <div className="flex-1 h-full relative overflow-visible timeline-tracks-container">
                        {track.map((element) => {
                          // Use timeline properties (startTime, duration) instead of canvas position
                          const elementStartTime = element.startTime || 0;
                          const elementDuration = element.duration || (duration || 5000);
                          const trackLeft = duration > 0 ? (elementStartTime / duration) * 100 : 0;
                          const trackWidth = duration > 0 ? (elementDuration / duration) * 100 : 10;
                          
                          // Thumbnail width is calculated dynamically based on timeline scale
                          // This ensures thumbnails match the timeline calibration
                          
                          // Determine border color and label based on element type
                          const isImage = element.type === "image";
                          // Check if this is a B-roll clip (muted video overlay with videoStartOffset)
                          const isBRollClip =
                            element.type === "video" &&
                            element.muted === true &&
                            element.videoStartOffset !== undefined &&
                            (element.bRollOverlay === true ||
                              (element.x === 0 &&
                                element.y === 0 &&
                                element.width === 100 &&
                                element.height === 100));
                          const borderColor = isImage 
                            ? "border-purple-300 hover:border-purple-500" 
                            : isBRollClip 
                            ? "border-green-300 hover:border-green-500" 
                            : "border-blue-300 hover:border-blue-500";
                          const trimHandleColor = isImage 
                            ? "bg-purple-500 hover:bg-purple-600" 
                            : isBRollClip 
                            ? "bg-green-500 hover:bg-green-600" 
                            : "bg-blue-500 hover:bg-blue-600";
                          
                          return (
                            <div
                              key={element.id}
                              className={cn(
                                "group absolute top-2 bottom-2 overflow-visible cursor-move hover:opacity-90 transition-opacity border-2 bg-gray-100 z-20",
                                element.circleFrame ? "rounded-full" : "rounded",
                                borderColor
                              )}
                              style={{ 
                                left: `${trackLeft}%`,
                                width: `${trackWidth}%`,
                                minWidth: '50px'
                              }}
                              onMouseDown={(e) => {
                                // Don't start dragging if clicking on trim handles or mute button
                                const target = e.target as HTMLElement;
                                if (target.closest('.trim-handle') || target.closest('button')) {
                                  return;
                                }
                                e.stopPropagation();
                                e.preventDefault();
                                // Select the element first
                                setSelectedElementId(element.id);
                                // Start dragging
                                setIsDraggingTimeline(true);
                                setDraggingTimelineElementId(element.id);
                                setDragTimelineStart({
                                  x: e.clientX,
                                  startTime: elementStartTime
                                });
                              }}
                              title={`${isImage ? 'Image' : isBRollClip ? 'B-roll' : 'Video'} - Drag to move on timeline`}
                            >
                              {/* Render video or image content */}
                              <div className={cn("h-full flex items-center overflow-hidden relative pointer-events-none", element.circleFrame ? "rounded-full" : "rounded")} style={{ width: '100%' }}>
                                {isImage ? (
                                  // Image element
                                  element.url ? (
                                    <img
                                      src={element.url}
                                      alt={`Image`}
                                      className={cn("h-full w-full object-cover", element.circleFrame && "rounded-full")}
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-purple-500 text-[8px] text-white rounded">
                                      Image
                                    </div>
                                  )
                                ) : (
                                  // Video element
                                  <>
                                    {element.thumbnail ? (
                                      // Use repeating background pattern for CapCut-like effect
                                      <div 
                                        className={cn("h-full w-full pointer-events-none", element.circleFrame && "rounded-full")}
                                        style={{ 
                                          backgroundImage: `url(${element.thumbnail})`,
                                          backgroundSize: `${thumbnailWidth}px 100%`,
                                          backgroundRepeat: 'repeat-x',
                                          backgroundPosition: 'left center',
                                          imageRendering: 'auto'
                                        }}
                                      />
                                    ) : element.url ? (
                                      // If no thumbnail yet, try to generate it
                                      <VideoThumbnailGenerator 
                                        videoUrl={element.url} 
                                        elementId={element.id}
                                        onThumbnailGenerated={(thumbnail) => {
                                          updateCanvasElement(element.id, { thumbnail });
                                        }}
                                      />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center bg-orange-500 text-[8px] text-white rounded pointer-events-none">
                                        Video
                                      </div>
                                    )}
                                  </>
                                )}
                                {/* Label overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[8px] px-1 py-0.5 truncate pointer-events-none">
                                  {isImage ? 'Image' : 'Video'}
                                </div>
                              </div>
                              
                              {/* Split at playhead - only when this clip is selected and playhead is inside */}
                              {selectedElementId === element.id && (() => {
                                const elStart = elementStartTime;
                                const elEnd = elementStartTime + elementDuration;
                                const canSplit = currentTime > elStart && currentTime < elEnd;
                                return (
                                  <button
                                    type="button"
                                    className={cn(
                                      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all pointer-events-auto",
                                      canSplit
                                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                                        : "bg-gray-400 cursor-not-allowed text-white/80"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (canSplit) splitElementAtPlayhead(element.id);
                                    }}
                                    disabled={!canSplit}
                                    title={canSplit ? "Split at playhead" : "Move playhead inside this clip to split"}
                                  >
                                    <Scissors className="h-3.5 w-3.5" />
                                  </button>
                                );
                              })()}
                              
                              {/* Left Trim Handle - Always visible, more prominent when selected */}
                              <div
                                className={`trim-handle absolute left-0 top-0 bottom-0 cursor-ew-resize ${trimHandleColor} transition-all shadow-lg group/trim`}
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const initialX = e.clientX;
                                  console.log('🖱️ TRIM CLICK - Left handle:', {
                                    elementId: element.id,
                                    initialX,
                                    elementStartTime: element.startTime,
                                    elementDuration: element.duration,
                                    elementVideoStartOffset: element.videoStartOffset
                                  });
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('left');
                                  setTrimStart({ x: initialX });
                                  // Store initial element state to prevent accumulation during trim
                                  trimStartRef.current = { 
                                    x: initialX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: element.audioStartOffset || 0
                                  };
                                  console.log('✅ TRIM CLICK - Left handle state set:', {
                                    isTrimming: true,
                                    trimElementId: element.id,
                                    trimEdge: 'left',
                                    trimStartRef: trimStartRef.current
                                  });
                                }}
                                title={`Trim start - ${(element.videoStartOffset || 0) / 1000}s trimmed from start`}
                              >
                                {/* Tooltip showing trimmed seconds */}
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                  Start: {(element.videoStartOffset || 0) / 1000}s
                                </div>
                              </div>
                              
                              {/* Right Trim Handle - Always visible, more prominent when selected */}
                              <div
                                className={`trim-handle absolute right-0 top-0 bottom-0 cursor-ew-resize ${trimHandleColor} transition-all shadow-lg group/trim-right`}
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const initialX = e.clientX;
                                  console.log('🖱️ TRIM CLICK - Right handle:', {
                                    elementId: element.id,
                                    initialX,
                                    elementStartTime: element.startTime,
                                    elementDuration: element.duration,
                                    elementVideoStartOffset: element.videoStartOffset
                                  });
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('right');
                                  setTrimStart({ x: initialX });
                                  // Store initial element state to prevent accumulation during trim
                                  trimStartRef.current = { 
                                    x: initialX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: element.audioStartOffset || 0
                                  };
                                  console.log('✅ TRIM CLICK - Right handle state set:', {
                                    isTrimming: true,
                                    trimElementId: element.id,
                                    trimEdge: 'right',
                                    trimStartRef: trimStartRef.current
                                  });
                                }}
                                title={`Trim end - Drag to cut end`}
                              >
                                {/* Tooltip showing clip duration */}
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim-right:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                  Duration: {((element.duration || 0) / 1000).toFixed(2)}s
                                </div>
                              </div>
                              
                              {/* Add Button - Appears after the element */}
                              <button
                                className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-1 w-6 h-6 rounded-full ${isImage ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'} text-white flex items-center justify-center shadow-lg hover:scale-110 transition-all z-30`}
                                style={{
                                  pointerEvents: 'auto'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setInsertAfterElementId(element.id);
                                  setMediaDialogOpen(true);
                                  // Load all media in parallel with timeout protection
                                  Promise.allSettled([
                                    loadGeneratedVideos(),
                                    loadUploadedImages(),
                                    loadUploadedVideos()
                                  ]).then((results) => {
                                    const errors = results.filter(r => r.status === 'rejected');
                                    if (errors.length > 0) {
                                      console.warn("Some media failed to load:", errors);
                                    }
                                  });
                                }}
                                title="Add video or image after this"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ));
              })()}

              {/* ---- Scenes Track (Magic scene-explainer cards) ---------------
               * Placed between the media tracks and the audio track. Each pill
               * represents one explainer beat (type === "text" + magicSceneExplainer)
               * from Magic Create; clicking selects it so the right-side
               * inspector lets you edit its text / subline / font, the trim
               * handles resize the beat's on-screen window, and the × button
               * deletes the beat along with its paired Freepik illustration
               * (magicSceneExplainerStock) companion.
               */}
              {(() => {
                const explainerCards = canvasElements
                  .filter(el => el.type === "text" && !!el.magicSceneExplainer && !el.magicSceneExplainerStock)
                  .sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                if (explainerCards.length === 0) return null;

                const mediaTracksCount = (() => {
                  const mediaElements = canvasElements.filter(el => el.type === "video" || el.type === "image").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                  const tracks: Array<Array<typeof mediaElements[0]>> = [];
                  mediaElements.forEach((element) => {
                    let placed = false;
                    for (const track of tracks) {
                      const canPlace = track.every(existing => {
                        const existingStart = existing.startTime || 0;
                        const existingEnd = existingStart + (existing.duration || 5000);
                        const elementStart = element.startTime || 0;
                        const elementEnd = elementStart + (element.duration || 5000);
                        return elementEnd <= existingStart || elementStart >= existingEnd;
                      });
                      if (canPlace) { track.push(element); placed = true; break; }
                    }
                    if (!placed) tracks.push([element]);
                  });
                  return tracks.length;
                })();

                const scenesTrackTop = mediaTracksCount * 56;

                // Tint the pill by scene style so the user can spot at a glance
                // which beat is a cinematic black overlay, a split card, etc.
                const sceneStyleColor = (style?: string): { bg: string; border: string; label: string } => {
                  switch (style) {
                    case "subtitle-cinema":
                      return { bg: "bg-neutral-900", border: "border-neutral-700 hover:border-neutral-400", label: "Cinema" };
                    case "fancy-split":
                      return { bg: "bg-indigo-500", border: "border-indigo-300 hover:border-indigo-500", label: "Split" };
                    case "fancy-minimal":
                      return { bg: "bg-sky-500", border: "border-sky-300 hover:border-sky-500", label: "Minimal" };
                    case "emphasis-explode":
                      return { bg: "bg-rose-500", border: "border-rose-300 hover:border-rose-500", label: "Explode" };
                    case "checklist-reveal":
                      return { bg: "bg-emerald-500", border: "border-emerald-300 hover:border-emerald-500", label: "Checklist" };
                    case "ticker-stack":
                      return { bg: "bg-amber-500", border: "border-amber-300 hover:border-amber-500", label: "Ticker" };
                    case "reaction-burst":
                      return { bg: "bg-fuchsia-500", border: "border-fuchsia-300 hover:border-fuchsia-500", label: "Reaction" };
                    case "vs-split":
                      return { bg: "bg-orange-500", border: "border-orange-300 hover:border-orange-500", label: "VS" };
                    case "question-shrug":
                      return { bg: "bg-violet-500", border: "border-violet-300 hover:border-violet-500", label: "Question" };
                    default:
                      return { bg: "bg-slate-500", border: "border-slate-300 hover:border-slate-500", label: "Scene" };
                  }
                };

                return (
                  <div
                    key="scenes-track"
                    className="absolute left-0 right-0 h-14 border-b border-gray-200 bg-white"
                    style={{ top: `${scenesTrackTop}px` }}
                  >
                    <div className="h-full flex items-center">
                      <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center">
                        <div className="text-xs text-gray-600 font-medium">Scenes</div>
                      </div>
                      <div className="flex-1 h-full relative overflow-visible timeline-tracks-container">
                        {explainerCards.map((element) => {
                          const elementStartTime = element.startTime || 0;
                          const elementDuration = element.duration || 2000;
                          const trackLeft = duration > 0 ? (elementStartTime / duration) * 100 : 0;
                          const trackWidth = duration > 0 ? (elementDuration / duration) * 100 : 10;
                          const tint = sceneStyleColor(element.explainerSceneStyle);
                          const previewText = (element.text || element.explainerAccentLabel || tint.label).trim();
                          return (
                            <div
                              key={element.id}
                              className={cn(
                                "group absolute top-2 bottom-2 overflow-visible cursor-move transition-opacity border-2 bg-gray-100 z-20 rounded",
                                tint.border,
                                selectedElementId === element.id ? "ring-2 ring-blue-500" : "hover:opacity-90"
                              )}
                              style={{ left: `${trackLeft}%`, width: `${trackWidth}%`, minWidth: "40px" }}
                              onMouseDown={(e) => {
                                const target = e.target as HTMLElement;
                                if (target.closest(".trim-handle") || target.closest("button")) return;
                                e.stopPropagation();
                                e.preventDefault();
                                setSelectedElementId(element.id);
                                setIsDraggingTimeline(true);
                                setDraggingTimelineElementId(element.id);
                                setDragTimelineStart({ x: e.clientX, startTime: elementStartTime });
                              }}
                              title={`${tint.label} scene — click to edit, drag to move, × to delete`}
                            >
                              {/* Pill body with scene label + preview text */}
                              <div className={cn("h-full w-full flex items-center overflow-hidden rounded pointer-events-none relative", tint.bg)}>
                                <div className="px-2 text-white text-[10px] leading-tight truncate w-full">
                                  <span className="font-semibold opacity-90">{tint.label}</span>
                                  {previewText ? <span className="opacity-80"> · {previewText}</span> : null}
                                </div>
                              </div>

                              {/* Delete button */}
                              <button
                                className="absolute -top-2 -right-2 z-30 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                                style={{ pointerEvents: "auto" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  deleteExplainerCardWithCompanion(element.id);
                                }}
                                title="Delete this scene (also removes its illustration)"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>

                              {/* Left trim handle */}
                              <div
                                className="trim-handle absolute left-0 top-0 bottom-0 cursor-ew-resize bg-white/70 hover:bg-white transition-all shadow"
                                style={{
                                  width: "8px",
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: "auto",
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge("left");
                                  setTrimStart({ x: e.clientX });
                                  trimStartRef.current = {
                                    x: e.clientX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: 0,
                                    audioStartOffset: 0,
                                  };
                                }}
                                title={`Start: ${(elementStartTime / 1000).toFixed(2)}s`}
                              />

                              {/* Right trim handle */}
                              <div
                                className="trim-handle absolute right-0 top-0 bottom-0 cursor-ew-resize bg-white/70 hover:bg-white transition-all shadow"
                                style={{
                                  width: "8px",
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: "auto",
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge("right");
                                  setTrimStart({ x: e.clientX });
                                  trimStartRef.current = {
                                    x: e.clientX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: 0,
                                    audioStartOffset: 0,
                                  };
                                }}
                                title={`Duration: ${(elementDuration / 1000).toFixed(2)}s`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Audio Track - Single track for all audio elements */}
              {(() => {
                const audioElements = canvasElements.filter(el => el.type === "audio").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                if (audioElements.length === 0) return null;
                
                // Calculate the top position for audio track (after all media tracks
                // AND the Scenes track if it's present).
                const mediaTracksCount = (() => {
                  const mediaElements = canvasElements.filter(el => el.type === "video" || el.type === "image").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                  const tracks: Array<Array<typeof mediaElements[0]>> = [];
                  mediaElements.forEach((element) => {
                    let placed = false;
                    for (const track of tracks) {
                      const canPlace = track.every(existing => {
                        const existingStart = existing.startTime || 0;
                        const existingEnd = existingStart + (existing.duration || 5000);
                        const elementStart = element.startTime || 0;
                        const elementEnd = elementStart + (element.duration || 5000);
                        return elementEnd <= existingStart || elementStart >= existingEnd;
                      });
                      if (canPlace) {
                        track.push(element);
                        placed = true;
                        break;
                      }
                    }
                    if (!placed) {
                      tracks.push([element]);
                    }
                  });
                  return tracks.length;
                })();

                const hasExplainerTrack = canvasElements.some(
                  el => el.type === "text" && !!el.magicSceneExplainer && !el.magicSceneExplainerStock
                );
                const audioTrackTop = (mediaTracksCount + (hasExplainerTrack ? 1 : 0)) * 56;
                
                return (
                  <div 
                    key="audio-track"
                    className="absolute left-0 right-0 h-14 border-b border-gray-200 bg-white"
                    style={{ top: `${audioTrackTop}px` }}
                  >
                    <div className="h-full flex items-center">
                      {/* Track Controls (Left Side) */}
                      <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center gap-1">
                        <div className="text-xs text-gray-600 font-medium">
                          Audio
                        </div>
                        {/* Mute button for first audio in track */}
                        {audioElements.length > 0 && (
                        <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const firstAudio = audioElements[0];
                              updateCanvasElement(firstAudio.id, { muted: !firstAudio.muted });
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors z-20 relative"
                            title={audioElements[0].muted ? "Unmute" : "Mute"}
                          >
                            {audioElements[0].muted ? (
                              <VolumeX className="h-3 w-3 text-gray-600" />
                            ) : (
                              <Volume2 className="h-3 w-3 text-gray-600" />
                          )}
                        </button>
                        )}
                      </div>
                      
                      {/* Track Content */}
                      <div className="flex-1 h-full relative overflow-visible timeline-tracks-container">
                        {audioElements.map((element) => {
                          const elementStartTime = element.startTime || 0;
                          const elementDuration = element.duration || (duration || 5000);
                          // Calculate position - clamp to prevent negative positioning
                          const trackLeft = duration > 0 ? Math.max(0, (elementStartTime / duration) * 100) : 0;
                          const trackWidth = duration > 0 ? (elementDuration / duration) * 100 : 10;
                          
                          return (
                            <div
                              key={element.id}
                              className="group absolute top-2 bottom-2 rounded overflow-visible cursor-move hover:opacity-90 transition-opacity border-2 border-green-300 hover:border-green-500 bg-gray-100 z-20"
                              style={{ 
                                left: `${trackLeft}%`,
                                width: `${trackWidth}%`,
                                minWidth: '50px'
                              }}
                              onMouseDown={(e) => {
                                const target = e.target as HTMLElement;
                                if (target.closest('.trim-handle') || target.closest('button')) {
                                  return;
                                }
                                e.stopPropagation();
                                e.preventDefault();
                                setSelectedElementId(element.id);
                                setIsDraggingTimeline(true);
                                setDraggingTimelineElementId(element.id);
                                setDragTimelineStart({
                                  x: e.clientX,
                                  startTime: elementStartTime
                                });
                              }}
                              title="Audio - Drag to move on timeline"
                            >
                              {/* Render audio content with waveform */}
                              <div className="h-full flex items-center overflow-hidden rounded relative pointer-events-none" style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                                {/* Waveform visualization */}
                                <AudioWaveform 
                                  audioUrl={element.url} 
                                  audioStartOffset={element.audioStartOffset || 0}
                                  duration={elementDuration}
                                  width="100%"
                                  height="100%"
                                />
                                {/* Label overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[8px] px-1 py-0.5 truncate pointer-events-none z-10">
                                  Audio
                              </div>
                              </div>
                              
                              {/* Left Trim Handle */}
                              <div
                                className="trim-handle absolute left-0 top-0 bottom-0 cursor-ew-resize bg-green-500 hover:bg-green-600 transition-all shadow-lg group/trim-audio-left"
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  console.log('🖱️ LEFT TRIM CLICK - Audio element:', {
                                    elementId: element.id,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    audioStartOffset: element.audioStartOffset,
                                    audioStartOffsetDefaulted: element.audioStartOffset || 0
                                  });
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('left');
                                  setTrimStart({ x: e.clientX });
                                  // Ensure audioStartOffset is always set (default to 0 if undefined)
                                  const currentAudioStartOffset = element.audioStartOffset ?? 0;
                                  trimStartRef.current = { 
                                    x: e.clientX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: currentAudioStartOffset
                                  };
                                  console.log('✅ LEFT TRIM - Ref set:', trimStartRef.current);
                                }}
                                title={`Trim start - Audio: ${((element.audioStartOffset || 0) / 1000).toFixed(2)}s`}
                              >
                                {/* Tooltip showing audio start/end seconds */}
                                {(() => {
                                  const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
                                  const audioStartSeconds = (element.audioStartOffset || 0) / 1000;
                                  const audioEndSeconds = audio && element.duration ? ((element.audioStartOffset || 0) + element.duration) / 1000 : null;
                                  return (
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim-audio-left:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                      Start: {audioStartSeconds.toFixed(2)}s
                                      {audioEndSeconds !== null ? (
                                        <> | End: {audioEndSeconds.toFixed(2)}s</>
                                      ) : null}
                            </div>
                          );
                                })()}
                          </div>
                              
                              {/* Right Trim Handle */}
                              <div
                                className="trim-handle absolute right-0 top-0 bottom-0 cursor-ew-resize bg-green-500 hover:bg-green-600 transition-all shadow-lg group/trim-audio-right"
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('right');
                                  setTrimStart({ x: e.clientX });
                                  trimStartRef.current = { 
                                    x: e.clientX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: element.audioStartOffset || 0
                                  };
                                }}
                                title={`Trim end - Audio: ${(((element.audioStartOffset || 0) + (element.duration || 0)) / 1000).toFixed(2)}s`}
                              >
                                {/* Tooltip showing audio start/end seconds */}
                                {(() => {
                                  const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
                                  const audioStartSeconds = (element.audioStartOffset || 0) / 1000;
                                  const audioEndSeconds = audio && element.duration ? ((element.audioStartOffset || 0) + element.duration) / 1000 : null;
                                  return (
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim-audio-right:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                      Start: {audioStartSeconds.toFixed(2)}s
                                      {audioEndSeconds !== null ? (
                                        <> | End: {audioEndSeconds.toFixed(2)}s</>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {canvasElements.filter(el => el.type === "video" || el.type === "image").length === 0 && (
                <div className="absolute top-0 left-0 right-0 h-14 border-b border-gray-200 bg-white">
                  <div className="h-full flex items-center">
                    <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center">
                      <div className="text-xs text-gray-600 font-medium">
                        Track (0)
            </div>
          </div>
                    <div className="flex-1 h-full relative overflow-hidden flex items-center justify-center text-xs text-gray-400">
                      No media tracks
                    </div>
                  </div>
                </div>
              )}

                </div>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Hidden main video player for timeline sync - muted when canvas videos exist to prevent echo */}
      {lipSyncVideoUrl && (
        <video
          ref={mainVideoPlayerRef}
          src={lipSyncVideoUrl}
          className="hidden"
          onTimeUpdate={(e) => {
            // Only sync if there are no canvas videos (canvas videos drive timeline via animation frame)
            // When canvas videos exist, let the animation frame loop drive the timeline
            if (canvasElements.filter(el => el.type === "video" && el.url).length === 0) {
            const video = e.currentTarget;
            setCurrentTime(video.currentTime * 1000);
            }
          }}
          onLoadedMetadata={(e) => {
            const mainVideo = e.currentTarget;
            // Apply playback rate when video loads (with preservesPitch)
            if (mainVideo.playbackRate !== playbackRate) {
              setVideoPlaybackRate(mainVideo, playbackRate);
            }
            setDuration(mainVideo.duration * 1000);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            // Reset timeline to beginning
            setCurrentTime(0);
            // Reset all canvas videos to beginning
            canvasElements.forEach(element => {
              if (element.type === "video" && element.url) {
                const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
                if (video) {
                  video.currentTime = 0;
                }
              }
            });
            // Reset main video player
            if (mainVideoPlayerRef.current) {
              mainVideoPlayerRef.current.currentTime = 0;
            }
          }}
          muted={isMuted || canvasElements.some(el => el.type === "video" && el.url)}
        />
      )}

      {/* Avatar Selection Dialog */}
      <Dialog
        open={avatarsDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setAvatarNextError(null);
            setCreatingProjectFromAvatar(false);
          }
          setAvatarsDialogOpen(open);
        }}
      >
        <DialogContent className="!w-[80vw] !h-[80vh] !max-w-[80vw] !max-h-[80vh] !sm:max-w-[80vw] overflow-y-auto p-6">
          <DialogHeader className="flex flex-row items-start justify-between gap-4 pr-12">
            <div>
            <DialogTitle>Select AI Avatar</DialogTitle>
            <DialogDescription>
                Choose an avatar to use in your video, or create your own
            </DialogDescription>
            </div>
            <Button
              onClick={handleNextToSpeechGeneration}
              className="px-6 shrink-0 mr-2"
              size="lg"
              disabled={!selectedAvatar || creatingProjectFromAvatar}
            >
              {creatingProjectFromAvatar ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Next"
              )}
            </Button>
          </DialogHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">
              Create a custom avatar with the wizard (selfie or studio style, generate, animate, then save).
            </p>
            <Button
              variant="default"
              onClick={() => {
                setAvatarsDialogOpen(false);
                router.push("/app/create/avatar");
              }}
            >
              Create Avatar
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 py-6">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className={cn(
                  "flex flex-col items-center gap-4 p-6 rounded-lg border-2 transition-all",
                  selectedAvatar?.id === avatar.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 min-h-[200px]">
                  <video
                    src={avatar.url}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={(e) => {
                      console.error("Failed to load avatar video:", avatar.url);
                    }}
                  />
                </div>
                <div className="text-base font-semibold text-center">{avatar.name}</div>
                <div className="flex gap-2 w-full">
                <Button
                  onClick={() => handleAvatarSelect(avatar)}
                    className="flex-1 h-10 text-base"
                  variant={selectedAvatar?.id === avatar.id ? "default" : "outline"}
                >
                  {selectedAvatar?.id === avatar.id ? "Selected" : "Select"}
                </Button>
                  {DEFAULT_AVATAR_IDS.has(avatar.id) ? null : (
              <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => {
                        setAvatarsDialogOpen(false);
                        router.push(`/app/create/avatar?characterId=${encodeURIComponent(avatar.id)}`);
                      }}
                      title="Edit avatar (e.g. crop video)"
                    >
                      <Pencil className="h-4 w-4" />
              </Button>
                  )}
            </div>
              </div>
            ))}
          </div>
          {avatarNextError && (
            <p className="text-sm text-destructive pt-2">{avatarNextError}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Speech Generation & Lip Sync Screen */}
      {showSpeechGeneration && (
        <Dialog 
          open={showSpeechGeneration} 
          onOpenChange={(open) => {
            // Prevent closing when generating lip sync
            if (!open && generatingLipSync) {
              return;
            }
            setShowSpeechGeneration(open);
          }}
        >
          <DialogContent 
            className="!w-[80vw] !h-[80vh] !max-w-[80vw] !max-h-[80vh] !sm:max-w-[80vw] overflow-hidden p-0 flex flex-col"
            showCloseButton={!generatingLipSync}
          >
            {/* Visually hidden title for accessibility */}
            <DialogTitle className="sr-only">Speech Generation & Lip Sync</DialogTitle>
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-4 p-4 border-b bg-gray-50">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition",
                currentStep === "speech" ? "bg-blue-500 text-white" : generatedSpeechUrl ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  currentStep === "speech" ? "bg-white text-blue-500" : generatedSpeechUrl ? "bg-white text-green-500" : "bg-gray-400 text-white"
                )}>
                  {generatedSpeechUrl ? "✓" : "1"}
                </div>
                <span className="text-sm font-semibold">Generate Speech</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition",
                currentStep === "lipsync" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  currentStep === "lipsync" ? "bg-white text-blue-500" : "bg-gray-400 text-white"
                )}>
                  2
                </div>
                <span className="text-sm font-semibold">Lip Sync</span>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Left Panel - Avatar/Lip Sync Preview (2/3 width) */}
              <div className="flex-[2] flex items-center justify-center p-8 border-r">
                <div className="w-full h-full border-2 border-gray-300 rounded-lg flex items-center justify-center bg-white overflow-hidden relative">
                  {lipSyncVideoUrl ? (
                    <>
                      <video
                        src={lipSyncVideoUrl}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        loop
                        muted={!isPlaying}
                        playsInline
                        onError={(e) => {
                          console.error("Failed to load lip sync video:", lipSyncVideoUrl);
                        }}
                      />
                      {/* Loading overlay when generating */}
                      {generatingLipSync && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                          <div className="text-white text-sm font-semibold mb-2">{lipSyncStatus || 'Generating lip sync...'}</div>
                          {lipSyncProgress > 0 && (
                            <div className="w-64 bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full transition-all duration-300"
                                style={{ width: `${lipSyncProgress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : selectedAvatar ? (
                    <video
                      src={selectedAvatar.url}
                      className="w-full h-full object-contain"
                      autoPlay
                      loop
                      muted
                      playsInline
                      onError={(e) => {
                        console.error("Failed to load avatar video:", selectedAvatar.url);
                      }}
                    />
                  ) : (
                    <div className="text-gray-400 text-sm">Avatar Preview</div>
                  )}
                </div>
              </div>

              {/* Right Panel - Controls (1/3 width) */}
              <div className="flex-1 flex flex-col p-6 gap-4">
                <input
                  ref={uploadOwnVoiceInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={onOwnVoiceFileChange}
                  aria-label="Upload your own voice"
                />
                {currentStep === "speech" ? (
                  <>
                    {/* Step 1: Generate Speech - mutual exclusivity: own voice vs AI */}
                    {/* Use your own voice */}
                    <div className={cn("space-y-2", aiVoiceChosen && "opacity-60 pointer-events-none")}>
                      <Label className="text-sm font-semibold block">Use your own voice</Label>
                      <p className="text-xs text-muted-foreground">
                        Upload an audio file or record with your mic, then go to Lip Sync.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleOwnVoiceUploadClick}
                          className="flex-1"
                          disabled={aiVoiceChosen}
                        >
                          <Upload className="h-4 w-4 mr-1.5" />
                          Upload audio
                        </Button>
                        {!isRecordingVoice ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleStartRecording}
                            className="flex-1"
                            disabled={aiVoiceChosen}
                          >
                            <Mic className="h-4 w-4 mr-1.5" />
                            Record
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleStopRecording}
                            className="flex-1"
                          >
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            Stop recording
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <Label className="text-sm font-semibold mb-2 block">Or generate with AI</Label>
                    </div>
                    {/* Select Voice */}
                    <div className={cn(ownVoiceChosen && "opacity-60 pointer-events-none")}>
                      <Label className="text-sm font-semibold mb-2 block">Select voice</Label>
                      <div className="flex gap-2">
                        <Select
                          value={selectedVoice}
                          onValueChange={setSelectedVoice}
                          disabled={loadingVoices || loadingUserVoices || ownVoiceChosen}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue
                              placeholder={
                                loadingVoices || loadingUserVoices ? "Loading voices..." : "Choose a voice"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {combinedVoices.length > 0 ? (
                              combinedVoices.map((voice) => (
                                <SelectItem
                                  key={voice.category === "Saved" ? `saved-${voice.voice_id}` : voice.voice_id}
                                  value={voice.voice_id}
                                >
                                  {voice.name} {voice.category && `(${voice.category})`}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="voice1">Voice 1 - Natural</SelectItem>
                                <SelectItem value="voice2">Voice 2 - Energetic</SelectItem>
                                <SelectItem value="voice3">Voice 3 - Calm</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        {hasElevenLabsKey && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddVoiceDialogOpen(true)}
                            className="flex-shrink-0"
                            title="Add voice to your library"
                            disabled={ownVoiceChosen}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add voice
                          </Button>
                        )}
                        {selectedVoice && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewVoice(selectedVoice)}
                            disabled={previewingVoice === selectedVoice || ownVoiceChosen}
                            className="flex-shrink-0"
                          >
                            {previewingVoice === selectedVoice ? (
                              <>
                                <Pause className="h-4 w-4 mr-1" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Preview
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      {/* Preview Audio Player */}
                      {previewAudio && (
                        <div className="mt-2">
                          <audio
                            ref={previewAudioRef}
                            src={previewAudio}
                            controls
                            className="w-full"
                            onEnded={() => setPreviewAudio(null)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Model Selection */}
                    <div className={cn("mb-4 space-y-2", ownVoiceChosen && "opacity-60 pointer-events-none")}>
                      <Label className="text-sm font-semibold block">Model</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModel("flash");
                            setEmotionsEnabled(false);
                          }}
                          disabled={ownVoiceChosen}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            selectedModel === "flash"
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          Flash
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedModel("alpha3")}
                          disabled={ownVoiceChosen}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            selectedModel === "alpha3"
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          Alpha 3
                        </button>
                      </div>
                      {selectedModel === "alpha3" && (
                        <Button
                          type="button"
                          variant={emotionsEnabled ? "default" : "outline"}
                          disabled={ownVoiceChosen}
                          onClick={() => {
                            if (!emotionsEnabled) {
                              // Add emotion tags to the text based on ElevenLabs Alpha 3 requirements
                              const addEmotionsToText = (text: string): string => {
                                // Split text into sentences
                                const sentences = text.split(/([.!?]+)/).filter(s => s.trim());
                                let result = "";
                                let sentenceIndex = 0;
                                
                                // Common emotion tags for alpha 3 (based on ElevenLabs documentation)
                                const emotionTags = [
                                  "[curious]", "[excited]", "[happy]", "[sad]", 
                                  "[angry]", "[surprised]", "[whispers]", "[shouts]",
                                  "[laughs]", "[sighs]", "[confused]", "[mischievously]",
                                  "[crying]", "[clears throat]"
                                ];
                                
                                // Simple heuristic: alternate between different emotions
                                for (let i = 0; i < sentences.length; i++) {
                                  const sentence = sentences[i].trim();
                                  if (!sentence) continue;
                                  
                                  // Add emotion tag every few sentences or based on punctuation
                                  if (sentence.match(/[.!?]$/)) {
                                    const emotionIndex = sentenceIndex % emotionTags.length;
                                    result += `${emotionTags[emotionIndex]} ${sentence} `;
                                    sentenceIndex++;
                                  } else {
                                    result += `${sentence} `;
                                  }
                                }
                                
                                return result.trim();
                              };
                              
                              const textWithEmotions = addEmotionsToText(speechText);
                              setSpeechText(textWithEmotions);
                              setEmotionsEnabled(true);
                            } else {
                              // Remove emotion tags
                              const textWithoutEmotions = speechText.replace(/\[(curious|excited|happy|sad|angry|surprised|whispers|shouts|laughs|sighs|confused|mischievously|crying|clears throat)\]/gi, "").trim();
                              setSpeechText(textWithoutEmotions);
                              setEmotionsEnabled(false);
                            }
                          }}
                          className="w-full mt-2"
                          size="sm"
                        >
                          {emotionsEnabled ? "Remove Emotions" : "Add Emotions to Speech"}
                        </Button>
                      )}
                    </div>

                    {/* Text Input Area */}
                    <div className={cn("flex-1 flex flex-col", ownVoiceChosen && "opacity-60 pointer-events-none")}>
                      <Label className="text-sm font-semibold mb-2 block">Script</Label>
                      <textarea
                        value={speechText}
                        onChange={(e) => setSpeechText(e.target.value)}
                        placeholder="Enter your script here..."
                        disabled={ownVoiceChosen}
                        className="flex-1 w-full p-4 border-2 border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500"
                      />
                      
                      {/* Speed Control */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Speech Speed</Label>
                          <span className="text-sm text-gray-600">{speechSpeed.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.25"
                          max="4.0"
                          step="0.05"
                          value={speechSpeed}
                          onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                          disabled={ownVoiceChosen}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>0.25x (Slow)</span>
                          <span>1.0x (Normal)</span>
                          <span>4.0x (Fast)</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className={cn("flex flex-col gap-2", ownVoiceChosen && "opacity-60 pointer-events-none")}>
                      {/* Credit estimation and warning */}
                      {speechText && speechText.trim().length > 0 && (
                        <div className="text-xs space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Estimated credits:</span>
                            <span className={hasEnoughCredits ? "font-medium text-foreground" : "font-medium text-destructive"}>
                              {calculateEstimatedCredits.toFixed(2)}
                            </span>
                          </div>
                          {userCredits !== null && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Your balance:</span>
                              <span className="font-medium text-foreground">{userCredits.toFixed(2)}</span>
                            </div>
                          )}
                          {!hasEnoughCredits && userCredits !== null && (
                            <div className="text-destructive text-xs font-medium bg-destructive/10 p-2 rounded">
                              ⚠️ Low on credits! You need {calculateEstimatedCredits.toFixed(2)} credits but only have {userCredits.toFixed(2)}.
                            </div>
                          )}
                        </div>
                      )}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleGenerateSpeech}
                          disabled={!selectedVoice || !speechText || generatingSpeech || (userCredits !== null && !hasEnoughCredits) || ownVoiceChosen}
                        className="flex-1"
                        size="lg"
                          variant={!hasEnoughCredits && userCredits !== null ? "destructive" : "default"}
                      >
                        <Mic className="h-4 w-4 mr-2" />
                          {generatingSpeech 
                            ? "Generating..." 
                            : speechText && speechText.trim().length > 0
                            ? `Generate Speech (${calculateEstimatedCredits.toFixed(2)} credits)`
                            : "Generate Speech"
                          }
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                          setSelectedVoice("");
                          setGeneratedSpeechUrl(null);
                          setGeneratedSpeechVoiceId(null);
                          setPreviewAudio(null);
                        }}
                        title="Reset voice choice and re-enable all options"
                      >
                        Reset
                      </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Step 2: Lip Sync */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold mb-2">Step 2: Generate Lip Sync</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Your speech has been generated. Now generate lip sync for your avatar.
                        </p>
                      </div>

                    {/* Generated Speech Preview */}
                    {generatedSpeechUrl && (
                      <div className="w-full space-y-2">
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Generated Speech</Label>
                          {generatedSpeechVoiceId && (
                            <p className="text-xs text-gray-500 mb-2">
                              Voice ID: {generatedSpeechVoiceId}
                            </p>
                          )}
                          <audio
                            src={generatedSpeechUrl}
                            controls
                            className="w-full"
                          />
                        </div>
                        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                          <strong>Note:</strong> Speech generated using ElevenLabs. The audio URL is stored in memory and will be used for lip sync generation.
                        </div>
                      </div>
                    )}

                    {/* Status Updates */}
                    {generatingLipSync && (
                      <div className="w-full space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                          <span className="text-sm font-semibold text-blue-900">{lipSyncStatus || 'Generating lip sync...'}</span>
                        </div>
                        {lipSyncProgress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full transition-all duration-300"
                              style={{ width: `${lipSyncProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    )}
                    {lipSyncVideoUrl && !generatingLipSync && (
                      <div className="w-full p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                          <span className="text-sm font-semibold text-green-900">Lip sync completed! Video is ready.</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 w-full">
                      {lipSyncVideoUrl ? (
                        <Button
                          onClick={handleAddVideoToScene}
                          className="flex-1"
                          size="lg"
                          type="button"
                        >
                          Add video to canvas
                        </Button>
                      ) : (
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log("[Lip Sync] Button clicked", {
                              generatedSpeechUrl: !!generatedSpeechUrl,
                              selectedAvatar: !!selectedAvatar,
                              generatingLipSync
                            });
                            handleGenerateLipSync(e);
                          }}
                          disabled={!generatedSpeechUrl || !selectedAvatar || generatingLipSync}
                          className="flex-1"
                          size="lg"
                          type="button"
                        >
                          <Mic className="h-4 w-4 mr-2" />
                          {generatingLipSync ? "Generating..." : "Generate Lip Sync (16 credits)"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setCurrentStep("speech")}
                      >
                        Back
                      </Button>
                    </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog
        open={magicCreateOpen}
        onOpenChange={(open) => {
          if (magicCreateLoading || magicCreateTranscribeLoading) return;
          if (open) {
            void loadUploadedVideos();
            if (!magicCreateScript.trim()) {
              setMagicCreateScript(MAGIC_CREATE_SAMPLE_SCRIPT);
            }
            // Start wizard fresh every open unless we're being reopened for Step 3 after the
            // existing Avatars → Speech → Lipsync flow completed (magicPendingReopenOnLipsync).
            if (!magicPendingReopenOnLipsync) {
              setMagicWizardStep("source");
              setMagicSource(null);
            }
          }
          setMagicCreateOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Magic create
            </DialogTitle>
            <DialogDescription>
              {magicWizardStep === "source" && "Step 1 of 3 — pick a main video source."}
              {magicWizardStep === "media" && "Step 2 of 3 — transcribe your uploaded video into a script."}
              {magicWizardStep === "generate" && "Step 3 of 3 — review and build your scenes."}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper dots */}
          <div className="flex items-center gap-2 pb-2">
            {[
              { key: "source", label: "Source" },
              { key: "work", label: magicSource === "avatar" ? "Avatar flow" : magicSource === "media" ? "Transcribe" : "Script" },
              { key: "generate", label: "Generate" },
            ].map((s, idx) => {
              const activeIdx =
                magicWizardStep === "source" ? 0
                : magicWizardStep === "media" ? 1
                : 2;
              const isActive = idx === activeIdx;
              const isDone = idx < activeIdx;
              return (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isDone
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                        isActive ? "bg-primary-foreground/20" : isDone ? "bg-primary/20" : "bg-muted-foreground/20"
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span>{s.label}</span>
                  </div>
                  {idx < 2 && <div className="flex-1 h-px bg-border" />}
                </div>
              );
            })}
          </div>

          {/* STEP 1 — Source picker */}
          {magicWizardStep === "source" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Avatar card — delegates to the existing Avatars → Speech → Lipsync flow */}
                <button
                  type="button"
                  onClick={() => {
                    // Remember that we started this via Magic Create so we can auto-reopen
                    // the wizard at Step 3 once lipsync completes.
                    setMagicSource("avatar");
                    setMagicPendingReopenOnLipsync(true);
                    // Hand off to the existing (working) Avatars dialog. From there the user
                    // picks an avatar → Next → Speech panel → Lipsync panel. Same flow as the navbar button.
                    setMagicCreateOpen(false);
                    setAvatarsDialogOpen(true);
                  }}
                  className={cn(
                    "group relative flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all",
                    "hover:border-primary hover:bg-primary/5",
                    "border-border"
                  )}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Select an Avatar</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      We'll take you through avatar → script → voice → lipsync, then bring you back here.
                    </div>
                  </div>
                </button>

                {/* Media card — always enabled so the user can upload directly in the picker */}
                <button
                  type="button"
                  onClick={() => {
                    setMagicSource("media");
                    setMagicWizardStep("media");
                    // Open the full media picker dialog (grid view) instead of
                    // forcing the user through a small dropdown inside the wizard.
                    setMagicMediaPickerActive(true);
                    setMediaDialogOpen(true);
                  }}
                  className={cn(
                    "group relative flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all",
                    "hover:border-primary hover:bg-primary/5",
                    "border-border"
                  )}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Choose from Media</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Pick an uploaded video or prior lipsync — or upload a new one — and we'll transcribe it into a script.
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMagicCreateOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2B — Media branch */}
          {magicWizardStep === "media" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Video</Label>
                {(() => {
                  const selected = magicMainVideoOptions.find(
                    (o) => o.key === magicCreateMainVideoKey
                  );
                  if (selected) {
                    return (
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="relative flex h-16 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                          <video
                            src={selected.url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Play className="h-5 w-5 text-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {selected.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selected.duration_seconds
                              ? `${Math.round(selected.duration_seconds)}s`
                              : "Video"}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMagicMediaPickerActive(true);
                            setMediaDialogOpen(true);
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      disabled={magicMainVideoOptions.length === 0}
                      onClick={() => {
                        setMagicMediaPickerActive(true);
                        setMediaDialogOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4" />
                      {magicMainVideoOptions.length === 0
                        ? "No videos — upload one first"
                        : "Choose a video from Media"}
                    </Button>
                  );
                })()}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="magic-wizard-media-script">Script</Label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    disabled={magicCreateTranscribeLoading || !magicCreateMainVideoKey}
                    onClick={() => void handleMagicTranscribeScriptFromVideo()}
                  >
                    {magicCreateTranscribeLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                    Transcribe
                  </Button>
                </div>
                <Textarea
                  id="magic-wizard-media-script"
                  value={magicCreateScript}
                  onChange={(e) => setMagicCreateScript(e.target.value)}
                  placeholder="Click Transcribe to fill this from the video — or type it manually."
                  rows={8}
                  className="min-h-[160px] resize-y font-mono text-sm leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  {magicCreateTranscribed
                    ? "Use blank lines between paragraphs to split scenes."
                    : "Click Transcribe to continue — we need word-level timings from the video before generating."}
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMagicWizardStep("source")}
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMagicCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      !magicCreateMainVideoKey ||
                      !magicCreateScript.trim() ||
                      magicCreateTranscribeLoading ||
                      !magicCreateTranscribed
                    }
                    title={
                      !magicCreateTranscribed
                        ? "Click Transcribe first — the Magic pipeline needs word-level timings from the video."
                        : undefined
                    }
                    onClick={() => setMagicWizardStep("generate")}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Generate */}
          {magicWizardStep === "generate" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="font-medium mb-1">Ready to build</div>
                <p className="text-xs text-muted-foreground">
                  Freepik B-roll, dynamic 50/50 splits, circle-pip & black-overlay cards,
                  synced to your script. This can take ~30-60s.
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Main video</div>
                <div className="text-sm truncate">
                  {magicMainVideoOptions.find((o) => o.key === magicCreateMainVideoKey)?.label || "—"}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Script preview</div>
                <div className="rounded-md border bg-background p-3 text-xs max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {magicCreateScript.trim() || "(empty)"}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={magicCreateLoading}
                  onClick={() => setMagicWizardStep(magicSource === "media" ? "media" : "source")}
                >
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMagicCreateOpen(false)}
                    disabled={magicCreateLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleMagicCreate()}
                    disabled={
                      magicCreateLoading ||
                      !magicCreateMainVideoKey ||
                      !magicCreateScript.trim()
                    }
                  >
                    {magicCreateLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Working…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate scenes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add voice to user library (name + Eleven Labs voice ID) */}
      <Dialog open={addVoiceDialogOpen} onOpenChange={setAddVoiceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add voice</DialogTitle>
            <DialogDescription>
              Save a voice to your library. Enter a name and the Eleven Labs voice ID (from your Eleven Labs dashboard).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-voice-name">Name</Label>
              <Input
                id="new-voice-name"
                placeholder="e.g. My narrator"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-voice-id">Eleven Labs voice ID</Label>
              <Input
                id="new-voice-id"
                placeholder="e.g. abc123..."
                value={newVoiceId}
                onChange={(e) => setNewVoiceId(e.target.value)}
                className="rounded-xl font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Find voice IDs at elevenlabs.io → Voice Lab or in the URL when you open a voice.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddVoiceDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              className="rounded-xl"
              onClick={handleSaveNewVoice}
              disabled={!newVoiceName.trim() || !newVoiceId.trim() || savingNewVoice}
            >
              {savingNewVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {savingNewVoice ? "Saving..." : "Add voice"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media Dialog - Generated Videos and Uploaded Images */}
      <Dialog open={mediaDialogOpen} onOpenChange={(open) => {
        setMediaDialogOpen(open);
        // Reset insertion point when dialog closes
        if (!open) {
          setInsertAfterElementId(null);
          // If the dialog closes without a selection while in Magic picker mode,
          // clear the flag so the next normal open behaves as usual.
          setMagicMediaPickerActive(false);
        }
      }}>
        <DialogContent className="!w-[90vw] !h-[90vh] !max-w-[90vw] !max-h-[90vh] !sm:max-w-[90vw] overflow-hidden p-6 flex flex-col">
          <DialogHeader className="flex flex-row items-start justify-between gap-4">
            <div>
            <DialogTitle>
              {magicMediaPickerActive ? "Choose a video" : "All Media"}
            </DialogTitle>
            <DialogDescription>
              {magicMediaPickerActive
                ? "Pick an uploaded video or prior lip-sync for Magic Create."
                : "Select a video or image to use in your project"}
            </DialogDescription>
            </div>
            <Input
              id="media-dialog-file-upload"
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-2xl flex-shrink-0"
              onClick={() => document.getElementById("media-dialog-file-upload")?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </DialogHeader>
          {mediaError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">{mediaError}</p>
              <button
                onClick={async () => {
                  setMediaError(null);
                  // Retry loading media using token cache
                  const { getCachedToken } = await import('@/lib/utils/token-cache');
                  const token = await getCachedToken();
                  if (token) {
                    setMediaError(null);
                    Promise.allSettled([
                      loadGeneratedVideos(),
                      loadUploadedImages(),
                      loadUploadedVideos()
                    ]);
                  } else {
                    setMediaError('Please sign in to load your media. If you are signed in, try refreshing the page.');
                  }
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Retry
              </button>
            </div>
          )}
          {(loadingVideos || loadingImages || loadingUploadedVideos) ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="text-gray-400">Loading...</span>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4">
                {/* Generated Videos Section */}
                {generatedVideos.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Generated Videos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                      {generatedVideos.map((video) => (
                        <div
                          key={video.id}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all relative"
                          onClick={() => handleSelectGeneratedVideo(video)}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                            onClick={(e) => handleDeleteGeneratedVideo(video.id, e)}
                            title="Delete video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
                            {video.thumbnail_url ? (
                              <img
                                src={video.thumbnail_url}
                                alt="Video thumbnail"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={video.video_url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-center truncate w-full">
                            {video.duration_seconds
                              ? `${Math.floor(video.duration_seconds)}s`
                              : 'Video'}
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            {new Date(video.created_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectGeneratedVideo(video);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploaded Videos Section */}
                {uploadedVideos.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Uploaded Videos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                      {uploadedVideos.map((video, idx) => (
                        <div
                          key={`uploaded-video-${idx}`}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all relative"
                          onClick={() => {
                            if (magicMediaPickerActive) {
                              setMagicCreateMainVideoKey(`upload:${video.id}`);
                              setMagicMediaPickerActive(false);
                              setMediaDialogOpen(false);
                              return;
                            }
                            addElementToCanvas("video", video.url);
                            setMediaDialogOpen(false);
                          }}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                            onClick={(e) => handleDeleteVideo(video.id, e)}
                            title="Delete video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
                            <video
                              src={video.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-center truncate w-full">
                            {video.name}
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            {new Date(video.created_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (magicMediaPickerActive) {
                                setMagicCreateMainVideoKey(`upload:${video.id}`);
                                setMagicMediaPickerActive(false);
                                setMediaDialogOpen(false);
                                return;
                              }
                              addElementToCanvas("video", video.url);
                              setMediaDialogOpen(false);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploaded Images Section — hidden while picking a main video for Magic Create */}
                {!magicMediaPickerActive && uploadedImages.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Uploaded Images</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4">
                      {uploadedImages.map((image, idx) => (
                        <div
                          key={`uploaded-${idx}`}
                          className="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg bg-gray-100"
                          onClick={() => {
                            addElementToCanvas("image", image.url);
                            setMediaDialogOpen(false);
                          }}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(e) => handleDeleteImage(image.id, e)}
                            title="Delete image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error("Failed to load image:", image.url, image.name);
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                            onLoad={() => {
                              console.log("Image loaded successfully by asif:", image.url);
                              console.log("Image loaded successfully:", image.name);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {generatedVideos.length === 0 && uploadedImages.length === 0 && uploadedVideos.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-12">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No media files yet</p>
                    <p className="text-sm mt-2">Upload images or generate videos to see them here</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* My Audio Dialog */}
      <Dialog open={audioDialogOpen} onOpenChange={setAudioDialogOpen}>
        <DialogContent className="!w-[90vw] !h-[90vh] !max-w-[90vw] !max-h-[90vh] !sm:max-w-[90vw] overflow-hidden p-6 flex flex-col">
          <DialogHeader>
            <DialogTitle>My Audio</DialogTitle>
            <DialogDescription>
              Select an audio file to add to your project
            </DialogDescription>
          </DialogHeader>
          {loadingAudios ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="text-gray-400">Loading...</span>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4">
                {/* Uploaded Audios Section */}
                {uploadedAudios.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Uploaded Audio</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                      {uploadedAudios.map((audio, idx) => (
                        <div
                          key={`uploaded-audio-${idx}`}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all relative"
                          onClick={() => {
                            ensureProjectExists();
                            const audioElement: CanvasElement = {
                              id: uuid(),
                              type: "audio",
                              url: audio.url,
                              x: 50,
                              y: 50,
                              width: 50,
                              height: 50,
                              startTime: currentTime,
                              duration: 5000, // Will be updated when audio loads
                              muted: false,
                              rotation: 0,
                              opacity: 1,
                              zIndex: canvasElements.length,
                            };
                            setCanvasElements([...canvasElements, audioElement]);
                            setAudioDialogOpen(false);
                          }}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                            onClick={(e) => handleDeleteAudio(audio.id, e)}
                            title="Delete audio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                            <Music className="h-16 w-16 text-gray-400" />
                          </div>
                          <div className="text-sm font-semibold text-center truncate w-full">
                            {audio.name}
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            {new Date(audio.created_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              ensureProjectExists();
                              
                              // Calculate startTime: place after the last audio element, but ensure it fits within timeline
                              const existingAudioElements = canvasElements.filter(el => el.type === "audio");
                              let audioStartTime = 0;
                              if (existingAudioElements.length > 0) {
                                // Find the last audio element's end time
                                const lastAudio = existingAudioElements.reduce((latest, el) => {
                                  const elEndTime = (el.startTime || 0) + (el.duration || 5000);
                                  const latestEndTime = (latest.startTime || 0) + (latest.duration || 5000);
                                  return elEndTime > latestEndTime ? el : latest;
                                });
                                const calculatedStartTime = (lastAudio.startTime || 0) + (lastAudio.duration || 5000);
                                // Ensure the audio fits within the timeline
                                // If it would exceed, place it at the start instead
                                audioStartTime = Math.max(0, Math.min(calculatedStartTime, duration - 5000)); // Leave room for at least 5s duration
                              }
                              
                              const audioElement: CanvasElement = {
                                id: uuid(),
                                type: "audio",
                                url: audio.url,
                                x: 50,
                                y: 50,
                                width: 50,
                                height: 50,
                                startTime: audioStartTime,
                                duration: 5000, // Will be updated when audio loads
                                audioStartOffset: 0, // Initialize audio start offset for trimming
                                muted: false,
                                rotation: 0,
                                opacity: 1,
                                zIndex: canvasElements.length,
                              };
                              setCanvasElements([...canvasElements, audioElement]);
                              setAudioDialogOpen(false);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {uploadedAudios.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-12">
                    <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No audio files yet</p>
                    <p className="text-sm mt-2">Upload audio files to see them here</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Fill Jump Cuts Dialog */}
      <Dialog open={fillJumpCutsDialogOpen} onOpenChange={setFillJumpCutsDialogOpen}>
        <DialogContent className="!w-[900px] !max-w-[900px] overflow-hidden p-6 flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Fill Jump Cuts</DialogTitle>
            <DialogDescription>
              Select B-rolls and set the interval to automatically fill jump cuts
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Jump Cut Interval Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Jump Cut Interval (seconds)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="e.g., 5 (B-rolls every 5 seconds)"
                value={jumpCutInterval ?? ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setJumpCutInterval(isNaN(value) || value <= 0 ? null : value);
                }}
              />
              {jumpCutInterval && (
                <div className="text-xs text-muted-foreground">
                  B-rolls will appear every {jumpCutInterval}s
                </div>
              )}
            </div>

            {/* B-rolls Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Select B-rolls (up to 5)</Label>
                {selectedBRollIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBRollIds([])}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {selectedBRollIds.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedBRollIds.length} of 5 selected
                </div>
              )}
              {loadingBRolls ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : bRolls.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg">
                  No B-rolls uploaded yet. Upload B-rolls first.
                </div>
              ) : (
                <ScrollArea className="max-h-[500px] border rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    {bRolls.map((bRoll) => {
                      const isSelected = selectedBRollIds.includes(bRoll.id);
                      const canSelect = isSelected || selectedBRollIds.length < 5;
                      
                      return (
                        <div
                          key={bRoll.id}
                          className={cn(
                            "relative group cursor-pointer rounded-lg border-2 overflow-hidden transition-all",
                            isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                          )}
                          onClick={() => {
                            if (canSelect) {
                              if (isSelected) {
                                setSelectedBRollIds(selectedBRollIds.filter(id => id !== bRoll.id));
                              } else {
                                setSelectedBRollIds([...selectedBRollIds, bRoll.id]);
                              }
                            }
                          }}
                        >
                          {/* Video Preview */}
                          <div className="relative aspect-video w-full overflow-hidden bg-black">
                            {bRoll.thumbnailUrl ? (
                              <img
                                src={bRoll.thumbnailUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                draggable={false}
                              />
                            ) : bRoll.url ? (
                              <video
                                src={bRoll.url}
                                className="h-full w-full object-cover"
                                muted
                                loop
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                <VideoIcon className="h-8 w-8 text-muted-foreground/50" />
                              </div>
                            )}
                            {/* Overlay with play icon */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:bg-black/10">
                              <div className="rounded-full bg-black/60 p-2 backdrop-blur-sm transition-transform group-hover:scale-110">
                                <Play className="h-4 w-4 text-white" fill="white" />
                              </div>
                            </div>
                            {/* Checkbox overlay */}
                            <div className="absolute top-2 left-2">
                              <div className={cn(
                                "w-6 h-6 rounded border-2 flex items-center justify-center transition-all",
                                isSelected 
                                  ? "bg-primary border-primary" 
                                  : "bg-black/60 border-white/80 backdrop-blur-sm"
                              )}>
                                {isSelected && (
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                )}
                              </div>
                            </div>
                            {/* Delete button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 h-7 w-7 p-0 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Delete ${bRoll.name}?`)) {
                                  try {
                                    await bRollsApi.delete(bRoll.id);
                                    setSelectedBRollIds(selectedBRollIds.filter(id => id !== bRoll.id));
                                    await loadBRolls();
                                  } catch (error) {
                                    console.error("Error deleting B-roll:", error);
                                    alert(`Failed to delete B-roll: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {/* Video Info */}
                          <div className="p-3 bg-background">
                            <div className="text-sm font-medium truncate">{bRoll.name}</div>
                            {bRoll.durationSeconds && (
                              <div className="text-xs text-muted-foreground">
                                {bRoll.durationSeconds.toFixed(1)}s
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setFillJumpCutsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!jumpCutInterval || selectedBRollIds.length === 0) {
                  console.warn('⚠️ Apply button clicked but missing required data:', { jumpCutInterval, selectedBRollIds });
                  return;
                }

                console.log('🚀 Apply button clicked:', {
                  jumpCutInterval,
                  selectedBRollIds,
                  bRollsCount: bRolls.length,
                  duration,
                  canvasElementsCount: canvasElements.length
                });

                // Get selected B-roll objects
                const selectedBRolls = bRolls.filter(b => selectedBRollIds.includes(b.id));
                console.log('📋 Selected B-rolls:', selectedBRolls.map(b => ({ id: b.id, name: b.name, url: b.url, durationSeconds: b.durationSeconds })));
                
                if (selectedBRolls.length === 0) {
                  console.error('❌ No B-rolls found for selected IDs:', selectedBRollIds);
                  alert('No B-rolls found. Please refresh and try again.');
                  return;
                }
                
                // Remove existing B-roll clips (identified by muted=true, videoStartOffset set, and full screen overlay)
                const existingBRollClips = canvasElements.filter(el => 
                  el.type === "video" && 
                  el.muted === true && 
                  el.videoStartOffset !== undefined &&
                  el.x === 0 && 
                  el.y === 0 && 
                  el.width === 100 && 
                  el.height === 100
                );
                
                console.log('🗑️ Removing existing B-roll clips:', existingBRollClips.length);
                
                // Remove existing B-roll clips from canvas
                const elementsWithoutBRolls = canvasElements.filter(el => 
                  !existingBRollClips.some(bRollClip => bRollClip.id === el.id)
                );

                // Generate new B-roll clips
                const newBRollClips = generateBRollClips(
                  duration, // Total duration in ms
                  jumpCutInterval, // Interval in seconds
                  selectedBRolls
                );

                console.log('✅ B-roll clips generated:', {
                  interval: jumpCutInterval,
                  selectedBRollIds,
                  clipsGenerated: newBRollClips.length,
                  totalDuration: duration / 1000 + 's',
                  newClips: newBRollClips.map(c => ({ startTime: c.startTime, duration: c.duration, url: c.url?.substring(0, 50) + '...' }))
                });

                // Add new clips to canvas
                const updatedElements = [...elementsWithoutBRolls, ...newBRollClips];
                setCanvasElements(updatedElements);

                setFillJumpCutsDialogOpen(false);
              }}
              disabled={!jumpCutInterval || selectedBRollIds.length === 0}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
