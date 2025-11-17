import type { Background } from "@/types";

// Get server URL for background videos
// Uses NEXT_PUBLIC_VIDEO_API_URL if set, otherwise falls back to NEXT_PUBLIC_REMOTION_SERVER_URL
// (since background videos are served from the same remotion server)
const getServerUrl = () => {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_VIDEO_API_URL || 
           process.env.NEXT_PUBLIC_REMOTION_SERVER_URL || 
           "https://nofacevideo-0f67ae173a97.herokuapp.com";
  }
  return process.env.NEXT_PUBLIC_VIDEO_API_URL || 
         process.env.NEXT_PUBLIC_REMOTION_SERVER_URL || 
         "https://nofacevideo-0f67ae173a97.herokuapp.com";
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

