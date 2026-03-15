"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { selfieReferenceImageUrl } from "@/lib/api/avatar";
import type { AvatarWizardState } from "./types";
import { Smartphone, Video } from "lucide-react";

type Props = { state: AvatarWizardState };

export function Step1SelectMode({ state }: Props) {
  const { mode, setMode, setStep, setError } = state;
  const refUrl = selfieReferenceImageUrl();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Choose avatar style</CardTitle>
          <CardDescription>Selfie = casual, phone-style. Studio = professional look.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => { setMode("selfie"); setError(null); }}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-left transition hover:border-primary/50 ${
                mode === "selfie" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <Smartphone className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Selfie</span>
              <span className="text-xs text-muted-foreground text-center">
                Casual, smartphone-style portrait. Great for talking-head content.
              </span>
            </button>
            <button
              type="button"
              disabled
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-border p-6 text-left opacity-70 cursor-not-allowed"
            >
              <Video className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">Studio</span>
              <span className="text-xs text-muted-foreground text-center">
                Coming soon
              </span>
            </button>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">Example: Selfie-style avatar</p>
            <p className="mb-4 text-xs text-muted-foreground">
              This is the kind of avatar you&apos;ll get with Selfie mode — ultra-realistic, natural lighting, casual home setting.
            </p>
            <div className="relative mx-auto aspect-[9/16] max-w-[280px] overflow-hidden rounded-xl border border-border bg-muted shadow-inner">
              <img
                src={refUrl}
                alt="Example selfie-style avatar"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button disabled={!mode} onClick={() => setStep(1)}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
