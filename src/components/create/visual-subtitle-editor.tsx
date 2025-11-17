"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, Clock, User, AlertCircle } from "lucide-react";
import type { SubtitleSegment } from "@/types";
import { msToTimestamp, timestampToMs } from "@/lib/utils/time";
import { isSubtitleTooLong } from "@/lib/utils/subtitle-splitter";
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

  const handleAddSegment = () => {
    const lastSegment = segments[segments.length - 1];
    const startMs = lastSegment ? lastSegment.endMs : 0;
    const newSegment: SubtitleSegment = {
      startMs,
      endMs: startMs + 2000,
      speaker: "A",
      text: "New subtitle",
    };
    onChange([...segments, newSegment]);
    setEditingIndex(segments.length);
  };

  const handleRemoveSegment = (index: number) => {
    const newSegments = segments.filter((_, i) => i !== index);
    onChange(newSegments);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleDuplicate = (index: number) => {
    const segment = segments[index];
    const duration = segment.endMs - segment.startMs;
    const newSegment: SubtitleSegment = {
      ...segment,
      startMs: segment.endMs,
      endMs: segment.endMs + duration,
    };
    const newSegments = [...segments];
    newSegments.splice(index + 1, 0, newSegment);
    onChange(newSegments);
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
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Visual Subtitle Editor</Label>
        <Button
          variant="outline"
          size="sm"
          className="rounded-2xl"
          onClick={handleAddSegment}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Subtitle
        </Button>
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
        {segments.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/60 bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No subtitles yet. Click "Add Subtitle" or generate a preview.
            </p>
          </div>
        ) : (
          segments.map((segment, index) => {
            const wordCount = segment.text.split(/\s+/).filter(Boolean).length;
            const isTooLong = isSubtitleTooLong(segment);
            const isEditing = editingIndex === index;

            return (
              <div
                key={index}
                className={cn(
                  "rounded-2xl border-2 bg-white p-4 transition-all",
                  isTooLong && "border-orange-200 bg-orange-50/30",
                  !isTooLong && "border-border/60",
                  isEditing && "ring-2 ring-primary/50"
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Drag Handle */}
                  <div className="mt-2 cursor-move text-muted-foreground hover:text-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-3">
                    {/* Header: Number + Time + Speaker */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs">
                          {index + 1}
                        </span>
                      </div>

                      {/* Start Time */}
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          type="text"
                          value={msToTimestamp(segment.startMs)}
                          onChange={(e) => handleTimeChange(index, 'startMs', e.target.value)}
                          className="h-7 w-24 rounded-lg border-border/60 text-xs"
                          placeholder="00:00.000"
                        />
                      </div>

                      <span className="text-xs text-muted-foreground">→</span>

                      {/* End Time */}
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="text"
                          value={msToTimestamp(segment.endMs)}
                          onChange={(e) => handleTimeChange(index, 'endMs', e.target.value)}
                          className="h-7 w-24 rounded-lg border-border/60 text-xs"
                          placeholder="00:00.000"
                        />
                      </div>

                      {/* Speaker */}
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          value={segment.speaker}
                          onChange={(e) =>
                            handleUpdateSegment(index, {
                              speaker: e.target.value as "A" | "B",
                            })
                          }
                          className="h-7 w-16 rounded-lg border border-border/60 bg-white text-xs"
                        >
                          <option value="A">A</option>
                          <option value="B">B</option>
                        </select>
                      </div>

                      {/* Word Count Warning */}
                      {isTooLong && (
                        <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {wordCount} words
                        </div>
                      )}
                    </div>

                    {/* Text Editor */}
                    <Textarea
                      value={segment.text}
                      onChange={(e) =>
                        handleUpdateSegment(index, { text: e.target.value })
                      }
                      onFocus={() => setEditingIndex(index)}
                      onClick={() => setEditingIndex(index)}
                      className="min-h-[60px] rounded-lg border-border/60 text-sm resize-none"
                      placeholder="Enter subtitle text..."
                    />

                    {/* Duration Display */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        Duration: {((segment.endMs - segment.startMs) / 1000).toFixed(2)}s
                      </span>
                      {isTooLong && (
                        <span className="text-orange-600">
                          Consider splitting into {Math.ceil(wordCount / 4)} parts
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => handleDuplicate(index)}
                      title="Duplicate"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveSegment(index)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
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
            <span>
              Long subtitles: {segments.filter(seg => isSubtitleTooLong(seg)).length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

