import type { Background } from "@/types";
import { getBackgrounds as getBackgroundsFromAPI, getBackgroundDuration as getBackgroundDurationFromAPI } from "./backgrounds-api";

// Export async function to get backgrounds from API
export async function getBackgrounds(): Promise<Background[]> {
  return getBackgroundsFromAPI();
}

/**
 * Get background duration in seconds
 */
export async function getBackgroundDuration(backgroundId: string | null | undefined): Promise<number | null> {
  return getBackgroundDurationFromAPI(backgroundId);
}

// Legacy export for backwards compatibility (will return empty array initially)
// Components should use getBackgrounds() instead
export const BACKGROUNDS: Background[] = [];

