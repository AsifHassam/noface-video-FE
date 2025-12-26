/**
 * Token Cache Utility
 * 
 * Caches authentication tokens to prevent expiration issues during long-running operations.
 * Automatically refreshes tokens when they expire.
 * 
 * IMPORTANT: For long-running operations (background removal, video rendering, etc.),
 * use getCachedToken() at the start and reuse the same token throughout the operation.
 * This prevents token expiration errors during processing.
 */

import { supabase } from '@/lib/supabase';
import { config } from '@/lib/config';

type CachedToken = {
  token: string;
  expiresAt: number; // Timestamp when token expires
  userId: string;
};

// In-memory cache for tokens (per user)
const tokenCache = new Map<string, CachedToken>();

// Token refresh buffer (refresh 5 minutes before expiration)
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached token or fetch a new one
 * For long-running operations, call this once at the start and reuse the token
 */
export async function getCachedToken(userId?: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const now = Date.now();

    // FIRST: Try to get token directly from localStorage (NO Supabase calls)
    // This avoids hanging on getSession() or refreshSession() after long periods
    try {
      const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
      if (supabaseProjectRef) {
        const storageKey = `sb-${supabaseProjectRef}-auth-token`;
        const data = localStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          const token = parsed?.access_token;
          
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const expiresAt = (payload.exp || 0) * 1000;
              
              // Extract userId from token payload (avoid getSession call)
              const tokenUserId = payload.sub || payload.user_id;
              
              // Use provided userId or token userId
              const effectiveUserId = userId || tokenUserId;
              
              if (effectiveUserId) {
                // Check in-memory cache first
                const cached = tokenCache.get(effectiveUserId);
                if (cached && cached.expiresAt > now + REFRESH_BUFFER_MS) {
                  console.log('✅ [Token Cache] Using cached token (expires in', Math.round((cached.expiresAt - now) / 1000 / 60), 'minutes)');
                  return cached.token;
                }
                
                // If token is still valid (even if close to expiration), use it
                // Don't pre-emptively refresh - let API handle 401 if needed
                if (expiresAt > now) {
                  // Token is valid, cache and return it
                  tokenCache.set(effectiveUserId, {
                    token,
                    expiresAt,
                    userId: effectiveUserId
                  });
                  console.log('✅ [Token Cache] Using token from localStorage (expires in', Math.round((expiresAt - now) / 1000 / 60), 'minutes)');
                  return token;
                } else {
                  // Token is expired, but return it anyway
                  // The API will return 401, then we'll refresh in the apiRequest handler
                  console.log('⚠️ [Token Cache] Token expired, but using it - will refresh on 401');
                  if (effectiveUserId) {
                    tokenCache.set(effectiveUserId, {
                      token,
                      expiresAt,
                      userId: effectiveUserId
                    });
                  }
                  return token;
                }
              }
            } catch (e) {
              console.warn('⚠️ [Token Cache] Failed to parse token:', e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ [Token Cache] Failed to read from localStorage:', e);
    }

    // ONLY if localStorage doesn't have a token, try Supabase
    // But try to get userId from localStorage token first to avoid getSession call
    let parsedUserId: string | undefined;
    try {
      const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
      if (supabaseProjectRef) {
        const storageKey = `sb-${supabaseProjectRef}-auth-token`;
        const data = localStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          const token = parsed?.access_token;
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              parsedUserId = payload.sub || payload.user_id;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (e) {
      // Ignore
    }

    // Only call getSession if we absolutely need to (no userId from token)
    const effectiveUserId = userId || parsedUserId;
    
    if (!effectiveUserId) {
      // Last resort: call getSession (this might hang, but we have no choice)
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
      if (!userId) {
        return null;
      }
    } else {
      userId = effectiveUserId;
    }

    // Check cache again with the userId we found
    const cached = tokenCache.get(userId);
    if (cached && cached.expiresAt > now + REFRESH_BUFFER_MS) {
      return cached.token;
    }

    // Try localStorage one more time with the userId
    try {
      const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
      if (supabaseProjectRef) {
        const storageKey = `sb-${supabaseProjectRef}-auth-token`;
        const data = localStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          const token = parsed?.access_token;
          if (token) {
            // Return token even if expired - let API handle refresh
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const expiresAt = (payload.exp || 0) * 1000;
              
              tokenCache.set(userId, {
                token,
                expiresAt,
                userId
              });
              console.log('✅ [Token Cache] Using token from localStorage');
              return token;
            } catch (e) {
              // Return token even if we can't parse expiration
              tokenCache.set(userId, {
                token,
                expiresAt: now + (60 * 60 * 1000), // Default 1 hour
                userId
              });
              return token;
            }
          }
        }
      }
    } catch (e) {
      // Ignore
    }

    // Last resort: get from Supabase session (this might hang)
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
      console.error('❌ [Token Cache] Failed to get session:', error);
      return null;
    }

    const token = session.access_token;
    
    // Cache the token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = (payload.exp || 0) * 1000;
      
      tokenCache.set(userId, {
        token,
        expiresAt,
        userId
      });
      console.log('✅ [Token Cache] Token cached from session (expires in', Math.round((expiresAt - now) / 1000 / 60), 'minutes)');
    } catch (e) {
      console.warn('⚠️ [Token Cache] Failed to parse token expiration, caching without expiration:', e);
      tokenCache.set(userId, {
        token,
        expiresAt: now + (60 * 60 * 1000), // Default 1 hour
        userId
      });
    }

    return token;
  } catch (error) {
    console.error('❌ [Token Cache] getCachedToken failed:', error);
    return null;
  }
}

/**
 * Clear cached token for a user (useful on logout)
 */
export function clearCachedToken(userId?: string): void {
  if (userId) {
    tokenCache.delete(userId);
  } else {
    tokenCache.clear();
  }
  console.log('🗑️ [Token Cache] Cleared cached tokens');
}

/**
 * Refresh token for a user (useful before long operations)
 */
export async function refreshToken(userId?: string): Promise<string | null> {
  try {
    // Try to get userId from localStorage token first (avoid getSession call)
    if (!userId) {
      try {
        const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
        if (supabaseProjectRef) {
          const storageKey = `sb-${supabaseProjectRef}-auth-token`;
          const data = localStorage.getItem(storageKey);
          if (data) {
            const parsed = JSON.parse(data);
            const token = parsed?.access_token;
            if (token) {
              try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                userId = payload.sub || payload.user_id;
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (e) {
        // Ignore
      }
    }

    // Only call getSession if we still don't have userId
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
      if (!userId) {
        return null;
      }
    }

    // Clear cached token to force refresh
    tokenCache.delete(userId);
    
    // Try to refresh via Supabase refreshSession
    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('❌ [Token Cache] refreshSession error:', refreshError);
        // Fall through to getCachedToken which will try localStorage
      } else if (refreshedSession?.access_token) {
        const token = refreshedSession.access_token;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = (payload.exp || 0) * 1000;
          
          tokenCache.set(userId, {
            token,
            expiresAt,
            userId
          });
          console.log('✅ [Token Cache] Token refreshed via refreshSession');
          return token;
        } catch (e) {
          // Return token even if we can't parse expiration
          tokenCache.set(userId, {
            token,
            expiresAt: Date.now() + (60 * 60 * 1000),
            userId
          });
          return token;
        }
      }
    } catch (refreshError) {
      console.warn('⚠️ [Token Cache] refreshSession failed, trying getCachedToken:', refreshError);
    }
    
    // Fallback to getCachedToken (which will try localStorage first)
    return await getCachedToken(userId);
  } catch (error) {
    console.error('❌ [Token Cache] refreshToken failed:', error);
    return null;
  }
}

/**
 * Get cached user info (from auth store)
 * This is safe to use even if token expires during long operations
 */
export function getCachedUserInfo(): { id: string; email: string } | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    // Try to get from auth store
    const authStore = require('@/lib/stores/auth-store').useAuthStore;
    const state = authStore.getState();
    
    if (state.user) {
      return {
        id: state.user.id,
        email: state.user.email || ''
      };
    }

    return null;
  } catch (error) {
    console.warn('⚠️ [Token Cache] Failed to get cached user info:', error);
    return null;
  }
}

