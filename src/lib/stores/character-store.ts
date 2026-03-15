"use client";

import { create } from "zustand";
import { CHARACTERS } from "@/lib/data/characters";
import { getCustomCharacters, deleteCustomCharacter, type CustomCharacter as ApiCustomCharacter } from "@/lib/api/custom-characters";
import { getGlobalCharacters, type GlobalCharacter } from "@/lib/api/global-characters";
import type { Character } from "@/types";

type CharacterState = {
  characters: Character[];
  customCharacters: Character[];
  globalCharacters: Character[];
  isLoading: boolean;
  loadCustomCharacters: () => Promise<void>;
  refreshCharacters: () => Promise<void>;
  deleteCharacter: (characterId: string) => Promise<void>;
};

/**
 * Convert API custom character to app Character type
 */
function convertCustomCharacter(apiChar: ApiCustomCharacter): Character {
  return {
    id: apiChar.id,
    slug: `custom-${apiChar.id}`,
    name: apiChar.name,
    avatarUrl: apiChar.avatar_url,
    enabled: true,
    isPlaceholder: false,
    voiceId: apiChar.voice_id,
  };
}

/**
 * Convert global character (admin-created) to app Character type
 */
function convertGlobalCharacter(apiChar: GlobalCharacter): Character {
  return {
    id: apiChar.id,
    slug: `global-${apiChar.id}`,
    name: apiChar.name,
    avatarUrl: apiChar.avatar_url,
    enabled: true,
    isPlaceholder: !!apiChar.is_placeholder_voice,
    voiceId: apiChar.voice_id,
    voiceSampleUrl: apiChar.voice_sample_url ?? undefined,
  };
}

export const useCharacterStore = create<CharacterState>()((set, get) => ({
  characters: CHARACTERS,
  customCharacters: [],
  globalCharacters: [],
  isLoading: false,

  loadCustomCharacters: async () => {
    set({ isLoading: true });
    try {
      const [apiChars, globalApiChars] = await Promise.all([
        getCustomCharacters(),
        getGlobalCharacters().catch((err) => {
          console.error("Error loading global characters:", err);
          return [];
        }),
      ]);
      const customChars = apiChars.map(convertCustomCharacter);
      const globalChars = globalApiChars.map(convertGlobalCharacter);
      set({ customCharacters: customChars, globalCharacters: globalChars });
    } catch (error) {
      console.error("Error loading custom characters:", error);
      try {
        const globalApiChars = await getGlobalCharacters();
        set((s) => ({ ...s, globalCharacters: globalApiChars.map(convertGlobalCharacter) }));
      } catch (_) {
        // ignore
      }
    } finally {
      set({ isLoading: false });
    }
  },

  refreshCharacters: async () => {
    await get().loadCustomCharacters();
  },

  deleteCharacter: async (characterId: string) => {
    const state = get();
    if (state.globalCharacters.some((c) => c.id === characterId)) {
      throw new Error("Global characters cannot be deleted here.");
    }
    try {
      await deleteCustomCharacter(characterId);
      set((s) => ({
        customCharacters: s.customCharacters.filter((char) => char.id !== characterId),
      }));
      await get().loadCustomCharacters();
    } catch (error) {
      console.error("Error deleting character:", error);
      throw error;
    }
  },
}));

/**
 * Hook to get all characters (global + custom + default) combined
 * This is a computed getter that should be used in components
 */
export function useAllCharacters(): Character[] {
  const characters = useCharacterStore((state) => state.characters);
  const customCharacters = useCharacterStore((state) => state.customCharacters);
  const globalCharacters = useCharacterStore((state) => state.globalCharacters);
  return [...globalCharacters, ...customCharacters, ...characters];
}
