"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { CHARACTERS } from "@/lib/data/characters";
import type { Character } from "@/types";

type CharacterState = {
  characters: Character[];
};

export const useCharacterStore = create<CharacterState>()(
  persist(
    () => ({
      characters: CHARACTERS,
    }),
    {
      name: "facelessforge-characters",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
