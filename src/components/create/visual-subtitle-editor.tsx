"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, GripVertical, Clock } from "lucide-react";
import type { SubtitleSegment } from "@/types";
import { msToTimestamp, timestampToMs } from "@/lib/utils/time";
import { cn } from "@/lib/utils";

type VisualSubtitleEditorProps = {
  segments: SubtitleSegment[];
  onChange: (segments: SubtitleSegment[]) => void;
};

export const VisualSubtitleEditor = ({
  segments,
  onChange,
}: VisualSubtitleEditorProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside to deselect
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setEditingIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUpdateSegment = (index: number, updates: Partial<SubtitleSegment>) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], ...updates };
    onChange(newSegments);
  };

  const handleRemoveSegment = (index: number) => {
    const newSegments = segments.filter((_, i) => i !== index);
    onChange(newSegments);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleTimeChange = (index: number, field: 'startMs' | 'endMs', value: string) => {
    try {
      const ms = timestampToMs(value);
      handleUpdateSegment(index, { [field]: ms });
    } catch (error) {
      // Invalid timestamp, ignore
    }
  };

  return (
    <div className="flex flex-col h-full space-y-2" ref={containerRef}>

      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 min-h-0">
        {segments.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/60 bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              No subtitles yet. Generate a preview to create them.
            </p>
          </div>
        ) : (
          segments.map((segment, index) => {
            const isEditing = editingIndex === index;

            return (
              <div
                key={index}
                className={cn(
                  "rounded-xl border-2 bg-white p-2 transition-all",
                  "border-border/60",
                  isEditing && "ring-2 ring-primary/50"
                )}
              >
                <div className="flex items-start gap-2">
                  {/* Drag Handle */}
                  <div className="mt-1 cursor-move text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    {/* Header: Number + Time */}
                    <div className="flex items-center gap-1.5 flex-nowrap">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary flex-shrink-0">
                        {index + 1}
                      </span>
                      <Clock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                      <Input
                        type="text"
                        value={msToTimestamp(segment.startMs)}
                        onChange={(e) => handleTimeChange(index, 'startMs', e.target.value)}
                        className="h-5 w-16 rounded border-border/60 text-[10px] px-1.5 py-0.5"
                        placeholder="00:00"
                      />
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">→</span>
                      <Input
                        type="text"
                        value={msToTimestamp(segment.endMs)}
                        onChange={(e) => handleTimeChange(index, 'endMs', e.target.value)}
                        className="h-5 w-16 rounded border-border/60 text-[10px] px-1.5 py-0.5"
                        placeholder="00:00"
                      />
                    </div>

                    {/* Text Editor */}
                    <Textarea
                      value={segment.text}
                      onChange={(e) =>
                        handleUpdateSegment(index, { text: e.target.value })
                      }
                      onFocus={() => setEditingIndex(index)}
                      onClick={() => setEditingIndex(index)}
                      className="min-h-[40px] max-h-[60px] rounded-lg border-border/60 text-[11px] resize-none leading-tight"
                      placeholder="Enter subtitle text..."
                    />

                    {/* Duration Display */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Duration: {((segment.endMs - segment.startMs) / 1000).toFixed(2)}s
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveSegment(index)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Stats */}
      {segments.length > 0 && (
        <div className="rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Total subtitles: {segments.length}</span>
            <span>
              Total duration:{" "}
              {segments.length > 0
                ? ((segments[segments.length - 1].endMs - segments[0].startMs) / 1000).toFixed(2)
                : "0.00"}
              s
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

