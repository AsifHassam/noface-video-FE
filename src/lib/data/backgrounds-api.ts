import { getBackgroundVideos, type BackgroundVideo } from '@/lib/api/background-videos';
import type { Background } from '@/types';

/**
 * Convert API BackgroundVideo to app Background type
 */
function convertBackgroundVideo(apiBg: BackgroundVideo): Background {
  return {
    id: apiBg.background_id as any,
    name: apiBg.name,
    description: apiBg.description || '',
    length: apiBg.length || '1080p @ 60fps',
    previewUrl: apiBg.s3_url,
    durationSeconds: apiBg.duration_seconds || undefined,
  };
}

/**
 * Get all background videos from API
 */
export async function getBackgrounds(): Promise<Background[]> {
  try {
    const apiBackgrounds = await getBackgroundVideos();
    return apiBackgrounds.map(convertBackgroundVideo);
  } catch (error) {
    console.error('Error fetching background videos:', error);
    // Return empty array on error (frontend should handle gracefully)
    return [];
  }
}

/**
 * Get background duration in seconds
 */
export async function getBackgroundDuration(backgroundId: string | null | undefined): Promise<number | null> {
  if (!backgroundId) return null;
  
  try {
    const backgrounds = await getBackgrounds();
    const background = backgrounds.find(bg => bg.id === backgroundId);
    return background?.durationSeconds ?? null;
  } catch (error) {
    console.error('Error getting background duration:', error);
    return null;
  }
}

