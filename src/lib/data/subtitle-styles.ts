import type { SubtitleStyle } from "@/types";

export type SubtitleStyleConfig = {
  id: SubtitleStyle;
  name: string;
  description: string;
  className: string;
  containerClassName?: string;
  icon: string;
};

/**
 * TikTok-inspired subtitle styles
 * Each style has unique visual characteristics popular on social media
 */
export const SUBTITLE_STYLES: SubtitleStyleConfig[] = [
  {
    id: "magic-loops",
    name: "Magic Loops",
    description: "White text with green emphasized word, thick black outline, and smooth transitions",
    className: "text-white font-black text-2xl uppercase tracking-wide",
    containerClassName: "bg-transparent px-4 py-2",
    icon: "✨",
  },
  {
    id: "outlined",
    name: "Outlined",
    description: "Bold text with thick black outline",
    className: "text-white font-black text-xl uppercase tracking-wide",
    containerClassName: "bg-transparent px-4 py-2",
    icon: "🎯",
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Sophisticated serif style - luxury brand",
    className: "text-white font-serif font-medium text-xl tracking-wider italic",
    containerClassName: "bg-transparent px-8 py-4",
    icon: "✨",
  },
  {
    id: "bold-green",
    name: "Bold Green",
    description: "Bold uppercase text with green accent word, thick black stroke, and subtle shadow",
    className: "text-white font-black text-2xl uppercase",
    containerClassName: "bg-transparent px-4 py-2",
    icon: "💚",
  },
  {
    id: "karaoke-pink",
    name: "Karaoke Pink",
    description: "White text with lavender highlight box, dark outline, and purple glow",
    className: "text-white font-black text-2xl uppercase tracking-wider",
    containerClassName: "bg-transparent px-2 py-2",
    icon: "💗",
  },
  {
    id: "fancy",
    name: "Fancy",
    description: "Large cinematic captions with gradient band — covers the bottom half of the frame",
    className: "text-white font-black uppercase tracking-tight leading-tight",
    containerClassName: "bg-transparent w-full",
    icon: "✦",
  },
  {
    id: "chip",
    name: "Chip",
    description: "Clean white text on a dark rounded pill — minimalist TikTok captions that hug the text",
    className: "text-white font-bold text-xl tracking-tight",
    containerClassName: "bg-transparent px-0 py-0",
    icon: "💊",
  },
];

/**
 * Get style configuration by ID
 */
export function getSubtitleStyle(styleId: SubtitleStyle): SubtitleStyleConfig {
  return SUBTITLE_STYLES.find((style) => style.id === styleId) || SUBTITLE_STYLES[0];
}

/**
 * Additional CSS for special styles that need custom text effects
 */
export const OUTLINED_STYLE = {
  textShadow: `-2px -2px 0 #000,  
    2px -2px 0 #000,
    -2px 2px 0 #000,
    2px 2px 0 #000,
    0 0 10px rgba(0,0,0,0.8)`,
};

export const STYLE_KARAOKE_PINK = {
  textShadow: `0 0 10px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 0, 0, 0.35), 0 0 20px rgba(0, 0, 0, 0.25)`,
  WebkitTextStroke: '2.5px #000000',
  paintOrder: 'stroke fill',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '0px',
  lineHeight: '1.05',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  color: '#FFFFFF',
};

export const STYLE_MAGIC_LOOPS = {
  // 8-direction text-shadow fallback for non-webkit browsers
  textShadow: `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 2px 4px rgba(0,0,0,0.40)`,
  WebkitTextStroke: '5px #000000',
  paintOrder: 'stroke fill',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  lineHeight: '1.05',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  color: '#FFFFFF',
};

/** Fancy: used by editor for half-frame gradient + oversized type */
export const STYLE_FANCY = {
  textShadow:
    "0 4px 32px rgba(0,0,0,0.95), 0 2px 0 #000, 0 -1px 0 rgba(255,255,255,0.15)",
  WebkitTextStroke: "1.5px rgba(0,0,0,0.85)",
  paintOrder: "stroke fill" as const,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.02em",
  lineHeight: "1.05",
};

/**
 * Chip style — white bold text on a dark rounded pill.
 * Typography: sans-serif, bold (700), NOT uppercase (preserves sentence case).
 * Container: semi-transparent black pill that hugs the text.
 */
export const STYLE_CHIP_TEXT = {
  color: "#FFFFFF",
  fontWeight: "700" as const,
  letterSpacing: "0px",
  lineHeight: "1.1",
  textTransform: "none" as const,
  textShadow: "0 1px 3px rgba(0,0,0,0.45)",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
} as const;

export const STYLE_CHIP_PILL = {
  backgroundColor: "rgba(0, 0, 0, 0.70)",
  borderRadius: "10px",
  padding: "6px 14px",
  boxShadow: "0 4px 14px rgba(0,0,0,0.28)",
  display: "inline-block" as const,
} as const;

export const STYLE_BOLD_GREEN = {
  WebkitTextStroke: '2.5px #000000',
  paintOrder: 'stroke fill',
  fontWeight: '900',
  textTransform: 'uppercase',
  letterSpacing: '0.2px',
  lineHeight: '1.0',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
  color: '#FFFFFF',
  textShadow: '2px 2px 0px #000000',
};

