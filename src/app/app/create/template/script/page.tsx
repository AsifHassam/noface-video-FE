"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Stepper } from "@/components/create/stepper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/lib/stores/project-store";
import { toast } from "sonner";
import { ScriptEditor } from "@/components/create/script-editor";
import { parseScriptInput, scriptSchema } from "@/lib/validators/script-schema";
import type { TextOverlay } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  { label: "Step 1", description: "Script & Text Overlays" },
  { label: "Step 2", description: "Preview & render" },
];

export default function TemplateScriptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft, updateDraft } = useProjectStore();
  const isStory = draft?.type === "story" || draft?.type === "NORMAL_STORY";

  // Initialize from template
  useEffect(() => {
    if (!draft?.backgroundId) {
      toast.error("Template not loaded. Please start over.");
      router.push("/app/dashboard");
      return;
    }
    // Ensure text overlays from template are loaded
    if (draft?.textOverlays && draft.textOverlays.length > 0) {
      setTextOverlays(draft.textOverlays);
    }
    // If this is a story template, redirect to story script page
    if (isStory) {
      router.push("/app/create/story/script");
      return;
    }
  }, [draft?.backgroundId, draft?.textOverlays, draft?.type, isStory, router]);

  const nameA = draft?.characters?.A?.name ?? "Hero 1";
  const nameB = draft?.characters?.B?.name ?? "Hero 2";

  // Script state
  const initialScriptValue = useMemo(() => {
    if (isStory) {
      return draft?.scriptInput || "";
    } else {
      if (draft?.scriptInput) return draft.scriptInput;
      if (draft?.script?.length) {
        const validScript = draft.script.filter((line) => line.text && line.text.trim());
        if (validScript.length > 0) {
          return validScript
            .map((line) => {
              const speakerName = line.speaker === "A" ? nameA : nameB;
              return `[${speakerName}]: ${line.text || ""}`;
            })
            .join("\n");
        }
      }
      return `[${nameA}]: Hello!\n[${nameB}]: Hi there!`;
    }
  }, [draft?.scriptInput, draft?.script, nameA, nameB, isStory]);

  const [scriptText, setScriptText] = useState(initialScriptValue);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>(draft?.textOverlays || []);

  // Parse script for two-char conversations
  const { parsedLines, errors, isValid: isScriptValid } = useMemo(() => {
    if (isStory) {
      const lines = scriptText.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
      return {
        parsedLines: [],
        errors: [],
        isValid: lines.length > 0,
      };
    } else {
      const { lines, errors: parseErrors } = parseScriptInput(scriptText, {
        A: nameA,
        B: nameB,
      });
      const validation = scriptSchema.safeParse(lines);
      return {
        parsedLines: lines,
        errors: parseErrors,
        isValid: validation.success && parseErrors.length === 0,
      };
    }
  }, [scriptText, nameA, nameB, isStory]);

  const handleScriptChange = (value: string) => {
    setScriptText(value);
    if (isStory) {
      updateDraft({ scriptInput: value });
    } else {
      updateDraft({ scriptInput: value });
    }
  };

  const handleSample = () => {
    const sample = `[${nameA}]: Hey, ready to rehearse our lines?\n[${nameB}]: Always. Let me grab the script.\n[${nameA}]: Remember to hit the dramatic pause.\n[${nameB}]: You mean…the pause that sells the story?\n[${nameA}]: Exactly. noface.video loves good pacing.\n[${nameB}]: Say no more. Let's wow the audience.`;
    handleScriptChange(sample);
  };

  const handleClear = () => handleScriptChange("");

  const handleAddTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: uuidv4(),
      text: "New Title",
      startMs: 0,
      endMs: 3000,
      x: 50,
      y: 10,
      fontSize: 48,
      color: "#ffffff",
      style: "classic",
    };
    setTextOverlays([...textOverlays, newOverlay]);
  };

  const handleUpdateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(
      textOverlays.map((overlay) => (overlay.id === id ? { ...overlay, ...updates } : overlay))
    );
  };

  const handleRemoveTextOverlay = (id: string) => {
    setTextOverlays(textOverlays.filter((overlay) => overlay.id !== id));
  };

  const handleNext = () => {
    if (!isScriptValid) {
      toast.error(isStory ? "Please write at least one line of narration" : "Fix script validation errors before continuing");
      return;
    }

    // Save script and text overlays to draft
    if (isStory) {
      updateDraft({ 
        scriptInput: scriptText, 
        textOverlays,
        type: "story"
      });
      router.push("/app/create/story/preview");
    } else {
      updateDraft({ 
        script: parsedLines, 
        textOverlays,
        type: "TWO_CHAR_CONVO"
      });
      router.push("/app/create/two-char/preview");
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={0} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {isStory ? "Write your story narration" : "Script the conversation"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isStory
              ? "Write your narration line by line. Each line will be spoken by the narrator."
              : `Use the pattern [${nameA}]: Hello! to keep things tidy.`}
          </p>
        </header>

        {/* Script Editor */}
        <div className="space-y-4">
          <Label>Script</Label>
          {isStory ? (
            <Textarea
              value={scriptText}
              onChange={(e) => handleScriptChange(e.target.value)}
              placeholder="Enter your narration lines, one per line..."
              className="min-h-[300px] font-mono text-sm"
              rows={12}
            />
          ) : (
            <ScriptEditor
              value={scriptText}
              onChange={handleScriptChange}
              parsedLines={parsedLines}
              errors={errors}
              onUseSample={handleSample}
              onClear={handleClear}
              characterNames={{ A: nameA, B: nameB }}
            />
          )}
        </div>

        {/* Text Overlays Editor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Text Overlays (Titles)</Label>
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={handleAddTextOverlay}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Overlay
            </Button>
          </div>

          {textOverlays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/40 bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No text overlays yet. Click "Add Overlay" to add a title or text overlay.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {textOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className="rounded-2xl border border-border/40 bg-white/70 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Text Overlay</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveTextOverlay(overlay.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs">Text</Label>
                      <Input
                        value={overlay.text}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, { text: e.target.value })
                        }
                        placeholder="Enter overlay text"
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Style</Label>
                      <Input
                        value={overlay.style}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, { style: e.target.value as any })
                        }
                        placeholder="classic"
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Start (ms)</Label>
                      <Input
                        type="number"
                        value={overlay.startMs}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, {
                            startMs: parseInt(e.target.value) || 0,
                          })
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">End (ms)</Label>
                      <Input
                        type="number"
                        value={overlay.endMs}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, {
                            endMs: parseInt(e.target.value) || 0,
                          })
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">X Position (%)</Label>
                      <Input
                        type="number"
                        value={overlay.x}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, {
                            x: parseInt(e.target.value) || 50,
                          })
                        }
                        className="rounded-xl"
                        min={0}
                        max={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Y Position (%)</Label>
                      <Input
                        type="number"
                        value={overlay.y}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, {
                            y: parseInt(e.target.value) || 10,
                          })
                        }
                        className="rounded-xl"
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Font Size</Label>
                      <Input
                        type="number"
                        value={overlay.fontSize}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, {
                            fontSize: parseInt(e.target.value) || 48,
                          })
                        }
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Color</Label>
                      <Input
                        type="color"
                        value={overlay.color}
                        onChange={(e) =>
                          handleUpdateTextOverlay(overlay.id, { color: e.target.value })
                        }
                        className="rounded-xl h-10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => router.push("/app/dashboard")}
          >
            Cancel
          </Button>
          <Button className="rounded-2xl px-6" disabled={!isScriptValid} onClick={handleNext}>
            Next: Preview
          </Button>
        </div>
      </div>
    </div>
  );
}

