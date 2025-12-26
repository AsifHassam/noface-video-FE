import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';
import type { Project, VideoTemplate } from '@/types';
import { getCachedToken, refreshToken } from '@/lib/utils/token-cache';

const API_BASE_URL = config.remotionServerUrl;

/**
 * Get authentication token from Supabase session
 * Uses token cache to prevent expiration issues during long-running operations
 */
export async function getAuthToken(useCache: boolean = true): Promise<string | null> {
  console.log("🟣 Getting auth token...");
  
  // Use cached token for better reliability during long operations
  if (useCache) {
    const cachedToken = await getCachedToken();
    if (cachedToken) {
      return cachedToken;
    }
  }
  
  // Fallback to direct session access (for backward compatibility)
  try {
    if (typeof window === 'undefined') {
      console.log("🟣 Not in browser, no token available");
      return null;
    }
    
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      console.error("🟣 Session error:", error);
      return null;
    }
    
    return session.access_token;
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

  // Log request body if it exists
  if (options.body) {
    try {
      const bodyObj = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      console.log("🔵 Request body being sent:", JSON.stringify(bodyObj, null, 2));
      console.log("🔵 Request body keys:", Object.keys(bodyObj || {}));
      if (bodyObj?.redditTitle !== undefined) {
        console.log("🔵 Request body redditTitle:", {
          value: bodyObj.redditTitle,
          type: typeof bodyObj.redditTitle,
          length: bodyObj.redditTitle ? bodyObj.redditTitle.length : 0,
        });
      } else {
        console.log("🔵 Request body does NOT contain redditTitle");
      }
    } catch (e) {
      console.log("🔵 Request body (could not parse):", options.body);
    }
  } else {
    console.log("🔵 No request body");
  }

  // Add AbortController for timeout (25 seconds, before the 30s Promise.race timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    let response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log("🔵 Response:", response.status, response.statusText);

    // Handle 401 (Unauthorized) - token might have expired, try to refresh
    if (response.status === 401) {
      console.warn('⚠️ Got 401, attempting token refresh...');
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        headers['Authorization'] = `Bearer ${refreshedToken}`;
        console.log('🔄 Retrying request with refreshed token...');
        // Retry the request with refreshed token
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
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      console.error("❌ API Error:", error);
      throw new Error(error.error || error.message || 'API request failed');
    }

    const data = await response.json();
    console.log("🔵 Success:", data);
    console.log("🔍 Response data structure:", {
      hasSuccess: 'success' in data,
      success: data.success,
      hasRenderJobId: 'render_job_id' in data,
      renderJobId: data.render_job_id,
      hasStatus: 'status' in data,
      status: data.status,
      allKeys: Object.keys(data)
    });
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
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
   * Generate audio files only (for browser preview) - no video render
   */
  async generateAudio(projectId: string): Promise<{
    success: boolean;
    projectId: string;
    audioFiles: Array<{
      speaker: string;
      text: string;
      fileName: string;
      storagePath: string;
      publicUrl: string | null;
      startMs: number;
      endMs: number;
      durationMs: number;
      durationSec: number;
      reused: boolean;
    }>;
    mergedAudioUrl?: string | null;
    mergedDurationMs?: number;
    totalDurationMs: number;
    totalDurationSec: number;
    ttsProvider: string;
    audioReusedCount: number;
    conversations: Array<{
      speaker: string;
      text: string;
      audioUrl: string | null;
      startMs: number;
      endMs: number;
    }>;
  }> {
    console.log("🎤 renderApi.generateAudio called for project:", projectId);
    return apiRequest(`/api/projects/${projectId}/generate-audio`, {
      method: 'POST',
    });
  },

  /**
   * Generate preview video with free TTS (queued)
   */
  async generatePreview(projectId: string): Promise<{
    success: boolean;
    render_job_id: string | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    queue_position: number;
    estimated_wait_time: number;
    message?: string;
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
    characterCustomPositions?: any;
    redditTitle?: string;
  }): Promise<{
    success: boolean;
    message?: string;
    render_job_id?: string;
    status?: string;
    queue_position?: number;
    estimated_wait_time?: number;
    videoUrl?: string; // For backward compatibility
  }> {
    console.log("🎬 renderApi.generateFinal called for project:", projectId);
    console.log("📤 renderApi.generateFinal FULL data payload:", JSON.stringify(data, null, 2));
    console.log("📤 renderApi.generateFinal data payload summary:", {
      hasCharacterSizes: !!data?.characterSizes,
      hasCharacterPositions: !!data?.characterPositions,
      hasCharacterCustomPositions: !!data?.characterCustomPositions,
      characterCustomPositions: data?.characterCustomPositions,
      characterCustomPositionsKeys: data?.characterCustomPositions ? Object.keys(data.characterCustomPositions) : [],
      hasRedditTitle: !!data?.redditTitle,
      redditTitle: data?.redditTitle,
      redditTitleType: typeof data?.redditTitle,
      redditTitleLength: data?.redditTitle ? data.redditTitle.length : 0,
      fullDataKeys: data ? Object.keys(data) : [],
    });
    
    const requestBody = data ? JSON.stringify(data) : undefined;
    console.log("📤 renderApi.generateFinal request body (stringified):", requestBody);
    console.log("📤 renderApi.generateFinal request body size:", requestBody ? requestBody.length : 0, "bytes");
    
    return apiRequest(`/api/projects/${projectId}/render/final`, {
      method: 'POST',
      body: requestBody,
    });
  },

  /**
   * Get render job status
   */
  async getRenderJobStatus(projectId: string, jobId: string): Promise<{
    success: boolean;
    render_job: {
      id: string;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      progress: number;
      video_url: string | null;
      result_url: string | null;
      error_message: string | null;
      metadata?: {
        durationSec?: number;
        srtText?: string;
        conversations?: Array<{
          speaker: string;
          text: string;
          startMs: number;
          endMs: number;
        }>;
      };
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

/**
 * Template API methods
 */
export const templatesApi = {
  /**
   * Get all templates for the current user
   */
  async list(params?: {
    projectType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; templates: VideoTemplate[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.projectType) queryParams.set('projectType', params.projectType);
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());

    const query = queryParams.toString();
    return apiRequest(`/api/templates${query ? `?${query}` : ''}`);
  },

  /**
   * Get a specific template
   */
  async get(id: string): Promise<{ success: boolean; template: VideoTemplate }> {
    return apiRequest(`/api/templates/${id}`);
  },

  /**
   * Create a new template
   */
  async create(data: {
    name: string;
    description?: string;
    projectType: string;
    backgroundId: string;
    subtitleStyle: string;
    subtitlePosition?: { x: number; y: number };
    subtitleFontSize?: number;
    textOverlays: any[];
    characters?: { A: any | null; B: any | null };
    characterSizes?: any;
    characterPositions?: any;
    characterCustomPositions?: Record<string, { x: number; y: number }>;
    playbackRate?: number;
  }): Promise<{ success: boolean; template: VideoTemplate }> {
    return apiRequest('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a template
   */
  async update(
    id: string,
    data: Partial<VideoTemplate>
  ): Promise<{ success: boolean; template: VideoTemplate }> {
    return apiRequest(`/api/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a template
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/templates/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Render Jobs API methods
 */
export const renderJobsApi = {
  /**
   * Get all render jobs for the current user
   */
  async list(): Promise<{
    success: boolean;
    renderJobs: Array<{
      id: string;
      projectId: string | null;
      type: string;
      status: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
      progress: number;
      videoUrl: string | null;
      errorMessage: string | null;
      createdAt: string;
      updatedAt: string;
      startedAt: string | null;
      completedAt: string | null;
      project: {
        id: string;
        title: string;
        userId: string;
        status: string;
        finalUrl: string | null;
        previewUrl: string | null;
        createdAt: string;
        updatedAt: string;
        type: string;
      } | null;
    }>;
  }> {
    return apiRequest('/api/render-jobs');
  },
};

/**
 * Named export for getRenderJobStatus for convenience
 * This allows dynamic imports like: const { getRenderJobStatus } = await import('@/lib/api/projects');
 */
export const getRenderJobStatus = renderApi.getRenderJobStatus.bind(renderApi);

