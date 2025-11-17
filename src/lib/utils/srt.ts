import type { ScriptLine, SubtitleSegment } from "@/types";

export const parseSrtText = (input: string): SubtitleSegment[] => {
  if (!input?.trim()) return [];

  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [start, end, speaker, ...rest] = line.split(",");
      return {
        startMs: Number(start) || 0,
        endMs: Number(end) || 0,
        speaker: (speaker?.trim() === "B" ? "B" : "A") as "A" | "B",
        text: rest.join(",").trim(),
      };
    });
};

export const serializeSrt = (segments: SubtitleSegment[]): string =>
  segments
    .map((segment) =>
      `${segment.startMs},${segment.endMs},${segment.speaker},${segment.text}`,
    )
    .join("\n");

const WORDS_PER_MINUTE = 150;
const MIN_LINE_DURATION_MS = 700;

export const generateMockFromScript = (script: ScriptLine[]): string => {
  if (!script.length) return "";

  const segments: SubtitleSegment[] = [];
  let currentStart = 0;

  script.forEach((line) => {
    const wordCount = line.text.trim().split(/\s+/).filter(Boolean).length;
    const durationMs = Math.max(
      MIN_LINE_DURATION_MS,
      Math.round((wordCount / WORDS_PER_MINUTE) * 60_000),
    );

    const end = currentStart + durationMs;
    segments.push({
      startMs: currentStart,
      endMs: end,
      speaker: line.speaker,
      text: line.text.trim(),
    });
    currentStart = end;
  });

  return serializeSrt(segments);
};
