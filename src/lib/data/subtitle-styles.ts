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
    id: "classic",
    name: "Classic",
    description: "Traditional white text with dark background",
    className: "text-white font-semibold text-base bg-black/60 backdrop-blur px-4 py-3 rounded-2xl",
    icon: "📝",
  },
  {
    id: "bold-pop",
    name: "Bold Pop",
    description: "Large bold text with strong shadow - TikTok favorite",
    className: "text-white font-black text-2xl uppercase tracking-wide drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]",
    containerClassName: "bg-transparent",
    icon: "💥",
  },
  {
    id: "neon-glow",
    name: "Neon Glow",
    description: "Glowing neon effect - eye-catching",
    className: "text-white font-bold text-xl uppercase tracking-wider animate-pulse",
    containerClassName: "bg-gradient-to-r from-purple-600/40 via-pink-500/40 to-blue-500/40 backdrop-blur-sm px-6 py-3 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.6)]",
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
    id: "minimal",
    name: "Minimal",
    description: "Clean and simple - professional look",
    className: "text-white font-medium text-lg tracking-wide",
    containerClassName: "bg-black/40 backdrop-blur-md px-5 py-2.5 rounded-lg",
    icon: "⚪",
  },
  {
    id: "boxed",
    name: "Boxed",
    description: "Solid background box - high contrast",
    className: "text-white font-bold text-lg",
    containerClassName: "bg-black px-6 py-3 rounded-xl border-2 border-white/20",
    icon: "📦",
  },
  {
    id: "karaoke",
    name: "Karaoke",
    description: "Word-by-word yellow highlight - follows speech timing",
    className: "text-white font-black text-2xl uppercase tracking-wider",
    containerClassName: "bg-transparent px-2 py-2",
    icon: "🎤",
  },
  {
    id: "typewriter",
    name: "Typewriter",
    description: "Monospace tech style - coding aesthetic",
    className: "text-green-400 font-mono font-bold text-lg tracking-wider",
    containerClassName: "bg-black/90 px-5 py-3 rounded-lg border-2 border-green-400/50 shadow-[0_0_20px_rgba(74,222,128,0.3)]",
    icon: "⌨️",
  },
  {
    id: "retro",
    name: "Retro",
    description: "80s/90s vaporwave aesthetic",
    className: "text-white font-black text-2xl uppercase tracking-widest",
    containerClassName: "bg-gradient-to-r from-pink-500/80 to-cyan-500/80 px-6 py-3 rounded-none border-4 border-white shadow-[4px_4px_0_#ff00ff,8px_8px_0_#00ffff]",
    icon: "🕹️",
  },
  {
    id: "bubble",
    name: "Bubble",
    description: "Speech bubble style - conversation mode",
    className: "text-black font-bold text-lg",
    containerClassName: "bg-white px-6 py-3 rounded-full shadow-2xl border-4 border-black relative after:content-[''] after:absolute after:bottom-[-12px] after:left-[20px] after:w-0 after:h-0 after:border-l-[15px] after:border-l-transparent after:border-r-[15px] after:border-r-transparent after:border-t-[12px] after:border-t-white",
    icon: "💬",
  },
  {
    id: "highlight",
    name: "Highlight",
    description: "Yellow marker highlight - study notes",
    className: "text-black font-black text-xl uppercase tracking-wide",
    containerClassName: "bg-yellow-300 px-5 py-2 shadow-lg",
    icon: "✏️",
  },
  {
    id: "3d-pop",
    name: "3D Pop",
    description: "Multi-layer 3D depth effect",
    className: "text-white font-black text-2xl uppercase tracking-wider",
    containerClassName: "bg-transparent px-4 py-2",
    icon: "🎮",
  },
  {
    id: "shadow-deep",
    name: "Shadow Deep",
    description: "Heavy drop shadow - dramatic depth",
    className: "text-white font-black text-2xl uppercase tracking-wide drop-shadow-[0_8px_16px_rgba(0,0,0,1)]",
    containerClassName: "bg-transparent",
    icon: "🌑",
  },
  {
    id: "stroke-thick",
    name: "Stroke Thick",
    description: "Thick outline stroke - maximum visibility",
    className: "text-white font-black text-2xl uppercase tracking-wider",
    containerClassName: "bg-transparent px-4 py-2",
    icon: "🖊️",
  },
  {
    id: "comic",
    name: "Comic",
    description: "Comic book style - POW!",
    className: "text-black font-black text-2xl uppercase tracking-wider",
    containerClassName: "bg-yellow-400 px-6 py-3 rounded-2xl border-4 border-black shadow-[4px_4px_0_#000] transform -rotate-1",
    icon: "💥",
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Sophisticated serif style - luxury brand",
    className: "text-white font-serif font-medium text-xl tracking-wider italic",
    containerClassName: "bg-black/70 backdrop-blur-md px-8 py-4 rounded-lg border border-white/30 shadow-xl",
    icon: "✨",
  },
  {
    id: "gaming",
    name: "Gaming",
    description: "Gamer aesthetic - RGB glow",
    className: "text-white font-black text-2xl uppercase tracking-widest",
    containerClassName: "bg-gradient-to-r from-red-500/40 via-green-500/40 to-blue-500/40 backdrop-blur-sm px-6 py-3 rounded-xl border-2 border-white/20 shadow-[0_0_30px_rgba(255,0,0,0.3),0_0_30px_rgba(0,255,0,0.3),0_0_30px_rgba(0,0,255,0.3)]",
    icon: "🎯",
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

export const STYLE_3D_POP = {
  textShadow: `1px 1px 0 #999, 
    2px 2px 0 #888, 
    3px 3px 0 #777, 
    4px 4px 0 #666, 
    5px 5px 0 #555, 
    6px 6px 0 #444, 
    7px 7px 10px rgba(0,0,0,0.6)`,
};

export const STYLE_STROKE_THICK = {
  textShadow: `-3px -3px 0 #000,  
    3px -3px 0 #000,
    -3px 3px 0 #000,
    3px 3px 0 #000,
    -1px -1px 0 #fff,
    1px -1px 0 #fff,
    -1px 1px 0 #fff,
    1px 1px 0 #fff`,
};

