"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { generateAvatar } from "@/lib/api/avatar";
import type { AvatarWizardState } from "./types";
import { config } from "@/lib/config";

type Props = { state: AvatarWizardState };

function imageUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${config.remotionServerUrl}${url}`;
}

export function Step3GenerateAvatar({ state }: Props) {
  const {
    mode,
    sourceType,
    uploadedImageUrl,
    gender,
    vibe,
    generatedUrls,
    setGeneratedUrls,
    selectedAvatarUrl,
    setSelectedAvatarUrl,
    setStep,
    setError,
  } = state;
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!mode || !sourceType) return;
    if (sourceType !== "upload" && sourceType !== "random") return;
    setError(null);
    setLoading(true);
    try {
      const { urls } = await generateAvatar({
        mode,
        sourceType,
        uploadedImageUrl: sourceType === "upload" ? uploadedImageUrl ?? undefined : undefined,
        gender: sourceType === "random" ? gender : undefined,
        vibe: sourceType === "random" ? vibe : undefined,
      });
      const list = Array.isArray(urls) ? urls : [];
      setGeneratedUrls(list);
      setSelectedAvatarUrl(list[0] ?? null);
      if (list.length === 0) {
        setError("No images returned. Check server logs or try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setGeneratedUrls([]);
      setSelectedAvatarUrl(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate avatar</CardTitle>
          <CardDescription>Create avatar options and pick one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {generatedUrls.length === 0 && !loading && sourceType !== "own" && (
            <Button onClick={handleGenerate} className="w-full sm:w-auto">
              Generate avatars (8.62 credits)
            </Button>
          )}
          {sourceType === "own" && generatedUrls.length === 0 && (
            <p className="text-sm text-muted-foreground">Upload your image in the previous step, then go back and click Next.</p>
          )}
          {loading && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button disabled>Next</Button>
              </div>
            </>
          )}
          {generatedUrls.length > 0 && !loading && (
            <>
              <div className={sourceType === "own" ? "flex flex-col items-start gap-4" : "grid gap-4 sm:grid-cols-3"}>
                {generatedUrls.map((url) => {
                  const src = imageUrl(url);
                  const selected = selectedAvatarUrl === url;
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setSelectedAvatarUrl(url)}
                      className={`relative aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl border-2 transition ${
                        selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <img src={src} alt="Avatar option" className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
              {sourceType === "own" && (
                <p className="text-sm text-muted-foreground">Using your image. No credits used.</p>
              )}
              <div className="flex justify-between">
                {sourceType !== "own" && (
                  <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                    Regenerate (8.62 credits)
                  </Button>
                )}
                {sourceType === "own" && <div />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                  <Button disabled={!selectedAvatarUrl} onClick={() => setStep(3)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
