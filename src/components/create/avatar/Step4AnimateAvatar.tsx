"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { animateAvatar, cropAvatarVideo, fetchLastAnimation } from "@/lib/api/avatar";
import type { AvatarWizardState } from "./types";
import { config } from "@/lib/config";

type Props = { state: AvatarWizardState };

function isAbsolute(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:");
}

function mediaUrl(url: string): string {
  if (isAbsolute(url)) return url;
  return `${config.remotionServerUrl}${url}`;
}

export function Step4AnimateAvatar({ state }: Props) {
  const {
    sourceType,
    selectedAvatarUrl,
    animationVideoUrl,
    setAnimationVideoUrl,
    motionStyle,
    setMotionStyle,
    setStep,
    setError,
  } = state;
  const [loading, setLoading] = useState(false);
  const [cropLoading, setCropLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [trimEndSeconds, setTrimEndSeconds] = useState(0.5);

  const handleFetchLastAnimation = async () => {
    setRecoveryLoading(true);
    setError(null);
    try {
      const result = await fetchLastAnimation();
      if (result?.videoUrl) {
        setAnimationVideoUrl(result.videoUrl.startsWith("http") ? result.videoUrl : `${config.remotionServerUrl}${result.videoUrl}`);
        setError(null);
      } else {
        setError("No recent animation found. Try generating again.");
      }
    } catch {
      setError("Could not fetch video. Try generating again.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handleAnimate = async () => {
    if (!selectedAvatarUrl) return;
    setError(null);
    setLoading(true);
    try {
      const imageUrl = isAbsolute(selectedAvatarUrl)
        ? selectedAvatarUrl
        : `${config.remotionServerUrl}${selectedAvatarUrl}`;
      const { videoUrl } = await animateAvatar(imageUrl, motionStyle);
      setAnimationVideoUrl(videoUrl.startsWith("http") ? videoUrl : `${config.remotionServerUrl}${videoUrl}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Animation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCropEnd = async () => {
    if (!animationVideoUrl) return;
    setError(null);
    setCropLoading(true);
    try {
      const fullUrl = mediaUrl(animationVideoUrl);
      const { videoUrl } = await cropAvatarVideo(fullUrl, trimEndSeconds);
      setAnimationVideoUrl(videoUrl.startsWith("http") ? videoUrl : `${config.remotionServerUrl}${videoUrl}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Crop failed");
    } finally {
      setCropLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Animate avatar</CardTitle>
          <CardDescription>Add subtle motion to your selected avatar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="space-y-1">
              <Label>Selected avatar</Label>
              <div className="relative aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl border border-border bg-muted">
                {selectedAvatarUrl ? (
                  <img
                    src={mediaUrl(selectedAvatarUrl)}
                    alt="Selected avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                    No avatar selected. Go back to step 3 to choose one.
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              {!animationVideoUrl && (
                <>
                  {sourceType === "own" && (
                    <p className="text-sm text-muted-foreground">
                      Generate motion from your image (uses credits), or skip and save with image only.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label>Motion style</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={motionStyle === "calm" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMotionStyle("calm")}
                      >
                        Calm
                      </Button>
                      <Button
                        type="button"
                        variant={motionStyle === "expressive" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMotionStyle("expressive")}
                      >
                        Expressive
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={handleAnimate} disabled={loading || !selectedAvatarUrl}>
                      {loading ? "Animating…" : "Generate animation (18.97 credits)"}
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleFetchLastAnimation}
                          disabled={recoveryLoading}
                        >
                          {recoveryLoading ? "Checking…" : "Fetch my video from server"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Use this button if animation times out
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </>
              )}
            </div>
          </div>
          {animationVideoUrl && (
            <>
              <div className="space-y-2">
                <Label>Preview (9:16 / TikTok)</Label>
                <div className="relative aspect-[9/16] max-w-[280px] overflow-hidden rounded-xl border bg-black">
                  <video src={mediaUrl(animationVideoUrl)} controls className="h-full w-full object-cover object-center" />
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                <Label className="text-sm">Crop video (remove end)</Label>
                <p className="text-xs text-muted-foreground">
                  Veo3 can add extra frames at the end. Remove the last few seconds and use the cropped video as your avatar.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="trim-end" className="text-xs whitespace-nowrap">Seconds to remove:</Label>
                    <Input
                      id="trim-end"
                      type="number"
                      min={0.25}
                      max={10}
                      step={0.25}
                      value={trimEndSeconds}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v)) setTrimEndSeconds(Math.max(0.25, Math.min(10, v)));
                      }}
                      className="w-20 h-8 rounded-lg text-sm"
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleCropEnd} disabled={cropLoading}>
                    {cropLoading ? "Cropping…" : "Apply crop (use as avatar video)"}
                  </Button>
                </div>
              </div>
            </>
          )}
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
