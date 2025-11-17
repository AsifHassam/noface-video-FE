"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Scissors, RotateCcw, AlertCircle, Edit3, Code } from "lucide-react";
import type { SubtitleSegment } from "@/types";
import { msToTimestamp } from "@/lib/utils/time";
import { splitAllLongSubtitles, isSubtitleTooLong } from "@/lib/utils/subtitle-splitter";
import { serializeSrt, parseSrtText } from "@/lib/utils/srt";
import { VisualSubtitleEditor } from "./visual-subtitle-editor";
import { cn } from "@/lib/utils";

type SubtitlesEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  segments: SubtitleSegment[];
};

export const SubtitlesEditor = ({ value, onChange, onReset, segments }: SubtitlesEditorProps) => {
  const [editMode, setEditMode] = useState<"visual" | "raw">("visual");

  const handleAutoSplit = () => {
    if (segments.length === 0) return;
    
    // Warn user about audio sync
    const confirmed = window.confirm(
      "⚠️ Splitting subtitles will improve readability but may not perfectly match audio timing.\n\n" +
      "The audio is already recorded, so subtitles will appear sequentially during the same audio segment.\n\n" +
      "💡 TIP: You can always restore perfect audio sync by clicking 'Restore Audio Sync' button!\n\n" +
      "Continue with split?"
    );
    
    if (!confirmed) return;
    
    const splitSegments = splitAllLongSubtitles(segments);
    const newSrtText = serializeSrt(splitSegments);
    onChange(newSrtText);
  };

  const handleVisualChange = (newSegments: SubtitleSegment[]) => {
    const newSrtText = serializeSrt(newSegments);
    onChange(newSrtText);
  };

  const longSubtitlesCount = segments.filter(seg => isSubtitleTooLong(seg)).length;

  return (
    <div className="space-y-4 rounded-3xl border border-border/60 bg-white/80 p-5 shadow-inner">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">Subtitles</h3>
          <div className="flex items-center gap-2 mt-1">
            <Button
              variant={editMode === "visual" ? "default" : "ghost"}
              size="sm"
              className="h-7 rounded-lg px-3"
              onClick={() => setEditMode("visual")}
            >
              <Edit3 className="h-3.5 w-3.5 mr-1.5" />
              Visual
            </Button>
            <Button
              variant={editMode === "raw" ? "default" : "ghost"}
              size="sm"
              className="h-7 rounded-lg px-3"
              onClick={() => setEditMode("raw")}
            >
              <Code className="h-3.5 w-3.5 mr-1.5" />
              Raw
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          {longSubtitlesCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              className="rounded-2xl text-orange-600 border-orange-200 hover:bg-orange-50" 
              onClick={handleAutoSplit}
            >
              <Scissors className="h-4 w-4 mr-2" />
              Split Long ({longSubtitlesCount})
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-2xl bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800" 
            onClick={onReset}
            title="Restore original audio-synced subtitles from server"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restore Audio Sync
          </Button>
        </div>
      </div>
      {/* Editor Content */}
      {editMode === "visual" ? (
        <VisualSubtitleEditor
          segments={segments}
          onChange={handleVisualChange}
        />
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Format: <code className="text-xs">startMs,endMs,speaker,text</code>
            </p>
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="min-h-[300px] rounded-2xl border-border/60 bg-white text-xs font-mono shadow-inner"
              placeholder="0,2000,A,Hello there&#10;2000,4000,B,Hi back"
            />
          </div>
          <div className="rounded-2xl bg-muted/60 p-4 text-sm">
            <h4 className="font-medium text-foreground">Preview</h4>
            {longSubtitlesCount > 0 && (
              <div className="mt-2 mb-3 flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>{longSubtitlesCount} long subtitle{longSubtitlesCount > 1 ? 's' : ''}</strong> detected. 
                  Consider splitting for better readability (max 4 words recommended).
                </div>
              </div>
            )}
            <ul className="mt-2 space-y-1">
              {segments.length === 0 ? (
                <li className="text-muted-foreground">
                  No subtitles yet. Generate a preview to auto-create them.
                </li>
              ) : (
                segments.map((segment, index) => {
                  const wordCount = segment.text.split(/\s+/).filter(Boolean).length;
                  const isTooLong = isSubtitleTooLong(segment);
                  
                  return (
                    <li key={`${segment.speaker}-${index}`} className={isTooLong ? "text-orange-700" : ""}>
                      <span className="font-semibold text-primary">
                        {msToTimestamp(segment.startMs)} → {msToTimestamp(segment.endMs)} · {segment.speaker}
                      </span>{" "}
                      {segment.text}
                      {isTooLong && (
                        <span className="ml-2 text-xs text-orange-600 font-medium">
                          ({wordCount} words - too long!)
                        </span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
