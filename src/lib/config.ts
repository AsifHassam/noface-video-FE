/**
 * Application configuration
 * 
 * For environment-specific values, you can create a .env.local file with:
 * NEXT_PUBLIC_REMOTION_SERVER_URL=http://localhost:3001
 * NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 */

export const config = {
  /**
   * Remotion video server URL
   * Used for video generation with free TTS
   */
  remotionServerUrl: 
    process.env.NEXT_PUBLIC_REMOTION_SERVER_URL || 
    'http://localhost:3001',
  
  /**
   * Supabase URL
   * Used for authentication token retrieval
   */
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL || 
    'https://khjcirljcxmrzrrosssx.supabase.co',
} as const;

