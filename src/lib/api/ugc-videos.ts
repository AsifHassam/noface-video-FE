import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';
import type { UGCVideoProject, UGCVoiceGeneration, UGCGeneratedVideo } from '@/lib/supabase';
import { getCachedToken, refreshToken } from '@/lib/utils/token-cache';

const API_BASE_URL = config.remotionServerUrl;

/**
 * Get authentication token from Supabase session
 * Uses token cache to prevent expiration issues during long-running operations
 */
async function getAuthToken(useCache: boolean = true): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    
    // Use cached token for long-running operations
    if (useCache) {
      const cachedToken = await getCachedToken();
      if (cachedToken) {
        return cachedToken;
      }
    }
    
    // Fallback to direct session access (for backward compatibility)
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      console.error("🟣 [ugc-videos] Session error:", error);
      return null;
    }
    
    return session.access_token;
  } catch (error) {
    console.error('❌ [ugc-videos] getAuthToken failed:', error);
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
  console.log('🔵 [ugc-videos] apiRequest called:', endpoint, options.method || 'GET');
  
  // Check network connectivity first
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('No internet connection. Please check your network and try again.');
  }
  
  // Use cached token for better reliability during long operations
  let token = await getAuthToken(true);
  console.log('🔵 [ugc-videos] Token:', token ? "✅ Present" : "❌ Missing");
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  console.log('🔵 [ugc-videos] Fetching:', url);

  // Add AbortController for timeout (25 seconds) - same as projects.ts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    console.log('🔵 [ugc-videos] Making fetch request...');
    let response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    console.log('🔵 [ugc-videos] Response:', response.status, response.statusText);

    clearTimeout(timeoutId); // Clear timeout on success

    // Handle 401 (Unauthorized) - token might have expired
    if (response.status === 401 && retryOn401) {
      console.warn('⚠️ [ugc-videos] Got 401, attempting token refresh...');
      // Try to refresh token and retry once
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        headers['Authorization'] = `Bearer ${refreshedToken}`;
        console.log('🔄 [ugc-videos] Retrying request with refreshed token...');
        // Create new controller for retry
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
      console.error("❌ [ugc-videos] API Error:", response.status, errorData);
      throw new Error(errorData.error || errorData.message || 'API request failed');
    }

    const data = await response.json();
    console.log('🔵 [ugc-videos] Success:', data);
    return data;
  } catch (error: any) {
    clearTimeout(timeoutId); // Always clear timeout
    console.error('❌ [ugc-videos] Fetch failed:', error);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * UGC Video API functions
 */

/**
 * Create a new UGC video project
 */
export async function createUGCProject(title: string, description?: string): Promise<UGCVideoProject> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    throw new Error('Authentication required');
  }

  const { data, error } = await supabase
    .from('ugc_video_projects')
    .insert({
      user_id: session.user.id,
      title,
      description: description || null,
      status: 'DRAFT',
      metadata: {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating UGC project:', error);
    throw new Error(`Failed to create project: ${error.message}`);
  }

  return data;
}

/**
 * Get a UGC video project by ID
 */
export async function getUGCProject(projectId: string): Promise<UGCVideoProject> {
  console.log('[getUGCProject] Fetching project:', projectId);
  
  // Get token - use REST API directly to avoid hanging Supabase client queries
  const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
  let token = await getCachedToken();
  
  if (!token) {
    throw new Error('Authentication required - no token available');
  }
  
  // Extract userId from token
  let userId: string | undefined;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub || payload.user_id;
    console.log('[getUGCProject] Extracted userId from token:', userId);
  } catch (e) {
    console.warn('[getUGCProject] Failed to parse token payload:', e);
    throw new Error('Invalid authentication token');
  }
  
  // Use Supabase REST API directly with fetch (bypasses client connection issues)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  const url = `${supabaseUrl}/rest/v1/ugc_video_projects?id=eq.${projectId}${userId ? `&user_id=eq.${userId}` : ''}&select=*`;
  
  const makeRequest = async (authToken: string) => {
    console.log('[getUGCProject] Using REST API directly with token');
    return fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseAnonKey
      }
    });
  };
  
  let response = await makeRequest(token);
  
  // Handle 401 - refresh token and retry
  if (response.status === 401) {
    console.warn('[getUGCProject] Got 401, attempting token refresh...');
    const refreshedToken = await refreshToken();
    if (refreshedToken) {
      console.log('[getUGCProject] Retrying with refreshed token...');
      response = await makeRequest(refreshedToken);
    } else {
      throw new Error('Authentication failed. Please refresh the page and try again.');
    }
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[getUGCProject] REST API error:', response.status, errorText);
    throw new Error(`Failed to fetch project: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('[getUGCProject] ✅ Fetch successful via REST API');
  
  // Return single item (Supabase returns array)
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }
  
  throw new Error('Project not found');
}

/**
 * Update a UGC video project
 */
export async function updateUGCProject(
  projectId: string,
  updates: Partial<UGCVideoProject>
): Promise<UGCVideoProject> {
  console.log('[updateUGCProject] Starting update for project:', projectId);
  
  // Get token - use REST API directly to avoid hanging Supabase client queries
  const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
  let token = await getCachedToken();
  
  if (!token) {
    throw new Error('Authentication required - no token available');
  }
  
  // Extract userId from token
  let userId: string | undefined;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub || payload.user_id;
    console.log('[updateUGCProject] Extracted userId from token:', userId);
  } catch (e) {
    console.warn('[updateUGCProject] Failed to parse token payload:', e);
    throw new Error('Invalid authentication token');
  }
  
  // Use Supabase REST API directly with fetch (bypasses client connection issues)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  const url = `${supabaseUrl}/rest/v1/ugc_video_projects?id=eq.${projectId}${userId ? `&user_id=eq.${userId}` : ''}`;
  
  const makeRequest = async (authToken: string) => {
    console.log('[updateUGCProject] Using REST API directly with token');
    return fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseAnonKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        ...updates,
        updated_at: new Date().toISOString()
      })
    });
  };
  
  let response = await makeRequest(token);
  
  // Handle 401 - refresh token and retry
  if (response.status === 401) {
    console.warn('[updateUGCProject] Got 401, attempting token refresh...');
    const refreshedToken = await refreshToken();
    if (refreshedToken) {
      console.log('[updateUGCProject] Retrying with refreshed token...');
      response = await makeRequest(refreshedToken);
    } else {
      throw new Error('Authentication failed. Please refresh the page and try again.');
    }
  }
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[updateUGCProject] REST API error:', response.status, errorText);
    throw new Error(`Failed to update project: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('[updateUGCProject] ✅ Update successful via REST API');
  
  // Return single item (Supabase returns array for PATCH with return=representation)
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Save voice generation data
 */
export async function saveVoiceGeneration(
  projectId: string,
  voiceId: string,
  voiceName: string | null,
  scriptText: string,
  audioUrl: string | null,
  audioStoragePath: string | null,
  durationSeconds: number | null
): Promise<UGCVoiceGeneration> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    throw new Error('Authentication required');
  }

  // Verify project belongs to user
  const { data: project } = await supabase
    .from('ugc_video_projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', session.user.id)
    .single();

  if (!project) {
    throw new Error('Project not found or access denied');
  }

  const { data, error } = await supabase
    .from('ugc_voice_generations')
    .insert({
      project_id: projectId,
      voice_id: voiceId,
      voice_name: voiceName,
      voice_provider: 'elevenlabs',
      script_text: scriptText,
      audio_url: audioUrl,
      audio_storage_path: audioStoragePath,
      duration_seconds: durationSeconds,
      metadata: {}
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving voice generation:', error);
    throw new Error(`Failed to save voice generation: ${error.message}`);
  }

  // Update project status
  await updateUGCProject(projectId, { status: 'GENERATING_LIPSYNC' });

  return data;
}

/**
 * Save generated video
 */
export async function saveGeneratedVideo(
  projectId: string,
  voiceGenerationId: string | null,
  videoUrl: string,
  videoStoragePath: string | null,
  thumbnailUrl: string | null,
  durationSeconds: number | null
): Promise<UGCGeneratedVideo> {
  console.log('[saveGeneratedVideo] Starting save for project:', projectId);
  
  // Get token - use REST API directly to avoid hanging Supabase client queries
  const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
  let token = await getCachedToken();
  
  if (!token) {
    throw new Error('Authentication required - no token available');
  }
  
  // Extract userId from token
  let userId: string | undefined;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub || payload.user_id;
    console.log('[saveGeneratedVideo] Extracted userId from token:', userId);
  } catch (e) {
    console.warn('[saveGeneratedVideo] Failed to parse token payload:', e);
    throw new Error('Invalid authentication token');
  }
  
  // Use Supabase REST API directly with fetch (bypasses client connection issues)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }
  
  // First, verify project belongs to user
  const projectUrl = `${supabaseUrl}/rest/v1/ugc_video_projects?id=eq.${projectId}${userId ? `&user_id=eq.${userId}` : ''}&select=id`;
  
  const verifyProject = async (authToken: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    try {
      const response = await fetch(projectUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.status === 401 && authToken === token) {
        // Try refreshing token
        const refreshedToken = await refreshToken();
        if (refreshedToken) {
          return verifyProject(refreshedToken);
        }
      }
      
      if (!response.ok) {
        throw new Error(`Failed to verify project: ${response.status} ${response.statusText}`);
      }
      
      const projectData = await response.json();
      if (!projectData || projectData.length === 0) {
        throw new Error('Project not found or access denied');
      }
      
      return projectData[0];
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out while verifying project');
      }
      throw error;
    }
  };
  
  // Save generated video
  const insertUrl = `${supabaseUrl}/rest/v1/ugc_generated_videos`;
  
  const saveVideo = async (authToken: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      console.log('[saveGeneratedVideo] Inserting video record via REST API');
      const response = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          project_id: projectId,
          voice_generation_id: voiceGenerationId,
          video_url: videoUrl,
          video_storage_path: videoStoragePath,
          thumbnail_url: thumbnailUrl,
          duration_seconds: durationSeconds,
          metadata: {}
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.status === 401 && authToken === token) {
        // Try refreshing token
        const refreshedToken = await refreshToken();
        if (refreshedToken) {
          return saveVideo(refreshedToken);
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(`Failed to save generated video: ${errorData.message || response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out while saving video');
      }
      throw error;
    }
  };
  
  try {
    // Verify project first
    await verifyProject(token);
    
    // Save video
    const savedVideo = await saveVideo(token);
    
    console.log('[saveGeneratedVideo] ✅ Video saved successfully:', savedVideo.id);
    
    // Update project status and final video URL (non-blocking)
    updateUGCProject(projectId, {
      status: 'READY',
      final_video_url: videoUrl,
      duration_seconds: durationSeconds
    }).catch((error) => {
      console.error('[saveGeneratedVideo] Failed to update project status:', error);
      // Don't throw - video is saved, project update is secondary
    });
    
    return savedVideo;
  } catch (error: any) {
    console.error('[saveGeneratedVideo] ❌ Error:', error);
    
    // Try refreshing token and retry once
    if (error.message.includes('Authentication') || error.message.includes('401')) {
      console.log('[saveGeneratedVideo] Attempting token refresh and retry...');
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        try {
          await verifyProject(refreshedToken);
          const savedVideo = await saveVideo(refreshedToken);
          
          // Update project status
          updateUGCProject(projectId, {
            status: 'READY',
            final_video_url: videoUrl,
            duration_seconds: durationSeconds
          }).catch((error) => {
            console.error('[saveGeneratedVideo] Failed to update project status:', error);
          });
          
          return savedVideo;
        } catch (retryError: any) {
          console.error('[saveGeneratedVideo] Retry also failed:', retryError);
          throw retryError;
        }
      }
    }
    
    throw error;
  }
}

/**
 * Get all generated videos for the current user
 */
export async function getUserGeneratedVideos(): Promise<UGCGeneratedVideo[]> {
  try {
    const response = await apiRequest<{ success: boolean; data: UGCGeneratedVideo[] }>(
      '/api/ugc/generated-videos'
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch generated videos');
    }
    
    return response.data || [];
  } catch (error: any) {
    console.error('Error fetching generated videos:', error);
    throw new Error(error.message || 'Failed to fetch generated videos');
  }
}

/**
 * Upload video file to Supabase Storage
 */
export async function uploadVideoToStorage(
  file: File | Blob,
  projectId: string,
  fileName: string
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    throw new Error('Authentication required');
  }

  const storagePath = `ugc-videos/${projectId}/${fileName}`;

  console.log('Uploading video to storage:', {
    bucket: 'videos',
    path: storagePath,
    fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
    contentType: file instanceof File ? file.type : 'video/mp4'
  });

  const { data, error } = await supabase.storage
    .from('videos')
    .upload(storagePath, file, {
      contentType: 'video/mp4',
      upsert: true,
      cacheControl: '3600'
    });

  if (error) {
    console.error('❌ Error uploading video:', error);
    console.error('Error details:', {
      message: error.message
    });
    throw new Error(`Failed to upload video: ${error.message}`);
  }

  console.log('✅ Video uploaded successfully:', data.path);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(storagePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL');
  }

  console.log('✅ Public URL:', urlData.publicUrl);
  return urlData.publicUrl;
}

/**
 * Upload audio file to Supabase Storage
 */
export async function uploadAudioToStorage(
  file: File | Blob,
  projectId: string,
  fileName: string
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    throw new Error('Authentication required');
  }

  const storagePath = `ugc-audio/${projectId}/${fileName}`;

  console.log('Uploading audio to storage:', {
    bucket: 'audios',
    path: storagePath,
    fileSize: (file.size / 1024).toFixed(2) + ' KB',
    contentType: file instanceof File ? file.type : 'audio/mpeg'
  });

  const { data, error } = await supabase.storage
    .from('audios')
    .upload(storagePath, file, {
      contentType: 'audio/mpeg',
      upsert: true,
      cacheControl: '3600'
    });

  if (error) {
    console.error('❌ Error uploading audio:', error);
    console.error('Error details:', {
      message: error.message
    });
    throw new Error(`Failed to upload audio: ${error.message}`);
  }

  console.log('✅ Audio uploaded successfully:', data.path);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('audios')
    .getPublicUrl(storagePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL');
  }

  console.log('✅ Public URL:', urlData.publicUrl);
  return urlData.publicUrl;
}

/**
 * Upload image file to Supabase Storage and save metadata to database
 */
export async function uploadImageToStorage(
  file: File | Blob,
  fileName: string
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    throw new Error('Authentication required');
  }

  const storagePath = `user-uploads/${session.user.id}/${fileName}`;
  const mimeType = file instanceof File ? file.type : 'image/jpeg';

  console.log('Uploading image to storage:', {
    bucket: 'images',
    path: storagePath,
    fileSize: (file.size / 1024).toFixed(2) + ' KB',
    contentType: mimeType
  });

  const { data, error } = await supabase.storage
    .from('images')
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: true,
      cacheControl: '3600'
    });

  if (error) {
    console.error('❌ Error uploading image:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  console.log('✅ Image uploaded successfully:', data.path);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(storagePath);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL');
  }

  console.log('✅ Public URL:', urlData.publicUrl);

  // Save metadata to database
  const { error: dbError } = await supabase
    .from('user_uploads')
    .insert({
      user_id: session.user.id,
      file_name: fileName,
      file_type: 'image',
      storage_path: storagePath,
      storage_url: urlData.publicUrl,
      file_size: file.size,
      mime_type: mimeType,
      metadata: {}
    });

  if (dbError) {
    console.error('❌ Error saving upload metadata:', dbError);
    // Don't throw - the file is uploaded, just metadata failed
    console.warn('⚠️  File uploaded but metadata not saved to database');
  } else {
    console.log('✅ Upload metadata saved to database');
  }

  return urlData.publicUrl;
}

/**
 * Get all uploaded images for the current user from database
 */
export async function getUserUploadedImages(): Promise<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>> {
  try {
    const response = await apiRequest<{ success: boolean; data: Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }> }>(
      '/api/ugc/uploaded-images'
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch uploaded images');
    }
    
    return response.data || [];
  } catch (error: any) {
    console.error('Error fetching uploaded images:', error);
    throw new Error(error.message || 'Failed to fetch uploaded images');
  }
}

/**
 * Get all uploaded videos for the current user from database
 */
export async function getUserUploadedVideos(): Promise<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>> {
  try {
    const response = await apiRequest<{ success: boolean; data: Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }> }>(
      '/api/ugc/uploaded-videos'
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch uploaded videos');
    }
    
    return response.data || [];
  } catch (error: any) {
    console.error('Error fetching uploaded videos:', error);
    throw new Error(error.message || 'Failed to fetch uploaded videos');
  }
}

/**
 * Delete an uploaded image
 */
export async function deleteUploadedImage(id: string): Promise<void> {
  try {
    const response = await apiRequest<{ success: boolean; message?: string; error?: string }>(
      `/api/ugc/uploaded-image/${id}`,
      { method: 'DELETE' }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete image');
    }
  } catch (error: any) {
    console.error('Error deleting uploaded image:', error);
    throw new Error(error.message || 'Failed to delete image');
  }
}

/**
 * Delete an uploaded video
 */
export async function deleteUploadedVideo(id: string): Promise<void> {
  try {
    const response = await apiRequest<{ success: boolean; message?: string; error?: string }>(
      `/api/ugc/uploaded-video/${id}`,
      { method: 'DELETE' }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete video');
    }
  } catch (error: any) {
    console.error('Error deleting uploaded video:', error);
    throw new Error(error.message || 'Failed to delete video');
  }
}

/**
 * Delete a generated video
 */
export async function deleteGeneratedVideo(id: string): Promise<void> {
  try {
    const response = await apiRequest<{ success: boolean; message?: string; error?: string }>(
      `/api/ugc/generated-video/${id}`,
      { method: 'DELETE' }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete generated video');
    }
  } catch (error: any) {
    console.error('Error deleting generated video:', error);
    throw new Error(error.message || 'Failed to delete generated video');
  }
}

/**
 * Get all uploaded audio files for the current user from database
 */
export async function getUserUploadedAudios(): Promise<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>> {
  try {
    const response = await apiRequest<{ success: boolean; data: Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }> }>(
      '/api/ugc/uploaded-audios'
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch uploaded audios');
    }
    
    return response.data || [];
  } catch (error: any) {
    console.error('Error fetching uploaded audios:', error);
    throw new Error(error.message || 'Failed to fetch uploaded audios');
  }
}

/**
 * Delete an uploaded audio file
 */
export async function deleteUploadedAudio(id: string): Promise<void> {
  try {
    const response = await apiRequest<{ success: boolean; message?: string; error?: string }>(
      `/api/ugc/uploaded-audio/${id}`,
      { method: 'DELETE' }
    );
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete audio');
    }
  } catch (error: any) {
    console.error('Error deleting uploaded audio:', error);
    throw new Error(error.message || 'Failed to delete audio');
  }
}

/**
 * Convert base64 data URL to Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'audio/mpeg'): Blob {
  const base64Data = base64.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

