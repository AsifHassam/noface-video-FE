"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ScriptLine } from "@/types";
import type { ScriptValidationError } from "@/lib/validators/script-schema";
import { cn } from "@/lib/utils";

type ScriptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  parsedLines: ScriptLine[];
  errors: ScriptValidationError[];
  onUseSample: () => void;
  onClear: () => void;
  onSplit: () => void;
  characterNames: { A: string; B: string };
};

export const ScriptEditor = ({
  value,
  onChange,
  parsedLines,
  errors,
  onUseSample,
  onClear,
  onSplit,
  characterNames,
}: ScriptEditorProps) => {
  const charCount = value.length;
  const tokenCount = Math.ceil(charCount / 4);
  const [showAll, setShowAll] = useState(false);
  const visibleLines = parsedLines.length > 5 && !showAll ? parsedLines.slice(0, 5) : parsedLines;

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Tokens ~{tokenCount}
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            Characters {charCount}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Alternate lines between {characterNames.A} and {characterNames.B}
          </span>
        </div>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "min-h-[320px] rounded-3xl border border-border/60 bg-white p-4 text-base shadow-inner",
            errors.length > 0 && "border-destructive/60",
          )}
          placeholder={`[${characterNames.A}]: Hello!\n[${characterNames.B}]: Hi there!`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="rounded-2xl" onClick={onUseSample}>
            Use sample script
          </Button>
          <Button variant="ghost" className="rounded-2xl" onClick={onClear}>
            Clear
          </Button>
          <Button variant="ghost" className="rounded-2xl" onClick={onSplit}>
            Split into lines
          </Button>
        </div>
      </div>
      <aside className="space-y-4 rounded-3xl border border-border/60 bg-white/70 p-5 shadow-inner">
        <section>
          <h3 className="text-sm font-semibold text-foreground">Parsed dialogue</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {parsedLines.length === 0 ? (
              <li className="text-muted-foreground">
                Start typing to see parsed lines.
              </li>
            ) : (
              visibleLines.map((line, index) => (
                <li key={`${line.speaker}-${index}`} className="rounded-2xl bg-muted/40 px-3 py-2">
                  <span className="font-medium text-primary">
                    {line.speaker === "A" ? characterNames.A : characterNames.B}:
                  </span>{" "}
                  {line.text}
                </li>
              ))
            )}
          </ul>
          {parsedLines.length > 5 && (
            <div className="mt-3">
              <Button variant="ghost" className="rounded-2xl text-xs" onClick={() => setShowAll(!showAll)}>
                {showAll ? "View less" : `View ${parsedLines.length - 5} more`}
              </Button>
            </div>
          )}
        </section>
        <section>
          <h3 className="text-sm font-semibold text-foreground">Validation</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {errors.length === 0 ? (
              <li className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                Looks good! Speakers alternate correctly.
              </li>
            ) : (
              errors.map((error) => (
                <li
                  key={`${error.index}-${error.message}`}
                  className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
                >
                  Line {error.index + 1}: {error.message}
                </li>
              ))
            )}
          </ul>
        </section>
      </aside>
    </div>
  );
};
