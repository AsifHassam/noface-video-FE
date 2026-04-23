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
  retryOn401: boolean = true,
  timeoutMs: number = 25000
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
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);
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
  /** User upload vs Freepik stock (when API key is set on server) */
  source?: 'user' | 'freepik';
};

export type ListBRollsOptions = {
  /** When set, server uses OpenAI to derive the Freepik stock video search term */
  script?: string;
  /**
   * When set (non-empty), server resolves **one unique stock clip per scene** (no duplicate Freepik assets across scenes).
   * Takes precedence over a single `script` for stock term.
   */
  scenes?: string[];
  /** Overrides LLM when set */
  stockTerm?: string;
  includeStock?: boolean;
  /**
   * When true, only Freepik stock library clips are returned (no user uploads).
   * Requires FREEPIK_API_KEY on the Remotion server.
   */
  stockOnly?: boolean;
};

export type SceneStockBRollRow = {
  sceneIndex: number;
  sceneText: string;
  stockSearchTerm: string;
  bRoll: BRoll | null;
};

export type ListBRollsResult = {
  success: boolean;
  bRolls: BRoll[];
  /** Present when stock was fetched (Freepik + term resolution) */
  stockSearchTerm?: string;
  /** One term per scene when `scenes` was sent */
  stockSearchTerms?: string[];
  /** Per-scene stock clip (unique ids when API returns hits) */
  sceneStockBRolls?: SceneStockBRollRow[];
};

/**
 * B-Rolls API methods
 */
export const bRollsApi = {
  /**
   * Upload a B-roll video
   */
  async upload(file: File, name?: string): Promise<{ success: boolean; bRoll: BRoll }> {
    console.log('[B-roll] bRollsApi.upload start', { name: name ?? file.name, size: file.size, type: file.type });
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
      console.log('[B-roll] bRollsApi.upload failed', errorData);
      throw new Error(errorData.error || errorData.message || 'Failed to upload B-roll');
    }

    const data = await response.json();
    console.log('[B-roll] bRollsApi.upload success', { id: data.bRoll?.id, url: data.bRoll?.url?.slice(0, 64) });
    return data;
  },

  /**
   * Get all B-rolls for the current user (uploads + optional Freepik stock).
   * Pass `script` to let the server use OpenAI to choose the stock footage search term.
   */
  async list(opts?: ListBRollsOptions): Promise<ListBRollsResult> {
    if (opts?.scenes && opts.scenes.length > 0) {
      console.log('[B-roll] bRollsApi.list POST /api/b-rolls/list (per-scene)', {
        sceneCount: opts.scenes.length,
        stockOnly: opts.stockOnly,
      });
      const result = await apiRequest<ListBRollsResult>(
        '/api/b-rolls/list',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            scenes: opts.scenes,
            ...(opts.stockTerm ? { stockTerm: opts.stockTerm } : {}),
            ...(opts.includeStock === false ? { includeStock: false } : {}),
            ...(opts.stockOnly === true ? { stockOnly: true } : {}),
          }),
        },
        true,
        180000
      );
      console.log('[B-roll] bRollsApi.list per-scene response', {
        count: result.bRolls?.length ?? 0,
        sceneRows: result.sceneStockBRolls?.length ?? 0,
      });
      return result;
    }
    if (opts?.script?.trim()) {
      console.log('[B-roll] bRollsApi.list POST /api/b-rolls/list', {
        scriptLen: opts.script.trim().length,
        stockTerm: opts.stockTerm ?? null,
        includeStock: opts.includeStock,
        stockOnly: opts.stockOnly,
      });
      const result = await apiRequest<ListBRollsResult>(
        '/api/b-rolls/list',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            script: opts.script.trim(),
            ...(opts.stockTerm ? { stockTerm: opts.stockTerm } : {}),
            ...(opts.includeStock === false ? { includeStock: false } : {}),
            ...(opts.stockOnly === true ? { stockOnly: true } : {}),
          }),
        },
        true,
        90000
      );
      console.log('[B-roll] bRollsApi.list response', {
        count: result.bRolls?.length ?? 0,
        stockSearchTerm: result.stockSearchTerm ?? null,
      });
      return result;
    }
    const p = new URLSearchParams();
    if (opts?.stockTerm?.trim()) p.set('stockTerm', opts.stockTerm.trim());
    if (opts?.includeStock === false) p.set('includeStock', 'false');
    if (opts?.stockOnly === true) p.set('stockOnly', 'true');
    const q = p.toString();
    console.log('[B-roll] bRollsApi.list GET /api/b-rolls', q || '(no query)');
    const result = await apiRequest<ListBRollsResult>(`/api/b-rolls${q ? `?${q}` : ''}`);
    console.log('[B-roll] bRollsApi.list GET response', { count: result.bRolls?.length ?? 0 });
    return result;
  },

  /**
   * Delete a B-roll
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    console.log('[B-roll] bRollsApi.delete', id);
    const r = await apiRequest<{ success: boolean; message: string }>(`/api/b-rolls/${id}`, {
      method: 'DELETE',
    });
    console.log('[B-roll] bRollsApi.delete done', r);
    return r;
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

