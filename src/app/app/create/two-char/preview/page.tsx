"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/create/stepper";
import { VideoPreview } from "@/components/create/video-preview";
import { SubtitlesEditor } from "@/components/create/subtitles-editor";
import { SubtitleStyleSelector } from "@/components/create/subtitle-style-selector";
import { TikTokVideoEditor } from "@/components/create/tiktok-video-editor";
import { CharacterSizeControls } from "@/components/create/character-size-controls";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { parseSrtText, generateMockFromScript } from "@/lib/utils/srt";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Download, ChevronDown, ChevronUp, Info, Save } from "lucide-react";
import { RenderWaitGame } from "@/components/create/RenderWaitGame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { config } from "@/lib/config";
import { SaveTemplateDialog } from "@/components/create/save-template-dialog";
import { buildTemplateExtras, type TemplateIncludeFlags } from "@/lib/template-includes";
import { templatesApi } from "@/lib/api/projects";
import { subscriptionApi } from "@/lib/api/subscription";
import { getBackgrounds } from "@/lib/data/backgrounds-api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ImageOverlay } from "@/types";

const steps = [
  { label: "Step 1", description: "Pick two characters" },
  { label: "Step 2", description: "Write the script" },
  { label: "Step 3", description: "Choose gameplay background" },
  { label: "Step 4", description: "Preview & edit" },
];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toNumberOr = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isLikelySvgUrl = (url: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes(".svg") || lower.includes("format=svg");
};

const normalizeStockOverlays = (
  overlays: unknown[],
  durationFallbackMs: number
): ImageOverlay[] => {
  return overlays
    .map((raw, idx) => {
      const item = (raw || {}) as Partial<ImageOverlay>;
      const imageUrl = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
      if (!imageUrl || (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:"))) {
        return null;
      }

      const startMs = Math.max(0, Math.round(toNumberOr(item.startMs, 0)));
      const defaultEnd = Math.max(startMs + 1, startMs + durationFallbackMs);
      const endMs = Math.max(startMs + 1, Math.round(toNumberOr(item.endMs, defaultEnd)));

      return {
        id: typeof item.id === "string" && item.id.trim().length > 0 ? item.id : `stock-${Date.now()}-${idx}`,
        imageUrl,
        startMs,
        endMs,
        x: clamp(toNumberOr(item.x, 50), 0, 100),
        y: clamp(toNumberOr(item.y, 26), 0, 100),
        width: clamp(toNumberOr(item.width, 46), 0, 100),
        height: clamp(toNumberOr(item.height, 28), 0, 100),
        // SVG sources can trip Next/Image in some setups; render them with plain <img> branch.
        intrinsicSize: item.intrinsicSize === true || isLikelySvgUrl(imageUrl),
        opacity: clamp(toNumberOr(item.opacity, 1), 0, 1),
      } as ImageOverlay;
    })
    .filter((overlay): overlay is ImageOverlay => overlay !== null);
};

export default function PreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get("editing") === "true";
  const projectIdFromUrl = searchParams.get("projectId");
  const { user } = useAuthStore();
  const draft = useProjectStore((state) => state.draft);
  const projects = useProjectStore((state) => state.projects);
  const {
    updateDraft,
    enqueuePreview,
    simulateRender,
    createProjectFromDraft,
    updateProject,
    unsubscribeFromRenderJob,
    loadProjectIntoDraft,
  } = useProjectStore();

  // Load project data when in edit mode (use projectId from URL so refresh/direct open works)
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  useEffect(() => {
    const projectId = projectIdFromUrl || draft?.id;
    if (!isEditing || !projectId || isLoadingProject) return;

    // Only fetch what we truly need before showing the editor. Do NOT require srtText or
    // backgroundId here — both can be empty in DB (no captions yet / legacy rows) and would
    // keep needsLoad true forever → infinite reload and a stuck "Loading project data..." UI.
    const needsLoad =
      !draft?.script?.length ||
      (!draft?.mergedAudioUrl && !draft?.previewUrl && !draft?.audioFiles?.length) ||
      draft?.id !== projectId;

    if (needsLoad) {
      setIsLoadingProject(true);
      loadProjectIntoDraft(projectId)
        .catch((err) => {
          console.error("Failed to load project:", err);
          toast.error(err?.message || "Failed to load project data");
        })
        .finally(() => {
          setIsLoadingProject(false);
        });
    }
  }, [
    isEditing,
    projectIdFromUrl,
    draft?.id,
    draft?.script?.length,
    draft?.mergedAudioUrl,
    draft?.previewUrl,
    draft?.audioFiles?.length,
    isLoadingProject,
    loadProjectIntoDraft,
  ]);

  useEffect(() => {
    // Skip redirect check if we're editing an existing project
    if (isEditing) return;
    
    if (!draft?.script?.length) {
      toast.info("Write a script before generating a preview.");
      router.replace("/app/create/two-char/script");
      return;
    }
    if (!draft?.backgroundId) {
      toast.info("Choose a gameplay background before previewing.");
      router.replace("/app/create/two-char/background");
      return;
    }
  }, [draft?.script?.length, draft?.backgroundId, router, isEditing]);

  const [showOverlays, setShowOverlays] = useState(true);
  const subtitleText = draft?.srtText ?? "";
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [isSubtitlesExpanded, setIsSubtitlesExpanded] = useState(false); // Initially closed
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isAddingMagicStockImages, setIsAddingMagicStockImages] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [isCharacterSettingsExpanded, setIsCharacterSettingsExpanded] = useState(false); // Initially collapsed
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  
  // Check if preview has been generated (user can interact with controls)
  // Preview is ready if we have merged audio, per-line audioFiles (browser preview), OR previewUrl (rendered video).
  // Edit mode often loads mergedAudioUrl from DB while audioFiles may be empty — must still count as "has preview".
  const hasPreview =
    !!draft?.previewUrl ||
    (!!draft?.audioFiles && draft.audioFiles.length > 0) ||
    !!draft?.mergedAudioUrl;
  const isInitialState = !hasPreview && !isGeneratingPreview; // Disable everything except preview button
  
  // Status: READY if we have audioFiles (browser preview) or previewUrl (rendered video)
  // If status is FAILED but there's no previewUrl, treat it as IDLE (not a real failure - just need to generate preview first)
  let effectiveStatus: "QUEUED" | "RENDERING" | "READY" | "FAILED" | null = 
    draft?.status === "READY" || (hasPreview && !draft?.status) ? "READY" : (draft?.status as "QUEUED" | "RENDERING" | "READY" | "FAILED" | null) ?? null;
  if (effectiveStatus === "FAILED" && !draft?.previewUrl) {
    // Clear FAILED status if there's no preview - this isn't a real failure, just need to generate preview first
    effectiveStatus = null;
  }
  const status = effectiveStatus;
  
  // State to cache background videos
  const [backgroundVideos, setBackgroundVideos] = useState<Array<{ id: string; s3_url: string }>>([]);
  
  // Load background videos on mount
  useEffect(() => {
    getBackgrounds()
      .then((backgrounds) => {
        setBackgroundVideos(backgrounds.map(bg => ({ id: bg.id, s3_url: bg.previewUrl || '' })));
      })
      .catch((error) => {
        console.error('Error loading background videos:', error);
      });
  }, []);
  
  // Helper function to get background video URL from API
  const getBackgroundVideoUrl = (backgroundId: string | null | undefined): string | null => {
    if (!backgroundId) return null;
    const background = backgroundVideos.find(bg => bg.id === backgroundId);
    return background?.s3_url || null;
  };
  
  // Initialize captionsGenerated based on whether srtText exists
  // In edit mode, if srtText exists, captions were already generated
  const captionsGenerated = !!subtitleText && subtitleText.trim().length > 0;
  
  // Sync showSubtitles with draft - show subtitles if captions exist
  useEffect(() => {
    // Show subtitles if captions exist (either from draft or newly generated)
    if (captionsGenerated) {
      setShowSubtitles(true);
    } else {
      setShowSubtitles(false);
    }
  }, [captionsGenerated, subtitleText]);

  const subtitleSegments = useMemo(() => {
    const segments = parseSrtText(subtitleText);
    return segments;
  }, [subtitleText, showSubtitles]);

  const effectiveAudioFiles = useMemo(() => {
    if (draft?.audioFiles && draft.audioFiles.length > 0) {
      return draft.audioFiles;
    }

    // Edit-mode fallback: reconstruct timing windows from subtitles so speaker/avatar switching still works.
    if (!subtitleSegments || subtitleSegments.length === 0) {
      return [];
    }

    return subtitleSegments.map((segment) => ({
      speaker: segment.speaker,
      text: segment.text,
      publicUrl: null,
      startMs: segment.startMs,
      endMs: segment.endMs,
      durationMs: Math.max(1, segment.endMs - segment.startMs),
    }));
  }, [draft?.audioFiles, subtitleSegments]);

  const shouldUseBrowserPreviewMode = useMemo(() => {
    if (!effectiveAudioFiles.length) return false;
    return Boolean(
      draft?.mergedAudioUrl ||
      effectiveAudioFiles.some((af) => !!af.publicUrl)
    );
  }, [draft?.mergedAudioUrl, effectiveAudioFiles]);

  // Reset generating state when render completes or fails
  useEffect(() => {
    if (status === "READY" || status === "FAILED") {
      if (isGeneratingPreview) {
        setIsGeneratingPreview(false);
      }
      if (isRenderingFinal) {
        setIsRenderingFinal(false);
      }
    }
  }, [status, isGeneratingPreview, isRenderingFinal]);

  // Cleanup: Unsubscribe from realtime updates when component unmounts
  useEffect(() => {
    return () => {
      unsubscribeFromRenderJob();
    };
  }, [unsubscribeFromRenderJob]);

  // Load user credits
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

  // Calculate estimated credits based on script (Flash model: 0.2 credits/second)
  const estimatedCredits = useMemo(() => {
    if (!draft?.script?.length) return 0;

    // Calculate total text length from script
    const totalText = draft.script
      .map(line => line.text || '')
      .join(' ')
      .trim();

    if (!totalText) return 0;

    // Estimate duration: average speaking rate is ~150 words per minute = 2.5 words per second
    const words = totalText.split(/\s+/).length;
    const estimatedSeconds = words / 2.5;
    
    // Flash model rate: 0.2 credits/second
    const creditRate = 0.2;
    const estimatedCredits = estimatedSeconds * creditRate;
    
    return Math.max(0.01, estimatedCredits); // Minimum 0.01 credits
  }, [draft?.script]);

  // Refresh credits after preview generation
  useEffect(() => {
    if (status === "READY" && user?.id) {
      const refreshCredits = async () => {
        try {
          const result = await subscriptionApi.getSubscriptionInfo();
          setUserCredits(result.subscription.credits || 0);
        } catch (error) {
          console.error("Error refreshing credits:", error);
        }
      };
      refreshCredits();
    }
  }, [status, user?.id]);

  const handleGeneratePreview = async () => {
    if (!draft?.script?.length) {
      toast.error("Add at least two lines to preview the conversation.");
      return;
    }
    
    try {
      setIsGeneratingPreview(true);
      toast.info("Queuing video generation...");
      
      // Only pass project ID if we're editing AND it's a valid database project ID
      // For new projects, draft.id is a local UUID, so we pass undefined to trigger creation
      const projectId = (isEditing && draft?.id && draft?.previewUrl) ? draft.id : undefined;
      const userId = user?.id || undefined;
      
      await enqueuePreview(projectId, userId, {
        includeStockImages: false,
      });
      // Don't show success here - it will be shown when the job actually completes
      // Don't set isGeneratingPreview to false here - let it stay true so the game shows
      // The useEffect will reset it when status becomes READY or FAILED
    } catch (error) {
      setIsGeneratingPreview(false);
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to generate preview. Make sure the video server is running."
      );
    }
  };

  const handleGenerateCaptions = async () => {
    try {
      if (!draft?.id) {
        toast.error("Project not ready. Generate preview first.");
        return;
      }
      const { renderApi } = await import("@/lib/api/projects");
      toast.info("Generating captions from audio...");
      const result = await renderApi.generateCaptions(draft.id);
      if (result.success) {
        updateDraft({ srtText: result.srtText, subtitleEnabled: true });
        toast.success(`Captions generated successfully! (${result.segmentsCount} segments)`);
      } else {
        toast.error("Failed to generate captions.");
      }
    } catch (error) {
      toast.error("Failed to generate captions.");
    }
  };

  const handleAddMagicStockImages = async () => {
    if (!draft?.id) {
      toast.error("Generate preview first.");
      return;
    }

    // We need real timing windows for overlays.
    const conversations = (draft?.audioFiles || [])
      .filter((a) => typeof a.startMs === "number" && typeof a.endMs === "number")
      .map((a) => ({
        speaker: a.speaker,
        text: a.text,
        startMs: a.startMs,
        endMs: a.endMs,
      }));

    if (conversations.length === 0) {
      toast.error("No timed audio found yet. Generate preview first.");
      return;
    }

    try {
      setIsAddingMagicStockImages(true);
      const { renderApi } = await import("@/lib/api/projects");
      const stockRes = await renderApi.suggestStockOverlays(draft.id, {
        conversations,
        maxOverlays: 20,
        mode: "per_line",
        useLlm: true,
      });

      if (!stockRes.success) {
        throw new Error(stockRes.error || "Failed to generate stock images");
      }

      const stockOverlays = normalizeStockOverlays(
        stockRes.imageOverlays || [],
        2500
      );
      const prev = draft.imageOverlays || [];
      const withoutOldStock = prev.filter((o) => !o.id.startsWith("stock-"));
      const merged = [...withoutOldStock, ...stockOverlays];

      updateDraft({ imageOverlays: merged });
      await updateProject(draft.id, { imageOverlays: merged } as any).catch(() => {});

      toast.success(
        stockOverlays.length > 0
          ? `Magic stock images added (${stockOverlays.length})`
          : "No matching stock images found"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add stock images");
    } finally {
      setIsAddingMagicStockImages(false);
    }
  };

  const handleRenderFinal = async () => {
    // Check if project exists in edit mode (draft.id is set after load; projectIdFromUrl supports refresh)
    const projectId = projectIdFromUrl || draft?.id;
    if (isEditing && !projectId) {
      toast.error("Project not found. Please open this video from the dashboard again.");
      return;
    }
    
    try {
      setIsRenderingFinal(true);
      toast.info("Starting final render with all customizations...");
      await simulateRender();
      // Don't set isRenderingFinal to false here - let it stay true so the game shows
      // The useEffect will reset it when status becomes READY or FAILED
    } catch (error) {
      setIsRenderingFinal(false);
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to render final video. Make sure the video server is running."
      );
    }
  };

  const handleSaveTemplate = async (
    name: string,
    description: string | undefined,
    includes: TemplateIncludeFlags
  ) => {
    if (!draft) {
      toast.error("No draft found");
      return;
    }

    if (!draft.backgroundId) {
      toast.error("Please select a background first");
      return;
    }

    if (!user?.id) {
      toast.error("Please sign in to save templates");
      return;
    }

    try {
      setIsSavingTemplate(true);
      const templateExtras = buildTemplateExtras(draft, includes);
      await templatesApi.create({
        name,
        description,
        projectType: draft.type || "TWO_CHAR_CONVO",
        backgroundId: draft.backgroundId,
        subtitleStyle: draft.subtitleStyle || "bold-green",
        subtitlePosition: draft.subtitlePosition,
        subtitleFontSize: draft.subtitleFontSize,
        textOverlays: draft.textOverlays || [],
        characters: draft.characters || { A: null, B: null },
        characterSizes: draft.characterSizes,
        characterPositions: draft.characterPositions,
        characterCustomPositions: draft.characterCustomPositions,
        playbackRate: draft.playbackRate ?? 1,
        templateExtras,
      });
      toast.success("Template saved successfully!");
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save template. Please try again."
      );
      throw error;
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleSaveDraft = async () => {
    updateDraft({
      srtText: subtitleText,
      subtitleEnabled: showSubtitles,
    });
    
    // Check if project exists in database
    // Project exists if: 1) isEditing is true, OR 2) previewUrl exists (project was created during preview generation)
    const projectExists = isEditing || !!draft?.previewUrl;
    
    // Also check if draft.id exists in projects list (another way to verify it's a database project)
    const projects = useProjectStore.getState().projects;
    const projectInList = draft?.id ? projects.find(p => p.id === draft.id) : null;
    const hasDatabaseProject = projectExists || !!projectInList;
    
    // Save to database if project exists (either editing or created during preview)
    if (draft?.id && hasDatabaseProject) {
      try {
        await updateProject(draft.id, {
          status: 'DRAFT', // Set status to DRAFT so backend knows to preserve audio
          srtText: subtitleText,
          textOverlays: draft.textOverlays || [],
          imageOverlays: draft.imageOverlays || [],
          subtitleStyle: draft.subtitleStyle,
          subtitlePosition: draft.subtitlePosition,
          subtitleFontSize: draft.subtitleFontSize,
          subtitleEnabled: showSubtitles,
          subtitleSingleLine: draft.subtitleSingleLine ?? false,
          subtitleSingleWord: draft.subtitleSingleWord ?? false,
          characterSizes: draft.characterSizes,
          characterPositions: draft.characterPositions,
          characterCustomPositions: draft.characterCustomPositions,
          playbackRate: draft.playbackRate || 1,
        } as any);
        toast.success("Draft saved to database");
      } catch (error) {
        // Project might not exist or have permission issues - that's okay
        // Text overlays are in draft and will be saved on preview/finish
        toast.success("Draft saved locally");
      }
    } else {
      toast.success("Draft saved locally");
    }
  };

  const handleFinish = async () => {
    // Check if project already exists (created during preview generation)
    const existingProject = useProjectStore.getState().projects.find(
      p => p.title === draft?.title && 
      p.script.length === draft?.script?.length
    );
    
    if (existingProject) {
      // Project already exists, update it with latest text overlays before clearing
      try {
        await updateProject(existingProject.id, {
          textOverlays: draft.textOverlays || [],
          imageOverlays: draft.imageOverlays || [],
          srtText: subtitleText,
          characterSizes: draft.characterSizes,
          characterPositions: draft.characterPositions,
          characterCustomPositions: draft.characterCustomPositions,
          playbackRate: draft.playbackRate || 1,
        } as any);
      } catch (error) {
        // Continue anyway - project exists
      }
      toast.success("Project saved to dashboard");
      useProjectStore.getState().clearDraft();
      router.push("/app/dashboard");
      return;
    }
    
    // Optional: Warn if no preview, but still allow saving
    if (!draft?.previewUrl) {
      toast.info("Saving project without preview video...");
    }
    
    try {
      toast.info("Saving project...");
      const created = await createProjectFromDraft(user?.id ?? "mock-user");
      
      if (created) {
        // Update the project with latest text overlays and subtitles
        // (in case they were modified after project creation)
        try {
          await updateProject(created.id, {
            textOverlays: draft.textOverlays || [],
            imageOverlays: draft.imageOverlays || [],
            srtText: subtitleText,
            subtitleStyle: draft.subtitleStyle,
            subtitlePosition: draft.subtitlePosition,
            subtitleFontSize: draft.subtitleFontSize,
            subtitleEnabled: draft.subtitleEnabled,
            characterSizes: draft.characterSizes,
            characterPositions: draft.characterPositions,
            characterCustomPositions: draft.characterCustomPositions,
            playbackRate: draft.playbackRate || 1,
          } as any);
        } catch (updateError) {
          // Continue anyway - project was created successfully
        }
        
        toast.success("Project added to dashboard");
        useProjectStore.getState().clearDraft();
        router.push("/app/dashboard");
      } else {
        toast.error("Failed to save project");
      }
    } catch (error) {
      toast.error("Failed to save project");
    }
  };

  const handleResetSubtitles = () => {
    // Restore original server-generated subtitles if available
    if (draft?.originalSrtText) {
      updateDraft({ srtText: draft.originalSrtText });
      toast.success("✅ Restored original audio-synced subtitles!");
    } else if (draft?.script?.length) {
      // Fallback to mock generation if original not available
      const mock = generateMockFromScript(draft.script);
      updateDraft({ srtText: mock });
      toast.info("Generated subtitles from script (original timing not available)");
    }
  };


  // Get render progress from draft
  const renderProgress = draft?.renderProgress ?? 0;
  const progressValue =
    status === "READY" ? 100 
    : status === "RENDERING" ? (renderProgress > 0 ? renderProgress : 50)
    : status === "QUEUED" ? 20 
    : status === "FAILED" ? 0 
    : 0;
  
  // Download handler
  const handleDownload = () => {
    const videoUrl = draft?.finalUrl || draft?.previewUrl;
    if (!videoUrl) {
      toast.error("No video available to download");
      return;
    }
    
    // Create a temporary anchor element to trigger download
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `${draft?.title || 'video'}-final.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started!");
  };

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={3} />
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Preview, fine-tune, and render
          </h1>
          <p className="text-sm text-muted-foreground">
            Generate a TikTok/Reels format video (1080×1920), tweak subtitles, and add overlays.
          </p>
        </header>
        <div className="flex flex-col gap-3 rounded-3xl border border-border/40 bg-white/70 p-5">
          {/* Credit Balance Display */}
          {userCredits !== null && estimatedCredits > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your balance:</span>
              <span className={`font-medium ${userCredits < estimatedCredits ? 'text-destructive' : 'text-foreground'}`}>
                {userCredits.toFixed(2)} credits
              </span>
            </div>
          )}
          {userCredits !== null && userCredits < estimatedCredits && estimatedCredits > 0 && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              ⚠️ Low on credits! You need {estimatedCredits.toFixed(2)} credits but only have {userCredits.toFixed(2)}.
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4">
          <Button
            className={`rounded-2xl ${
              isInitialState 
                ? "relative animate-glow ring-2 ring-primary ring-offset-2" 
                : ""
              } ${userCredits !== null && userCredits < estimatedCredits ? 'opacity-60' : ''}`}
            onClick={handleGeneratePreview}
              disabled={isGeneratingPreview || status === "RENDERING" || status === "QUEUED" || (userCredits !== null && userCredits < estimatedCredits)}
          >
            {isGeneratingPreview
              ? "Generating Audio..."
              : status === "RENDERING" || status === "QUEUED" 
              ? "Generating..." 
              : status === "FAILED"
              ? "Retry Preview"
                : estimatedCredits > 0
                ? `Generate Preview (${estimatedCredits.toFixed(2)} credits)`
              : "Generate Preview"}
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={handleRenderFinal}
            disabled={!hasPreview || status === "RENDERING" || status === "QUEUED" || isRenderingFinal}
          >
            {isRenderingFinal
              ? "Rendering..."
              : status === "RENDERING" 
              ? "Rendering..." 
              : draft?.finalUrl
              ? "Re-render Final"
              : "Render Final (HD 1080×1920)"}
          </Button>
          {status === "READY" && draft?.finalUrl && (
            <Button
              variant="default"
              className="rounded-2xl"
              onClick={handleDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Video
            </Button>
          )}
          {hasPreview && draft?.backgroundId && (
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => setIsSaveTemplateOpen(true)}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Template
            </Button>
          )}
          <div className="flex flex-1 flex-col gap-2">
            <Progress value={progressValue} className="h-2 rounded-full bg-muted" />
            <span className={`text-xs ${
              status === "FAILED" ? "text-destructive font-medium" 
              : status === "READY" ? "text-green-600 font-medium"
              : "text-muted-foreground"
            }`}>
              {status === "RENDERING" && renderProgress > 0
                ? `Rendering... ${renderProgress}%`
                : status === "QUEUED"
                ? `Queued (Position #${draft?.queuePosition || '?'}) - Est. wait: ${draft?.estimatedWaitTime ? Math.round(draft.estimatedWaitTime / 60) : '?'} min`
                : status === "FAILED" 
                ? "Failed - Try again" 
                : status === "READY" && draft?.finalUrl
                ? "Ready - Click Download"
                : status ?? "IDLE"}
            </span>
          </div>
          </div>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={handleAddMagicStockImages}
              disabled={
                isAddingMagicStockImages ||
                isGeneratingPreview ||
                status === "RENDERING" ||
                status === "QUEUED" ||
                !hasPreview
              }
            >
              {isAddingMagicStockImages ? "Adding magic stock images..." : "Magic stock images"}
            </Button>
          </div>
        </div>
        {/* Captions Generation Gate - Show whenever preview exists */}
        {draft?.previewUrl && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border/60 bg-white/70 p-4">
            <div className="text-sm text-muted-foreground">
              {captionsGenerated 
                ? "Captions generated. Click to regenerate from audio."
                : "Subtitles are hidden until captions are generated from the preview audio."}
            </div>
            <Button 
              className="rounded-2xl" 
              onClick={handleGenerateCaptions}
              disabled={isInitialState || status === "RENDERING"}
            >
              {captionsGenerated ? "Regenerate Captions" : "Generate Captions"}
            </Button>
          </div>
        )}
        {/* TikTok-Style Editor with Video Player */}
        {isLoadingProject ? (
          <div className="rounded-3xl border border-border/40 bg-muted/20 p-8 text-center">
            <p className="text-sm text-muted-foreground">Loading project data...</p>
          </div>
        ) : (
        <div className="space-y-4">
          <TikTokVideoEditor
            videoUrl={draft?.previewUrl}
            status={status}
            durationMs={draft?.audioTotalDurationMs || (draft?.durationSec || 0) * 1000}
            textOverlays={draft?.textOverlays ?? []}
            onTextOverlaysChange={(overlays) => {
              // Only update draft, don't auto-save to database
              if (!isInitialState) {
              updateDraft({ textOverlays: overlays });
              }
            }}
            imageOverlays={draft?.imageOverlays ?? []}
            onImageOverlaysChange={(overlays) => {
              // Only update draft, don't auto-save to database
              if (!isInitialState) {
              updateDraft({ imageOverlays: overlays });
              }
            }}
            subtitles={subtitleSegments}
            showSubtitles={showSubtitles}
            subtitleStyle={draft?.subtitleStyle}
            subtitlePosition={draft?.subtitlePosition ?? { x: 50, y: 85 }}
            onSubtitlePositionChange={(position) => {
              if (!isInitialState) {
              updateDraft({ subtitlePosition: position });
              }
            }}
            subtitleFontSize={draft?.subtitleFontSize ?? 100}
            onSubtitleFontSizeChange={(size) => {
              if (!isInitialState) {
              updateDraft({ subtitleFontSize: size });
              }
            }}
            subtitleFontFamily={draft?.subtitleFontFamily || 'zy-resolve'}
            onSubtitleFontFamilyChange={(font) => {
              if (!isInitialState) {
              updateDraft({ subtitleFontFamily: font });
              }
            }}
            karaokePillColor={draft?.karaokePillColor || '#E96BA8'}
            playbackRate={draft?.playbackRate ?? 1}
            onPlaybackRateChange={(rate) => {
              if (!isInitialState) {
              updateDraft({ playbackRate: rate });
              }
            }}
            subtitleSingleLine={draft?.subtitleSingleLine ?? false}
            browserPreviewMode={shouldUseBrowserPreviewMode}
            audioFiles={effectiveAudioFiles}
            mergedAudioUrl={draft?.mergedAudioUrl || null}
            mergedDurationMs={draft?.mergedDurationMs}
            backgroundVideoUrl={draft?.backgroundId ? getBackgroundVideoUrl(draft.backgroundId) : null}
            subtitleSingleWord={draft?.subtitleSingleWord ?? false}
            characters={draft?.characters}
            characterSizes={draft?.characterSizes}
            characterPositions={draft?.characterPositions}
            onCharacterPositionsChange={(positions) => {
              if (!isInitialState) {
                updateDraft({ characterPositions: positions });
                // Auto-save to project if it exists
                const projectId = draft?.id;
                if (projectId && isEditing) {
                  updateProject(projectId, { characterPositions: positions } as any).catch(() => {});
                }
              }
            }}
            characterCustomPositions={draft?.characterCustomPositions}
            onCharacterCustomPositionsChange={(positions) => {
              if (!isInitialState) {
                updateDraft({ characterCustomPositions: positions });
                // Auto-save to project if it exists
                const projectId = draft?.id;
                if (projectId && isEditing) {
                  updateProject(projectId, { characterCustomPositions: positions } as any).catch(() => {});
                }
              }
            }}
            characterSlideInEnabled={draft?.characterSlideInEnabled !== false}
            characterSlideInWhooshEnabled={draft?.characterSlideInWhooshEnabled === true}
          />
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4">
            <div className="space-y-1">
              <Label htmlFor="character-slide-in" className="text-sm font-medium">
                Character slide-in
              </Label>
              <p className="text-xs text-muted-foreground max-w-xl">
                Each character pops in quickly from the bottom when their line starts (preview + final render).
              </p>
            </div>
            <Switch
              id="character-slide-in"
              checked={draft?.characterSlideInEnabled !== false}
              disabled={isInitialState}
              onCheckedChange={(v) => {
                updateDraft({ characterSlideInEnabled: v });
                const projectId = draft?.id;
                if (projectId && isEditing) {
                  updateProject(projectId, { characterSlideInEnabled: v } as any).catch(() => {});
                }
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4">
            <div className="space-y-1">
              <Label htmlFor="character-slide-whoosh" className="text-sm font-medium">
                Whoosh on slide-in
              </Label>
              <p className="text-xs text-muted-foreground max-w-xl">
                Play a short swoosh when each character enters (preview + final video). Requires slide-in above.
              </p>
            </div>
            <Switch
              id="character-slide-whoosh"
              checked={draft?.characterSlideInWhooshEnabled === true}
              disabled={isInitialState || draft?.characterSlideInEnabled === false}
              onCheckedChange={(v) => {
                updateDraft({ characterSlideInWhooshEnabled: v });
                const projectId = draft?.id;
                if (projectId && isEditing) {
                  updateProject(projectId, { characterSlideInWhooshEnabled: v } as any).catch(() => {});
                }
              }}
            />
          </div>
          {/* Character Size Controls */}
          {draft?.characters?.A || draft?.characters?.B ? (() => {
            // Initialize default sizes for custom characters if they don't exist
            const defaultSizes: Record<string, { width: number; height: number }> = {
                Peter: { width: 400, height: 500 },
                Stewie: { width: 350, height: 450 },
              Rick: { width: 800, height: 1000 },
                Brian: { width: 350, height: 450 },
              Morty: { width: 560, height: 720 },
            };
            
            // Default size for custom characters
            const DEFAULT_CUSTOM_SIZE = { width: 400, height: 500 };
            
            // Merge existing characterSizes with defaults for selected characters
            const initializedSizes: Record<string, { width: number; height: number }> = {
              ...draft?.characterSizes || {},
            };
            
            // Ensure selected characters have sizes
            [draft?.characters?.A?.name, draft?.characters?.B?.name]
              .filter(Boolean)
              .forEach((charName) => {
                if (charName && !initializedSizes[charName]) {
                  initializedSizes[charName] = defaultSizes[charName] || DEFAULT_CUSTOM_SIZE;
                }
              });
            
            // Initialize default positions for custom characters
            const defaultPositions: Record<string, 'left' | 'right' | 'center'> = {
              Peter: 'left',
              Stewie: 'right',
              Rick: 'left',
              Brian: 'right',
              Morty: 'right',
            };
            
            const DEFAULT_CUSTOM_POSITION: 'left' | 'right' = 'left'; // Default to left for custom characters
            
            const initializedPositions: Record<string, 'left' | 'right' | 'center'> = {
              ...draft?.characterPositions || {},
            };
            
            // Ensure selected characters have positions
            [draft?.characters?.A?.name, draft?.characters?.B?.name]
              .filter(Boolean)
              .forEach((charName, index) => {
                if (charName && !initializedPositions[charName]) {
                  // Alternate positions: first character left, second right
                  initializedPositions[charName] = defaultPositions[charName] || (index === 0 ? 'left' : 'right');
                }
              });
            
            return (
              <CharacterSizeControls
                characterSizes={initializedSizes}
              onCharacterSizesChange={(sizes) => {
                updateDraft({ characterSizes: sizes });
                // Auto-save to project if it exists
                const projectId = draft?.id;
                if (projectId && isEditing) {
                  updateProject(projectId, { characterSizes: sizes } as any).catch(() => {});
                }
              }}
                characterPositions={initializedPositions}
              onCharacterPositionsChange={(positions) => {
                updateDraft({ characterPositions: positions });
                // Auto-save to project if it exists
                const projectId = draft?.id;
                if (projectId && isEditing) {
                  updateProject(projectId, { characterPositions: positions } as any).catch(() => {});
                }
              }}
              selectedCharacters={[
                draft?.characters?.A?.name,
                draft?.characters?.B?.name,
              ].filter(Boolean) as string[]}
              defaultExpanded={isCharacterSettingsExpanded}
              disabled={isInitialState}
            />
            );
          })() : null}
          
          {/* Beta Notice for Subtitles */}
          {captionsGenerated && (
            <Alert className="rounded-2xl border-blue-200 bg-blue-50/50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900 font-semibold">Subtitles Feature (Beta)</AlertTitle>
              <AlertDescription className="text-blue-800 mt-1">
                Our subtitles feature is currently in beta mode. To render without subtitles, use Delete all in the Subtitles editor; you can add subtitles in TikTok or Reels instead.
              </AlertDescription>
            </Alert>
          )}
          
        </div>
        )}

        {/* Collapsible Subtitles Section */}
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={() => setIsSubtitlesExpanded(!isSubtitlesExpanded)}
            disabled={isInitialState}
            className="w-full justify-between rounded-2xl"
          >
            <span className="font-medium">Subtitles & Styling</span>
            {isSubtitlesExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          
          {isSubtitlesExpanded && (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                {captionsGenerated && (
                <SubtitlesEditor
                  value={subtitleText}
                  onChange={(value) => {
                    if (!isInitialState) {
                    updateDraft({ srtText: value });
                    }
                  }}
                  onReset={handleResetSubtitles}
                  segments={subtitleSegments}
                />
                )}
              </div>
              <div className="space-y-4">
                <SubtitleStyleSelector
                  value={draft?.subtitleStyle || "bold-green"}
                  onChange={(style) => {
                    if (!isInitialState) {
                    updateDraft({ subtitleStyle: style });
                    toast.success(`Subtitle style: ${style.replace("-", " ")}`);
                    }
                  }}
                  fontSize={draft?.subtitleFontSize ?? 100}
                  onFontSizeChange={(size) => {
                    if (!isInitialState) {
                    updateDraft({ subtitleFontSize: size });
                    }
                  }}
                  fontFamily={draft?.subtitleFontFamily || 'bebas-neue'}
                  onFontFamilyChange={(font) => {
                    if (!isInitialState) {
                    updateDraft({ subtitleFontFamily: font });
                    const fontNames: Record<string, string> = {
                      'bebas-neue': 'Bebas Neue',
                      'impact': 'Impact',
                      'montserrat': 'Montserrat',
                      'poppins': 'Poppins',
                      'futura': 'Futura',
                      'roboto': 'Roboto',
                      'inter': 'Inter',
                      'zy-resolve': 'ZY Resolve',
                    };
                    toast.success(`Font: ${fontNames[font] || 'Bebas Neue'}`);
                    }
                  }}
                  singleLine={draft?.subtitleSingleLine ?? false}
                  onSingleLineChange={(v) => {
                    if (!isInitialState) {
                    updateDraft({ subtitleSingleLine: v });
                    }
                  }}
                  singleWord={draft?.subtitleSingleWord ?? false}
                  onSingleWordChange={(v) => {
                    if (!isInitialState) {
                    updateDraft({ subtitleSingleWord: v });
                    }
                  }}
                  karaokePillColor={draft?.karaokePillColor || '#E96BA8'}
                  onKaraokePillColorChange={(color) => {
                    if (!isInitialState) {
                    updateDraft({ karaokePillColor: color });
                    }
                  }}
                  boldGreenColor={draft?.boldGreenColor || '#63E443'}
                  onBoldGreenColorChange={(color) => {
                    if (!isInitialState) {
                    updateDraft({ boldGreenColor: color });
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" className="rounded-2xl" onClick={() => router.push("/app/create/two-char/background")}>
            Back
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={handleSaveDraft} disabled={isInitialState}>
            Save draft
          </Button>
        </div>
      </div>

      {/* Render Wait Game - Show during preview or final rendering */}
      <RenderWaitGame
        open={
          (isGeneratingPreview && (status === "QUEUED" || status === "RENDERING" || status === null)) ||
          (isRenderingFinal && (status === "QUEUED" || status === "RENDERING" || status === null))
        }
        title={
          isRenderingFinal
            ? "Rendering your final video..."
            : "Generating your preview..."
        }
        description={
          isRenderingFinal
            ? "This may take a few minutes. Play a game while you wait!"
            : "This may take a few minutes. Play a game while you wait!"
        }
        showRenderQueueButton={isRenderingFinal}
      />

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        open={isSaveTemplateOpen}
        onOpenChange={setIsSaveTemplateOpen}
        onSave={handleSaveTemplate}
        isLoading={isSavingTemplate}
        variant="two-char"
      />
    </div>
  );
}
