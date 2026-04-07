"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigateWithLoading } from "@/lib/hooks/use-navigate-with-loading";
import { Stepper } from "@/components/create/stepper";
import { ScriptEditor } from "@/components/create/script-editor";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { parseScriptInput, scriptSchema } from "@/lib/validators/script-schema";
import { subscriptionApi } from "@/lib/api/subscription";
import {
  cloneScriptFromVideo,
  CLONE_FROM_VIDEO_CREDITS,
} from "@/lib/api/two-char-clone";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const steps = [
  { label: "Step 1", description: "Pick two characters" },
  { label: "Step 2", description: "Write the script" },
  { label: "Step 3", description: "Choose gameplay background" },
  { label: "Step 4", description: "Preview & edit" },
];

export default function ScriptPage() {
  const router = useRouter();
  const navigate = useNavigateWithLoading();
  const { draft, updateDraft } = useProjectStore();
  const { user } = useAuthStore();
  const [userCredits, setUserCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!draft?.characters?.A || !draft?.characters?.B) {
      toast.info("Select two characters before writing the script.");
      router.replace("/app/create/two-char/characters");
    }
  }, [draft?.characters?.A, draft?.characters?.B, router]);

  const nameA = draft?.characters?.A?.name ?? "Hero 1";
  const nameB = draft?.characters?.B?.name ?? "Hero 2";

  const initialValue = useMemo(() => {
    if (draft?.scriptInput) return draft.scriptInput;
    if (draft?.script?.length) {
      // Only reconstruct if script lines are valid (have text)
      const validScript = draft.script.filter((line) => line.text && line.text.trim());
      if (validScript.length > 0) {
        return validScript
          .map((line) => {
            const speakerName = line.speaker === "A" ? nameA : nameB;
            const text = line.text || "";
            return `[${speakerName}]: ${text}`;
          })
          .join("\n");
      }
    }
    return `[${nameA}]: Hello!\n[${nameB}]: Hi there!`;
  }, [draft?.script, draft?.scriptInput, nameA, nameB]);

  const [text, setText] = useState(initialValue);
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneLoading, setCloneLoading] = useState(false);

  const { parsedLines, errors, isValid } = useMemo(() => {
    const { lines, errors: parseErrors } = parseScriptInput(text, {
      A: nameA,
      B: nameB,
    });
    const validation = scriptSchema.safeParse(lines);
    return {
      parsedLines: lines,
      errors: parseErrors,
      isValid: validation.success && parseErrors.length === 0,
    };
  }, [text, nameA, nameB]);

  // Load user credits
  useEffect(() => {
    const loadUserCredits = async () => {
      if (!user?.id) {
        setUserCredits(null);
        return;
      }
      
      try {
        const result = await subscriptionApi.getSubscriptionInfo();
        setUserCredits(result.subscription.credits || 0);
      } catch (error) {
        console.error("Error loading user credits:", error);
        setUserCredits(null);
      }
    };

    loadUserCredits();
  }, [user?.id]);

  // Calculate estimated credits (Flash model: 0.2 credits/second)
  const estimatedCredits = useMemo(() => {
    if (!text || text.trim().length === 0) return 0;

    // Estimate duration: average speaking rate is ~150 words per minute = 2.5 words per second
    const words = text.trim().split(/\s+/).length;
    const estimatedSeconds = words / 2.5;
    
    // Flash model rate: 0.2 credits/second
    const creditRate = 0.2;
    const estimatedCredits = estimatedSeconds * creditRate;
    
    return Math.max(0.01, estimatedCredits); // Minimum 0.01 credits
  }, [text]);


  const handleChange = (value: string) => {
    setText(value);
    updateDraft({ scriptInput: value });
  };

  const handleSample = () => {
    const sample = `[${nameA}]: Hey, ready to rehearse our lines?\n[${nameB}]: Always. Let me grab the script.\n[${nameA}]: Remember to hit the dramatic pause.\n[${nameB}]: You mean…the pause that sells the story?\n[${nameA}]: Exactly. noface.video loves good pacing.\n[${nameB}]: Say no more. Let's wow the audience.`;
    handleChange(sample);
  };

  const handleClear = () => handleChange("");

  const handleCloneFromVideo = async () => {
    const url = cloneUrl.trim();
    if (!url) {
      toast.error("Paste a video link first.");
      return;
    }
    if (
      userCredits !== null &&
      userCredits < CLONE_FROM_VIDEO_CREDITS
    ) {
      toast.error(
        `You need at least ${CLONE_FROM_VIDEO_CREDITS} credits (you have ${userCredits.toFixed(2)}).`
      );
      return;
    }
    setCloneLoading(true);
    try {
      const result = await cloneScriptFromVideo({
        videoUrl: url,
        characterAName: nameA,
        characterBName: nameB,
      });
      if (!result.success || !result.scriptText) {
        toast.error(result.error || "Could not generate script");
        return;
      }
      handleChange(result.scriptText);
      toast.success("Script generated from video");
      if (result.remainingCredits != null) {
        setUserCredits(result.remainingCredits);
      } else {
        const sub = await subscriptionApi.getSubscriptionInfo();
        setUserCredits(sub.subscription.credits || 0);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCloneLoading(false);
    }
  };

  const handleNext = () => {
    if (!isValid) {
      toast.error("Fix script validation errors before continuing");
      return;
    }
    updateDraft({ script: parsedLines });
    navigate("/app/create/two-char/background");
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={1} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Script the conversation</h1>
          <p className="text-sm text-muted-foreground">
            Use the pattern <code>[{nameA}]: Hello!</code> to keep things tidy.
          </p>
        </header>
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 sm:p-5">
          <p className="text-sm font-medium text-foreground">
            Clone from a viral video
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste a link from YouTube, TikTok, Instagram, Facebook, or X. We
            transcribe it and write a new script with a similar hook for{" "}
            <span className="font-medium text-foreground">{nameA}</span> and{" "}
            <span className="font-medium text-foreground">{nameB}</span>. Costs{" "}
            {CLONE_FROM_VIDEO_CREDITS} credits.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="url"
              placeholder="https://..."
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              className="rounded-xl bg-background"
              disabled={cloneLoading}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 rounded-xl"
              disabled={
                cloneLoading ||
                (userCredits !== null &&
                  userCredits < CLONE_FROM_VIDEO_CREDITS)
              }
              onClick={handleCloneFromVideo}
            >
              {cloneLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Working…
                </>
              ) : (
                `Generate (${CLONE_FROM_VIDEO_CREDITS} credits)`
              )}
            </Button>
          </div>
        </div>
        <ScriptEditor
          value={text}
          onChange={handleChange}
          parsedLines={parsedLines}
          errors={errors}
          onUseSample={handleSample}
          onClear={handleClear}
          characterNames={{ A: nameA, B: nameB }}
          estimatedCredits={estimatedCredits}
          userCredits={userCredits}
        />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" className="rounded-2xl" onClick={() => navigate("/app/create/two-char/characters")}>
            Back
          </Button>
          <Button className="rounded-2xl px-6" disabled={!isValid} onClick={handleNext}>
            Next: Choose Background
          </Button>
        </div>
      </div>
    </div>
  );
}
