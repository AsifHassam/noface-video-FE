export type Character = {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string;
  enabled: boolean;
  isPlaceholder: boolean;
  voiceId?: string | null;
  /** URL to voice sample audio (e.g. for global characters from Supabase) */
  voiceSampleUrl?: string | null;
};

export type OverlayPosition =
  | "TOP_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_LEFT"
  | "BOTTOM_RIGHT";

export type OverlayItem = {
  id: string;
  fileUrl: string;
  startMs: number;
  endMs: number;
  position: OverlayPosition;
};

export type TextOverlayStyle =
  | "classic"
  | "typewriter"
  | "neon"
  | "outlined"
  | "modern"
  | "bubble"
  | "box"
  | "highlight"
  | "shadow"
  | "retro"
  | "handwritten"
  | "glow"
  | "bounce"
  | "gradient"
  | "3d"
  | "minimal"
  | "bold"
  | "italic"
  | "underline"
  | "stroke"
  | "double-outline";

export type TextOverlay = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  x: number; // Position in % (0-100)
  y: number; // Position in % (0-100)
  fontSize: number; // Size in pixels
  color: string; // Hex color
  style: TextOverlayStyle;
  rotation?: number; // Rotation in degrees
};

export type ImageOverlay = {
  id: string;
  imageUrl: string; // Base64 or URL
  startMs: number;
  endMs: number;
  x: number; // Position in % (0-100)
  y: number; // Position in % (0-100)
  width: number; // Width in % (0-100); 0 with intrinsicSize = use image natural size
  height: number; // Height in % (0-100)
  /** When true (e.g. auto stock logos), render at native image dimensions (capped by max-width/height). */
  intrinsicSize?: boolean;
  rotation?: number; // Rotation in degrees
  opacity?: number; // Opacity 0-1
  cropData?: {
    x: number; // Crop x position
    y: number; // Crop y position
    width: number; // Crop width
    height: number; // Crop height
  };
  /** Slide into place from the side when the overlay appears (preview + final render). */
  slideInFrom?: "left" | "right" | null;
  /** How long the slide-in takes (ms). Default 400 when `slideInFrom` is set. */
  slideInDurationMs?: number;
};

export type BackgroundId = string; // Now dynamic from database

export type Background = {
  id: BackgroundId;
  name: string;
  description: string;
  length: string;
  previewUrl?: string;
  durationSeconds?: number; // Duration in seconds
};

export type ProjectType =
  | "REDDIT_STORY"
  | "TWO_CHAR_CONVO"
  | "NORMAL_STORY"
  | "story"
  | "AI_UGC"
  | "TEXTING_VIDEO";

export type RenderStatus = "QUEUED" | "RENDERING" | "READY" | "FAILED";

export type ScriptLine = {
  speaker: "A" | "B";
  text: string;
};

export type SubtitleSegment = {
  startMs: number;
  endMs: number;
  speaker: "A" | "B";
  text: string;
};

export type SubtitlePosition = {
  x: number; // Position in % (0-100)
  y: number; // Position in % (0-100)
};

export type SubtitleStyle =
  | "magic-loops"
  | "outlined"
  | "elegant"
  | "bold-green"
  | "karaoke-pink"
  | "fancy"
  | "chip";

export type SubtitleFontFamily = 'bebas-neue' | 'impact' | 'montserrat' | 'poppins' | 'futura' | 'roboto' | 'inter' | 'zy-resolve';

export type CharacterPosition = 'left' | 'center' | 'right';

export type CharacterSizes = {
  [characterName: string]: { width: number; height: number };
};

export type CharacterPositions = {
  [characterName: string]: CharacterPosition;
};

export type Project = {
  id: string;
  userId: string;
  type: ProjectType;
  title: string;
  status: RenderStatus;
  characters: { A: Character; B: Character };
  script: ScriptLine[];
  backgroundId?: BackgroundId | null;
  overlays: OverlayItem[];
  textOverlays?: TextOverlay[];
  imageOverlays?: ImageOverlay[];
  previewUrl?: string | null;
  finalUrl?: string | null;
  srtText?: string | null;
  subtitleStyle?: SubtitleStyle;
  subtitlePosition?: SubtitlePosition;
  subtitleFontSize?: number;
  subtitleFontFamily?: SubtitleFontFamily;
  subtitleEnabled?: boolean;
  durationSec?: number | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

/** What to save / apply when using a video template */
export type TemplateIncludeFlags = {
  background: boolean;
  subtitles: boolean;
  textOverlays: boolean;
  characters: boolean;
  characterSizes: boolean;
  characterPositions: boolean;
  characterCustomPositions: boolean;
  playbackRate: boolean;
  imageOverlays: boolean;
  characterSlideIn: boolean;
  characterSlideInWhoosh: boolean;
};

export type TemplateSnapshots = {
  imageOverlays?: ImageOverlay[];
  characterSlideInEnabled?: boolean;
  characterSlideInWhooshEnabled?: boolean;
  subtitleFontFamily?: SubtitleFontFamily;
  subtitleSingleLine?: boolean;
  subtitleSingleWord?: boolean;
  karaokePillColor?: string;
  boldGreenColor?: string;
};

export type VideoTemplateExtras = {
  includes: TemplateIncludeFlags;
  snapshots: TemplateSnapshots;
};

export type VideoTemplate = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  projectType: ProjectType;
  backgroundId: BackgroundId;
  subtitleStyle: SubtitleStyle;
  subtitlePosition?: SubtitlePosition;
  subtitleFontSize?: number;
  textOverlays: TextOverlay[];
  characters?: { A: Character | null; B: Character | null };
  characterSizes?: CharacterSizes;
  characterPositions?: CharacterPositions;
  characterCustomPositions?: Record<string, { x: number; y: number }>;
  playbackRate?: number;
  /** Selective save/apply flags + snapshots (image overlays, slide-in, extra subtitle fields). */
  templateExtras?: VideoTemplateExtras;
  createdAt: string;
  updatedAt: string;
};
