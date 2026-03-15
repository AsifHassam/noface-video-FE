import { config } from '@/lib/config';

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

/**
 * Fetch global characters (admin-created, available to all users in 2-char flow).
 * No auth required.
 */
export async function getGlobalCharacters(): Promise<GlobalCharacter[]> {
  const res = await fetch(`${API_BASE_URL}/api/global-characters`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Failed to load characters: ${res.status}`);
  }
  return data.characters ?? [];
}
