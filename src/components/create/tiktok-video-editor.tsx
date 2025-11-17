"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause, Plus, Trash2, Type, Palette, Image as ImageIcon, Crop, Move, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { TextOverlay, TextOverlayStyle, RenderStatus, SubtitleSegment, SubtitleStyle, SubtitlePosition, ImageOverlay } from "@/types";
import { cn } from "@/lib/utils";
import { v4 as uuid } from "uuid";
import { getSubtitleStyle, OUTLINED_STYLE, STYLE_3D_POP, STYLE_STROKE_THICK } from "@/lib/data/subtitle-styles";
import Image from "next/image";

type TikTokVideoEditorProps = {
  videoUrl?: string | null;
  status: RenderStatus | null;
  durationMs: number;
  textOverlays: TextOverlay[];
  onTextOverlaysChange: (overlays: TextOverlay[]) => void;
  imageOverlays?: ImageOverlay[];
  onImageOverlaysChange?: (overlays: ImageOverlay[]) => void;
  subtitles?: SubtitleSegment[];
  showSubtitles?: boolean;
  subtitleStyle?: SubtitleStyle;
  subtitlePosition?: SubtitlePosition;
  onSubtitlePositionChange?: (position: SubtitlePosition) => void;
  subtitleFontSize?: number;
  onSubtitleFontSizeChange?: (size: number) => void;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  // Single-line preview controls
  subtitleSingleLine?: boolean;
  subtitleSingleWord?: boolean;
};

const TEXT_OVERLAY_STYLES: Record<TextOverlayStyle, string> = {
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

const COLOR_PRESETS = [
  { name: "White", value: "#FFFFFF" },
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Yellow", value: "#F59E0B" },
  { name: "Pink", value: "#EC4899" },
  { name: "Purple", value: "#A855F7" },
  { name: "Orange", value: "#F97316" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Lime", value: "#84CC16" },
  { name: "Indigo", value: "#6366F1" },
];

// Get custom inline styles for each text style
const getTextStyleConfig = (style: TextOverlayStyle, color: string): React.CSSProperties => {
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

export const TikTokVideoEditor = ({
  videoUrl,
  status,
  durationMs,
  textOverlays,
  onTextOverlaysChange,
  imageOverlays = [],
  onImageOverlaysChange,
  subtitles = [],
  showSubtitles = true,
  subtitleStyle = "classic",
  subtitlePosition = { x: 50, y: 85 },
  onSubtitlePositionChange,
  subtitleFontSize = 100,
  onSubtitleFontSizeChange,
  playbackRate: externalPlaybackRate,
  onPlaybackRateChange,
  subtitleSingleLine = false,
  subtitleSingleWord = false,
}: TikTokVideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [actualDurationMs, setActualDurationMs] = useState(durationMs || 0);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [selectedImageOverlayId, setSelectedImageOverlayId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverlayId, setDragOverlayId] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragImageOverlayId, setDragImageOverlayId] = useState<string | null>(null);
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddImageDialog, setShowAddImageDialog] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(externalPlaybackRate ?? 1);

  // Update actualDurationMs when durationMs prop changes
  useEffect(() => {
    if (durationMs > 0) {
      console.log("📏 Duration prop changed:", durationMs);
      setActualDurationMs(durationMs);
    }
  }, [durationMs]);

  // New overlay form state
  const [newText, setNewText] = useState("");
  const [newStyle, setNewStyle] = useState<TextOverlayStyle>("classic");
  const [newColor, setNewColor] = useState("#FFFFFF");
  const [newSize, setNewSize] = useState(48);

  // New image overlay form state
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isCropping, setIsCropping] = useState(false);

  const selectedOverlay = useMemo(
    () => textOverlays.find((o) => o.id === selectedOverlayId),
    [textOverlays, selectedOverlayId]
  );

  const selectedImageOverlay = useMemo(
    () => imageOverlays.find((o) => o.id === selectedImageOverlayId),
    [imageOverlays, selectedImageOverlayId]
  );

  const activeOverlays = useMemo(
    () =>
      textOverlays.filter(
        (overlay) => currentTimeMs >= overlay.startMs && currentTimeMs <= overlay.endMs
      ),
    [textOverlays, currentTimeMs]
  );

  const activeImageOverlays = useMemo(
    () =>
      imageOverlays.filter(
        (overlay) => currentTimeMs >= overlay.startMs && currentTimeMs <= overlay.endMs
      ),
    [imageOverlays, currentTimeMs]
  );

  const activeSubtitle = useMemo(() => {
    if (!showSubtitles) return null;
    return subtitles.find(
      (segment) => currentTimeMs >= segment.startMs && currentTimeMs <= segment.endMs
    );
  }, [currentTimeMs, showSubtitles, subtitles]);

  // Sync video time and get actual duration
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      console.log("⚠️ Video ref not available");
      return;
    }

    const handleTimeUpdate = () => {
      setCurrentTimeMs(video.currentTime * 1000);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    const handleLoadedMetadata = () => {
      // Get actual duration from video element
      const actualDuration = video.duration * 1000;
      console.log("📹 Video metadata loaded, duration:", actualDuration);
      if (!isNaN(actualDuration) && actualDuration > 0) {
        setActualDurationMs(actualDuration);
        console.log("✅ Updated actualDurationMs to:", actualDuration);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    
    // Check if metadata is already loaded
    if (video.duration && !isNaN(video.duration)) {
      const existingDuration = video.duration * 1000;
      console.log("📹 Video metadata already loaded:", existingDuration);
      setActualDurationMs(existingDuration);
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [videoUrl]); // Re-run when video URL changes

  // Sync external playback rate
  useEffect(() => {
    if (externalPlaybackRate !== undefined && externalPlaybackRate !== playbackRate) {
      setPlaybackRate(externalPlaybackRate);
    }
  }, [externalPlaybackRate, playbackRate]);

  // Apply playback rate to video
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Helper function to update playback rate and notify parent
  const updatePlaybackRate = (newRate: number) => {
    setPlaybackRate(newRate);
    if (onPlaybackRateChange) {
      onPlaybackRateChange(newRate);
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTimeMs = percentage * actualDurationMs;

    console.log("⏱️ Timeline clicked:", {
      actualDurationMs,
      percentage: percentage.toFixed(2),
      newTimeMs: newTimeMs.toFixed(0),
    });

    if (videoRef.current) {
      videoRef.current.currentTime = newTimeMs / 1000;
      setCurrentTimeMs(newTimeMs);
    }
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;

    const overlay: TextOverlay = {
      id: uuid(),
      text: newText,
      startMs: Math.max(0, currentTimeMs - 500),
      endMs: Math.min(actualDurationMs, currentTimeMs + 2500),
      x: 50,
      y: 30,
      fontSize: newSize,
      color: newColor,
      style: newStyle,
    };

    onTextOverlaysChange([...textOverlays, overlay]);
    setNewText("");
    setShowAddDialog(false);
    setSelectedOverlayId(overlay.id);
  };

  const updateOverlay = (id: string, updates: Partial<TextOverlay>) => {
    console.log("✏️ Updating overlay:", id, updates);
    onTextOverlaysChange(
      textOverlays.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  };

  const deleteOverlay = (id: string) => {
    onTextOverlaysChange(textOverlays.filter((overlay) => overlay.id !== id));
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return;
    }
    setNewImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setNewImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const cropImage = (imageUrl: string, crop: { x: number; y: number; width: number; height: number }): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imageUrl);
          return;
        }
        
        const scaleX = img.width / 100;
        const scaleY = img.height / 100;
        const cropX = crop.x * scaleX;
        const cropY = crop.y * scaleY;
        const cropWidth = crop.width * scaleX;
        const cropHeight = crop.height * scaleY;
        
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        resolve(canvas.toDataURL());
      };
      img.src = imageUrl;
    });
  };

  const addImageOverlay = async () => {
    if (!newImagePreview || !onImageOverlaysChange) return;

    let finalImageUrl = newImagePreview;
    
    // Apply crop if cropping was enabled
    if (isCropping && cropArea.width < 100 && cropArea.height < 100) {
      finalImageUrl = await cropImage(newImagePreview, cropArea);
    }

    const overlay: ImageOverlay = {
      id: uuid(),
      imageUrl: finalImageUrl,
      startMs: Math.max(0, currentTimeMs - 500),
      endMs: Math.min(actualDurationMs, currentTimeMs + 2500),
      x: 50,
      y: 30,
      width: 30,
      height: 30,
      opacity: 1,
      cropData: isCropping ? cropArea : undefined,
    };

    onImageOverlaysChange([...imageOverlays, overlay]);
    setNewImageFile(null);
    setNewImagePreview(null);
    setCropArea({ x: 0, y: 0, width: 100, height: 100 });
    setIsCropping(false);
    setShowAddImageDialog(false);
    setSelectedImageOverlayId(overlay.id);
  };

  const updateImageOverlay = (id: string, updates: Partial<ImageOverlay>) => {
    if (!onImageOverlaysChange) return;
    onImageOverlaysChange(
      imageOverlays.map((overlay) =>
        overlay.id === id ? { ...overlay, ...updates } : overlay
      )
    );
  };

  const deleteImageOverlay = (id: string) => {
    if (!onImageOverlaysChange) return;
    onImageOverlaysChange(imageOverlays.filter((overlay) => overlay.id !== id));
    if (selectedImageOverlayId === id) {
      setSelectedImageOverlayId(null);
    }
  };

  const handleVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't handle clicks during dragging
    if (isDragging || isDraggingSubtitle || isDraggingImage) return;
    
    // Check if click target is an overlay or subtitle (has data attribute or specific class)
    const target = e.target as HTMLElement;
    if (target.closest('[data-overlay-element]') || target.closest('[data-subtitle-element]') || target.closest('[data-image-overlay-element]')) {
      return;
    }

    // Clicked on empty video area - deselect any selected overlay
    if (selectedOverlayId) {
      setSelectedOverlayId(null);
    }
    if (selectedImageOverlayId) {
      setSelectedImageOverlayId(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, overlayId: string) => {
    e.stopPropagation();
    e.preventDefault();
    // Ensure subtitle and image dragging is off when starting text overlay drag
    setIsDraggingSubtitle(false);
    setIsDraggingImage(false);
    setDragImageOverlayId(null);
    setIsDragging(true);
    setDragOverlayId(overlayId);
    setSelectedOverlayId(overlayId);
  };

  const handleImageMouseDown = (e: React.MouseEvent<HTMLDivElement>, overlayId: string) => {
    e.stopPropagation();
    e.preventDefault();
    // Ensure subtitle and text dragging is off when starting image overlay drag
    setIsDraggingSubtitle(false);
    setIsDragging(false);
    setDragOverlayId(null);
    setIsDraggingImage(true);
    setDragImageOverlayId(overlayId);
    setSelectedImageOverlayId(overlayId);
  };

  const handleSubtitleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    // Ensure overlay dragging is off when starting subtitle drag
    setIsDragging(false);
    setDragOverlayId(null);
    setIsDraggingSubtitle(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    // Only handle one type of dragging at a time
    if (!isDragging && !isDraggingSubtitle && !isDraggingImage) return;

    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp values to keep content within bounds (0-100%)
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    // Handle text overlay dragging
    if (isDragging && dragOverlayId && !isDraggingSubtitle && !isDraggingImage) {
      updateOverlay(dragOverlayId, { x, y });
      return;
    }

    // Handle image overlay dragging
    if (isDraggingImage && dragImageOverlayId && !isDragging && !isDraggingSubtitle) {
      updateImageOverlay(dragImageOverlayId, { x, y });
      return;
    }

    // Handle subtitle dragging
    if (isDraggingSubtitle && !isDragging && !isDraggingImage && onSubtitlePositionChange) {
      onSubtitlePositionChange({ x, y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragOverlayId(null);
    setIsDraggingImage(false);
    setDragImageOverlayId(null);
    setIsDraggingSubtitle(false);
  };

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragOverlayId(null);
      setIsDraggingImage(false);
      setDragImageOverlayId(null);
      setIsDraggingSubtitle(false);
    };

    if (isDragging || isDraggingSubtitle || isDraggingImage) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, isDraggingSubtitle, isDraggingImage]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Show video if we have a URL, even if status is not READY (e.g., DRAFT)
  // Only show placeholder if there's no video URL
  if (!videoUrl) {
    return (
      <div className="rounded-3xl border border-border/40 bg-muted/20 p-8 text-center">
        <Type className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          Generate a video preview to use the TikTok-style editor
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden rounded-3xl border border-border/40 bg-white/70 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">TikTok-Style Editor 🎬</h3>
        <div className="flex gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 rounded-2xl">
                <Type className="h-4 w-4" />
                Add Text
              </Button>
            </DialogTrigger>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Add Text Overlay</DialogTitle>
              <DialogDescription>
                Add text that appears at the current time ({formatTime(currentTimeMs)})
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Text</Label>
                <Input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Enter your text..."
                  className="rounded-2xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Style</Label>
                  <Select value={newStyle} onValueChange={(v) => setNewStyle(v as TextOverlayStyle)}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Classic TikTok</div>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="typewriter">Typewriter</SelectItem>
                      <SelectItem value="modern">Modern</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Effects</div>
                      <SelectItem value="neon">Neon Glow</SelectItem>
                      <SelectItem value="glow">Soft Glow</SelectItem>
                      <SelectItem value="shadow">Drop Shadow</SelectItem>
                      <SelectItem value="3d">3D Effect</SelectItem>
                      <SelectItem value="retro">Retro</SelectItem>
                      <SelectItem value="bounce">Bounce</SelectItem>
                      <SelectItem value="gradient">Gradient</SelectItem>
                      
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Outlines</div>
                      <SelectItem value="outlined">Outlined</SelectItem>
                      <SelectItem value="stroke">Stroke</SelectItem>
                      <SelectItem value="double-outline">Double Outline</SelectItem>
                      
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Backgrounds</div>
                      <SelectItem value="bubble">Bubble</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                      <SelectItem value="highlight">Highlight</SelectItem>
                      
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">Text Decoration</div>
                      <SelectItem value="bold">Bold</SelectItem>
                      <SelectItem value="italic">Italic</SelectItem>
                      <SelectItem value="underline">Underline</SelectItem>
                      <SelectItem value="handwritten">Handwritten</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Color</Label>
                  <Select value={newColor} onValueChange={setNewColor}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_PRESETS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded border"
                              style={{ backgroundColor: color.value }}
                            />
                            {color.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Size: {newSize}px</Label>
                <div className="pr-2">
                  <Slider
                    value={[newSize]}
                    onValueChange={([v]) => setNewSize(v)}
                    min={24}
                    max={96}
                    step={2}
                    className="w-full"
                  />
                </div>
              </div>
              <Button onClick={addTextOverlay} className="w-full rounded-2xl">
                Add Text
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {onImageOverlaysChange && (
          <Dialog open={showAddImageDialog} onOpenChange={setShowAddImageDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 rounded-2xl">
                <ImageIcon className="h-4 w-4" />
                Add Image
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Image Overlay</DialogTitle>
                <DialogDescription>
                  Add an image overlay that appears at the current time ({formatTime(currentTimeMs)})
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Upload Image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="rounded-2xl"
                  />
                </div>
                {newImagePreview && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Enable Cropping</Label>
                        <input
                          type="checkbox"
                          checked={isCropping}
                          onChange={(e) => setIsCropping(e.target.checked)}
                          className="rounded"
                        />
                      </div>
                      {isCropping && (
                        <div className="space-y-2 p-4 border rounded-2xl bg-muted/20">
                          <Label className="text-xs">Crop Area (percentage)</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">X: {cropArea.x.toFixed(0)}%</Label>
                              <Slider
                                value={[cropArea.x]}
                                onValueChange={([v]) => setCropArea({ ...cropArea, x: v })}
                                min={0}
                                max={100 - cropArea.width}
                                step={1}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Y: {cropArea.y.toFixed(0)}%</Label>
                              <Slider
                                value={[cropArea.y]}
                                onValueChange={([v]) => setCropArea({ ...cropArea, y: v })}
                                min={0}
                                max={100 - cropArea.height}
                                step={1}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Width: {cropArea.width.toFixed(0)}%</Label>
                              <Slider
                                value={[cropArea.width]}
                                onValueChange={([v]) => setCropArea({ ...cropArea, width: v })}
                                min={10}
                                max={100 - cropArea.x}
                                step={1}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Height: {cropArea.height.toFixed(0)}%</Label>
                              <Slider
                                value={[cropArea.height]}
                                onValueChange={([v]) => setCropArea({ ...cropArea, height: v })}
                                min={10}
                                max={100 - cropArea.y}
                                step={1}
                              />
                            </div>
                          </div>
                          <div className="relative border-2 border-primary rounded-lg overflow-hidden" style={{ aspectRatio: '1/1' }}>
                            <Image
                              src={newImagePreview}
                              alt="Preview"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                            {isCropping && (
                              <div
                                className="absolute border-2 border-primary bg-primary/20"
                                style={{
                                  left: `${cropArea.x}%`,
                                  top: `${cropArea.y}%`,
                                  width: `${cropArea.width}%`,
                                  height: `${cropArea.height}%`,
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {!isCropping && (
                        <div className="relative border rounded-lg overflow-hidden" style={{ aspectRatio: '1/1', maxHeight: '300px' }}>
                          <Image
                            src={newImagePreview}
                            alt="Preview"
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
                <Button onClick={addImageOverlay} className="w-full rounded-2xl" disabled={!newImagePreview}>
                  Add Image Overlay
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Video Player with Overlays */}
      <div
        ref={containerRef}
        className={cn(
          "relative mx-auto aspect-[9/16] w-full max-w-md overflow-hidden rounded-2xl bg-black",
          isDragging && "cursor-grabbing"
        )}
        onClick={handleVideoClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-cover"
          loop
        />

        {/* Render active text overlays */}
        {activeOverlays.map((overlay) => (
          <div
            key={overlay.id}
            data-overlay-element="true"
            className={cn(
              "absolute select-none transition-all",
              dragOverlayId === overlay.id ? "cursor-grabbing" : "cursor-grab",
              selectedOverlayId === overlay.id && "ring-2 ring-primary ring-offset-2",
              isDragging && dragOverlayId === overlay.id && "opacity-90 scale-105"
            )}
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: "translate(-50%, -50%)",
              width: "95%",
              maxWidth: "95%",
              fontSize: `${overlay.fontSize}px`,
              color: overlay.style === "bubble" || overlay.style === "highlight" ? undefined : overlay.color,
              pointerEvents: isDragging && dragOverlayId !== overlay.id ? "none" : "auto",
              zIndex: isDragging && dragOverlayId === overlay.id ? 50 : 20,
            }}
            onMouseDown={(e) => handleMouseDown(e, overlay.id)}
            onClick={(e) => {
              e.stopPropagation();
              if (!isDragging) {
                setSelectedOverlayId(overlay.id);
              }
            }}
          >
            <p
              className={cn(TEXT_OVERLAY_STYLES[overlay.style], "break-words text-center w-full")}
              style={{
                ...getTextStyleConfig(overlay.style, overlay.color),
                textAlign: 'center',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
              }}
            >
              {overlay.text}
            </p>
          </div>
        ))}

        {/* Render active image overlays */}
        {activeImageOverlays.map((overlay) => (
          <div
            key={overlay.id}
            data-image-overlay-element="true"
            className={cn(
              "absolute select-none transition-all",
              dragImageOverlayId === overlay.id ? "cursor-grabbing" : "cursor-grab",
              selectedImageOverlayId === overlay.id && "ring-2 ring-primary ring-offset-2",
              isDraggingImage && dragImageOverlayId === overlay.id && "opacity-90 scale-105"
            )}
            style={{
              left: `${overlay.x}%`,
              top: `${overlay.y}%`,
              transform: "translate(-50%, -50%)",
              width: `${overlay.width}%`,
              height: `${overlay.height}%`,
              opacity: overlay.opacity ?? 1,
              pointerEvents: isDraggingImage && dragImageOverlayId !== overlay.id ? "none" : "auto",
              zIndex: isDraggingImage && dragImageOverlayId === overlay.id ? 50 : 25,
            }}
            onMouseDown={(e) => handleImageMouseDown(e, overlay.id)}
            onClick={(e) => {
              e.stopPropagation();
              if (!isDraggingImage) {
                setSelectedImageOverlayId(overlay.id);
              }
            }}
          >
            <div className="relative w-full h-full">
              <Image
                src={overlay.imageUrl}
                alt="Image overlay"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        ))}

        {/* Render Subtitles */}
        {activeSubtitle && showSubtitles && (
          <div
            data-subtitle-element="true"
            className={cn(
              "absolute cursor-grab select-none transition-all",
              isDraggingSubtitle && "cursor-grabbing opacity-90 scale-105"
            )}
            style={{
              left: `${subtitlePosition.x}%`,
              top: `${subtitlePosition.y}%`,
              transform: "translate(-50%, -50%)",
              width: "95%",
              maxWidth: "95%",
              pointerEvents: isDraggingSubtitle ? "auto" : "auto",
              zIndex: isDraggingSubtitle ? 50 : 10,
            }}
            onMouseDown={handleSubtitleMouseDown}
          >
            <div
              className={cn(
                getSubtitleStyle(subtitleStyle).containerClassName || "rounded-2xl",
                "w-full"
              )}
              style={{ textAlign: 'center' }}
            >
              <p
                className={cn(
                  getSubtitleStyle(subtitleStyle).className.replace(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/g, ''),
                  "break-words text-center w-full"
                )}
                style={{
                  fontSize: `${subtitleFontSize / 100 * 24}px`,
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  lineHeight: '1.2',
                  textAlign: 'center',
                  ...(subtitleStyle === "outlined"
                    ? OUTLINED_STYLE
                    : subtitleStyle === "3d-pop"
                    ? STYLE_3D_POP
                    : subtitleStyle === "stroke-thick"
                    ? STYLE_STROKE_THICK
                    : {})
                }}
              >
                {(() => {
                  const words = activeSubtitle.text.split(' ').filter(Boolean);
                  if (!subtitleSingleLine || words.length === 0) {
                    // Non single-line: simple preview (keep style)
                    if (subtitleStyle === 'karaoke') {
                      const middleIndex = Math.floor(words.length / 2);
                      return words.map((word, idx) => (
                        <span
                          key={idx}
                          className={idx === middleIndex ? "bg-yellow-300 text-black px-2 py-1 rounded-md mx-1" : "mx-1"}
                        >
                          {word}
                        </span>
                      ));
                    }
                    return activeSubtitle.text;
                  }
                  
                  // Single-line preview: compute current word index based on time
                  const segmentDuration = Math.max(activeSubtitle.endMs - activeSubtitle.startMs, 1);
                  const progress = Math.max(0, Math.min(1, (currentTimeMs - activeSubtitle.startMs) / segmentDuration));
                  const currentWordIndex = Math.max(0, Math.min(words.length - 1, Math.floor(progress * words.length)));
                  
                  // Only apply Karaoke highlighting if style is 'karaoke'
                  const isKaraokeStyle = subtitleStyle === 'karaoke';
                  
                  if (subtitleSingleWord) {
                    const currentWord = words[currentWordIndex] ?? '';
                    return (
                      <span className={cn(
                        "mx-1",
                        isKaraokeStyle ? "bg-yellow-300 text-black px-2 py-1 rounded-md" : ""
                      )}>
                        {currentWord}
                      </span>
                    );
                  }
                  
                  // 3-word chunk
                  const chunkStart = Math.floor(currentWordIndex / 3) * 3;
                  const from = chunkStart;
                  const to = Math.min(words.length - 1, chunkStart + 2);
                  return words.slice(from, to + 1).map((word, i) => {
                    const idx = from + i;
                    const isActive = idx === currentWordIndex;
                    return (
                      <span
                        key={idx}
                        className={cn(
                          "mx-1 px-1 rounded-md",
                          isKaraokeStyle && isActive ? "bg-yellow-300 text-black" : ""
                        )}
                      >
                        {word}
                      </span>
                    );
                  });
                })()}
              </p>
            </div>
          </div>
        )}

        {selectedOverlay && !activeOverlays.find((o) => o.id === selectedOverlay.id) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm">
            Selected text not visible at current time
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlayPause}
          className="flex-shrink-0 rounded-full"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        {/* Playback Speed Controls */}
        <div className="flex items-center gap-2 rounded-2xl border bg-white/50 px-2 py-1">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                const currentIndex = rates.indexOf(playbackRate);
                const newIndex = Math.max(0, currentIndex - 1);
                updatePlaybackRate(rates[newIndex]);
              }}
              className="h-6 w-6 rounded-full p-0 text-xs"
              disabled={playbackRate <= 0.25}
            >
              −
            </Button>
            <span className="min-w-[3rem] text-center text-xs font-medium">
              {playbackRate}x
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
                const currentIndex = rates.indexOf(playbackRate);
                const newIndex = Math.min(rates.length - 1, currentIndex + 1);
                updatePlaybackRate(rates[newIndex]);
              }}
              className="h-6 w-6 rounded-full p-0 text-xs"
              disabled={playbackRate >= 2}
            >
              +
            </Button>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div
            className="relative h-2 cursor-pointer rounded-full bg-muted"
            onClick={handleTimelineClick}
          >
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
              style={{ width: `${(currentTimeMs / actualDurationMs) * 100}%` }}
            />
            {/* Text overlay markers on timeline */}
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className="absolute top-0 h-full bg-primary/30"
                style={{
                  left: `${(overlay.startMs / actualDurationMs) * 100}%`,
                  width: `${((overlay.endMs - overlay.startMs) / actualDurationMs) * 100}%`,
                }}
              />
            ))}
            {/* Image overlay markers on timeline */}
            {imageOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className="absolute top-0 h-full bg-blue-500/30"
                style={{
                  left: `${(overlay.startMs / actualDurationMs) * 100}%`,
                  width: `${((overlay.endMs - overlay.startMs) / actualDurationMs) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTimeMs)}</span>
            <span>{formatTime(actualDurationMs)} {actualDurationMs === 0 && "⚠️"}</span>
          </div>
          {actualDurationMs === 0 && (
            <p className="mt-1 text-xs text-yellow-600">
              ⚠️ Video duration not loaded yet
            </p>
          )}
        </div>
      </div>

      {/* Text Overlay List */}
      {textOverlays.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Text Overlays ({textOverlays.length})
          </Label>
          <div className="space-y-2">
            {textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border bg-white p-3 transition",
                  selectedOverlayId === overlay.id && "border-primary ring-2 ring-primary/20"
                )}
                onClick={() => setSelectedOverlayId(overlay.id)}
              >
                <div
                  className="h-8 w-8 flex-shrink-0 rounded-lg border"
                  style={{ backgroundColor: overlay.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{overlay.text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(overlay.startMs)} - {formatTime(overlay.endMs)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteOverlay(overlay.id);
                  }}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Overlay List */}
      {imageOverlays.length > 0 && onImageOverlaysChange && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Image Overlays ({imageOverlays.length})
          </Label>
          <div className="space-y-2">
            {imageOverlays.map((overlay) => (
              <div
                key={overlay.id}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border bg-white p-3 transition",
                  selectedImageOverlayId === overlay.id && "border-primary ring-2 ring-primary/20"
                )}
                onClick={() => setSelectedImageOverlayId(overlay.id)}
              >
                <div className="relative h-12 w-12 flex-shrink-0 rounded-lg border overflow-hidden">
                  <Image
                    src={overlay.imageUrl}
                    alt="Image overlay"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">Image Overlay</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(overlay.startMs)} - {formatTime(overlay.endMs)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteImageOverlay(overlay.id);
                  }}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Selected Overlay */}
      {selectedOverlay && (
        <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <Label className="text-sm font-semibold">Edit: {selectedOverlay.text}</Label>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Start Time</Label>
                <div className="pr-2">
                  <Slider
                    value={[selectedOverlay.startMs]}
                    onValueChange={([v]) => updateOverlay(selectedOverlay.id, { startMs: v })}
                    min={0}
                    max={actualDurationMs}
                    step={100}
                    className="w-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(selectedOverlay.startMs)}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">End Time</Label>
                <div className="pr-2">
                  <Slider
                    value={[selectedOverlay.endMs]}
                    onValueChange={([v]) => updateOverlay(selectedOverlay.id, { endMs: v })}
                    min={0}
                    max={actualDurationMs}
                    step={100}
                    className="w-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(selectedOverlay.endMs)}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Size: {selectedOverlay.fontSize}px</Label>
              <div className="pr-2">
                <Slider
                  value={[selectedOverlay.fontSize]}
                  onValueChange={([v]) => updateOverlay(selectedOverlay.id, { fontSize: v })}
                  min={24}
                  max={96}
                  step={2}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Selected Image Overlay */}
      {selectedImageOverlay && onImageOverlaysChange && (
        <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <Label className="text-sm font-semibold">Edit Image Overlay</Label>
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Start Time</Label>
                <div className="pr-2">
                  <Slider
                    value={[selectedImageOverlay.startMs]}
                    onValueChange={([v]) => updateImageOverlay(selectedImageOverlay.id, { startMs: v })}
                    min={0}
                    max={actualDurationMs}
                    step={100}
                    className="w-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(selectedImageOverlay.startMs)}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">End Time</Label>
                <div className="pr-2">
                  <Slider
                    value={[selectedImageOverlay.endMs]}
                    onValueChange={([v]) => updateImageOverlay(selectedImageOverlay.id, { endMs: v })}
                    min={0}
                    max={actualDurationMs}
                    step={100}
                    className="w-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTime(selectedImageOverlay.endMs)}
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Width: {selectedImageOverlay.width.toFixed(0)}%</Label>
                <div className="pr-2">
                  <Slider
                    value={[selectedImageOverlay.width]}
                    onValueChange={([v]) => updateImageOverlay(selectedImageOverlay.id, { width: v })}
                    min={5}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Height: {selectedImageOverlay.height.toFixed(0)}%</Label>
                <div className="pr-2">
                  <Slider
                    value={[selectedImageOverlay.height]}
                    onValueChange={([v]) => updateImageOverlay(selectedImageOverlay.id, { height: v })}
                    min={5}
                    max={100}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Opacity: {(selectedImageOverlay.opacity ?? 1) * 100}%</Label>
              <div className="pr-2">
                <Slider
                  value={[(selectedImageOverlay.opacity ?? 1) * 100]}
                  onValueChange={([v]) => updateImageOverlay(selectedImageOverlay.id, { opacity: v / 100 })}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

