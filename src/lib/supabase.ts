import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('🔧 Initializing Supabase client:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
});

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'x-client-info': 'faceless-video-app',
    },
  },
});

console.log('✅ Supabase client initialized');

// Types for our database schema
export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  subscription_tier: 'free' | 'paid';
  subscription_started_at: string | null;
  last_video_reset_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  background_id: string;
  status: 'DRAFT' | 'PROCESSING' | 'READY' | 'ERROR';
  preview_url: string | null;
  final_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  subtitle_style: string;
  subtitle_position: string;
  subtitle_font_size: number;
  srt_text: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type Character = {
  id: string;
  project_id: string;
  name: string;
  voice_id: string | null;
  voice_provider: string;
  avatar_url: string | null;
  position: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type ScriptSegment = {
  id: string;
  project_id: string;
  character_id: string | null;
  content: string;
  position: number;
  duration_ms: number | null;
  start_time_ms: number | null;
  audio_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type TextOverlay = {
  id: string;
  project_id: string;
  text: string;
  start_time_ms: number;
  duration_ms: number;
  position: string;
  style: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type ImageOverlay = {
  id: string;
  project_id: string;
  image_url: string;
  start_time_ms: number;
  duration_ms: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  crop_data: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type RenderJob = {
  id: string;
  project_id: string;
  type: 'preview' | 'final';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result_url: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

