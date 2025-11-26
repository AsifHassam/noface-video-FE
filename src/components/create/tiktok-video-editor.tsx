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
import type { TextOverlay, TextOverlayStyle, RenderStatus, SubtitleSegment, SubtitleStyle, SubtitlePosition, ImageOverlay, Character, CharacterSizes, CharacterPositions } from "@/types";
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
  // Browser preview mode (video + audio playback)
  browserPreviewMode?: boolean;
  audioFiles?: Array<{
    speaker: string;
    text: string;
    publicUrl: string | null;
    startMs: number;
    endMs: number;
    durationMs: number;
  }>;
  mergedAudioUrl?: string | null;
  mergedDurationMs?: number;
  backgroundVideoUrl?: string | null;
  // Character rendering for browser preview
  characters?: { A: Character | null; B: Character | null };
  characterSizes?: CharacterSizes;
  characterPositions?: CharacterPositions;
  onCharacterPositionsChange?: (positions: CharacterPositions) => void;
  // Custom character positions for browser preview (x/y coordinates in %)
  characterCustomPositions?: Record<string, { x: number; y: number }>;
  onCharacterCustomPositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
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
  browserPreviewMode = false,
  audioFiles = [],
  mergedAudioUrl = null,
  mergedDurationMs,
  backgroundVideoUrl = null,
  characters,
  characterSizes,
  characterPositions,
  onCharacterPositionsChange,
  characterCustomPositions,
  onCharacterCustomPositionsChange,
}: TikTokVideoEditorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioElementsRef = useRef<Map<number, HTMLAudioElement>>(new Map()); // Preloaded audio elements
  const [containerWidth, setContainerWidth] = useState<number>(0); // Will be measured
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPreloadProgress, setAudioPreloadProgress] = useState(0); // 0-100
  const [isAudioPreloading, setIsAudioPreloading] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  // In browser preview mode, use merged audio duration, otherwise use video duration
  const actualDurationMs = useMemo(() => {
    if (browserPreviewMode && mergedDurationMs) {
      return mergedDurationMs;
    }
    return durationMs || 0;
  }, [browserPreviewMode, mergedDurationMs, durationMs]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [selectedImageOverlayId, setSelectedImageOverlayId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverlayId, setDragOverlayId] = useState<string | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragImageOverlayId, setDragImageOverlayId] = useState<string | null>(null);
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);
  const [isDraggingCharacter, setIsDraggingCharacter] = useState(false);
  const [draggedCharacterName, setDraggedCharacterName] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddImageDialog, setShowAddImageDialog] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(externalPlaybackRate ?? 1);

  // actualDurationMs is now computed from props, no need to update it

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

  // Determine which character should be shown at current time (for browser preview)
  const activeCharacter = useMemo(() => {
    if (!browserPreviewMode || !audioFiles || audioFiles.length === 0 || !characters) return null;
    
    // Find the audio file that's currently playing
    const currentAudioFile = audioFiles.find(
      (af) => currentTimeMs >= af.startMs && currentTimeMs < af.endMs
    );
    
    if (!currentAudioFile) return null;
    
    // Match speaker name to character A or B
    const speakerName = currentAudioFile.speaker.toLowerCase();
    const charAName = characters.A?.name?.toLowerCase() || '';
    const charBName = characters.B?.name?.toLowerCase() || '';
    
    if (charAName && speakerName === charAName) {
      return { character: characters.A, speaker: 'A' };
    } else if (charBName && speakerName === charBName) {
      return { character: characters.B, speaker: 'B' };
    }
    
    // Fallback: try to match by first character or default
    if (characters.A) {
      return { character: characters.A, speaker: 'A' };
    }
    
    return null;
  }, [browserPreviewMode, audioFiles, currentTimeMs, characters]);

  // Measure container width for character scaling
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateContainerWidth = () => {
      if (containerRef.current) {
        // Use getBoundingClientRect for more accurate measurement
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width;
        if (width > 0 && width !== containerWidth) {
          console.log('📏 Container width measured:', width, 'px');
          setContainerWidth(width);
        }
      }
    };
    
    // Initial measurement with a small delay to ensure container is rendered
    const timeoutId = setTimeout(() => {
      updateContainerWidth();
    }, 100);
    
    // Use ResizeObserver for better performance than window resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (width > 0 && width !== containerWidth) {
          console.log('📏 Container width resized:', width, 'px');
          setContainerWidth(width);
        }
      }
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // Fallback to window resize listener
    window.addEventListener('resize', updateContainerWidth);
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateContainerWidth);
    };
  }, [containerWidth]);

  // Determine video source: use backgroundVideoUrl in browser preview mode, otherwise use videoUrl
  const videoSource = useMemo(() => {
    if (browserPreviewMode && backgroundVideoUrl) {
      return backgroundVideoUrl;
    }
    return videoUrl || null;
  }, [browserPreviewMode, backgroundVideoUrl, videoUrl]);

  // Sync video time and get actual duration
  // In browser preview mode, don't update currentTimeMs from video (audio-driven sync handles this)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      console.log("⚠️ Video ref not available");
      return;
    }

    const handleTimeUpdate = () => {
      // In browser preview mode, don't update currentTimeMs from video
      // Audio-driven sync handles this more accurately
      if (!browserPreviewMode) {
        setCurrentTimeMs(video.currentTime * 1000);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    const handleLoadedMetadata = () => {
      // actualDurationMs is now computed from props
      const actualDuration = video.duration * 1000;
      console.log("📹 Video metadata loaded, duration:", actualDuration);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    
    // actualDurationMs is now computed from props (mergedDurationMs in browser preview mode)
    if (video.duration && !isNaN(video.duration)) {
      const existingDuration = video.duration * 1000;
      console.log("📹 Video metadata already loaded:", existingDuration);
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [videoSource, browserPreviewMode, audioFiles]); // Re-run when video source or browser preview mode changes

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

  // Apply playback rate to all audio elements (merged and individual)
  useEffect(() => {
    // Apply to merged audio element
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackRate;
    }
    
    // Apply to all preloaded individual audio elements
    audioElementsRef.current.forEach((audioElement) => {
      if (audioElement) {
        audioElement.playbackRate = playbackRate;
      }
    });
  }, [playbackRate]);

  // Preload merged audio file or individual audio files in browser preview mode
  useEffect(() => {
    // If we have merged audio, use that instead of multiple files
    if (browserPreviewMode && mergedAudioUrl) {
      console.log("🎵 Using merged audio file:", mergedAudioUrl);
      setIsAudioPreloading(true);
      setAudioPreloadProgress(0);
      
      // Preload merged audio
      const audio = audioRef.current;
      if (audio) {
        audio.src = mergedAudioUrl;
        audio.preload = 'auto';
        audio.playbackRate = playbackRate; // Apply current playback rate
        audio.load();
        
        const handleCanPlayThrough = () => {
          setIsAudioPreloading(false);
          setAudioPreloadProgress(100);
          console.log("✅ Merged audio file ready!");
          audio.removeEventListener('canplaythrough', handleCanPlayThrough);
          audio.removeEventListener('canplay', handleCanPlay);
        };
        
        const handleCanPlay = () => {
          if (audio.readyState >= 2) {
            setIsAudioPreloading(false);
            setAudioPreloadProgress(100);
            console.log("✅ Merged audio file ready to play!");
          }
        };
        
        const handleError = (e: Event) => {
          console.error("❌ Failed to load merged audio:", e);
          setIsAudioPreloading(false);
          setAudioPreloadProgress(0);
          audio.removeEventListener('error', handleError);
        };
        
        audio.addEventListener('canplaythrough', handleCanPlayThrough);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);
        
        return () => {
          audio.removeEventListener('canplaythrough', handleCanPlayThrough);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('error', handleError);
        };
      }
      return;
    }
    
    // Fallback to multiple audio files if merged audio not available
    if (!browserPreviewMode || !audioFiles || audioFiles.length === 0) {
      // Clean up preloaded audio elements when not in browser preview mode
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
        audio.load();
      });
      audioElementsRef.current.clear();
      setIsAudioPreloading(false);
      setAudioPreloadProgress(0);
      return;
    }

    console.log("🎵 Preloading all audio files:", audioFiles.length);
    setIsAudioPreloading(true);
    setAudioPreloadProgress(0);
    
    let loadedCount = 0;
    const totalFiles = audioFiles.length;
    const loadedFiles = new Set<number>();
    
    // Create and preload audio elements for each file
    audioFiles.forEach((audioFile, index) => {
      if (!audioFile.publicUrl) {
        console.warn(`⚠️ No public URL for audio file ${index}:`, audioFile);
        loadedFiles.add(index);
        loadedCount++;
        setAudioPreloadProgress((loadedCount / totalFiles) * 100);
        if (loadedCount === totalFiles) {
          setIsAudioPreloading(false);
          console.log("✅ All audio files preloaded!");
        }
        return;
      }

      // Check if we already have a preloaded element for this index
      if (audioElementsRef.current.has(index)) {
        const existingAudio = audioElementsRef.current.get(index);
        if (existingAudio && existingAudio.src === audioFile.publicUrl && existingAudio.readyState >= 3) {
          // Already preloaded and ready
          if (!loadedFiles.has(index)) {
            loadedFiles.add(index);
            loadedCount++;
            setAudioPreloadProgress((loadedCount / totalFiles) * 100);
            if (loadedCount === totalFiles) {
              setIsAudioPreloading(false);
              console.log("✅ All audio files preloaded!");
            }
          }
          return;
        }
        // Clean up old element
        existingAudio?.pause();
        existingAudio?.remove();
      }

      // Create new audio element
      const audioElement = document.createElement('audio');
      audioElement.preload = 'auto';
      audioElement.crossOrigin = 'anonymous';
      audioElement.src = audioFile.publicUrl;
      audioElement.playbackRate = playbackRate; // Apply current playback rate
      
      // Preload the audio
      audioElement.load();
      
      // Track loading progress
      const handleCanPlayThrough = () => {
        if (!loadedFiles.has(index)) {
          loadedFiles.add(index);
          loadedCount++;
          const progress = (loadedCount / totalFiles) * 100;
          setAudioPreloadProgress(progress);
          console.log(`✅ Audio file ${index + 1}/${totalFiles} preloaded (${progress.toFixed(0)}%):`, audioFile.publicUrl);
          
          if (loadedCount === totalFiles) {
            setIsAudioPreloading(false);
            console.log("✅ All audio files preloaded and ready!");
          }
        }
        audioElement.removeEventListener('canplaythrough', handleCanPlayThrough);
        audioElement.removeEventListener('canplay', handleCanPlay);
      };
      
      const handleCanPlay = () => {
        // Also track canplay for faster feedback
        if (!loadedFiles.has(index) && audioElement.readyState >= 2) {
          // Mark as ready if it can play (even if not fully loaded)
          loadedFiles.add(index);
          loadedCount++;
          const progress = (loadedCount / totalFiles) * 100;
          setAudioPreloadProgress(progress);
          
          if (loadedCount === totalFiles) {
            setIsAudioPreloading(false);
            console.log("✅ All audio files ready to play!");
          }
        }
      };
      
      const handleError = (e: Event) => {
        console.error(`❌ Failed to preload audio file ${index + 1}:`, audioFile.publicUrl, e);
        if (!loadedFiles.has(index)) {
          loadedFiles.add(index);
          loadedCount++;
          setAudioPreloadProgress((loadedCount / totalFiles) * 100);
          if (loadedCount === totalFiles) {
            setIsAudioPreloading(false);
          }
        }
        audioElement.removeEventListener('error', handleError);
      };
      
      audioElement.addEventListener('canplaythrough', handleCanPlayThrough);
      audioElement.addEventListener('canplay', handleCanPlay);
      audioElement.addEventListener('error', handleError);
      
      // Store in map
      audioElementsRef.current.set(index, audioElement);
    });

    // Cleanup function
    return () => {
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
        audio.load();
      });
      audioElementsRef.current.clear();
      setIsAudioPreloading(false);
      setAudioPreloadProgress(0);
    };
  }, [browserPreviewMode, audioFiles, mergedAudioUrl]);

  // Browser preview mode: Sync audio with video playback
  // Use merged audio if available, otherwise use multiple files
  useEffect(() => {
    if (!browserPreviewMode || !audioRef.current || !videoRef.current) {
      return;
    }

    // Don't start sync if audio is still preloading
    if (isAudioPreloading) {
      console.log("⏳ Audio still preloading, waiting...");
      return;
    }

    const videoElement = videoRef.current;
    const audioElement = audioRef.current;
    
    if (!videoElement || !audioElement) {
      return;
    }
    
    // If we have merged audio, use simple sync
    // Check if audio is loaded with merged URL (might not be set yet, so check src or readyState)
    const hasMergedAudio = mergedAudioUrl && (
      audioElement.src === mergedAudioUrl || 
      audioElement.src.includes('merged-audio-') ||
      (mergedAudioUrl && audioElement.readyState >= 1) // Even if src not set yet, if we have URL and audio is loading
    );
    
    if (hasMergedAudio && audioElement.readyState >= 1) {
      console.log("✅ Merged audio ready, starting simple sync...");
      
      // Simple sync: audio drives timing, video follows
      let animationFrameId: number | null = null;
      
      const mergedDuration = mergedDurationMs || durationMs;
      
      const updateSync = () => {
        if (!videoElement || !audioElement) {
          animationFrameId = null;
          return;
        }
        
        // Check if both are playing
        const bothPlaying = !videoElement.paused && !audioElement.paused;
        if (!bothPlaying) {
          animationFrameId = null;
          return;
        }
        
        // Use audio time as source of truth
        const audioTimeMs = audioElement.currentTime * 1000;
        setCurrentTimeMs(audioTimeMs);
        
        // Clamp video time to audio duration to prevent video from going beyond audio
        const clampedAudioTimeMs = Math.min(audioTimeMs, mergedDuration);
        
        // Sync video to audio (video should match audio time exactly)
        const videoTimeMs = videoElement.currentTime * 1000;
        const diff = Math.abs(clampedAudioTimeMs - videoTimeMs);
        
        if (diff > 50) {
          // Smooth correction - keep video in sync with audio
          const adjustment = Math.sign(clampedAudioTimeMs - videoTimeMs) * Math.min(diff, 50);
          videoElement.currentTime = Math.min((videoTimeMs + adjustment) / 1000, mergedDuration / 1000);
        }
        
        // Stop when audio ends or reaches duration limit
        if (audioElement.ended || audioTimeMs >= mergedDuration) {
          videoElement.pause();
          audioElement.pause();
          // Ensure video is at the end
          videoElement.currentTime = mergedDuration / 1000;
          setCurrentTimeMs(mergedDuration);
          setIsPlaying(false);
          animationFrameId = null;
          return;
        }
        
        animationFrameId = requestAnimationFrame(updateSync);
      };
      
      const handleVideoPlay = () => {
        // When video plays, also play audio and start sync
        if (audioElement && audioElement.readyState >= 2) {
          audioElement.play().catch((err: any) => {
            console.error("❌ Failed to play audio on video play:", err);
          });
        }
        // Start sync loop after a brief delay to ensure audio started
        setTimeout(() => {
          if (!videoElement.paused && !audioElement.paused) {
            animationFrameId = requestAnimationFrame(updateSync);
          }
        }, 50);
      };
      
      const handleVideoPause = () => {
        if (audioElement) {
          audioElement.pause();
        }
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      };
      
      const handleAudioPlay = () => {
        if (!videoElement.paused) {
          animationFrameId = requestAnimationFrame(updateSync);
        }
      };
      
      const handleAudioPause = () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      };
      
      const handleAudioEnded = () => {
        console.log("🎵 Audio ended, stopping video");
        videoElement.pause();
        videoElement.currentTime = mergedDuration / 1000;
        setIsPlaying(false);
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      };
      
      videoElement.addEventListener('play', handleVideoPlay);
      videoElement.addEventListener('pause', handleVideoPause);
      audioElement.addEventListener('play', handleAudioPlay);
      audioElement.addEventListener('pause', handleAudioPause);
      audioElement.addEventListener('ended', handleAudioEnded);
      
      // Start sync if both are already playing
      if (!videoElement.paused && !audioElement.paused) {
        animationFrameId = requestAnimationFrame(updateSync);
      }
      
      return () => {
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        videoElement.removeEventListener('play', handleVideoPlay);
        videoElement.removeEventListener('pause', handleVideoPause);
        audioElement.removeEventListener('play', handleAudioPlay);
        audioElement.removeEventListener('pause', handleAudioPause);
        audioElement.removeEventListener('ended', handleAudioEnded);
      };
    }
    
    // Fallback to multiple files sync if merged audio not available
    if (!audioFiles || audioFiles.length === 0) {
      return;
    }

    // Verify all audio files are actually ready
    const allReady = audioFiles.every((_, index) => {
      const preloaded = audioElementsRef.current.get(index);
      return preloaded && preloaded.readyState >= 2;
    });

    if (!allReady) {
      console.log("⏳ Waiting for all audio files to be ready...");
      return;
    }

    console.log("✅ All audio files ready, starting sync...");

    const currentAudioIndexRef = { current: -1 }; // Use ref object to persist across closures
    let isSwitchingAudio = false;
    
    // Calculate total audio duration
    const totalAudioDurationMs = audioFiles.length > 0 
      ? Math.max(...audioFiles.map(a => a.endMs))
      : 0;
    
    // Helper function to find and load the correct audio file for a given time
    const loadAudioForTime = (videoTimeMs: number) => {
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio) return;
      
      const audioIndex = audioFiles.findIndex(a => 
        videoTimeMs >= a.startMs && videoTimeMs < a.endMs
      );
      
      if (audioIndex === -1) {
        if (videoTimeMs >= totalAudioDurationMs) {
          video.pause();
          audio.pause();
          setIsPlaying(false);
          return;
        }
        if (!audio.paused && currentAudioIndexRef.current >= 0) {
          audio.pause();
        }
        return;
      }

      const currentAudioFile = audioFiles[audioIndex];
      if (!currentAudioFile.publicUrl) {
        console.warn("⚠️ No public URL for audio file:", currentAudioFile);
        return;
      }

      // Check if we have a preloaded audio element for this file
      const preloadedAudio = audioElementsRef.current.get(audioIndex);
      const isSameFile = audioIndex === currentAudioIndexRef.current && 
                        audio.src === currentAudioFile.publicUrl &&
                        audio.readyState >= 2;
      
      if (!isSameFile && !isSwitchingAudio) {
        isSwitchingAudio = true;
        currentAudioIndexRef.current = audioIndex;
        const wasPlaying = !video.paused && !audio.paused;
        const offsetInAudio = Math.max(0, (videoTimeMs - currentAudioFile.startMs) / 1000);
        
        // Use preloaded audio if available for instant switching
        if (preloadedAudio && preloadedAudio.readyState >= 2) {
          // Preloaded audio is ready - switch immediately without interruption
          const wasPlayingAudio = !audio.paused;
          
          // Switch source
          audio.src = preloadedAudio.src;
          
          // Try to play immediately if preloaded
          if (preloadedAudio.readyState >= 3) {
            // Fully loaded - switch instantly without load() to avoid interruption
            // Directly set currentTime and play
            audio.currentTime = offsetInAudio;
            audio.playbackRate = playbackRate; // Use current playback rate from state
            
            if (wasPlaying || !video.paused) {
              // Play immediately without waiting
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    isSwitchingAudio = false;
                  })
                  .catch(err => {
                    // Ignore AbortError - it's expected when switching audio
                    if (err.name !== 'AbortError') {
                      console.error("❌ Audio play error:", err);
                    }
                    // Retry once
                    setTimeout(() => {
                      audio.play().catch(() => {});
                      isSwitchingAudio = false;
                    }, 50);
                  });
              } else {
                isSwitchingAudio = false;
              }
            } else {
              isSwitchingAudio = false;
            }
          } else {
            // Not fully loaded yet, but still preloaded - load and wait briefly
            audio.load();
            audio.currentTime = offsetInAudio;
            audio.playbackRate = playbackRate; // Use current playback rate from state
            
            const handleCanPlay = () => {
              audio.removeEventListener("canplaythrough", wrappedHandleCanPlay);
              audio.removeEventListener("canplay", wrappedHandleCanPlay);
              isSwitchingAudio = false;
              
              if (wasPlaying || !video.paused) {
                audio.play().catch(err => console.error("❌ Audio play error:", err));
              }
            };
            
            const timeoutId = setTimeout(() => {
              audio.removeEventListener("canplaythrough", wrappedHandleCanPlay);
              audio.removeEventListener("canplay", wrappedHandleCanPlay);
              isSwitchingAudio = false;
              if (!video.paused) {
                audio.play().catch(err => console.error("❌ Audio play error:", err));
              }
            }, 50); // Very short timeout for preloaded audio
            
            const wrappedHandleCanPlay = () => {
              clearTimeout(timeoutId);
              handleCanPlay();
            };
            
            audio.addEventListener("canplaythrough", wrappedHandleCanPlay);
            audio.addEventListener("canplay", wrappedHandleCanPlay);
          }
        } else {
          // Fallback: load normally if not preloaded
          audio.src = currentAudioFile.publicUrl;
          audio.load();
          
          const handleCanPlay = () => {
            audio.removeEventListener("canplaythrough", wrappedHandleCanPlay);
            audio.removeEventListener("canplay", wrappedHandleCanPlay);
            isSwitchingAudio = false;
            audio.currentTime = offsetInAudio;
            
            if (wasPlaying || !video.paused) {
              audio.play().catch(err => console.error("❌ Audio play error:", err));
            }
          };
          
          const timeoutId = setTimeout(() => {
            audio.removeEventListener("canplaythrough", wrappedHandleCanPlay);
            audio.removeEventListener("canplay", wrappedHandleCanPlay);
            isSwitchingAudio = false;
            if (!video.paused) {
              audio.currentTime = offsetInAudio;
              audio.play().catch(err => console.error("❌ Audio play error:", err));
            }
          }, 500); // Reduced timeout
          
          const wrappedHandleCanPlay = () => {
            clearTimeout(timeoutId);
            handleCanPlay();
          };
          
          audio.addEventListener("canplaythrough", wrappedHandleCanPlay);
          audio.addEventListener("canplay", wrappedHandleCanPlay);
        }
        return;
      }
      
      if (isSameFile && isSwitchingAudio) {
        isSwitchingAudio = false;
      }

      // Same audio file, sync both audio and video times smoothly
      const offsetInAudio = Math.max(0, (videoTimeMs - currentAudioFile.startMs) / 1000);
      const timeDiff = Math.abs(audio.currentTime - offsetInAudio);
      
      // Only adjust audio if there's significant drift (avoid micro-adjustments that cause stutter)
      if (timeDiff > 0.2) {
        audio.currentTime = offsetInAudio;
      }
      
      // Calculate actual time from audio (audio is source of truth)
      const actualVideoTimeMs = currentAudioFile.startMs + (audio.currentTime * 1000);
      
      // Sync video time smoothly - only if there's significant drift
      const videoTimeDiff = Math.abs(video.currentTime * 1000 - actualVideoTimeMs);
      if (videoTimeDiff > 100) {
        // Smooth adjustment instead of direct jump
        const adjustment = Math.sign(actualVideoTimeMs - video.currentTime * 1000) * Math.min(Math.abs(videoTimeDiff), 50);
        const newVideoTime = (video.currentTime * 1000 + adjustment) / 1000;
        if (newVideoTime >= 0 && newVideoTime <= video.duration) {
          video.currentTime = newVideoTime;
        } else {
          video.currentTime = actualVideoTimeMs / 1000;
        }
      }
      
      // Update currentTimeMs based on audio for immediate feedback
      setCurrentTimeMs(actualVideoTimeMs);
    };

    // Sync play/pause
    const handleVideoPlay = () => {
      if (!video || !audio) return;
      const videoTimeMs = video.currentTime * 1000;
      loadAudioForTime(videoTimeMs);
      
      if (audio.readyState >= 2) {
        audio.play().catch(err => console.error("❌ Audio play error on video play:", err));
      }
      
      setIsPlaying(true);
      startSyncLoop();
    };
    
    const handleVideoPause = () => {
      if (audio) {
        audio.pause();
      }
      setIsPlaying(false);
      stopSyncLoop();
    };

    // Sync seek (when user scrubs timeline)
    const handleVideoSeeked = () => {
      if (!video) return;
      const videoTimeMs = video.currentTime * 1000;
      
      if (totalAudioDurationMs > 0 && videoTimeMs >= totalAudioDurationMs) {
        video.currentTime = totalAudioDurationMs / 1000;
        video.pause();
        audio.pause();
        setIsPlaying(false);
        setCurrentTimeMs(totalAudioDurationMs);
        return;
      }
      
      setCurrentTimeMs(videoTimeMs);
      
      // Only load audio if we're not already switching
      if (!isSwitchingAudio) {
        loadAudioForTime(videoTimeMs);
      }
    };

    // Handle audio ended event to transition to next file (backup - should rarely fire due to early switching)
    const handleAudioEnded = () => {
      if (!audio || currentAudioIndexRef.current < 0 || isSwitchingAudio) return;
      
      const nextIndex = currentAudioIndexRef.current + 1;
      if (nextIndex < audioFiles.length) {
        const nextAudioFile = audioFiles[nextIndex];
        const nextTimeMs = nextAudioFile.startMs;
        
        // Use preloaded audio if available
        const preloadedNext = audioElementsRef.current.get(nextIndex);
        if (preloadedNext && preloadedNext.readyState >= 2) {
          audio.src = preloadedNext.src;
          audio.load();
          audio.currentTime = 0;
          
          if (!video.paused) {
            requestAnimationFrame(() => {
              audio.play().catch(err => console.error("❌ Audio play error:", err));
            });
          }
        } else {
          loadAudioForTime(nextTimeMs);
        }
        
        isSwitchingAudio = false;
        currentAudioIndexRef.current = nextIndex;
        
        if (video && !video.paused) {
          const videoTimeMs = video.currentTime * 1000;
          if (Math.abs(videoTimeMs - nextTimeMs) > 16) {
            video.currentTime = nextTimeMs / 1000;
          }
        }
        
        setCurrentTimeMs(nextTimeMs);
      } else {
        // All audio files have played - stop everything
        video?.pause();
        audio.pause();
        setIsPlaying(false);
        setCurrentTimeMs(totalAudioDurationMs);
        stopSyncLoop();
      }
    };

    // Sync time update - use requestAnimationFrame for smooth updates
    let animationFrameId: number | null = null;
    let lastUpdateTime = 0;
    let lastVideoTime = 0;
    let lastAudioTime = 0;
    const updateInterval = 16; // ~60fps
    const SYNC_THRESHOLD = 100; // Only sync if drift is > 100ms to avoid jerky playback
    const MAX_ADJUSTMENT = 0.05; // Maximum adjustment per frame (50ms) for smooth correction
    
    const updateSync = () => {
      if (!video || !audio || video.paused) {
        animationFrameId = null;
        return;
      }
      
      const now = performance.now();
      if (now - lastUpdateTime < updateInterval) {
        animationFrameId = requestAnimationFrame(updateSync);
        return;
      }
      lastUpdateTime = now;
      
      // Use audio time as source of truth if we have a valid audio file
      if (currentAudioIndexRef.current >= 0 && audioFiles[currentAudioIndexRef.current] && audio.readyState >= 2) {
        const currentAudioFile = audioFiles[currentAudioIndexRef.current];
        const currentTimeMs = currentAudioFile.startMs + (audio.currentTime * 1000);
        
        // Only update if audio time has actually changed (avoid unnecessary updates)
        if (Math.abs(currentTimeMs - lastAudioTime) < 1) {
          animationFrameId = requestAnimationFrame(updateSync);
          return;
        }
        lastAudioTime = currentTimeMs;
        
        const videoTimeMs = video.currentTime * 1000;
        const videoTimeDiff = currentTimeMs - videoTimeMs;
        
        // Only sync if there's significant drift (to avoid jerky playback)
        if (Math.abs(videoTimeDiff) > SYNC_THRESHOLD) {
          // Smooth correction: adjust gradually instead of jumping
          const adjustment = Math.sign(videoTimeDiff) * Math.min(Math.abs(videoTimeDiff), MAX_ADJUSTMENT * 1000);
          const newVideoTime = (videoTimeMs + adjustment) / 1000;
          
          // Clamp to valid range
          if (newVideoTime >= 0 && newVideoTime <= video.duration) {
            video.currentTime = newVideoTime;
          } else {
            // If adjustment would go out of bounds, do direct sync
            video.currentTime = currentTimeMs / 1000;
          }
        }
        
        setCurrentTimeMs(currentTimeMs);
        
        // Check if we've passed the end of current audio file - switch to next
        if (currentTimeMs >= currentAudioFile.endMs) {
          const nextIndex = currentAudioIndexRef.current + 1;
          if (nextIndex < audioFiles.length) {
            const nextAudioFile = audioFiles[nextIndex];
            const nextTimeMs = nextAudioFile.startMs;
            
            // Only switch if we're not already switching
            if (!isSwitchingAudio) {
              console.log(`🎵 Audio file ${currentAudioIndexRef.current + 1} ended at ${currentTimeMs}ms, switching to ${nextIndex + 1}`);
              
              const wasPlaying = !audio.paused;
              isSwitchingAudio = true;
              const oldIndex = currentAudioIndexRef.current;
              currentAudioIndexRef.current = nextIndex;
              
              // Use preloaded audio if available
              const preloadedNext = audioElementsRef.current.get(nextIndex);
              if (preloadedNext && preloadedNext.readyState >= 3) {
                // Fully loaded - switch immediately
                audio.src = preloadedNext.src;
                audio.load();
                
                // Wait for load to complete, then set time and play
                let loadCompleteHandled = false;
                const handleLoadComplete = () => {
                  if (loadCompleteHandled) return;
                  loadCompleteHandled = true;
                  
                  audio.removeEventListener('canplay', handleLoadComplete);
                  audio.removeEventListener('canplaythrough', handleLoadComplete);
                  
                  audio.currentTime = 0; // Start from beginning of next file
                  
                  // Update time immediately so sync loop continues
                  setCurrentTimeMs(nextTimeMs);
                  
                  // Reset switching flag BEFORE playing to allow sync loop to continue
                  isSwitchingAudio = false;
                  
                  if (wasPlaying) {
                    // Use double requestAnimationFrame to ensure load() has fully completed
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        const playPromise = audio.play();
                        if (playPromise !== undefined) {
                          playPromise
                            .then(() => {
                              console.log(`✅ Switched to audio file ${nextIndex + 1}, playing from ${nextTimeMs}ms`);
                            })
                            .catch(err => {
                              // Ignore AbortError - expected during switching
                              if (err.name !== 'AbortError') {
                                console.error("❌ Audio play error:", err);
                              }
                              // Retry after brief delay
                              setTimeout(() => {
                                audio.play()
                                  .then(() => {
                                    console.log(`✅ Switched to audio file ${nextIndex + 1} (retry), playing from ${nextTimeMs}ms`);
                                  })
                                  .catch(() => {});
                              }, 100);
                            });
                        } else {
                          console.log(`✅ Switched to audio file ${nextIndex + 1}, playing from ${nextTimeMs}ms`);
                        }
                      });
                    });
                  } else {
                    console.log(`✅ Switched to audio file ${nextIndex + 1}, ready at ${nextTimeMs}ms`);
                  }
                };
                
                if (audio.readyState >= 2) {
                  // Already ready - call immediately
                  handleLoadComplete();
                } else {
                  audio.addEventListener('canplay', handleLoadComplete);
                  audio.addEventListener('canplaythrough', handleLoadComplete);
                  
                  // Fallback timeout - ensure we don't get stuck
                  const timeoutId = setTimeout(() => {
                    if (!loadCompleteHandled) {
                      audio.removeEventListener('canplay', handleLoadComplete);
                      audio.removeEventListener('canplaythrough', handleLoadComplete);
                      if (audio.readyState >= 2) {
                        handleLoadComplete();
                      } else {
                        console.warn(`⚠️ Audio file ${nextIndex + 1} not ready after timeout, resetting switch flag`);
                        isSwitchingAudio = false;
                        // Try to continue anyway
                        setCurrentTimeMs(nextTimeMs);
                      }
                    }
                  }, 200);
                }
              } else {
                // Not preloaded, use loadAudioForTime
                loadAudioForTime(nextTimeMs);
                setCurrentTimeMs(nextTimeMs);
                isSwitchingAudio = false;
              }
              
              animationFrameId = requestAnimationFrame(updateSync);
              return;
            }
          } else {
            // Last audio file - let it finish naturally
            if (currentTimeMs >= currentAudioFile.endMs) {
              video.pause();
              audio.pause();
              video.currentTime = totalAudioDurationMs / 1000;
              setCurrentTimeMs(totalAudioDurationMs);
              setIsPlaying(false);
              animationFrameId = null;
              return;
            }
          }
        }
        
        // Check if we're approaching the end - prepare next file (but don't switch yet)
        const timeUntilEnd = currentAudioFile.endMs - currentTimeMs;
        if (timeUntilEnd <= 100 && timeUntilEnd > 0 && !isSwitchingAudio) {
          const nextIndex = currentAudioIndexRef.current + 1;
          if (nextIndex < audioFiles.length) {
            // Just verify next file is ready - don't switch yet
            const preloadedNext = audioElementsRef.current.get(nextIndex);
            if (!preloadedNext || preloadedNext.readyState < 3) {
              // Preload if not ready
              const nextAudioFile = audioFiles[nextIndex];
              if (nextAudioFile.publicUrl) {
                const preloadEl = document.createElement('audio');
                preloadEl.preload = 'auto';
                preloadEl.src = nextAudioFile.publicUrl;
                preloadEl.load();
                audioElementsRef.current.set(nextIndex, preloadEl);
              }
            }
          }
        }
        
        // Stop if we've reached the total end
        if (totalAudioDurationMs > 0 && currentTimeMs >= totalAudioDurationMs) {
          video.pause();
          audio.pause();
          video.currentTime = totalAudioDurationMs / 1000;
          setCurrentTimeMs(totalAudioDurationMs);
          setIsPlaying(false);
          animationFrameId = null;
          return;
        }
        
        animationFrameId = requestAnimationFrame(updateSync);
      } else {
        // No valid audio file, try to load correct one
        const videoTimeMs = video.currentTime * 1000;
        loadAudioForTime(videoTimeMs);
        animationFrameId = requestAnimationFrame(updateSync);
      }
    };
    
    const startSyncLoop = () => {
      if (animationFrameId === null && video && !video.paused) {
        animationFrameId = requestAnimationFrame(updateSync);
      }
    };
    
    const stopSyncLoop = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    // Initialize audio when video is ready
    const handleVideoCanPlay = () => {
      if (!video || !audio || audioFiles.length === 0) return;
      
      if (audioFiles.length > 0 && audioFiles[0].publicUrl) {
        currentAudioIndexRef.current = 0;
        audio.src = audioFiles[0].publicUrl;
        audio.load();
        loadAudioForTime(video.currentTime * 1000);
      }
    };

    if (video.readyState >= 3) {
      handleVideoCanPlay();
    }

    video.addEventListener("play", handleVideoPlay);
    video.addEventListener("pause", handleVideoPause);
    video.addEventListener("seeked", handleVideoSeeked);
    video.addEventListener("canplay", handleVideoCanPlay);
    audio.addEventListener("ended", handleAudioEnded);
    
    if (!video.paused) {
      startSyncLoop();
    }
    
    return () => {
      stopSyncLoop();
      video.removeEventListener("play", handleVideoPlay);
      video.removeEventListener("pause", handleVideoPause);
      video.removeEventListener("seeked", handleVideoSeeked);
      video.removeEventListener("canplay", handleVideoCanPlay);
      audio.removeEventListener("ended", handleAudioEnded);
    };
  }, [browserPreviewMode, audioFiles, backgroundVideoUrl, isAudioPreloading]);

  // Helper function to update playback rate and notify parent
  const updatePlaybackRate = (newRate: number) => {
    setPlaybackRate(newRate);
    if (onPlaybackRateChange) {
      onPlaybackRateChange(newRate);
    }
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    // In browser preview mode, check if audio is still preloading
    if (browserPreviewMode && isAudioPreloading) {
      console.log("⏳ Audio files still preloading, please wait...");
      return;
    }

    if (isPlaying) {
      video.pause();
      if (audio && browserPreviewMode) {
        audio.pause();
      }
    } else {
      video.play();
      // In browser preview mode with merged audio, also play the audio
      if (audio && browserPreviewMode && mergedAudioUrl && audio.readyState >= 2) {
        audio.play().catch(err => {
          console.error("❌ Failed to play merged audio:", err);
        });
      }
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

    if (browserPreviewMode && audioRef.current) {
      // In browser preview mode, seek both audio and video
      audioRef.current.currentTime = newTimeMs / 1000;
      if (videoRef.current) {
        videoRef.current.currentTime = newTimeMs / 1000;
      }
      setCurrentTimeMs(newTimeMs);
    } else if (videoRef.current) {
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
    if (isDragging || isDraggingSubtitle || isDraggingImage || isDraggingCharacter) return;
    
    // Check if click target is an overlay, subtitle, or character (has data attribute or specific class)
    const target = e.target as HTMLElement;
    if (target.closest('[data-overlay-element]') || target.closest('[data-subtitle-element]') || target.closest('[data-image-overlay-element]') || target.closest('[data-character-element]')) {
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
    setIsDraggingImage(false);
    setDragImageOverlayId(null);
    setIsDraggingCharacter(false);
    setDraggedCharacterName(null);
    setIsDraggingSubtitle(true);
  };

  const handleCharacterMouseDown = (e: React.MouseEvent<HTMLDivElement>, characterName: string) => {
    e.stopPropagation();
    e.preventDefault();
    // Ensure other dragging is off when starting character drag
    setIsDragging(false);
    setDragOverlayId(null);
    setIsDraggingImage(false);
    setDragImageOverlayId(null);
    setIsDraggingSubtitle(false);
    setIsDraggingCharacter(true);
    setDraggedCharacterName(characterName);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    
    // Only handle one type of dragging at a time
    if (!isDragging && !isDraggingSubtitle && !isDraggingImage && !isDraggingCharacter) return;

    const rect = containerRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    // Clamp values to keep content within bounds (0-100%)
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    // Handle text overlay dragging
    if (isDragging && dragOverlayId && !isDraggingSubtitle && !isDraggingImage && !isDraggingCharacter) {
      updateOverlay(dragOverlayId, { x, y });
      return;
    }

    // Handle image overlay dragging
    if (isDraggingImage && dragImageOverlayId && !isDragging && !isDraggingSubtitle && !isDraggingCharacter) {
      updateImageOverlay(dragImageOverlayId, { x, y });
      return;
    }

    // Handle subtitle dragging
    if (isDraggingSubtitle && !isDragging && !isDraggingImage && !isDraggingCharacter && onSubtitlePositionChange) {
      onSubtitlePositionChange({ x, y });
      return;
    }

    // Handle character dragging - use free-form x/y positioning
    if (isDraggingCharacter && draggedCharacterName && !isDragging && !isDraggingSubtitle && !isDraggingImage && onCharacterCustomPositionsChange) {
      // Update custom position with x/y coordinates
      const currentCustomPositions = characterCustomPositions || {};
      const newCustomPositions = {
        ...currentCustomPositions,
        [draggedCharacterName]: { x, y },
      };
      console.log('📍 Character custom position updated:', {
        character: draggedCharacterName,
        position: { x, y },
        allPositions: newCustomPositions,
      });
      onCharacterCustomPositionsChange(newCustomPositions);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragOverlayId(null);
    setIsDraggingImage(false);
    setDragImageOverlayId(null);
    setIsDraggingSubtitle(false);
    setIsDraggingCharacter(false);
    setDraggedCharacterName(null);
  };

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragOverlayId(null);
      setIsDraggingImage(false);
      setDragImageOverlayId(null);
      setIsDraggingSubtitle(false);
      setIsDraggingCharacter(false);
      setDraggedCharacterName(null);
    };

    if (isDragging || isDraggingSubtitle || isDraggingImage || isDraggingCharacter) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, isDraggingSubtitle, isDraggingImage, isDraggingCharacter]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Debug log for browser preview mode (only once on mount/change)
  // MUST be before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (browserPreviewMode) {
      const hasVideo = videoUrl || (browserPreviewMode && backgroundVideoUrl && audioFiles && audioFiles.length > 0);
      console.log("🎬 Browser preview mode active in TikTok editor:", {
        hasVideo,
        videoUrl,
        backgroundVideoUrl,
        audioFilesCount: audioFiles?.length || 0,
        audioFiles: audioFiles?.map((af: { speaker: string; publicUrl: string | null; startMs: number }) => ({ speaker: af.speaker, hasUrl: !!af.publicUrl, startMs: af.startMs }))
      });
    }
  }, [browserPreviewMode, videoUrl, backgroundVideoUrl, audioFiles?.length]);

  // Show video if we have a URL, even if status is not READY (e.g., DRAFT)
  // In browser preview mode, show video if we have backgroundVideoUrl and audioFiles
  // Only show placeholder if there's no video URL and not in browser preview mode
  const hasVideo = videoUrl || (browserPreviewMode && backgroundVideoUrl && audioFiles && audioFiles.length > 0);
  
  if (!hasVideo) {
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
          key={videoSource || 'video'} // Force re-render when source changes
          ref={videoRef}
          src={videoSource || undefined}
          className="h-full w-full object-cover"
          loop={browserPreviewMode ? false : true} // Don't loop in browser preview mode
          muted={browserPreviewMode}
          playsInline
          onTimeUpdate={(e) => {
            // In browser preview mode, prevent video from going beyond audio duration
            if (browserPreviewMode && mergedDurationMs) {
              const videoTimeMs = e.currentTarget.currentTime * 1000;
              if (videoTimeMs >= mergedDurationMs) {
                e.currentTarget.pause();
                e.currentTarget.currentTime = mergedDurationMs / 1000;
                setIsPlaying(false);
              }
            }
          }}
        />
        
        {/* Hidden audio element for browser preview mode */}
        {browserPreviewMode && (mergedAudioUrl || audioFiles.length > 0) && (
          <audio
            ref={audioRef}
            preload="auto"
            crossOrigin="anonymous"
            style={{ display: 'none' }}
          />
        )}

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

        {/* Render Characters (browser preview mode) */}
        {browserPreviewMode && activeCharacter && activeCharacter.character && (
          (() => {
            const character = activeCharacter.character!;
            const speakerName = character.name;
            
            // Remotion render dimensions (1080x1920)
            const REMOTION_WIDTH = 1080;
            const REMOTION_HEIGHT = 1920;
            
            // Get character size (custom or default) - these are in Remotion pixels
            const defaultSizes: CharacterSizes = {
              Peter: { width: 400, height: 500 },
              Stewie: { width: 350, height: 450 },
              Rick: { width: 800, height: 1000 },
              Brian: { width: 350, height: 450 },
              Morty: { width: 560, height: 720 },
            };
            
            const defaultPositions: CharacterPositions = {
              Peter: 'left',
              Stewie: 'right',
              Rick: 'left',
              Brian: 'right',
              Morty: 'right',
            };
            
            const remotionSize = characterSizes?.[speakerName as keyof CharacterSizes] || 
                        defaultSizes[speakerName as keyof CharacterSizes] || 
                        defaultSizes.Peter!;
            
            // Scale character size to match browser preview container
            // containerWidth is the actual width of the video container in the browser
            // Remotion renders at 1080x1920, so we scale proportionally
            // If containerWidth is 0 or not measured yet, try to get it from video element
            let effectiveWidth = containerWidth;
            if (effectiveWidth === 0 && videoRef.current) {
              effectiveWidth = videoRef.current.offsetWidth || videoRef.current.clientWidth;
              if (effectiveWidth > 0) {
                console.log('📐 Using video element width:', effectiveWidth);
              }
            }
            
            // Fallback: if still 0, use a reasonable default based on max-w-md (448px)
            if (effectiveWidth === 0) {
              effectiveWidth = 448; // Tailwind max-w-md default
              console.warn('⚠️ Container width not measured, using default:', effectiveWidth);
            }
            
            const scaleFactor = effectiveWidth / REMOTION_WIDTH;
            const scaledWidth = Math.round(remotionSize.width * scaleFactor);
            const scaledHeight = Math.round(remotionSize.height * scaleFactor);
            
            // Debug logging - check browser console to verify scaling
            console.log('🎭 Character scaling:', {
              speakerName,
              remotionSize: { width: remotionSize.width, height: remotionSize.height },
              containerWidth,
              effectiveWidth,
              REMOTION_WIDTH,
              scaleFactor: scaleFactor.toFixed(4),
              scaledSize: { width: scaledWidth, height: scaledHeight },
            });
            
            // Check if we have custom position (x/y coordinates) for this character
            const customPosition = characterCustomPositions?.[speakerName];
            
            let left: string | undefined;
            let right: string | undefined;
            let topPos: string = '65%'; // Default vertical position
            let transformX = '';
            let transformY = '';
            
            if (customPosition) {
              // Use custom x/y coordinates for free-form positioning
              left = `${customPosition.x}%`;
              topPos = `${customPosition.y}%`;
              transformX = 'translateX(-50%)';
              transformY = 'translateY(-50%)';
            } else {
              // Fall back to left/center/right positioning
              const position = characterPositions?.[speakerName as keyof CharacterPositions] || 
                              defaultPositions[speakerName as keyof CharacterPositions] || 
                              'left';
              
              const isLeft = position === 'left';
              const isCenter = position === 'center';
              const isRight = position === 'right';
              
              // Calculate positioning - match Remotion composition exactly
              if (isLeft) {
                left = '5%';
                transformX = '';
              } else if (isCenter) {
                left = '50%';
                transformX = 'translateX(-50%)';
              } else if (isRight) {
                right = '5%';
                transformX = '';
              }
              
              // Default vertical position (65% from top)
              topPos = '65%';
              transformY = 'translateY(-50%)';
            }
            
            // Apply horizontal flip for right side characters (only if not using custom position)
            const shouldFlip = !customPosition && characterPositions?.[speakerName as keyof CharacterPositions] === 'right';
            const transform = `${transformX} ${transformY} ${shouldFlip ? 'scaleX(-1)' : ''}`.trim();
            
            return (
              <div
                key={`character-${speakerName}-${currentTimeMs}`}
                data-character-element="true"
                className={cn(
                  "absolute z-10 transition-opacity duration-200",
                  isDraggingCharacter && draggedCharacterName === speakerName 
                    ? "cursor-grabbing opacity-90 scale-105 pointer-events-auto" 
                    : (onCharacterPositionsChange || onCharacterCustomPositionsChange)
                    ? "cursor-grab pointer-events-auto" 
                    : "pointer-events-none"
                )}
                style={{
                  position: 'absolute', // Explicitly set to match Remotion
                  left: left,
                  right: right,
                  top: topPos, // Use custom top if available, otherwise default to 65%
                  transform: transform,
                  width: `${scaledWidth}px`,
                  height: `${scaledHeight}px`,
                  objectFit: 'contain', // Match Remotion
                  filter: 'drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.5))', // Match Remotion exactly
                  zIndex: isDraggingCharacter && draggedCharacterName === speakerName ? 50 : 20, // Higher z-index when dragging
                }}
                onMouseDown={(e) => {
                  if (onCharacterPositionsChange || onCharacterCustomPositionsChange) {
                    handleCharacterMouseDown(e, speakerName);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Image
                  src={character.avatarUrl}
                  alt={speakerName}
                  width={scaledWidth}
                  height={scaledHeight}
                  className="object-contain"
                  unoptimized
                />
              </div>
            );
          })()
        )}

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={togglePlayPause}
            className="flex-shrink-0 rounded-full"
            disabled={browserPreviewMode && isAudioPreloading}
            title={browserPreviewMode && isAudioPreloading ? `Loading audio files... ${Math.round(audioPreloadProgress)}%` : undefined}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          {browserPreviewMode && isAudioPreloading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${audioPreloadProgress}%` }}
                />
              </div>
              <span>{Math.round(audioPreloadProgress)}%</span>
            </div>
          )}
        </div>
        
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

