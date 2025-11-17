"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Lock, Play, Pause, Volume2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import type { Character } from "@/types";
import { cn } from "@/lib/utils";

type CharacterCardProps = {
  character: Character;
  selected: boolean;
  onSelect: (character: Character) => void;
};

// Map character IDs to their voice sample files
const getVoiceSampleUrl = (characterId: string): string | null => {
  const voiceMap: Record<string, string> = {
    hero1: "/voice_samples/Peter-sample.mp3", // Peter
    hero2: "/voice_samples/Stewie-sample.mp3", // Stewie
  };
  return voiceMap[characterId] || null;
};

export const CharacterCard = ({ character, selected, onSelect }: CharacterCardProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceSampleUrl = getVoiceSampleUrl(character.id);

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

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't select if clicking on the play button or its container
    if ((e.target as HTMLElement).closest('[data-voice-preview]')) {
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
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
            <Lock className="h-6 w-6" />
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
          <p className="text-lg font-semibold text-foreground">{character.name}</p>
          {voiceSampleUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Volume2 className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Voice preview available</TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {character.isPlaceholder ? "Placeholder voice" : "Premium voice"}
        </p>
      </div>
    </motion.div>
  );

  if (!character.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>Unavailable in MVP</TooltipContent>
      </Tooltip>
    );
  }

  return content;
};
