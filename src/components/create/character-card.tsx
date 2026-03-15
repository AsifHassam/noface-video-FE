"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Lock, Play, Pause, Volume2, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Character } from "@/types";
import { cn } from "@/lib/utils";
import { useCharacterStore } from "@/lib/stores/character-store";
import { toast } from "sonner";

type CharacterCardProps = {
  character: Character;
  selected: boolean;
  onSelect: (character: Character) => void;
  onDelete?: () => void; // Optional callback when character is deleted
};

// Map character IDs to their voice sample files (static/built-in characters)
const getBuiltInVoiceSampleUrl = (characterId: string): string | null => {
  const voiceMap: Record<string, string> = {
    hero1: "/voice_samples/Peter-sample.mp3", // Peter
    hero2: "/voice_samples/Stewie-sample.mp3", // Stewie
  };
  return voiceMap[characterId] || null;
};

export const CharacterCard = ({ character, selected, onSelect, onDelete }: CharacterCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceSampleUrl = getBuiltInVoiceSampleUrl(character.id) ?? character.voiceSampleUrl ?? null;
  const { deleteCharacter } = useCharacterStore();

  const isCustomCharacter = character.slug.startsWith("custom-");
  const isGlobalCharacter = character.slug.startsWith("global-");

  // Handle audio playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking play button
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => {
        console.error("Error playing audio:", err);
      });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking delete button
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCharacter(character.id);
      toast.success("Character deleted successfully");
      setShowDeleteDialog(false);
      // Call onDelete callback if provided (to deselect the character if it was selected)
      onDelete?.();
    } catch (error) {
      console.error("Error deleting character:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete character");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't select if clicking on interactive elements
    if ((e.target as HTMLElement).closest('[data-voice-preview]') || 
        (e.target as HTMLElement).closest('[data-delete-button]')) {
      return;
    }
    if (character.enabled) {
      onSelect(character);
    }
  };

  const content = (
    <motion.div
      whileHover={{ y: character.enabled ? -4 : 0 }}
      onClick={handleCardClick}
      role="button"
      aria-pressed={selected}
      aria-disabled={!character.enabled}
      className={cn(
        "flex w-full flex-col gap-4 rounded-3xl border p-5 text-left transition",
        character.enabled
          ? "cursor-pointer border-border/60 bg-white hover:border-primary/40"
          : "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground",
        selected && "border-primary bg-primary/10 shadow-lg shadow-primary/20 ring-2 ring-primary/20",
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-muted/50 pointer-events-none">
        <Image
          src={character.avatarUrl || "/avatars/placeholder.svg"}
          alt={character.name}
          fill
          sizes="(min-width: 768px) 160px, 50vw"
          className="object-contain p-2"
        />
        {!character.enabled ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm text-white">
            <Lock className="h-6 w-6 mb-2" />
            <span className="text-xs font-semibold">Coming Soon</span>
          </div>
        ) : null}
        {voiceSampleUrl && (
          <>
            <audio ref={audioRef} src={voiceSampleUrl} preload="metadata" />
            <div className="absolute bottom-2 right-2 z-10 pointer-events-auto" data-voice-preview>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={toggleAudio}
                className="h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80"
                aria-label={isPlaying ? "Pause voice preview" : "Play voice preview"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 text-white" />
                ) : (
                  <Play className="h-4 w-4 text-white" />
                )}
              </Button>
            </div>
          </>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className={cn(
            "text-lg font-semibold",
            character.enabled ? "text-foreground" : "text-muted-foreground"
          )}>
            {character.name}
          </p>
          <div className="flex items-center gap-2">
            {isCustomCharacter && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                    data-delete-button
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete custom character</TooltipContent>
              </Tooltip>
            )}
          {voiceSampleUrl && character.enabled && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Voice preview available</TooltipContent>
            </Tooltip>
          )}
          </div>
        </div>
        {character.enabled ? (
        <p className="text-xs text-muted-foreground">
          {isGlobalCharacter ? "Global character" : isCustomCharacter ? "Custom character" : character.isPlaceholder ? "Placeholder voice" : "Premium voice"}
        </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Coming Soon</p>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      {content}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Delete Character</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{character.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-2xl"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
