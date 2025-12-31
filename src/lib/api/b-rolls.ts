import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';
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
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      return null;
    }
    
    return session.access_token;
  } catch (error) {
    console.error('❌ [b-rolls] getAuthToken failed:', error);
    return null;
  }
}

/**
 * Make authenticated API request
 * Automatically handles token refresh on 401 errors
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
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    let response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 401 (Unauthorized) - token might have expired
    if (response.status === 401 && retryOn401) {
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        headers['Authorization'] = `Bearer ${refreshedToken}`;
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 25000);
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

/**
 * B-Roll type definition
 */
export type BRoll = {
  id: string;
  name: string;
  url: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * B-Rolls API methods
 */
export const bRollsApi = {
  /**
   * Upload a B-roll video
   */
  async upload(file: File, name?: string): Promise<{ success: boolean; bRoll: BRoll }> {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('video', file);
    if (name) {
      formData.append('name', name);
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE_URL}/api/b-rolls/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(errorData.error || errorData.message || 'Failed to upload B-roll');
    }

    return await response.json();
  },

  /**
   * Get all B-rolls for the current user
   */
  async list(): Promise<{ success: boolean; bRolls: BRoll[] }> {
    return apiRequest('/api/b-rolls');
  },

  /**
   * Delete a B-roll
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/b-rolls/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Update B-roll metadata (e.g., name, thumbnail)
   */
  async update(
    id: string,
    updates: { name?: string; thumbnailUrl?: string }
  ): Promise<{ success: boolean; bRoll: BRoll }> {
    return apiRequest(`/api/b-rolls/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
  },
};

