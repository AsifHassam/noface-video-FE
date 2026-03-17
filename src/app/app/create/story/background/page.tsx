"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigateWithLoading } from "@/lib/hooks/use-navigate-with-loading";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Stepper } from "@/components/create/stepper";
import { BackgroundCard } from "@/components/create/background-card";
import { useProjectStore } from "@/lib/stores/project-store";
import { getBackgrounds, getBackgroundDuration } from "@/lib/data/backgrounds";
import { estimateDurationFromScriptText } from "@/lib/utils/duration-estimator";
import type { Background } from "@/types";
import { toast } from "sonner";

const steps = [
  { label: "Step 1", description: "Write narration" },
  { label: "Step 2", description: "Choose background" },
  { label: "Step 3", description: "Preview & render" },
];

export default function StoryBackgroundPage() {
  const router = useRouter();
  const navigate = useNavigateWithLoading();
  const { draft, updateDraft } = useProjectStore();
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!draft?.scriptInput?.trim()) {
      toast.info("Write narration before choosing a background.");
      router.replace("/app/create/story/script");
      return;
    }

    // Load backgrounds from API
    const loadBackgrounds = async () => {
      try {
        setLoading(true);
        const data = await getBackgrounds();
        setBackgrounds(data);
      } catch (error) {
        console.error("Error loading backgrounds:", error);
        toast.error("Failed to load backgrounds. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadBackgrounds();
  }, [draft?.scriptInput, router]);

  const handleSelect = (background: Background) => {
    updateDraft({ backgroundId: background.id });
  };

  const handleNext = async () => {
    if (!draft?.backgroundId) {
      toast.error("Please select a background");
      return;
    }

    // Check video duration - must be less than background video length (with 10% buffer)
    // Use the same calculation as the script editor
    const estimatedDuration = estimateDurationFromScriptText(draft?.scriptInput);
    const backgroundDuration = await getBackgroundDuration(draft.backgroundId);
    
    if (backgroundDuration) {
      const maxAllowedDuration = backgroundDuration * 0.9; // 10% buffer
      if (estimatedDuration > maxAllowedDuration) {
        toast.error(
          `Your script is estimated at ${estimatedDuration}s (shown on script page), but the selected background video is only ${backgroundDuration}s long (max allowed: ${maxAllowedDuration.toFixed(1)}s with 10% buffer). Please choose a longer background video or shorten your script.`,
          { duration: 6000 }
        );
        return;
      }
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
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <div className="grid gap-4 md:grid-cols-3">
            {backgrounds.map((background) => (
            <BackgroundCard
              key={background.id}
              background={background}
              selected={draft?.backgroundId === background.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
        )}
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => navigate("/app/create/story/script")}
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

