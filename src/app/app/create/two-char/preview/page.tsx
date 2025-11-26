"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Download, ChevronDown, ChevronUp, Info } from "lucide-react";
import { RenderWaitGame } from "@/components/create/RenderWaitGame";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { config } from "@/lib/config";

const steps = [
  { label: "Step 1", description: "Pick two characters" },
  { label: "Step 2", description: "Write the script" },
  { label: "Step 3", description: "Choose gameplay background" },
  { label: "Step 4", description: "Preview & edit" },
];

export default function PreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get("editing") === "true";
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

  // Load project data when in edit mode
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  useEffect(() => {
    if (isEditing && draft?.id && !isLoadingProject) {
      // Check if we need to load project data (missing script, merged audio, background, or other critical data)
      const needsLoad = !draft?.script?.length || 
                        (!draft?.mergedAudioUrl && !draft?.previewUrl && !draft?.audioFiles?.length) || 
                        !draft?.srtText ||
                        !draft?.backgroundId;
      
      if (needsLoad) {
        // If we're editing but don't have complete project data loaded, load it
        setIsLoadingProject(true);
        loadProjectIntoDraft(draft.id)
          .then(() => {
            setIsLoadingProject(false);
          })
          .catch((error) => {
            toast.error("Failed to load project data");
            setIsLoadingProject(false);
          });
      }
    }
  }, [isEditing, draft?.id, draft?.script?.length, draft?.mergedAudioUrl, draft?.previewUrl, draft?.audioFiles?.length, draft?.srtText, draft?.backgroundId, isLoadingProject, loadProjectIntoDraft]);

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
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [isCharacterSettingsExpanded, setIsCharacterSettingsExpanded] = useState(false); // Initially collapsed
  
  // Check if preview has been generated (user can interact with controls)
  // Preview is ready if we have audioFiles (browser preview) OR previewUrl (rendered video)
  const hasPreview = !!draft?.previewUrl || (!!draft?.audioFiles && draft.audioFiles.length > 0);
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
  
  // Helper function to get background video URL
  const getBackgroundVideoUrl = (backgroundId: string | null | undefined): string | null => {
    if (!backgroundId) return null;
    const serverUrl = config.remotionServerUrl || "https://nofacevideo-0f67ae173a97.herokuapp.com";
    const backgroundMap: Record<string, string> = {
      minecraft: "mine_converted.mp4",
      subway: "Subway.mp4",
      mine_2_cfr: "mine_2_cfr.mp4",
    };
    const fileName = backgroundMap[backgroundId] || backgroundMap.mine_2_cfr;
    return `${serverUrl}/backgrounds/${fileName}`;
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
      
      await enqueuePreview(projectId, userId);
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

  const handleRenderFinal = async () => {
    // Check if project exists in edit mode
    if (isEditing && !draft?.id) {
      toast.error("Project not found. Please reload the page.");
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
        <div className="flex flex-wrap items-center gap-4 rounded-3xl border border-border/40 bg-white/70 p-5">
          <Button
            className="rounded-2xl"
            onClick={handleGeneratePreview}
            disabled={isGeneratingPreview || status === "RENDERING" || status === "QUEUED"}
          >
            {isGeneratingPreview
              ? "Generating Audio..."
              : status === "RENDERING" || status === "QUEUED" 
              ? "Generating..." 
              : status === "FAILED"
              ? "Retry Preview"
              : "Generate Preview"}
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={handleRenderFinal}
            disabled={status === "RENDERING" || status === "QUEUED"}
          >
            {status === "RENDERING" 
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
            playbackRate={draft?.playbackRate ?? 1}
            onPlaybackRateChange={(rate) => {
              if (!isInitialState) {
              updateDraft({ playbackRate: rate });
              }
            }}
            subtitleSingleLine={draft?.subtitleSingleLine ?? false}
            browserPreviewMode={!!(draft?.mergedAudioUrl || (draft?.audioFiles && draft.audioFiles.length > 0))}
            audioFiles={draft?.audioFiles || []}
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
          />
          {/* Character Size Controls */}
          {draft?.characters?.A || draft?.characters?.B ? (
            <CharacterSizeControls
              characterSizes={draft?.characterSizes || {
                Peter: { width: 400, height: 500 },
                Stewie: { width: 350, height: 450 },
                Rick: { width: 800, height: 1000 }, // 2x default size
                Brian: { width: 350, height: 450 },
                Morty: { width: 560, height: 720 }, // 2x default size, reduced by 20%
              }}
              onCharacterSizesChange={(sizes) => {
                updateDraft({ characterSizes: sizes });
                // Auto-save to project if it exists
                const projectId = draft?.id;
                if (projectId && isEditing) {
                  updateProject(projectId, { characterSizes: sizes } as any).catch(() => {});
                }
              }}
              characterPositions={draft?.characterPositions || {
                Peter: 'left',
                Stewie: 'right',
                Rick: 'left',
                Brian: 'right',
                Morty: 'right',
              }}
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
          ) : null}
          
          {/* Beta Notice for Subtitles */}
          {captionsGenerated && (
            <Alert className="rounded-2xl border-blue-200 bg-blue-50/50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900 font-semibold">Subtitles Feature (Beta)</AlertTitle>
              <AlertDescription className="text-blue-800 mt-1">
                Our subtitles feature is currently in beta mode. If you want to render your video without subtitles, keep the subtitles toggle OFF and use TikTok or Reels to generate subtitles instead.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Subtitle Toggle */}
          {captionsGenerated && (
          <div className="flex items-center justify-center gap-4 rounded-2xl border border-border/40 bg-white/70 p-4">
            <div className="flex items-center gap-3">
              <Switch 
                id="toggle-subtitles" 
                checked={showSubtitles} 
                disabled={isInitialState}
                onCheckedChange={(checked) => {
                  if (!isInitialState) {
                  setShowSubtitles(checked);
                  updateDraft({ subtitleEnabled: checked });
                  }
                }} 
              />
              <Label htmlFor="toggle-subtitles" className="text-sm font-medium cursor-pointer">
                {showSubtitles ? "Subtitles ON" : "Subtitles OFF"} · Drag subtitles to reposition
              </Label>
            </div>
            {subtitleSegments.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {subtitleSegments.length} subtitle{subtitleSegments.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
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
                  value={draft?.subtitleStyle || "classic"}
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
          <Button 
            className="rounded-2xl px-6" 
            onClick={handleFinish}
            disabled={isInitialState}
          >
            Finish
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
      />
    </div>
  );
}
