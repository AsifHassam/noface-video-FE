"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { OverlayItem, RenderStatus, SubtitleSegment, SubtitleStyle, TextOverlay } from "@/types";
import { cn } from "@/lib/utils";
import { getSubtitleStyle, OUTLINED_STYLE } from "@/lib/data/subtitle-styles";

type VideoPreviewProps = {
  status: RenderStatus | null;
  previewUrl?: string | null;
  finalUrl?: string | null;
  overlays: OverlayItem[];
  textOverlays?: TextOverlay[];
  showOverlays: boolean;
  onToggleOverlays: (value: boolean) => void;
  subtitles: SubtitleSegment[];
  showSubtitles: boolean;
  onToggleSubtitles: (value: boolean) => void;
  subtitleStyle?: SubtitleStyle;
};

const OVERLAY_POSITION_CLASSES: Record<OverlayItem["position"], string> = {
  TOP_LEFT: "left-4 top-4",
  TOP_RIGHT: "right-4 top-4",
  BOTTOM_LEFT: "left-4 bottom-16",
  BOTTOM_RIGHT: "right-4 bottom-16",
};

/**
 * Subtitle renderer component that applies different TikTok-style subtitle designs
 */
const SubtitleRenderer = ({
  text,
  styleId,
}: {
  text: string;
  styleId: SubtitleStyle;
}) => {
  const style = getSubtitleStyle(styleId);
  const isOutlined = styleId === "outlined";

  return (
    <div className="absolute inset-x-4 bottom-4 flex justify-center">
      <div
        className={cn(
          "text-center",
          style.containerClassName || "rounded-2xl"
        )}
      >
        <p
          className={cn(style.className)}
          style={isOutlined ? OUTLINED_STYLE : undefined}
        >
          {text}
        </p>
      </div>
    </div>
  );
};

const TEXT_OVERLAY_STYLES: Record<string, string> = {
  // Classic TikTok styles
  classic: "font-black uppercase tracking-wide",
  typewriter: "font-mono font-medium",
  neon: "font-black uppercase tracking-wider animate-pulse",
  outlined: "font-black uppercase tracking-wide",
  modern: "font-bold tracking-tight",
  
  // Background styles
  bubble: "font-bold bg-white/95 text-black px-4 py-2 rounded-full shadow-lg",
  box: "font-bold bg-black/80 text-white px-4 py-2 shadow-xl border-2 border-white/30",
  highlight: "font-black bg-yellow-300 text-black px-3 py-1",
  
  // Effect styles
  shadow: "font-black uppercase tracking-wide",
  retro: "font-black uppercase tracking-widest",
  handwritten: "font-medium italic",
  glow: "font-black uppercase tracking-wide",
  bounce: "font-black uppercase tracking-wide animate-bounce",
  gradient: "font-black uppercase tracking-wide bg-clip-text text-transparent",
  "3d": "font-black uppercase tracking-wider",
  
  // Text decoration styles
  minimal: "font-medium tracking-normal",
  bold: "font-black",
  italic: "font-bold italic",
  underline: "font-bold underline decoration-4 underline-offset-2",
  stroke: "font-black uppercase tracking-wide",
  "double-outline": "font-black uppercase tracking-wider",
};

// Get custom inline styles for each text style
const getTextStyleConfig = (style: string, color: string): React.CSSProperties => {
  switch (style) {
    case "classic":
      return {
        textShadow: `3px 3px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000`,
        color: color,
      };
    case "outlined":
      return {
        textShadow: `-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000`,
        color: color,
      };
    case "double-outline":
      return {
        textShadow: `-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff`,
        color: color,
      };
    case "shadow":
      return {
        textShadow: `4px 4px 8px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.7)`,
        color: color,
      };
    case "neon":
      return {
        textShadow: `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}, 0 0 40px #ff00ff, 0 0 70px #ff00ff, 0 0 80px #ff00ff`,
        color: color,
      };
    case "glow":
      return {
        textShadow: `0 0 20px ${color}, 0 0 30px ${color}, 0 0 40px ${color}, 0 0 50px ${color}`,
        color: color,
      };
    case "3d":
      return {
        textShadow: `1px 1px 0 #999, 2px 2px 0 #888, 3px 3px 0 #777, 4px 4px 0 #666, 5px 5px 0 #555, 6px 6px 0 #444, 7px 7px 10px rgba(0,0,0,0.6)`,
        color: color,
      };
    case "retro":
      return {
        textShadow: `3px 3px 0 #ff00ff, 6px 6px 0 #00ffff`,
        color: color,
      };
    case "stroke":
      return {
        WebkitTextStroke: `2px #000`,
        color: color,
      };
    case "gradient":
      return {
        backgroundImage: `linear-gradient(45deg, ${color}, #ff00ff, #00ffff)`,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
      };
    default:
      return { color: color };
  }
};

export const VideoPreview = ({
  status,
  previewUrl,
  finalUrl,
  overlays,
  textOverlays = [],
  showOverlays,
  onToggleOverlays,
  subtitles,
  showSubtitles,
  onToggleSubtitles,
  subtitleStyle = "classic",
}: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentMs, setCurrentMs] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCurrentMs(0);
      const video = videoRef.current;
      if (video) {
        video.currentTime = 0;
        video.pause();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [previewUrl, finalUrl]);

  const activeSubtitle = useMemo(() => {
    if (!showSubtitles) return null;
    return subtitles.find(
      (segment) => currentMs >= segment.startMs && currentMs <= segment.endMs,
    );
  }, [currentMs, showSubtitles, subtitles]);

  const activeOverlays = useMemo(() => {
    if (!showOverlays) return [];
    return overlays.filter(
      (overlay) => currentMs >= overlay.startMs && currentMs <= overlay.endMs,
    );
  }, [currentMs, overlays, showOverlays]);

  const activeTextOverlays = useMemo(() => {
    return textOverlays.filter(
      (overlay) => currentMs >= overlay.startMs && currentMs <= overlay.endMs,
    );
  }, [currentMs, textOverlays]);

  const mediaSrc = finalUrl ?? previewUrl;

  return (
    <div className="space-y-4 rounded-3xl border border-border/60 bg-black/90 p-5 shadow-xl">
      {/* Vertical video container for TikTok/Reels format (9:16) */}
      <div className="relative mx-auto aspect-[9/16] w-full max-w-md overflow-hidden rounded-2xl bg-black">
        {mediaSrc && status === "READY" ? (
          <>
            <video
              key={mediaSrc}
              ref={videoRef}
              className="h-full w-full object-cover"
              controls
              onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
              poster="/thumbs/default.svg"
            >
              <source src={mediaSrc} type="video/mp4" />
            </video>
            {activeOverlays.map((overlay) => (
              <Image
                key={overlay.id}
                src={overlay.fileUrl}
                alt="Overlay"
                width={160}
                height={160}
                unoptimized
                className={cn(
                  "absolute max-h-32 max-w-[30%] rounded-2xl bg-white/10 object-contain shadow-lg shadow-black/50",
                  OVERLAY_POSITION_CLASSES[overlay.position],
                )}
              />
            ))}
            {/* Render text overlays */}
            {activeTextOverlays.map((textOverlay) => (
              <div
                key={textOverlay.id}
                className="absolute"
                style={{
                  left: `${textOverlay.x}%`,
                  top: `${textOverlay.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: "95%",
                  maxWidth: "95%",
                  fontSize: `${textOverlay.fontSize}px`,
                  rotate: textOverlay.rotation ? `${textOverlay.rotation}deg` : undefined,
                }}
              >
                <p
                  className={cn(TEXT_OVERLAY_STYLES[textOverlay.style] || TEXT_OVERLAY_STYLES.classic, "break-words text-center w-full")}
                  style={{
                    ...getTextStyleConfig(textOverlay.style, textOverlay.color),
                    textAlign: 'center',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {textOverlay.text}
                </p>
              </div>
            ))}

            {activeSubtitle ? (
              <SubtitleRenderer
                text={activeSubtitle.text}
                styleId={subtitleStyle}
              />
            ) : null}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted-foreground/40 text-center text-sm text-muted-foreground">
            {status === "RENDERING"
              ? "Rendering preview…"
              : status === "QUEUED"
                ? "Queued for rendering"
                : "Generate a preview to see it here."}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/10 p-4 text-white">
        <div className="flex items-center gap-3">
          <Switch id="toggle-subtitles" checked={showSubtitles} onCheckedChange={onToggleSubtitles} />
          <Label htmlFor="toggle-subtitles" className="text-sm">
            Subtitles
          </Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="toggle-overlays" checked={showOverlays} onCheckedChange={onToggleOverlays} />
          <Label htmlFor="toggle-overlays" className="text-sm">
            Preview overlays
          </Label>
        </div>
        <div className="text-xs text-white/70">
          {status === "READY"
            ? "Preview ready · TikTok/Reels 1080×1920"
            : status === "RENDERING"
              ? "Rendering TikTok/Reels video…"
              : status === "QUEUED"
                ? "Queued for rendering"
                : "No preview yet"}
        </div>
      </div>
    </div>
  );
};
