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
import { Download } from "lucide-react";

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
  const {
    updateDraft,
    enqueuePreview,
    simulateRender,
    createProjectFromDraft,
    updateProject,
    unsubscribeFromRenderJob,
  } = useProjectStore();

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
    console.log("📝 Subtitle segments parsed:", {
      srtTextLength: subtitleText.length,
      segmentsCount: segments.length,
      firstSegment: segments[0],
      showSubtitles
    });
    return segments;
  }, [subtitleText, showSubtitles]);
  
  const status = draft?.status ?? null;

  // Debug: log status changes
  useEffect(() => {
    console.log("🔍 Draft status changed:", {
      status,
      queuePosition: draft?.queuePosition,
      estimatedWaitTime: draft?.estimatedWaitTime,
      renderProgress: draft?.renderProgress,
      draftId: draft?.id
    });
  }, [status, draft?.queuePosition, draft?.estimatedWaitTime, draft?.renderProgress, draft?.id]);

  // Cleanup: Unsubscribe from realtime updates when component unmounts
  useEffect(() => {
    return () => {
      console.log("🧹 Cleaning up render job subscription on unmount");
      unsubscribeFromRenderJob();
    };
  }, [unsubscribeFromRenderJob]);

  // Debug: log duration value
  useEffect(() => {
    console.log("🎥 Preview page - Draft duration:", {
      durationSec: draft?.durationSec,
      durationMs: (draft?.durationSec || 0) * 1000,
      previewUrl: draft?.previewUrl,
    });
  }, [draft?.durationSec, draft?.previewUrl]);

  const handleGeneratePreview = async () => {
    console.log("🎬 Generate Preview clicked");
    console.log("🎬 Draft:", draft);
    console.log("🎬 Draft script:", draft?.script);
    console.log("🎬 Draft script length:", draft?.script?.length);
    console.log("🎬 Is editing:", isEditing);
    console.log("🎬 Draft ID:", draft?.id);
    
    if (!draft?.script?.length) {
      console.error("❌ No script found in draft!");
      toast.error("Add at least two lines to preview the conversation.");
      return;
    }
    
    try {
      toast.info("Queuing video generation...");
      
      // Only pass project ID if we're editing AND it's a valid database project ID
      // For new projects, draft.id is a local UUID, so we pass undefined to trigger creation
      const projectId = (isEditing && draft?.id && draft?.previewUrl) ? draft.id : undefined;
      const userId = user?.id || undefined;
      
      console.log("🎬 Calling enqueuePreview with:", { projectId, userId });
      await enqueuePreview(projectId, userId);
      // Don't show success here - it will be shown when the job actually completes
    } catch (error) {
      console.error("Preview generation error:", error);
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
      console.error("Failed to generate captions:", error);
      toast.error("Failed to generate captions.");
    }
  };

  const handleRenderFinal = async () => {
    // In edit mode, allow final render if previewUrl exists, even if status isn't READY
    // For new projects, still require READY status
    const hasPreview = !!draft?.previewUrl;
    const canRender = isEditing ? hasPreview : (status === "READY");
    
    if (!canRender) {
      toast.info("Generate a preview first.");
      return;
    }
    
    try {
      toast.info("Starting final render with all customizations...");
      await simulateRender();
      toast.success("Final video rendered successfully! 🎬");
    } catch (error) {
      console.error("Final render error:", error);
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
    
    console.log("💾 Save draft clicked");
    console.log("💾 Draft ID:", draft?.id);
    console.log("💾 Is editing:", isEditing);
    console.log("💾 Preview URL:", draft?.previewUrl);
    console.log("💾 Text overlays:", draft?.textOverlays);
    console.log("💾 Text overlays count:", draft?.textOverlays?.length || 0);
    console.log("💾 Subtitle style:", draft?.subtitleStyle);
    console.log("💾 Subtitle position:", draft?.subtitlePosition);
    
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
        console.log("💾 Attempting to save to database...");
        await updateProject(draft.id, {
          status: 'DRAFT', // Set status to DRAFT so backend knows to preserve audio
          srtText: subtitleText,
          textOverlays: draft.textOverlays || [],
          imageOverlays: draft.imageOverlays || [],
          subtitleStyle: draft.subtitleStyle,
          subtitlePosition: draft.subtitlePosition,
          subtitleFontSize: draft.subtitleFontSize,
          subtitleEnabled: draft.subtitleEnabled,
          characterSizes: draft.characterSizes,
          characterPositions: draft.characterPositions,
          playbackRate: draft.playbackRate || 1,
        } as any);
        console.log("✅ Draft saved to database successfully");
        toast.success("Draft saved to database");
      } catch (error) {
        console.error("❌ Failed to save draft:", error);
        // Project might not exist or have permission issues - that's okay
        // Text overlays are in draft and will be saved on preview/finish
        toast.success("Draft saved locally");
      }
    } else {
      console.log("ℹ️ Not saving to database - draft.id:", draft?.id, "isEditing:", isEditing, "hasPreviewUrl:", !!draft?.previewUrl, "projectInList:", !!projectInList);
      toast.success("Draft saved locally");
    }
  };

  const handleFinish = async () => {
    console.log("🔵 handleFinish called");
    console.log("🔵 Draft state:", { 
      hasPreviewUrl: !!draft?.previewUrl, 
      title: draft?.title,
      hasCharacters: { A: !!draft?.characters?.A, B: !!draft?.characters?.B },
      scriptLength: draft?.script?.length 
    });
    console.log("🔵 User:", user);
    
    // Check if project already exists (created during preview generation)
    const existingProject = useProjectStore.getState().projects.find(
      p => p.title === draft?.title && 
      p.script.length === draft?.script?.length
    );
    
    if (existingProject) {
      // Project already exists, update it with latest text overlays before clearing
      console.log("✅ Project already saved during preview generation");
      try {
        await updateProject(existingProject.id, {
          textOverlays: draft.textOverlays || [],
          imageOverlays: draft.imageOverlays || [],
          srtText: subtitleText,
          characterSizes: draft.characterSizes,
          characterPositions: draft.characterPositions,
          playbackRate: draft.playbackRate || 1,
        } as any);
        console.log("✅ Updated existing project with text overlays");
      } catch (error) {
        console.error("⚠️ Failed to update existing project:", error);
        // Continue anyway - project exists
      }
      toast.success("Project saved to dashboard");
      useProjectStore.getState().clearDraft();
      router.push("/app/dashboard");
      return;
    }
    
    // Optional: Warn if no preview, but still allow saving
    if (!draft?.previewUrl) {
      console.log("⚠️ No preview URL, but proceeding anyway");
      toast.info("Saving project without preview video...");
    }
    
    try {
      console.log("🟢 Calling createProjectFromDraft...");
      console.log("🟢 Current draft text overlays:", draft?.textOverlays);
      console.log("🟢 Current draft subtitle text length:", subtitleText.length);
      toast.info("Saving project...");
      const created = await createProjectFromDraft(user?.id ?? "mock-user");
      
      console.log("🟢 createProjectFromDraft result:", created);
      
      if (created) {
        // Update the project with latest text overlays and subtitles
        // (in case they were modified after project creation)
        try {
          console.log("💾 Updating project with latest overlays and subtitles...");
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
            playbackRate: draft.playbackRate || 1,
          } as any);
          console.log("✅ Project updated with latest overlays and subtitles");
        } catch (updateError) {
          console.error("⚠️ Failed to update project with overlays:", updateError);
          // Continue anyway - project was created successfully
        }
        
        toast.success("Project added to dashboard");
        useProjectStore.getState().clearDraft();
        router.push("/app/dashboard");
      } else {
        console.error("❌ createProjectFromDraft returned null");
        toast.error("Failed to save project");
      }
    } catch (error) {
      console.error("❌ Error saving project:", error);
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
            disabled={status === "RENDERING" || status === "QUEUED"}
          >
            {status === "RENDERING" || status === "QUEUED" 
              ? "Generating TikTok/Reels..." 
              : status === "FAILED"
              ? "Retry Preview"
              : "Generate TikTok/Reels Preview"}
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
              disabled={status === "RENDERING"}
            >
              {captionsGenerated ? "Regenerate Captions" : "Generate Captions"}
            </Button>
          </div>
        )}
        {/* TikTok-Style Editor with Video Player */}
        <div className="space-y-4">
          <TikTokVideoEditor
            videoUrl={draft?.previewUrl}
            status={status}
            durationMs={(draft?.durationSec || 0) * 1000}
            textOverlays={draft?.textOverlays ?? []}
            onTextOverlaysChange={(overlays) => {
              // Only update draft, don't auto-save to database
              updateDraft({ textOverlays: overlays });
            }}
            imageOverlays={draft?.imageOverlays ?? []}
            onImageOverlaysChange={(overlays) => {
              // Only update draft, don't auto-save to database
              updateDraft({ imageOverlays: overlays });
            }}
            subtitles={subtitleSegments}
            showSubtitles={showSubtitles}
            subtitleStyle={draft?.subtitleStyle}
            subtitlePosition={draft?.subtitlePosition ?? { x: 50, y: 85 }}
            onSubtitlePositionChange={(position) => {
              updateDraft({ subtitlePosition: position });
            }}
            subtitleFontSize={draft?.subtitleFontSize ?? 100}
            onSubtitleFontSizeChange={(size) => {
              updateDraft({ subtitleFontSize: size });
            }}
            playbackRate={draft?.playbackRate ?? 1}
            onPlaybackRateChange={(rate) => {
              console.log("🎬 Playback rate changed:", rate);
              updateDraft({ playbackRate: rate });
            }}
            subtitleSingleLine={draft?.subtitleSingleLine ?? false}
            subtitleSingleWord={draft?.subtitleSingleWord ?? false}
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
                  updateProject(projectId, { characterSizes: sizes } as any).catch(console.error);
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
                  updateProject(projectId, { characterPositions: positions } as any).catch(console.error);
                }
              }}
              selectedCharacters={[
                draft?.characters?.A?.name,
                draft?.characters?.B?.name,
              ].filter(Boolean) as string[]}
            />
          ) : null}
          
          {/* Subtitle Toggle */}
          {captionsGenerated && (
          <div className="flex items-center justify-center gap-4 rounded-2xl border border-border/40 bg-white/70 p-4">
            <div className="flex items-center gap-3">
              <Switch 
                id="toggle-subtitles" 
                checked={showSubtitles} 
                onCheckedChange={(checked) => {
                  setShowSubtitles(checked);
                  updateDraft({ subtitleEnabled: checked });
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

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            {captionsGenerated && (
            <SubtitlesEditor
              value={subtitleText}
              onChange={(value) => {
                updateDraft({ srtText: value });
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
                updateDraft({ subtitleStyle: style });
                toast.success(`Subtitle style: ${style.replace("-", " ")}`);
              }}
              fontSize={draft?.subtitleFontSize ?? 100}
              onFontSizeChange={(size) => {
                updateDraft({ subtitleFontSize: size });
              }}
              singleLine={draft?.subtitleSingleLine ?? false}
              onSingleLineChange={(v) => {
                updateDraft({ subtitleSingleLine: v });
              }}
              singleWord={draft?.subtitleSingleWord ?? false}
              onSingleWordChange={(v) => {
                updateDraft({ subtitleSingleWord: v });
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" className="rounded-2xl" onClick={() => router.push("/app/create/two-char/background")}>
            Back
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={handleSaveDraft}>
            Save draft
          </Button>
          <Button 
            className="rounded-2xl px-6" 
            onClick={() => {
              console.log("🔴 FINISH BUTTON CLICKED!");
              handleFinish();
            }}
          >
            Finish
          </Button>
        </div>
      </div>
    </div>
  );
}
