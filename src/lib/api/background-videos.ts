import { config } from '@/lib/config';
import { getAccessTokenFromStorage } from '@/lib/auth-rest';
import { getCachedToken, refreshToken } from '@/lib/utils/token-cache';

const API_BASE_URL = config.remotionServerUrl;

/**
 * Get authentication token from Supabase session
 */
async function getAuthToken(useCache: boolean = true): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    
    if (useCache) {
      const cachedToken = await getCachedToken();
      if (cachedToken) {
        return cachedToken;
      }
    }
    
    return getAccessTokenFromStorage();
  } catch (error) {
    console.error('getAuthToken failed:', error);
    return null;
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOn401: boolean = true
): Promise<T> {
  let token = await getAuthToken(true);
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for video uploads

  try {
    let response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && retryOn401) {
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        headers['Authorization'] = `Bearer ${refreshedToken}`;
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 60000);
        try {
          response = await fetch(url, {
            ...options,
            headers,
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
        } catch (retryError) {
          clearTimeout(retryTimeoutId);
          throw retryError;
        }
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(errorData.error || errorData.message || 'API request failed');
    }

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

export type BackgroundVideo = {
  id: string;
  background_id: string;
  name: string;
  description?: string | null;
  video_file_name: string;
  s3_bucket: string;
  s3_key: string;
  s3_url: string;
  duration_seconds?: number | null;
  length?: string | null;
  enabled: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Get all enabled background videos (public)
 */
export async function getBackgroundVideos(): Promise<BackgroundVideo[]> {
  const result = await apiRequest<{ success: boolean; backgrounds: BackgroundVideo[] }>(
    '/api/background-videos'
  );
  return result.backgrounds || [];
}

/**
 * Get all background videos including disabled ones (admin only)
 */
export async function getAllBackgroundVideos(): Promise<BackgroundVideo[]> {
  const result = await apiRequest<{ success: boolean; backgrounds: BackgroundVideo[] }>(
    '/api/background-videos/all'
  );
  return result.backgrounds || [];
}

/**
 * Upload a new background video (admin only)
 */
export async function uploadBackgroundVideo(
  backgroundId: string,
  name: string,
  videoFile: File,
  description?: string,
  durationSeconds?: number,
  length?: string
): Promise<BackgroundVideo> {
  const formData = new FormData();
  formData.append('backgroundId', backgroundId);
  formData.append('name', name);
  formData.append('video', videoFile);
  if (description) formData.append('description', description);
  if (durationSeconds) formData.append('durationSeconds', durationSeconds.toString());
  if (length) formData.append('length', length);

  const token = await getAuthToken(true);
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}/api/background-videos`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes for large uploads

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(errorData.error || errorData.message || 'Failed to upload background video');
    }

    const data = await response.json();
    return data.background;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout');
    }
    throw error;
  }
}

/**
 * Update background video (admin only)
 */
export async function updateBackgroundVideo(
  id: string,
  updates: {
    name?: string;
    description?: string;
    durationSeconds?: number;
    length?: string;
    enabled?: boolean;
  }
): Promise<BackgroundVideo> {
  const result = await apiRequest<{ success: boolean; background: BackgroundVideo }>(
    `/api/background-videos/${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );
  return result.background;
}

/**
 * Delete background video (admin only)
 */
export async function deleteBackgroundVideo(id: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/background-videos/${id}`,
    { method: 'DELETE' }
  );
}

