import { config } from '@/lib/config';
import { getAuthToken } from './projects';

const API_BASE_URL = config.remotionServerUrl;

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignIn: string | null;
  videoCount: number;
  completedVideoCount: number;
  draftCount: number;
  videos: Array<{
    id: string;
    title: string;
    status: string;
    final_url: string | null;
    preview_url: string | null;
    created_at: string;
    updated_at: string;
    metadata: any;
    srt_text?: string | null;
    script_segments?: Array<{
      id: string;
      content: string;
      position: number;
      speaker?: string;
    }>;
  }>;
};

export type AdminStats = {
  totalUsers: number;
  usersToday: number;
  totalProjects: number;
  completedProjects: number;
  draftProjects: number;
  projectsToday: number;
};

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const adminApi = {
  /**
   * Get all users with their video counts
   */
  async getUsers(limit = 50, offset = 0): Promise<{ success: boolean; users: AdminUser[]; total: number }> {
    return apiRequest(`/api/admin/users?limit=${limit}&offset=${offset}`);
  },

  /**
   * Get admin statistics
   */
  async getStats(): Promise<{ success: boolean; stats: AdminStats }> {
    return apiRequest('/api/admin/stats');
  },
};

