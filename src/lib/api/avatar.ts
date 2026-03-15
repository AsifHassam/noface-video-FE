import { config } from '@/lib/config';
import { getCachedToken, refreshToken } from '@/lib/utils/token-cache';

const API_BASE = `${config.remotionServerUrl}/api/avatar`;

async function authHeaders(): Promise<HeadersInit> {
  let token = await getCachedToken();
  if (!token) token = await refreshToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });
  if (res.status === 401) {
    const newToken = await refreshToken();
    if (newToken) {
      const retry = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: { ...(await authHeaders()), ...(options.headers as Record<string, string>) },
      });
      if (!retry.ok) {
        const err = await retry.json().catch(() => ({ error: retry.statusText }));
        throw new Error(err.error || 'Request failed');
      }
      return retry.json();
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export interface GenerateAvatarBody {
  mode: 'selfie' | 'studio';
  sourceType: 'upload' | 'random';
  uploadedImageUrl?: string;
  gender?: string;
  vibe?: string;
}

export async function generateAvatar(body: GenerateAvatarBody): Promise<{ urls: string[]; prompt?: string }> {
  const data = await request<{ success?: boolean; urls?: string[]; prompt?: string }>('/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const urls = Array.isArray(data.urls) ? data.urls : [];
  return { urls, prompt: data.prompt };
}

export async function animateAvatar(imageUrl: string, motionStyle: 'calm' | 'expressive' = 'calm'): Promise<{ videoUrl: string }> {
  const data = await request<{ success: boolean; videoUrl: string }>('/animate', {
    method: 'POST',
    body: JSON.stringify({ imageUrl, motionStyle }),
  });
  return { videoUrl: data.videoUrl };
}

/**
 * Crop the end of an avatar video (e.g. remove last N seconds). Returns new video URL.
 */
export async function cropAvatarVideo(
  videoUrl: string,
  trimEndSeconds: number = 1
): Promise<{ videoUrl: string }> {
  const data = await request<{ success: boolean; videoUrl: string }>('/crop-video', {
    method: 'POST',
    body: JSON.stringify({ videoUrl, trimEndSeconds }),
  });
  return { videoUrl: data.videoUrl };
}

export interface SaveCharacterBody {
  mode: string;
  sourceType: string;
  uploadedImageUrl?: string | null;
  generatedAvatarUrl?: string | null;
  selectedAvatarUrl: string;
  animationVideoUrl?: string | null;
  motionStyle: string;
  voiceType: string;
  voiceReferenceUrl?: string | null;
  presetVoiceName?: string | null;
  characterName?: string | null;
}

export async function saveCharacter(body: SaveCharacterBody): Promise<{ character: Record<string, unknown> }> {
  const data = await request<{ success: boolean; character: Record<string, unknown> }>('/save', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { character: data.character };
}

export async function listCharacters(): Promise<{ characters: Record<string, unknown>[] }> {
  const data = await request<{ success: boolean; characters: Record<string, unknown>[] }>('/list');
  return { characters: data.characters };
}

export async function getCharacter(id: string): Promise<{ character: Record<string, unknown> }> {
  const data = await request<{ success: boolean; character: Record<string, unknown> }>(`/characters/${id}`);
  return { character: data.character };
}

export async function updateCharacter(
  id: string,
  updates: { animationVideoUrl?: string; characterName?: string; [key: string]: unknown }
): Promise<{ character: Record<string, unknown> }> {
  const data = await request<{ success: boolean; character: Record<string, unknown> }>(`/characters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return { character: data.character };
}

/** URL for the selfie reference image shown in the wizard (kind of avatar you'll get). */
export function selfieReferenceImageUrl(): string {
  return `${config.remotionServerUrl}/avatar-ref/selfie_reference.png`;
}
