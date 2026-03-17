"use client";

import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2 } from "lucide-react";
import type { SubtitleSegment } from "@/types";
import { serializeSrt } from "@/lib/utils/srt";
import { VisualSubtitleEditor } from "./visual-subtitle-editor";

type SubtitlesEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onReset: () => void;
  segments: SubtitleSegment[];
};

export const SubtitlesEditor = ({ value, onChange, onReset, segments }: SubtitlesEditorProps) => {
  const handleVisualChange = (newSegments: SubtitleSegment[]) => {
    const newSrtText = serializeSrt(newSegments);
    onChange(newSrtText);
  };

  const handleDeleteAll = () => {
    handleVisualChange([]);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-sm">Subtitles</h3>
        <div className="flex items-center gap-2">
          {segments.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-lg text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 text-xs px-3"
              onClick={handleDeleteAll}
              title="Remove all subtitles"
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Delete all
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 rounded-lg bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800 text-xs px-3" 
            onClick={onReset}
            title="Restore original audio-synced subtitles from server"
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Restore
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <VisualSubtitleEditor
          segments={segments}
          onChange={handleVisualChange}
        />
      </div>
    </div>
  );
};
