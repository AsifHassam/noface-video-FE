import { config } from '@/lib/config';
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
    
    // Use cached token for better reliability
    if (useCache) {
      const cachedToken = await getCachedToken();
      if (cachedToken) {
        return cachedToken;
      }
    }
    
    // No fallback - if cache fails, return null (avoids hanging getSession calls)
    return null;
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
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;

  try {
    let response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 (Unauthorized) - token might have expired, try to refresh
    if (response.status === 401) {
      console.warn('⚠️ Got 401, attempting token refresh...');
      const refreshedToken = await refreshToken();
      if (refreshedToken) {
        headers['Authorization'] = `Bearer ${refreshedToken}`;
        console.log('🔄 Retrying request with refreshed token...');
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }));
      throw new Error(error.error || error.message || 'API request failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("❌ API Error:", error);
    throw error;
  }
}

export type SubscriptionInfo = {
  tier: 'free' | 'paid' | 'premium';
  canCreateVideo: boolean;
  credits: number; // Credits balance (new credits-based system)
  usage: {
    total: number;
    monthly: number;
  }; // Legacy field for display purposes
  limit: number | null; // No limit with credits system (null)
  lastResetAt: string | null;
};

/**
 * Subscription API methods
 */
export const subscriptionApi = {
  /**
   * Get user's subscription information
   */
  async getSubscriptionInfo(): Promise<{ success: boolean; subscription: SubscriptionInfo }> {
    // Use token cache instead of getSession() to avoid hanging
    try {
      // Get token from cache (avoids hanging getSession() calls)
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      let token = await getCachedToken();
      
      if (!token) {
        throw new Error('Not authenticated - no token available');
      }
      
      // Extract userId from token payload (avoids getSession() call)
      let userId: string;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub || payload.user_id;
        
        if (!userId) {
          throw new Error('No user ID in token');
        }
      } catch (parseError) {
        console.error('❌ [Subscription] Failed to parse token:', parseError);
        throw new Error('Invalid authentication token');
      }

      // Use Supabase REST API directly with fetch (bypasses client connection issues)
      const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      // Get user profile - gracefully handle missing columns (migration not run yet)
      let profile: any = null;
      let tier: 'free' | 'paid' | 'premium' = 'free';
      
      // Use REST API directly to avoid hanging Supabase client queries
      const profileUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=subscription_tier,subscription_started_at,last_video_reset_at,credits`;
      
      const fetchProfile = async (authToken: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        try {
          const response = await fetch(profileUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`,
              'apikey': supabaseAnonKey
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return response;
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };
      
      try {
        let profileResponse = await fetchProfile(token);
        
        // Handle 401 - refresh token and retry
        if (profileResponse.status === 401) {
          console.warn('[Subscription] Got 401, attempting token refresh...');
          const refreshedToken = await refreshToken();
          if (refreshedToken) {
            token = refreshedToken;
            profileResponse = await fetchProfile(refreshedToken);
          } else {
            throw new Error('Authentication failed. Please refresh the page and try again.');
          }
        }
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          profile = Array.isArray(profileData) && profileData.length > 0 ? profileData[0] : null;
          
          if (profile) {
            const subscriptionTier = profile?.subscription_tier;
            tier = (subscriptionTier === 'paid' || subscriptionTier === 'premium' || subscriptionTier === 'free') ? subscriptionTier : 'free';
          } else {
            console.warn('⚠️ Profile not found, defaulting to free tier');
            tier = 'free';
          }
        } else if (profileResponse.status === 404) {
          // Profile doesn't exist yet - use defaults
          console.warn('⚠️ Profile not found, defaulting to free tier');
          tier = 'free';
        } else {
          const errorText = await profileResponse.text();
          // Check if it's a column doesn't exist error (migration not run)
          if (errorText.includes('column') || profileResponse.status === 400) {
            console.warn('⚠️ Subscription columns not found. Please run the database migration.');
            tier = 'free';
          } else {
            console.warn('⚠️ Error fetching profile:', profileResponse.status, errorText);
            tier = 'free';
          }
        }
      } catch (err: any) {
        // Handle network errors, timeouts, etc.
        if (err.name === 'AbortError') {
          console.warn('⚠️ Profile fetch timeout, using defaults');
          tier = 'free';
        } else if (err?.message?.includes('column')) {
          console.warn('⚠️ Subscription columns not found. Please run the database migration.');
          tier = 'free';
        } else {
          console.warn('⚠️ Error fetching profile:', err);
          tier = 'free';
        }
      }

      // Calculate month start (1st of current month 00:00:00 UTC)
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

      // Check if we need to reset monthly count (only if columns exist)
      let lastResetAt: Date | null = null;
      if (profile?.last_video_reset_at) {
        lastResetAt = new Date(profile.last_video_reset_at);
        if (!lastResetAt || lastResetAt < monthStart) {
          lastResetAt = monthStart;
          // Try to update in database (may fail if migration not run)
          try {
            const updateUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            try {
              const updateResponse = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                  'apikey': supabaseAnonKey,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ last_video_reset_at: monthStart.toISOString() }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              
              if (!updateResponse.ok && updateResponse.status !== 404) {
                console.warn('⚠️ Could not update last_video_reset_at:', updateResponse.status);
              }
            } catch (updateErr: any) {
              clearTimeout(timeoutId);
              // Silently fail if column doesn't exist or network error
              if (updateErr.name !== 'AbortError') {
                console.warn('⚠️ Could not update last_video_reset_at:', updateErr);
              }
            }
          } catch (updateErr) {
            // Silently fail if column doesn't exist
            console.warn('⚠️ Could not update last_video_reset_at:', updateErr);
          }
        }
      } else {
        lastResetAt = monthStart;
      }

      // Count videos - handle errors gracefully
      let usage = { total: 0, monthly: 0 };

      // Count videos using REST API directly
      const countVideos = async (filters: string): Promise<number> => {
        const countUrl = `${supabaseUrl}/rest/v1/projects?${filters}&select=id`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
          const response = await fetch(countUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'apikey': supabaseAnonKey,
              'Prefer': 'count=exact'
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const countHeader = response.headers.get('content-range');
            if (countHeader) {
              // Parse "0-49/151" format
              const match = countHeader.match(/\/(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            }
            // Fallback: count array length
            const data = await response.json();
            return Array.isArray(data) ? data.length : 0;
          }
          return 0;
        } catch (err: any) {
          clearTimeout(timeoutId);
          if (err.name !== 'AbortError') {
            console.warn('⚠️ Error counting videos:', err);
          }
          return 0;
        }
      };
      
      try {
        if (tier === 'free') {
          // Count only videos with final render (must have final_url)
          const filters = `user_id=eq.${userId}&final_url=not.is.null&final_url=neq.`;
          usage.total = await countVideos(filters);
          usage.monthly = usage.total;
        } else {
          // Paid/Premium tier - count monthly (must have final_url)
          const monthlyFilters = `user_id=eq.${userId}&final_url=not.is.null&final_url=neq.&created_at=gte.${monthStart.toISOString()}`;
          usage.monthly = await countVideos(monthlyFilters);
          
          // Also get total for display
          const totalFilters = `user_id=eq.${userId}&final_url=not.is.null&final_url=neq.`;
          usage.total = await countVideos(totalFilters);
        }
      } catch (countErr) {
        console.warn('⚠️ Error in video counting:', countErr);
        // Use default values (0, 0) on error
      }

      // Get credits balance (new credits-based system)
      const credits = parseFloat(profile?.credits || 0);
      
      // With credits system, user can create videos if they have at least 0.2 credits
      // (minimum for 1 second of Flash speech)
      const canCreateVideo = credits >= 0.2;

      return {
        success: true,
        subscription: {
          tier,
          canCreateVideo,
          credits,
          usage, // Legacy field for display purposes
          limit: null, // No limit with credits system
          lastResetAt: lastResetAt ? lastResetAt.toISOString() : null
        }
      };

    } catch (error) {
      console.error('❌ Error getting subscription info:', error);
      throw error;
    }
  },

  /**
   * Update user's subscription tier
   */
  async updateSubscription(tier: 'free' | 'paid' | 'premium'): Promise<{ success: boolean }> {
    try {
      // Use token cache instead of getSession() to avoid hanging
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      let token = await getCachedToken();
      
      if (!token) {
        throw new Error('Not authenticated - no token available');
      }
      
      // Extract userId from token payload
      let userId: string;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userId = payload.sub || payload.user_id;
        
        if (!userId) {
          throw new Error('No user ID in token');
        }
      } catch (parseError) {
        console.error('❌ [Subscription] Failed to parse token:', parseError);
        throw new Error('Invalid authentication token');
      }

      // Use Supabase REST API directly with fetch (bypasses client connection issues)
      const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      // Calculate month start (1st of current month 00:00:00 UTC) to reset monthly video count when upgrading
      let lastVideoResetAt: string | null = null;
      if (tier === 'paid' || tier === 'premium') {
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        lastVideoResetAt = monthStart.toISOString();
      }

      const updateUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      try {
        let updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': supabaseAnonKey,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            subscription_tier: tier,
            subscription_started_at: (tier === 'paid' || tier === 'premium') ? new Date().toISOString() : null,
            last_video_reset_at: lastVideoResetAt, // Reset monthly count to 0 when upgrading
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        // Handle 401 - refresh token and retry
        if (updateResponse.status === 401) {
          console.warn('[Subscription] Got 401, attempting token refresh...');
          const refreshedToken = await refreshToken();
          if (refreshedToken) {
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), 10000);
            try {
              updateResponse = await fetch(updateUrl, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${refreshedToken}`,
                  'apikey': supabaseAnonKey,
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  subscription_tier: tier,
                  subscription_started_at: (tier === 'paid' || tier === 'premium') ? new Date().toISOString() : null,
                  last_video_reset_at: lastVideoResetAt,
                }),
                signal: retryController.signal
              });
              clearTimeout(retryTimeoutId);
            } catch (retryErr) {
              clearTimeout(retryTimeoutId);
              throw retryErr;
            }
          } else {
            throw new Error('Authentication failed. Please refresh the page and try again.');
          }
        }
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Failed to update subscription: ${updateResponse.status} ${errorText}`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Request timeout - please try again');
        }
        throw err;
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
  },
};

