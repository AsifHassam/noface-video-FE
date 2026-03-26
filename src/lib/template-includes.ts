import type { DraftProject } from "@/lib/stores/project-store";
import type {
  VideoTemplate,
  TemplateIncludeFlags,
  TemplateSnapshots,
  VideoTemplateExtras,
} from "@/types";

export type { TemplateIncludeFlags, TemplateSnapshots, VideoTemplateExtras };

export const DEFAULT_TEMPLATE_INCLUDES: TemplateIncludeFlags = {
  background: true,
  subtitles: true,
  textOverlays: true,
  characters: true,
  characterSizes: true,
  characterPositions: true,
  characterCustomPositions: true,
  playbackRate: true,
  imageOverlays: true,
  characterSlideIn: true,
  characterSlideInWhoosh: true,
};

function pickSnapshots(draft: DraftProject, includes: TemplateIncludeFlags): TemplateSnapshots {
  const s: TemplateSnapshots = {};
  if (includes.imageOverlays) {
    s.imageOverlays = draft.imageOverlays ? [...draft.imageOverlays] : [];
  }
  if (includes.characterSlideIn) {
    s.characterSlideInEnabled = draft.characterSlideInEnabled !== false;
  }
  if (includes.characterSlideInWhoosh) {
    s.characterSlideInWhooshEnabled = draft.characterSlideInWhooshEnabled === true;
  }
  if (includes.subtitles) {
    s.subtitleFontFamily = draft.subtitleFontFamily;
    s.subtitleSingleLine = draft.subtitleSingleLine;
    s.subtitleSingleWord = draft.subtitleSingleWord;
    s.karaokePillColor = draft.karaokePillColor;
    s.boldGreenColor = draft.boldGreenColor;
  }
  return s;
}

export function buildTemplateExtras(
  draft: DraftProject,
  includes: TemplateIncludeFlags
): VideoTemplateExtras {
  return {
    includes,
    snapshots: pickSnapshots(draft, includes),
  };
}

function resolvedIncludes(template: VideoTemplate): TemplateIncludeFlags {
  const raw = template.templateExtras?.includes;
  if (!raw) {
    return { ...DEFAULT_TEMPLATE_INCLUDES };
  }
  return { ...DEFAULT_TEMPLATE_INCLUDES, ...raw };
}

/**
 * Merge template into draft updates (used when loading a template).
 */
export function getDraftUpdatesFromTemplate(
  template: VideoTemplate,
  normalizedProjectType: string
): Partial<DraftProject> {
  const inc = resolvedIncludes(template);
  const snap = template.templateExtras?.snapshots || {};

  const updates: Partial<DraftProject> = {
    type: normalizedProjectType as DraftProject["type"],
  };

  if (inc.background) {
    updates.backgroundId = template.backgroundId;
  }
  if (inc.subtitles) {
    updates.subtitleStyle = template.subtitleStyle;
    updates.subtitlePosition = template.subtitlePosition;
    updates.subtitleFontSize = template.subtitleFontSize;
    if (snap.subtitleFontFamily !== undefined) updates.subtitleFontFamily = snap.subtitleFontFamily;
    if (snap.subtitleSingleLine !== undefined) updates.subtitleSingleLine = snap.subtitleSingleLine;
    if (snap.subtitleSingleWord !== undefined) updates.subtitleSingleWord = snap.subtitleSingleWord;
    if (snap.karaokePillColor !== undefined) updates.karaokePillColor = snap.karaokePillColor;
    if (snap.boldGreenColor !== undefined) updates.boldGreenColor = snap.boldGreenColor;
  }
  if (inc.textOverlays) {
    updates.textOverlays = template.textOverlays ? [...template.textOverlays] : [];
  }
  if (inc.characters && template.characters) {
    updates.characters = template.characters;
  }
  if (inc.characterSizes && template.characterSizes) {
    updates.characterSizes = template.characterSizes;
  }
  if (inc.characterPositions && template.characterPositions) {
    updates.characterPositions = template.characterPositions;
  }
  if (inc.characterCustomPositions && template.characterCustomPositions) {
    updates.characterCustomPositions = template.characterCustomPositions;
  }
  if (inc.playbackRate) {
    updates.playbackRate =
      template.playbackRate !== undefined && template.playbackRate !== null
        ? Number(template.playbackRate)
        : 1;
  }
  if (inc.imageOverlays && snap.imageOverlays !== undefined) {
    updates.imageOverlays = [...snap.imageOverlays];
  }
  if (inc.characterSlideIn && snap.characterSlideInEnabled !== undefined) {
    updates.characterSlideInEnabled = snap.characterSlideInEnabled;
  }
  if (inc.characterSlideInWhoosh && snap.characterSlideInWhooshEnabled !== undefined) {
    updates.characterSlideInWhooshEnabled = snap.characterSlideInWhooshEnabled;
  }

  return updates;
}
