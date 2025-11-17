"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/create/stepper";
import { BackgroundCard } from "@/components/create/background-card";
import { useProjectStore } from "@/lib/stores/project-store";
import { BACKGROUNDS } from "@/lib/data/backgrounds";
import type { Background } from "@/types";
import { toast } from "sonner";

const steps = [
  { label: "Step 1", description: "Write narration" },
  { label: "Step 2", description: "Choose background" },
  { label: "Step 3", description: "Preview & render" },
];

export default function StoryBackgroundPage() {
  const router = useRouter();
  const { draft, updateDraft } = useProjectStore();

  useEffect(() => {
    if (!draft?.scriptInput?.trim()) {
      toast.info("Write narration before choosing a background.");
      router.replace("/app/create/story/script");
    }
  }, [draft?.scriptInput, router]);

  const handleSelect = (background: Background) => {
    updateDraft({ backgroundId: background.id });
  };

  const handleNext = () => {
    if (!draft?.backgroundId) {
      toast.error("Please select a background");
      return;
    }
    router.push("/app/create/story/preview");
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={1} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Choose background video
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a background video for your story narration.
          </p>
        </header>
        <div className="grid gap-4 md:grid-cols-3">
          {BACKGROUNDS.map((background) => (
            <BackgroundCard
              key={background.id}
              background={background}
              selected={draft?.backgroundId === background.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => router.push("/app/create/story/script")}
          >
            Back
          </Button>
          <Button
            className="rounded-2xl px-6"
            disabled={!draft?.backgroundId}
            onClick={handleNext}
          >
            Next: Preview
          </Button>
        </div>
      </div>
    </div>
  );
}

