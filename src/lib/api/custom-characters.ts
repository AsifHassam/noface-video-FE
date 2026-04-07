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
  const timeoutId = setTimeout(() => controller.abort(), 25000);

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

export type CustomCharacter = {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string;
  voice_id: string;
  created_at: string;
  updated_at: string;
};

export type ApiKeyInfo = {
  provider: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Create a new custom character
 */
export async function createCustomCharacter(
  name: string,
  voiceId: string,
  imageFile: File
): Promise<CustomCharacter> {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('voiceId', voiceId);
  formData.append('image', imageFile);

  const token = await getAuthToken(true);
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}/api/custom-characters`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ 
      error: `HTTP ${response.status}: ${response.statusText}` 
    }));
    throw new Error(errorData.error || errorData.message || 'Failed to create character');
  }

  const data = await response.json();
  return data.character;
}

/**
 * Get all custom characters for the current user
 */
export async function getCustomCharacters(): Promise<CustomCharacter[]> {
  const result = await apiRequest<{ success: boolean; characters: CustomCharacter[] }>(
    '/api/custom-characters'
  );
  return result.characters || [];
}

/**
 * Delete a custom character
 */
export async function deleteCustomCharacter(characterId: string): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    `/api/custom-characters/${characterId}`,
    { method: 'DELETE' }
  );
}

/**
 * Save or update Eleven Labs API key
 */
export async function saveApiKey(apiKey: string, provider: string = 'elevenlabs'): Promise<void> {
  await apiRequest<{ success: boolean; message: string }>(
    '/api/custom-characters/api-keys',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey, provider }),
    }
  );
}

/**
 * Check if user has an API key saved
 */
export async function checkApiKey(provider: string = 'elevenlabs'): Promise<{
  hasKey: boolean;
  keyInfo: ApiKeyInfo | null;
}> {
  const result = await apiRequest<{
    success: boolean;
    hasKey: boolean;
    keyInfo: ApiKeyInfo | null;
  }>(`/api/custom-characters/api-keys?provider=${provider}`);
  return {
    hasKey: result.hasKey,
    keyInfo: result.keyInfo,
  };
}

