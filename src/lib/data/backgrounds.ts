import type { Background } from "@/types";

// Get server URL for background videos
const getServerUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3001";
  // In production, this should be an environment variable
  return process.env.NEXT_PUBLIC_VIDEO_API_URL || "http://localhost:3001";
};

const BACKGROUND_VIDEO_MAP: Record<string, string> = {
  minecraft: "mine_converted.mp4",
  subway: "Subway.mp4",
  mine_2_cfr: "mine_2_cfr.mp4",
};

export const BACKGROUNDS: Background[] = [
  {
    id: "minecraft",
    name: "Minecraft Speed Run",
    description: "Bright, upbeat visuals that keep energy high.",
    length: "45s clip • 1080p @ 60fps",
    previewUrl: `${getServerUrl()}/backgrounds/${BACKGROUND_VIDEO_MAP.minecraft}`,
  },
  {
    id: "subway",
    name: "MineCraft Light",
    description: "Fast-paced urban parkour with vibrant city visuals.",
    length: "1080p @ 60fps",
    previewUrl: `${getServerUrl()}/backgrounds/${BACKGROUND_VIDEO_MAP.subway}`,
  },
  {
    id: "mine_2_cfr",
    name: "Mine Craft Cool",
    description: "Cool Minecraft gameplay with smooth visuals.",
    length: "1080p @ 60fps",
    previewUrl: `${getServerUrl()}/backgrounds/${BACKGROUND_VIDEO_MAP.mine_2_cfr}`,
  },
];

