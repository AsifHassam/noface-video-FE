import type { Background } from "@/types";

// S3 bucket configuration for background videos
const S3_BUCKET_NAME = process.env.NEXT_PUBLIC_BACKGROUND_VIDEOS_BUCKET || "remotion-background-videos";
const S3_REGION = process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1";

// Get S3 URL for background videos
const getS3Url = (videoFileName: string): string => {
  // Use S3 public URL format: https://bucket-name.s3.region.amazonaws.com/path/to/file
  return `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/videos/${videoFileName}`;
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
    length: "30s clip • 1080p @ 60fps",
    previewUrl: getS3Url(BACKGROUND_VIDEO_MAP.minecraft),
    durationSeconds: 30, // Duration in seconds
  },
  {
    id: "subway",
    name: "MineCraft Light",
    description: "Fast-paced urban parkour with vibrant city visuals.",
    length: "1080p @ 60fps",
    previewUrl: getS3Url(BACKGROUND_VIDEO_MAP.subway),
    durationSeconds: 120, // Estimated duration - adjust based on actual video length
  },
  {
    id: "mine_2_cfr",
    name: "Mine Craft Cool",
    description: "Cool Minecraft gameplay with smooth visuals.",
    length: "1080p @ 60fps",
    previewUrl: getS3Url(BACKGROUND_VIDEO_MAP.mine_2_cfr),
    durationSeconds: 120, // Estimated duration - adjust based on actual video length
  },
];

/**
 * Get background duration in seconds
 */
export function getBackgroundDuration(backgroundId: string | null | undefined): number | null {
  if (!backgroundId) return null;
  const background = BACKGROUNDS.find(bg => bg.id === backgroundId);
  return background?.durationSeconds ?? null;
}

