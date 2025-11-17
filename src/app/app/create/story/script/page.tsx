"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/create/stepper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/lib/stores/project-store";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

const steps = [
  { label: "Step 1", description: "Write narration" },
  { label: "Step 2", description: "Choose background" },
  { label: "Step 3", description: "Preview & render" },
];

export default function StoryScriptPage() {
  const router = useRouter();
  const { draft, updateDraft } = useProjectStore();

  // Initialize draft type for story narration
  useEffect(() => {
    if (draft?.type !== "story") {
      updateDraft({ type: "story" });
    }
  }, [draft?.type, updateDraft]);

  const initialValue = useMemo(() => {
    // For story narration, use scriptInput as plain text lines
    if (draft?.scriptInput) return draft.scriptInput;
    return "Once upon a time, in a world of endless possibilities...\n\nThis is where your story begins.\n\nLet your imagination run wild.";
  }, [draft?.scriptInput]);

  const [text, setText] = useState(initialValue);

  const lines = useMemo(() => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [text]);

  const isValid = lines.length > 0;

  const handleChange = (value: string) => {
    setText(value);
    updateDraft({ scriptInput: value });
  };

  const handleSample = () => {
    const sample = `Welcome to the world of storytelling.

Here, every word matters and every sentence paints a picture.

Let's create something amazing together.

Your story is waiting to be told.`;
    handleChange(sample);
  };

  const handleClear = () => handleChange("");

  const handleNext = () => {
    if (!isValid) {
      toast.error("Please write at least one line of narration");
      return;
    }
    // Store narration lines in scriptInput for now
    updateDraft({ scriptInput: text });
    router.push("/app/create/story/background");
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={0} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Write your story narration</h1>
          <p className="text-sm text-muted-foreground">
            Write your narration line by line. Each line will be spoken by the narrator.
          </p>
        </header>
        
        <div className="space-y-2">
          <Label htmlFor="narration">Narration Lines</Label>
          <Textarea
            id="narration"
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Enter your narration lines, one per line..."
            className="min-h-[300px] font-mono text-sm"
            rows={12}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
            <span>{text.length} characters</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl" onClick={handleSample}>
            Use Sample
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={handleClear}>
            Clear
          </Button>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => router.push("/app/create")}
          >
            Back
          </Button>
          <Button
            className="rounded-2xl px-6"
            disabled={!isValid}
            onClick={handleNext}
          >
            Next: Choose Background
          </Button>
        </div>
      </div>
    </div>
  );
}

