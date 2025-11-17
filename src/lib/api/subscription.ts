import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

const API_BASE_URL = config.remotionServerUrl;

/**
 * Get authentication token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
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
    const response = await fetch(url, {
      ...options,
      headers,
    });

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
  tier: 'free' | 'paid';
  canCreateVideo: boolean;
  usage: {
    total: number;
    weekly: number;
  };
  limit: number;
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
    // For now, we'll fetch from the user's profile and calculate usage
    // In a real app, you'd have a dedicated endpoint for this
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      // Get user profile - gracefully handle missing columns (migration not run yet)
      let profile: any = null;
      let tier = 'free';
      
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, subscription_started_at, last_video_reset_at')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          // Check if it's a column doesn't exist error (migration not run)
          if (profileError.message?.includes('column') || profileError.code === 'PGRST116') {
            console.warn('⚠️ Subscription columns not found. Please run the database migration.');
            // Return default values - migration hasn't been run yet
            tier = 'free';
          } else {
            console.warn('⚠️ Profile not found, defaulting to free tier');
            tier = 'free';
          }
        } else {
          profile = data;
          tier = profile?.subscription_tier || 'free';
        }
      } catch (err: any) {
        // Handle column not found errors gracefully
        if (err?.message?.includes('column') || err?.code === 'PGRST116') {
          console.warn('⚠️ Subscription columns not found. Please run the database migration.');
          tier = 'free';
        } else {
          throw err;
        }
      }

      // Calculate week start (Monday 00:00:00 UTC)
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay() + 1); // Monday
      weekStart.setUTCHours(0, 0, 0, 0);

      // Check if we need to reset weekly count (only if columns exist)
      let lastResetAt: Date | null = null;
      if (profile?.last_video_reset_at) {
        lastResetAt = new Date(profile.last_video_reset_at);
        if (!lastResetAt || lastResetAt < weekStart) {
          lastResetAt = weekStart;
          // Try to update in database (may fail if migration not run)
          try {
            await supabase
              .from('profiles')
              .update({ last_video_reset_at: weekStart.toISOString() })
              .eq('id', session.user.id);
          } catch (updateErr) {
            // Silently fail if column doesn't exist
            console.warn('⚠️ Could not update last_video_reset_at:', updateErr);
          }
        }
      } else {
        lastResetAt = weekStart;
      }

      // Count videos - handle errors gracefully
      let usage = { total: 0, weekly: 0 };

      try {
        if (tier === 'free') {
          // Count all videos including drafts for free tier
          const { count, error: countError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id);

          if (countError) {
            console.warn('⚠️ Error counting videos:', countError);
            usage.total = 0;
          } else {
            usage.total = count || 0;
          }
          usage.weekly = usage.total;
        } else {
          // Paid tier - count weekly (completed videos only)
          const { count: weeklyCount, error: weeklyError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .eq('status', 'READY')
            .gte('created_at', weekStart.toISOString());

          if (weeklyError) {
            console.warn('⚠️ Error counting weekly videos:', weeklyError);
            usage.weekly = 0;
          } else {
            usage.weekly = weeklyCount || 0;
          }

          // Also get total for display
          const { count: totalCount, error: totalError } = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .eq('status', 'READY');

          if (totalError) {
            console.warn('⚠️ Error counting total videos:', totalError);
            usage.total = 0;
          } else {
            usage.total = totalCount || 0;
          }
        }
      } catch (countErr) {
        console.warn('⚠️ Error in video counting:', countErr);
        // Use default values (0, 0) on error
      }

      const limits = {
        free: { total: 5 },
        paid: { weekly: 3 }
      };

      let canCreateVideo = false;
      let limit = 0;

      if (tier === 'free') {
        limit = limits.free.total;
        canCreateVideo = usage.total < limit;
      } else {
        limit = limits.paid.weekly;
        canCreateVideo = usage.weekly < limit;
      }

      return {
        success: true,
        subscription: {
          tier,
          canCreateVideo,
          usage,
          limit,
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
  async updateSubscription(tier: 'free' | 'paid'): Promise<{ success: boolean }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      // Calculate week start (Monday 00:00:00 UTC) to reset weekly video count when upgrading
      let lastVideoResetAt: string | null = null;
      if (tier === 'paid') {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay() + 1); // Monday
        weekStart.setUTCHours(0, 0, 0, 0);
        lastVideoResetAt = weekStart.toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: tier,
          subscription_started_at: tier === 'paid' ? new Date().toISOString() : null,
          last_video_reset_at: lastVideoResetAt, // Reset weekly count to 0 when upgrading to paid
        })
        .eq('id', session.user.id);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating subscription:', error);
      throw error;
    }
  },
};

