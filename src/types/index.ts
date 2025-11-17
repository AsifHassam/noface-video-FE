export type Character = {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string;
  enabled: boolean;
  isPlaceholder: boolean;
  voiceId?: string | null;
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
  width: number; // Width in % (0-100)
  height: number; // Height in % (0-100)
  rotation?: number; // Rotation in degrees
  opacity?: number; // Opacity 0-1
  cropData?: {
    x: number; // Crop x position
    y: number; // Crop y position
    width: number; // Crop width
    height: number; // Crop height
  };
};

export type BackgroundId = "minecraft" | "subway" | "mine_2_cfr";

export type Background = {
  id: BackgroundId;
  name: string;
  description: string;
  length: string;
  previewUrl?: string;
};

export type ProjectType =
  | "REDDIT_STORY"
  | "TWO_CHAR_CONVO"
  | "NORMAL_STORY";

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
  | "classic"
  | "bold-pop"
  | "neon-glow"
  | "outlined"
  | "minimal"
  | "boxed"
  | "karaoke"
  | "typewriter"
  | "retro"
  | "bubble"
  | "highlight"
  | "3d-pop"
  | "shadow-deep"
  | "stroke-thick"
  | "comic"
  | "elegant"
  | "gaming";

export type CharacterPosition = 'left' | 'center' | 'right';

export type CharacterSizes = {
  Peter?: { width: number; height: number };
  Stewie?: { width: number; height: number };
  Rick?: { width: number; height: number };
  Brian?: { width: number; height: number };
  Morty?: { width: number; height: number };
};

export type CharacterPositions = {
  Peter?: CharacterPosition;
  Stewie?: CharacterPosition;
  Rick?: CharacterPosition;
  Brian?: CharacterPosition;
  Morty?: CharacterPosition;
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
  subtitleEnabled?: boolean;
  durationSec?: number | null;
  createdAt: string;
  updatedAt: string;
};
