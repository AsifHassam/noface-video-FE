import { z } from "zod";
import type { ScriptLine } from "@/types";

export const scriptLineSchema = z.object({
  speaker: z.union([z.literal("A"), z.literal("B")]),
  text: z
    .string()
    .min(1, "Line cannot be empty")
    .max(280, "Keep dialogue under 280 characters"),
});

export const scriptSchema = z
  .array(scriptLineSchema)
  .min(2, "Conversation needs at least two lines")
  .max(120, "Let's keep it under 120 lines for this MVP")
  .refine(
    (lines) =>
      lines.every((line, index) =>
        index === 0 ? true : line.speaker !== lines[index - 1].speaker,
      ),
    {
      message: "Speakers must alternate between A and B",
    },
  );

export type ScriptValidationError = {
  index: number;
  message: string;
};

type CharacterMap = {
  A: string;
  B: string;
};

const SPEAKER_PATTERN = /^\s*\[(?<speaker>.+?)\]\s*:\s*(?<text>.+)$/;

export const parseScriptInput = (
  raw: string,
  characters: CharacterMap,
): { lines: ScriptLine[]; errors: ScriptValidationError[] } => {
  const lines: ScriptLine[] = [];
  const errors: ScriptValidationError[] = [];

  const trimmedLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  trimmedLines.forEach((line, index) => {
    const match = line.match(SPEAKER_PATTERN);
    if (!match?.groups?.speaker || !match.groups.text) {
      errors.push({
        index,
        message: "Use the format [Character]: dialogue.",
      });
      return;
    }

    const speakerName = match.groups.speaker.trim().toLowerCase();
    const text = match.groups.text.trim();

    let speaker: ScriptLine["speaker"] | null = null;
    if (speakerName === characters.A.toLowerCase()) {
      speaker = "A";
    } else if (speakerName === characters.B.toLowerCase()) {
      speaker = "B";
    } else {
      errors.push({
        index,
        message: `Unknown speaker "${match.groups.speaker}"`,
      });
      return;
    }

    lines.push({ speaker, text });
  });

  if (lines.length > 1) {
    lines.forEach((line, index) => {
      if (index > 0 && line.speaker === lines[index - 1].speaker) {
        errors.push({
          index,
          message: "Speakers must alternate.",
        });
      }
    });
  }

  return { lines, errors };
};
