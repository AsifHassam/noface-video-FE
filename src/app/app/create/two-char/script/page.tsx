"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/create/stepper";
import { ScriptEditor } from "@/components/create/script-editor";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/lib/stores/project-store";
import { parseScriptInput, scriptSchema } from "@/lib/validators/script-schema";
import { toast } from "sonner";

const steps = [
  { label: "Step 1", description: "Pick two characters" },
  { label: "Step 2", description: "Write the script" },
  { label: "Step 3", description: "Choose gameplay background" },
  { label: "Step 4", description: "Preview & edit" },
];

export default function ScriptPage() {
  const router = useRouter();
  const { draft, updateDraft } = useProjectStore();

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


  const handleChange = (value: string) => {
    setText(value);
    updateDraft({ scriptInput: value });
  };

  const handleSample = () => {
    const sample = `[${nameA}]: Hey, ready to rehearse our lines?\n[${nameB}]: Always. Let me grab the script.\n[${nameA}]: Remember to hit the dramatic pause.\n[${nameB}]: You mean…the pause that sells the story?\n[${nameA}]: Exactly. noface.video loves good pacing.\n[${nameB}]: Say no more. Let's wow the audience.`;
    handleChange(sample);
  };

  const handleClear = () => handleChange("");

  const handleNext = () => {
    if (!isValid) {
      toast.error("Fix script validation errors before continuing");
      return;
    }
    updateDraft({ script: parsedLines });
    router.push("/app/create/two-char/background");
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
        <ScriptEditor
          value={text}
          onChange={handleChange}
          parsedLines={parsedLines}
          errors={errors}
          onUseSample={handleSample}
          onClear={handleClear}
          characterNames={{ A: nameA, B: nameB }}
        />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" className="rounded-2xl" onClick={() => router.push("/app/create/two-char/characters")}>
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
