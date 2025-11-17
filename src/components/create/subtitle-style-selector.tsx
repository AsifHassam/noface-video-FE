"use client";

import { useState } from "react";
import { Check, Type } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SubtitleStyle } from "@/types";
import { SUBTITLE_STYLES } from "@/lib/data/subtitle-styles";
import { cn } from "@/lib/utils";

type SubtitleStyleSelectorProps = {
  value: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  // Karaoke single-line toggle
  singleLine?: boolean;
  onSingleLineChange?: (value: boolean) => void;
  // Single-line mode variant: single word vs 3-word chunk
  singleWord?: boolean;
  onSingleWordChange?: (value: boolean) => void;
};

export const SubtitleStyleSelector = ({
  value,
  onChange,
  fontSize = 100,
  onFontSizeChange,
  singleLine = false,
  onSingleLineChange,
  singleWord = false,
  onSingleWordChange,
}: SubtitleStyleSelectorProps) => {
  const [open, setOpen] = useState(false);
  const selectedStyle = SUBTITLE_STYLES.find((s) => s.id === value) || SUBTITLE_STYLES[0];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Subtitle Style</Label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 rounded-2xl"
          >
            <span className="text-lg">{selectedStyle.icon}</span>
            <span className="flex-1 text-left">{selectedStyle.name}</span>
            <span className="text-xs text-muted-foreground">Change</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Choose Subtitle Style</DialogTitle>
            <DialogDescription>
              Pick a style for your subtitles. TikTok-inspired designs to make your videos pop!
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 overflow-y-auto pr-2 max-h-[calc(85vh-120px)]">
            {SUBTITLE_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  onChange(style.id);
                  setOpen(false);
                }}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-2xl border-2 bg-muted/30 p-4 text-left transition hover:bg-muted/50",
                  value === style.id
                    ? "border-primary bg-primary/10"
                    : "border-border"
                )}
              >
                {value === style.id && (
                  <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{style.icon}</span>
                  <span className="font-semibold">{style.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {style.description}
                </p>
                {/* Preview */}
                <div className="mt-2 flex min-h-[60px] items-center justify-center rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 p-3">
                  <div
                    className={cn(
                      "text-center",
                      style.containerClassName || "rounded-2xl"
                    )}
                  >
                    <p
                      className={cn(style.className, "text-sm md:text-base")}
                      style={
                        style.id === "outlined"
                          ? {
                              textShadow: `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000`,
                            }
                          : undefined
                      }
                    >
                      Sample Text
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Font Size Control */}
      {onFontSizeChange && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Type className="h-4 w-4" />
              Font Size
            </Label>
            <span className="text-sm text-muted-foreground">{fontSize}%</span>
          </div>
          <Slider
            min={50}
            max={200}
            step={5}
            value={[fontSize]}
            onValueChange={([val]) => onFontSizeChange(val)}
            className="w-full"
          />
        </div>
      )}

      {/* Single-line Toggle (applies to all styles) */}
      {onSingleLineChange && (
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!!singleLine}
              onChange={(e) => onSingleLineChange(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Single-line subtitles (show only current word)</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Keeps the screen clean by showing one word at a time, synced to audio.
          </p>
        </div>
      )}

      {/* Single-line variant controls */}
      {singleLine && onSingleWordChange && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Single-line Variant</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="singleline-variant"
                checked={!!singleWord}
                onChange={() => onSingleWordChange(true)}
              />
              <span>Single word</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="singleline-variant"
                checked={!singleWord}
                onChange={() => onSingleWordChange(false)}
              />
              <span>3-word chunks</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose whether to show a single word or a moving 3-word chunk.
          </p>
        </div>
      )}
    </div>
  );
};

