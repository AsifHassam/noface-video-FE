"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Stepper } from "@/components/create/stepper";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Step1SelectMode } from "@/components/create/avatar/Step1SelectMode";
import { Step2CharacterSource } from "@/components/create/avatar/Step2CharacterSource";
import { Step3GenerateAvatar } from "@/components/create/avatar/Step3GenerateAvatar";
import { Step4AnimateAvatar } from "@/components/create/avatar/Step4AnimateAvatar";
import { Step6SaveCharacter } from "@/components/create/avatar/Step6SaveCharacter";
import type { StepperStep } from "@/components/create/stepper";
import { getCharacter } from "@/lib/api/avatar";
import { config } from "@/lib/config";

const STEPS: StepperStep[] = [
  { label: "Style", description: "Selfie or Studio" },
  { label: "Character", description: "Upload or random" },
  { label: "Avatar", description: "Generate & select" },
  { label: "Motion", description: "Animate" },
  { label: "Save", description: "Save character" },
];

export default function CreateAvatarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const characterIdParam = searchParams.get("characterId");

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"selfie" | "studio" | null>(null);
  const [sourceType, setSourceType] = useState<"upload" | "random" | "own" | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<string>("any");
  const [vibe, setVibe] = useState<string>("creator");
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string | null>(null);
  const [animationVideoUrl, setAnimationVideoUrl] = useState<string | null>(null);
  const [motionStyle, setMotionStyle] = useState<"calm" | "expressive">("calm");
  const [voiceType, setVoiceType] = useState<"upload" | "preset" | null>(null);
  const [voiceReferenceUrl, setVoiceReferenceUrl] = useState<string | null>(null);
  const [presetVoiceName, setPresetVoiceName] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [editLoaded, setEditLoaded] = useState(false);

  // Load existing character when editing (characterId in URL)
  useEffect(() => {
    if (!characterIdParam) {
      setEditLoaded(true);
      return;
    }
    let cancelled = false;
    getCharacter(characterIdParam)
      .then(({ character }) => {
        if (cancelled) return;
        const c = character as Record<string, unknown>;
        const modeVal = (c.mode as string) === "studio" ? "studio" : "selfie";
        const src = c.sourceType as string;
        const sourceVal = src === "random" ? "random" : src === "own" ? "own" : "upload";
        const selected = (c.selectedAvatarUrl as string) || null;
        const animUrl = (c.animationVideoUrl as string) || null;
        const fullSelected = selected && !selected.startsWith("http") ? `${config.remotionServerUrl}${selected}` : selected;
        const fullAnim = animUrl && !animUrl.startsWith("http") ? `${config.remotionServerUrl}${animUrl}` : animUrl;
        setMode(modeVal);
        setSourceType(sourceVal);
        setUploadedImageUrl((c.uploadedImageUrl as string) || null);
        setGeneratedUrls(c.generatedAvatarUrl ? [c.generatedAvatarUrl as string] : selected ? [selected] : []);
        setSelectedAvatarUrl(fullSelected);
        setAnimationVideoUrl(fullAnim || null);
        setMotionStyle((c.motionStyle as string) === "expressive" ? "expressive" : "calm");
        setVoiceType("preset");
        setPresetVoiceName((c.presetVoiceName as string) || "Default");
        setCharacterName((c.characterName as string) || "");
        setCharacterId(characterIdParam);
        setStep(3); // Animate step so user can crop video
        setEditLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load character");
          setEditLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [characterIdParam]);

  const state = {
    step,
    setStep,
    mode,
    setMode,
    sourceType,
    setSourceType,
    uploadedImageUrl,
    setUploadedImageUrl,
    gender,
    setGender,
    vibe,
    setVibe,
    generatedUrls,
    setGeneratedUrls,
    selectedAvatarUrl,
    setSelectedAvatarUrl,
    animationVideoUrl,
    setAnimationVideoUrl,
    motionStyle,
    setMotionStyle,
    voiceType,
    setVoiceType,
    voiceReferenceUrl,
    setVoiceReferenceUrl,
    presetVoiceName,
    setPresetVoiceName,
    characterName,
    setCharacterName,
    error,
    setError,
    characterId,
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div className="border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push("/app/create")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">{characterId ? "Edit Avatar" : "Create Avatar"}</h1>
          <div className="w-20" />
        </div>
      </div>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Stepper steps={STEPS} activeIndex={step} />
        <div className="mt-8">
          {!editLoaded && (
            <p className="text-muted-foreground">Loading…</p>
          )}
          {editLoaded && step === 0 && <Step1SelectMode state={state} />}
          {editLoaded && step === 1 && <Step2CharacterSource state={state} />}
          {editLoaded && step === 2 && <Step3GenerateAvatar state={state} />}
          {editLoaded && step === 3 && <Step4AnimateAvatar state={state} />}
          {editLoaded && step === 4 && <Step6SaveCharacter state={state} />}
        </div>
      </main>
    </div>
  );
}
