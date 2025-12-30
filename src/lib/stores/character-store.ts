"use client";

import { create } from "zustand";
import { CHARACTERS } from "@/lib/data/characters";
import { getCustomCharacters, deleteCustomCharacter, type CustomCharacter as ApiCustomCharacter } from "@/lib/api/custom-characters";
import type { Character } from "@/types";

type CharacterState = {
  characters: Character[];
  customCharacters: Character[];
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

export const useCharacterStore = create<CharacterState>()((set, get) => ({
      characters: CHARACTERS,
  customCharacters: [],
  isLoading: false,

  loadCustomCharacters: async () => {
    set({ isLoading: true });
    try {
      const apiChars = await getCustomCharacters();
      const customChars = apiChars.map(convertCustomCharacter);
      set({ customCharacters: customChars });
    } catch (error) {
      console.error("Error loading custom characters:", error);
      // Don't throw - just log and continue with default characters
    } finally {
      set({ isLoading: false });
    }
  },

  refreshCharacters: async () => {
    await get().loadCustomCharacters();
  },

  deleteCharacter: async (characterId: string) => {
    try {
      await deleteCustomCharacter(characterId);
      // Remove from local state and reload
      set((state) => ({
        customCharacters: state.customCharacters.filter((char) => char.id !== characterId),
      }));
      // Reload to ensure consistency
      await get().loadCustomCharacters();
    } catch (error) {
      console.error("Error deleting character:", error);
      throw error;
    }
  },
}));

/**
 * Hook to get all characters (default + custom) combined
 * This is a computed getter that should be used in components
 */
export function useAllCharacters(): Character[] {
  const characters = useCharacterStore((state) => state.characters);
  const customCharacters = useCharacterStore((state) => state.customCharacters);
  return [...customCharacters, ...characters];
}
