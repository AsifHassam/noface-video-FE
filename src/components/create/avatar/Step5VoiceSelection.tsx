"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { AvatarWizardState } from "./types";
import { Upload, Music } from "lucide-react";
import { useState } from "react";

type Props = { state: AvatarWizardState };

export function Step5VoiceSelection({ state }: Props) {
  const {
    voiceType,
    setVoiceType,
    voiceReferenceUrl,
    setVoiceReferenceUrl,
    presetVoiceName,
    setPresetVoiceName,
    setStep,
    setError,
  } = state;
  const [uploading, setUploading] = useState(false);

  const handleVoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { uploadAudioToStorage } = await import("@/lib/api/ugc-videos");
      const fileName = `${Date.now()}-${file.name}`;
      const url = await uploadAudioToStorage(file, "avatar-voice", fileName);
      setVoiceReferenceUrl(url);
      setVoiceType("upload");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const presets = ["Default", "Narrator", "Warm", "Professional"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
          <CardDescription>Use a preset voice or upload a reference clip.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setVoiceType("upload"); setError(null); }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition hover:border-primary/50 ${
                voiceType === "upload" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Upload reference</span>
              <span className="text-xs text-muted-foreground text-center">
                Clone voice from an audio sample.
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setVoiceType("preset"); setPresetVoiceName("Default"); setError(null); }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition hover:border-primary/50 ${
                voiceType === "preset" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Music className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Preset voice</span>
              <span className="text-xs text-muted-foreground text-center">
                Choose from built-in voices.
              </span>
            </button>
          </div>

          {voiceType === "upload" && (
            <div className="space-y-2">
              <Label>Audio file</Label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleVoiceUpload}
                disabled={uploading}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
              />
              {voiceReferenceUrl && (
                <p className="text-xs text-muted-foreground">Reference uploaded.</p>
              )}
            </div>
          )}

          {voiceType === "preset" && (
            <div className="space-y-2">
              <Label>Preset</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant={presetVoiceName === name ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPresetVoiceName(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
            <Button onClick={() => setStep(5)}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
