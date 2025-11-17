"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { v4 as uuid } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { OverlayItem, OverlayPosition } from "@/types";
import { cn } from "@/lib/utils";
import { Trash2, UploadCloud } from "lucide-react";

type OverlayUploaderProps = {
  overlays: OverlayItem[];
  onAdd: (overlay: OverlayItem) => void;
  onRemove: (id: string) => void;
};

const POSITIONS: { label: string; value: OverlayPosition }[] = [
  { label: "Top left", value: "TOP_LEFT" },
  { label: "Top right", value: "TOP_RIGHT" },
  { label: "Bottom left", value: "BOTTOM_LEFT" },
  { label: "Bottom right", value: "BOTTOM_RIGHT" },
];

export const OverlayUploader = ({ overlays, onAdd, onRemove }: OverlayUploaderProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<OverlayPosition>("TOP_RIGHT");
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(1500);
  const [error, setError] = useState<string | null>(null);

  const canAddMore = overlays.length < 3;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a PNG or JPG image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAdd = () => {
    if (!previewUrl) {
      setError("Upload an image first.");
      return;
    }
    if (startMs >= endMs) {
      setError("End time must be after start time.");
      return;
    }
    onAdd({
      id: uuid(),
      fileUrl: previewUrl,
      position: selectedPosition,
      startMs,
      endMs,
    });
    setPreviewUrl(null);
    setStartMs(0);
    setEndMs(1500);
    setError(null);
  };

  const sortedOverlays = useMemo(
    () => overlays.slice().sort((a, b) => a.startMs - b.startMs),
    [overlays],
  );

  return (
    <div className="space-y-4 rounded-3xl border border-border/60 bg-white/80 p-5 shadow-inner">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Overlay images</h3>
          <p className="text-sm text-muted-foreground">Up to three overlays. They render locally only.</p>
        </div>
        <Button variant="outline" className="rounded-2xl" disabled={!canAddMore || !previewUrl} onClick={handleAdd}>
          Add overlay
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-dashed border-border/60 bg-muted/40 p-4 text-center">
          <Label
            htmlFor="overlay-upload"
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-border/30 bg-white/80 p-6 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary",
              !canAddMore && "pointer-events-none opacity-60",
            )}
          >
            <UploadCloud className="h-6 w-6" />
            <span>{previewUrl ? "Change image" : "Upload image"}</span>
          </Label>
          <Input
            id="overlay-upload"
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileChange}
            disabled={!canAddMore}
          />
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Overlay preview"
              width={200}
              height={200}
              unoptimized
              className="mx-auto h-32 w-auto rounded-2xl object-contain"
            />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className="space-y-3 rounded-2xl border border-border/60 bg-white p-4">
          <div className="space-y-2">
            <Label>Position</Label>
            <Select value={selectedPosition} onValueChange={(value: OverlayPosition) => setSelectedPosition(value)}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {POSITIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="overlay-start">Start (ms)</Label>
              <Input
                id="overlay-start"
                type="number"
                min={0}
                value={startMs}
                onChange={(event) => setStartMs(Number(event.target.value))}
                className="rounded-2xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overlay-end">End (ms)</Label>
              <Input
                id="overlay-end"
                type="number"
                min={0}
                value={endMs}
                onChange={(event) => setEndMs(Number(event.target.value))}
                className="rounded-2xl"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Overlays fade in/out instantly for now. Timing is based on preview playback.
          </p>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Active overlays ({overlays.length}/3)</h4>
        {sortedOverlays.length === 0 ? (
          <p className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            No overlays yet. Upload an image to add one.
          </p>
        ) : (
          <div className="grid gap-3">
            {sortedOverlays.map((overlay) => (
              <div key={overlay.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white p-3">
                <Image
                  src={overlay.fileUrl}
                  alt="Overlay preview"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <div className="flex-1 text-sm">
                  <div className="font-semibold text-foreground">
                    {POSITIONS.find((p) => p.value === overlay.position)?.label}
                  </div>
                  <div className="text-muted-foreground">
                    {overlay.startMs}ms → {overlay.endMs}ms
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full text-destructive"
                  onClick={() => onRemove(overlay.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
