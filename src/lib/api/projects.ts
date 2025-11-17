import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';
import type { Project } from '@/types';

const API_BASE_URL = config.remotionServerUrl;

/**
 * Get authentication token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  console.log("🟣 Getting auth token...");
  try {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      console.log("🟣 Not in browser, no token available");
      return null;
    }
    
    // Try 1: Read directly from Supabase localStorage
    try {
      const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
      if (supabaseProjectRef) {
        const storageKey = `sb-${supabaseProjectRef}-auth-token`;
        const data = localStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          const token = parsed?.access_token;
          if (token) {
            console.log("🟣 Token from localStorage: ✅");
            return token;
          }
        }
      }
    } catch (e) {
      console.log("🟣 Failed to get token from localStorage:", e);
    }
    
    // Try 2: Use async getSession (with timeout)
    console.log("🟣 Trying async getSession...");
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn("⚠️ getSession timeout after 2 seconds");
        resolve(null);
      }, 2000);
    });
    
    const sessionPromise = supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("🟣 Session error:", error);
        return null;
      }
      const token = session?.access_token || null;
      console.log("🟣 Session token:", token ? "✅ Found" : "❌ Not found");
      return token;
    });
    
    const token = await Promise.race([sessionPromise, timeoutPromise]);
    return token;
  } catch (error) {
    console.error("❌ getAuthToken failed:", error);
    return null;
  }
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  console.log("🔵 apiRequest:", endpoint, options.method || 'GET');
  
  const token = await getAuthToken();
  console.log("🔵 Token:", token ? "✅ Present" : "❌ Missing");
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log("🔵 Fetching:", url);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log("🔵 Response:", response.status, response.statusText);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      console.error("❌ API Error:", error);
      throw new Error(error.error || error.message || 'API request failed');
    }

    const data = await response.json();
    console.log("🔵 Success:", data);
    return data;
  } catch (error) {
    console.error("❌ Fetch failed:", error);
    throw error;
  }
}

/**
 * Project API methods
 */
export const projectsApi = {
  /**
   * Get all projects
   */
  async list(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; projects: Project[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set('status', params.status);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const query = queryParams.toString();
    return apiRequest(`/api/projects${query ? `?${query}` : ''}`);
  },

  /**
   * Create a new project
   */
  async create(data: {
    title: string;
    description?: string;
    type?: string;
    backgroundId?: string;
  }): Promise<{ success: boolean; project: Project }> {
    console.log("🟠 projectsApi.create called with:", data);
    console.log("🟠 API_BASE_URL:", API_BASE_URL);
    const result = await apiRequest<{ success: boolean; project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    console.log("🟠 projectsApi.create result:", result);
    return result;
  },

  /**
   * Get a specific project
   */
  async get(id: string): Promise<{ success: boolean; project: Project }> {
    return apiRequest(`/api/projects/${id}`);
  },

  /**
   * Update a project
   */
  async update(
    id: string,
    data: Partial<Project>
  ): Promise<{ success: boolean; project: Project }> {
    return apiRequest(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Character API methods
 */
export const charactersApi = {
  /**
   * Get all characters for a project
   */
  async list(projectId: string) {
    return apiRequest(`/api/projects/${projectId}/characters`);
  },

  /**
   * Add a character to a project
   */
  async create(projectId: string, data: {
    name: string;
    voice_id?: string;
    voice_provider?: string;
    avatar_url?: string;
    position?: number;
    settings?: Record<string, any>;
  }) {
    return apiRequest(`/api/projects/${projectId}/characters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a character
   */
  async update(projectId: string, characterId: string, data: any) {
    return apiRequest(`/api/projects/${projectId}/characters/${characterId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a character
   */
  async delete(projectId: string, characterId: string) {
    return apiRequest(`/api/projects/${projectId}/characters/${characterId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Script API methods
 */
export const scriptApi = {
  /**
   * Get all script segments for a project
   */
  async list(projectId: string) {
    return apiRequest(`/api/projects/${projectId}/script`);
  },

  /**
   * Bulk create/update script segments
   */
  async bulkUpsert(projectId: string, segments: Array<{
    character_id: string;
    content: string;
    position: number;
    duration_ms?: number;
    start_time_ms?: number;
    metadata?: Record<string, any>;
  }>) {
    return apiRequest(`/api/projects/${projectId}/script`, {
      method: 'POST',
      body: JSON.stringify({ segments }),
    });
  },

  /**
   * Update a script segment
   */
  async update(projectId: string, segmentId: string, data: any) {
    return apiRequest(`/api/projects/${projectId}/script/${segmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a script segment
   */
  async delete(projectId: string, segmentId: string) {
    return apiRequest(`/api/projects/${projectId}/script/${segmentId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Render API methods
 */
export const renderApi = {
  /**
   * Generate preview video with free TTS
   */
  async generatePreview(projectId: string): Promise<{
    success: boolean;
    videoUrl: string;
    durationSec: number;
    srtText: string;
    conversations: Array<{
      speaker: string;
      text: string;
      startMs: number;
      endMs: number;
    }>;
  }> {
    console.log("🎬 renderApi.generatePreview called for project:", projectId);
    return apiRequest(`/api/projects/${projectId}/render/preview`, {
      method: 'POST',
    });
  },

  /**
   * Generate final video with customizations
   */
  async generateFinal(projectId: string, data?: {
    textOverlays?: any[];
    subtitleCustomizations?: any;
    srtText?: string;
    imageOverlays?: any[];
    playbackRate?: number;
    characterSizes?: any;
    characterPositions?: any;
  }): Promise<{
    success: boolean;
    videoUrl: string;
    render_job_id?: string;
  }> {
    console.log("🎬 renderApi.generateFinal called for project:", projectId);
    return apiRequest(`/api/projects/${projectId}/render/final`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  /**
   * Get render job status
   */
  async getRenderJobStatus(projectId: string, jobId: string): Promise<{
    success: boolean;
    render_job: {
      id: string;
      status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
      progress: number;
      video_url: string | null;
      error_message: string | null;
    };
  }> {
    return apiRequest(`/api/projects/${projectId}/render/${jobId}`, {
      method: 'GET',
    });
  },

  /**
   * Generate captions via STT for a project
   */
  async generateCaptions(projectId: string): Promise<{
    success: boolean;
    segmentsCount: number;
    srtText: string;
  }> {
    console.log("🟡 renderApi.generateCaptions called for project:", projectId);
    return apiRequest(`/api/projects/${projectId}/captions`, {
      method: 'POST',
    });
  },
};

