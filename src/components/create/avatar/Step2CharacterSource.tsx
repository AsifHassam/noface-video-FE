"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AvatarWizardState } from "./types";
import { Upload, Shuffle, ImageIcon, Video } from "lucide-react";
import { useState } from "react";
import { config } from "@/lib/config";

type Props = { state: AvatarWizardState };

export function Step2CharacterSource({ state }: Props) {
  const {
    sourceType,
    setSourceType,
    gender,
    setGender,
    vibe,
    setVibe,
    setStep,
    setUploadedImageUrl,
    setAnimationVideoUrl,
    setSelectedAvatarUrl,
    setGeneratedUrls,
    setError,
  } = state;
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>, asOwn: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const token = await import("@/lib/utils/token-cache").then((m) => m.getCachedToken());
      const form = new FormData();
      form.append("image", file);
      const res = await fetch(`${config.remotionServerUrl}/user/upload-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      const url = data.url?.startsWith("http") ? data.url : data.url ? `${config.remotionServerUrl}${data.url}` : data.imageUrl;
      setUploadedImageUrl(url || null);
      setUploadPreview(URL.createObjectURL(file));
      setSourceType(asOwn ? "own" : "upload");
    } catch (err: unknown) {
      state.setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingVideo(true);
    try {
      const token = await import("@/lib/utils/token-cache").then((m) => m.getCachedToken());
      const form = new FormData();
      form.append("video", file);
      const res = await fetch(`${config.remotionServerUrl}/user/upload-video`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Video upload failed");
      }
      const data = await res.json();
      const url = data.url?.startsWith("http") ? data.url : data.url ? `${config.remotionServerUrl}${data.url}` : null;
      setAnimationVideoUrl(url || null);
    } catch (err: unknown) {
      state.setError(err instanceof Error ? err.message : "Video upload failed");
    } finally {
      setUploadingVideo(false);
    }
  };

  const goNext = () => {
    if (sourceType === "own" && state.uploadedImageUrl) {
      setSelectedAvatarUrl(state.uploadedImageUrl);
      setGeneratedUrls([state.uploadedImageUrl]);
    }
    setStep(2);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Character source</CardTitle>
          <CardDescription>Upload a photo, use your own image with no credits, or generate a random character.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => { setSourceType("upload"); setError(null); }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition hover:border-primary/50 ${
                sourceType === "upload" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Upload photo</span>
              <span className="text-xs text-muted-foreground text-center">
                Use as reference to generate avatars (uses credits).
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setSourceType("own"); setError(null); }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition hover:border-primary/50 ${
                sourceType === "own" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Use my image</span>
              <span className="text-xs text-muted-foreground text-center">
                No credits. Upload your image (and optional video).
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setSourceType("random"); setError(null); }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition hover:border-primary/50 ${
                sourceType === "random" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Shuffle className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Random</span>
              <span className="text-xs text-muted-foreground text-center">
                Generate a random character (optional gender/vibe).
              </span>
            </button>
          </div>

          {sourceType === "upload" && (
            <div className="space-y-2">
              <Label>Photo (reference for generation)</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageFile(e, false)}
                disabled={uploading}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
              />
              {uploadPreview && (
                <div className="relative mt-2 aspect-video max-w-xs overflow-hidden rounded-lg border bg-muted">
                  <img src={uploadPreview} alt="Upload preview" className="h-full w-full object-cover" />
                </div>
              )}
            </div>
          )}

          {sourceType === "own" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Your image (required) — used as your avatar with no credits</Label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFile(e, true)}
                  disabled={uploading}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
                />
                {uploadPreview && (
                  <div className="relative mt-2 aspect-video max-w-xs overflow-hidden rounded-lg border bg-muted">
                    <img src={uploadPreview} alt="Upload preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Optional: motion video
                </Label>
                <p className="text-xs text-muted-foreground">
                  If you upload a video, it will be used as the avatar motion. Otherwise the avatar will use your image only.
                </p>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoFile}
                  disabled={uploadingVideo}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
                />
                {state.animationVideoUrl && (
                  <p className="text-xs text-green-600">Video uploaded. You can crop it in the next steps.</p>
                )}
              </div>
            </div>
          )}

          {sourceType === "random" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vibe</Label>
                <Select value={vibe} onValueChange={setVibe}>
                  <SelectTrigger><SelectValue placeholder="Creator" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
            <Button
              disabled={
                (sourceType === "upload" && !state.uploadedImageUrl) ||
                (sourceType === "own" && !state.uploadedImageUrl)
              }
              onClick={goNext}
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
