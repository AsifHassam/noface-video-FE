"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  DEFAULT_TEMPLATE_INCLUDES,
  type TemplateIncludeFlags,
} from "@/lib/template-includes";

interface SaveTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    name: string,
    description: string | undefined,
    includes: TemplateIncludeFlags
  ) => Promise<void>;
  isLoading?: boolean;
  /** Story flows hide two-character-only options */
  variant?: "two-char" | "story";
}

type IncludeKey = keyof TemplateIncludeFlags;

/** Not shown in story flow; forced false when saving story templates */
export const STORY_TEMPLATE_EXCLUDE_KEYS: Array<keyof TemplateIncludeFlags> = [
  "characters",
  "characterSizes",
  "characterPositions",
  "characterCustomPositions",
  "characterSlideIn",
  "characterSlideInWhoosh",
];

const ROWS: { key: IncludeKey; label: string; hint?: string; twoCharOnly?: boolean }[] = [
  { key: "background", label: "Background" },
  {
    key: "subtitles",
    label: "Subtitles",
    hint: "Style, position, font size, colors, single-line / word modes",
  },
  { key: "textOverlays", label: "Text overlays" },
  { key: "characters", label: "Characters (A & B)", twoCharOnly: true },
  { key: "characterSizes", label: "Character sizes", twoCharOnly: true },
  { key: "characterPositions", label: "Character positions (left / center / right)", twoCharOnly: true },
  {
    key: "characterCustomPositions",
    label: "Custom character positions (drag)",
    twoCharOnly: true,
  },
  { key: "playbackRate", label: "Playback speed" },
  {
    key: "imageOverlays",
    label: "Image overlays",
    hint: "Includes positions and per-overlay slide-in",
  },
  {
    key: "characterSlideIn",
    label: "Character slide-in",
    hint: "Slide characters up when each line starts",
    twoCharOnly: true,
  },
  {
    key: "characterSlideInWhoosh",
    label: "Whoosh sound on slide-in",
    twoCharOnly: true,
  },
];

export function SaveTemplateDialog({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
  variant = "two-char",
}: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [includes, setIncludes] = useState<TemplateIncludeFlags>({
    ...DEFAULT_TEMPLATE_INCLUDES,
  });

  useEffect(() => {
    if (open) {
      setIncludes({ ...DEFAULT_TEMPLATE_INCLUDES });
      setName("");
      setDescription("");
    }
  }, [open]);

  const setFlag = (key: IncludeKey, checked: boolean) => {
    setIncludes((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    const payloadIncludes: TemplateIncludeFlags =
      variant === "story"
        ? {
            ...includes,
            ...Object.fromEntries(
              STORY_TEMPLATE_EXCLUDE_KEYS.map((k) => [k, false])
            ) as TemplateIncludeFlags,
          }
        : includes;

    try {
      await onSave(name.trim(), description.trim() || undefined, payloadIncludes);
      onOpenChange(false);
    } catch {
      // Error handling is done in onSave
    }
  };

  const visibleRows = ROWS.filter((row) => !row.twoCharOnly || variant === "two-char");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Name your template and choose which settings to include. Unchecked items stay unchanged
            when you load this template later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="template-name">Template name *</Label>
            <Input
              id="template-name"
              placeholder="e.g. Gaming style"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              placeholder="What is this template for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Include in template</p>
            <div className="grid gap-3">
              {visibleRows.map((row) => (
                <label
                  key={row.key}
                  className="flex cursor-pointer items-start gap-3 rounded-md hover:bg-muted/50 p-1 -m-1"
                >
                  <Checkbox
                    checked={includes[row.key]}
                    onCheckedChange={(v) => setFlag(row.key, v === true)}
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="text-sm font-medium leading-none">{row.label}</span>
                    {row.hint && (
                      <span className="block text-xs text-muted-foreground">{row.hint}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
            {isLoading ? "Saving…" : "Save template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
