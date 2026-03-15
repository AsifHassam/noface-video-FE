"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { 
  Play, 
  Pause, 
  Plus, 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon,
  Music,
  Type,
  FileText,
  Mic,
  Sparkles,
  Film,
  Volume2,
  VolumeX,
  Undo2,
  Redo2,
  Share2,
  Bell,
  HelpCircle,
  Settings,
  Maximize,
  ZoomIn,
  ZoomOut,
  Scissors,
  Hand,
  User,
  Move,
  RotateCw,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Gauge,
  X,
  Trash2,
  Loader2,
  Wand2,
  Download,
  CheckCircle2,
  Save,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { v4 as uuid } from "uuid";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type { SubtitleSegment, SubtitleStyle, SubtitlePosition, SubtitleFontFamily } from "@/types";
import { SubtitleStyleSelector } from "./subtitle-style-selector";
import { getSubtitleStyle, OUTLINED_STYLE, STYLE_KARAOKE_PINK, STYLE_MAGIC_LOOPS, STYLE_BOLD_GREEN } from "@/lib/data/subtitle-styles";
import { SubtitlesEditor } from "./subtitles-editor";
import { serializeSrt, parseSrtText } from "@/lib/utils/srt";
import { bRollsApi, type BRoll } from "@/lib/api/b-rolls";
import {
  createUGCProject,
  getUGCProject,
  updateUGCProject,
  saveVoiceGeneration,
  saveGeneratedVideo,
  getUserGeneratedVideos,
  uploadVideoToStorage,
  uploadAudioToStorage,
  getUserUploadedImages,
  getUserUploadedVideos,
  getUserUploadedAudios,
  deleteUploadedImage,
  deleteUploadedVideo,
  deleteUploadedAudio,
  deleteGeneratedVideo,
  base64ToBlob
} from "@/lib/api/ugc-videos";
import { subscriptionApi } from "@/lib/api/subscription";
import { listCharacters } from "@/lib/api/avatar";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useProjectStore } from "@/lib/stores/project-store";
import type { UGCVideoProject, UGCGeneratedVideo } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Types
type Scene = {
  id: string;
  name: string;
  thumbnail?: string;
  duration: number;
};

type Asset = {
  id: string;
  name: string;
  type: "audio" | "image" | "video";
  url: string;
  thumbnail?: string;
};

type Caption = {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
};

type TimelineTrack = {
  id: string;
  type: "video" | "audio" | "overlay";
  assetId?: string;
  startTime: number;
  endTime: number;
  layer: number;
};

type CanvasElement = {
  id: string;
  type: "video" | "image" | "text" | "audio";
  url?: string;
  text?: string;
  x: number; // Canvas position in percentage (0-100) - SPATIAL
  y: number; // Canvas position in percentage (0-100) - SPATIAL
  width: number; // Canvas width in percentage - SPATIAL
  height: number; // Canvas height in percentage - SPATIAL
  rotation: number; // Rotation in degrees
  opacity: number; // Opacity 0-1
  zIndex: number; // Layer order
  fontSize?: number; // For text elements
  fontColor?: string; // For text elements
  fontFamily?: string; // For text elements
  // Image panning (for positioning image content within element bounds)
  imageOffsetX?: number; // Image position offset X in percentage (-100 to 100)
  imageOffsetY?: number; // Image position offset Y in percentage (-100 to 100)
  // Image cropping (for cropping image content)
  cropX?: number; // Crop area X position in percentage (0-100)
  cropY?: number; // Crop area Y position in percentage (0-100)
  cropWidth?: number; // Crop area width in percentage (0-100)
  cropHeight?: number; // Crop area height in percentage (0-100)
  // Timeline properties (TEMPORAL - separate from canvas position)
  startTime?: number; // Start time in milliseconds (for timeline)
  duration?: number; // Duration in milliseconds (for timeline)
  thumbnail?: string; // Thumbnail URL for timeline display
  muted?: boolean; // Mute state for video elements
  videoStartOffset?: number; // Offset in milliseconds - where in the video file to start playing from (for trimming)
  audioStartOffset?: number; // Offset in milliseconds - where in the audio file to start playing from (for trimming)
  circleFrame?: boolean; // When true, clip video/image to a circular frame (e.g. PiP style)
};

type SidebarSection = "avatars" | "media" | "templates" | "elements" | "audio" | "text" | "captions" | "brolls";

type Avatar = {
  id: string;
  name: string;
  url: string;
};

const DEFAULT_AVATAR_IDS = new Set(["avatar_1", "avatar_2", "avatar_3", "avatar_4", "avatar_5", "avatar_6", "avatar_7"]);

// Component to generate thumbnail for videos that don't have one yet
const VideoThumbnailGenerator = ({ 
  videoUrl, 
  elementId, 
  onThumbnailGenerated 
}: { 
  videoUrl: string; 
  elementId: string; 
  onThumbnailGenerated: (thumbnail: string) => void;
}) => {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!videoRef.current || thumbnail || error) return;

    const video = videoRef.current;
    let timeoutId: NodeJS.Timeout;
    
    const handleLoadedMetadata = () => {
      // Seek to the very beginning (0 seconds) for thumbnail
      video.currentTime = 0;
      // Set timeout in case seeked doesn't fire
      timeoutId = setTimeout(() => {
        if (!thumbnail) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 160;
            canvas.height = 90;
            const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha channel
            if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
              // Clear canvas with transparent background
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              // Draw video frame
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // Use PNG format to preserve transparency
              const thumb = canvas.toDataURL('image/png');
              setThumbnail(thumb);
              onThumbnailGenerated(thumb);
            }
          } catch (err) {
            console.error('Error generating thumbnail (timeout):', err);
            setError(true);
          }
        }
      }, 2000);
    };

    const handleSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha channel for transparency
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          // Clear canvas with transparent background
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Draw video frame (will preserve transparency if video has alpha)
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Use PNG format to preserve transparency
          const thumb = canvas.toDataURL('image/png');
          setThumbnail(thumb);
          onThumbnailGenerated(thumb);
          if (timeoutId) clearTimeout(timeoutId);
        } else {
          // If video dimensions aren't ready, wait a bit
          setTimeout(() => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              const canvas = document.createElement('canvas');
              canvas.width = 160;
              canvas.height = 90;
              const ctx = canvas.getContext('2d', { alpha: true }); // Enable alpha channel
              if (ctx) {
                // Clear canvas with transparent background
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Draw video frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Use PNG format to preserve transparency
                const thumb = canvas.toDataURL('image/png');
                setThumbnail(thumb);
                onThumbnailGenerated(thumb);
              }
            }
          }, 500);
        }
      } catch (err) {
        console.error('Error generating thumbnail:', err);
        setError(true);
      }
    };

    const handleError = () => {
      console.error('Video failed to load for thumbnail:', videoUrl);
      setError(true);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [videoUrl, thumbnail, onThumbnailGenerated, error]);

  if (thumbnail) {
    return (
      <div 
        className="h-full w-full"
        style={{ 
          backgroundImage: `url(${thumbnail})`,
          backgroundSize: '50px 100%',
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'left center'
        }}
      />
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-300 text-[8px] text-gray-600 rounded">
        Error
      </div>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        muted
        preload="metadata"
        crossOrigin="anonymous"
        playsInline
      />
      <div className="h-full w-full flex items-center justify-center bg-gray-200 text-[8px] text-gray-500 rounded">
        Loading...
      </div>
    </>
  );
};

// Audio Waveform Component
const AudioWaveform: React.FC<{
  audioUrl?: string;
  audioStartOffset: number;
  duration: number;
  width: string;
  height: string;
}> = ({ audioUrl, audioStartOffset, duration, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width || 200;
      canvas.height = rect.height || 40;
    };
    updateCanvasSize();

    // Initialize Web Audio API
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let audioSource: MediaElementAudioSourceNode | null = null;
    let animationFrameId: number;

    const initAudio = async () => {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256; // Smaller FFT for more bars
        analyser.smoothingTimeConstant = 0.8;

        const audio = new Audio(audioUrl);
        audio.crossOrigin = 'anonymous';
        audio.preload = 'metadata';
        
        audioSource = audioContext.createMediaElementSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioContext.destination);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        // Draw waveform using frequency data
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
          if (!analyser || !ctx) return;
          
          analyser.getByteFrequencyData(dataArray);
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          
          const barCount = Math.min(50, Math.floor(canvas.width / 4)); // Limit bars for performance
          const barWidth = canvas.width / barCount;
          const centerY = canvas.height / 2;
          
          for (let i = 0; i < barCount; i++) {
            const dataIndex = Math.floor((i / barCount) * bufferLength);
            const barHeight = (dataArray[dataIndex] / 255) * (canvas.height * 0.8);
            const x = i * barWidth;
            
            // Draw symmetrical waveform bars
            ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
          }
          
          animationFrameId = requestAnimationFrame(draw);
        };

        // Start drawing when audio metadata loads
        audio.addEventListener('loadedmetadata', () => {
          draw();
        });

        // Fallback: Generate synthetic waveform if audio doesn't load
        setTimeout(() => {
          if (!analyserRef.current) {
            const numBars = Math.max(20, Math.floor(canvas.width / 3));
            const bars: number[] = [];
            
            for (let i = 0; i < numBars; i++) {
              // Generate wave-like pattern (sine wave with variation)
              const wave = Math.sin((i / numBars) * Math.PI * 4) * 0.3 + 0.5;
              bars.push(Math.max(0.2, Math.min(1.0, wave + (Math.random() * 0.2 - 0.1))));
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            
            const barWidth = canvas.width / bars.length;
            const centerY = canvas.height / 2;
            
            bars.forEach((barHeight, i) => {
              const x = i * barWidth;
              const barHeightPx = (barHeight * canvas.height) / 2;
              ctx.fillRect(x, centerY - barHeightPx, barWidth - 1, barHeightPx * 2);
            });
          }
        }, 1000);
      } catch (error) {
        console.error('Error initializing audio waveform:', error);
        // Fallback to synthetic waveform
        const numBars = Math.max(20, Math.floor(canvas.width / 3));
        const bars: number[] = [];
        
        for (let i = 0; i < numBars; i++) {
          const wave = Math.sin((i / numBars) * Math.PI * 4) * 0.3 + 0.5;
          bars.push(Math.max(0.2, Math.min(1.0, wave + (Math.random() * 0.2 - 0.1))));
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        
        const barWidth = canvas.width / bars.length;
        const centerY = canvas.height / 2;
        
        bars.forEach((barHeight, i) => {
          const x = i * barWidth;
          const barHeightPx = (barHeight * canvas.height) / 2;
          ctx.fillRect(x, centerY - barHeightPx, barWidth - 1, barHeightPx * 2);
        });
      }
    };

    initAudio();

    // Handle window resize
    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext) {
        audioContext.close();
      }
      if (audioSource) {
        audioSource.disconnect();
      }
    };
  }, [audioUrl, audioStartOffset, duration]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ width, height, pointerEvents: 'none' }}
    />
  );
};

export function AIUGCVideoEditor({ projectId: initialProjectId }: { projectId?: string } = {}) {
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); // Current time in ms
  const [duration, setDuration] = useState(10000); // Duration in ms (default: 10 seconds, will be calculated from elements)
  const [zoom, setZoom] = useState(80);
  const [canvasZoom, setCanvasZoom] = useState(90); // Canvas zoom level (percentage)
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const mainVideoPlayerRef = useRef<HTMLVideoElement>(null);
  const [activeSidebarSection, setActiveSidebarSection] = useState<SidebarSection>("captions");
  const [avatarsDialogOpen, setAvatarsDialogOpen] = useState(false);
  const [savedAvatars, setSavedAvatars] = useState<Avatar[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [creatingProjectFromAvatar, setCreatingProjectFromAvatar] = useState(false);
  const [avatarNextError, setAvatarNextError] = useState<string | null>(null);
  const [showSpeechGeneration, setShowSpeechGeneration] = useState(false);
  const [currentStep, setCurrentStep] = useState<"speech" | "lipsync">("speech");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [speechText, setSpeechText] = useState<string>("");
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0); // Speed multiplier (0.25 to 4.0, default 1.0)
  const [selectedModel, setSelectedModel] = useState<"flash" | "alpha3">("flash"); // Model selection: flash or alpha 3
  const [emotionsEnabled, setEmotionsEnabled] = useState<boolean>(false); // Whether emotions are enabled for alpha 3
  const [generatedSpeechUrl, setGeneratedSpeechUrl] = useState<string | null>(null);
  const [generatedSpeechVoiceId, setGeneratedSpeechVoiceId] = useState<string | null>(null);
  const [generatingSpeech, setGeneratingSpeech] = useState(false);
  const [generatingLipSync, setGeneratingLipSync] = useState(false);
  const [lipSyncVideoUrl, setLipSyncVideoUrl] = useState<string | null>(null);
  const generatingLipSyncRef = useRef(false); // Ref to track generation state to prevent race conditions
  const [elevenLabsVoices, setElevenLabsVoices] = useState<Array<{ voice_id: string; name: string; category?: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const { user } = useAuthStore();
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Load user credits when component mounts or user changes
  useEffect(() => {
    const loadUserCredits = async () => {
      if (!user?.id) {
        setUserCredits(null);
        return;
      }
      
      try {
        const result = await subscriptionApi.getSubscriptionInfo();
        setUserCredits(result.subscription.credits || 0);
      } catch (error) {
        console.error("Error loading user credits:", error);
        setUserCredits(null);
      }
    };

    loadUserCredits();
  }, [user?.id]);

  // Calculate estimated credits for speech generation
  const calculateEstimatedCredits = useMemo(() => {
    if (!speechText || speechText.trim().length === 0) {
      return 0;
    }

    // Estimate duration: average speaking rate is ~150 words per minute = 2.5 words per second
    // Account for speech speed
    const words = speechText.trim().split(/\s+/).length;
    const estimatedSeconds = (words / 2.5) / speechSpeed; // Divide by speed (faster = shorter duration)
    
    // Credit rates: Flash = 0.2 credits/sec, Alpha = 0.35 credits/sec
    const creditRate = selectedModel === "flash" ? 0.2 : 0.35;
    const estimatedCredits = estimatedSeconds * creditRate;
    
    return Math.max(0.01, estimatedCredits); // Minimum 0.01 credits
  }, [speechText, selectedModel, speechSpeed]);

  // Check if user has enough credits
  const hasEnoughCredits = userCredits !== null && userCredits >= calculateEstimatedCredits;
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [lipSyncStatus, setLipSyncStatus] = useState<string>(""); // Status message for lip sync
  const [lipSyncProgress, setLipSyncProgress] = useState<number>(0); // Progress percentage
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  
  // UGC Project state
  const [currentProject, setCurrentProject] = useState<UGCVideoProject | null>(null);
  const currentProjectRef = useRef<UGCVideoProject | null>(null);
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [projectTitle, setProjectTitle] = useState<string>("");
  const [voiceGenerationId, setVoiceGenerationId] = useState<string | null>(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadedVideos, setUploadedVideos] = useState<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>>([]);
  const [loadingUploadedVideos, setLoadingUploadedVideos] = useState(false);
  const [uploadedAudios, setUploadedAudios] = useState<Array<{ id: string; url: string; name: string; storage_path: string; created_at: string }>>([]);
  const [loadingAudios, setLoadingAudios] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  // B-rolls state
  const [bRolls, setBRolls] = useState<BRoll[]>([]);
  const [loadingBRolls, setLoadingBRolls] = useState(false);
  const [selectedBRollIds, setSelectedBRollIds] = useState<string[]>([]); // Max 5 selected
  const [jumpCutInterval, setJumpCutInterval] = useState<number | null>(null); // In seconds
  const [fillJumpCutsDialogOpen, setFillJumpCutsDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [generatedVideos, setGeneratedVideos] = useState<UGCGeneratedVideo[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // Track where to insert a new element (after which element)
  const [insertAfterElementId, setInsertAfterElementId] = useState<string | null>(null);
  
  // Track timeline container width to calculate scale that fits on screen
  const [timelineContainerWidth, setTimelineContainerWidth] = useState<number>(0);
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Load project if projectId is provided
  useEffect(() => {
    if (initialProjectId && !currentProject) {
      const loadProject = async () => {
        try {
          console.log('[Load] Loading project from URL:', initialProjectId);
          const project = await getUGCProject(initialProjectId);
          setCurrentProject(project);
          console.log('[Load] Project loaded:', project.id);
        } catch (error: any) {
          console.error('[Load] Error loading project:', error);
          alert(`Failed to load project: ${error.message}`);
        }
      };
      loadProject();
    }
  }, [initialProjectId]); // Only run when initialProjectId changes
  
  // Measure timeline container width to ensure it fits on screen
  useEffect(() => {
    const updateContainerWidth = () => {
      if (timelineContainerRef.current) {
        const rect = timelineContainerRef.current.getBoundingClientRect();
        // Account for track controls (80px) and padding (16px)
        const availableWidth = rect.width - 80 - 16;
        if (availableWidth > 0 && availableWidth !== timelineContainerWidth) {
          setTimelineContainerWidth(availableWidth);
        }
      }
    };
    
    // Initial measurement
    const timeoutId = setTimeout(updateContainerWidth, 100);
    
    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });
    
    if (timelineContainerRef.current) {
      resizeObserver.observe(timelineContainerRef.current);
    }
    
    // Fallback to window resize
    window.addEventListener('resize', updateContainerWidth);
    
    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateContainerWidth);
    };
  }, [timelineContainerWidth]);
  
  // Calculate dynamic scale factor for timeline (pixels per second)
  // Scale is calculated to fit the timeline within the available screen width
  const timelineScale = useMemo(() => {
    if (!duration || duration === 0) return 50; // Default 50px per second
    
    const durationSeconds = duration / 1000;
    
    // If we have container width, calculate scale to fit exactly
    if (timelineContainerWidth > 0) {
      // Calculate scale so timeline fits: durationSeconds * scale <= availableWidth
      // Use 95% of width to ensure it fits comfortably with some padding
      const calculatedScale = (timelineContainerWidth * 0.95) / durationSeconds;
      
      // Set minimum and maximum scale bounds for readability
      const minScale = 5; // Minimum 5px per second (very compressed)
      const maxScale = 100; // Maximum 100px per second (very detailed)
      
      // Clamp to bounds
      return Math.max(minScale, Math.min(maxScale, calculatedScale));
    }
    
    // Fallback: use duration-based scale if container width not available yet
    if (durationSeconds <= 30) {
      return 50; // 50px per second for short videos
    } else if (durationSeconds <= 120) {
      return 20; // 20px per second for medium videos
    } else {
      return 10; // 10px per second for long videos
    }
  }, [duration, timelineContainerWidth]);
  
  // Calculate timeline width - always use 100% to fit container, scale handles the calibration
  const timelineWidth = useMemo(() => {
    // Always use 100% width - the scale factor ensures proper calibration
    // The timeline will fit within the container without scrolling
    return '100%';
  }, []);
  
  // Calculate thumbnail width based on timeline scale
  // Thumbnails should be proportional to the timeline scale
  const thumbnailWidth = useMemo(() => {
    // Base thumbnail size scales with timeline scale
    // Scale thumbnails proportionally to maintain visual consistency
    // Use approximately 1:1 ratio with scale (1 second = scale pixels)
    const baseThumbnailSize = Math.max(20, Math.min(60, timelineScale));
    return baseThumbnailSize;
  }, [timelineScale]);
  
  // Asset management
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  
  // Subtitles
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>([]);
  const [originalSubtitleSegments, setOriginalSubtitleSegments] = useState<SubtitleSegment[]>([]); // Store original for restore
  const [subtitleSrtText, setSubtitleSrtText] = useState<string>("");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("outlined");
  const [subtitlePosition, setSubtitlePosition] = useState<SubtitlePosition>({ x: 50, y: 85 });
  const [subtitleFontSize, setSubtitleFontSize] = useState<number>(100);
  const [subtitleFontFamily, setSubtitleFontFamily] = useState<SubtitleFontFamily>("bebas-neue");
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);
  const [karaokePillColor, setKaraokePillColor] = useState<string>("#E96BA8");
  const [boldGreenColor, setBoldGreenColor] = useState<string>("#63E443");
  const [subtitleSingleLine, setSubtitleSingleLine] = useState(false);
  const [subtitleSingleWord, setSubtitleSingleWord] = useState(false);
  
  // Timeline
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrack[]>([]);
  
  // Canvas elements
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isPanning, setIsPanning] = useState(false); // For panning image content within element
  const [isCropping, setIsCropping] = useState(false); // For cropping images
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null); // Crop selection start position
  const [cropArea, setCropArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // Current crop area being drawn
  const [resizeDirection, setResizeDirection] = useState<string | null>(null); // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimElementId, setTrimElementId] = useState<string | null>(null);
  const [trimEdge, setTrimEdge] = useState<'left' | 'right' | null>(null);
  const [trimStart, setTrimStart] = useState({ x: 0 }); // Only track initial mouse position
  const trimStartRef = useRef({ x: 0, startTime: 0, duration: 0, videoStartOffset: 0, audioStartOffset: 0 }); // Ref to avoid stale closures - store initial element state
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [draggingTimelineElementId, setDraggingTimelineElementId] = useState<string | null>(null);
  const [dragTimelineStart, setDragTimelineStart] = useState({ x: 0, startTime: 0 });
  // Store original media durations for hard stop enforcement
  const originalMediaDurationsRef = useRef<Map<string, number>>(new Map());
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, imageOffsetX: 50, imageOffsetY: 50 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 }); // Initial pan position
  const [timelineHeight, setTimelineHeight] = useState(160); // Timeline height in pixels (default: 160px = h-40)
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastPlayingStateRef = useRef<boolean>(false);
  const [removingBackground, setRemovingBackground] = useState<string | null>(null); // Element ID being processed
  const loadingImagesRef = useRef<boolean>(false); // Track if images are currently loading
  const loadingVideosRef = useRef<boolean>(false); // Track if videos are currently loading
  const loadingUploadedVideosRef = useRef<boolean>(false); // Track if uploaded videos are currently loading
  const [contextMenuElementId, setContextMenuElementId] = useState<string | null>(null); // Element ID for context menu
  const [isExporting, setIsExporting] = useState(false); // Export state
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null); // Exported video URL for download
  const [renderJobId, setRenderJobId] = useState<string | null>(null); // Render job ID for progress tracking
  const [renderProgress, setRenderProgress] = useState<number>(0); // Render progress percentage
  const [renderStatus, setRenderStatus] = useState<'QUEUED' | 'RENDERING' | 'READY' | 'FAILED' | null>(null); // Render status
  
  // Get subscribeToRenderJob from project store
  const { subscribeToRenderJob } = useProjectStore();
  const renderJobSubscriptionRef = useRef<any>(null); // Store subscription reference
  const [trimOverlapIndicator, setTrimOverlapIndicator] = useState<{ time: number; type: 'start' | 'end' } | null>(null); // Blue line indicator when trimming approaches another element
  
  // Subscribe to render job updates for UGC renders
  useEffect(() => {
    if (!renderJobId) return;
    
    // Unsubscribe from any existing subscription
    if (renderJobSubscriptionRef.current) {
      supabase.removeChannel(renderJobSubscriptionRef.current);
      renderJobSubscriptionRef.current = null;
    }
    
    console.log('[UGC Render] Subscribing to render job updates:', renderJobId);
    const channel = supabase
      .channel(`ugc-render-job-${renderJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'render_jobs',
          filter: `id=eq.${renderJobId}`,
        },
        (payload) => {
          const renderJob = payload.new as any;
          console.log('[UGC Render] Render job update received:', renderJob);
          
          if (!renderJob) return;
          
          const jobStatus = (renderJob.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
          
          // Map backend status to frontend status
          let frontendStatus: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
          if (jobStatus === 'completed') {
            frontendStatus = 'READY';
            setRenderProgress(100);
            if (renderJob.result_url) {
              setExportedVideoUrl(renderJob.result_url);
            }
          } else if (jobStatus === 'failed') {
            frontendStatus = 'FAILED';
          } else if (jobStatus === 'processing') {
            frontendStatus = 'RENDERING';
            setRenderProgress(renderJob.progress || 0);
          } else {
            frontendStatus = 'QUEUED';
            setRenderProgress(0);
          }
          
          setRenderStatus(frontendStatus);
          
          // Unsubscribe when completed or failed
          if (jobStatus === 'completed' || jobStatus === 'failed') {
            if (renderJobSubscriptionRef.current) {
              supabase.removeChannel(renderJobSubscriptionRef.current);
              renderJobSubscriptionRef.current = null;
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[UGC Render] Subscribed to render job updates');
        } else if (err) {
          console.error('[UGC Render] Subscription error:', err);
        }
      });
    
    renderJobSubscriptionRef.current = channel;
    
    // Cleanup on unmount or when renderJobId changes
    return () => {
      if (renderJobSubscriptionRef.current) {
        supabase.removeChannel(renderJobSubscriptionRef.current);
        renderJobSubscriptionRef.current = null;
      }
    };
  }, [renderJobId]);
  
  // Undo/Redo History
  interface HistoryState {
    canvasElements: CanvasElement[];
    subtitleSegments: SubtitleSegment[];
    subtitleStyle: SubtitleStyle;
    subtitlePosition: SubtitlePosition;
    subtitleFontSize: number;
    subtitleFontFamily: SubtitleFontFamily;
    subtitleSingleLine: boolean;
    subtitleSingleWord: boolean;
    karaokePillColor: string;
    boldGreenColor: string;
    zoom: number;
  }
  
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistorySize = 50; // Maximum number of history states to keep
  const isUndoRedoRef = useRef(false); // Flag to prevent saving history during undo/redo
  const exportedVideoUrlRef = useRef<string | null>(null); // Ref to always have the latest URL
  
  // Keep ref in sync with state
  useEffect(() => {
    exportedVideoUrlRef.current = exportedVideoUrl;
    console.log('[Export URL Sync] Updated ref to:', exportedVideoUrl);
  }, [exportedVideoUrl]);

  // Sync currentProject state to ref
  useEffect(() => {
    currentProjectRef.current = currentProject;
    console.log('[Project Ref Sync] Updated ref to:', currentProject?.id);
  }, [currentProject]);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    if (isUndoRedoRef.current) return; // Don't save during undo/redo
    
    const currentState: HistoryState = {
      canvasElements: JSON.parse(JSON.stringify(canvasElements)), // Deep clone
      subtitleSegments: JSON.parse(JSON.stringify(subtitleSegments)), // Deep clone
      subtitleStyle,
      subtitlePosition: { ...subtitlePosition },
      subtitleFontSize,
      subtitleFontFamily,
      subtitleSingleLine,
      subtitleSingleWord,
      karaokePillColor,
      boldGreenColor,
      zoom,
    };
    
    setHistory(prev => {
      // Remove any states after current index (when user does new action after undo)
      const newHistory = prev.slice(0, historyIndex + 1);
      // Add new state
      const updatedHistory = [...newHistory, currentState];
      // Limit history size
      if (updatedHistory.length > maxHistorySize) {
        return updatedHistory.slice(-maxHistorySize);
      }
      return updatedHistory;
    });
    
    setHistoryIndex(prev => {
      const newIndex = prev + 1;
      // Limit index to history size
      return Math.min(newIndex, maxHistorySize - 1);
    });
  }, [
    canvasElements,
    subtitleSegments,
    subtitleStyle,
    subtitlePosition,
    subtitleFontSize,
    subtitleFontFamily,
    subtitleSingleLine,
    subtitleSingleWord,
    karaokePillColor,
    boldGreenColor,
    zoom,
    historyIndex,
  ]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return; // No history to undo to
    
    isUndoRedoRef.current = true;
    const previousState = history[historyIndex - 1];
    
    if (previousState) {
      setCanvasElements(previousState.canvasElements);
      setSubtitleSegments(previousState.subtitleSegments);
      setSubtitleStyle(previousState.subtitleStyle);
      setSubtitlePosition(previousState.subtitlePosition);
      setSubtitleFontSize(previousState.subtitleFontSize);
      setSubtitleFontFamily(previousState.subtitleFontFamily);
      setSubtitleSingleLine(previousState.subtitleSingleLine);
      setSubtitleSingleWord(previousState.subtitleSingleWord);
      setKaraokePillColor(previousState.karaokePillColor);
      setBoldGreenColor(previousState.boldGreenColor);
      setZoom(previousState.zoom);
    }
    
    setHistoryIndex(prev => prev - 1);
    
    // Reset flag after state updates
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [history, historyIndex]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return; // No history to redo to
    
    isUndoRedoRef.current = true;
    const nextState = history[historyIndex + 1];
    
    if (nextState) {
      setCanvasElements(nextState.canvasElements);
      setSubtitleSegments(nextState.subtitleSegments);
      setSubtitleStyle(nextState.subtitleStyle);
      setSubtitlePosition(nextState.subtitlePosition);
      setSubtitleFontSize(nextState.subtitleFontSize);
      setSubtitleFontFamily(nextState.subtitleFontFamily);
      setSubtitleSingleLine(nextState.subtitleSingleLine);
      setSubtitleSingleWord(nextState.subtitleSingleWord);
      setKaraokePillColor(nextState.karaokePillColor);
      setBoldGreenColor(nextState.boldGreenColor);
      setZoom(nextState.zoom);
    }
    
    setHistoryIndex(prev => prev + 1);
    
    // Reset flag after state updates
    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  }, [history, historyIndex]);

  // Initialize history with current state on mount
  useEffect(() => {
    if (history.length === 0) {
      const initialState: HistoryState = {
        canvasElements: JSON.parse(JSON.stringify(canvasElements)),
        subtitleSegments: JSON.parse(JSON.stringify(subtitleSegments)),
        subtitleStyle,
        subtitlePosition: { ...subtitlePosition },
        subtitleFontSize,
        subtitleFontFamily,
        subtitleSingleLine,
        subtitleSingleWord,
        karaokePillColor,
        boldGreenColor,
        zoom,
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, []); // Only run once on mount

  // Save to history when state changes (debounced to avoid too many saves)
  // Only save after user actions, not during undo/redo or initial load
  const saveHistoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (history.length === 0 || isUndoRedoRef.current) return; // Skip if no history yet or during undo/redo
    
    // Clear previous timeout
    if (saveHistoryTimeoutRef.current) {
      clearTimeout(saveHistoryTimeoutRef.current);
    }
    
    // Debounce history saves to avoid saving on every tiny change
    saveHistoryTimeoutRef.current = setTimeout(() => {
      if (!isUndoRedoRef.current) {
        saveToHistory();
      }
    }, 500); // Wait 500ms after last change before saving
    
    return () => {
      if (saveHistoryTimeoutRef.current) {
        clearTimeout(saveHistoryTimeoutRef.current);
      }
    };
  }, [
    canvasElements,
    subtitleSegments,
    subtitleStyle,
    subtitlePosition,
    subtitleFontSize,
    subtitleFontFamily,
    subtitleSingleLine,
    subtitleSingleWord,
    karaokePillColor,
    boldGreenColor,
    zoom,
    saveToHistory,
  ]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z or Ctrl+Y or Cmd+Shift+Z or Cmd+Y for redo
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  // Format time
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      const fileType = file.type.split("/")[0];
      if (fileType === "image" || fileType === "video" || fileType === "audio") {
        try {
          setUploadingFileName(file.name);
          
          if (fileType === "image") {
            // Upload image via backend endpoint
            const formData = new FormData();
            formData.append('image', file);

            // Get auth token from cache (avoids hanging getSession calls)
            const { getCachedToken } = await import('@/lib/utils/token-cache');
            const cachedToken = await getCachedToken();
            const headers: HeadersInit = {};
            if (cachedToken) {
              headers['Authorization'] = `Bearer ${cachedToken}`;
            }

            const response = await fetch(`${config.remotionServerUrl}/user/upload-image`, {
              method: 'POST',
              headers,
              body: formData,
              // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success && data.url) {
              const newAsset: Asset = {
                id: uuid(),
                name: file.name,
                type: "image",
                url: data.url,
              };
              setAssets([...assets, newAsset]);
              
              // Reload uploaded images list (non-blocking)
              loadUploadedImages().catch(err => console.error("Failed to reload images:", err));
              setUploadingFileName(null);
            } else {
              throw new Error(data.error || 'Failed to upload image');
            }
          } else if (fileType === "video") {
            // Upload video via backend endpoint
            const formData = new FormData();
            formData.append('video', file);

            // Get auth token from cache (avoids hanging getSession calls)
            const { getCachedToken } = await import('@/lib/utils/token-cache');
            const cachedToken = await getCachedToken();
            const headers: HeadersInit = {};
            if (cachedToken) {
              headers['Authorization'] = `Bearer ${cachedToken}`;
            }

            const response = await fetch(`${config.remotionServerUrl}/user/upload-video`, {
              method: 'POST',
              headers,
              body: formData,
              // Don't set Content-Type header - browser will set it with boundary for multipart/form-data
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
              throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success && data.url) {
              const newAsset: Asset = {
                id: uuid(),
                name: file.name,
                type: "video",
                url: data.url,
              };
              setAssets([...assets, newAsset]);
              
              // Reload uploaded videos list (non-blocking)
              loadUploadedVideos().catch(err => console.error("Failed to reload videos:", err));
              setUploadingFileName(null);
            } else {
              throw new Error(data.error || 'Failed to upload video');
            }
          } else if (fileType === "audio") {
            // Upload audio via Supabase Storage
            ensureProjectExists();
            const projectId = currentProject?.id || uuid();
            
            const fileName = `audio-${uuid()}.${file.name.split('.').pop()}`;
            const audioUrl = await uploadAudioToStorage(file, projectId, fileName);
            
            // Save metadata to database using REST API (avoids hanging Supabase client calls)
            const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
            let token = await getCachedToken();
            
            if (token) {
              try {
                // Extract userId from token
                const payload = JSON.parse(atob(token.split('.')[1]));
                const userId = payload.sub || payload.user_id;
                
                if (userId) {
                  const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
                  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                  
                  if (supabaseUrl && supabaseAnonKey) {
              const storagePath = `ugc-audio/${projectId}/${fileName}`;
                    const insertUrl = `${supabaseUrl}/rest/v1/user_uploads`;
                    
                    const makeRequest = async (authToken: string) => {
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => controller.abort(), 10000);
                      try {
                        const response = await fetch(insertUrl, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                            'apikey': supabaseAnonKey,
                            'Prefer': 'return=minimal'
                          },
                          body: JSON.stringify({
                            user_id: userId,
                file_name: fileName,
                file_type: 'audio',
                storage_path: storagePath,
                storage_url: audioUrl,
                file_size: file.size,
                mime_type: file.type,
                metadata: {}
                          }),
                          signal: controller.signal
                        });
                        clearTimeout(timeoutId);
                        return response;
                      } catch (err) {
                        clearTimeout(timeoutId);
                        throw err;
                      }
                    };
                    
                    let response = await makeRequest(token);
                    
                    // Handle 401 - refresh token and retry
                    if (response.status === 401) {
                      const refreshedToken = await refreshToken();
                      if (refreshedToken) {
                        response = await makeRequest(refreshedToken);
                      }
                    }
                    
                    if (!response.ok) {
                      console.warn('[Audio Upload] Failed to save metadata:', response.status);
                    }
                  }
                }
              } catch (error) {
                console.warn('[Audio Upload] Error saving metadata:', error);
                // Continue even if metadata save fails
              }
            }
            
            // Calculate startTime: place after the last audio element, but ensure it fits within timeline
            const existingAudioElements = canvasElements.filter(el => el.type === "audio");
            let audioStartTime = 0;
            if (existingAudioElements.length > 0) {
              // Find the last audio element's end time
              const lastAudio = existingAudioElements.reduce((latest, el) => {
                const elEndTime = (el.startTime || 0) + (el.duration || 5000);
                const latestEndTime = (latest.startTime || 0) + (latest.duration || 5000);
                return elEndTime > latestEndTime ? el : latest;
              });
              const calculatedStartTime = (lastAudio.startTime || 0) + (lastAudio.duration || 5000);
              // Ensure the audio fits within the timeline
              // If it would exceed, place it at the start instead
              audioStartTime = Math.max(0, Math.min(calculatedStartTime, duration - 5000)); // Leave room for at least 5s duration
            }
            
            // Add to canvas as audio element
            const audioElement: CanvasElement = {
              id: uuid(),
              type: "audio",
              url: audioUrl,
              x: 50,
              y: 50,
              width: 50,
              height: 50,
              startTime: audioStartTime,
              duration: 5000, // Will be updated when audio loads
              audioStartOffset: 0, // Initialize audio start offset for trimming
              muted: false,
              rotation: 0,
              opacity: 1,
              zIndex: canvasElements.length,
            };
            
            setCanvasElements([...canvasElements, audioElement]);
            await loadUploadedAudios();
            setUploadingFileName(null);
          }
        } catch (error) {
          console.error(`Error uploading ${fileType}:`, error);
          alert(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setUploadingFileName(null);
        }
      }
    }
    
    setIsUploading(false);
    setUploadingFileName(null);
    
    // Reset input
    event.target.value = '';
  };

  // Load uploaded images from Supabase
  const loadUploadedImages = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingImagesRef.current) {
      console.log('[Media] Already loading images, skipping...');
      return;
    }
    
    loadingImagesRef.current = true;
    setLoadingImages(true);
    try {
      // Add timeout to prevent infinite loading (60 seconds - increased for slow connections)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 60000)
      );
      
      const images = await Promise.race([
        getUserUploadedImages(),
        timeoutPromise
      ]);
      
      console.log("Loaded uploaded images:", images);
      setUploadedImages(images);
    } catch (error: any) {
      console.error("Error loading uploaded images:", error);
      // Set empty array on error so UI doesn't stay in loading state
      setUploadedImages([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load uploaded images, continuing with empty list");
      }
    } finally {
      loadingImagesRef.current = false;
      setLoadingImages(false);
    }
  }, []);

  const loadUploadedVideos = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingUploadedVideosRef.current) {
      console.log('[Media] Already loading uploaded videos, skipping...');
      return;
    }
    
    loadingUploadedVideosRef.current = true;
    setLoadingUploadedVideos(true);
    try {
      // Add timeout to prevent infinite loading (60 seconds - increased for slow connections)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 60000)
      );
      
      const videos = await Promise.race([
        getUserUploadedVideos(),
        timeoutPromise
      ]);
      
      console.log("Loaded uploaded videos:", videos);
      setUploadedVideos(videos);
    } catch (error: any) {
      console.error("Error loading uploaded videos:", error);
      // Set empty array on error so UI doesn't stay in loading state
      setUploadedVideos([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load uploaded videos, continuing with empty list");
      }
    } finally {
      loadingUploadedVideosRef.current = false;
      setLoadingUploadedVideos(false);
    }
  }, []);

  // Delete handlers
  const handleDeleteImage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this image?')) {
      return;
    }
    try {
      await deleteUploadedImage(id);
      setUploadedImages(uploadedImages.filter(img => img.id !== id));
    } catch (error) {
      console.error("Error deleting image:", error);
      alert('Failed to delete image. Please try again.');
    }
  };

  const handleDeleteVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }
    try {
      await deleteUploadedVideo(id);
      setUploadedVideos(uploadedVideos.filter(vid => vid.id !== id));
    } catch (error) {
      console.error("Error deleting video:", error);
      alert('Failed to delete video. Please try again.');
    }
  };

  const handleDeleteGeneratedVideo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this generated video?')) {
      return;
    }
    try {
      await deleteGeneratedVideo(id);
      setGeneratedVideos(generatedVideos.filter(vid => vid.id !== id));
    } catch (error) {
      console.error("Error deleting generated video:", error);
      alert('Failed to delete generated video. Please try again.');
    }
  };

  const loadUploadedAudios = async () => {
    setLoadingAudios(true);
    try {
      // Add timeout to prevent infinite loading (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      const audios = await Promise.race([
        getUserUploadedAudios(),
        timeoutPromise
      ]);
      
      console.log("Loaded uploaded audios:", audios);
      setUploadedAudios(audios);
    } catch (error: any) {
      console.error("Error loading uploaded audios:", error);
      // Set empty array on error so UI doesn't stay in loading state
      setUploadedAudios([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load uploaded audios, continuing with empty list");
      }
    } finally {
      setLoadingAudios(false);
    }
  };

  const handleDeleteAudio = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this audio?')) {
      return;
    }
    try {
      await deleteUploadedAudio(id);
      setUploadedAudios(uploadedAudios.filter(audio => audio.id !== id));
    } catch (error) {
      console.error("Error deleting audio:", error);
      alert('Failed to delete audio. Please try again.');
    }
  };

  const loadBRolls = useCallback(async () => {
    setLoadingBRolls(true);
    try {
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );
      
      const result = await Promise.race([
        bRollsApi.list(),
        timeoutPromise
      ]);
      
      console.log("Loaded B-rolls:", result.bRolls);
      setBRolls(result.bRolls || []);
    } catch (error: any) {
      console.error("Error loading B-rolls:", error);
      setBRolls([]);
      if (error.message !== 'Request timeout') {
        console.warn("Failed to load B-rolls, continuing with empty list");
      }
    } finally {
      setLoadingBRolls(false);
    }
  }, []);

  // Load B-rolls when B-rolls section is activated
  useEffect(() => {
    if (activeSidebarSection === "brolls" && bRolls.length === 0 && !loadingBRolls) {
      loadBRolls();
    }
  }, [activeSidebarSection, bRolls.length, loadingBRolls, loadBRolls]);

  /**
   * Generate B-roll clips at specified intervals
   * @param totalDurationMs - Total video duration in milliseconds
   * @param intervalSeconds - Jump cut interval in seconds
   * @param selectedBRolls - Array of selected B-roll objects
   * @returns Array of CanvasElement objects for B-roll clips
   */
  const generateBRollClips = (
    totalDurationMs: number,
    intervalSeconds: number,
    selectedBRolls: BRoll[]
  ): CanvasElement[] => {
    console.log('🔍 generateBRollClips called with:', {
      totalDurationMs,
      intervalSeconds,
      selectedBRollsCount: selectedBRolls.length,
      selectedBRolls: selectedBRolls.map(b => ({ id: b.id, name: b.name, url: b.url, durationSeconds: b.durationSeconds }))
    });

    if (selectedBRolls.length === 0 || intervalSeconds <= 0) {
      console.warn('⚠️ generateBRollClips: Invalid input - selectedBRolls.length:', selectedBRolls.length, 'intervalSeconds:', intervalSeconds);
      return [];
    }

    const clips: CanvasElement[] = [];
    const intervalMs = intervalSeconds * 1000;
    const clipDurationMs = 3000; // 3 seconds per clip
    const totalDurationSeconds = totalDurationMs / 1000;

    console.log('📊 Generating clips:', {
      totalDurationSeconds,
      intervalSeconds,
      expectedClips: Math.floor((totalDurationSeconds - intervalSeconds) / intervalSeconds) + 1
    });

    // Generate clips at each interval (start from intervalSeconds, end before totalDurationSeconds)
    for (let time = intervalSeconds; time < totalDurationSeconds; time += intervalSeconds) {
      console.log(`🔄 Generating clip at ${time}s`);
      // Randomly select a B-roll from the selected ones
      const randomBRoll = selectedBRolls[Math.floor(Math.random() * selectedBRolls.length)];
      
      if (!randomBRoll || !randomBRoll.url) {
        console.warn('⚠️ B-roll missing URL:', randomBRoll);
        continue;
      }

      // Calculate random start offset within the B-roll video
      // Ensure we can play at least 3 seconds from the start point
      const bRollDurationSeconds = randomBRoll.durationSeconds || 10; // Default 10s if not available
      const maxStartOffsetSeconds = Math.max(0, bRollDurationSeconds - 3); // Leave 3s for clip
      const randomStartOffsetSeconds = Math.random() * maxStartOffsetSeconds;
      const videoStartOffsetMs = randomStartOffsetSeconds * 1000;

      // Create clip element
      const clip: CanvasElement = {
        id: uuid(),
        type: "video",
        url: randomBRoll.url,
        x: 0, // Full screen overlay
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 1000 + clips.length, // High z-index to be on top
        startTime: time * 1000, // Start at the interval time
        duration: clipDurationMs, // 3 seconds
        videoStartOffset: videoStartOffsetMs, // Random start point in the B-roll video
        muted: true, // B-rolls are overlays, typically muted
      };

      clips.push(clip);
    }

    return clips;
  };

  // Toggle playback
  const togglePlayback = () => {
    if (mainVideoPlayerRef.current) {
      if (isPlaying) {
        mainVideoPlayerRef.current.pause();
      } else {
        mainVideoPlayerRef.current.play().catch((err) => {
          // Ignore AbortError - it's expected when play() is interrupted by pause()
          if (err.name !== 'AbortError') {
            console.error('Error playing main video:', err);
          }
        });
      }
      setIsPlaying(!isPlaying);
    } else {
      // If no main video, toggle canvas video elements
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
          if (video) {
            // Apply playback rate with preservesPitch
            setVideoPlaybackRate(video, playbackRate);
            if (isPlaying) {
              video.pause();
            } else {
              video.play().catch((err) => {
                // Ignore AbortError - it's expected when play() is interrupted by pause()
                if (err.name !== 'AbortError') {
                  console.error('Error playing canvas video:', err);
                }
              });
            }
          }
        }
      });
      setIsPlaying(!isPlaying);
    }
  };

  // Handle timeline scrub
  const handleTimelineScrub = (newTime: number) => {
    const clampedTime = Math.max(0, Math.min(duration, newTime));
    setCurrentTime(clampedTime);
    
    if (mainVideoPlayerRef.current) {
      mainVideoPlayerRef.current.currentTime = clampedTime / 1000;
    }
    
    // Update all canvas video elements - account for each element's startTime
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video) {
          const elementStartTime = element.startTime || 0;
          const elementDuration = element.duration || (video.duration * 1000 || 5000);
          const elementEndTime = elementStartTime + elementDuration;
          
          // Only update video if timeline is within its startTime range
          if (clampedTime >= elementStartTime && clampedTime < elementEndTime) {
            const videoStartOffset = element.videoStartOffset || 0;
            const videoTime = (videoStartOffset + (clampedTime - elementStartTime)) / 1000;
            
            // Calculate trimmed start and end times
            const trimmedStartTime = videoStartOffset / 1000;
            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
            // Clamp video time to trimmed range
            const clampedVideoTime = Math.max(
              trimmedStartTime,
              Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
            );
            
            if (video.readyState >= 2) {
              // During scrubbing, ONLY update currentTime - don't touch playbackRate
              // This prevents audio glitches
              video.currentTime = clampedVideoTime;
              
              // Only set playbackRate when video actually starts playing (not during scrubbing)
              if (isPlaying && video.paused && clampedVideoTime < trimmedEndTime - 0.1) {
                // Video is about to start playing - set playbackRate and preservesPitch before playing
                if ('preservesPitch' in video) {
                  (video as any).preservesPitch = true;
                }
                if (video.playbackRate !== playbackRate) {
                  video.playbackRate = playbackRate;
                }
                video.play().catch((err) => {
                  // Ignore AbortError - it's expected when play() is interrupted
                  if (err.name !== 'AbortError') {
                    console.error('Error playing video:', err);
                  }
                });
              }
            }
          } else {
            // Timeline is outside video's range - pause it
            if (!video.paused) {
              video.pause();
            }
            if (clampedTime < elementStartTime) {
              // Timeline is before video starts - reset to trimmed start
              const videoStartOffset = element.videoStartOffset || 0;
              video.currentTime = videoStartOffset / 1000;
            } else if (clampedTime >= elementEndTime && video.duration) {
              // Timeline is after video ends - set to trimmed end
              const videoStartOffset = element.videoStartOffset || 0;
              const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
              video.currentTime = Math.min(trimmedEndTime, video.duration);
            }
          }
        }
      }
      
      // Update audio elements - account for each element's startTime
      if (element.type === "audio" && element.url) {
        const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
        if (audio) {
          const elementStartTime = element.startTime || 0;
          const elementDuration = element.duration || (audio.duration * 1000 || 5000);
          const elementEndTime = elementStartTime + elementDuration;
          const audioStartOffset = element.audioStartOffset || 0;
          
          // Only update audio if timeline is within its startTime range
          if (clampedTime >= elementStartTime && clampedTime < elementEndTime) {
            // Calculate audio's internal time based on timeline position and audioStartOffset
            const audioTime = (audioStartOffset + (clampedTime - elementStartTime)) / 1000;
            const clampedAudioTime = Math.max(0, Math.min(audioTime, audio.duration || Infinity));
            
            if (audio.readyState >= 2) {
              audio.currentTime = clampedAudioTime;
            }
          } else {
            // Timeline is outside audio's range - pause it
            if (!audio.paused) {
              audio.pause();
            }
            // Reset audio time appropriately
            if (clampedTime < elementStartTime) {
              audio.currentTime = audioStartOffset / 1000; // Set to audio start offset
            } else if (clampedTime >= elementEndTime && audio.duration) {
              audio.currentTime = Math.min((audioStartOffset + elementDuration) / 1000, audio.duration);
            }
          }
        }
      }
    });
  };

  // Helper function to safely set playbackRate with preservesPitch
  // skipPauseResume: if true, don't pause/resume (use during scrubbing to avoid audio glitches)
  const setVideoPlaybackRate = (video: HTMLVideoElement, rate: number, skipPauseResume: boolean = false) => {
    if (!video) return;
    
    // Set preservesPitch BEFORE setting playbackRate to prevent audio distortion
    // Try both property and attribute methods for maximum compatibility
    if ('preservesPitch' in video) {
      (video as any).preservesPitch = true;
    }
    // Also try setting as attribute (some browsers need this)
    try {
      video.setAttribute('preservespitch', 'true');
    } catch (e) {
      // Ignore if attribute setting fails
    }
    
    // During scrubbing, don't pause/resume - just set playbackRate directly
    // This prevents audio glitches when the user is dragging the timeline
    if (skipPauseResume) {
      video.playbackRate = rate;
      return;
    }
    
    // For non-scrubbing operations, pause before changing to prevent audio glitches
    const wasPlaying = !video.paused;
    if (wasPlaying) {
      video.pause();
    }
    
    // Set playbackRate
    video.playbackRate = rate;
    
    // Resume playback if it was playing
    if (wasPlaying) {
      video.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error resuming video after playbackRate change:', err);
        }
      });
    }
  };

  // Apply playback rate to all videos when playbackRate changes
  useEffect(() => {
    // Apply to main video player
    if (mainVideoPlayerRef.current) {
      setVideoPlaybackRate(mainVideoPlayerRef.current, playbackRate);
    }
    
    // Apply to all canvas video elements
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video && video.playbackRate !== playbackRate) {
          setVideoPlaybackRate(video, playbackRate);
        }
      }
    });
  }, [playbackRate]); // Only depend on playbackRate to avoid frequent updates
  
  // Apply playback rate to new videos when they're added (with a small delay to ensure DOM is ready)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
          if (video && video.playbackRate !== playbackRate) {
            setVideoPlaybackRate(video, playbackRate);
          }
        }
      });
    }, 100); // Small delay to ensure video element is in DOM
    
    return () => clearTimeout(timeoutId);
  }, [canvasElements, playbackRate]); // Run when canvasElements change (new videos added)

  // Toggle mute for all videos (global) - only affects videos that aren't individually muted
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (mainVideoPlayerRef.current) {
      mainVideoPlayerRef.current.muted = !isMuted;
    }
    
    // Update all canvas video elements - respect individual mute state
    // If a video is individually muted, keep it muted. Otherwise, apply global mute.
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video) {
          // If video is individually muted, keep it muted. Otherwise, apply global mute state.
          const isIndividuallyMuted = element.muted ?? false;
          video.muted = isIndividuallyMuted || isMuted;
        }
      }
    });
  };

  // Toggle mute for a specific video element
  const toggleVideoMute = (elementId: string) => {
    const element = canvasElements.find(el => el.id === elementId);
    if (element && element.type === "video") {
      const newMutedState = !(element.muted ?? false);
      updateCanvasElement(elementId, { muted: newMutedState });
      
      // Update the actual video element - respect both individual and global mute
      const video = document.querySelector(`#canvas-video-${elementId}`) as HTMLVideoElement;
      if (video) {
        // If globally muted, keep it muted. Otherwise, use individual mute state.
        video.muted = isMuted || newMutedState;
      }
    }
  };

  // Update duration when media loads - calculate based on longest element (video, audio, or image)
  // Timeline should always match the longest element and shrink/expand dynamically
  // Calculate timeline duration based on longest element + 20% padding
  useEffect(() => {
    if (isTrimming) {
      // Don't recalculate during trimming to avoid jumps
      return;
    }

    if (canvasElements.length === 0) {
      // Default to 10 seconds if no elements
      setDuration(10000);
      return;
    }

    // Find the longest element (considering startTime + duration)
    let maxEndTime = 0;
    canvasElements.forEach(element => {
      const startTime = element.startTime || 0;
      const elementDuration = element.duration || 5000; // Default 5s if not set
      const endTime = startTime + elementDuration;
      maxEndTime = Math.max(maxEndTime, endTime);
    });

    // Add 20% padding
    const calculatedDuration = Math.max(10000, maxEndTime * 1.2); // Minimum 10 seconds
    
    // Only update if the calculated duration is significantly different (avoid constant updates)
    if (Math.abs(duration - calculatedDuration) > 1000) {
      setDuration(calculatedDuration);
    }
  }, [canvasElements, isTrimming, duration]); // Recalculate when elements change

  // Update individual video element durations when their metadata loads
  // Only update if element doesn't already have a duration set (to preserve trimmed durations)
  useEffect(() => {
    const cleanupFunctions: Array<() => void> = [];
    
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (video) {
          const updateElementDuration = () => {
            if (video.duration && video.duration > 0) {
              const actualDuration = video.duration * 1000; // Convert to milliseconds
              // Store original duration for hard stop enforcement
              originalMediaDurationsRef.current.set(element.id, actualDuration);
              console.log(`[Video Duration] Stored original duration for ${element.id}: ${actualDuration}ms`);
              // Only update if element doesn't have a duration set yet (initial load)
              // Don't override if duration is already set (preserves trimmed durations)
              if (!element.duration || element.duration === 0) {
                updateCanvasElement(element.id, { duration: actualDuration });
              }
            }
          };
          
          if (video.duration && video.duration > 0) {
            updateElementDuration();
          } else {
            video.addEventListener('loadedmetadata', updateElementDuration);
            cleanupFunctions.push(() => video.removeEventListener('loadedmetadata', updateElementDuration));
          }
          
          // Sync muted state - respect individual mute state, but also apply global mute if active
          const isIndividuallyMuted = element.muted ?? false;
          video.muted = isIndividuallyMuted || isMuted;
        }
      }
      
      // Update individual audio element durations when their metadata loads
      // Only update if element doesn't already have a duration set (to preserve trimmed durations)
      if (element.type === "audio" && element.url) {
        // Use a small timeout to ensure audio element is in DOM
        const timeoutId = setTimeout(() => {
          const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
          if (audio) {
            const updateElementDuration = () => {
              if (audio.duration && audio.duration > 0) {
                const actualDuration = audio.duration * 1000; // Convert to milliseconds
                // Store original duration for hard stop enforcement
                originalMediaDurationsRef.current.set(element.id, actualDuration);
                console.log(`[Audio Duration] Stored original duration for ${element.id}: ${actualDuration}ms`);
                console.log(`[Audio Duration] Updating audio ${element.id}: ${element.duration}ms -> ${actualDuration}ms`);
                // Update if duration is not set, is 0, or is still the default 5000ms placeholder
                // This ensures we update from the default placeholder to the actual duration
                // Don't override if duration is already set to a non-default value (preserves trimmed durations)
                if (!element.duration || element.duration === 0 || element.duration === 5000) {
                  updateCanvasElement(element.id, { duration: actualDuration });
                }
              }
            };
            
            if (audio.duration && audio.duration > 0) {
              updateElementDuration();
            } else {
              // If metadata not loaded yet, wait for it
              const handleLoadedMetadata = () => {
                updateElementDuration();
                audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
              };
              audio.addEventListener('loadedmetadata', handleLoadedMetadata);
              cleanupFunctions.push(() => audio.removeEventListener('loadedmetadata', handleLoadedMetadata));
            }
            
            // Sync muted state
            audio.muted = element.muted || false;
          }
        }, 100); // Small delay to ensure audio element is in DOM
        
        cleanupFunctions.push(() => clearTimeout(timeoutId));
      }
    });
    
    // Return cleanup function for all listeners and timeouts
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [canvasElements, isMuted]);

  // Sync video playback with timeline - sync time only when starting playback or when new videos are added
  useEffect(() => {
    const hasCanvasVideos = canvasElements.some(el => el.type === "video" && el.url);
    const wasPlaying = lastPlayingStateRef.current;
    const justStartedPlaying = isPlaying && !wasPlaying;
    
    if (isPlaying) {
      // Start playing all canvas videos
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
          if (video) {
            const elementStartTime = element.startTime || 0;
            const elementDuration = element.duration || (video.duration * 1000 || 5000);
            const elementEndTime = elementStartTime + elementDuration;
            
            // Only play video if timeline is within its startTime range
            // Use tolerance for smooth transitions between sequential videos
            const tolerance = 50; // 50ms tolerance
            const isInRange = currentTime >= (elementStartTime - tolerance) && currentTime < (elementEndTime + tolerance);
            
            if (isInRange) {
              // Calculate video's internal time based on timeline position and videoStartOffset
              const videoStartOffset = element.videoStartOffset || 0;
              const videoTime = (videoStartOffset + (currentTime - elementStartTime)) / 1000;
              
              // Ensure video has loaded metadata
              if (video.readyState >= 2) {
                // Calculate trimmed start and end times
                const trimmedStartTime = videoStartOffset / 1000;
                const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                // Clamp video time to trimmed range
                const clampedVideoTime = Math.max(
                  trimmedStartTime,
                  Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
                );
                
                // Sync time when just starting playback or if video is paused (newly added)
                if (justStartedPlaying || video.paused || Math.abs(video.currentTime - clampedVideoTime) > 0.1) {
                  video.currentTime = clampedVideoTime;
                }
                
                // Check if video has reached trimmed end - only pause if we're past the end (with tolerance)
                if (currentTime >= elementEndTime + tolerance) {
                  video.pause();
                } else if (video.currentTime >= trimmedEndTime - 0.1) {
                  // Video reached its trimmed end, pause it
                  video.pause();
                } else if (video.paused) {
                  video.play().catch((err) => {
                    // Ignore AbortError - it's expected when play() is interrupted by pause()
                    if (err.name !== 'AbortError') {
                      console.error('Error playing trimmed video:', err);
                    }
                  });
                }
              } else {
                // Wait for video to load
                const handleLoadedData = () => {
                  const trimmedStartTime = videoStartOffset / 1000;
                  const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                  const clampedVideoTime = Math.max(
                    trimmedStartTime,
                    Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
                  );
                  video.currentTime = clampedVideoTime;
                  if (video.paused && currentTime < elementEndTime) {
                    video.play().catch((err) => {
                      // Ignore AbortError - it's expected when play() is interrupted by pause()
                      if (err.name !== 'AbortError') {
                        console.error('Error playing video:', err);
                      }
                    });
                  }
                  video.removeEventListener('loadeddata', handleLoadedData);
                };
                video.addEventListener('loadeddata', handleLoadedData);
              }
            } else {
              // Timeline is outside video's range - pause it
              if (!video.paused) {
                video.pause();
              }
              // If timeline is before startTime, reset to trimmed start; if after, set to trimmed end
              if (currentTime < elementStartTime) {
                const videoStartOffset = element.videoStartOffset || 0;
                video.currentTime = videoStartOffset / 1000; // Set to trimmed start
              } else if (currentTime >= elementEndTime && video.duration) {
                const videoStartOffset = element.videoStartOffset || 0;
                const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                video.currentTime = Math.min(trimmedEndTime, video.duration);
              }
            }
          }
        }
      });
      
      // Only play main video player if there are NO canvas videos (to avoid echo)
      if (mainVideoPlayerRef.current && !hasCanvasVideos) {
        if (justStartedPlaying) {
          mainVideoPlayerRef.current.currentTime = currentTime / 1000;
        }
        if (mainVideoPlayerRef.current.paused) {
          mainVideoPlayerRef.current.play().catch(console.error);
        }
      } else if (mainVideoPlayerRef.current && hasCanvasVideos) {
        // If canvas videos exist, pause and mute the main player to prevent echo
        mainVideoPlayerRef.current.pause();
        mainVideoPlayerRef.current.muted = true;
      }
    } else {
      // Pause all videos
      canvasElements.forEach(element => {
        if (element.type === "video" && element.url) {
          const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
          if (video && !video.paused) {
            video.pause();
          }
        }
        
        // Pause all audio elements
        if (element.type === "audio" && element.url) {
          const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
          if (audio && !audio.paused) {
            audio.pause();
          }
        }
      });
      
      if (mainVideoPlayerRef.current && !mainVideoPlayerRef.current.paused) {
        mainVideoPlayerRef.current.pause();
      }
    }
    
    // Update ref to track playing state
    lastPlayingStateRef.current = isPlaying;
  }, [isPlaying, canvasElements]);

  // Watch currentTime and start/pause videos as timeline moves
  useEffect(() => {
    if (!isPlaying) return; // Only handle when playing
    
    canvasElements.forEach(element => {
      if (element.type === "video" && element.url) {
        const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
        if (!video) return;
        
        const elementStartTime = element.startTime || 0;
        const elementDuration = element.duration || (video.duration * 1000 || 5000);
        const elementEndTime = elementStartTime + elementDuration;
        
        // Check if timeline is within video's time range
        // Use a small tolerance (50ms) to ensure smooth transitions between sequential videos
        const tolerance = 50; // 50ms tolerance for smooth transitions
        const isInRange = currentTime >= (elementStartTime - tolerance) && currentTime < (elementEndTime + tolerance);
        
        if (isInRange) {
          // Calculate video's internal time based on timeline position and videoStartOffset
          const videoStartOffset = element.videoStartOffset || 0;
          const videoTime = (videoStartOffset + (currentTime - elementStartTime)) / 1000;
          
          // Ensure video has loaded metadata before setting time
          if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            // Calculate trimmed end time
            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
            const clampedVideoTime = Math.max(
              videoStartOffset / 1000, 
              Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
            );
            
            // Sync video time if it's significantly different
            if (Math.abs(video.currentTime - clampedVideoTime) > 0.1) {
              video.currentTime = clampedVideoTime;
            }
            
            // Check if video has reached trimmed end - only pause if we're past the end (with tolerance)
            if (currentTime >= elementEndTime + tolerance) {
              video.pause();
            } else if (video.currentTime >= trimmedEndTime - 0.1) {
              // Video reached its trimmed end, pause it
              video.pause();
            } else if (video.paused) {
              // Start playing if paused and not at end
              video.play().catch((err) => {
                // Ignore AbortError - it's expected when play() is interrupted by pause()
                if (err.name !== 'AbortError') {
                  console.error('Error playing trimmed video:', err);
                }
              });
            }
          } else {
            // Wait for video to load, then set time
            const handleLoadedData = () => {
              const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
              const clampedVideoTime = Math.max(
                videoStartOffset / 1000,
                Math.min(videoTime, Math.min(trimmedEndTime, video.duration || Infinity))
              );
              video.currentTime = clampedVideoTime;
              if (video.paused && currentTime < elementEndTime) {
                video.play().catch((err) => {
                  // Ignore AbortError - it's expected when play() is interrupted by pause()
                  if (err.name !== 'AbortError') {
                    console.error('Error playing video:', err);
                  }
                });
              }
              video.removeEventListener('loadeddata', handleLoadedData);
            };
            video.addEventListener('loadeddata', handleLoadedData);
          }
        } else {
          // Timeline is outside video's range - pause it
          if (!video.paused) {
            video.pause();
          }
          // Reset video time appropriately
          if (currentTime < elementStartTime) {
            const videoStartOffset = element.videoStartOffset || 0;
            video.currentTime = videoStartOffset / 1000; // Set to trimmed start
          } else if (currentTime >= elementEndTime && video.duration) {
            const videoStartOffset = element.videoStartOffset || 0;
            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
            video.currentTime = Math.min(trimmedEndTime, video.duration);
          }
        }
      }
      
      // Handle audio elements
      if (element.type === "audio" && element.url) {
        const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
        if (!audio) return;
        
        const elementStartTime = element.startTime || 0;
        const elementDuration = element.duration || (audio.duration * 1000 || 5000);
        const elementEndTime = elementStartTime + elementDuration;
        const audioStartOffset = element.audioStartOffset || 0;
        
        // Check if timeline is within audio's time range
        const tolerance = 50; // 50ms tolerance for smooth transitions
        const isInRange = currentTime >= (elementStartTime - tolerance) && currentTime < (elementEndTime + tolerance);
        
        if (isInRange) {
          // Calculate audio's internal time based on timeline position and audioStartOffset
          const audioTime = (audioStartOffset + (currentTime - elementStartTime)) / 1000;
          
          // Ensure audio has loaded metadata before setting time
          if (audio.readyState >= 2) { // HAVE_CURRENT_DATA or higher
            const clampedAudioTime = Math.max(0, Math.min(audioTime, audio.duration || Infinity));
            
            // Sync audio time if it's significantly different
            if (Math.abs(audio.currentTime - clampedAudioTime) > 0.1) {
              audio.currentTime = clampedAudioTime;
            }
            
            // Check if audio has reached end - only pause if we're past the end (with tolerance)
            if (currentTime >= elementEndTime + tolerance) {
              audio.pause();
            } else if (audio.currentTime >= ((audioStartOffset + elementDuration) / 1000) - 0.1) {
              // Audio reached its end (audioStartOffset + duration), pause it
              audio.pause();
            } else if (audio.paused) {
              // Start playing if paused and not at end
              audio.play().catch((err) => {
                // Ignore AbortError - it's expected when play() is interrupted by pause()
                if (err.name !== 'AbortError') {
                  console.error('Error playing audio:', err);
                }
              });
            }
          } else {
            // Wait for audio to load, then set time
            const handleLoadedData = () => {
              const clampedAudioTime = Math.max(0, Math.min(audioTime, audio.duration || Infinity));
              audio.currentTime = clampedAudioTime;
              if (audio.paused && currentTime < elementEndTime) {
                audio.play().catch((err) => {
                  // Ignore AbortError - it's expected when play() is interrupted by pause()
                  if (err.name !== 'AbortError') {
                    console.error('Error playing audio:', err);
                  }
                });
              }
              audio.removeEventListener('loadeddata', handleLoadedData);
            };
            audio.addEventListener('loadeddata', handleLoadedData);
          }
        } else {
          // Timeline is outside audio's range - pause it
          if (!audio.paused) {
            audio.pause();
          }
          // Reset audio time appropriately
          if (currentTime < elementStartTime) {
            audio.currentTime = audioStartOffset / 1000; // Set to audio start offset
          } else if (currentTime >= elementEndTime && audio.duration) {
            audio.currentTime = Math.min((audioStartOffset + elementDuration) / 1000, audio.duration);
          }
        }
      }
    });
  }, [currentTime, isPlaying, canvasElements]);

  // Get the end time of the last element (video or image) in the timeline
  const getLastElementEndTime = useCallback((): number => {
    if (canvasElements.length === 0) {
      return 0;
    }
    // Calculate the maximum end time (startTime + duration) among all elements
    const endTimes = canvasElements.map(el => {
      const startTime = el.startTime || 0;
      const duration = el.duration || 5000;
      return startTime + duration;
    });
    return Math.max(...endTimes);
  }, [canvasElements]);


  // Continuously advance timeline when playing (ensures smooth transitions between videos)
  useEffect(() => {
    if (!isPlaying) return;
    
    let animationFrameId: number;
    let lastTime = Date.now();
    
    const advanceTimeline = () => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;
      
      // Get the end time of the last element
      const lastElementEndTime = getLastElementEndTime();
      
      // Advance timeline by the elapsed time, accounting for playback rate
      setCurrentTime(prevTime => {
        const newTime = prevTime + (delta * playbackRate);
        // Don't go past the end of the last element
        const maxTime = lastElementEndTime > 0 ? lastElementEndTime : (duration || Infinity);
        if (newTime >= maxTime) {
          // Stop playback when we reach the end
          setIsPlaying(false);
          return maxTime;
        }
        return newTime;
      });
      
      animationFrameId = requestAnimationFrame(advanceTimeline);
    };
    
    animationFrameId = requestAnimationFrame(advanceTimeline);
    
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, duration, getLastElementEndTime, playbackRate]);

  // Check for timeline end (not individual video end - videos can be sequential)
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      // Get the end time of the last element
      const lastElementEndTime = getLastElementEndTime();
      
      // Only stop playback if we've reached the end of the last element
      // Don't stop when individual videos end - they should transition to the next video
      if (lastElementEndTime > 0 && currentTime >= lastElementEndTime - 50) {
        // We've reached the end of the last element
        setIsPlaying(false);
        // Don't reset to 0, keep at the end
        // Reset all videos to their start positions
        canvasElements.forEach(el => {
          if (el.type === "video" && el.url) {
            const vid = document.querySelector(`#canvas-video-${el.id}`) as HTMLVideoElement;
            if (vid) {
              const videoStartOffset = el.videoStartOffset || 0;
              vid.currentTime = videoStartOffset / 1000; // Reset to trimmed start
              vid.pause();
            }
          }
        });
        if (mainVideoPlayerRef.current) {
          mainVideoPlayerRef.current.currentTime = 0;
        }
      }
    }, 200); // Check every 200ms for timeline end
    
    return () => clearInterval(interval);
  }, [isPlaying, canvasElements, currentTime, duration]);

  // Keyboard event listeners for delete (Backspace/Delete keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if an element is selected and not typing in an input/textarea
      if (selectedElementId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          // Delete the selected element
          setCanvasElements(elements => {
            const filtered = elements.filter(el => el.id !== selectedElementId);
            return filtered;
          });
          setSelectedElementId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedElementId]);

  // Load saved characters when avatar dialog opens
  useEffect(() => {
    if (!avatarsDialogOpen) return;
    let cancelled = false;
    listCharacters()
      .then(({ characters }) => {
        if (cancelled) return;
        const list: Avatar[] = (characters || [])
          .map((c: Record<string, unknown>) => {
            const videoUrl = (c.animationVideoUrl as string) || (c.selectedAvatarUrl as string) || "";
            const url = !videoUrl ? "" : videoUrl.startsWith("http") ? videoUrl : `${config.remotionServerUrl}${videoUrl}`;
            return { id: (c._id as string) || `char-${c.createdAt}`, name: (c.characterName as string) || "My avatar", url };
          })
          .filter((a: Avatar) => a.url);
        setSavedAvatars(list);
      })
      .catch((err) => {
        if (!cancelled) console.warn("[Avatars] Failed to load saved characters:", err);
      });
    return () => { cancelled = true; };
  }, [avatarsDialogOpen]);

  const defaultAvatars: Avatar[] = [
    { id: "avatar_1", name: "Avatar 1", url: `${config.remotionServerUrl}/avatars/Avatar_1.mp4` },
    { id: "avatar_2", name: "Avatar 2", url: `${config.remotionServerUrl}/avatars/Avatar_2.mp4` },
    { id: "avatar_3", name: "Avatar 3", url: `${config.remotionServerUrl}/avatars/Avatar_3.mp4` },
    { id: "avatar_4", name: "Avatar 4", url: `${config.remotionServerUrl}/avatars/Avatar_4.mp4` },
    { id: "avatar_5", name: "Avatar 5", url: `${config.remotionServerUrl}/avatars/Avatar_5.mp4` },
    { id: "avatar_6", name: "Avatar 6", url: `${config.remotionServerUrl}/avatars/Avatar_6.mp4` },
    { id: "avatar_7", name: "Avatar 7", url: `${config.remotionServerUrl}/avatars/Avatar_7.mp4` },
  ];
  const avatars: Avatar[] = [...savedAvatars, ...defaultAvatars];

  // Handle avatar selection
  const handleAvatarSelect = (avatar: Avatar) => {
    setSelectedAvatar(avatar);
    // Don't close dialog immediately - wait for Next button
  };

  // Handle Next button - go to speech generation screen
  const AVATAR_NEXT_TIMEOUT_MS = 20000; // 20s so we don't stay stuck on "Creating…"
  const handleNextToSpeechGeneration = async () => {
    if (!selectedAvatar) return;
    setAvatarNextError(null);
    setCreatingProjectFromAvatar(true);
    try {
      const createAndUpdate = async () => {
        const project = await createUGCProject(
          `UGC Video - ${new Date().toLocaleDateString()}`,
          `Avatar: ${selectedAvatar.name}`
        );
        if (!project?.id) {
          throw new Error("Project was not created");
        }
        console.log('[Project] Created project:', project.id, project.title);
        const updatedProject = await updateUGCProject(project.id, {
          avatar_id: selectedAvatar.id,
          avatar_url: selectedAvatar.url,
        });
        if (!updatedProject) {
          throw new Error("Failed to update project with avatar");
        }
        return updatedProject;
      };
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), AVATAR_NEXT_TIMEOUT_MS);
      });
      const updatedProject = await Promise.race([createAndUpdate(), timeoutPromise]);

      setCurrentProject(updatedProject);
      setProjectTitle(updatedProject.title || updatedProject.id);
      console.log('[Project] Project set in state:', updatedProject.id);

      setAvatarsDialogOpen(false);
      setShowSpeechGeneration(true);
      setCurrentStep("speech");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      console.error("[Avatar] Next error:", error);
      setAvatarNextError(message);
      alert(`Failed to continue: ${message}. Please try again or refresh the page.`);
    } finally {
      setCreatingProjectFromAvatar(false);
    }
  };

  // Handle speech generation
  const handleGenerateSpeech = async () => {
    if (!selectedVoice || !speechText || !selectedAvatar) {
      alert("Please select a voice and enter your script");
      return;
    }

    if (speechText.trim().length === 0) {
      alert("Please enter some text for the script");
      return;
    }

    // Check credits before generating
    if (userCredits !== null && !hasEnoughCredits) {
      alert(`Insufficient credits! You need ${calculateEstimatedCredits.toFixed(2)} credits but only have ${userCredits.toFixed(2)}.`);
      return;
    }

    setGeneratingSpeech(true);
    try {
      console.log("Generating speech with voice:", selectedVoice, "text length:", speechText.length);
      
      // Get cached token for long-running speech generation operation
      // This prevents token expiration issues during processing
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      const cachedToken = await getCachedToken();
      
      const headers: HeadersInit = {
          'Content-Type': 'application/json',
      };
      
      // Add authorization header if user is authenticated
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }
      
      // Call API to generate speech using ElevenLabs with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      let response;
      try {
        response = await fetch(`${config.remotionServerUrl}/voices/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          voice_id: selectedVoice,
          text: speechText,
          speed: speechSpeed,
          model_id: selectedModel === "alpha3" ? "eleven_v3" : "eleven_flash_v2_5",
        }),
          signal: controller.signal
      });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timeout - speech generation took too long. Please try again.');
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      let data;
      try {
        const responseText = await response.text();
        console.log("[Speech Generation] Raw response text length:", responseText.length);
        console.log("[Speech Generation] Raw response preview:", responseText.substring(0, 200));
        
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        console.error("[Speech Generation] ❌ Failed to parse JSON response:", parseError);
        throw new Error(`Invalid response from server: ${parseError?.message || 'Failed to parse response'}`);
      }
      
      console.log("[Speech Generation] API Response:", {
        success: data.success,
        hasAudio: !!data.audio,
        audioLength: data.audio?.length,
        audioType: typeof data.audio,
        voice_id: data.voice_id,
        credits_deducted: data.credits_deducted,
        model_used: data.model_used,
        error: data.error,
        message: data.message,
        fullResponseKeys: Object.keys(data)
      });
      
      // Update credits after successful generation
      if (data.credits_deducted !== undefined && user?.id) {
        try {
          const result = await subscriptionApi.getSubscriptionInfo();
          setUserCredits(result.subscription.credits || 0);
          console.log("[Speech Generation] Credits updated:", result.subscription.credits);
        } catch (error) {
          console.error("Error updating credits:", error);
        }
      }
      
      // Handle response - check for success flag OR just audio presence (for backward compatibility)
      // Also check if audio is a string (base64 data URL) or object
      const hasAudio = data.audio && (typeof data.audio === 'string' || typeof data.audio === 'object');
      const isSuccess = data.success !== false && !data.error;
      
      console.log("[Speech Generation] Response validation:", {
        isSuccess,
        hasAudio,
        successFlag: data.success,
        hasError: !!data.error,
        willProceed: isSuccess && hasAudio
      });
      
      if (isSuccess && hasAudio) {
        // Store the generated speech URL and voice ID
        console.log("[Speech Generation] Setting generated speech URL...");
        setGeneratedSpeechUrl(data.audio);
        setGeneratedSpeechVoiceId(selectedVoice);
        
        console.log("[Speech Generation] ✅ Speech generated successfully:", {
          voice_id: data.voice_id,
          text_length: data.text_length,
          audio_size: data.audio_size,
          audioUrlLength: data.audio?.length,
          audioPreview: data.audio?.substring(0, 50) + "..."
        });
        
        // Move to lip sync step first (so user can see the audio is ready)
        setCurrentStep("lipsync");
        setGeneratingSpeech(false); // Reset loading state immediately after speech is generated
        
        // Save voice generation to database (non-blocking but with error reporting)
        if (currentProject) {
          // Run database save in background without blocking UI
          (async () => {
          try {
            console.log("Saving voice generation to database...", {
              projectId: currentProject.id,
              voiceId: selectedVoice,
              scriptLength: speechText.length
            });
            
            // Convert base64 to blob and upload to storage
            console.log("Converting base64 to blob...");
            const audioBlob = base64ToBlob(data.audio, 'audio/mpeg');
            console.log("Audio blob size:", (audioBlob.size / 1024).toFixed(2), "KB");
            
            const audioFileName = `voice-${uuid()}.mp3`;
            console.log("Uploading audio to Supabase Storage...");
            const audioStorageUrl = await uploadAudioToStorage(
              audioBlob,
              currentProject.id,
              audioFileName
            );
            
            if (!audioStorageUrl) {
              throw new Error("Failed to upload audio to storage");
            }
            
            console.log("Audio uploaded to storage:", audioStorageUrl);
              
              // Save to user_uploads table so it appears in "My Audio" using REST API
              const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
              let token = await getCachedToken();
              
              if (token) {
                try {
                  // Extract userId from token
                  const payload = JSON.parse(atob(token.split('.')[1]));
                  const userId = payload.sub || payload.user_id;
                  
                  if (userId) {
                    const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
                    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                    
                    if (supabaseUrl && supabaseAnonKey) {
                const storagePath = `ugc-audio/${currentProject.id}/${audioFileName}`;
                      const insertUrl = `${supabaseUrl}/rest/v1/user_uploads`;
                      
                      const makeRequest = async (authToken: string) => {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);
                        try {
                          const response = await fetch(insertUrl, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${authToken}`,
                              'apikey': supabaseAnonKey,
                              'Prefer': 'return=minimal'
                            },
                            body: JSON.stringify({
                              user_id: userId,
                  file_name: audioFileName,
                  file_type: 'audio',
                  storage_path: storagePath,
                  storage_url: audioStorageUrl,
                  file_size: audioBlob.size,
                  mime_type: 'audio/mpeg',
                  metadata: {
                    voice_id: selectedVoice,
                    voice_name: elevenLabsVoices.find(v => v.voice_id === selectedVoice)?.name || null,
                    generated_with: 'elevenlabs'
                  }
                            }),
                            signal: controller.signal
                          });
                          clearTimeout(timeoutId);
                          return response;
                        } catch (err) {
                          clearTimeout(timeoutId);
                          throw err;
                        }
                      };
                      
                      let response = await makeRequest(token);
                      
                      // Handle 401 - refresh token and retry
                      if (response.status === 401) {
                        const refreshedToken = await refreshToken();
                        if (refreshedToken) {
                          response = await makeRequest(refreshedToken);
                        }
                      }
                      
                      if (response.ok) {
                console.log("Audio saved to user_uploads table");
                      } else {
                        console.warn('[Speech Generation] Failed to save audio metadata:', response.status);
                      }
                    }
                  }
                } catch (error) {
                  console.warn('[Speech Generation] Error saving audio metadata:', error);
                  // Continue even if metadata save fails
                }
              }
            
            // Get voice name from the list
            const voiceName = elevenLabsVoices.find(v => v.voice_id === selectedVoice)?.name || null;
            
            // Calculate duration (rough estimate from audio size or use API response)
            const durationSeconds = data.duration_seconds || null;
            
            // Save to database
            console.log("Saving voice generation to database...");
            const voiceGen = await saveVoiceGeneration(
              currentProject.id,
              selectedVoice,
              voiceName,
              speechText,
              audioStorageUrl, // Use storage URL instead of base64
              `ugc-audio/${currentProject.id}/${audioFileName}`,
              durationSeconds
            );
            
            setVoiceGenerationId(voiceGen.id);
            console.log("✅ Voice generation saved to database:", voiceGen.id);
          } catch (error: any) {
            console.error("❌ Error saving voice generation:", error);
            console.error("Error details:", {
              message: error.message,
              stack: error.stack,
              projectId: currentProject?.id
            });
              // Show alert so user knows there was an issue
            alert(`Voice generated successfully, but failed to save to database: ${error.message}\n\nCheck console for details.`);
          }
          })();
        } else {
          console.warn("Cannot save voice generation - no current project");
          alert("Warning: No project found. Voice generation will not be saved to database.");
        }
      } else {
        console.error("[Speech Generation] ❌ Failed to generate speech:", {
          success: data.success,
          hasAudio: !!data.audio,
          hasError: !!data.error,
          error: data.error,
          message: data.message,
          fullResponse: data,
          responseKeys: Object.keys(data)
        });
        
        // More detailed error message
        const errorMessage = data.error || data.message || data.details?.message || 'Unknown error';
        alert(`Failed to generate speech: ${errorMessage}\n\nPlease check the console for more details.`);
      }
    } catch (error: any) {
      console.error("[Speech Generation] ❌ Error generating speech:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        response: error.response
      });
      alert(`Error generating speech: ${error.message || 'Network error'}`);
    } finally {
      setGeneratingSpeech(false);
    }
  };

  // Fetch ElevenLabs voices when speech generation screen opens
  useEffect(() => {
    if (showSpeechGeneration && elevenLabsVoices.length === 0 && !loadingVoices) {
      fetchElevenLabsVoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSpeechGeneration]);

  // Handle lip sync generation
  const handleGenerateLipSync = useCallback(async (e?: React.MouseEvent) => {
    // Prevent event propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Prevent multiple simultaneous calls - check state directly
    if (generatingLipSync) {
      console.log("[Lip Sync] Already generating, ignoring click");
      return;
    }

    // Double-check with a ref to prevent race conditions
    const isCurrentlyGenerating = generatingLipSync;
    if (isCurrentlyGenerating) {
      console.log("[Lip Sync] Race condition detected - already generating");
      return;
    }

    if (!generatedSpeechUrl || !selectedAvatar) {
      console.error("[Lip Sync] Missing requirements:", {
        hasSpeech: !!generatedSpeechUrl,
        hasAvatar: !!selectedAvatar
      });
      alert("Please generate speech first and select an avatar");
      return;
    }

    console.log("[Lip Sync] Starting generation...", {
      hasSpeech: !!generatedSpeechUrl,
      hasAvatar: !!selectedAvatar,
      avatarUrl: selectedAvatar.url,
      speechUrlLength: generatedSpeechUrl.length
    });

    // Set state and ref immediately to prevent double-clicks
    generatingLipSyncRef.current = true;
    setGeneratingLipSync(true);
    setLipSyncStatus('Initializing lip sync generation...');
    setLipSyncProgress(5);

    // Saved avatars (UUID id): send avatarCharacterId so server fetches video server-side and never receives Supabase URL
    const isSavedAvatar = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAvatar.id);

    try {
      console.log("[Lip Sync] Preparing API call...", {
        audio: generatedSpeechUrl.substring(0, 50) + "...",
        isSavedAvatar,
        ...(isSavedAvatar ? { avatarCharacterId: selectedAvatar.id } : { video: selectedAvatar.url }),
        serverUrl: config.remotionServerUrl
      });

      // Get auth token from Supabase
      // Get cached token for long-running lip sync operation
      // This prevents token expiration issues during processing
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      let cachedToken: string | null = null;
      try {
        cachedToken = await getCachedToken();
        console.log("[Lip Sync] Cached token retrieved:", { hasToken: !!cachedToken });
      } catch (tokenError) {
        console.error("[Lip Sync] Error getting cached token:", tokenError);
        // Continue without auth if token retrieval fails
      }

      const headers: HeadersInit = {
          'Content-Type': 'application/json',
      };
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }

      const requestBody: Record<string, unknown> = {
          audio: generatedSpeechUrl, // Base64 data URL
          seed: 0,
          guidance_scale: 1
      };
      if (isSavedAvatar) {
        requestBody.avatarCharacterId = selectedAvatar.id;
      } else {
        requestBody.video = selectedAvatar.url;
      }

      console.log("[Lip Sync] Making API call to:", `${config.remotionServerUrl}/lipsync/generate`);
      console.log("[Lip Sync] Request body:", {
        audioLength: typeof requestBody.audio === 'string' ? requestBody.audio.length : 0,
        ...(isSavedAvatar ? { avatarCharacterId: requestBody.avatarCharacterId } : { video: requestBody.video }),
        hasHeaders: !!headers['Authorization']
      });

      // Ensure we're still in generating state before making the call
      if (!generatingLipSyncRef.current) {
        console.warn("[Lip Sync] Generation was cancelled before API call");
        return;
      }

      // Call API to generate lip sync using Replicate
      console.log("[Lip Sync] Fetch call starting...");
      const fetchStartTime = Date.now();
      const response = await fetch(`${config.remotionServerUrl}/lipsync/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });
      const fetchDuration = Date.now() - fetchStartTime;
      
      console.log("[Lip Sync] API response received:", {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration: `${fetchDuration}ms`
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("[Lip Sync] API response:", { success: data.success, status: data.status, hasVideoUrl: !!data.video_url });
      
      if (data.success && data.video_url) {
        const videoUrl = data.video_url;
        setLipSyncVideoUrl(videoUrl);
        setLipSyncStatus('Lip sync completed!');
        setLipSyncProgress(100);
        console.log("Lip sync generated successfully:", videoUrl);
        generatingLipSyncRef.current = false;
        setGeneratingLipSync(false);
        
        // Save generated video to database and storage
        if (currentProject && videoUrl) {
          (async () => {
            try {
              console.log("[Lip Sync] Saving generated video to database (immediate)...", {
                projectId: currentProject.id,
                videoUrl: videoUrl.substring(0, 80) + "...",
                voiceGenerationId,
                isSupabaseUrl: videoUrl.includes('supabase.co/storage')
              });
              
              let videoStorageUrl = videoUrl;
              let videoStoragePath: string | null = null;
              let durationSeconds: number | null = null;
              
              // Check if video is already in Supabase Storage (from backend)
              if (videoUrl.includes('supabase.co/storage')) {
                console.log("[Lip Sync] Video is already in Supabase Storage, skipping download/re-upload");
                
                // Extract storage path from Supabase URL
                const urlMatch = videoUrl.match(/\/storage\/v1\/object\/public\/videos\/(.+)$/);
                if (urlMatch) {
                  videoStoragePath = urlMatch[1];
                  console.log("[Lip Sync] Extracted storage path:", videoStoragePath);
                }
                
                // Get video duration from the Supabase URL
                try {
                  const video = document.createElement('video');
                  video.preload = 'metadata';
                  video.crossOrigin = 'anonymous';
                  video.src = videoUrl;
                  await new Promise((resolve, reject) => {
                    video.onloadedmetadata = () => {
                      durationSeconds = video.duration;
                      resolve(null);
                    };
                    video.onerror = reject;
                    setTimeout(() => {
                      resolve(null); // Resolve anyway if metadata doesn't load
                    }, 5000); // Increased timeout for large videos
                  });
                  console.log("[Lip Sync] Video duration:", durationSeconds, "seconds");
                } catch (e) {
                  console.warn("[Lip Sync] Could not get video duration:", e);
                }
              } else {
                // Video is from Replicate, need to download and upload to Supabase
                console.log("[Lip Sync] Video is from Replicate, downloading and uploading...");
                
                // Use AbortController with timeout for download
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
                
                try {
                  const videoResponse = await fetch(videoUrl, { signal: controller.signal });
                  clearTimeout(timeoutId);
                  
              if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.statusText}`);
              }
              
              const videoBlob = await videoResponse.blob();
                  console.log("[Lip Sync] Video downloaded, size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");
              
              const videoFileName = `lipsync-${uuid()}.mp4`;
                  console.log("[Lip Sync] Uploading to Supabase Storage...");
                  videoStorageUrl = await uploadVideoToStorage(
                videoBlob,
                currentProject.id,
                videoFileName
              );
              
              if (!videoStorageUrl) {
                throw new Error("Failed to upload video to storage");
              }
              
                  videoStoragePath = `ugc-videos/${currentProject.id}/${videoFileName}`;
                  console.log("[Lip Sync] Video uploaded to storage:", videoStorageUrl);
              
              // Get video duration from the video blob
              try {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.src = URL.createObjectURL(videoBlob);
                await new Promise((resolve, reject) => {
                  video.onloadedmetadata = () => {
                    durationSeconds = video.duration;
                    URL.revokeObjectURL(video.src);
                    resolve(null);
                  };
                  video.onerror = reject;
                  setTimeout(() => {
                    URL.revokeObjectURL(video.src);
                    resolve(null); // Resolve anyway if metadata doesn't load
                  }, 2000);
                });
              } catch (e) {
                    console.warn("[Lip Sync] Could not get video duration:", e);
                  }
                } catch (fetchError: any) {
                  clearTimeout(timeoutId);
                  if (fetchError.name === 'AbortError') {
                    throw new Error("Video download timed out after 5 minutes");
                  }
                  throw fetchError;
                }
              }
              
              // Save to database with timeout and retry logic
              console.log("[Lip Sync] Saving to database...");
              const savedVideo = await saveGeneratedVideo(
                currentProject.id,
                voiceGenerationId,
                videoStorageUrl,
                videoStoragePath,
                null, // thumbnail (can be generated later)
                durationSeconds
              );
              
              console.log("[Lip Sync] ✅ Generated video saved successfully:", savedVideo.id);
              
              // Reload generated videos list so it appears in media
              await loadGeneratedVideos();
              console.log("[Lip Sync] ✅ Generated videos list reloaded");
            } catch (error: any) {
              console.error("[Lip Sync] ❌ Error saving generated video:", error);
              console.error("[Lip Sync] Error details:", {
                message: error.message,
                stack: error.stack,
                projectId: currentProject?.id,
                videoUrl: videoUrl?.substring(0, 80)
              });
              alert(`Video generated successfully, but failed to save to database: ${error.message}. The video is still available in the preview.`);
            }
          })();
        } else {
          console.warn("Cannot save video - missing project or video URL", {
            hasProject: !!currentProject,
            hasVideoUrl: !!videoUrl
          });
        }
      } else if (data.status === 'processing' || data.status === 'starting') {
        // If still processing, poll for completion
        console.log("Lip sync is processing, polling for completion...");
        setLipSyncStatus('Processing...');
        setLipSyncProgress(10);
        pollLipSyncStatus(data.prediction_id);
      } else {
        console.error("Failed to generate lip sync:", data.error || data.message);
        setLipSyncStatus(`Failed: ${data.error || data.message || 'Unknown error'}`);
        setLipSyncProgress(0);
        generatingLipSyncRef.current = false;
        setGeneratingLipSync(false);
        alert(`Failed to generate lip sync: ${data.error || data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("[Lip Sync] Error generating lip sync:", error);
      console.error("[Lip Sync] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      setLipSyncStatus(`Error: ${error.message || 'Network error'}`);
      setLipSyncProgress(0);
      setGeneratingLipSync(false);
      alert(`Error generating lip sync: ${error.message || 'Network error'}`);
    }
  }, [generatingLipSync, generatedSpeechUrl, selectedAvatar, currentProject, voiceGenerationId]);

  // Add generated video to canvas
  const handleAddVideoToScene = async () => {
    if (!lipSyncVideoUrl) {
      alert("No lip sync video available. Please generate one first.");
      return;
    }

    // Add video to canvas using the existing addElementToCanvas function
    await addElementToCanvas("video", lipSyncVideoUrl);
    
    // Clear the generated speech URL since the video already contains the synced audio
    setGeneratedSpeechUrl(null);
    setGeneratedSpeechVoiceId(null);
    
    // Don't close the dialog - let user continue working
    // setShowSpeechGeneration(false); // REMOVED - modal should stay open
    
    console.log("Added lip sync video to canvas:", lipSyncVideoUrl);
  };

  // Poll Replicate prediction status
  const pollLipSyncStatus = async (predictionId: string) => {
    if (!predictionId) return;

    const maxAttempts = 180; // Poll for up to 15 minutes (5 second intervals = 180 * 5 = 900 seconds)
    let attempts = 0;

    const poll = async () => {
      try {
        // Use cached token for polling (prevents expiration during long lip sync operations)
        const { getCachedToken } = await import('@/lib/utils/token-cache');
        const cachedToken = await getCachedToken();
        
        const headers: HeadersInit = {};
        if (cachedToken) {
          headers['Authorization'] = `Bearer ${cachedToken}`;
        }

        // Always use our backend endpoint to avoid CORS issues
        const pollUrl = `${config.remotionServerUrl}/lipsync/status/${predictionId}`;
        const response = await fetch(pollUrl, {
          headers
        });
        const data = await response.json();

        // Update status message
        const statusMessages: Record<string, string> = {
          'starting': 'Starting lip sync generation...',
          'processing': 'Processing lip sync...',
          'succeeded': 'Lip sync completed!',
          'failed': 'Lip sync generation failed',
          'canceled': 'Lip sync generation canceled'
        };
        setLipSyncStatus(statusMessages[data.status] || `Status: ${data.status}`);
        
        // Calculate progress (rough estimate based on attempts)
        const progress = Math.min((attempts / maxAttempts) * 90, 90); // Cap at 90% until succeeded
        setLipSyncProgress(progress);

        // Handle all possible statuses: starting, processing, succeeded, failed, canceled
        if (data.status === 'succeeded' && data.output) {
          const videoUrl = typeof data.output === 'string' 
            ? data.output 
            : data.output.url || data.output;
          setLipSyncVideoUrl(videoUrl);
          generatingLipSyncRef.current = false;
          setGeneratingLipSync(false);
          setLipSyncStatus('Lip sync completed!');
          setLipSyncProgress(100);
          console.log("Lip sync completed:", videoUrl);
          
          // Save generated video to database and storage
          if (currentProject && videoUrl) {
            try {
              console.log("[Lip Sync] Saving generated video to database...", {
                projectId: currentProject.id,
                videoUrl: videoUrl.substring(0, 80) + "...",
                voiceGenerationId,
                isSupabaseUrl: videoUrl.includes('supabase.co/storage')
              });
              
              let videoStorageUrl = videoUrl;
              let videoStoragePath: string | null = null;
              let durationSeconds: number | null = null;
              
              // Check if video is already in Supabase Storage (from backend)
              if (videoUrl.includes('supabase.co/storage')) {
                console.log("[Lip Sync] Video is already in Supabase Storage, skipping download/re-upload");
                
                // Extract storage path from Supabase URL
                // Format: https://xxx.supabase.co/storage/v1/object/public/videos/user-uploads/...
                const urlMatch = videoUrl.match(/\/storage\/v1\/object\/public\/videos\/(.+)$/);
                if (urlMatch) {
                  videoStoragePath = urlMatch[1];
                  console.log("[Lip Sync] Extracted storage path:", videoStoragePath);
                }
                
                // Get video duration from the Supabase URL
                try {
                  const video = document.createElement('video');
                  video.preload = 'metadata';
                  video.crossOrigin = 'anonymous';
                  video.src = videoUrl;
                  await new Promise((resolve, reject) => {
                    video.onloadedmetadata = () => {
                      durationSeconds = video.duration;
                      resolve(null);
                    };
                    video.onerror = reject;
                    setTimeout(() => {
                      resolve(null); // Resolve anyway if metadata doesn't load
                    }, 5000); // Increased timeout for large videos
                  });
                  console.log("[Lip Sync] Video duration:", durationSeconds, "seconds");
                } catch (e) {
                  console.warn("[Lip Sync] Could not get video duration:", e);
                }
              } else {
                // Video is from Replicate, need to download and upload to Supabase
                console.log("[Lip Sync] Video is from Replicate, downloading and uploading...");
                
                // Use AbortController with timeout for download
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
                
                try {
                  const videoResponse = await fetch(videoUrl, { signal: controller.signal });
                  clearTimeout(timeoutId);
                  
              if (!videoResponse.ok) {
                throw new Error(`Failed to download video: ${videoResponse.statusText}`);
              }
              
              const videoBlob = await videoResponse.blob();
                  console.log("[Lip Sync] Video downloaded, size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");
              
              const videoFileName = `lipsync-${uuid()}.mp4`;
                  console.log("[Lip Sync] Uploading to Supabase Storage...");
                  videoStorageUrl = await uploadVideoToStorage(
                videoBlob,
                currentProject.id,
                videoFileName
              );
              
              if (!videoStorageUrl) {
                throw new Error("Failed to upload video to storage");
              }
              
                  videoStoragePath = `ugc-videos/${currentProject.id}/${videoFileName}`;
                  console.log("[Lip Sync] Video uploaded to storage:", videoStorageUrl);
              
              // Get video duration from the video blob
              try {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.src = URL.createObjectURL(videoBlob);
                await new Promise((resolve, reject) => {
                  video.onloadedmetadata = () => {
                    durationSeconds = video.duration;
                    URL.revokeObjectURL(video.src);
                    resolve(null);
                  };
                  video.onerror = reject;
                  setTimeout(() => {
                    URL.revokeObjectURL(video.src);
                    resolve(null); // Resolve anyway if metadata doesn't load
                  }, 2000);
                });
              } catch (e) {
                    console.warn("[Lip Sync] Could not get video duration:", e);
                  }
                } catch (fetchError: any) {
                  clearTimeout(timeoutId);
                  if (fetchError.name === 'AbortError') {
                    throw new Error("Video download timed out after 5 minutes");
                  }
                  throw fetchError;
                }
              }
              
              // Save to database with timeout and retry logic
              console.log("[Lip Sync] Saving to database...");
              const savedVideo = await saveGeneratedVideo(
                currentProject.id,
                voiceGenerationId,
                videoStorageUrl,
                videoStoragePath,
                null, // thumbnail (can be generated later)
                durationSeconds
              );
              
              console.log("[Lip Sync] ✅ Generated video saved successfully:", savedVideo.id);
              
              // Reload generated videos list so it appears in media
              await loadGeneratedVideos();
              console.log("[Lip Sync] ✅ Generated videos list reloaded");
            } catch (error: any) {
              console.error("[Lip Sync] ❌ Error saving generated video:", error);
              console.error("[Lip Sync] Error details:", {
                message: error.message,
                stack: error.stack,
                projectId: currentProject?.id,
                videoUrl: videoUrl?.substring(0, 80)
              });
              // Show user-friendly error but don't block the UI
              alert(`Video generated successfully, but failed to save to database: ${error.message}. The video is still available in the preview.`);
            }
          } else {
            console.warn("Cannot save video - missing project or video URL", {
              hasProject: !!currentProject,
              hasVideoUrl: !!videoUrl
            });
          }
        } else if (data.status === 'failed' || data.error) {
          generatingLipSyncRef.current = false;
          setGeneratingLipSync(false);
          setLipSyncStatus(`Failed: ${data.error || 'Unknown error'}`);
          setLipSyncProgress(0);
          alert(`Lip sync generation failed: ${data.error || 'Unknown error'}`);
        } else if (data.status === 'canceled') {
          generatingLipSyncRef.current = false;
          setGeneratingLipSync(false);
          setLipSyncStatus('Canceled');
          setLipSyncProgress(0);
          alert("Lip sync generation was canceled.");
        } else if (data.status === 'starting' || data.status === 'processing') {
          // Still processing, poll again after 5 seconds
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 5000);
          } else {
            generatingLipSyncRef.current = false;
            setGeneratingLipSync(false);
            setLipSyncStatus('Timeout - taking longer than expected');
            setLipSyncProgress(0);
            alert("Lip sync generation is taking longer than expected. Please check back later.");
          }
        } else {
          // Unknown status, continue polling if we have attempts left
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, 5000);
          } else {
            generatingLipSyncRef.current = false;
            setGeneratingLipSync(false);
            setLipSyncStatus(`Unknown status: ${data.status}`);
            setLipSyncProgress(0);
            alert(`Lip sync generation status: ${data.status}. Please check back later.`);
          }
        }
      } catch (error: any) {
        console.error("Error polling lip sync status:", error);
        generatingLipSyncRef.current = false;
        setGeneratingLipSync(false);
        setLipSyncStatus(`Error: ${error.message}`);
        setLipSyncProgress(0);
        alert(`Error checking lip sync status: ${error.message}`);
      }
    };

    // Start polling
    setTimeout(poll, 5000);
  };

  const fetchElevenLabsVoices = async () => {
    setLoadingVoices(true);
    try {
      const response = await fetch(`${config.remotionServerUrl}/voices`);
      const data = await response.json();
      
      if (data.voices && Array.isArray(data.voices)) {
        // Filter out voices that should not be shown
        const excludedVoiceNames = [
          'New Pet Loud',
          'New Cartoon Male Pet',
          'Cartoon M',
          'Asif',
          'Stwie Girf'
        ];
        
        const filteredVoices = data.voices.filter((voice: { name: string }) => 
          !excludedVoiceNames.includes(voice.name)
        );
        
        setElevenLabsVoices(filteredVoices);
      } else if (data.error) {
        console.error("Error fetching voices:", data.error);
        // Set some default voices if API fails
        setElevenLabsVoices([
          { voice_id: "default1", name: "Default Voice 1", category: "default" },
          { voice_id: "default2", name: "Default Voice 2", category: "default" },
        ]);
      }
    } catch (error) {
      console.error("Failed to fetch ElevenLabs voices:", error);
      // Set default voices on error
      setElevenLabsVoices([
        { voice_id: "default1", name: "Default Voice 1", category: "default" },
        { voice_id: "default2", name: "Default Voice 2", category: "default" },
      ]);
    } finally {
      setLoadingVoices(false);
    }
  };

  // Preview voice function
  const handlePreviewVoice = async (voiceId: string) => {
    setPreviewingVoice(voiceId);
    try {
      const response = await fetch(`${config.remotionServerUrl}/voices/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voice_id: voiceId,
          text: "Hello, this is a preview of this voice."
        }),
      });

      const data = await response.json();
      
      if (data.success && data.audio) {
        setPreviewAudio(data.audio);
        // Auto-play the preview
        setTimeout(() => {
          if (previewAudioRef.current) {
            previewAudioRef.current.play().catch(console.error);
          }
        }, 100);
      } else {
        console.error("Failed to generate preview:", data.error);
      }
    } catch (error) {
      console.error("Error previewing voice:", error);
    } finally {
      setPreviewingVoice(null);
    }
  };

  const sidebarSections: { id: SidebarSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "avatars", label: "Avatars", icon: User },
    { id: "media", label: "Media", icon: Film },
    { id: "templates", label: "Templates", icon: Sparkles },
    { id: "audio", label: "Audio", icon: Music },
    { id: "text", label: "Text", icon: Type },
    { id: "captions", label: "Captions", icon: FileText },
    { id: "brolls", label: "B-rolls", icon: VideoIcon },
  ];

  // Calculate active subtitle based on current time
  const activeSubtitle = useMemo(() => {
    try {
      if (!showSubtitles || !subtitleSegments || subtitleSegments.length === 0) return null;
    return subtitleSegments.find(
        (segment) => segment && currentTime >= segment.startMs && currentTime < segment.endMs
      ) || null;
    } catch (error) {
      console.error('[Subtitles] Error calculating active subtitle:', error);
      return null;
    }
  }, [currentTime, showSubtitles, subtitleSegments]);

  // Subtitle drag handlers
  const handleSubtitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingSubtitle(true);
  };

  const handleCanvasMouseMoveForSubtitle = (e: React.MouseEvent) => {
    if (!isDraggingSubtitle || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Clamp values to keep content within bounds (0-100%)
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    
    setSubtitlePosition({ x, y });
  };

  const handleCanvasMouseUpForSubtitle = () => {
    setIsDraggingSubtitle(false);
  };

  // Generate subtitles from video elements using STT server
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  
  const handleGenerateSubtitles = async () => {
    try {
      setIsGeneratingSubtitles(true);
      
      // Get all video elements from canvas
      const videoElements = canvasElements.filter(el => el.type === 'video' && el.url);
      
      if (videoElements.length === 0) {
        alert('No video elements found. Add videos to the canvas first.');
        setIsGeneratingSubtitles(false);
        return;
      }

      console.log('[Subtitles] Generating subtitles for', videoElements.length, 'video(s)');

      // Process each video element
      const allSegments: SubtitleSegment[] = [];
      
      for (const element of videoElements) {
        if (!element.url) continue;
        
        const elementStartTime = element.startTime || 0;
        const elementDuration = element.duration || 5000;
        const videoStartOffset = element.videoStartOffset || 0;
        
        // Calculate the actual start time in the timeline
        const timelineStartTime = elementStartTime;
        
        try {
          console.log('[Subtitles] Transcribing video:', element.url);
          
          // Call STT server
          const response = await fetch(`${config.sttServerUrl}/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audioPath: element.url,
              language: 'en',
              wordTimestamps: true,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[Subtitles] STT server error:', response.status, response.statusText, errorText);
            continue;
          }

          const data = await response.json();
          const segments = data.segments || [];

          console.log('[Subtitles] Received', segments.length, 'segments for video', element.url);
          
          if (segments.length === 0) {
            console.warn('[Subtitles] No segments returned for video:', element.url, '- video may not have audio or speech');
          }

          // Convert STT segments to subtitle segments
          // STT returns segments in seconds relative to the video file start
          // We need to map them to timeline milliseconds, accounting for:
          // 1. videoStartOffset (trim start)
          // 2. elementStartTime (timeline position)
          const videoStartOffsetSeconds = videoStartOffset / 1000;
          
          for (const seg of segments) {
            // seg.startSec and seg.endSec are relative to the video file start
            // Adjust for videoStartOffset (trim start)
            const adjustedStartSec = seg.startSec - videoStartOffsetSeconds;
            const adjustedEndSec = seg.endSec - videoStartOffsetSeconds;
            
            // Only include segments that are within the trimmed portion
            if (adjustedStartSec < 0 || adjustedEndSec > (elementDuration / 1000)) {
              continue; // Segment is outside the trimmed portion
            }
            
            // Map to timeline time
            const segmentStartMs = timelineStartTime + (adjustedStartSec * 1000);
            const segmentEndMs = timelineStartTime + (adjustedEndSec * 1000);
            
            // Only include segments that are within the element's duration
            if (segmentStartMs >= timelineStartTime && segmentEndMs <= (timelineStartTime + elementDuration)) {
              allSegments.push({
                startMs: Math.round(segmentStartMs),
                endMs: Math.round(segmentEndMs),
                speaker: 'A', // Default speaker, could be enhanced later
                text: seg.text.trim(),
              });
            }
          }
        } catch (error) {
          console.error('[Subtitles] Error transcribing video:', element.url, error);
          // Continue with other videos
        }
      }

      // Sort segments by start time
      allSegments.sort((a, b) => a.startMs - b.startMs);

      console.log('[Subtitles] Generated', allSegments.length, 'subtitle segments');
      
      if (allSegments.length === 0) {
        const videoCount = videoElements.length;
        alert(
          `No subtitles could be generated from ${videoCount} video(s).\n\n` +
          `Possible reasons:\n` +
          `• Videos may not have audio tracks\n` +
          `• Videos may be silent (no speech)\n` +
          `• STT server may be unavailable (check ${config.sttServerUrl})\n` +
          `• Network issues downloading videos`
        );
      } else {
        // Store both segments and SRT text, and save original for restore
        setSubtitleSegments(allSegments);
        setOriginalSubtitleSegments([...allSegments]); // Deep copy for restore
        const srtText = serializeSrt(allSegments);
        setSubtitleSrtText(srtText);
        setShowSubtitles(true);
        alert(`Successfully generated ${allSegments.length} subtitle segments from ${videoElements.length} video(s)!`);
      }
    } catch (error) {
      console.error('[Subtitles] Error generating subtitles:', error);
      alert(`Failed to generate subtitles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  // Handle subtitle SRT text changes from editor
  const handleSubtitleSrtChange = useCallback((newSrtText: string) => {
    try {
      if (!newSrtText || typeof newSrtText !== 'string') {
        setSubtitleSrtText('');
        setSubtitleSegments([]);
        return;
      }
      setSubtitleSrtText(newSrtText);
      const parsed = parseSrtText(newSrtText);
      if (Array.isArray(parsed)) {
        setSubtitleSegments(parsed);
      } else {
        console.warn('[Subtitles] Parsed result is not an array:', parsed);
        setSubtitleSegments([]);
      }
    } catch (error) {
      console.error('[Subtitles] Error parsing SRT text:', error);
      // Keep the text but don't update segments if parsing fails
    }
  }, []);

  // Restore original subtitles
  const handleRestoreSubtitles = useCallback(() => {
    try {
      if (!originalSubtitleSegments || originalSubtitleSegments.length === 0) {
        alert('No original subtitles to restore. Generate subtitles first.');
        return;
      }
      const restored = [...originalSubtitleSegments];
      setSubtitleSegments(restored);
      const srtText = serializeSrt(restored);
      setSubtitleSrtText(srtText);
    } catch (error) {
      console.error('[Subtitles] Error restoring subtitles:', error);
      alert('Failed to restore subtitles. Please try generating them again.');
    }
  }, [originalSubtitleSegments]);

  // Sync subtitleSegments to SRT text when segments change externally (but not from editor)
  useEffect(() => {
    try {
      if (subtitleSegments && subtitleSegments.length > 0) {
        const currentSrt = serializeSrt(subtitleSegments);
        // Only update if different to avoid infinite loops
        // Use a ref or compare more carefully to avoid loops
        setSubtitleSrtText(prev => {
          if (prev !== currentSrt) {
            return currentSrt;
          }
          return prev;
        });
      } else if (subtitleSegments && subtitleSegments.length === 0) {
        // Clear SRT text if segments are cleared
        setSubtitleSrtText('');
      }
    } catch (error) {
      console.error('[Subtitles] Error syncing segments to SRT:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleSegments]);

  // Load generated videos from database
  const loadGeneratedVideos = useCallback(async () => {
    // Prevent multiple simultaneous calls
    if (loadingVideosRef.current) {
      console.log('[Media] Already loading generated videos, skipping...');
      return;
    }
    
    loadingVideosRef.current = true;
    setLoadingVideos(true);
    try {
      console.log("Loading generated videos from database...");
      
      // Add timeout to prevent infinite loading (60 seconds - increased for slow connections)
      // Note: apiRequest already has a 25s timeout, but we add an extra safety timeout here
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 60000)
      );
      
      const videos = await Promise.race([
        getUserGeneratedVideos(),
        timeoutPromise
      ]);
      
      console.log("Loaded videos:", videos.length, videos);
      setGeneratedVideos(videos);
      
      if (videos.length === 0) {
        console.warn("No videos found. Possible reasons:");
        console.warn("1. Database tables not created (run migration)");
        console.warn("2. Videos not saved due to errors");
        console.warn("3. User authentication issue");
      }
    } catch (error: any) {
      console.error("Error loading generated videos:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack
      });
      
      // Set empty array on error so UI doesn't stay in loading state
      setGeneratedVideos([]);
      
      // Only show alert for non-timeout errors
      if (error.message === 'Request timeout') {
        console.warn("Request timed out, continuing with empty list");
      } else if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        alert(`Database tables not found. Please run the migration SQL in Supabase:\n\n${error.message}\n\nSee: supabase/migrations/create_ugc_tables.sql`);
      } else {
        console.warn("Failed to load videos, continuing with empty list");
      }
    } finally {
      loadingVideosRef.current = false;
      setLoadingVideos(false);
    }
  }, []);

  // Load media when dialog opens
  // Note: Functions are memoized with useCallback and empty deps, so they're stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mediaDialogOpen) {
      // Wait for auth to be ready before loading media
      const loadMediaWithAuth = async () => {
        // Clear any previous errors
        setMediaError(null);
        
        // Check if auth is initialized
        const { user, loading: authLoading } = useAuthStore.getState();
        
        // Wait for auth to initialize (max 3 seconds)
        let attempts = 0;
        while (authLoading && attempts < 6) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const state = useAuthStore.getState();
          if (!state.loading) break;
          attempts++;
        }
        
        // Try to get session token - check localStorage first as fallback
        let session = null;
        let hasTokenInStorage = false;
        
        // Check localStorage directly as a fallback
        try {
          const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
          if (supabaseProjectRef) {
            const storageKey = `sb-${supabaseProjectRef}-auth-token`;
            const storedData = localStorage.getItem(storageKey);
            if (storedData) {
              try {
                const parsed = JSON.parse(storedData);
                if (parsed?.access_token) {
                  hasTokenInStorage = true;
                  console.log('[Media] Found token in localStorage');
                }
              } catch (e) {
                console.error('[Media] Failed to parse stored token:', e);
              }
            }
          }
        } catch (e) {
          console.error('[Media] Error checking localStorage:', e);
        }
        
        // Get token from cache (avoids hanging getSession/refreshSession calls)
        const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
        let token = await getCachedToken();
        
        // If no token but token exists in storage, try refreshing
        if (!token && hasTokenInStorage) {
          console.log('[Media] Token in storage but not in cache, attempting to refresh...');
          try {
            token = await refreshToken();
            if (token) {
              console.log('[Media] Token refreshed successfully');
            }
          } catch (refreshError) {
            console.error('[Media] Failed to refresh token:', refreshError);
          }
        }
        
        // Create session-like object from token for compatibility
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            session = {
              access_token: token,
              user: {
                id: payload.sub || payload.user_id,
                email: payload.email
              }
            };
          } catch (parseError) {
            console.error('[Media] Failed to parse token:', parseError);
            session = null;
          }
        } else {
          session = null;
        }
        
        // If still no session token, handle error
        if (!session?.access_token) {
          console.warn('[Media] No auth session available, skipping media load');
          
          // Reset loading states so UI doesn't stay in loading state
          setLoadingVideos(false);
          setLoadingImages(false);
          setLoadingUploadedVideos(false);
          
          // Set empty arrays so UI shows empty state instead of loading
          setGeneratedVideos([]);
          setUploadedImages([]);
          setUploadedVideos([]);
          
          // Set error message for UI display
          setMediaError('Please sign in to load your media. If you are signed in, try refreshing the page.');
          
          return;
        }
        
        // Clear error if we successfully got a session
        setMediaError(null);
        
        // Now load media in parallel with timeout protection
        // Use Promise.allSettled so one failure doesn't block others
        Promise.allSettled([
          loadGeneratedVideos(),
          loadUploadedImages(),
          loadUploadedVideos()
        ]).then((results) => {
          const errors = results.filter(r => r.status === 'rejected');
          if (errors.length > 0) {
            console.warn("Some media failed to load:", errors);
            // Check if errors are auth-related
            const authErrors = errors.filter(r => 
              r.reason?.message?.includes('401') || 
              r.reason?.message?.includes('AUTH_REQUIRED') ||
              r.reason?.message?.includes('Authentication')
            );
            if (authErrors.length > 0) {
              setMediaError('Authentication failed. Please sign in again.');
            }
          } else {
            // Clear error on successful load
            setMediaError(null);
          }
        });
      };
      
      loadMediaWithAuth();
    } else {
      // Reset loading refs when dialog closes to prevent stuck state
      // This ensures refs are ready for the next time the dialog opens
      loadingVideosRef.current = false;
      loadingImagesRef.current = false;
      loadingUploadedVideosRef.current = false;
      
      // Also reset loading states
      setLoadingVideos(false);
      setLoadingImages(false);
      setLoadingUploadedVideos(false);
    }
  }, [mediaDialogOpen]); // Only depend on mediaDialogOpen since functions are stable

  // Reset avatar generation states when avatar dialog closes (if user cancels without selecting)
  useEffect(() => {
    if (!avatarsDialogOpen && !showSpeechGeneration) {
      // Only reset if speech generation dialog is also closed
      // This prevents clearing states when transitioning from avatar selection to speech generation
      console.log('[Avatar Dialog] Dialog closed without proceeding, resetting states');
      
      // Reset avatar selection states
      setSelectedAvatar(null);
      setCurrentStep("speech");
      
      // Reset speech generation states
      setSelectedVoice("");
      setSpeechText("");
      setSpeechSpeed(1.0);
      setSelectedModel("flash");
      setEmotionsEnabled(false);
      setGeneratedSpeechUrl(null);
      setGeneratedSpeechVoiceId(null);
      setGeneratingSpeech(false);
      
      // Reset lip sync states
      setGeneratingLipSync(false);
      setLipSyncVideoUrl(null);
      generatingLipSyncRef.current = false;
      
      // Reset voice loading states
      setElevenLabsVoices([]);
      setLoadingVoices(false);
      setPreviewAudio(null);
      setPreviewingVoice(null);
    }
  }, [avatarsDialogOpen, showSpeechGeneration]);

  // Reset avatar generation states when speech generation dialog closes
  useEffect(() => {
    if (!showSpeechGeneration) {
      // Reset all avatar generation related states when speech generation dialog closes
      console.log('[Speech Generation Dialog] Dialog closed, resetting states');
      
      // Reset speech generation states
      setSelectedVoice("");
      setSpeechText("");
      setSpeechSpeed(1.0);
      setSelectedModel("flash");
      setEmotionsEnabled(false);
      setGeneratedSpeechUrl(null);
      setGeneratedSpeechVoiceId(null);
      setGeneratingSpeech(false);
      
      // Reset lip sync states
      setGeneratingLipSync(false);
      setLipSyncVideoUrl(null);
      generatingLipSyncRef.current = false;
      
      // Reset voice loading states
      setElevenLabsVoices([]);
      setLoadingVoices(false);
      setPreviewAudio(null);
      setPreviewingVoice(null);
      
      // Reset step
      setCurrentStep("speech");
      
      // Note: We don't reset selectedAvatar here as it might be used elsewhere
      // If the user wants to start fresh, they can close the avatar dialog too
    }
  }, [showSpeechGeneration]);

  // Handle selecting a generated video from media dialog
  const handleSelectGeneratedVideo = async (video: UGCGeneratedVideo) => {
    // Don't set lipSyncVideoUrl when adding to canvas - this prevents the main video player from playing
    // and causing echo. Only set it when generating a new lip-sync video for preview.
    setMediaDialogOpen(false);
    // Optionally add to assets
    const newAsset: Asset = {
      id: uuid(),
      name: `Generated Video ${new Date(video.created_at).toLocaleDateString()}`,
      type: "video",
      url: video.video_url,
    };
    setAssets([...assets, newAsset]);
    
    // Generate thumbnail and get duration for the video
    let thumbnail: string | undefined;
    let videoDuration = 5000; // Default 5s fallback
    
    try {
      // Get both thumbnail and duration in parallel
      const [thumb, duration] = await Promise.all([
        generateVideoThumbnail(video.video_url).catch(() => undefined),
        getVideoDuration(video.video_url).catch(() => 5000)
      ]);
      thumbnail = thumb;
      videoDuration = duration;
    } catch (error) {
      console.error("Failed to get video metadata:", error);
      // Thumbnail will be generated by VideoThumbnailGenerator component
      // Duration will use default 5000ms
    }
    
    // Calculate start time: if inserting after a specific element, use that; otherwise place after the last video
    let videoStartTime = 0;
    if (insertAfterElementId) {
      const afterElement = canvasElements.find(el => el.id === insertAfterElementId);
      if (afterElement) {
        const elementStartTime = afterElement.startTime || 0;
        // Use actual duration if available, otherwise fallback
        const elementDuration = afterElement.duration || (afterElement.type === "video" ? 5000 : 3000);
        // Calculate exact end time - this ensures the new video starts immediately after
        videoStartTime = elementStartTime + elementDuration;
        console.log('📍 Inserting video after element:', {
          afterElementId: insertAfterElementId,
          elementStartTime,
          elementDuration,
          calculatedStartTime: videoStartTime
        });
      }
      setInsertAfterElementId(null); // Reset after use
    } else {
      // Place after the last video ends
      const videoElements = canvasElements.filter(el => el.type === "video");
      if (videoElements.length > 0) {
        const endTimes = videoElements.map(el => {
          const startTime = el.startTime || 0;
          // Use actual duration if available
          const duration = el.duration || 5000;
          return startTime + duration;
        });
        videoStartTime = Math.max(...endTimes);
      }
    }
    
    // Add to canvas with timeline properties
    const newElement: CanvasElement = {
      id: uuid(),
      type: "video",
      url: video.video_url,
      x: 50,
      y: 50,
      width: 80,
      height: 80,
      rotation: 0,
      opacity: 1,
      zIndex: canvasElements.length,
      // Timeline properties - start after the last video ends, use actual duration
      startTime: videoStartTime,
      duration: videoDuration, // Use actual video duration
      thumbnail, // Include thumbnail so it shows immediately
      muted: false,
    };
    
    // Ensure project exists before adding element
    await ensureProjectExists();
    
    setCanvasElements([...canvasElements, newElement]);
    setSelectedElementId(newElement.id);
  };

  // Get video duration from URL
  const getVideoDuration = async (videoUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      video.muted = true;
      video.preload = 'metadata';
      
      const handleLoadedMetadata = () => {
        if (video.duration && video.duration > 0 && isFinite(video.duration)) {
          resolve(video.duration * 1000); // Return in milliseconds
        } else {
          reject(new Error('Could not get video duration'));
        }
        cleanup();
      };
      
      const handleError = () => {
        reject(new Error('Failed to load video'));
        cleanup();
      };
      
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
        video.src = ''; // Release video element
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);
      
      // Load the video
      video.load();
    });
  };

  // Generate thumbnail from video
  const generateVideoThumbnail = async (videoUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = videoUrl;
      video.muted = true;
      video.preload = 'metadata';
      
      const handleLoadedMetadata = () => {
        // Seek to the very beginning (0 seconds) for thumbnail
        video.currentTime = 0;
      };
      
      const handleSeeked = () => {
        try {
          const canvas = document.createElement('canvas');
          // Use a reasonable size for thumbnails (16:9 aspect ratio)
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            resolve(thumbnail);
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('error', () => reject(new Error('Failed to load video')));
      
      // Load the video
      video.load();
    });
  };

  // Helper function to calculate the end time of the last video in the timeline
  const getLastVideoEndTime = (): number => {
    const videoElements = canvasElements.filter(el => el.type === "video");
    if (videoElements.length === 0) {
      return 0;
    }
    // Calculate the maximum end time (startTime + duration) among all videos
    const endTimes = videoElements.map(el => {
      const startTime = el.startTime || 0;
      const duration = el.duration || 5000;
      return startTime + duration;
    });
    return Math.max(...endTimes);
  };

  // Ensure a project exists - auto-create if needed
  const ensureProjectExists = useCallback(async () => {
    if (currentProject) {
      return currentProject;
    }
    
    try {
      console.log('[Project] Auto-creating project...');
      const project = await createUGCProject(
        `UGC Video - ${new Date().toLocaleDateString()}`,
        'Auto-created project'
      );
      setCurrentProject(project);
      setProjectTitle(project.title || project.id);
      console.log('[Project] Auto-created project:', project.id);
      return project;
    } catch (error: any) {
      console.error('[Project] Error auto-creating project:', error);
      throw error;
    }
  }, [currentProject]);

  // Add element to canvas
  const addElementToCanvas = async (type: "video" | "image" | "text", url?: string) => {
    let width = 30;
    let height = 30;
    let x = 50;
    let y = 50;
    
    // For images, fill the canvas (100%) - user can resize/expand beyond canvas bounds (like Canva)
    if (type === "image") {
      width = 100;
      height = 100;
      x = 0;
      y = 0;
    } else if (type === "video") {
      // For videos, make it fit the canvas (9:16 aspect ratio)
      width = 90; // 90% width for portrait videos
      height = 90; // 90% height for portrait videos
      x = 5; // Center horizontally: (100 - 90) / 2 = 5
      y = 5; // Center vertically: (100 - 90) / 2 = 5
    } else if (type === "text") {
      width = 30;
      height = 10;
      x = 50;
      y = 50;
    }
    
    // Calculate default timeline position
    // If inserting after a specific element, use that position
    // Otherwise, for videos: start after the last video ends
    // For other elements: start at current playhead
    let defaultStartTime = 0;
    if (insertAfterElementId) {
      const afterElement = canvasElements.find(el => el.id === insertAfterElementId);
      if (afterElement) {
        const elementStartTime = afterElement.startTime || 0;
        const elementDuration = afterElement.duration || (type === "video" ? 5000 : 3000);
        // Calculate exact end time - this ensures the new element starts immediately after
        defaultStartTime = elementStartTime + elementDuration;
        console.log('📍 Inserting element after:', {
          type,
          afterElementId: insertAfterElementId,
          elementStartTime,
          elementDuration,
          calculatedStartTime: defaultStartTime
        });
      }
      setInsertAfterElementId(null); // Reset after use
    } else {
      defaultStartTime = type === "video" ? getLastVideoEndTime() : (currentTime || 0);
    }
    // Get actual video duration for videos, default for others
    let defaultDuration = type === "image" ? 3000 : (type === "text" ? 3000 : 5000);
    
    // Generate thumbnail and get duration for videos
    let thumbnail: string | undefined;
    if (type === "video" && url) {
      try {
        // Get both thumbnail and duration in parallel
        const [thumb, duration] = await Promise.all([
          generateVideoThumbnail(url).catch(() => url),
          getVideoDuration(url).catch(() => 5000)
        ]);
        thumbnail = thumb;
        defaultDuration = duration; // Use actual video duration
      } catch (error) {
        console.error("Failed to get video metadata:", error);
        // Use video URL as fallback (will be handled in timeline)
        thumbnail = url;
        defaultDuration = 5000; // Fallback duration
      }
    } else if (type === "image" && url) {
      thumbnail = url;
    }
    
    const newElement: CanvasElement = {
      id: uuid(),
      type,
      url,
      text: type === "text" ? "Double click to edit" : undefined,
      x,
      y,
      width,
      height,
      rotation: 0,
      opacity: 1,
      zIndex: canvasElements.length,
      fontSize: type === "text" ? 24 : undefined,
      fontColor: type === "text" ? "#000000" : undefined,
      fontFamily: type === "text" ? "Arial" : undefined,
      // Image panning (default center position for images)
      imageOffsetX: type === "image" ? 50 : undefined,
      imageOffsetY: type === "image" ? 50 : undefined,
      // Timeline properties (TEMPORAL - independent from canvas position)
      startTime: defaultStartTime,
      duration: defaultDuration, // Use actual video duration for videos
      thumbnail,
      muted: type === "video" ? false : undefined, // Initialize videos as unmuted
    };
    
    // Ensure project exists before adding element
    await ensureProjectExists();
    
    setCanvasElements([...canvasElements, newElement]);
    setSelectedElementId(newElement.id);
  };

  // Update canvas element - memoized to prevent stale closures
  const updateCanvasElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setCanvasElements(elements =>
      elements.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  }, []);

  // Delete canvas element
  const deleteCanvasElement = (id: string) => {
    setCanvasElements(elements => elements.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  // Split video/image element at current playhead time
  const splitElementAtPlayhead = (elementId: string) => {
    const element = canvasElements.find(el => el.id === elementId);
    if (!element || (element.type !== "video" && element.type !== "image")) return;
    const startTime = element.startTime ?? 0;
    const elementDuration = element.duration ?? 5000;
    const endTime = startTime + elementDuration;
    if (currentTime <= startTime || currentTime >= endTime) return; // playhead must be inside clip
    const leftDuration = currentTime - startTime;
    const rightDuration = endTime - currentTime;
    const videoStartOffset = element.videoStartOffset ?? 0;
    const audioStartOffset = element.audioStartOffset ?? 0;
    const rightVideoStartOffset = videoStartOffset + leftDuration;
    const rightAudioStartOffset = audioStartOffset + leftDuration;
    setCanvasElements(prev => {
      const idx = prev.findIndex(el => el.id === elementId);
      if (idx === -1) return prev;
      const el = prev[idx];
      const left: CanvasElement = { ...el, duration: leftDuration };
      const right: CanvasElement = {
        ...el,
        id: uuid(),
        startTime: currentTime,
        duration: rightDuration,
        videoStartOffset: rightVideoStartOffset,
        audioStartOffset: rightAudioStartOffset,
      };
      return [...prev.slice(0, idx), left, right, ...prev.slice(idx + 1)];
    });
    setSelectedElementId(null); // deselect so user can click the new clip if needed
  };

  // Bring element to front (highest z-index)
  const bringToFront = (id: string) => {
    if (canvasElements.length === 0) return;
    const maxZIndex = Math.max(...canvasElements.map(el => el.zIndex), 0);
    updateCanvasElement(id, { zIndex: maxZIndex + 1 });
  };

  // Send element to back (lowest z-index, but ensure it's at least 0)
  const sendToBack = (id: string) => {
    if (canvasElements.length === 0) return;
    const otherElements = canvasElements.filter(el => el.id !== id);
    if (otherElements.length === 0) {
      // Only one element, just set to 0
      updateCanvasElement(id, { zIndex: 0 });
      return;
    }
    const minZIndex = Math.min(...otherElements.map(el => el.zIndex), 0);
    // Ensure z-index is at least 0, but lower than all other elements
    const newZIndex = Math.max(0, minZIndex - 1);
    updateCanvasElement(id, { zIndex: newZIndex });
  };

  // Fill canvas with video (set to 100% width and height, centered)
  const fillCanvas = (id: string) => {
    updateCanvasElement(id, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  };

  // Download exported video
  const handleDownloadVideo = useCallback(async () => {
    // Always read from ref first (most up-to-date), then fallback to state
    // This ensures we get the latest URL even if there's a closure issue
    const currentExportedUrl = exportedVideoUrlRef.current || exportedVideoUrl;
    console.log('[Download] ========================================');
    console.log('[Download] Download button clicked');
    console.log('[Download] exportedVideoUrl state:', exportedVideoUrl);
    console.log('[Download] exportedVideoUrlRef.current:', exportedVideoUrlRef.current);
    console.log('[Download] Will download from URL:', currentExportedUrl);
    console.log('[Download] ========================================');
    
    if (!currentExportedUrl) {
      console.warn('[Download] No exported video URL available');
      alert('No video available to download. Please export a video first.');
      return;
    }
    
    try {
      console.log('[Download] Fetching video from:', currentExportedUrl);
      const response = await fetch(currentExportedUrl, {
        cache: 'no-store', // Ensure we don't get cached version
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      console.log('[Download] Video blob size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');
      console.log('[Download] Video blob type:', blob.type);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      console.log('[Download] ✅ Download completed successfully');
    } catch (error) {
      console.error('[Download] ❌ Error downloading video:', error);
      // Fallback: open in new tab
      console.log('[Download] Falling back to opening URL in new tab:', currentExportedUrl);
      window.open(currentExportedUrl, '_blank');
    }
  }, [exportedVideoUrl]);

  // Save project canvas state
  const handleSaveProject = useCallback(async () => {
    console.log('[Save] ========================================');
    console.log('[Save] handleSaveProject function called');
    console.log('[Save] ========================================');
    
    // Always read from ref first (most up-to-date), then fallback to state
    // This ensures we get the latest project even if there's a closure issue
    const project = currentProjectRef.current || currentProject;
    
    console.log('[Save] Save button clicked');
    console.log('[Save] currentProject state:', currentProject?.id);
    console.log('[Save] currentProjectRef.current:', currentProjectRef.current?.id);
    console.log('[Save] Will save project:', project?.id);
    
    if (!project) {
      console.warn('[Save] No project found');
      alert('No project found. Please create a project first by selecting an avatar.');
      return;
    }

    // Check network connectivity first
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn('[Save] No internet connection');
      alert('No internet connection. Please check your network and try again.');
      return;
    }

    // Verify we have a token before attempting save
    let token: string | null = null;
    try {
      console.log('[Save] Checking for token...');
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      token = await getCachedToken();
      console.log('[Save] Token check result:', token ? '✅ Token found' : '❌ No token');
      if (!token) {
        console.warn('[Save] No token available, but continuing - API will handle auth');
        // Don't return early - let the API call handle the auth error
        // This allows the save to proceed and show a proper error message
      }
    } catch (tokenError) {
      console.error('[Save] Token check error:', tokenError);
      // Continue anyway - the API call will handle auth errors
    }

    try {
      console.log('[Save] Saving project canvas state...', {
        projectId: project.id,
        elementsCount: canvasElements.length,
        hasMetadata: !!project.metadata
      });

      // Prepare canvas state to save - capture all current state values
      const canvasState = {
        elements: canvasElements,
        duration: duration,
        currentTime: currentTime,
        playbackRate: playbackRate,
        isMuted: isMuted,
        subtitleSegments: subtitleSegments,
        subtitleStyle: subtitleStyle,
        subtitlePosition: subtitlePosition,
        subtitleFontSize: subtitleFontSize,
        subtitleFontFamily: subtitleFontFamily,
        subtitleSingleLine: subtitleSingleLine,
        subtitleSingleWord: subtitleSingleWord,
        showSubtitles: showSubtitles,
        karaokePillColor: karaokePillColor,
        boldGreenColor: boldGreenColor,
        // B-roll state
        selectedBRollIds: selectedBRollIds,
        jumpCutInterval: jumpCutInterval,
        savedAt: new Date().toISOString()
      };

      // Update project metadata with canvas state
      // Ensure metadata is always an object before spreading
      const existingMetadata = project.metadata && typeof project.metadata === 'object' 
        ? project.metadata 
        : {};
      
      await updateUGCProject(project.id, {
        metadata: {
          ...existingMetadata,
          canvasState: canvasState
        }
      });

      // Update local state with the saved project
      const updatedProject = await getUGCProject(project.id);
      setCurrentProject(updatedProject);
      currentProjectRef.current = updatedProject;

      console.log('[Save] ✅ Project saved successfully');
      alert('Project saved successfully!');
    } catch (error: any) {
      console.error('[Save] ❌ Error saving project:', error);
      console.error('[Save] Error details:', {
        message: error.message,
        stack: error.stack,
        projectId: project?.id
      });
      
      // Provide more helpful error messages
      let errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Authentication required') || errorMessage.includes('Session expired')) {
        errorMessage = 'Session expired. Please refresh the page and try again.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      alert(`Failed to save project: ${errorMessage}`);
    }
  }, [currentProject, canvasElements, duration, currentTime, playbackRate, isMuted, subtitleSegments, subtitleStyle, subtitlePosition, subtitleFontSize, subtitleFontFamily, subtitleSingleLine, subtitleSingleWord, showSubtitles, karaokePillColor, boldGreenColor, selectedBRollIds, jumpCutInterval]);

  // Autosave function (silent, no alerts)
  const handleAutosave = useCallback(async () => {
    const project = currentProjectRef.current || currentProject;
    
    if (!project) {
      return; // No project to save
    }

    // Check network connectivity
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[Autosave] Skipping - no internet connection');
      return;
    }

    try {
      // Prepare canvas state to save
      const canvasState = {
        elements: canvasElements,
        duration: duration,
        currentTime: currentTime,
        playbackRate: playbackRate,
        isMuted: isMuted,
        subtitleSegments: subtitleSegments,
        subtitleStyle: subtitleStyle,
        subtitlePosition: subtitlePosition,
        subtitleFontSize: subtitleFontSize,
        subtitleFontFamily: subtitleFontFamily,
        subtitleSingleLine: subtitleSingleLine,
        subtitleSingleWord: subtitleSingleWord,
        showSubtitles: showSubtitles,
        karaokePillColor: karaokePillColor,
        boldGreenColor: boldGreenColor,
        // B-roll state
        selectedBRollIds: selectedBRollIds,
        jumpCutInterval: jumpCutInterval,
        savedAt: new Date().toISOString()
      };

      // Update project metadata with canvas state
      const existingMetadata = project.metadata && typeof project.metadata === 'object' 
        ? project.metadata 
        : {};
      
      await updateUGCProject(project.id, {
        metadata: {
          ...existingMetadata,
          canvasState: canvasState
        }
      });

      // Update local state with the saved project
      const updatedProject = await getUGCProject(project.id);
      setCurrentProject(updatedProject);
      currentProjectRef.current = updatedProject;

      console.log('[Autosave] ✅ Project autosaved successfully');
    } catch (error: any) {
      // Silently fail for autosave - don't show alerts
      console.warn('[Autosave] ⚠️ Autosave failed (silent):', error.message);
    }
  }, [currentProject, canvasElements, duration, currentTime, playbackRate, isMuted, subtitleSegments, subtitleStyle, subtitlePosition, subtitleFontSize, subtitleFontFamily, subtitleSingleLine, subtitleSingleWord, showSubtitles, karaokePillColor, boldGreenColor, selectedBRollIds, jumpCutInterval]);

  // Autosave every 60 seconds
  useEffect(() => {
    if (!currentProject) {
      return; // No project to autosave
    }

    console.log('[Autosave] Setting up autosave interval (60 seconds)');
    const autosaveInterval = setInterval(() => {
      handleAutosave();
    }, 60000); // 60 seconds

    return () => {
      console.log('[Autosave] Cleaning up autosave interval');
      clearInterval(autosaveInterval);
    };
  }, [currentProject, handleAutosave]);

  // Load project canvas state
  const loadProjectState = useCallback(async (project: UGCVideoProject) => {
    try {
      console.log('[Load] Loading project canvas state...', {
        projectId: project.id,
        hasMetadata: !!project.metadata,
        hasCanvasState: !!(project.metadata?.canvasState)
      });

      if (project.metadata?.canvasState) {
        const canvasState = project.metadata.canvasState;
        
        // Restore canvas elements
        if (canvasState.elements && Array.isArray(canvasState.elements)) {
          setCanvasElements(canvasState.elements);
          console.log('[Load] Restored', canvasState.elements.length, 'canvas elements');
        }

        // Restore timeline state
        if (canvasState.duration !== undefined) {
          setDuration(canvasState.duration);
        }
        if (canvasState.currentTime !== undefined) {
          setCurrentTime(canvasState.currentTime);
        }
        if (canvasState.playbackRate !== undefined) {
          setPlaybackRate(canvasState.playbackRate);
        }
        if (canvasState.isMuted !== undefined) {
          setIsMuted(canvasState.isMuted);
        }

        // Restore subtitle settings
        if (canvasState.subtitleSegments) {
          setSubtitleSegments(canvasState.subtitleSegments);
        }
        if (canvasState.subtitleStyle) {
          setSubtitleStyle(canvasState.subtitleStyle);
        }
        if (canvasState.subtitlePosition) {
          setSubtitlePosition(canvasState.subtitlePosition);
        }
        if (canvasState.subtitleFontSize !== undefined) {
          setSubtitleFontSize(canvasState.subtitleFontSize);
        }
        if (canvasState.subtitleFontFamily) {
          setSubtitleFontFamily(canvasState.subtitleFontFamily);
        }
        if (canvasState.subtitleSingleLine !== undefined) {
          setSubtitleSingleLine(canvasState.subtitleSingleLine);
        }
        if (canvasState.subtitleSingleWord !== undefined) {
          setSubtitleSingleWord(canvasState.subtitleSingleWord);
        }
        if (canvasState.showSubtitles !== undefined) {
          setShowSubtitles(canvasState.showSubtitles);
        }
        if (canvasState.karaokePillColor) {
          setKaraokePillColor(canvasState.karaokePillColor);
        }
        if (canvasState.boldGreenColor) {
          setBoldGreenColor(canvasState.boldGreenColor);
        }

        // Restore B-roll state
        if (canvasState.selectedBRollIds && Array.isArray(canvasState.selectedBRollIds)) {
          setSelectedBRollIds(canvasState.selectedBRollIds);
          console.log('[Load] Restored B-roll selections:', canvasState.selectedBRollIds.length);
        }
        if (canvasState.jumpCutInterval !== undefined && canvasState.jumpCutInterval !== null) {
          setJumpCutInterval(canvasState.jumpCutInterval);
          console.log('[Load] Restored jump cut interval:', canvasState.jumpCutInterval);
        }

        console.log('[Load] Project state loaded successfully');
      } else {
        console.log('[Load] No saved canvas state found, starting with empty canvas');
      }
    } catch (error: any) {
      console.error('[Load] Error loading project state:', error);
    }
  }, []);

  // Load project state when currentProject changes
  useEffect(() => {
    if (currentProject) {
      console.log('[Project] useEffect triggered, loading project state:', currentProject.id, currentProject.title);
      loadProjectState(currentProject);
      setProjectTitle(currentProject.title || currentProject.id);
    } else {
      console.log('[Project] No current project in useEffect');
    }
  }, [currentProject?.id, loadProjectState]); // Only reload when project ID changes
  
  // Debug: Log currentProject changes
  useEffect(() => {
    console.log('[Project] currentProject state changed:', {
      hasProject: !!currentProject,
      projectId: currentProject?.id,
      projectTitle: currentProject?.title
    });
  }, [currentProject]);

  // Keyboard shortcut: Ctrl+S (or Cmd+S on Mac) to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+S (or Cmd+S on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        
        // Only save if we have a project
        if (currentProject) {
          console.log('[Save] Keyboard shortcut triggered (Ctrl+S)');
          // Call save function with proper error handling
          handleSaveProject().catch((error) => {
            console.error('[Save] Error in keyboard shortcut handler:', error);
            // Error already handled in handleSaveProject
          });
        } else {
          console.log('[Save] No project to save');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentProject, handleSaveProject]); // Include handleSaveProject in dependencies

  // Export final video from canvas
  const handleExportVideo = async () => {
    // Prevent multiple simultaneous exports
    if (isExporting) {
      console.log('[Export] Export already in progress, ignoring click');
      return;
    }

    try {
      if (canvasElements.length === 0) {
        alert('No elements to export. Add videos, images, or text to the canvas first.');
        return;
      }

      setIsExporting(true);
      setExportedVideoUrl(null); // Clear previous export when starting new one (ref will sync via useEffect)
      console.log('[Export] Starting video export...');
      console.log('[Export] Canvas elements:', canvasElements.length);

      // Get cached token at the start of long-running operation
      // This prevents token expiration issues during video rendering
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      const cachedToken = await getCachedToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }

      // Prepare elements for export (only include elements with URLs or text)
      const exportElements = canvasElements
        .filter(el => {
          if (el.type === 'text') return !!el.text;
          if (el.type === 'audio') return !!el.url;
          return !!el.url;
        })
        .map(el => ({
          id: el.id,
          type: el.type,
          url: el.url,
          text: el.text,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation || 0,
          opacity: el.opacity !== undefined ? el.opacity : 1,
          zIndex: el.zIndex || 0,
          startTime: el.startTime || 0,
          duration: el.duration || 5000,
          videoStartOffset: el.videoStartOffset || 0,
          audioStartOffset: el.audioStartOffset || 0, // Include audioStartOffset for trimming
          muted: el.muted || false,
          imageOffsetX: el.imageOffsetX,
          imageOffsetY: el.imageOffsetY,
          cropX: el.cropX,
          cropY: el.cropY,
          cropWidth: el.cropWidth,
          cropHeight: el.cropHeight,
          circleFrame: el.circleFrame || false,
          fontSize: el.fontSize,
          fontColor: el.fontColor,
          fontFamily: el.fontFamily,
        }));

      if (exportElements.length === 0) {
        alert('No valid elements to export. Please add videos, images, or text with content.');
        setIsExporting(false);
        return;
      }

      console.log('[Export] Exporting elements:', exportElements.length);
      console.log('[Export] API URL:', `${config.remotionServerUrl}/api/ugc/render-video`);

      // Calculate the actual duration from the last element's end time
      const actualDuration = getLastElementEndTime();
      console.log('[Export] Actual duration from last element:', actualDuration, 'ms');

      // Prepare subtitle data for export
      const subtitleData = showSubtitles && subtitleSegments.length > 0 ? {
        segments: subtitleSegments,
        style: subtitleStyle,
        position: subtitlePosition,
        fontSize: subtitleFontSize,
        fontFamily: subtitleFontFamily,
        singleLine: subtitleSingleLine,
        singleWord: subtitleSingleWord,
        karaokePillColor,
        boldGreenColor,
      } : null;

      const response = await fetch(`${config.remotionServerUrl}/api/ugc/render-video`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          elements: exportElements,
          projectId: currentProject?.id || null,
          subtitles: subtitleData,
          playbackRate: playbackRate, // Include playback rate in render request
          duration: actualDuration, // Send the actual duration from the canvas
        }),
      });

      console.log('[Export] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Export] Response data:', data);

      if (data.success) {
        // Check if we got a render_job_id (Lambda/Fargate pipeline)
        if (data.render_job_id) {
          console.log('[Export] Render job created:', data.render_job_id);
          setRenderJobId(data.render_job_id);
          setRenderStatus('QUEUED');
          setRenderProgress(0);
          
          // Subscribe to render job updates (like 2-char renders)
          const projectId = currentProject?.id || data.project_id;
          if (projectId) {
            console.log('[Export] Subscribing to render job updates for project:', projectId);
            subscribeToRenderJob(data.render_job_id, projectId);
          }
          
          // Also poll for updates as fallback
          const pollRenderStatus = async () => {
            try {
              const { getRenderJobStatus } = await import('@/lib/api/projects');
              const status = await getRenderJobStatus(projectId, data.render_job_id);
              if (status.render_job) {
                const job = status.render_job;
                const jobStatus = (job.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
                
                // Map backend status to frontend status
                if (jobStatus === 'completed') {
                  setRenderProgress(100);
                  if (job.result_url || job.video_url) {
                    setExportedVideoUrl(job.result_url || job.video_url);
                    setRenderStatus('READY');
                    return; // Stop polling
                  }
                } else if (jobStatus === 'failed') {
                  setRenderStatus('FAILED');
                  return; // Stop polling
                } else if (jobStatus === 'processing') {
                  setRenderStatus('RENDERING');
                  setRenderProgress(job.progress || 0);
                  // Continue polling
                  setTimeout(pollRenderStatus, 3000); // Poll every 3 seconds
                } else {
                  // pending
                  setRenderStatus('QUEUED');
                  setRenderProgress(0);
                  // Continue polling
                  setTimeout(pollRenderStatus, 3000); // Poll every 3 seconds
                }
              }
            } catch (error) {
              console.error('[Export] Error polling render status:', error);
              // Continue polling on error
              setTimeout(pollRenderStatus, 5000);
            }
          };
          
          // Start polling after a short delay
          setTimeout(pollRenderStatus, 2000);
        } else if (data.video_url) {
          // Local rendering - video is ready immediately
        console.log('[Export] Setting exportedVideoUrl to:', data.video_url);
          setExportedVideoUrl(data.video_url);
          setRenderStatus('READY');
          setRenderProgress(100);
        } else {
          throw new Error(data.error || 'Export failed - no video URL or render job ID');
        }
      } else {
        throw new Error(data.error || 'Export failed');
      }
    } catch (error) {
      console.error('[Export] Error:', error);
      alert(`Failed to export video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setExportedVideoUrl(null); // Clear exported video on error (ref will sync via useEffect)
    } finally {
      // Always reset exporting state, even if there was an error
      console.log('[Export] Resetting export state');
      setIsExporting(false);
    }
  };

  // Remove background from video
  const handleRemoveBackground = useCallback(async (elementId: string) => {
    console.log('[Background Removal] Function called with elementId:', elementId);
    
    // Get current element from state using a ref or by reading directly
    // We'll use a ref to store the latest canvasElements
    const element = canvasElements.find(el => el.id === elementId);
    console.log('[Background Removal] Element found:', element ? { id: element.id, type: element.type, url: element.url } : 'NOT FOUND');
    
    if (!element || element.type !== "video" || !element.url) {
      console.warn('[Background Removal] Early return - element:', element, 'type:', element?.type, 'url:', element?.url);
      alert(`Cannot remove background: ${!element ? 'Element not found' : element.type !== "video" ? 'Not a video element' : 'No video URL'}`);
      return;
    }

    setRemovingBackground(elementId);
    try {
      console.log('[Background Removal] Starting background removal for:', element.url);
      console.log('[Background Removal] API URL:', `${config.remotionServerUrl}/video/remove-background`);
      
      // Get cached token at the start of long-running operation
      // This prevents token expiration issues during processing
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      const cachedToken = await getCachedToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (cachedToken) {
        headers['Authorization'] = `Bearer ${cachedToken}`;
      }
      
      // Call backend API to remove background
      const apiUrl = `${config.remotionServerUrl}/video/remove-background`;
      const requestBody = {
        video_url: element.url,
      };
      
      console.log('[Background Removal] Making API call to:', apiUrl);
      console.log('[Background Removal] Request body:', requestBody);
      console.log('[Background Removal] Using cached token:', cachedToken ? '✅' : '❌');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      console.log('[Background Removal] Fetch completed, response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[Background Removal] Response data:', data);
      
      if (data.success) {
        if (data.video_url) {
          // Background removal completed immediately
          console.log('[Background Removal] Completed immediately, updating element with:', data.video_url);
          updateCanvasElement(elementId, { url: data.video_url });
          alert('Background removed successfully!');
          setRemovingBackground(null);
        } else if (data.job_id) {
          // Background removal is queued/processing, poll for status using job_id
          console.log('[Background Removal] Job queued, job ID:', data.job_id);
          // Inform user about expected processing time
          alert('Background removal started! This process typically takes ~8 minutes. Please wait...');
          let pollAttempts = 0;
          const maxPollAttempts = 180; // 15 minutes max (180 * 5 seconds = 900 seconds)
          
          const pollStatus = async () => {
            pollAttempts++;
            console.log(`[Background Removal] Polling attempt ${pollAttempts}/${maxPollAttempts} for job: ${data.job_id}`);
            
            try {
              // Use cached token for polling (prevents expiration during long operations)
              const { getCachedToken } = await import('@/lib/utils/token-cache');
              const cachedToken = await getCachedToken();
              
              const headers: HeadersInit = {
                'Content-Type': 'application/json',
              };
              if (cachedToken) {
                headers['Authorization'] = `Bearer ${cachedToken}`;
              }
              
              const statusResponse = await fetch(`${config.remotionServerUrl}/video/remove-background-status/${data.job_id}`, {
                headers,
              });
              
              if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.status}`);
              }
              
              const statusData = await statusResponse.json();
              console.log('[Background Removal] Status data:', statusData);
              
              if (statusData.success) {
                if (statusData.status === 'completed' && statusData.video_url) {
                  // Job completed successfully
                console.log('[Background Removal] Completed, updating element with:', statusData.video_url);
                updateCanvasElement(elementId, { url: statusData.video_url });
                alert('Background removed successfully!');
                setRemovingBackground(null);
                } else if (statusData.status === 'failed') {
                  // Job failed
                throw new Error(statusData.error || 'Background removal failed');
              } else if (pollAttempts >= maxPollAttempts) {
                  // Timeout
                  throw new Error('Background removal timed out after 15 minutes');
              } else {
                  // Still processing (queued or processing), poll again
                  console.log(`[Background Removal] Status: ${statusData.status}, polling again in 5s...`);
                setTimeout(pollStatus, 5000);
                }
              } else {
                throw new Error(statusData.error || 'Failed to get job status');
              }
            } catch (pollError: any) {
              console.error('[Background Removal] Error polling status:', pollError);
              alert(`Failed to check background removal status: ${pollError.message}`);
              setRemovingBackground(null);
            }
          };
          
          // Start polling after 5 seconds
          setTimeout(pollStatus, 5000);
          return; // Don't set removingBackground to null yet
        } else {
          throw new Error('No video URL or job ID returned');
        }
      } else {
        throw new Error(data.error || 'Failed to remove background');
      }
    } catch (error: any) {
      console.error('[Background Removal] Error:', error);
      alert(`Failed to remove background: ${error.message}`);
      setRemovingBackground(null);
    }
  }, [canvasElements, updateCanvasElement]); // Include canvasElements and updateCanvasElement in deps

  // Handle canvas mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent, elementId: string) => {
    if (!canvasRef.current) return;
    e.stopPropagation();
    setSelectedElementId(elementId);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const element = canvasElements.find(el => el.id === elementId);
    if (!element) return;

    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Check if clicking on resize handle (bottom-right corner)
    const elementX = element.x;
    const elementY = element.y;
    const elementW = element.width;
    const elementH = element.height;
    
    // Check if clicking on resize handle (any edge or corner)
    const handleSize = 3; // 3% of canvas for handle detection
    
    // Determine which edge/corner is being clicked
    const isNearLeft = mouseX >= elementX && mouseX <= elementX + handleSize;
    const isNearRight = mouseX >= elementX + elementW - handleSize && mouseX <= elementX + elementW;
    const isNearTop = mouseY >= elementY && mouseY <= elementY + handleSize;
    const isNearBottom = mouseY >= elementY + elementH - handleSize && mouseY <= elementY + elementH;
    
    let direction: string | null = null;
    if (isNearTop && isNearLeft) direction = 'nw';
    else if (isNearTop && isNearRight) direction = 'ne';
    else if (isNearBottom && isNearLeft) direction = 'sw';
    else if (isNearBottom && isNearRight) direction = 'se';
    else if (isNearTop) direction = 'n';
    else if (isNearBottom) direction = 's';
    else if (isNearLeft) direction = 'w';
    else if (isNearRight) direction = 'e';
    
    // Handle resize first, then dragging, then panning for images
    if (direction) {
      setIsResizing(true);
      setResizeDirection(direction);
      
      // For images, determine the anchor point based on resize direction
      // Store initial offsets to maintain anchor during resize
      let initialImageOffsetX = element.imageOffsetX ?? 50;
      let initialImageOffsetY = element.imageOffsetY ?? 50;
      
      if (element.type === "image") {
        // Set anchor point based on resize direction (opposite edge)
        // This ensures cropping happens only from the direction being resized
        if (direction.includes('e')) {
          // Resizing from right (east) - anchor image to left edge (0%)
          // This means the left part of the image stays visible, right gets cropped
          initialImageOffsetX = 0;
        } else if (direction.includes('w')) {
          // Resizing from left (west) - anchor image to right edge (100%)
          // This means the right part of the image stays visible, left gets cropped
          initialImageOffsetX = 100;
        }
        // If resizing from both sides (shouldn't happen with single direction), keep current offset
        
        if (direction.includes('s')) {
          // Resizing from bottom (south) - anchor image to top edge (0%)
          // This means the top part of the image stays visible, bottom gets cropped
          initialImageOffsetY = 0;
        } else if (direction.includes('n')) {
          // Resizing from top (north) - anchor image to bottom edge (100%)
          // This means the bottom part of the image stays visible, top gets cropped
          initialImageOffsetY = 100;
        }
        // If resizing from both top/bottom (shouldn't happen), keep current offset
      }
      
      // Store element's position, size, and image offsets for resize calculation
      setResizeStart({ 
        x: elementX, 
        y: elementY, 
        width: elementW, 
        height: elementH,
        imageOffsetX: initialImageOffsetX,
        imageOffsetY: initialImageOffsetY
      });
      // Store initial mouse position separately for delta calculation
      setDragStart({ x: mouseX, y: mouseY });
    } else if (element.type === "image" && e.ctrlKey) {
      // Ctrl + drag for images = start crop selection
      setIsCropping(true);
      setCropStart({ x: mouseX, y: mouseY });
      setCropArea({ x: 0, y: 0, width: 0, height: 0 });
      e.preventDefault();
      e.stopPropagation();
    } else if (element.type === "image" && e.altKey) {
      // Alt + drag for images = pan image content
      setIsPanning(true);
      setPanStart({
        x: element.imageOffsetX || 50, // Default center position (50%)
        y: element.imageOffsetY || 50
      });
      setDragStart({ x: mouseX, y: mouseY });
    } else {
      // Normal drag = move element position (for all elements including images)
      setIsDragging(true);
      setDragStart({ 
        x: mouseX - elementX, 
        y: mouseY - elementY 
      });
    }
  };

  // Handle canvas mouse move
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
    const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

    // Handle crop selection
    if (isCropping && cropStart && selectedElementId) {
      const element = canvasElements.find(el => el.id === selectedElementId);
      if (element && element.type === "image") {
        // Calculate crop area relative to element bounds
        const elementX = element.x;
        const elementY = element.y;
        const elementW = element.width;
        const elementH = element.height;
        
        // Convert mouse position to element-relative coordinates
        const relX = mouseX - elementX;
        const relY = mouseY - elementY;
        const relStartX = cropStart.x - elementX;
        const relStartY = cropStart.y - elementY;
        
        // Calculate crop area (ensure it's within element bounds)
        const cropX = Math.max(0, Math.min(relStartX, relX));
        const cropY = Math.max(0, Math.min(relStartY, relY));
        const cropWidth = Math.max(0, Math.min(elementW, Math.abs(relX - relStartX)));
        const cropHeight = Math.max(0, Math.min(elementH, Math.abs(relY - relStartY)));
        
        // Convert to percentage of element size
        const cropXPercent = (cropX / elementW) * 100;
        const cropYPercent = (cropY / elementH) * 100;
        const cropWidthPercent = (cropWidth / elementW) * 100;
        const cropHeightPercent = (cropHeight / elementH) * 100;
        
        setCropArea({
          x: cropXPercent,
          y: cropYPercent,
          width: cropWidthPercent,
          height: cropHeightPercent
        });
      }
      return;
    }

    if ((!isDragging && !isResizing && !isPanning) || !selectedElementId) return;

    if (isPanning) {
      // Pan the image content within the element
      const deltaX = mouseX - dragStart.x;
      const deltaY = mouseY - dragStart.y;
      
      // Calculate new offset (in percentage, allow negative and >100 to push image outside bounds)
      // The offset represents the center point of the image (50% = center)
      // Allow values from -100 to 200 to push image outside canvas
      const newOffsetX = panStart.x + deltaX;
      const newOffsetY = panStart.y + deltaY;
      
      updateCanvasElement(selectedElementId, { 
        imageOffsetX: newOffsetX, 
        imageOffsetY: newOffsetY 
      });
    } else if (isDragging) {
      // Allow elements to move freely beyond canvas boundaries (like CapCut)
      const newX = mouseX - dragStart.x;
      const newY = mouseY - dragStart.y;
      updateCanvasElement(selectedElementId, { x: newX, y: newY });
    } else if (isResizing && resizeDirection) {
      const element = canvasElements.find(el => el.id === selectedElementId);
      if (!element) return;
      
      // Calculate mouse movement delta from initial mouse position
      const deltaX = mouseX - dragStart.x;
      const deltaY = mouseY - dragStart.y;
      
      let newX = resizeStart.x;
      let newY = resizeStart.y;
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      
      const minSize = 5; // Minimum size in percentage
      
      // For images, use the anchor point stored at resize start
      // This ensures the image stays anchored to the opposite edge throughout the resize
      // The anchor point is set once at resize start and never changes during resize
      let newImageOffsetX = resizeStart.imageOffsetX;
      let newImageOffsetY = resizeStart.imageOffsetY;
      
      // Handle different resize directions
      // Horizontal resizing
      if (resizeDirection.includes('e')) {
        // East (right) edge or corner - resize width from right, keep left edge fixed
        // Image is anchored to left (imageOffsetX = 0), so only right side gets cropped
        newWidth = Math.max(minSize, resizeStart.width + deltaX);
        // Keep imageOffsetX at 0 (left anchor) - don't change it
      }
      if (resizeDirection.includes('w')) {
        // West (left) edge or corner - resize width from left, adjust x to keep right edge fixed
        // Image is anchored to right (imageOffsetX = 100), so only left side gets cropped
        newX = resizeStart.x + deltaX;
        newWidth = Math.max(minSize, resizeStart.width - deltaX);
        // Keep imageOffsetX at 100 (right anchor) - don't change it
      }
      
      // Vertical resizing
      if (resizeDirection.includes('s')) {
        // South (bottom) edge or corner - resize height from bottom, keep top edge fixed
        // Image is anchored to top (imageOffsetY = 0), so only bottom side gets cropped
        newHeight = Math.max(minSize, resizeStart.height + deltaY);
        // Keep imageOffsetY at 0 (top anchor) - don't change it
      }
      if (resizeDirection.includes('n')) {
        // North (top) edge or corner - resize height from top, adjust y to keep bottom edge fixed
        // Image is anchored to bottom (imageOffsetY = 100), so only top side gets cropped
        newY = resizeStart.y + deltaY;
        newHeight = Math.max(minSize, resizeStart.height - deltaY);
        // Keep imageOffsetY at 100 (bottom anchor) - don't change it
      }
      
      // Ensure minimum size
      newWidth = Math.max(minSize, newWidth);
      newHeight = Math.max(minSize, newHeight);
      
      // Update element with position, size, and image offset (for images)
      const updates: Partial<CanvasElement> = {
        x: newX, 
        y: newY, 
        width: newWidth, 
        height: newHeight 
      };
      
      if (element.type === "image") {
        updates.imageOffsetX = newImageOffsetX;
        updates.imageOffsetY = newImageOffsetY;
      }
      
      updateCanvasElement(selectedElementId, updates);
    }
  };

  // Handle canvas mouse up
  const handleCanvasMouseUp = () => {
    // Apply crop if we were cropping
    if (isCropping && cropArea && selectedElementId && cropArea.width > 0 && cropArea.height > 0) {
      const element = canvasElements.find(el => el.id === selectedElementId);
      if (element && element.type === "image" && element.url) {
        // Apply crop to element
        updateCanvasElement(selectedElementId, {
          cropX: cropArea.x,
          cropY: cropArea.y,
          cropWidth: cropArea.width,
          cropHeight: cropArea.height
        });
      }
    }
    
    // Don't reset trimming here - it's handled by timeline trim handlers
    if (!isTrimming) {
      setIsDragging(false);
      setIsResizing(false);
      setIsPanning(false);
      setIsCropping(false);
      setCropStart(null);
      setCropArea(null);
      setResizeDirection(null);
    }
  };

  // Handle timeline trim mouse move
  const handleTimelineTrimMove = (e: MouseEvent) => {
    console.log('🔧 TRIM MOVE - Entry:', { isTrimming, trimElementId, trimEdge });
    
    if (!isTrimming || !trimElementId || !trimEdge) {
      console.log('❌ TRIM MOVE - Blocked: Missing state', { isTrimming, trimElementId, trimEdge });
      return;
    }

    const element = canvasElements.find(el => el.id === trimElementId);
    console.log('🔍 TRIM MOVE - Element found:', { element: element ? { id: element.id, type: element.type } : null });
    
    if (!element || (element.type !== "video" && element.type !== "image" && element.type !== "audio")) {
      console.log('❌ TRIM MOVE - Blocked: Invalid element', { element: element ? element.type : 'not found' });
      return;
    }

    // Find the tracks container - it's the parent of the timeline tracks
    const tracksContainer = document.querySelector('.timeline-tracks-container')?.parentElement as HTMLElement;
    console.log('🔍 TRIM MOVE - Tracks container:', { found: !!tracksContainer });
    
    if (!tracksContainer) {
      console.log('❌ TRIM MOVE - Blocked: Tracks container not found');
      return;
    }

    const rect = tracksContainer.getBoundingClientRect();
    const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
    
    // Calculate delta from initial mouse position (use ref to avoid stale closure)
    const initialMouseX = trimStartRef.current.x;
    const deltaMouseX = e.clientX - initialMouseX;
    
    // Match mouse movement 1:1 - no sensitivity reduction
    const trimSensitivity = 1.0; // 1.0 = 100% sensitivity (mouse movement matches trim movement exactly)
    const deltaTime = (deltaMouseX / contentWidth) * (duration || 1000) * trimSensitivity;

    // Use initial element state from when trimming started (stored in ref) to prevent accumulation
    const initialStartTime = trimStartRef.current.startTime;
    const initialDuration = trimStartRef.current.duration;
    const initialVideoStartOffset = trimStartRef.current.videoStartOffset;

    console.log('📊 TRIM MOVE - Calculations:', {
      initialMouseX,
      currentMouseX: e.clientX,
      deltaMouseX,
      contentWidth,
      duration,
      trimSensitivity: 1.0,
      deltaTime,
      initialStartTime,
      initialDuration,
      initialVideoStartOffset
    });

    // Get video/audio element to check constraints (only for videos and audio)
    const video = element.type === "video" ? document.querySelector(`#canvas-video-${trimElementId}`) as HTMLVideoElement : null;
    const audio = element.type === "audio" ? document.querySelector(`#canvas-audio-${trimElementId}`) as HTMLAudioElement : null;
    
    // Get actual video/audio duration - prioritize stored original duration, fallback to DOM element
    let maxVideoDuration = Infinity;
    let maxAudioDuration = Infinity;
    
    // First, try to get from stored original duration (most reliable)
    const storedOriginalDuration = originalMediaDurationsRef.current.get(trimElementId);
    if (storedOriginalDuration && storedOriginalDuration > 0) {
      if (element.type === "video") {
        maxVideoDuration = storedOriginalDuration;
      } else if (element.type === "audio") {
        maxAudioDuration = storedOriginalDuration;
      }
    }
    
    // Fallback: try to get from DOM element if stored value not available
    if (element.type === "video" && video && maxVideoDuration === Infinity) {
      if (video.duration && video.duration > 0 && !isNaN(video.duration)) {
        maxVideoDuration = video.duration * 1000;
        // Store it for future use
        originalMediaDurationsRef.current.set(trimElementId, maxVideoDuration);
      }
    }
    
    if (element.type === "audio" && audio && maxAudioDuration === Infinity) {
      if (audio.duration && audio.duration > 0 && !isNaN(audio.duration)) {
        maxAudioDuration = audio.duration * 1000;
        // Store it for future use
        originalMediaDurationsRef.current.set(trimElementId, maxAudioDuration);
      }
    }
    
    const isImage = element.type === "image";
    const isAudio = element.type === "audio";
    const maxMediaDuration = isAudio ? maxAudioDuration : maxVideoDuration;
    
    console.log('🎥 TRIM MOVE - Element:', { 
      type: element.type,
      elementId: trimElementId,
      found: !!video || !!audio, 
      videoDuration: video?.duration, 
      audioDuration: audio?.duration,
      storedOriginalDuration,
      maxVideoDuration,
      maxAudioDuration,
      maxMediaDuration,
      isImage,
      isAudio,
      hasValidDuration: maxMediaDuration !== Infinity
    });
    
    // CRITICAL: If we can't get the actual duration, we can't enforce hard stops
    // Log a warning but don't block - this should be rare
    if (!isImage && maxMediaDuration === Infinity) {
      console.warn('⚠️ TRIM MOVE - Cannot enforce hard stops: video/audio duration not available');
      console.warn('⚠️ This might allow extending beyond original duration. Video/Audio might not be loaded yet.');
    }

    if (trimEdge === 'left') {
      console.log('⬅️ TRIM MOVE - Left edge trim');
      // Trimming left edge: move startTime forward, decrease duration
      // For videos: also increase videoStartOffset
      // For audio: also increase audioStartOffset
      // For images: no offset
      // Calculate from initial state to prevent accumulation
      const initialAudioStartOffset = trimStartRef.current.audioStartOffset || 0;
      let newStartTime = Math.max(0, initialStartTime + deltaTime);
      let newDuration = Math.max(100, initialDuration - deltaTime); // Min 100ms
      let newVideoStartOffset = isImage ? 0 : (isAudio ? 0 : Math.max(0, initialVideoStartOffset + deltaTime));
      let newAudioStartOffset = isImage ? 0 : (isAudio ? Math.max(0, initialAudioStartOffset + deltaTime) : 0);
      
      // HARD STOP: Prevent dragging beyond original video/audio duration
      // If trim would exceed original length, don't allow the drag to work at all
      if (!isImage && maxMediaDuration !== Infinity) {
        if (isAudio) {
          const wouldExceed = newAudioStartOffset + newDuration > maxAudioDuration;
          if (wouldExceed) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original audio duration');
            return;
          }
        } else {
          const wouldExceed = newVideoStartOffset + newDuration > maxVideoDuration;
          if (wouldExceed) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original video duration');
            return;
          }
        }
      }
      
      // Don't extend past the previous clip's end (add-back is limited by adjacent clip)
      const prevClips = canvasElements.filter(el =>
        el.id !== trimElementId && (el.type === "video" || el.type === "image" || el.type === "audio") &&
        (el.startTime || 0) + (el.duration || 5000) <= initialStartTime + 50
      );
      const prevEnd = prevClips.length ? Math.max(...prevClips.map(el => (el.startTime || 0) + (el.duration || 5000))) : 0;
      newStartTime = Math.max(newStartTime, prevEnd);
      newDuration = Math.max(100, initialStartTime + initialDuration - newStartTime);
      // When extending left we show more from start of media, so offset decreases
      if (!isImage && !isAudio) newVideoStartOffset = Math.max(0, initialVideoStartOffset - (initialStartTime - newStartTime));
      if (isAudio) newAudioStartOffset = Math.max(0, initialAudioStartOffset - (initialStartTime - newStartTime));
      // Clamp to media duration after adjacent-clip cap
      if (!isImage && maxMediaDuration !== Infinity) {
        if (isAudio) {
          const maxDur = maxAudioDuration - newAudioStartOffset;
          if (newDuration > maxDur) newDuration = Math.max(100, maxDur);
        } else {
          const maxDur = maxVideoDuration - newVideoStartOffset;
          if (newDuration > maxDur) newDuration = Math.max(100, maxDur);
        }
      }
      
      console.log('📐 TRIM MOVE - Left edge values (after clamping):', {
        newStartTime,
        newDuration,
        newVideoStartOffset,
        maxVideoDuration,
        sum: newVideoStartOffset + newDuration
      });
      
      // Constraints:
      // 1. Timeline: newStartTime >= 0 (can't go before timeline start)
      // 2. Timeline: newStartTime + newDuration <= total duration (but allow slight overflow for better UX)
      // 3. Media: newVideoStartOffset + newDuration <= media file duration (for videos), or newDuration <= audio file duration (for audio)
      // 4. Minimum duration: 100ms
      // 5. Non-negative offset (only for videos)
      const constraint1 = newStartTime >= 0;
      // For audio, allow trimming even if element extends slightly beyond timeline
      // This allows trimming from left even when element is at the end
      const maxAllowedEnd = isAudio ? duration * 1.1 : duration; // Allow 10% overflow for audio
      const constraint2 = newStartTime + newDuration <= maxAllowedEnd;
      const constraint3 = newDuration >= 100;
      const constraint4 = (isImage || isAudio) || newVideoStartOffset >= 0; // Always true for images and audio
      const constraint5 = (isImage || isAudio) || maxVideoDuration === Infinity || (newVideoStartOffset + newDuration <= maxVideoDuration);
      // For audio, check that audioStartOffset + duration doesn't exceed audio file duration
      // But if audio hasn't loaded yet (maxAudioDuration is Infinity), allow it
      const constraint6 = isAudio ? (maxAudioDuration === Infinity || (newAudioStartOffset + newDuration <= maxAudioDuration)) : true;
      
      console.log('✅ TRIM MOVE - Left edge constraints:', {
        constraint1,
        constraint2,
        constraint3,
        constraint4,
        constraint5,
        constraint6,
        allPass: constraint1 && constraint2 && constraint3 && constraint4 && constraint5 && constraint6,
        newStartTimePlusDuration: newStartTime + newDuration,
        totalDuration: duration,
        videoOffsetPlusDuration: newVideoStartOffset + newDuration,
        maxVideoDuration,
        maxAudioDuration,
        isImage,
        isAudio
      });
      
      // Calculate trimmed seconds (only meaningful for videos and audio)
      if (isAudio) {
        const originalAudioDuration = maxAudioDuration !== Infinity ? maxAudioDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const audioStartSeconds = (newAudioStartOffset / 1000).toFixed(2);
        const audioEndSeconds = ((newAudioStartOffset + newDuration) / 1000).toFixed(2);
        
        console.log('✂️ TRIM INFO - Left Edge (Audio):', {
          'Audio start (in file)': `${audioStartSeconds}s`,
          'Audio end (in file)': `${audioEndSeconds}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Original audio duration': `${originalAudioDuration.toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else if (!isImage) {
        const trimmedFromStart = (newVideoStartOffset / 1000).toFixed(2);
        const originalVideoDuration = maxVideoDuration !== Infinity ? maxVideoDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const trimmedFromEnd = maxVideoDuration !== Infinity 
          ? ((maxVideoDuration - newVideoStartOffset - newDuration) / 1000).toFixed(2)
          : '0.00';
        
        console.log('✂️ TRIM INFO - Left Edge (Video):', {
          'Trimmed from start': `${trimmedFromStart}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Trimmed from end': `${trimmedFromEnd}s`,
          'Original video duration': `${originalVideoDuration.toFixed(2)}s`,
          'Video start offset': `${(newVideoStartOffset / 1000).toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else {
        console.log('✂️ TRIM INFO - Left Edge (Image):', {
          'Start time': `${(newStartTime / 1000).toFixed(2)}s`,
          'Duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      }
      
      // Check for nearby elements to show overlap indicator
      const newEndTime = newStartTime + newDuration;
      const nearbyElements = canvasElements.filter(el => 
        el.id !== trimElementId && 
        (el.type === "video" || el.type === "image" || el.type === "audio" || el.type === "text")
      );
      
      let closestOverlap: { time: number; type: 'start' | 'end' } | null = null;
      let minDistance = Infinity;
      
      nearbyElements.forEach(otherEl => {
        const otherStart = otherEl.startTime || 0;
        const otherEnd = otherStart + (otherEl.duration || 5000);
        
        // Check distance from new start time to other element's start
        const distanceToOtherStartFromNewStart = Math.abs(newStartTime - otherStart);
        if (distanceToOtherStartFromNewStart < 500 && distanceToOtherStartFromNewStart < minDistance) {
          minDistance = distanceToOtherStartFromNewStart;
          closestOverlap = { time: otherStart, type: 'start' };
        }
        
        // Check distance from new start time to other element's end
        const distanceToOtherEndFromNewStart = Math.abs(newStartTime - otherEnd);
        if (distanceToOtherEndFromNewStart < 500 && distanceToOtherEndFromNewStart < minDistance) {
          minDistance = distanceToOtherEndFromNewStart;
          closestOverlap = { time: otherEnd, type: 'end' };
        }
        
        // Check distance from new end time to other element's start
        const distanceToOtherStartFromNewEnd = Math.abs(newEndTime - otherStart);
        if (distanceToOtherStartFromNewEnd < 500 && distanceToOtherStartFromNewEnd < minDistance) {
          minDistance = distanceToOtherStartFromNewEnd;
          closestOverlap = { time: otherStart, type: 'start' };
        }
        
        // Check distance from new end time to other element's end
        const distanceToOtherEndFromNewEnd = Math.abs(newEndTime - otherEnd);
        if (distanceToOtherEndFromNewEnd < 500 && distanceToOtherEndFromNewEnd < minDistance) {
          minDistance = distanceToOtherEndFromNewEnd;
          closestOverlap = { time: otherEnd, type: 'end' };
        }
      });
      
      setTrimOverlapIndicator(closestOverlap);
      
      if (constraint1 && constraint2 && constraint3 && constraint4 && constraint5 && constraint6) {
        // Update offsets for videos and audio, not images
        const updates: Partial<CanvasElement> = {
          startTime: newStartTime,
          duration: newDuration
        };
        if (!isImage && !isAudio) {
          updates.videoStartOffset = newVideoStartOffset;
        } else if (isAudio) {
          updates.audioStartOffset = newAudioStartOffset;
        }
        console.log('✅ TRIM MOVE - Updating element (LEFT):', {
          trimElementId,
          updates
        });
        updateCanvasElement(trimElementId, updates);
        console.log('✅ TRIM MOVE - Element updated successfully (LEFT)');
      } else {
        console.log('❌ TRIM MOVE - Constraints failed (LEFT), not updating');
      }
    } else if (trimEdge === 'right') {
      console.log('➡️ TRIM MOVE - Right edge trim');
      // Trimming right edge: change duration only (no change to videoStartOffset or startTime)
      // Calculate from initial state to prevent accumulation
      let newDuration = Math.max(100, initialDuration + deltaTime); // Min 100ms
      
      // HARD STOP: Prevent dragging beyond original video/audio duration
      // If trim would exceed original length, don't allow the drag to work at all
      if (!isImage && maxMediaDuration !== Infinity) {
        if (isAudio) {
          const initialAudioStartOffset = trimStartRef.current.audioStartOffset || 0;
          if (initialAudioStartOffset + newDuration > maxAudioDuration) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original audio duration');
            return;
          }
        } else {
          if (initialVideoStartOffset + newDuration > maxVideoDuration) {
            console.log('❌ TRIM MOVE - Blocked: Would exceed original video duration');
            return;
          }
        }
      }
      
      // Don't extend past the next clip's start (add-back is limited by adjacent clip)
      const nextClips = canvasElements.filter(el =>
        el.id !== trimElementId && (el.type === "video" || el.type === "image" || el.type === "audio") &&
        (el.startTime || 0) >= initialStartTime + initialDuration - 50
      );
      const nextStart = nextClips.length ? Math.min(...nextClips.map(el => el.startTime || 0)) : duration;
      const maxEndTime = Math.min(duration, nextStart);
      newDuration = Math.min(newDuration, Math.max(100, maxEndTime - initialStartTime));
      
      console.log('📐 TRIM MOVE - Right edge values:', {
        newDuration,
        initialVideoStartOffset,
        maxVideoDuration,
        maxAudioDuration,
        isImage,
        isAudio,
        maxAllowedDuration: isImage ? Infinity : (isAudio ? (maxAudioDuration - (trimStartRef.current.audioStartOffset || 0)) : (maxVideoDuration - initialVideoStartOffset))
      });
      
      // Constraints:
      // 1. Timeline: initialStartTime + newDuration <= total duration
      // 2. Minimum duration: 100ms
      // 3. HARD STOP: videoStartOffset + newDuration <= original video duration (for videos)
      // 4. HARD STOP: audioStartOffset + newDuration <= original audio duration (for audio)
      const constraint1 = initialStartTime + newDuration <= duration;
      const constraint2 = newDuration >= 100;
      const constraint3 = (isImage || isAudio) || maxVideoDuration === Infinity || (initialVideoStartOffset + newDuration <= maxVideoDuration);
      const constraint4 = isAudio ? (maxAudioDuration === Infinity || ((trimStartRef.current.audioStartOffset || 0) + newDuration <= maxAudioDuration)) : true;
      
      console.log('✅ TRIM MOVE - Right edge constraints:', {
        constraint1,
        constraint2,
        constraint3,
        constraint4,
        allPass: constraint1 && constraint2 && constraint3 && constraint4,
        initialStartTimePlusDuration: initialStartTime + newDuration,
        totalDuration: duration,
        newDuration,
        maxVideoDuration,
        maxAudioDuration,
        isImage,
        isAudio
      });
      
      // Calculate trimmed seconds (only meaningful for videos and audio)
      if (isAudio) {
        const originalAudioDuration = maxAudioDuration !== Infinity ? maxAudioDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const initialAudioStartOffset = trimStartRef.current.audioStartOffset || 0;
        const audioStartSeconds = (initialAudioStartOffset / 1000).toFixed(2);
        const audioEndSeconds = ((initialAudioStartOffset + newDuration) / 1000).toFixed(2);
        
        console.log('✂️ TRIM INFO - Right Edge (Audio):', {
          'Audio start (in file)': `${audioStartSeconds}s`,
          'Audio end (in file)': `${audioEndSeconds}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Original audio duration': `${originalAudioDuration.toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else if (!isImage) {
        const trimmedFromStart = (initialVideoStartOffset / 1000).toFixed(2);
        const originalVideoDuration = maxVideoDuration !== Infinity ? maxVideoDuration / 1000 : 0;
        const remainingDuration = (newDuration / 1000).toFixed(2);
        const trimmedFromEnd = maxVideoDuration !== Infinity 
          ? ((maxVideoDuration - initialVideoStartOffset - newDuration) / 1000).toFixed(2)
          : '0.00';
        
        console.log('✂️ TRIM INFO - Right Edge (Video):', {
          'Trimmed from start': `${trimmedFromStart}s`,
          'Remaining duration': `${remainingDuration}s`,
          'Trimmed from end': `${trimmedFromEnd}s`,
          'Original video duration': `${originalVideoDuration.toFixed(2)}s`,
          'Video start offset': `${(initialVideoStartOffset / 1000).toFixed(2)}s`,
          'Clip duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      } else {
        console.log('✂️ TRIM INFO - Right Edge (Image):', {
          'Start time': `${(initialStartTime / 1000).toFixed(2)}s`,
          'Duration': `${(newDuration / 1000).toFixed(2)}s`
        });
      }
      
      // Check for nearby elements to show overlap indicator
      const newEndTime = initialStartTime + newDuration;
      const nearbyElements = canvasElements.filter(el => 
        el.id !== trimElementId && 
        (el.type === "video" || el.type === "image" || el.type === "audio" || el.type === "text")
      );
      
      let closestOverlap: { time: number; type: 'start' | 'end' } | null = null;
      let minDistance = Infinity;
      
      nearbyElements.forEach(otherEl => {
        const otherStart = otherEl.startTime || 0;
        const otherEnd = otherStart + (otherEl.duration || 5000);
        
        // Check distance from new end time to other element's start
        const distanceToOtherStart = Math.abs(newEndTime - otherStart);
        if (distanceToOtherStart < 500 && distanceToOtherStart < minDistance) { // Within 500ms
          minDistance = distanceToOtherStart;
          closestOverlap = { time: otherStart, type: 'start' };
        }
        
        // Check distance from new end time to other element's end
        const distanceToOtherEnd = Math.abs(newEndTime - otherEnd);
        if (distanceToOtherEnd < 500 && distanceToOtherEnd < minDistance) {
          minDistance = distanceToOtherEnd;
          closestOverlap = { time: otherEnd, type: 'end' };
        }
      });
      
      setTrimOverlapIndicator(closestOverlap);
      
      if (constraint1 && constraint2 && constraint3 && constraint4) {
        console.log('✅ TRIM MOVE - Updating element (RIGHT):', {
          trimElementId,
          updates: { duration: newDuration }
        });
        updateCanvasElement(trimElementId, {
          duration: newDuration
        });
        console.log('✅ TRIM MOVE - Element updated successfully (RIGHT)');
      } else {
        console.log('❌ TRIM MOVE - Constraints failed (RIGHT), not updating');
      }
    }
  };

  // Handle timeline trim mouse up
  const handleTimelineTrimUp = () => {
    console.log('🖱️ TRIM UP - Ending trim operation');
    setIsTrimming(false);
    setTrimElementId(null);
    setTrimEdge(null);
    setTrimOverlapIndicator(null); // Clear overlap indicator
    console.log('✅ TRIM UP - Trim state cleared');
  };

  // Handle timeline drag move (for moving videos and images on timeline)
  const handleTimelineDragMove = (e: MouseEvent) => {
    if (!isDraggingTimeline || !draggingTimelineElementId) return;

    const element = canvasElements.find(el => el.id === draggingTimelineElementId);
    if (!element || (element.type !== "video" && element.type !== "image" && element.type !== "audio")) return;

    // Find the tracks container - it's the parent of the timeline tracks
    const tracksContainer = document.querySelector('.timeline-tracks-container')?.parentElement as HTMLElement;
    if (!tracksContainer) return;

    const rect = tracksContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 80; // Account for track controls width (80px)
    const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
    const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
    const newTime = (percentage / 100) * (duration || 1000);

    // Calculate new startTime based on drag delta
    const deltaX = e.clientX - dragTimelineStart.x;
    const deltaTime = (deltaX / contentWidth) * (duration || 1000);
    const elementDuration = element.duration || 5000;
    
    // Calculate new startTime, but clamp it so the element doesn't go before 00:00
    let newStartTime = dragTimelineStart.startTime + deltaTime;
    
    // Clamp to ensure element doesn't go before timeline start (00:00)
    const maxStartTime = duration; // Allow dragging to the end of timeline
    const minStartTime = 0; // Don't allow dragging before 00:00
    
    newStartTime = Math.max(minStartTime, Math.min(maxStartTime, newStartTime));
    
    // HARD STOP: Ensure video/audio doesn't exceed original duration even after moving
    // Get video/audio element to check original duration - prioritize stored duration
    const video = element.type === "video" ? document.querySelector(`#canvas-video-${draggingTimelineElementId}`) as HTMLVideoElement : null;
    const audio = element.type === "audio" ? document.querySelector(`#canvas-audio-${draggingTimelineElementId}`) as HTMLAudioElement : null;
    
    // Get original duration from stored ref first, then fallback to DOM element
    const storedOriginalDuration = originalMediaDurationsRef.current.get(draggingTimelineElementId);
    let maxVideoDuration = storedOriginalDuration && element.type === "video" ? storedOriginalDuration : Infinity;
    let maxAudioDuration = storedOriginalDuration && element.type === "audio" ? storedOriginalDuration : Infinity;
    
    // Fallback to DOM element if stored value not available
    if (element.type === "video" && video && maxVideoDuration === Infinity) {
      if (video.duration && video.duration > 0 && !isNaN(video.duration)) {
        maxVideoDuration = video.duration * 1000;
        originalMediaDurationsRef.current.set(draggingTimelineElementId, maxVideoDuration);
      }
    }
    if (element.type === "audio" && audio && maxAudioDuration === Infinity) {
      if (audio.duration && audio.duration > 0 && !isNaN(audio.duration)) {
        maxAudioDuration = audio.duration * 1000;
        originalMediaDurationsRef.current.set(draggingTimelineElementId, maxAudioDuration);
      }
    }
    
    const isImage = element.type === "image";
    const isAudio = element.type === "audio";
    
    // Check if current videoStartOffset + duration would exceed original video duration
    // Moving the video doesn't change videoStartOffset or duration, but we need to ensure
    // the constraint is still valid after the move
    if (!isImage && (maxVideoDuration !== Infinity || maxAudioDuration !== Infinity)) {
      const currentVideoStartOffset = element.videoStartOffset || 0;
      const currentAudioStartOffset = element.audioStartOffset || 0;
      const currentDuration = element.duration || 5000;
      
      if (isAudio) {
        // For audio: ensure audioStartOffset + duration doesn't exceed original audio duration
        if (currentAudioStartOffset + currentDuration > maxAudioDuration) {
          console.log('❌ DRAG MOVE - Blocked: Audio would exceed original duration', {
            currentAudioStartOffset,
            currentDuration,
            maxAudioDuration,
            sum: currentAudioStartOffset + currentDuration
          });
          return; // Don't allow drag - element is already at max
        }
      } else {
        // For videos: ensure videoStartOffset + duration doesn't exceed original video duration
        if (currentVideoStartOffset + currentDuration > maxVideoDuration) {
          console.log('❌ DRAG MOVE - Blocked: Video would exceed original duration', {
            currentVideoStartOffset,
            currentDuration,
            maxVideoDuration,
            sum: currentVideoStartOffset + currentDuration
          });
          return; // Don't allow drag - element is already at max
        }
      }
    }
    
      updateCanvasElement(draggingTimelineElementId, {
        startTime: newStartTime
      });
  };

  // Handle timeline drag mouse up
  const handleTimelineDragUp = () => {
    setIsDraggingTimeline(false);
    setDraggingTimelineElementId(null);
  };

  // Handle playhead drag move
  const handlePlayheadDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPlayhead) return;

    // Find the time ruler container - it has pl-20 (80px padding) for track controls
    const timeRuler = document.querySelector('.h-6.border-b.border-gray-200.bg-white')?.querySelector('.flex.items-center.h-full') as HTMLElement;
    if (!timeRuler) {
      // Fallback: find any time ruler
      const fallback = document.querySelector('.h-6.border-b.border-gray-200') as HTMLElement;
      if (!fallback) return;
      const rect = fallback.getBoundingClientRect();
      const clickX = e.clientX - rect.left - 80; // Subtract 80px for track controls
      const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
      const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
      const newTime = (percentage / 100) * (duration || 1000);
      handleTimelineScrub(newTime);
      return;
    }

    const rect = timeRuler.getBoundingClientRect();
    // The time ruler has pl-20 (80px padding), so we need to account for that
    const clickX = e.clientX - rect.left - 80; // Subtract 80px for track controls (pl-20)
    const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
    const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
    const newTime = (percentage / 100) * (duration || 1000);
    
    handleTimelineScrub(newTime);
  }, [isDraggingPlayhead, duration]);

  // Handle playhead drag up
  const handlePlayheadDragUp = () => {
    setIsDraggingPlayhead(false);
  };

  // Add event listeners for timeline trimming
  useEffect(() => {
    console.log('🎧 TRIM EFFECT - Setup:', { isTrimming, trimElementId, trimEdge });
    if (isTrimming) {
      console.log('✅ TRIM EFFECT - Adding event listeners');
      const handleMove = (e: MouseEvent) => handleTimelineTrimMove(e);
      const handleUp = () => handleTimelineTrimUp();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      return () => {
        console.log('🧹 TRIM EFFECT - Removing event listeners');
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };
    } else {
      console.log('⏸️ TRIM EFFECT - Not trimming, no listeners added');
    }
  }, [isTrimming, trimElementId, trimEdge, canvasElements, duration]);

  // Add event listeners for timeline dragging
  useEffect(() => {
    if (isDraggingTimeline) {
      window.addEventListener('mousemove', handleTimelineDragMove);
      window.addEventListener('mouseup', handleTimelineDragUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineDragMove);
        window.removeEventListener('mouseup', handleTimelineDragUp);
      };
    }
  }, [isDraggingTimeline, draggingTimelineElementId, dragTimelineStart, canvasElements, duration]);

  // Add event listeners for playhead dragging
  useEffect(() => {
    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handlePlayheadDragMove);
      window.addEventListener('mouseup', handlePlayheadDragUp);
      return () => {
        window.removeEventListener('mousemove', handlePlayheadDragMove);
        window.removeEventListener('mouseup', handlePlayheadDragUp);
      };
    }
  }, [isDraggingPlayhead, duration, handlePlayheadDragMove]);

  // Handle timeline resize
  const handleTimelineResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizingTimeline) return;
    
    const deltaY = resizeStart.y - e.clientY; // Negative because we're dragging up
    const newHeight = Math.max(160, Math.min(window.innerHeight * 0.8, resizeStart.height + deltaY));
    setTimelineHeight(newHeight);
  }, [isResizingTimeline, resizeStart]);

  const handleTimelineResizeUp = useCallback(() => {
    setIsResizingTimeline(false);
  }, []);

  // Add event listeners for timeline resizing
  useEffect(() => {
    if (isResizingTimeline) {
      window.addEventListener('mousemove', handleTimelineResizeMove);
      window.addEventListener('mouseup', handleTimelineResizeUp);
      return () => {
        window.removeEventListener('mousemove', handleTimelineResizeMove);
        window.removeEventListener('mouseup', handleTimelineResizeUp);
      };
    }
  }, [isResizingTimeline, handleTimelineResizeMove, handleTimelineResizeUp]);

  // Handle canvas click (deselect)
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedElementId(null);
      setContextMenuElementId(null);
    }
  };

  // Handle canvas drop
  const handleCanvasDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    
    try {
      const assetData = e.dataTransfer.getData('asset');
      if (assetData) {
        const asset: Asset = JSON.parse(assetData);
        if (asset.type === "video" || asset.type === "image") {
          const rect = canvasRef.current.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          
          // For video/image, make it fit the canvas (9:16)
          let width = 30;
          let height = 30;
          let finalX = Math.max(0, Math.min(100 - 30, x - 15));
          let finalY = Math.max(0, Math.min(100 - 30, y - 15));
          
          if (asset.type === "video" || asset.type === "image") {
            width = 90;
            height = 90;
            finalX = 5; // Center: (100 - 90) / 2
            finalY = 5; // Center: (100 - 90) / 2
          }
          
          // Calculate default timeline position
          // For videos: start after the last video ends
          // For other elements: start at current playhead
          let defaultStartTime: number;
          if (asset.type === "video") {
            const videoElements = canvasElements.filter(el => el.type === "video");
            if (videoElements.length === 0) {
              defaultStartTime = 0;
            } else {
              const endTimes = videoElements.map(el => {
                const startTime = el.startTime || 0;
                // Use actual duration if available
                const duration = el.duration || 5000;
                return startTime + duration;
              });
              defaultStartTime = Math.max(...endTimes);
            }
          } else {
            defaultStartTime = currentTime || 0;
          }
          
          // Get actual video duration for videos, default for others
          let defaultDuration = (asset.type === "image") ? 5000 : (asset.type === "video" ? 5000 : 3000);
          
          // Generate thumbnail and get duration for videos/images
          let thumbnail: string | undefined;
          if (asset.type === "video" && asset.url) {
            try {
              // Get both thumbnail and duration in parallel
              const [thumb, duration] = await Promise.all([
                generateVideoThumbnail(asset.url).catch(() => asset.url),
                getVideoDuration(asset.url).catch(() => 5000)
              ]);
              thumbnail = thumb;
              defaultDuration = duration; // Use actual video duration
            } catch (error) {
              console.error("Failed to get video metadata:", error);
              thumbnail = asset.url;
              defaultDuration = 5000; // Fallback duration
            }
          } else if (asset.type === "image" && asset.url) {
            thumbnail = asset.url;
          }
          
          const newElement: CanvasElement = {
            id: uuid(),
            type: asset.type,
            url: asset.url,
            x: finalX,
            y: finalY,
            width,
            height,
            rotation: 0,
            opacity: 1,
            zIndex: canvasElements.length,
            // Image panning (default center position)
            imageOffsetX: asset.type === "image" ? 50 : undefined,
            imageOffsetY: asset.type === "image" ? 50 : undefined,
      // Timeline properties (TEMPORAL - independent from canvas position)
      startTime: defaultStartTime,
      duration: defaultDuration, // Use actual video duration for videos
      thumbnail,
      // Audio: videos are unmuted by default (can be muted individually via timeline)
      muted: asset.type === "video" ? false : undefined,
    };
          
          // Ensure project exists before adding element
          await ensureProjectExists();
          
          setCanvasElements([...canvasElements, newElement]);
          setSelectedElementId(newElement.id);
        }
      }
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex h-full w-full flex-col bg-white overflow-hidden" style={{ margin: 0, padding: 0 }}>
      {/* Top Header */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b bg-white px-4 relative z-50">
        <div className="flex items-center gap-4">
          {currentProject ? (
            isEditingProjectTitle ? (
              <Input
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                onBlur={async () => {
                  if (projectTitle.trim() && projectTitle !== currentProject.title) {
                    try {
                      await updateUGCProject(currentProject.id, { title: projectTitle.trim() });
                      setCurrentProject({ ...currentProject, title: projectTitle.trim() });
                    } catch (error: any) {
                      console.error('[Rename] Error renaming project:', error);
                      alert(`Failed to rename project: ${error.message}`);
                      setProjectTitle(currentProject.title);
                    }
                  } else {
                    setProjectTitle(currentProject.title);
                  }
                  setIsEditingProjectTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setProjectTitle(currentProject.title);
                    setIsEditingProjectTitle(false);
                  }
                }}
                className="w-64 h-8 text-sm font-semibold border-gray-300 focus:border-blue-500"
                autoFocus
              />
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
                onClick={() => {
                  setProjectTitle(currentProject.title);
                  setIsEditingProjectTitle(true);
                }}
                title="Click to rename project"
              >
                <span className="text-sm font-semibold text-gray-900">
                  {currentProject.title || currentProject.id}
                </span>
                <span className="text-xs text-gray-500">({currentProject.id})</span>
              </div>
            )
          ) : (
            <div className="text-sm text-gray-500 font-semibold">
              No Project
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={togglePlayback} className="h-8 w-8 p-0">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Hand className="h-4 w-4" />
          </Button>
          <div className="text-xs text-gray-600">{zoom}%</div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Save Button - Always visible */}
          <Button 
            size="sm" 
            variant="outline"
            className={`h-8 text-xs relative z-10 ${!currentProject ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[Save] Button clicked, currentProject:', !!currentProject, currentProject?.id);
              if (!currentProject) {
                alert('No project found. Please create a project first by selecting an avatar.');
                return;
              }
              try {
                await handleSaveProject();
              } catch (error) {
                console.error('[Save] Error in onClick handler:', error);
                // Error already handled in handleSaveProject, but log it here too
              }
            }}
            title={currentProject ? "Save Project (Ctrl+S)" : "Create a project first by selecting an avatar"}
            type="button"
          >
            <Save className="h-3 w-3 mr-1" />
            Save
          </Button>
          {exportedVideoUrl ? (
            <Button 
              size="sm" 
              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Download Button] Clicked, exportedVideoUrl state:', exportedVideoUrl);
                console.log('[Download Button] exportedVideoUrlRef.current:', exportedVideoUrlRef.current);
                // Always use the ref value which is guaranteed to be latest
                const latestUrl = exportedVideoUrlRef.current || exportedVideoUrl;
                console.log('[Download Button] Will download from:', latestUrl);
                await handleDownloadVideo();
              }}
            >
              <Download className="h-3 w-3 mr-1" />
              Download Video
            </Button>
          ) : (
            <Button 
              size="sm" 
              className="h-8 text-xs"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[Export] Button clicked, isExporting:', isExporting, 'canvasElements:', canvasElements.length);
                // Always call handleExportVideo - it has its own guard for isExporting
                // This ensures the function is called even if state appears stale
                await handleExportVideo();
            }}
            disabled={isExporting || canvasElements.length === 0}
          >
              {isExporting || renderStatus === 'RENDERING' || renderStatus === 'QUEUED' ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {renderStatus === 'QUEUED' ? 'Queued...' : renderStatus === 'RENDERING' ? `Rendering... ${renderProgress}%` : 'Exporting...'}
              </>
            ) : (
              'Export'
            )}
          </Button>
          )}
        </div>
        
        {/* Render Progress Bar - Show when rendering */}
        {renderStatus && renderStatus !== null && (
          <div className="flex flex-1 flex-col gap-2 px-4">
            <div className="flex items-center gap-2">
              <Progress value={renderProgress} className="h-2 rounded-full bg-muted flex-1" />
              {(renderStatus === "QUEUED" || renderStatus === "RENDERING") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    router.push('/app/render-queue');
                  }}
                >
                  View Render Queue
          </Button>
              )}
        </div>
            <span className={`text-xs ${
              renderStatus === "FAILED" ? "text-destructive font-medium" 
              : renderStatus === "READY" ? "text-green-600 font-medium"
              : "text-muted-foreground"
            }`}>
              {renderStatus === "RENDERING" && renderProgress > 0
                ? `Rendering... ${Math.round(renderProgress)}%`
                : renderStatus === "QUEUED"
                ? `Queued - Starting render...`
                : renderStatus === "FAILED" 
                ? "Failed - Try again" 
                : renderStatus === "READY" && exportedVideoUrl
                ? "Ready - Click Download"
                : renderStatus ?? "IDLE"}
            </span>
      </div>
        )}
          </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar - Main App Style */}
        <div className="w-64 flex-shrink-0 rounded-3xl border border-border/60 bg-white/70 p-6 shadow-xl shadow-primary/5 backdrop-blur-xl flex flex-col overflow-hidden">
          {/* Navigation Menu */}
          <nav className="flex-1 overflow-y-auto py-2 min-h-0 flex flex-col gap-2">
            {sidebarSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSidebarSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    if (section.id === "avatars") {
                      setAvatarsDialogOpen(true);
                    } else {
                      setActiveSidebarSection(section.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Content Area for Selected Section */}
          {activeSidebarSection === "captions" && (
            <div className="border-t border-border/60 flex flex-col overflow-hidden" style={{ height: "40%", minHeight: 0, maxHeight: "40%" }}>
              <ScrollArea className="h-full w-full">
                <div className="p-3 space-y-3 pb-4">
                  {/* Generate Subtitles Button */}
                  <Button
                    onClick={handleGenerateSubtitles}
                    disabled={isGeneratingSubtitles || canvasElements.filter(el => el.type === 'video' && el.url).length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    {isGeneratingSubtitles ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate Subtitles
                      </>
                    )}
                  </Button>

                  {/* Subtitle Toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">Show Subtitles</Label>
                    <button
                      onClick={() => setShowSubtitles(!showSubtitles)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        showSubtitles ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          showSubtitles ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>

                  {/* Subtitle Style Selector */}
                  {showSubtitles && (
                    <>
                      <SubtitleStyleSelector
                        value={subtitleStyle}
                        onChange={setSubtitleStyle}
                        fontSize={subtitleFontSize}
                        onFontSizeChange={setSubtitleFontSize}
                        fontFamily={subtitleFontFamily}
                        onFontFamilyChange={setSubtitleFontFamily}
                        singleLine={subtitleSingleLine}
                        onSingleLineChange={setSubtitleSingleLine}
                        singleWord={subtitleSingleWord}
                        onSingleWordChange={setSubtitleSingleWord}
                        karaokePillColor={karaokePillColor}
                        onKaraokePillColorChange={setKaraokePillColor}
                        boldGreenColor={boldGreenColor}
                        onBoldGreenColorChange={setBoldGreenColor}
                      />

                      {/* Subtitle Position Info */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">Position</Label>
                        <div className="text-xs text-muted-foreground">
                          Drag subtitle on canvas to reposition
                        </div>
                        <div className="text-xs text-muted-foreground">
                          X: {subtitlePosition.x.toFixed(1)}% Y: {subtitlePosition.y.toFixed(1)}%
                        </div>
                      </div>

                    </>
                  )}
                                </div>
              </ScrollArea>
                        </div>
                      )}

          {activeSidebarSection === "brolls" && (
            <div className="border-t border-border/60 flex flex-col overflow-hidden" style={{ height: "40%", minHeight: 0, maxHeight: "40%" }}>
              <div className="p-4 space-y-2">
                {/* Upload B-roll Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById("broll-upload")?.click()}
                  disabled={isUploading && uploadingFileName?.endsWith('.mp4')}
                >
                  {isUploading && uploadingFileName?.endsWith('.mp4') ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload B-roll
                    </>
                  )}
                </Button>
                <Input
                  id="broll-upload"
                  type="file"
                  accept="video/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    setIsUploading(true);
                    setUploadingFileName(file.name);
                    
                    try {
                      const result = await bRollsApi.upload(file);
                      await loadBRolls(); // Reload B-rolls list
                      setUploadingFileName(null);
                    } catch (error) {
                      console.error("Error uploading B-roll:", error);
                      alert(`Failed to upload B-roll: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setIsUploading(false);
                      setUploadingFileName(null);
                      // Reset file input
                      if (e.target) e.target.value = '';
                    }
                  }}
                  className="hidden"
                />

                {/* Fill Jump Cuts Button */}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setFillJumpCutsDialogOpen(true);
                    loadBRolls(); // Load B-rolls when opening modal
                  }}
                >
                  Fill Jump cuts
                </Button>
                </div>
            </div>
          )}

          {activeSidebarSection === "media" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploadingFileName ? `Uploading ${uploadingFileName}...` : 'Uploading...'}
                    </>
                  ) : (
                    <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    setMediaDialogOpen(true);
                    // Load all media in parallel with timeout protection
                    // Use Promise.allSettled so one failure doesn't block others
                    Promise.allSettled([
                      loadGeneratedVideos(),
                      loadUploadedImages(),
                      loadUploadedVideos()
                    ]).then((results) => {
                      const errors = results.filter(r => r.status === 'rejected');
                      if (errors.length > 0) {
                        console.warn("Some media failed to load:", errors);
                      }
                    });
                  }}
                >
                  <VideoIcon className="h-4 w-4 mr-2" />
                  All Media
                </Button>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {/* Upload Progress Indicator */}
                  {isUploading && uploadingFileName && (
                    <div className="flex items-center gap-2 p-2 rounded bg-blue-900/30 border border-blue-700/50">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <span className="text-xs text-blue-300 truncate">
                        Uploading: {uploadingFileName}
                      </span>
                    </div>
                  )}
                  
                  {/* Show current session assets */}
                  {assets.length > 0 && (
                    <>
                      <div className="text-xs text-gray-500 px-2 py-1">Current Session</div>
                      {assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-primary/10 cursor-pointer"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('asset', JSON.stringify(asset));
                          }}
                          onClick={() => {
                            if (asset.type === "video" || asset.type === "image") {
                              addElementToCanvas(asset.type, asset.url);
                            }
                          }}
                        >
                          {asset.type === "image" && <ImageIcon className="h-4 w-4 text-gray-400" />}
                          {asset.type === "video" && <VideoIcon className="h-4 w-4 text-gray-400" />}
                          {asset.type === "audio" && <Music className="h-4 w-4 text-gray-400" />}
                          <span className="text-xs text-gray-300 truncate">{asset.name}</span>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {assets.length === 0 && (
                    <div className="text-center text-xs text-gray-500 py-8">
                      No media files in this session
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {activeSidebarSection === "templates" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4">
                <div className="text-center text-muted-foreground py-8">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Coming Soon</p>
                </div>
              </div>
            </div>
          )}

          {activeSidebarSection === "text" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => addElementToCanvas("text")}
                >
                  <Type className="h-4 w-4 mr-2" />
                  Add Text
                </Button>
              </div>
            </div>
          )}

          {activeSidebarSection === "audio" && (
            <div className="border-t border-border/60 flex flex-col" style={{ height: "40%" }}>
              <div className="p-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => document.getElementById("audio-upload")?.click()}
                  disabled={isUploading}
                >
                  {isUploading && uploadingFileName?.endsWith('.mp3') ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Audio
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setShowSpeechGeneration(true);
                    setCurrentStep("speech");
                  }}
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Create with ElevenLabs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    setAudioDialogOpen(true);
                    await loadUploadedAudios();
                  }}
                >
                  <Music className="h-4 w-4 mr-2" />
                  My Audio
                </Button>
                <Input
                  id="audio-upload"
                  type="file"
                  accept="audio/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    setIsUploading(true);
                    setUploadingFileName(file.name);
                    
                    try {
                      ensureProjectExists();
                      const projectId = currentProject?.id || uuid();
                      
                      const fileName = `audio-${uuid()}.${file.name.split('.').pop()}`;
                      const audioUrl = await uploadAudioToStorage(file, projectId, fileName);
                      
                      // Save metadata to database using REST API (avoids hanging Supabase client calls)
                      const { getCachedToken, refreshToken } = await import('@/lib/utils/token-cache');
                      let token = await getCachedToken();
                      
                      if (token) {
                        try {
                          // Extract userId from token
                          const payload = JSON.parse(atob(token.split('.')[1]));
                          const userId = payload.sub || payload.user_id;
                          
                          if (userId) {
                            const supabaseUrl = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
                            const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
                            
                            if (supabaseUrl && supabaseAnonKey) {
                        const storagePath = `ugc-audio/${projectId}/${fileName}`;
                              const insertUrl = `${supabaseUrl}/rest/v1/user_uploads`;
                              
                              const makeRequest = async (authToken: string) => {
                                const controller = new AbortController();
                                const timeoutId = setTimeout(() => controller.abort(), 10000);
                                try {
                                  const response = await fetch(insertUrl, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${authToken}`,
                                      'apikey': supabaseAnonKey,
                                      'Prefer': 'return=minimal'
                                    },
                                    body: JSON.stringify({
                                      user_id: userId,
                          file_name: fileName,
                          file_type: 'audio',
                          storage_path: storagePath,
                          storage_url: audioUrl,
                          file_size: file.size,
                          mime_type: file.type,
                          metadata: {}
                                    }),
                                    signal: controller.signal
                                  });
                                  clearTimeout(timeoutId);
                                  return response;
                                } catch (err) {
                                  clearTimeout(timeoutId);
                                  throw err;
                                }
                              };
                              
                              let response = await makeRequest(token);
                              
                              // Handle 401 - refresh token and retry
                              if (response.status === 401) {
                                const refreshedToken = await refreshToken();
                                if (refreshedToken) {
                                  response = await makeRequest(refreshedToken);
                                }
                              }
                              
                              if (!response.ok) {
                                console.warn('[Audio Upload] Failed to save metadata:', response.status);
                              }
                            }
                          }
                        } catch (error) {
                          console.warn('[Audio Upload] Error saving metadata:', error);
                          // Continue even if metadata save fails
                        }
                      }
                      
                      // Calculate startTime: place after the last audio element, but ensure it fits within timeline
                      const existingAudioElements = canvasElements.filter(el => el.type === "audio");
                      let audioStartTime = 0;
                      if (existingAudioElements.length > 0) {
                        // Find the last audio element's end time
                        const lastAudio = existingAudioElements.reduce((latest, el) => {
                          const elEndTime = (el.startTime || 0) + (el.duration || 5000);
                          const latestEndTime = (latest.startTime || 0) + (latest.duration || 5000);
                          return elEndTime > latestEndTime ? el : latest;
                        });
                        const calculatedStartTime = (lastAudio.startTime || 0) + (lastAudio.duration || 5000);
                        // Ensure the audio fits within the timeline
                        // If it would exceed, place it at the start instead
                        audioStartTime = Math.max(0, Math.min(calculatedStartTime, duration - 5000)); // Leave room for at least 5s duration
                      }
                      
                      // Add to canvas as audio element
                      const audioElement: CanvasElement = {
                        id: uuid(),
                        type: "audio",
                        url: audioUrl,
                        x: 50,
                        y: 50,
                        width: 50,
                        height: 50,
                        startTime: audioStartTime,
                        duration: 5000, // Will be updated when audio loads
                        audioStartOffset: 0, // Initialize audio start offset for trimming
                        muted: false,
                        rotation: 0,
                        opacity: 1,
                        zIndex: canvasElements.length,
                      };
                      
                      setCanvasElements([...canvasElements, audioElement]);
                      await loadUploadedAudios();
                      setUploadingFileName(null);
                    } catch (error) {
                      console.error("Error uploading audio:", error);
                      alert(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setIsUploading(false);
                      setUploadingFileName(null);
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area - Canvas (CapCut Style) */}
        <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
          <div className="flex-1 flex items-center justify-center py-8 px-4 min-h-0 overflow-visible relative">
            {/* Canvas Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2 border border-gray-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasZoom(Math.max(25, canvasZoom - 10))}
                className="h-8 w-8 p-0"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="text-xs font-mono min-w-[50px] text-center">
                {canvasZoom}%
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasZoom(Math.min(200, canvasZoom + 10))}
                className="h-8 w-8 p-0"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCanvasZoom(90)}
                className="h-8 px-2 text-xs"
                title="Reset Zoom"
              >
                Reset
              </Button>
            </div>
            
            {/* Canvas Container with Zoom */}
            <div 
              className="flex items-center justify-center"
              style={{ 
                transform: `scale(${canvasZoom / 100})`, 
                transformOrigin: 'center',
                transition: 'transform 0.2s ease',
                overflow: 'visible'
              }}
            >
              {/* Canvas Container - TikTok Size (9:16 aspect ratio) */}
              <div 
                ref={canvasRef}
                className="relative bg-white rounded-lg shadow-lg"
                style={{
                  width: 'min(100vw, 400px)', // Max width for TikTok size
                  aspectRatio: '9 / 16', // TikTok aspect ratio
                  backgroundColor: '#ffffff',
                  overflow: 'hidden' // Clip elements that go outside canvas bounds
                }}
                onClick={handleCanvasClick}
                onMouseMove={(e) => {
                  handleCanvasMouseMove(e);
                  handleCanvasMouseMoveForSubtitle(e);
                }}
                onMouseUp={() => {
                  handleCanvasMouseUp();
                  handleCanvasMouseUpForSubtitle();
                }}
                onMouseLeave={() => {
                  handleCanvasMouseUp();
                  handleCanvasMouseUpForSubtitle();
                }}
                onDrop={handleCanvasDrop}
                onDragOver={handleCanvasDragOver}
              >
              {/* Canvas Elements - Exclude audio elements (they only appear in timeline) */}
              {canvasElements
                .filter(element => element.type !== "audio") // Filter out audio elements from canvas
                .map((element) => {
                const isSelected = selectedElementId === element.id;
                
                // Initialize transition opacity (default to 1 for non-videos or when no transition)
                let transitionOpacity: number | undefined = undefined;
                let shouldRender = true;
                
                // For video, image, and text elements, only show when timeline is within their time range
                if (element.type === "video" || element.type === "image" || element.type === "text") {
                  const elementStartTime = element.startTime || 0;
                  const elementDuration = element.duration || 5000;
                  const elementEndTime = elementStartTime + elementDuration;
                  
                  // Default render check
                  shouldRender = currentTime >= elementStartTime && currentTime < elementEndTime;
                  
                  if (element.type === "video") {
                    // Find videos on the same track (same x, y, width, height position = same canvas position)
                    // This means they're stacked on top of each other, which indicates same track
                    const sameTrackVideos = canvasElements.filter(el => 
                      el.type === "video" && 
                      el.id !== element.id &&
                      el.x === element.x &&
                      el.y === element.y &&
                      el.width === element.width &&
                      el.height === element.height
                    );
                    
                    // Find the next sequential video (starts right after this one ends)
                    const nextVideo = sameTrackVideos.find(el => {
                      const elStartTime = el.startTime || 0;
                      return Math.abs(elStartTime - elementEndTime) < 100; // Within 100ms (sequential)
                    });
                    
                    // Find the previous sequential video (ends right before this one starts)
                    const prevVideo = sameTrackVideos.find(el => {
                      const elStartTime = el.startTime || 0;
                      const elEndTime = elStartTime + (el.duration || 5000);
                      return Math.abs(elEndTime - elementStartTime) < 100; // Within 100ms (sequential)
                    });
                    
                    const transitionDuration = 300; // 300ms crossfade duration
                    
                    // Crossfade out when next video is starting (fade out in last 300ms)
                    if (nextVideo) {
                      const nextStartTime = nextVideo.startTime || 0;
                      const fadeOutStart = elementEndTime - transitionDuration;
                      if (currentTime >= fadeOutStart && currentTime < elementEndTime) {
                        // Fade out: opacity goes from 1 to 0
                        const fadeProgress = (currentTime - fadeOutStart) / transitionDuration;
                        transitionOpacity = Math.max(0, 1 - fadeProgress);
                        shouldRender = true; // Keep rendering during fade out
                      }
                    }
                    
                    // Crossfade in when previous video is ending (fade in first 300ms)
                    if (prevVideo) {
                      const prevEndTime = (prevVideo.startTime || 0) + (prevVideo.duration || 5000);
                      const fadeInEnd = elementStartTime + transitionDuration;
                      if (currentTime >= elementStartTime && currentTime < fadeInEnd) {
                        // Fade in: opacity goes from 0 to 1
                        const fadeProgress = (currentTime - elementStartTime) / transitionDuration;
                        transitionOpacity = Math.min(1, fadeProgress);
                        shouldRender = true; // Keep rendering during fade in
                      }
                    }
                    
                    // Also render slightly before/after for smooth transitions
                    const transitionMargin = transitionDuration;
                    if (nextVideo || prevVideo) {
                      shouldRender = currentTime >= (elementStartTime - transitionMargin) && 
                                    currentTime < (elementEndTime + transitionMargin);
                    }
                  }
                  
                  // Don't render element if timeline is outside its range (unless transitioning)
                  if (!shouldRender) {
                    return null;
                  }
                }
                
                // Calculate final opacity with transition
                const baseOpacity = element.opacity || 1;
                const finalOpacity = element.type === "video" && transitionOpacity !== undefined 
                  ? transitionOpacity * baseOpacity 
                  : baseOpacity;
                
                return (
                  <div
                    key={element.id}
                    className={cn(
                      "absolute cursor-move",
                      isSelected && "ring-2 ring-blue-500"
                    )}
                    style={{
                      left: `${element.x}%`,
                      top: `${element.y}%`,
                      width: `${element.width}%`,
                      height: `${element.height}%`,
                      transform: `rotate(${element.rotation}deg)`,
                      opacity: finalOpacity,
                      zIndex: element.zIndex,
                      overflow: "visible", // Allow buttons to show outside element bounds
                      transition: element.type === "video" ? "opacity 0.05s linear" : undefined, // Smooth opacity transition for videos
                    }}
                    onMouseDown={(e) => handleCanvasMouseDown(e, element.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedElementId(element.id);
                      setContextMenuElementId(element.id);
                    }}
                  >
                    {/* Element Content Container - Clips content but allows buttons to show */}
                    {/* When circleFrame: use a square (min dimension) centered wrapper so we get a true circle, not an oval */}
                    <div className={cn(
                      "w-full h-full overflow-hidden",
                      !element.circleFrame && "rounded"
                    )}>
                      {element.circleFrame ? (
                        <div className="w-full h-full flex items-center justify-center min-w-0 min-h-0">
                          {/* Square wrapper (flex + aspect-ratio so side = min(width, height)) then rounded-full = true circle */}
                          <div className="rounded-full overflow-hidden min-w-0 min-h-0" style={{ flex: '1 1 0', aspectRatio: '1', maxWidth: '100%', maxHeight: '100%' }}>
                            {element.type === "video" && element.url && (
                              <video
                                id={`canvas-video-${element.id}`}
                                src={element.url}
                                className="w-full h-full object-cover"
                                loop={false}
                                muted={(element.muted ?? false) || isMuted}
                                playsInline
                                ref={(videoEl) => {
                                  if (videoEl) {
                                    if ('preservesPitch' in videoEl) (videoEl as any).preservesPitch = true;
                                    try { videoEl.setAttribute('preservespitch', 'true'); } catch (_) {}
                                  }
                                }}
                                onTimeUpdate={(e) => {
                                  if (isPlaying) {
                                    const video = e.currentTarget;
                                    const elementStartTime = element.startTime || 0;
                                    const elementDuration = element.duration || 5000;
                                    const videoStartOffset = element.videoStartOffset || 0;
                                    const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                                    if (video.currentTime >= trimmedEndTime - 0.1) video.pause();
                                  }
                                }}
                                onLoadedMetadata={(e) => {
                                  const video = e.currentTarget;
                                  if (video.playbackRate !== playbackRate) setVideoPlaybackRate(video, playbackRate);
                                  if (duration === 0 && video.duration) setDuration(video.duration * 1000);
                                }}
                                onEnded={(e) => {
                                  const elementEndTime = (element.startTime || 0) + (element.duration || 5000);
                                  if (currentTime >= elementEndTime - 100) e.currentTarget.pause();
                                }}
                              />
                            )}
                            {element.type === "image" && element.url && (
                              <img
                                src={element.url}
                                alt=""
                                className="w-full h-full object-cover"
                                draggable={false}
                                style={{
                                  objectPosition: `${element.imageOffsetX || 50}% ${element.imageOffsetY || 50}%`,
                                  clipPath: element.cropX !== undefined && element.cropY !== undefined && element.cropWidth !== undefined && element.cropHeight !== undefined
                                    ? `inset(${element.cropY}% ${100 - (element.cropX + element.cropWidth)}% ${100 - (element.cropY + element.cropHeight)}% ${element.cropX}%)`
                                    : undefined
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                      <>
                      {element.type === "video" && element.url && (
                        <video
                          id={`canvas-video-${element.id}`}
                          src={element.url}
                          className="w-full h-full object-cover"
                          loop={false}
                          muted={(element.muted ?? false) || isMuted}
                          playsInline
                          ref={(videoEl) => {
                            // Set preservesPitch when video element is mounted to prevent audio distortion
                            if (videoEl) {
                              if ('preservesPitch' in videoEl) {
                                (videoEl as any).preservesPitch = true;
                              }
                              // Also set as attribute for maximum compatibility
                              try {
                                videoEl.setAttribute('preservespitch', 'true');
                              } catch (e) {
                                // Ignore if attribute setting fails
                              }
                            }
                          }}
                        onTimeUpdate={(e) => {
                          // Update timeline from video playback - account for element's startTime and videoStartOffset
                          if (isPlaying) {
                            const video = e.currentTarget;
                            const elementStartTime = element.startTime || 0;
                            const elementDuration = element.duration || 5000;
                            const videoStartOffset = element.videoStartOffset || 0;
                            
                            // Check if video has reached trimmed end
                            const trimmedEndTime = (videoStartOffset + elementDuration) / 1000;
                            const elementEndTime = elementStartTime + elementDuration;
                            
                            if (video.currentTime >= trimmedEndTime - 0.1) {
                              // Video reached its trimmed end - pause it
                              // Don't return early - let timeline continue advancing via animation frame
                              video.pause();
                              // Timeline will continue advancing via the animation frame loop
                              // which will trigger the next video to start when currentTime reaches its startTime
                            } else {
                              // Video is still playing - but let the animation frame loop drive the timeline
                              // The onTimeUpdate is mainly for detecting when video reaches trimmed end
                              // Don't sync timeline from video when playbackRate is active, as it can cause conflicts
                              // The animation frame loop already accounts for playbackRate
                            }
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          const video = e.currentTarget;
                          // Apply playback rate when video loads (with preservesPitch)
                          if (video.playbackRate !== playbackRate) {
                            setVideoPlaybackRate(video, playbackRate);
                          }
                          if (duration === 0 && video.duration) {
                            setDuration(video.duration * 1000);
                          }
                        }}
                        onEnded={(e) => {
                          // Check if video reached its trimmed end (not just natural end)
                          const elementStartTime = element.startTime || 0;
                          const elementDuration = element.duration || 5000;
                          const elementEndTime = elementStartTime + elementDuration;
                          
                          // Only reset if we've reached the trimmed end time
                          if (currentTime >= elementEndTime - 100) { // 100ms tolerance
                            // When video reaches its trimmed end, pause it
                            const video = e.currentTarget;
                            video.pause();
                            // Don't reset timeline, just pause this video
                            // Other videos might still be playing
                          }
                        }}
                      />
                    )}
                    {element.type === "image" && element.url && (
                      <>
                      <img
                        src={element.url}
                        alt=""
                        className={cn("w-full h-full object-cover", element.circleFrame ? "rounded-full" : "rounded")}
                        draggable={false}
                        style={{
                            objectPosition: `${element.imageOffsetX || 50}% ${element.imageOffsetY || 50}%`,
                            clipPath: element.cropX !== undefined && element.cropY !== undefined && element.cropWidth !== undefined && element.cropHeight !== undefined
                              ? `inset(${element.cropY}% ${100 - (element.cropX + element.cropWidth)}% ${100 - (element.cropY + element.cropHeight)}% ${element.cropX}%)`
                              : undefined
                          }}
                        />
                        {/* Crop selection overlay */}
                        {isCropping && cropArea && cropArea.width > 0 && cropArea.height > 0 && (
                          <div
                            className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none z-30"
                            style={{
                              left: `${cropArea.x}%`,
                              top: `${cropArea.y}%`,
                              width: `${cropArea.width}%`,
                              height: `${cropArea.height}%`
                            }}
                          >
                            {/* Crop handles */}
                            <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
                          </div>
                        )}
                      </>
                    )}
                    </>
                    )}
                    {element.type === "text" && (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{
                          fontSize: `${(element.fontSize || 24) * (element.width / 30)}px`,
                          color: element.fontColor || "#000000",
                          fontFamily: element.fontFamily || "Arial",
                          fontWeight: "bold",
                        }}
                      >
                        {element.text || "Double click to edit"}
                      </div>
                    )}
                    </div>
                    
                    {/* Right-click Context Menu */}
                    {isSelected && contextMenuElementId === element.id && (
                      <DropdownMenu open={true} onOpenChange={(open) => {
                        if (!open) setContextMenuElementId(null);
                      }}>
                        <DropdownMenuTrigger asChild>
                          <div className="absolute inset-0" style={{ pointerEvents: 'none' }} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {element.type === "video" && (
                            <DropdownMenuItem onClick={() => {
                              fillCanvas(element.id);
                              setContextMenuElementId(null);
                            }}>
                              Fill canvas
                            </DropdownMenuItem>
                          )}
                          {(element.type === "video" || element.type === "image") && (
                            <DropdownMenuItem onClick={() => {
                              updateCanvasElement(element.id, { circleFrame: !element.circleFrame });
                              setContextMenuElementId(null);
                            }}>
                              {element.circleFrame ? "Remove circle frame" : "Circle frame"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => {
                            bringToFront(element.id);
                            setContextMenuElementId(null);
                          }}>
                            Bring to Front
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            sendToBack(element.id);
                            setContextMenuElementId(null);
                          }}>
                            Send to Back
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    
                    {/* Resize Handles - All sides and corners */}
                    {isSelected && (
                      <>
                        {/* Action Buttons */}
                        <div className="absolute -top-10 right-0 flex items-center gap-2 z-20">
                          {/* Remove Background Button (only for videos) */}
                          {element.type === "video" && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                console.log('[Background Removal] Button clicked for element:', element.id, 'URL:', element.url);
                                handleRemoveBackground(element.id);
                              }}
                              disabled={removingBackground === element.id}
                              className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                              title="Remove Background"
                            >
                              {removingBackground === element.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <Wand2 className="w-3 h-3" />
                                  <span>Remove BG</span>
                                </>
                              )}
                            </button>
                          )}
                          
                          {/* Delete Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCanvasElement(element.id);
                            }}
                            className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 z-20"
                            title="Delete"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Corner Handles */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-10" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-10" />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nesw-resize z-10" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-nwse-resize z-10" />
                        
                        {/* Edge Handles */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize z-10" />
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ns-resize z-10" />
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize z-10" />
                        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 border-2 border-white rounded-full cursor-ew-resize z-10" />
                      </>
                    )}
                  </div>
                );
              })}
              
              {/* Hidden audio elements for playback (not visible/selectable on canvas) */}
              {canvasElements
                .filter(element => element.type === "audio" && element.url)
                .map((element) => (
                  <audio
                    key={`audio-${element.id}`}
                    id={`canvas-audio-${element.id}`}
                    src={element.url}
                    preload="metadata"
                    muted={element.muted || false}
                    style={{ display: 'none', position: 'absolute', pointerEvents: 'none' }}
                    onLoadedMetadata={(e) => {
                      const audio = e.currentTarget;
                      // Update element duration if not set or if it's still the default 5000ms
                      // This ensures we update from the default placeholder to the actual duration
                      if (audio.duration && audio.duration > 0) {
                        const actualDuration = audio.duration * 1000;
                        // Update if duration is not set, is 0, or is still the default 5000ms placeholder
                        if (!element.duration || element.duration === 0 || element.duration === 5000) {
                          updateCanvasElement(element.id, { duration: actualDuration });
                        }
                      }
                    }}
                  />
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
                    pointerEvents: "auto",
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
                        getSubtitleStyle(subtitleStyle).className
                          .replace(/text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)/g, '')
                          .replace(/font-(sans|serif|mono|black|bold|semibold|medium|normal|light|thin|extralight)/g, ''),
                        subtitleStyle === 'magic-loops' ? "text-center w-full" : "break-words text-center w-full"
                      )}
                      style={{
                        fontSize: `${subtitleFontSize / 100 * 24}px`,
                        wordWrap: subtitleStyle === 'magic-loops' ? 'normal' : 'break-word',
                        overflowWrap: subtitleStyle === 'magic-loops' ? 'normal' : 'break-word',
                        textAlign: 'center',
                        fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                   subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                   subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                   subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                   subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                   subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                   subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                   'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                        ...(subtitleStyle === "outlined"
                          ? OUTLINED_STYLE
                          : subtitleStyle === "elegant"
                          ? { WebkitTextStroke: '4px #000000', paintOrder: 'stroke fill', textShadow: '0px 2px 4px rgba(0,0,0,0.3)' }
                          : subtitleStyle === "karaoke-pink"
                          ? STYLE_KARAOKE_PINK
                          : subtitleStyle === "magic-loops"
                          ? { ...STYLE_MAGIC_LOOPS, display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, textTransform: 'uppercase' as const, whiteSpace: 'normal' as const }
                          : subtitleStyle === "bold-green"
                          ? { ...STYLE_BOLD_GREEN, textTransform: 'uppercase' as const }
                          : {})
                      }}
                    >
                      {(() => {
                        // For non-single-line mode, render text directly
                        if (!subtitleSingleLine) {
                          if (subtitleStyle === 'karaoke-pink') {
                            const words = activeSubtitle.text.split(' ').filter(Boolean);
                            const middleIndex = Math.floor(words.length / 2);
                            return words.map((word, idx) => (
                              <span
                                key={idx}
                                style={{
                                  color: '#FFFFFF',
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  marginRight: '2px',
                                  display: 'inline-block',
                                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease-out',
                                  ...(idx === middleIndex ? {
                                    backgroundColor: karaokePillColor,
                                    padding: '4px 4px',
                                    borderRadius: '6px',
                                    transform: 'scale(1.12)',
                                  } : {})
                                }}
                              >
                                {word}
                              </span>
                            ));
                          }
                          if (subtitleStyle === 'magic-loops') {
                            const words = activeSubtitle.text.split(' ').filter(Boolean);
                            const middleIndex = Math.floor(words.length / 2);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                {words.map((word, wordIndex) => {
                                  const isActive = wordIndex === middleIndex;
                                  return (
                                    <div 
                                      key={wordIndex}
                                      style={{ 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        alignItems: 'center',
                                        width: '100%', 
                                        marginBottom: '0px',
                                      }}
                                    >
                                      <span
                                        style={{
                                          color: isActive ? '#6CE846' : '#FFFFFF',
                                          WebkitTextStroke: '2.5px #000000',
                                          paintOrder: 'stroke fill',
                                          display: 'inline-block',
                                          whiteSpace: 'nowrap',
                                          flexShrink: 0,
                                          transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                          transform: isActive ? 'scale(1.3)' : 'scale(1)',
                                          transformOrigin: 'center center',
                                          verticalAlign: 'baseline',
                                        }}
                                      >
                                        {word}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          if (subtitleStyle === 'bold-green') {
                            const words = activeSubtitle.text.split(' ').filter(Boolean);
                            const middleIndex = Math.floor(words.length / 2);
                            return (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', gap: '10px', flexWrap: 'wrap' }}>
                                {words.map((word, idx) => {
                                  const isActive = idx === middleIndex;
                                  return (
                                    <span
                                      key={idx}
                                      style={{
                                        color: isActive ? boldGreenColor : '#FFFFFF',
                                        WebkitTextStroke: '2.5px #000000',
                                        paintOrder: 'stroke fill',
                                        display: 'inline-block',
                                        whiteSpace: 'nowrap',
                                        transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        textShadow: '2px 2px 0px #000000',
                                        fontWeight: '900',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.2px',
                                        lineHeight: '1.0',
                                        WebkitFontSmoothing: 'antialiased',
                                        MozOsxFontSmoothing: 'grayscale',
                                        fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                                   subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                                   subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                                   subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                                   subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                                   subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                                   subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                                   subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                                   'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                      }}
                                    >
                                      {word}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          }
                          return activeSubtitle.text;
                        }
                        
                        // Single-line mode: compute current word index based on time
                        const words = activeSubtitle.text.split(' ').filter(Boolean);
                        if (words.length === 0) return '';
                        
                        const segmentDuration = Math.max(activeSubtitle.endMs - activeSubtitle.startMs, 1);
                        const progress = Math.max(0, Math.min(1, (currentTime - activeSubtitle.startMs) / segmentDuration));
                        const currentWordIndex = Math.max(0, Math.min(words.length - 1, Math.floor(progress * words.length)));
                        
                        const isKaraokePinkStyle = subtitleStyle === 'karaoke-pink';
                        const isMagicLoopsStyle = subtitleStyle === 'magic-loops';
                        const isBoldGreenStyle = subtitleStyle === 'bold-green';
                        
                        if (subtitleSingleWord) {
                          const currentWord = words[currentWordIndex] ?? '';
                          return (
                            <span 
                              key={`word-${currentWordIndex}-${currentWord}`}
                              className="mx-1"
                              style={{
                                ...(isKaraokePinkStyle ? {
                                  color: '#FFFFFF',
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  backgroundColor: karaokePillColor,
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  marginRight: '2px',
                                  display: 'inline-block',
                                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease-out',
                                  transform: 'scale(1.12)',
                                } : {}),
                                ...(isMagicLoopsStyle ? {
                                  color: '#6CE846',
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  marginRight: '0px',
                                  display: 'inline-block',
                                  transition: 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                  transform: 'scale(1.3)',
                                  transformOrigin: 'center center',
                                  verticalAlign: 'baseline',
                                } : {}),
                                ...(isBoldGreenStyle ? {
                                  color: boldGreenColor,
                                  WebkitTextStroke: '2.5px #000000',
                                  paintOrder: 'stroke fill',
                                  display: 'inline-block',
                                  textShadow: '2px 2px 0px #000000',
                                  fontWeight: '900',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.2px',
                                  lineHeight: '1.0',
                                  WebkitFontSmoothing: 'antialiased',
                                  MozOsxFontSmoothing: 'grayscale',
                                  fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                             subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                             subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                             subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                             subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                             subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                             subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                             subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                             'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                } : {})
                              }}
                            >
                              {currentWord}
                            </span>
                          );
                        }
                        
                        // 3-word chunk
                        const chunkStart = Math.floor(currentWordIndex / 3) * 3;
                        const from = chunkStart;
                        const to = Math.min(words.length - 1, chunkStart + 2);
                        const chunkWords = words.slice(from, to + 1);
                        
                        if (isMagicLoopsStyle) {
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                              {chunkWords.map((word, i) => {
                                const idx = from + i;
                                const isActive = idx === currentWordIndex;
                                return (
                                  <div 
                                    key={idx}
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'center', 
                                      alignItems: 'center',
                                      width: '100%', 
                                      marginBottom: '0px',
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: isActive ? '#6CE846' : '#FFFFFF',
                                        WebkitTextStroke: '5px #000000',
                                        paintOrder: 'stroke fill',
                                        display: 'inline-block',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                        textShadow: `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 2px 4px rgba(0,0,0,0.40)`,
                                        fontWeight: '800',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.4px',
                                        lineHeight: '1.05',
                                        WebkitFontSmoothing: 'antialiased',
                                        MozOsxFontSmoothing: 'grayscale',
                                        transform: isActive ? 'scale(1.3)' : 'scale(1)',
                                        transformOrigin: 'center center',
                                        verticalAlign: 'baseline',
                                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                                   subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                                   subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                                   subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                                   subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                                   subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                                   subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                                   subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                                   'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                      }}
                                    >
                                      {word}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        return chunkWords.map((word, i) => {
                          const idx = from + i;
                          const isActive = idx === currentWordIndex;
                          return (
                            <span
                              key={`chunk-${idx}-${word}-${isActive}`}
                              className="px-1"
                              style={{
                                color: isKaraokePinkStyle ? '#FFFFFF' : isBoldGreenStyle ? (isActive ? boldGreenColor : '#FFFFFF') : undefined,
                                WebkitTextStroke: isKaraokePinkStyle ? '2.5px #000000' : isBoldGreenStyle ? '2.5px #000000' : undefined,
                                paintOrder: (isKaraokePinkStyle || isBoldGreenStyle) ? 'stroke fill' : undefined,
                                marginRight: (isKaraokePinkStyle || isBoldGreenStyle) ? (isBoldGreenStyle ? '10px' : '2px') : undefined,
                                display: (isKaraokePinkStyle || isBoldGreenStyle) ? 'inline-block' : undefined,
                                transition: isKaraokePinkStyle ? 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease-out' : isBoldGreenStyle ? 'color 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' : undefined,
                                ...(isKaraokePinkStyle && isActive ? {
                                  backgroundColor: karaokePillColor,
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  transform: 'scale(1.12)',
                                } : {}),
                                ...(isBoldGreenStyle ? {
                                  textShadow: '2px 2px 0px #000000',
                                  fontWeight: '900',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.2px',
                                  lineHeight: '1.0',
                                  WebkitFontSmoothing: 'antialiased',
                                  MozOsxFontSmoothing: 'grayscale',
                                  fontFamily: subtitleFontFamily === 'impact' ? 'var(--font-impact)' :
                                             subtitleFontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                             subtitleFontFamily === 'poppins' ? 'var(--font-poppins)' :
                                             subtitleFontFamily === 'futura' ? 'var(--font-futura)' :
                                             subtitleFontFamily === 'roboto' ? 'var(--font-roboto)' :
                                             subtitleFontFamily === 'inter' ? 'var(--font-inter)' :
                                             subtitleFontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                             subtitleFontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                                             'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                } : {})
                              }}
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

              {/* Empty State */}
              {canvasElements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Drag elements from the sidebar to add them to the canvas</p>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Properties (when element selected) or Subtitles Editor (when captions active) */}
        {(selectedElementId || (activeSidebarSection === "captions" && subtitleSegments && subtitleSegments.length > 0)) && (
          <div className="w-80 flex-shrink-0 border-l bg-white flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-sm">
                {activeSidebarSection === "captions" && subtitleSegments && subtitleSegments.length > 0 ? "Subtitles" : "Properties"}
              </h3>
            </div>
            <ScrollArea className="flex-1 p-4 min-h-0">
              <div className="h-full flex flex-col">
                {activeSidebarSection === "captions" && subtitleSegments && subtitleSegments.length > 0 ? (
                  <SubtitlesEditor
                    value={subtitleSrtText || ''}
                    onChange={handleSubtitleSrtChange}
                    onReset={handleRestoreSubtitles}
                    segments={subtitleSegments}
                  />
                ) : selectedElementId ? (() => {
                const element = canvasElements.find(el => el.id === selectedElementId);
                if (!element) return null;
                
                return (
                  <div className="space-y-4">
                    {/* Position */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Position</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">X</Label>
                          <Input
                            type="number"
                            value={element.x.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { x: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Y</Label>
                          <Input
                            type="number"
                            value={element.y.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { y: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Size */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Size</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Width</Label>
                          <Input
                            type="number"
                            value={element.width.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { width: parseFloat(e.target.value) || 10 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Height</Label>
                          <Input
                            type="number"
                            value={element.height.toFixed(1)}
                            onChange={(e) => updateCanvasElement(selectedElementId, { height: parseFloat(e.target.value) || 10 })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Rotation */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Rotation: {element.rotation}°</Label>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={element.rotation}
                        onChange={(e) => updateCanvasElement(selectedElementId, { rotation: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    
                    {/* Opacity */}
                    <div>
                      <Label className="text-xs text-gray-600 mb-2 block">Opacity: {Math.round(element.opacity * 100)}%</Label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={element.opacity}
                        onChange={(e) => updateCanvasElement(selectedElementId, { opacity: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                    
                    {/* Circle frame (video / image only) */}
                    {(element.type === "video" || element.type === "image") && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="circle-frame"
                          checked={!!element.circleFrame}
                          onChange={(e) => updateCanvasElement(selectedElementId, { circleFrame: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="circle-frame" className="text-xs text-gray-600 cursor-pointer">Circle frame</Label>
                      </div>
                    )}
                    
                    {/* Text Properties (if text element) */}
                    {element.type === "text" && (
                      <>
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Text</Label>
                          <Input
                            value={element.text || ""}
                            onChange={(e) => updateCanvasElement(selectedElementId, { text: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Font Size</Label>
                          <Input
                            type="number"
                            value={element.fontSize || 24}
                            onChange={(e) => updateCanvasElement(selectedElementId, { fontSize: parseInt(e.target.value) || 24 })}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600 mb-2 block">Color</Label>
                          <Input
                            type="color"
                            value={element.fontColor || "#000000"}
                            onChange={(e) => updateCanvasElement(selectedElementId, { fontColor: e.target.value })}
                            className="h-8"
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })() : null}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Bottom Timeline Panel - CapCut Style - Expandable */}
      <div 
        className="flex-shrink-0 border-t border-gray-200 bg-white flex flex-col relative"
        style={{ height: `${timelineHeight}px`, minHeight: '160px', maxHeight: '80vh' }}
      >
        {/* Resize Handle - Drag to resize timeline */}
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-gray-300 hover:bg-blue-500 cursor-ns-resize z-50 transition-colors"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsResizingTimeline(true);
            setResizeStart({ 
              x: 0, 
              y: e.clientY, 
              width: 0, 
              height: timelineHeight,
              imageOffsetX: 50,
              imageOffsetY: 50
            });
          }}
          title="Drag to resize timeline"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
            <GripVertical className="h-3 w-3 text-gray-500" />
            <GripVertical className="h-3 w-3 text-gray-500" />
          </div>
        </div>
        
        {/* Top Controls Bar - CapCut Style */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-gray-200 bg-white">
          {/* Left: Play Button + Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayback}
              className="w-8 h-8 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 text-white" />
              ) : (
                <Play className="h-4 w-4 text-white ml-0.5" />
              )}
            </button>
            <div className="text-xs font-mono text-gray-900 font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          {/* Right: Tool Icons */}
          <div className="flex items-center gap-2">
            {/* Save Button */}
            {currentProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[Save] Save button clicked (top bar)');
                  try {
                    await handleSaveProject();
                  } catch (error) {
                    console.error('[Save] Error in onClick handler (top bar):', error);
                    // Error already handled in handleSaveProject
                  }
                }}
                className="h-7 px-3 text-xs border-gray-300 bg-white hover:bg-gray-50"
                title="Save Project"
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>
            )}
            {/* Playback Speed Control */}
            <Select value={playbackRate.toString()} onValueChange={(value) => setPlaybackRate(parseFloat(value))}>
              <SelectTrigger className="h-7 w-16 text-xs border-gray-300 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="0.75">0.75x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="1.25">1.25x</SelectItem>
                <SelectItem value="1.5">1.5x</SelectItem>
                <SelectItem value="1.7">1.7x</SelectItem>
                <SelectItem value="1.75">1.75x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="2.5">2.5x</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={toggleMute}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-gray-600" />
              ) : (
                <Volume2 className="h-4 w-4 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Timeline Area - CapCut Style */}
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {/* Time Ruler */}
          <div className="h-6 border-b border-gray-200 bg-white relative overflow-hidden">
            {/* Track Controls Spacer - matches track controls width (w-20 = 80px) */}
            <div className="absolute left-0 top-0 bottom-0 w-20 border-r border-gray-200 bg-gray-50"></div>
            <div 
              className="flex items-center h-full pl-20 pr-4 min-w-full relative cursor-pointer" 
              style={{ width: '100%' }}
              onClick={(e) => {
                // Don't scrub if clicking on the playhead
                const target = e.target as HTMLElement;
                if (target.closest('.cursor-ew-resize')) {
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left - 80; // Account for pl-20 (80px) padding
                const contentWidth = rect.width - 80 - 16; // Subtract track controls and padding
                const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
                const newTime = (percentage / 100) * (duration || 1000);
                handleTimelineScrub(newTime);
                console.log('🖱️ Time ruler clicked:', { clickX, contentWidth, percentage, newTime });
              }}
            >
              {(() => {
                // Calculate time mark interval based on timeline scale
                // More marks for detailed view (short videos), fewer for compressed view (long videos)
                let intervalSeconds = 30; // Default 30 seconds
                if (timelineScale >= 50) {
                  intervalSeconds = 10; // 10 second marks for detailed view
                } else if (timelineScale >= 20) {
                  intervalSeconds = 30; // 30 second marks for medium view
                } else {
                  intervalSeconds = 60; // 60 second (1 minute) marks for compressed view
                }
                
                const durationSeconds = (duration || 60000) / 1000;
                const numMarks = Math.ceil(durationSeconds / intervalSeconds) + 1;
                
                return Array.from({ length: numMarks }, (_, i) => {
                  const time = i * intervalSeconds;
                  const minutes = Math.floor(time / 60);
                  const seconds = time % 60;
                  const timeMs = time * 1000;
                  // Position starts at 80px (after track controls), then add percentage of content width
                  // Content width = 100% - 80px (left padding) - 16px (right padding)
                  const leftPercent = duration > 0 ? (timeMs / duration) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="absolute flex flex-col items-center"
                      style={{ 
                        left: `calc(80px + ${leftPercent}% * (100% - 96px) / 100%)`,
                        transform: 'translateX(-50%)' // Center the time mark on the exact time position
                      }}
                    >
                      <div className="text-[10px] text-gray-500 font-mono mb-0.5 whitespace-nowrap">
                        {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
                      </div>
                      <div className="w-px h-3 bg-gray-300"></div>
                    </div>
                  );
                });
              })()}
              
              {/* Playhead - Red Line with Circle - Only in Time Ruler - Draggable */}
              <div
                className="absolute top-0 bottom-0 z-40"
                style={{ 
                  // Position starts at 80px (after track controls), then add percentage of content width
                  left: duration > 0 
                    ? `calc(80px + ${(currentTime / duration) * 100}% * (100% - 96px) / 100%)` 
                    : '80px',
                  transform: 'translateX(-50%)' // Center the playhead on the exact time position
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsDraggingPlayhead(true);
                  console.log('🖱️ Playhead drag started');
                }}
              >
              
              {/* Blue Overlap Indicator - Shows when trimming approaches another element */}
              {trimOverlapIndicator && isTrimming && (
                <div
                  className="absolute top-0 bottom-0 z-35 pointer-events-none"
                  style={{ 
                    // Position starts at 80px (after track controls), then add percentage of content width
                    left: duration > 0 
                      ? `calc(80px + ${(trimOverlapIndicator.time / duration) * 100}% * (100% - 96px) / 100%)` 
                      : '80px',
                    transform: 'translateX(-50%)', // Center the line on the exact time position
                    width: '2px',
                    backgroundColor: '#3b82f6', // Blue color
                    boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)' // Subtle glow
                  }}
                />
              )}
                <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-red-500 pointer-events-none"></div>
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform cursor-ew-resize"></div>
              </div>
            </div>
          </div>

          {/* Tracks Container */}
          <div 
            ref={timelineContainerRef}
            className="flex-1 overflow-y-auto overflow-x-hidden relative bg-white"
          >
            {/* Blue Overlap Indicator - Shows when trimming approaches another element (spans all tracks) */}
            {trimOverlapIndicator && isTrimming && (
              <div
                className="absolute top-0 bottom-0 z-35 pointer-events-none"
                style={{ 
                  // Position starts at 80px (after track controls), then add percentage of content width
                  left: duration > 0 
                    ? `calc(80px + ${(trimOverlapIndicator.time / duration) * 100}% * (100% - 96px) / 100%)` 
                    : '80px',
                  transform: 'translateX(-50%)', // Center the line on the exact time position
                  width: '2px',
                  backgroundColor: '#3b82f6', // Blue color
                  boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)' // Subtle glow
                }}
              />
            )}
            
            {(() => {
              // Calculate total height needed for all tracks
              const mediaElements = canvasElements.filter(el => el.type === "video" || el.type === "image").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
              const mediaTracks: Array<Array<typeof mediaElements[0]>> = [];
              mediaElements.forEach((element) => {
                let placed = false;
                for (const track of mediaTracks) {
                  const canPlace = track.every(existing => {
                    const existingStart = existing.startTime || 0;
                    const existingEnd = existingStart + (existing.duration || 5000);
                    const elementStart = element.startTime || 0;
                    const elementEnd = elementStart + (element.duration || 5000);
                    return elementEnd <= existingStart || elementStart >= existingEnd;
                  });
                  if (canPlace) {
                    track.push(element);
                    placed = true;
                    break;
                  }
                }
                if (!placed) {
                  mediaTracks.push([element]);
                }
              });
              
              const audioElements = canvasElements.filter(el => el.type === "audio");
              const hasAudio = audioElements.length > 0;
              const totalTracks = mediaTracks.length + (hasAudio ? 1 : 0);
              const minHeight = Math.max(200, totalTracks * 56); // 56px per track, minimum 200px
              
              return (
                <div className="relative pl-20 pr-4" style={{ width: '100%', minHeight: `${minHeight}px` }}>
              {/* Clickable Background for Scrubbing - Exclude track controls area (first 80px) */}
              {/* Only handle clicks when not clicking on video/image items or trim handles */}
              <div
                className="absolute left-20 right-0 top-0 bottom-0 cursor-pointer z-10"
                onClick={(e) => {
                  // Don't scrub if clicking on a video/image item or trim handle
                  const target = e.target as HTMLElement;
                  if (target.closest('.group') || target.closest('[class*="z-20"]') || target.closest('.trim-handle')) {
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  // left-20 means 80px offset, so clickX is already relative to the content area
                  const clickX = e.clientX - rect.left;
                  const contentWidth = rect.width; // This is already the content width (left-20 excludes the 80px)
                  const percentage = Math.max(0, Math.min(100, (clickX / contentWidth) * 100));
                  const newTime = (percentage / 100) * (duration || 1000);
                  console.log('🖱️ Timeline tracks clicked:', { clickX, contentWidth, percentage, newTime });
                  handleTimelineScrub(newTime);
                }}
                onMouseMove={(e) => {
                  // Only scrub on drag if not dragging a timeline item, trimming, or playhead
                  if (e.buttons === 1 && !isDraggingTimeline && !isTrimming && !isDraggingPlayhead) {
                    const target = e.target as HTMLElement;
                    if (target.closest('.group') || target.closest('[class*="z-20"]') || target.closest('.trim-handle')) {
                      return;
                    }
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                    const newTime = (percentage / 100) * (duration || 1000);
                    handleTimelineScrub(newTime);
                  }
                }}
              />

              {/* Media Tracks - Group sequential videos and images on the same track */}
              {(() => {
                // Group videos and images into tracks - elements that are sequential (one starts right after another) go on the same track
                const mediaElements = canvasElements.filter(el => el.type === "video" || el.type === "image").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                const tracks: Array<Array<typeof mediaElements[0]>> = [];
                
                mediaElements.forEach((element) => {
                  // Find a track where this element can fit (doesn't overlap with existing elements)
                  let placed = false;
                  for (const track of tracks) {
                    // Check if this element can be placed on this track (no overlap)
                    const canPlace = track.every(existing => {
                      const existingStart = existing.startTime || 0;
                      const existingEnd = existingStart + (existing.duration || 5000);
                      const elementStart = element.startTime || 0;
                      const elementEnd = elementStart + (element.duration || 5000);
                      // No overlap: element ends before existing starts, or element starts after existing ends
                      return elementEnd <= existingStart || elementStart >= existingEnd;
                    });
                    
                    if (canPlace) {
                      track.push(element);
                      placed = true;
                      break;
                    }
                  }
                  
                  // If couldn't place on existing track, create new track
                  if (!placed) {
                    tracks.push([element]);
                  }
                });
                
                return tracks.map((track, trackIdx) => (
                  <div 
                    key={`track-${trackIdx}`}
                    className="absolute left-0 right-0 h-14 border-b border-gray-200 bg-white"
                    style={{ top: `${trackIdx * 56}px` }} // 56px = 14 * 4 (h-14 = 3.5rem = 56px)
                  >
                    <div className="h-full flex items-center">
                      {/* Track Controls (Left Side) */}
                      <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center gap-1">
                        <div className="text-xs text-gray-600 font-medium">
                          Track {trackIdx + 1}
                        </div>
                        {/* Mute button for first video in track (only show for videos, not images) */}
                        {track.length > 0 && track[0].type === "video" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              toggleVideoMute(track[0].id);
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors z-20 relative"
                            title={track[0].muted ? "Unmute" : "Mute"}
                          >
                            {track[0].muted ? (
                              <VolumeX className="h-3 w-3 text-gray-600" />
                            ) : (
                              <Volume2 className="h-3 w-3 text-gray-600" />
                            )}
                          </button>
                        )}
                      </div>
                      
                      {/* Track Content */}
                      <div className="flex-1 h-full relative overflow-visible timeline-tracks-container">
                        {track.map((element) => {
                          // Use timeline properties (startTime, duration) instead of canvas position
                          const elementStartTime = element.startTime || 0;
                          const elementDuration = element.duration || (duration || 5000);
                          const trackLeft = duration > 0 ? (elementStartTime / duration) * 100 : 0;
                          const trackWidth = duration > 0 ? (elementDuration / duration) * 100 : 10;
                          
                          // Thumbnail width is calculated dynamically based on timeline scale
                          // This ensures thumbnails match the timeline calibration
                          
                          // Determine border color and label based on element type
                          const isImage = element.type === "image";
                          // Check if this is a B-roll clip (muted video overlay with videoStartOffset)
                          const isBRollClip = element.type === "video" && 
                            element.muted === true && 
                            element.videoStartOffset !== undefined &&
                            element.x === 0 && 
                            element.y === 0 && 
                            element.width === 100 && 
                            element.height === 100;
                          const borderColor = isImage 
                            ? "border-purple-300 hover:border-purple-500" 
                            : isBRollClip 
                            ? "border-green-300 hover:border-green-500" 
                            : "border-blue-300 hover:border-blue-500";
                          const trimHandleColor = isImage 
                            ? "bg-purple-500 hover:bg-purple-600" 
                            : isBRollClip 
                            ? "bg-green-500 hover:bg-green-600" 
                            : "bg-blue-500 hover:bg-blue-600";
                          
                          return (
                            <div
                              key={element.id}
                              className={cn(
                                "group absolute top-2 bottom-2 overflow-visible cursor-move hover:opacity-90 transition-opacity border-2 bg-gray-100 z-20",
                                element.circleFrame ? "rounded-full" : "rounded",
                                borderColor
                              )}
                              style={{ 
                                left: `${trackLeft}%`,
                                width: `${trackWidth}%`,
                                minWidth: '50px'
                              }}
                              onMouseDown={(e) => {
                                // Don't start dragging if clicking on trim handles or mute button
                                const target = e.target as HTMLElement;
                                if (target.closest('.trim-handle') || target.closest('button')) {
                                  return;
                                }
                                e.stopPropagation();
                                e.preventDefault();
                                // Select the element first
                                setSelectedElementId(element.id);
                                // Start dragging
                                setIsDraggingTimeline(true);
                                setDraggingTimelineElementId(element.id);
                                setDragTimelineStart({
                                  x: e.clientX,
                                  startTime: elementStartTime
                                });
                              }}
                              title={`${isImage ? 'Image' : isBRollClip ? 'B-roll' : 'Video'} - Drag to move on timeline`}
                            >
                              {/* Render video or image content */}
                              <div className={cn("h-full flex items-center overflow-hidden relative pointer-events-none", element.circleFrame ? "rounded-full" : "rounded")} style={{ width: '100%' }}>
                                {isImage ? (
                                  // Image element
                                  element.url ? (
                                    <img
                                      src={element.url}
                                      alt={`Image`}
                                      className={cn("h-full w-full object-cover", element.circleFrame && "rounded-full")}
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-purple-500 text-[8px] text-white rounded">
                                      Image
                                    </div>
                                  )
                                ) : (
                                  // Video element
                                  <>
                                    {element.thumbnail ? (
                                      // Use repeating background pattern for CapCut-like effect
                                      <div 
                                        className={cn("h-full w-full pointer-events-none", element.circleFrame && "rounded-full")}
                                        style={{ 
                                          backgroundImage: `url(${element.thumbnail})`,
                                          backgroundSize: `${thumbnailWidth}px 100%`,
                                          backgroundRepeat: 'repeat-x',
                                          backgroundPosition: 'left center',
                                          imageRendering: 'auto'
                                        }}
                                      />
                                    ) : element.url ? (
                                      // If no thumbnail yet, try to generate it
                                      <VideoThumbnailGenerator 
                                        videoUrl={element.url} 
                                        elementId={element.id}
                                        onThumbnailGenerated={(thumbnail) => {
                                          updateCanvasElement(element.id, { thumbnail });
                                        }}
                                      />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center bg-orange-500 text-[8px] text-white rounded pointer-events-none">
                                        Video
                                      </div>
                                    )}
                                  </>
                                )}
                                {/* Label overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[8px] px-1 py-0.5 truncate pointer-events-none">
                                  {isImage ? 'Image' : 'Video'}
                                </div>
                              </div>
                              
                              {/* Split at playhead - only when this clip is selected and playhead is inside */}
                              {selectedElementId === element.id && (() => {
                                const elStart = elementStartTime;
                                const elEnd = elementStartTime + elementDuration;
                                const canSplit = currentTime > elStart && currentTime < elEnd;
                                return (
                                  <button
                                    type="button"
                                    className={cn(
                                      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all pointer-events-auto",
                                      canSplit
                                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                                        : "bg-gray-400 cursor-not-allowed text-white/80"
                                    )}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (canSplit) splitElementAtPlayhead(element.id);
                                    }}
                                    disabled={!canSplit}
                                    title={canSplit ? "Split at playhead" : "Move playhead inside this clip to split"}
                                  >
                                    <Scissors className="h-3.5 w-3.5" />
                                  </button>
                                );
                              })()}
                              
                              {/* Left Trim Handle - Always visible, more prominent when selected */}
                              <div
                                className={`trim-handle absolute left-0 top-0 bottom-0 cursor-ew-resize ${trimHandleColor} transition-all shadow-lg group/trim`}
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const initialX = e.clientX;
                                  console.log('🖱️ TRIM CLICK - Left handle:', {
                                    elementId: element.id,
                                    initialX,
                                    elementStartTime: element.startTime,
                                    elementDuration: element.duration,
                                    elementVideoStartOffset: element.videoStartOffset
                                  });
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('left');
                                  setTrimStart({ x: initialX });
                                  // Store initial element state to prevent accumulation during trim
                                  trimStartRef.current = { 
                                    x: initialX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: element.audioStartOffset || 0
                                  };
                                  console.log('✅ TRIM CLICK - Left handle state set:', {
                                    isTrimming: true,
                                    trimElementId: element.id,
                                    trimEdge: 'left',
                                    trimStartRef: trimStartRef.current
                                  });
                                }}
                                title={`Trim start - ${(element.videoStartOffset || 0) / 1000}s trimmed from start`}
                              >
                                {/* Tooltip showing trimmed seconds */}
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                  Start: {(element.videoStartOffset || 0) / 1000}s
                                </div>
                              </div>
                              
                              {/* Right Trim Handle - Always visible, more prominent when selected */}
                              <div
                                className={`trim-handle absolute right-0 top-0 bottom-0 cursor-ew-resize ${trimHandleColor} transition-all shadow-lg group/trim-right`}
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const initialX = e.clientX;
                                  console.log('🖱️ TRIM CLICK - Right handle:', {
                                    elementId: element.id,
                                    initialX,
                                    elementStartTime: element.startTime,
                                    elementDuration: element.duration,
                                    elementVideoStartOffset: element.videoStartOffset
                                  });
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('right');
                                  setTrimStart({ x: initialX });
                                  // Store initial element state to prevent accumulation during trim
                                  trimStartRef.current = { 
                                    x: initialX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: element.audioStartOffset || 0
                                  };
                                  console.log('✅ TRIM CLICK - Right handle state set:', {
                                    isTrimming: true,
                                    trimElementId: element.id,
                                    trimEdge: 'right',
                                    trimStartRef: trimStartRef.current
                                  });
                                }}
                                title={`Trim end - Drag to cut end`}
                              >
                                {/* Tooltip showing clip duration */}
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim-right:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                  Duration: {((element.duration || 0) / 1000).toFixed(2)}s
                                </div>
                              </div>
                              
                              {/* Add Button - Appears after the element */}
                              <button
                                className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-1 w-6 h-6 rounded-full ${isImage ? 'bg-purple-500 hover:bg-purple-600' : 'bg-blue-500 hover:bg-blue-600'} text-white flex items-center justify-center shadow-lg hover:scale-110 transition-all z-30`}
                                style={{
                                  pointerEvents: 'auto'
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setInsertAfterElementId(element.id);
                                  setMediaDialogOpen(true);
                                  // Load all media in parallel with timeout protection
                                  Promise.allSettled([
                                    loadGeneratedVideos(),
                                    loadUploadedImages(),
                                    loadUploadedVideos()
                                  ]).then((results) => {
                                    const errors = results.filter(r => r.status === 'rejected');
                                    if (errors.length > 0) {
                                      console.warn("Some media failed to load:", errors);
                                    }
                                  });
                                }}
                                title="Add video or image after this"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ));
              })()}
              
              {/* Audio Track - Single track for all audio elements */}
              {(() => {
                const audioElements = canvasElements.filter(el => el.type === "audio").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                if (audioElements.length === 0) return null;
                
                // Calculate the top position for audio track (after all media tracks)
                const mediaTracksCount = (() => {
                  const mediaElements = canvasElements.filter(el => el.type === "video" || el.type === "image").sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
                  const tracks: Array<Array<typeof mediaElements[0]>> = [];
                  mediaElements.forEach((element) => {
                    let placed = false;
                    for (const track of tracks) {
                      const canPlace = track.every(existing => {
                        const existingStart = existing.startTime || 0;
                        const existingEnd = existingStart + (existing.duration || 5000);
                        const elementStart = element.startTime || 0;
                        const elementEnd = elementStart + (element.duration || 5000);
                        return elementEnd <= existingStart || elementStart >= existingEnd;
                      });
                      if (canPlace) {
                        track.push(element);
                        placed = true;
                        break;
                      }
                    }
                    if (!placed) {
                      tracks.push([element]);
                    }
                  });
                  return tracks.length;
                })();
                
                const audioTrackTop = mediaTracksCount * 56; // 56px per track
                
                return (
                  <div 
                    key="audio-track"
                    className="absolute left-0 right-0 h-14 border-b border-gray-200 bg-white"
                    style={{ top: `${audioTrackTop}px` }}
                  >
                    <div className="h-full flex items-center">
                      {/* Track Controls (Left Side) */}
                      <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center gap-1">
                        <div className="text-xs text-gray-600 font-medium">
                          Audio
                        </div>
                        {/* Mute button for first audio in track */}
                        {audioElements.length > 0 && (
                        <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              const firstAudio = audioElements[0];
                              updateCanvasElement(firstAudio.id, { muted: !firstAudio.muted });
                            }}
                            className="p-1 rounded hover:bg-gray-200 transition-colors z-20 relative"
                            title={audioElements[0].muted ? "Unmute" : "Mute"}
                          >
                            {audioElements[0].muted ? (
                              <VolumeX className="h-3 w-3 text-gray-600" />
                            ) : (
                              <Volume2 className="h-3 w-3 text-gray-600" />
                          )}
                        </button>
                        )}
                      </div>
                      
                      {/* Track Content */}
                      <div className="flex-1 h-full relative overflow-visible timeline-tracks-container">
                        {audioElements.map((element) => {
                          const elementStartTime = element.startTime || 0;
                          const elementDuration = element.duration || (duration || 5000);
                          // Calculate position - clamp to prevent negative positioning
                          const trackLeft = duration > 0 ? Math.max(0, (elementStartTime / duration) * 100) : 0;
                          const trackWidth = duration > 0 ? (elementDuration / duration) * 100 : 10;
                          
                          return (
                            <div
                              key={element.id}
                              className="group absolute top-2 bottom-2 rounded overflow-visible cursor-move hover:opacity-90 transition-opacity border-2 border-green-300 hover:border-green-500 bg-gray-100 z-20"
                              style={{ 
                                left: `${trackLeft}%`,
                                width: `${trackWidth}%`,
                                minWidth: '50px'
                              }}
                              onMouseDown={(e) => {
                                const target = e.target as HTMLElement;
                                if (target.closest('.trim-handle') || target.closest('button')) {
                                  return;
                                }
                                e.stopPropagation();
                                e.preventDefault();
                                setSelectedElementId(element.id);
                                setIsDraggingTimeline(true);
                                setDraggingTimelineElementId(element.id);
                                setDragTimelineStart({
                                  x: e.clientX,
                                  startTime: elementStartTime
                                });
                              }}
                              title="Audio - Drag to move on timeline"
                            >
                              {/* Render audio content with waveform */}
                              <div className="h-full flex items-center overflow-hidden rounded relative pointer-events-none" style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                                {/* Waveform visualization */}
                                <AudioWaveform 
                                  audioUrl={element.url} 
                                  audioStartOffset={element.audioStartOffset || 0}
                                  duration={elementDuration}
                                  width="100%"
                                  height="100%"
                                />
                                {/* Label overlay */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[8px] px-1 py-0.5 truncate pointer-events-none z-10">
                                  Audio
                              </div>
                              </div>
                              
                              {/* Left Trim Handle */}
                              <div
                                className="trim-handle absolute left-0 top-0 bottom-0 cursor-ew-resize bg-green-500 hover:bg-green-600 transition-all shadow-lg group/trim-audio-left"
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  console.log('🖱️ LEFT TRIM CLICK - Audio element:', {
                                    elementId: element.id,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    audioStartOffset: element.audioStartOffset,
                                    audioStartOffsetDefaulted: element.audioStartOffset || 0
                                  });
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('left');
                                  setTrimStart({ x: e.clientX });
                                  // Ensure audioStartOffset is always set (default to 0 if undefined)
                                  const currentAudioStartOffset = element.audioStartOffset ?? 0;
                                  trimStartRef.current = { 
                                    x: e.clientX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: currentAudioStartOffset
                                  };
                                  console.log('✅ LEFT TRIM - Ref set:', trimStartRef.current);
                                }}
                                title={`Trim start - Audio: ${((element.audioStartOffset || 0) / 1000).toFixed(2)}s`}
                              >
                                {/* Tooltip showing audio start/end seconds */}
                                {(() => {
                                  const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
                                  const audioStartSeconds = (element.audioStartOffset || 0) / 1000;
                                  const audioEndSeconds = audio && element.duration ? ((element.audioStartOffset || 0) + element.duration) / 1000 : null;
                                  return (
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim-audio-left:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                      Start: {audioStartSeconds.toFixed(2)}s
                                      {audioEndSeconds !== null ? (
                                        <> | End: {audioEndSeconds.toFixed(2)}s</>
                                      ) : null}
                            </div>
                          );
                                })()}
                          </div>
                              
                              {/* Right Trim Handle */}
                              <div
                                className="trim-handle absolute right-0 top-0 bottom-0 cursor-ew-resize bg-green-500 hover:bg-green-600 transition-all shadow-lg group/trim-audio-right"
                                style={{
                                  width: '8px',
                                  opacity: selectedElementId === element.id ? 1 : 0.5,
                                  zIndex: 100,
                                  pointerEvents: 'auto'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setIsTrimming(true);
                                  setTrimElementId(element.id);
                                  setTrimEdge('right');
                                  setTrimStart({ x: e.clientX });
                                  trimStartRef.current = { 
                                    x: e.clientX,
                                    startTime: elementStartTime,
                                    duration: elementDuration,
                                    videoStartOffset: element.videoStartOffset || 0,
                                    audioStartOffset: element.audioStartOffset || 0
                                  };
                                }}
                                title={`Trim end - Audio: ${(((element.audioStartOffset || 0) + (element.duration || 0)) / 1000).toFixed(2)}s`}
                              >
                                {/* Tooltip showing audio start/end seconds */}
                                {(() => {
                                  const audio = document.querySelector(`#canvas-audio-${element.id}`) as HTMLAudioElement;
                                  const audioStartSeconds = (element.audioStartOffset || 0) / 1000;
                                  const audioEndSeconds = audio && element.duration ? ((element.audioStartOffset || 0) + element.duration) / 1000 : null;
                                  return (
                                    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/trim-audio-right:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                      Start: {audioStartSeconds.toFixed(2)}s
                                      {audioEndSeconds !== null ? (
                                        <> | End: {audioEndSeconds.toFixed(2)}s</>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              {canvasElements.filter(el => el.type === "video" || el.type === "image").length === 0 && (
                <div className="absolute top-0 left-0 right-0 h-14 border-b border-gray-200 bg-white">
                  <div className="h-full flex items-center">
                    <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center">
                      <div className="text-xs text-gray-600 font-medium">
                        Track (0)
            </div>
          </div>
                    <div className="flex-1 h-full relative overflow-hidden flex items-center justify-center text-xs text-gray-400">
                      No media tracks
                    </div>
                  </div>
                </div>
              )}

                </div>
              );
            })()}
          </div>
        </div>
      </div>
      
      {/* Hidden main video player for timeline sync - muted when canvas videos exist to prevent echo */}
      {lipSyncVideoUrl && (
        <video
          ref={mainVideoPlayerRef}
          src={lipSyncVideoUrl}
          className="hidden"
          onTimeUpdate={(e) => {
            // Only sync if there are no canvas videos (canvas videos drive timeline via animation frame)
            // When canvas videos exist, let the animation frame loop drive the timeline
            if (canvasElements.filter(el => el.type === "video" && el.url).length === 0) {
            const video = e.currentTarget;
            setCurrentTime(video.currentTime * 1000);
            }
          }}
          onLoadedMetadata={(e) => {
            const mainVideo = e.currentTarget;
            // Apply playback rate when video loads (with preservesPitch)
            if (mainVideo.playbackRate !== playbackRate) {
              setVideoPlaybackRate(mainVideo, playbackRate);
            }
            setDuration(mainVideo.duration * 1000);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            // Reset timeline to beginning
            setCurrentTime(0);
            // Reset all canvas videos to beginning
            canvasElements.forEach(element => {
              if (element.type === "video" && element.url) {
                const video = document.querySelector(`#canvas-video-${element.id}`) as HTMLVideoElement;
                if (video) {
                  video.currentTime = 0;
                }
              }
            });
            // Reset main video player
            if (mainVideoPlayerRef.current) {
              mainVideoPlayerRef.current.currentTime = 0;
            }
          }}
          muted={isMuted || canvasElements.some(el => el.type === "video" && el.url)}
        />
      )}

      {/* Avatar Selection Dialog */}
      <Dialog
        open={avatarsDialogOpen}
        onOpenChange={(open) => {
          if (open) setAvatarNextError(null);
          setAvatarsDialogOpen(open);
        }}
      >
        <DialogContent className="!w-[80vw] !h-[80vh] !max-w-[80vw] !max-h-[80vh] !sm:max-w-[80vw] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Select AI Avatar</DialogTitle>
            <DialogDescription>
              Choose an avatar to use in your video, or create your own
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground">
              Create a custom avatar with the wizard (selfie or studio style, generate, animate, then save).
            </p>
            <Button
              variant="default"
              onClick={() => {
                setAvatarsDialogOpen(false);
                router.push("/app/create/avatar");
              }}
            >
              Create Avatar
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 py-6">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className={cn(
                  "flex flex-col items-center gap-4 p-6 rounded-lg border-2 transition-all",
                  selectedAvatar?.id === avatar.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 min-h-[200px]">
                  <video
                    src={avatar.url}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={(e) => {
                      console.error("Failed to load avatar video:", avatar.url);
                    }}
                  />
                </div>
                <div className="text-base font-semibold text-center">{avatar.name}</div>
                <div className="flex gap-2 w-full">
                  <Button
                    onClick={() => handleAvatarSelect(avatar)}
                    className="flex-1 h-10 text-base"
                    variant={selectedAvatar?.id === avatar.id ? "default" : "outline"}
                  >
                    {selectedAvatar?.id === avatar.id ? "Selected" : "Select"}
                  </Button>
                  {DEFAULT_AVATAR_IDS.has(avatar.id) ? null : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0"
                      onClick={() => {
                        setAvatarsDialogOpen(false);
                        router.push(`/app/create/avatar?characterId=${encodeURIComponent(avatar.id)}`);
                      }}
                      title="Edit avatar (e.g. crop video)"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {avatarNextError && (
            <p className="text-sm text-destructive pt-2">{avatarNextError}</p>
          )}
          {selectedAvatar && (
            <div className="flex justify-end pt-4 border-t">
              <Button
                onClick={handleNextToSpeechGeneration}
                className="px-8"
                size="lg"
                disabled={!selectedAvatar || creatingProjectFromAvatar}
              >
                {creatingProjectFromAvatar ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Speech Generation & Lip Sync Screen */}
      {showSpeechGeneration && (
        <Dialog 
          open={showSpeechGeneration} 
          onOpenChange={(open) => {
            // Prevent closing when generating lip sync
            if (!open && generatingLipSync) {
              return;
            }
            setShowSpeechGeneration(open);
          }}
        >
          <DialogContent 
            className="!w-[80vw] !h-[80vh] !max-w-[80vw] !max-h-[80vh] !sm:max-w-[80vw] overflow-hidden p-0 flex flex-col"
            showCloseButton={!generatingLipSync}
          >
            {/* Visually hidden title for accessibility */}
            <DialogTitle className="sr-only">Speech Generation & Lip Sync</DialogTitle>
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-4 p-4 border-b bg-gray-50">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition",
                currentStep === "speech" ? "bg-blue-500 text-white" : generatedSpeechUrl ? "bg-green-500 text-white" : "bg-gray-200 text-gray-600"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  currentStep === "speech" ? "bg-white text-blue-500" : generatedSpeechUrl ? "bg-white text-green-500" : "bg-gray-400 text-white"
                )}>
                  {generatedSpeechUrl ? "✓" : "1"}
                </div>
                <span className="text-sm font-semibold">Generate Speech</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300"></div>
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition",
                currentStep === "lipsync" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
              )}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                  currentStep === "lipsync" ? "bg-white text-blue-500" : "bg-gray-400 text-white"
                )}>
                  2
                </div>
                <span className="text-sm font-semibold">Lip Sync</span>
              </div>
            </div>

            <div className="flex flex-1 min-h-0">
              {/* Left Panel - Avatar/Lip Sync Preview (2/3 width) */}
              <div className="flex-[2] flex items-center justify-center p-8 border-r">
                <div className="w-full h-full border-2 border-gray-300 rounded-lg flex items-center justify-center bg-white overflow-hidden relative">
                  {lipSyncVideoUrl ? (
                    <>
                      <video
                        src={lipSyncVideoUrl}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                        loop
                        muted={!isPlaying}
                        playsInline
                        onError={(e) => {
                          console.error("Failed to load lip sync video:", lipSyncVideoUrl);
                        }}
                      />
                      {/* Loading overlay when generating */}
                      {generatingLipSync && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                          <div className="text-white text-sm font-semibold mb-2">{lipSyncStatus || 'Generating lip sync...'}</div>
                          {lipSyncProgress > 0 && (
                            <div className="w-64 bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-blue-500 h-full transition-all duration-300"
                                style={{ width: `${lipSyncProgress}%` }}
                              ></div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : selectedAvatar ? (
                    <video
                      src={selectedAvatar.url}
                      className="w-full h-full object-contain"
                      autoPlay
                      loop
                      muted
                      playsInline
                      onError={(e) => {
                        console.error("Failed to load avatar video:", selectedAvatar.url);
                      }}
                    />
                  ) : (
                    <div className="text-gray-400 text-sm">Avatar Preview</div>
                  )}
                </div>
              </div>

              {/* Right Panel - Controls (1/3 width) */}
              <div className="flex-1 flex flex-col p-6 gap-4">
                {currentStep === "speech" ? (
                  <>
                    {/* Step 1: Generate Speech */}
                    {/* Select Voice */}
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Select voice</Label>
                      <div className="flex gap-2">
                        <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={loadingVoices}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder={loadingVoices ? "Loading voices..." : "Choose a voice"} />
                          </SelectTrigger>
                          <SelectContent>
                            {elevenLabsVoices.length > 0 ? (
                              elevenLabsVoices.map((voice) => (
                                <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  {voice.name} {voice.category && `(${voice.category})`}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="voice1">Voice 1 - Natural</SelectItem>
                                <SelectItem value="voice2">Voice 2 - Energetic</SelectItem>
                                <SelectItem value="voice3">Voice 3 - Calm</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        {selectedVoice && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewVoice(selectedVoice)}
                            disabled={previewingVoice === selectedVoice}
                            className="flex-shrink-0"
                          >
                            {previewingVoice === selectedVoice ? (
                              <>
                                <Pause className="h-4 w-4 mr-1" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1" />
                                Preview
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      {/* Preview Audio Player */}
                      {previewAudio && (
                        <div className="mt-2">
                          <audio
                            ref={previewAudioRef}
                            src={previewAudio}
                            controls
                            className="w-full"
                            onEnded={() => setPreviewAudio(null)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Model Selection */}
                    <div className="mb-4 space-y-2">
                      <Label className="text-sm font-semibold block">Model</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedModel("flash");
                            setEmotionsEnabled(false);
                          }}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            selectedModel === "flash"
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          Flash
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedModel("alpha3")}
                          className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                            selectedModel === "alpha3"
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          Alpha 3
                        </button>
                      </div>
                      {selectedModel === "alpha3" && (
                        <Button
                          type="button"
                          variant={emotionsEnabled ? "default" : "outline"}
                          onClick={() => {
                            if (!emotionsEnabled) {
                              // Add emotion tags to the text based on ElevenLabs Alpha 3 requirements
                              const addEmotionsToText = (text: string): string => {
                                // Split text into sentences
                                const sentences = text.split(/([.!?]+)/).filter(s => s.trim());
                                let result = "";
                                let sentenceIndex = 0;
                                
                                // Common emotion tags for alpha 3 (based on ElevenLabs documentation)
                                const emotionTags = [
                                  "[curious]", "[excited]", "[happy]", "[sad]", 
                                  "[angry]", "[surprised]", "[whispers]", "[shouts]",
                                  "[laughs]", "[sighs]", "[confused]", "[mischievously]",
                                  "[crying]", "[clears throat]"
                                ];
                                
                                // Simple heuristic: alternate between different emotions
                                for (let i = 0; i < sentences.length; i++) {
                                  const sentence = sentences[i].trim();
                                  if (!sentence) continue;
                                  
                                  // Add emotion tag every few sentences or based on punctuation
                                  if (sentence.match(/[.!?]$/)) {
                                    const emotionIndex = sentenceIndex % emotionTags.length;
                                    result += `${emotionTags[emotionIndex]} ${sentence} `;
                                    sentenceIndex++;
                                  } else {
                                    result += `${sentence} `;
                                  }
                                }
                                
                                return result.trim();
                              };
                              
                              const textWithEmotions = addEmotionsToText(speechText);
                              setSpeechText(textWithEmotions);
                              setEmotionsEnabled(true);
                            } else {
                              // Remove emotion tags
                              const textWithoutEmotions = speechText.replace(/\[(curious|excited|happy|sad|angry|surprised|whispers|shouts|laughs|sighs|confused|mischievously|crying|clears throat)\]/gi, "").trim();
                              setSpeechText(textWithoutEmotions);
                              setEmotionsEnabled(false);
                            }
                          }}
                          className="w-full mt-2"
                          size="sm"
                        >
                          {emotionsEnabled ? "Remove Emotions" : "Add Emotions to Speech"}
                        </Button>
                      )}
                    </div>

                    {/* Text Input Area */}
                    <div className="flex-1 flex flex-col">
                      <Label className="text-sm font-semibold mb-2 block">Script</Label>
                      <textarea
                        value={speechText}
                        onChange={(e) => setSpeechText(e.target.value)}
                        placeholder="Enter your script here..."
                        className="flex-1 w-full p-4 border-2 border-gray-300 rounded-lg resize-none focus:outline-none focus:border-blue-500"
                      />
                      
                      {/* Speed Control */}
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Speech Speed</Label>
                          <span className="text-sm text-gray-600">{speechSpeed.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.25"
                          max="4.0"
                          step="0.05"
                          value={speechSpeed}
                          onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>0.25x (Slow)</span>
                          <span>1.0x (Normal)</span>
                          <span>4.0x (Fast)</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                      {/* Credit estimation and warning */}
                      {speechText && speechText.trim().length > 0 && (
                        <div className="text-xs space-y-1">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Estimated credits:</span>
                            <span className={hasEnoughCredits ? "font-medium text-foreground" : "font-medium text-destructive"}>
                              {calculateEstimatedCredits.toFixed(2)}
                            </span>
                          </div>
                          {userCredits !== null && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Your balance:</span>
                              <span className="font-medium text-foreground">{userCredits.toFixed(2)}</span>
                            </div>
                          )}
                          {!hasEnoughCredits && userCredits !== null && (
                            <div className="text-destructive text-xs font-medium bg-destructive/10 p-2 rounded">
                              ⚠️ Low on credits! You need {calculateEstimatedCredits.toFixed(2)} credits but only have {userCredits.toFixed(2)}.
                            </div>
                          )}
                        </div>
                      )}
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleGenerateSpeech}
                          disabled={!selectedVoice || !speechText || generatingSpeech || (userCredits !== null && !hasEnoughCredits)}
                        className="flex-1"
                        size="lg"
                          variant={!hasEnoughCredits && userCredits !== null ? "destructive" : "default"}
                      >
                        <Mic className="h-4 w-4 mr-2" />
                          {generatingSpeech 
                            ? "Generating..." 
                            : speechText && speechText.trim().length > 0
                            ? `Generate Speech (${calculateEstimatedCredits.toFixed(2)} credits)`
                            : "Generate Speech"
                          }
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-12 w-12 p-0"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Step 2: Lip Sync */}
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                      <div className="text-center">
                        <h3 className="text-lg font-semibold mb-2">Step 2: Generate Lip Sync</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Your speech has been generated. Now generate lip sync for your avatar.
                        </p>
                      </div>

                    {/* Generated Speech Preview */}
                    {generatedSpeechUrl && (
                      <div className="w-full space-y-2">
                        <div>
                          <Label className="text-sm font-semibold mb-2 block">Generated Speech</Label>
                          {generatedSpeechVoiceId && (
                            <p className="text-xs text-gray-500 mb-2">
                              Voice ID: {generatedSpeechVoiceId}
                            </p>
                          )}
                          <audio
                            src={generatedSpeechUrl}
                            controls
                            className="w-full"
                          />
                        </div>
                        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                          <strong>Note:</strong> Speech generated using ElevenLabs. The audio URL is stored in memory and will be used for lip sync generation.
                        </div>
                      </div>
                    )}

                    {/* Status Updates */}
                    {generatingLipSync && (
                      <div className="w-full space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                          <span className="text-sm font-semibold text-blue-900">{lipSyncStatus || 'Generating lip sync...'}</span>
                        </div>
                        {lipSyncProgress > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full transition-all duration-300"
                              style={{ width: `${lipSyncProgress}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    )}
                    {lipSyncVideoUrl && !generatingLipSync && (
                      <div className="w-full p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                          <span className="text-sm font-semibold text-green-900">Lip sync completed! Video is ready.</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log("[Lip Sync] Button clicked", {
                            generatedSpeechUrl: !!generatedSpeechUrl,
                            selectedAvatar: !!selectedAvatar,
                            generatingLipSync
                          });
                          handleGenerateLipSync(e);
                        }}
                        disabled={!generatedSpeechUrl || !selectedAvatar || generatingLipSync}
                        className="flex-1"
                        size="lg"
                        type="button"
                      >
                        <Mic className="h-4 w-4 mr-2" />
                        {generatingLipSync ? "Generating..." : "Generate Lip Sync (16 credits)"}
                      </Button>
                      {lipSyncVideoUrl && (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleAddVideoToScene}
                          className="h-12 w-12 p-0"
                          title="Add video to scene"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setCurrentStep("speech")}
                      >
                        Back
                      </Button>
                    </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Media Dialog - Generated Videos and Uploaded Images */}
      <Dialog open={mediaDialogOpen} onOpenChange={(open) => {
        setMediaDialogOpen(open);
        // Reset insertion point when dialog closes
        if (!open) {
          setInsertAfterElementId(null);
        }
      }}>
        <DialogContent className="!w-[90vw] !h-[90vh] !max-w-[90vw] !max-h-[90vh] !sm:max-w-[90vw] overflow-hidden p-6 flex flex-col">
          <DialogHeader>
            <DialogTitle>All Media</DialogTitle>
            <DialogDescription>
              Select a video or image to use in your project
            </DialogDescription>
          </DialogHeader>
          {mediaError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-medium">{mediaError}</p>
              <button
                onClick={async () => {
                  setMediaError(null);
                  // Retry loading media using token cache
                  const { getCachedToken } = await import('@/lib/utils/token-cache');
                  const token = await getCachedToken();
                  if (token) {
                    setMediaError(null);
                    Promise.allSettled([
                      loadGeneratedVideos(),
                      loadUploadedImages(),
                      loadUploadedVideos()
                    ]);
                  } else {
                    setMediaError('Please sign in to load your media. If you are signed in, try refreshing the page.');
                  }
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Retry
              </button>
            </div>
          )}
          {(loadingVideos || loadingImages || loadingUploadedVideos) ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="text-gray-400">Loading...</span>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4">
                {/* Generated Videos Section */}
                {generatedVideos.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Generated Videos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                      {generatedVideos.map((video) => (
                        <div
                          key={video.id}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all relative"
                          onClick={() => handleSelectGeneratedVideo(video)}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                            onClick={(e) => handleDeleteGeneratedVideo(video.id, e)}
                            title="Delete video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
                            {video.thumbnail_url ? (
                              <img
                                src={video.thumbnail_url}
                                alt="Video thumbnail"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <video
                                src={video.video_url}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                              />
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-center truncate w-full">
                            {video.duration_seconds
                              ? `${Math.floor(video.duration_seconds)}s`
                              : 'Video'}
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            {new Date(video.created_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectGeneratedVideo(video);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploaded Videos Section */}
                {uploadedVideos.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Uploaded Videos</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                      {uploadedVideos.map((video, idx) => (
                        <div
                          key={`uploaded-video-${idx}`}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all relative"
                          onClick={() => {
                            addElementToCanvas("video", video.url);
                            setMediaDialogOpen(false);
                          }}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                            onClick={(e) => handleDeleteVideo(video.id, e)}
                            title="Delete video"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
                            <video
                              src={video.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-center truncate w-full">
                            {video.name}
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            {new Date(video.created_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              addElementToCanvas("video", video.url);
                              setMediaDialogOpen(false);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploaded Images Section */}
                {uploadedImages.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Uploaded Images</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4">
                      {uploadedImages.map((image, idx) => (
                        <div
                          key={`uploaded-${idx}`}
                          className="group relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all hover:shadow-lg bg-gray-100"
                          onClick={() => {
                            addElementToCanvas("image", image.url);
                            setMediaDialogOpen(false);
                          }}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(e) => handleDeleteImage(image.id, e)}
                            title="Delete image"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error("Failed to load image:", image.url, image.name);
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                            onLoad={() => {
                              console.log("Image loaded successfully by asif:", image.url);
                              console.log("Image loaded successfully:", image.name);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {generatedVideos.length === 0 && uploadedImages.length === 0 && uploadedVideos.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-12">
                    <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No media files yet</p>
                    <p className="text-sm mt-2">Upload images or generate videos to see them here</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* My Audio Dialog */}
      <Dialog open={audioDialogOpen} onOpenChange={setAudioDialogOpen}>
        <DialogContent className="!w-[90vw] !h-[90vh] !max-w-[90vw] !max-h-[90vh] !sm:max-w-[90vw] overflow-hidden p-6 flex flex-col">
          <DialogHeader>
            <DialogTitle>My Audio</DialogTitle>
            <DialogDescription>
              Select an audio file to add to your project
            </DialogDescription>
          </DialogHeader>
          {loadingAudios ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="text-gray-400">Loading...</span>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4">
                {/* Uploaded Audios Section */}
                {uploadedAudios.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 px-4">Uploaded Audio</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                      {uploadedAudios.map((audio, idx) => (
                        <div
                          key={`uploaded-audio-${idx}`}
                          className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 cursor-pointer transition-all relative"
                          onClick={() => {
                            ensureProjectExists();
                            const audioElement: CanvasElement = {
                              id: uuid(),
                              type: "audio",
                              url: audio.url,
                              x: 50,
                              y: 50,
                              width: 50,
                              height: 50,
                              startTime: currentTime,
                              duration: 5000, // Will be updated when audio loads
                              muted: false,
                              rotation: 0,
                              opacity: 1,
                              zIndex: canvasElements.length,
                            };
                            setCanvasElements([...canvasElements, audioElement]);
                            setAudioDialogOpen(false);
                          }}
                        >
                          <button
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors"
                            onClick={(e) => handleDeleteAudio(audio.id, e)}
                            title="Delete audio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                            <Music className="h-16 w-16 text-gray-400" />
                          </div>
                          <div className="text-sm font-semibold text-center truncate w-full">
                            {audio.name}
                          </div>
                          <div className="text-xs text-gray-500 text-center">
                            {new Date(audio.created_at).toLocaleDateString()}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              ensureProjectExists();
                              
                              // Calculate startTime: place after the last audio element, but ensure it fits within timeline
                              const existingAudioElements = canvasElements.filter(el => el.type === "audio");
                              let audioStartTime = 0;
                              if (existingAudioElements.length > 0) {
                                // Find the last audio element's end time
                                const lastAudio = existingAudioElements.reduce((latest, el) => {
                                  const elEndTime = (el.startTime || 0) + (el.duration || 5000);
                                  const latestEndTime = (latest.startTime || 0) + (latest.duration || 5000);
                                  return elEndTime > latestEndTime ? el : latest;
                                });
                                const calculatedStartTime = (lastAudio.startTime || 0) + (lastAudio.duration || 5000);
                                // Ensure the audio fits within the timeline
                                // If it would exceed, place it at the start instead
                                audioStartTime = Math.max(0, Math.min(calculatedStartTime, duration - 5000)); // Leave room for at least 5s duration
                              }
                              
                              const audioElement: CanvasElement = {
                                id: uuid(),
                                type: "audio",
                                url: audio.url,
                                x: 50,
                                y: 50,
                                width: 50,
                                height: 50,
                                startTime: audioStartTime,
                                duration: 5000, // Will be updated when audio loads
                                audioStartOffset: 0, // Initialize audio start offset for trimming
                                muted: false,
                                rotation: 0,
                                opacity: 1,
                                zIndex: canvasElements.length,
                              };
                              setCanvasElements([...canvasElements, audioElement]);
                              setAudioDialogOpen(false);
                            }}
                          >
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {uploadedAudios.length === 0 && (
                  <div className="col-span-full text-center text-gray-500 py-12">
                    <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No audio files yet</p>
                    <p className="text-sm mt-2">Upload audio files or create with ElevenLabs to see them here</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Fill Jump Cuts Dialog */}
      <Dialog open={fillJumpCutsDialogOpen} onOpenChange={setFillJumpCutsDialogOpen}>
        <DialogContent className="!w-[900px] !max-w-[900px] overflow-hidden p-6 flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Fill Jump Cuts</DialogTitle>
            <DialogDescription>
              Select B-rolls and set the interval to automatically fill jump cuts
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            {/* Jump Cut Interval Input */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Jump Cut Interval (seconds)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                placeholder="e.g., 5 (B-rolls every 5 seconds)"
                value={jumpCutInterval ?? ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setJumpCutInterval(isNaN(value) || value <= 0 ? null : value);
                }}
              />
              {jumpCutInterval && (
                <div className="text-xs text-muted-foreground">
                  B-rolls will appear every {jumpCutInterval}s
                </div>
              )}
            </div>

            {/* B-rolls Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Select B-rolls (up to 5)</Label>
                {selectedBRollIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBRollIds([])}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {selectedBRollIds.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedBRollIds.length} of 5 selected
                </div>
              )}
              {loadingBRolls ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : bRolls.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12 border rounded-lg">
                  No B-rolls uploaded yet. Upload B-rolls first.
                </div>
              ) : (
                <ScrollArea className="max-h-[500px] border rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    {bRolls.map((bRoll) => {
                      const isSelected = selectedBRollIds.includes(bRoll.id);
                      const canSelect = isSelected || selectedBRollIds.length < 5;
                      
                      return (
                        <div
                          key={bRoll.id}
                          className={cn(
                            "relative group cursor-pointer rounded-lg border-2 overflow-hidden transition-all",
                            isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                          )}
                          onClick={() => {
                            if (canSelect) {
                              if (isSelected) {
                                setSelectedBRollIds(selectedBRollIds.filter(id => id !== bRoll.id));
                              } else {
                                setSelectedBRollIds([...selectedBRollIds, bRoll.id]);
                              }
                            }
                          }}
                        >
                          {/* Video Preview */}
                          <div className="relative aspect-video w-full overflow-hidden bg-black">
                            {bRoll.url ? (
                              <video
                                src={bRoll.url}
                                className="h-full w-full object-cover"
                                muted
                                loop
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                <VideoIcon className="h-8 w-8 text-muted-foreground/50" />
                              </div>
                            )}
                            {/* Overlay with play icon */}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:bg-black/10">
                              <div className="rounded-full bg-black/60 p-2 backdrop-blur-sm transition-transform group-hover:scale-110">
                                <Play className="h-4 w-4 text-white" fill="white" />
                              </div>
                            </div>
                            {/* Checkbox overlay */}
                            <div className="absolute top-2 left-2">
                              <div className={cn(
                                "w-6 h-6 rounded border-2 flex items-center justify-center transition-all",
                                isSelected 
                                  ? "bg-primary border-primary" 
                                  : "bg-black/60 border-white/80 backdrop-blur-sm"
                              )}>
                                {isSelected && (
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                )}
                              </div>
                            </div>
                            {/* Delete button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 h-7 w-7 p-0 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Delete ${bRoll.name}?`)) {
                                  try {
                                    await bRollsApi.delete(bRoll.id);
                                    setSelectedBRollIds(selectedBRollIds.filter(id => id !== bRoll.id));
                                    await loadBRolls();
                                  } catch (error) {
                                    console.error("Error deleting B-roll:", error);
                                    alert(`Failed to delete B-roll: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                  }
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          {/* Video Info */}
                          <div className="p-3 bg-background">
                            <div className="text-sm font-medium truncate">{bRoll.name}</div>
                            {bRoll.durationSeconds && (
                              <div className="text-xs text-muted-foreground">
                                {bRoll.durationSeconds.toFixed(1)}s
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setFillJumpCutsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!jumpCutInterval || selectedBRollIds.length === 0) {
                  console.warn('⚠️ Apply button clicked but missing required data:', { jumpCutInterval, selectedBRollIds });
                  return;
                }

                console.log('🚀 Apply button clicked:', {
                  jumpCutInterval,
                  selectedBRollIds,
                  bRollsCount: bRolls.length,
                  duration,
                  canvasElementsCount: canvasElements.length
                });

                // Get selected B-roll objects
                const selectedBRolls = bRolls.filter(b => selectedBRollIds.includes(b.id));
                console.log('📋 Selected B-rolls:', selectedBRolls.map(b => ({ id: b.id, name: b.name, url: b.url, durationSeconds: b.durationSeconds })));
                
                if (selectedBRolls.length === 0) {
                  console.error('❌ No B-rolls found for selected IDs:', selectedBRollIds);
                  alert('No B-rolls found. Please refresh and try again.');
                  return;
                }
                
                // Remove existing B-roll clips (identified by muted=true, videoStartOffset set, and full screen overlay)
                const existingBRollClips = canvasElements.filter(el => 
                  el.type === "video" && 
                  el.muted === true && 
                  el.videoStartOffset !== undefined &&
                  el.x === 0 && 
                  el.y === 0 && 
                  el.width === 100 && 
                  el.height === 100
                );
                
                console.log('🗑️ Removing existing B-roll clips:', existingBRollClips.length);
                
                // Remove existing B-roll clips from canvas
                const elementsWithoutBRolls = canvasElements.filter(el => 
                  !existingBRollClips.some(bRollClip => bRollClip.id === el.id)
                );

                // Generate new B-roll clips
                const newBRollClips = generateBRollClips(
                  duration, // Total duration in ms
                  jumpCutInterval, // Interval in seconds
                  selectedBRolls
                );

                console.log('✅ B-roll clips generated:', {
                  interval: jumpCutInterval,
                  selectedBRollIds,
                  clipsGenerated: newBRollClips.length,
                  totalDuration: duration / 1000 + 's',
                  newClips: newBRollClips.map(c => ({ startTime: c.startTime, duration: c.duration, url: c.url?.substring(0, 50) + '...' }))
                });

                // Add new clips to canvas
                const updatedElements = [...elementsWithoutBRolls, ...newBRollClips];
                setCanvasElements(updatedElements);

                setFillJumpCutsDialogOpen(false);
              }}
              disabled={!jumpCutInterval || selectedBRollIds.length === 0}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
