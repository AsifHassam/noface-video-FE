"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCharacter, updateCharacter } from "@/lib/api/avatar";
import type { AvatarWizardState } from "./types";
import { useRouter } from "next/navigation";

type Props = { state: AvatarWizardState };

export function Step6SaveCharacter({ state }: Props) {
  const router = useRouter();
  const {
    mode,
    sourceType,
    uploadedImageUrl,
    selectedAvatarUrl,
    animationVideoUrl,
    motionStyle,
    characterName,
    setCharacterName,
    setStep,
    setError,
    characterId,
  } = state;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!mode || !sourceType || !selectedAvatarUrl) return;
    setError(null);
    setSaving(true);
    try {
      if (characterId) {
        await updateCharacter(characterId, {
          selectedAvatarUrl,
          animationVideoUrl: animationVideoUrl ?? undefined,
          motionStyle,
          characterName: characterName || undefined,
        });
      } else {
        await saveCharacter({
          mode,
          sourceType,
          uploadedImageUrl: uploadedImageUrl ?? null,
          generatedAvatarUrl: state.generatedUrls[0] ?? null,
          selectedAvatarUrl,
          animationVideoUrl: animationVideoUrl ?? null,
          motionStyle,
          voiceType: "preset",
          voiceReferenceUrl: null,
          presetVoiceName: "Default",
          characterName: characterName || undefined,
        });
      }
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Saved</CardTitle>
          <CardDescription>Your character has been saved. You can use it in the UGC video editor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.push("/app/create")}>Back to Create</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Save character</CardTitle>
          <CardDescription>Give it a name and save to use in videos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              placeholder="My avatar"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : characterId ? "Update character" : "Save character"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
