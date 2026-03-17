"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useNavigateWithLoading } from "@/lib/hooks/use-navigate-with-loading";
import { Stepper } from "@/components/create/stepper";
import { CharacterCard } from "@/components/create/character-card";
import { CreateCharacterCard } from "@/components/create/create-character-card";
import { CreateCharacterDialog } from "@/components/create/create-character-dialog";
import { Button } from "@/components/ui/button";
import { useCharacterStore, useAllCharacters } from "@/lib/stores/character-store";
import { useProjectStore } from "@/lib/stores/project-store";
import type { Character } from "@/types";
import { toast } from "sonner";

const steps = [
  { label: "Step 1", description: "Pick two characters" },
  { label: "Step 2", description: "Write the script" },
  { label: "Step 3", description: "Choose gameplay background" },
  { label: "Step 4", description: "Preview & edit" },
];

export default function CharacterSelectionPage() {
  const router = useRouter();
  const navigate = useNavigateWithLoading();
  const searchParams = useSearchParams();
  const { loadCustomCharacters, refreshCharacters } = useCharacterStore();
  const allCharacters = useAllCharacters();
  const { draft, setDraftCharacters, startDraft } = useProjectStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Load custom characters on mount
  useEffect(() => {
    loadCustomCharacters();
  }, [loadCustomCharacters]);
  
  // Clear all draft data when starting a new video (not editing)
  useEffect(() => {
    const isEditing = searchParams.get("editing") === "true";
    if (!isEditing && draft && !draft.previewUrl) {
      // If we're starting a new video (not editing and no preview URL), 
      // clear all draft data to ensure a fresh start with no leftover data
      // This includes: script, overlays, subtitles, text overlays, etc.
      console.log("🔄 Starting new video - clearing all draft data");
      startDraft();
    }
  }, [searchParams, draft?.previewUrl, startDraft]);

  const selected = useMemo(() => {
    const list: Character[] = [];
    if (draft.characters.A) list.push(draft.characters.A);
    if (draft.characters.B) list.push(draft.characters.B);
    return list;
  }, [draft.characters.A, draft.characters.B]);

  const toggleCharacter = (character: Character) => {
    if (!character.enabled) return;
    let next = selected.slice();
    const exists = next.find((item) => item.id === character.id);
    if (exists) {
      next = next.filter((item) => item.id !== character.id);
    } else if (next.length < 2) {
      next.push(character);
    } else {
      toast.info("Only two characters can be selected in this MVP.");
      return;
    }
    setDraftCharacters(next);
  };

  const handleNext = () => {
    if (selected.length !== 2) return;
    navigate("/app/create/two-char/script");
  };

  const handleCharacterCreated = async () => {
    // Reload characters from API
    await refreshCharacters();
    toast.success("Character created! It's now available in the list.");
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={0} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Choose two characters</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll map them to Speaker A and B in the script editor.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Create Character Card */}
          <CreateCharacterCard onClick={() => setIsCreateDialogOpen(true)} />
          
          {/* All Characters (custom + default) */}
          {allCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                selected={selected.some((item) => item.id === character.id)}
                onSelect={toggleCharacter}
                onDelete={() => {
                  // Deselect the character if it was selected
                  const isSelected = selected.some((item) => item.id === character.id);
                  if (isSelected) {
                    toggleCharacter(character);
                  }
                }}
              />
            ))}
        </div>
        <div className="flex justify-end">
          <Button className="rounded-2xl px-6" disabled={selected.length !== 2} onClick={handleNext}>
            Next: Script
          </Button>
        </div>
      </div>

      {/* Create Character Dialog */}
      <CreateCharacterDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCharacterCreated={handleCharacterCreated}
      />
    </div>
  );
}
