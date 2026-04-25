import { config } from '@/lib/config';
import { getAuthToken } from './projects';

const API_BASE_URL = config.remotionServerUrl;

export type GlobalCharacter = {
  id: string;
  name: string;
  avatar_url: string;
  voice_id: string;
  is_placeholder_voice?: boolean;
  voice_sample_url?: string | null;
  created_at: string;
};

export type AdminUserTransaction = {
  id: string;
  reference: string;
  planCode: string | null;
  email: string;
  amountCents: number;
  currency: string;
  status: string;
  eventType: string;
  isInitialPayment: boolean;
  paymentLink?: string;
  paidAt?: string;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignIn: string | null;
  videoCount: number;
  completedVideoCount: number;
  draftCount: number;
  videosCreatedThisMonth?: number;
  subscription_tier?: string;
  credits?: number;
  amountPaying?: number;
  is_test_user?: boolean;
  payment_blocked?: boolean;
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
  activeUsersLast7Days?: number;
  payingUsers?: number;
  /** Users with failed/bounced payment (payment_blocked), excluding test accounts */
  churnUsers?: number;
  ugcProjectsTotal?: number;
  ugcProjectsToday?: number;
  ugcCompletedTotal?: number;
  renderJobsTotal?: number;
  renderJobsCompleted?: number;
  renderJobsFailed?: number;
  renderJobsPending?: number;
  userUploadsTotal?: number;
};

export type AdminActivity = {
  recentProjects: Array<{
    id: string;
    title: string;
    user_id: string | null;
    status: string;
    final_url: string | null;
    created_at: string;
    updated_at: string;
  }>;
  recentRenderJobs: Array<{
    id: string;
    project_id: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
};

export type UgcVoice = {
  id: string;
  voice_id: string;
  name: string;
  category: string;
  created_at: string;
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
   * Get all users with their video counts.
   * paidOnly=true: only paid/premium. excludeTestUsers=false: include test users (default true = exclude).
   * testUsersOnly=true: only test users.
   */
  async getUsers(
    limit = 50,
    offset = 0,
    options?: { paidOnly?: boolean; excludeTestUsers?: boolean; testUsersOnly?: boolean }
  ): Promise<{ success: boolean; users: AdminUser[]; total: number }> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (options?.paidOnly) params.set('paidOnly', 'true');
    if (options?.excludeTestUsers === false) params.set('excludeTestUsers', 'false');
    if (options?.testUsersOnly) params.set('testUsersOnly', 'true');
    return apiRequest(`/api/admin/users?${params.toString()}`);
  },

  /**
   * Get payment transactions (billing history) for a user. Admin only.
   */
  async getUserTransactions(userId: string): Promise<{ success: boolean; transactions: AdminUserTransaction[] }> {
    return apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/transactions`);
  },

  /**
   * Mark or unmark a user as test user.
   */
  async setTestUser(userId: string, isTestUser: boolean): Promise<{ success: boolean; is_test_user: boolean }> {
    return apiRequest(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_test_user: isTestUser }),
    });
  },

  /**
   * Get admin statistics
   */
  async getStats(): Promise<{ success: boolean; stats: AdminStats }> {
    return apiRequest('/api/admin/stats');
  },

  /**
   * Get recent activity (projects + render jobs)
   */
  async getActivity(limit?: number): Promise<{ success: boolean; activity: AdminActivity }> {
    const q = limit != null ? `?limit=${limit}` : '';
    return apiRequest(`/api/admin/activity${q}`);
  },

  /**
   * Fetch Paystack transactions for billing backfill.
   */
  async getPaystackTransactions(page = 1, perPage = 50): Promise<{
    success: boolean;
    transactions: Array<{
      id: number;
      reference: string;
      amount: number;
      currency: string;
      status: string;
      customer_email: string;
      created_at: string;
      paid_at: string | null;
    }>;
    meta: { total: number; page: number; perPage: number; pageCount: number };
  }> {
    return apiRequest(`/api/admin/paystack-transactions?page=${page}&perPage=${perPage}`);
  },

  /**
   * Get a one-time login link to sign in as another user (admin impersonation).
   * Uses secret password (no auth token required). Body: { email, password }.
   */
  async getImpersonateLink(email: string, password: string): Promise<{ success: boolean; loginLink?: string; error?: string }> {
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const res = await fetch(`${API_BASE_URL}/api/admin/impersonate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, redirectTo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || `Request failed: ${res.status}` };
    }
    return { success: !!data.success, loginLink: data.loginLink, error: data.error };
  },

  /**
   * Get a one-time login link to sign in as another user.
   * Requires the special admin impersonate password (e.g. noface2026!).
   * No auth token required – protected by password only.
   *
   * We forward `${origin}/auth/callback` as `redirectTo` because:
   *   1. Supabase needs an http(s):// URL to produce a working action_link
   *      (a scheme-less Site URL causes "Failed to launch ... because the
   *      scheme does not have a registered handler").
   *   2. `/auth/callback` is the existing page that consumes the
   *      `#access_token=...` fragment, swaps the admin's session for the
   *      impersonated user's session, and routes on to /app/dashboard.
   */
  async impersonate(email: string, password: string): Promise<{ success: boolean; loginLink?: string; error?: string }> {
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const res = await fetch(`${API_BASE_URL}/api/admin/impersonate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, redirectTo }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || `Request failed: ${res.status}` };
    }
    return { success: !!data.loginLink, loginLink: data.loginLink, error: data.error };
  },

  /**
   * Backfill selected Paystack transaction references into payment_transactions (user billing tab).
   */
  async backfillTransactions(references: string[]): Promise<{
    success: boolean;
    message: string;
    added: number;
    skipped: number;
    errors: Array<{ reference: string; error: string }>;
  }> {
    return apiRequest('/api/admin/backfill-transactions', {
      method: 'POST',
      body: JSON.stringify({ references }),
    });
  },

  /** Global characters (2-char flow). List for admin. */
  async getGlobalCharacters(): Promise<{ success: boolean; characters: GlobalCharacter[] }> {
    return apiRequest('/api/admin/global-characters');
  },

  /** Create global character (multipart: name, voiceId, image, isPlaceholderVoice, optional voiceSample). */
  async createGlobalCharacter(form: {
    name: string;
    voiceId: string;
    image: File;
    isPlaceholderVoice?: boolean;
    voiceSample?: File | null;
  }): Promise<{ success: boolean; character?: GlobalCharacter; error?: string }> {
    const token = await getAuthToken();
    const body = new FormData();
    body.append('name', form.name.trim());
    body.append('voiceId', form.voiceId.trim());
    body.append('image', form.image);
    body.append('isPlaceholderVoice', form.isPlaceholderVoice ? 'true' : 'false');
    if (form.voiceSample) body.append('voiceSample', form.voiceSample);
    const res = await fetch(`${API_BASE_URL}/api/admin/global-characters`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || `Request failed: ${res.status}` };
    return { success: !!data.success, character: data.character, error: data.error };
  },

  /** Update global character voice (placeholder flag and/or voice sample file). */
  async updateGlobalCharacter(
    id: string,
    updates: { isPlaceholderVoice?: boolean; voiceSample?: File }
  ): Promise<{ success: boolean; character?: GlobalCharacter; error?: string }> {
    const hasUpdates = typeof updates.isPlaceholderVoice === 'boolean' || !!updates.voiceSample;
    if (!hasUpdates) return { success: false, error: 'No updates provided' };
    const token = await getAuthToken();
    const body = new FormData();
    if (typeof updates.isPlaceholderVoice === 'boolean') {
      body.append('isPlaceholderVoice', updates.isPlaceholderVoice ? 'true' : 'false');
    }
    if (updates.voiceSample) body.append('voiceSample', updates.voiceSample);
    const res = await fetch(`${API_BASE_URL}/api/admin/global-characters/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: data.error || `Request failed: ${res.status}` };
    return { success: !!data.success, character: data.character, error: data.error };
  },

  /** Delete global character. */
  async deleteGlobalCharacter(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiRequest(`/api/admin/global-characters/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Delete failed' };
    }
  },

  /** Global UGC voices (Generate Speech dropdown). */
  async getUgcVoices(): Promise<{ success: boolean; voices: UgcVoice[] }> {
    return apiRequest('/api/admin/ugc-voices');
  },

  /** Add voice by Eleven Labs voice_id; fetches details and adds to global list. */
  async addUgcVoice(voiceId: string): Promise<{ success: boolean; voice?: UgcVoice; error?: string }> {
    const data = await apiRequest<{ success: boolean; voice?: UgcVoice; error?: string }>(
      '/api/admin/ugc-voices',
      { method: 'POST', body: JSON.stringify({ voice_id: voiceId.trim() }) }
    );
    return data;
  },

  /** Remove voice from global UGC list. */
  async deleteUgcVoice(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await apiRequest(`/api/admin/ugc-voices/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Delete failed' };
    }
  },
};

