"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/create/stepper";
import { SubtitlesEditor } from "@/components/create/subtitles-editor";
import { SubtitleStyleSelector } from "@/components/create/subtitle-style-selector";
import { TikTokVideoEditor } from "@/components/create/tiktok-video-editor";
import { useProjectStore } from "@/lib/stores/project-store";
import { parseSrtText } from "@/lib/utils/srt";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";

const steps = [
  { label: "Step 1", description: "Write narration" },
  { label: "Step 2", description: "Choose background" },
  { label: "Step 3", description: "Preview & render" },
];

export default function StoryPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditing = searchParams.get("editing") === "true";
  const {
    draft,
    updateDraft,
    updateProject,
    createProjectFromDraft,
    loadProjectIntoDraft,
    projects,
  } = useProjectStore();

  // Debug: Log draft state when it changes
  useEffect(() => {
    console.log("📋 Story Preview Page - Draft state:", {
      id: draft?.id,
      previewUrl: draft?.previewUrl,
      finalUrl: draft?.finalUrl,
      status: draft?.status,
      isEditing,
    });
  }, [draft?.id, draft?.previewUrl, draft?.finalUrl, draft?.status, isEditing]);

  // Only redirect if draft is loaded but missing required fields
  // Don't redirect if we're editing an existing project (it already has a preview)
  // Don't redirect if draft is still loading (null/undefined)
  useEffect(() => {
    // Skip redirect check if we're editing an existing project with a preview
    if (isEditing && draft?.previewUrl) {
      console.log("✅ Editing mode with preview URL - skipping redirect check");
      return;
    }
    
    // If editing but draft doesn't have previewUrl yet, try to load it from projects list
    if (isEditing && draft?.id && !draft?.previewUrl) {
      const projectInList = projects.find(p => p.id === draft.id);
      if (projectInList?.previewUrl || projectInList?.finalUrl) {
        console.log("🔄 Found project in list, updating draft with URLs:", {
          previewUrl: projectInList.previewUrl,
          finalUrl: projectInList.finalUrl,
        });
        updateDraft({
          previewUrl: projectInList.previewUrl || null,
          finalUrl: projectInList.finalUrl || null,
          status: projectInList.status || draft.status,
        });
      }
    }
    
    // Wait a bit to ensure draft is loaded from store
    const timer = setTimeout(() => {
      if (draft && !draft?.scriptInput?.trim()) {
        console.warn("⚠️ Missing scriptInput, redirecting to script page");
        toast.info("Write narration before generating a preview.");
        router.replace("/app/create/story/script");
        return;
      }
      if (draft && !draft?.backgroundId) {
        console.warn("⚠️ Missing backgroundId, redirecting to background page");
        toast.info("Choose a background before previewing.");
        router.replace("/app/create/story/background");
        return;
      }
    }, 100); // Small delay to allow draft to load
    
    return () => clearTimeout(timer);
  }, [draft?.scriptInput, draft?.backgroundId, router, draft, isEditing, draft?.previewUrl]);

  const subtitleText = draft?.srtText ?? "";
  const [showSubtitles, setShowSubtitles] = useState(draft?.subtitleEnabled ?? true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  
  useEffect(() => {
    if (draft?.subtitleEnabled !== undefined) {
      setShowSubtitles(draft.subtitleEnabled);
    }
  }, [draft?.subtitleEnabled]);

  const subtitleSegments = useMemo(() => {
    const segments = parseSrtText(subtitleText);
    return segments;
  }, [subtitleText, showSubtitles]);
  
  const status = draft?.status ?? null;
  
  // Calculate progress value for progress bar
  const progressValue = useMemo(() => {
    if (status === "READY" && draft?.finalUrl) return 100;
    if (status === "RENDERING") return isRenderingFinal ? Math.min(renderProgress, 95) : (draft?.renderProgress ?? 50);
    if (status === "FAILED") return 0;
    return 0;
  }, [status, isRenderingFinal, renderProgress, draft?.renderProgress, draft?.finalUrl]);

  // Memoize playback rate change handler to prevent infinite loops
  const handlePlaybackRateChange = useCallback((rate: number) => {
    updateDraft({ playbackRate: rate });
  }, [updateDraft]);

  const handleGeneratePreview = async () => {
    console.log("🎬 handleGeneratePreview called", { 
      hasDraft: !!draft,
      scriptInput: draft?.scriptInput?.substring(0, 50),
      backgroundId: draft?.backgroundId,
      status: draft?.status
    });
    
    if (!draft) {
      console.error("❌ No draft found - draft is null/undefined");
      toast.error("No draft found. Please start over.");
      return;
    }
    
    if (!draft.scriptInput || !draft.scriptInput.trim()) {
      console.error("❌ No script input", { scriptInput: draft.scriptInput });
      toast.error("Please write narration first");
      // Redirect to script page
      router.push("/app/create/story/script");
      return;
    }
    
    if (!draft.backgroundId) {
      console.error("❌ No background selected", { backgroundId: draft.backgroundId });
      toast.error("Please select a background first");
      // Redirect to background page
      router.push("/app/create/story/background");
      return;
    }
    
    try {
      console.log("🚀 Starting preview generation...");
      setIsGenerating(true);
      setRenderProgress(0);
      toast.info("Generating story narration video...");
      
      // Get auth token with timeout and localStorage fallback
      console.log("🔐 Getting auth token...");
      
      let token: string | null = null;
      
      // Try 1: Read directly from localStorage (faster)
      try {
        const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
        if (supabaseProjectRef) {
          const storageKey = `sb-${supabaseProjectRef}-auth-token`;
          const data = localStorage.getItem(storageKey);
          if (data) {
            const parsed = JSON.parse(data);
            token = parsed?.access_token;
            if (token) {
              console.log("✅ Auth token from localStorage");
            }
          }
        }
      } catch (e) {
        console.log("⚠️ Failed to get token from localStorage:", e);
      }
      
      // Try 2: Use async getSession (with timeout) if localStorage didn't work
      if (!token) {
        console.log("🔄 Trying getSession...");
        
        // Create timeout promise (3 seconds)
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn("⚠️ getSession timeout after 3 seconds");
            resolve(null);
          }, 3000);
        });
        
        // Create session promise
        const sessionPromise = supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error) {
            console.error("❌ Session error:", error);
            return null;
          }
          const sessionToken = session?.access_token || null;
          console.log("✅ Auth token from getSession:", sessionToken ? "Found" : "Not found");
          return sessionToken;
        }).catch((error) => {
          console.error("❌ getSession promise error:", error);
          return null;
        });
        
        // Race between session and timeout
        token = await Promise.race([sessionPromise, timeoutPromise]);
      }
      
      if (!token) {
        console.error("❌ No auth token available after all attempts");
        throw new Error("Please sign in to generate videos. Auth token could not be retrieved.");
      }
      
      console.log("✅ Auth token ready");
      
      // Parse narration lines from scriptInput
      const narrationLines = draft.scriptInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      
      console.log("📝 Narration lines:", narrationLines);
      console.log("🎥 Background ID:", draft.backgroundId || "mine_2_cfr");
      console.log("🌐 Server URL:", config.remotionServerUrl);
      
      const requestBody = {
        script: narrationLines.join("\n"),
        backgroundId: draft.backgroundId || "mine_2_cfr",
        subtitleCustomizations: {
          style: draft.subtitleStyle || "classic",
          position: draft.subtitlePosition || { x: 50, y: 85 },
          fontSize: draft.subtitleFontSize || 100,
          singleLine: draft.subtitleSingleLine ?? false,
          singleWord: draft.subtitleSingleWord ?? false,
        },
        textOverlays: draft.textOverlays || [], // Send text overlays
        imageOverlays: draft.imageOverlays || [], // Send image overlays
      };
      
      console.log("📤 Sending request:", requestBody);
      
      // Call the story narration endpoint
      const response = await fetch(
        `${config.remotionServerUrl}/api/projects/story/render`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      console.log("📥 Response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response error:", errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `Server error: ${response.status}` };
        }
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Response data:", data);
      
      // Generate SRT text from narrations
      const srtLines = data.narrations.map((narration: any) => {
        return `${narration.startMs},${narration.endMs},Narrator,${narration.text}`;
      });
      const generatedSrtText = srtLines.join("\n");
      
      // Construct full video URL
      // If videoUrl is already a full URL (Supabase), use it directly
      // Otherwise, prepend the server URL
      const fullVideoUrl = data.videoUrl.startsWith('http') 
        ? data.videoUrl 
        : `${config.remotionServerUrl}${data.videoUrl}`;
      console.log("🎥 Video generated:", {
        videoUrl: data.videoUrl,
        fullVideoUrl,
        isSupabaseUrl: data.videoUrl.startsWith('http'),
        durationSec: data.durationSec,
      });
      
      // Update draft with video URL and subtitles first
      updateDraft({
        previewUrl: fullVideoUrl,
        status: "READY",
        durationSec: data.durationSec,
        srtText: generatedSrtText,
        originalSrtText: generatedSrtText, // Save original for reset functionality
        subtitleEnabled: true,
      });
      
      console.log("✅ Draft updated with preview URL");
      
      // Create project in database if it doesn't exist yet
      // This allows "Save Draft" to work properly
      try {
        const currentDraft = useProjectStore.getState().draft;
        const existingProject = currentDraft.id 
          ? useProjectStore.getState().projects.find(p => p.id === currentDraft.id)
          : null;
        
        // Only create if project doesn't exist yet
        if (!existingProject && !currentDraft.id?.startsWith('mock-')) {
          console.log("📝 Creating project in database for Story Narration...");
          
          // Ensure draft has a title (use script input as title if not set)
          if (!currentDraft.title || currentDraft.title === "Untitled Conversation") {
            const firstLine = draft?.scriptInput?.split('\n')?.[0]?.trim() || "Untitled Story";
            updateDraft({ title: firstLine.substring(0, 50) }); // Limit title length
          }
          
          // Ensure draft has correct type (use STORY_NARRATION if available, otherwise keep existing type)
          // Note: ProjectType might not include "story", so we'll keep the existing type
          // The backend will handle the type correctly
          
          // Get user ID from auth
          const session = await supabase.auth.getSession();
          const userId = session.data.session?.user?.id || "mock-user";
          
          // Create project (this will save overlays and subtitle settings)
          const newProject = await createProjectFromDraft(userId);
          
          if (newProject) {
            console.log("✅ Project created in database:", newProject.id);
            
            // Update draft with project ID and preview URL
            updateDraft({
              id: newProject.id,
              previewUrl: fullVideoUrl,
              status: "READY",
              durationSec: data.durationSec,
            });
            
            // Update project with preview URL
            await updateProject(newProject.id, {
              previewUrl: fullVideoUrl,
              durationSec: data.durationSec,
              srtText: generatedSrtText,
              textOverlays: draft?.textOverlays || [],
              imageOverlays: draft?.imageOverlays || [],
              subtitleStyle: draft?.subtitleStyle,
              subtitlePosition: draft?.subtitlePosition,
              subtitleFontSize: draft?.subtitleFontSize,
              subtitleEnabled: true,
              playbackRate: draft?.playbackRate || 1,
            } as any);
            
            console.log("✅ Project updated with preview URL and all settings");
          }
        } else {
          console.log("ℹ️ Project already exists or using mock ID, skipping creation");
        }
      } catch (createError) {
        console.error("⚠️ Failed to create project in database:", createError);
        // Don't fail the preview generation - project can be created later
      }
      
      setRenderProgress(100);
      toast.success("Story narration video generated successfully! 🎉");
    } catch (error) {
      console.error("❌ Preview generation error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to generate video. Make sure the video server is running.";
      toast.error(errorMessage);
      setIsGenerating(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRenderFinal = async () => {
    console.log("🔘 handleRenderFinal called", { status, videoUrl, draft, isEditing });
    
    // In edit mode, allow final render if previewUrl exists, even if status isn't READY
    // For new projects, still require READY status or videoUrl
    const hasPreview = !!videoUrl || !!draft?.previewUrl;
    const canRender = isEditing ? hasPreview : (hasPreview || status === "READY");
    
    if (!canRender) {
      console.warn("⚠️ No preview URL available:", { videoUrl, previewUrl: draft?.previewUrl, status });
      toast.info("Generate a preview first.");
      return;
    }
    
    try {
      console.log("🚀 Starting final render...");
      setIsRenderingFinal(true);
      setRenderProgress(0);
      updateDraft({ status: "RENDERING" });
      toast.info("Rendering final video with customizations...");
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setRenderProgress((prev) => {
          if (prev >= 90) return prev; // Don't go to 100% until done
          return prev + Math.random() * 15; // Increment by 0-15%
        });
      }, 500);
      
      // Get auth token with timeout and localStorage fallback
      console.log("🔐 Getting auth token...");
      
      let token: string | null = null;
      
      // Try 1: Read directly from localStorage (faster)
      try {
        const supabaseProjectRef = config.supabaseUrl?.split('.')[0]?.split('//')[1];
        if (supabaseProjectRef) {
          const storageKey = `sb-${supabaseProjectRef}-auth-token`;
          const data = localStorage.getItem(storageKey);
          if (data) {
            const parsed = JSON.parse(data);
            token = parsed?.access_token;
            if (token) {
              console.log("✅ Auth token from localStorage");
            }
          }
        }
      } catch (e) {
        console.log("⚠️ Failed to get token from localStorage:", e);
      }
      
      // Try 2: Use async getSession (with timeout) if localStorage didn't work
      if (!token) {
        console.log("🔄 Trying getSession...");
        
        // Create timeout promise (3 seconds)
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.warn("⚠️ getSession timeout after 3 seconds");
            resolve(null);
          }, 3000);
        });
        
        // Create session promise
        const sessionPromise = supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error) {
            console.error("❌ Session error:", error);
            return null;
          }
          const sessionToken = session?.access_token || null;
          console.log("✅ Auth token from getSession:", sessionToken ? "Found" : "Not found");
          return sessionToken;
        }).catch((error) => {
          console.error("❌ getSession promise error:", error);
          return null;
        });
        
        // Race between session and timeout
        token = await Promise.race([sessionPromise, timeoutPromise]);
      }
      
      if (!token) {
        console.error("❌ No auth token available after all attempts");
        throw new Error("Please sign in to render videos. Auth token could not be retrieved.");
      }
      
      console.log("✅ Auth token ready");
      
      if (!draft?.scriptInput?.trim()) {
        console.error("❌ No script input in draft");
        throw new Error("No narration script found");
      }
      
      const narrationLines = draft.scriptInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      
      const playbackRate = draft.playbackRate || 1;
      console.log("🎬 Rendering final video with playback rate:", playbackRate);
      console.log("📝 Narration lines:", narrationLines.length);
      console.log("📝 Subtitle text length:", subtitleText?.length || 0);
      console.log("🌐 Server URL:", config.remotionServerUrl);
      
      const requestBody = {
        script: narrationLines.join("\n"),
        backgroundId: draft.backgroundId || "mine_2_cfr",
        subtitleCustomizations: {
          style: draft.subtitleStyle || "classic",
          position: draft.subtitlePosition || { x: 50, y: 85 },
          fontSize: draft.subtitleFontSize || 100,
          singleLine: draft.subtitleSingleLine ?? false,
          singleWord: draft.subtitleSingleWord ?? false,
        },
        srtText: subtitleText,
        playbackRate: playbackRate, // Send playback rate for final render
        textOverlays: draft.textOverlays || [], // Send text overlays
        imageOverlays: draft.imageOverlays || [], // Send image overlays
      };
      
      console.log("📤 Sending final render request:", {
        url: `${config.remotionServerUrl}/api/projects/story/render`,
        hasSrtText: !!requestBody.srtText,
        srtTextLength: requestBody.srtText?.length || 0,
        scriptLines: narrationLines.length,
        playbackRate: requestBody.playbackRate,
      });
      
      const response = await fetch(
        `${config.remotionServerUrl}/api/projects/story/render`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );
      
      console.log("📥 Response status:", response.status, response.statusText);

      if (!response.ok) {
        clearInterval(progressInterval);
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Complete progress
      clearInterval(progressInterval);
      setRenderProgress(100);
      
      // Small delay to show 100%
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Construct full video URL (handle Supabase URLs)
      const finalVideoUrl = data.videoUrl.startsWith('http') 
        ? data.videoUrl 
        : `${config.remotionServerUrl}${data.videoUrl}`;
      
      updateDraft({
        finalUrl: finalVideoUrl,
        status: "READY",
        renderProgress: 100,
      });
      
      setIsRenderingFinal(false);
      setRenderProgress(0);
      toast.success("Final video rendered successfully! 🎬");
    } catch (error) {
      console.error("Final render error:", error);
      setIsRenderingFinal(false);
      setRenderProgress(0);
      updateDraft({ status: "FAILED" });
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to render final video."
      );
    }
  };

  const handleSaveDraft = async () => {
    // Update draft locally first
    updateDraft({
      srtText: subtitleText,
      subtitleEnabled: showSubtitles,
    });
    
    console.log("💾 Save draft clicked");
    console.log("💾 Draft ID:", draft?.id);
    console.log("💾 Preview URL:", draft?.previewUrl);
    console.log("💾 Text overlays:", draft?.textOverlays);
    console.log("💾 Text overlays count:", draft?.textOverlays?.length || 0);
    console.log("💾 Image overlays count:", draft?.imageOverlays?.length || 0);
    console.log("💾 Subtitle style:", draft?.subtitleStyle);
    console.log("💾 Subtitle position:", draft?.subtitlePosition);
    console.log("💾 Subtitle fontSize:", draft?.subtitleFontSize);
    console.log("💾 Playback rate:", draft?.playbackRate);
    
    // Check if project exists in database
    // Project exists if: 1) previewUrl exists (project was created during preview generation), OR
    // 2) draft.id exists in projects list (another way to verify it's a database project)
    const projectExists = !!draft?.previewUrl;
    const projects = useProjectStore.getState().projects;
    const projectInList = draft?.id ? projects.find(p => p.id === draft.id) : null;
    const hasDatabaseProject = projectExists || !!projectInList;
    
    // Save to database if project exists (either created during preview or loaded from database)
    if (draft?.id && hasDatabaseProject) {
      try {
        console.log("💾 Attempting to save to database...");
        // IMPORTANT: Preserve previewUrl and finalUrl when saving
        await updateProject(draft.id, {
          status: 'DRAFT', // Set status to DRAFT so backend knows to preserve audio
          srtText: subtitleText,
          textOverlays: draft.textOverlays || [],
          imageOverlays: draft.imageOverlays || [],
          subtitleStyle: draft.subtitleStyle,
          subtitlePosition: draft.subtitlePosition,
          subtitleFontSize: draft.subtitleFontSize,
          subtitleEnabled: showSubtitles,
          playbackRate: draft.playbackRate || 1,
          // Preserve video URLs - don't let them get overwritten
          previewUrl: draft.previewUrl, // Preserve preview URL
          finalUrl: draft.finalUrl, // Preserve final URL
          durationSec: draft.durationSec, // Preserve duration
        } as any);
        console.log("✅ Draft saved to database successfully");
        toast.success("Draft saved to database");
      } catch (error) {
        console.error("❌ Failed to save draft:", error);
        // Project might not exist or have permission issues - that's okay
        // Overlays and settings are in draft and will be saved on preview/finish
        toast.success("Draft saved locally");
      }
    } else {
      console.log("ℹ️ Not saving to database - draft.id:", draft?.id, "hasPreviewUrl:", !!draft?.previewUrl, "projectInList:", !!projectInList);
      toast.success("Draft saved locally");
    }
  };

  const handleResetSubtitles = () => {
    // Restore original server-generated subtitles if available
    if (draft?.originalSrtText) {
      updateDraft({ srtText: draft.originalSrtText });
      toast.success("✅ Restored original audio-synced subtitles!");
    } else {
      // Generate from narrations if original not available
      const narrationLines = draft?.scriptInput
        ?.split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0) || [];
      
      if (narrationLines.length > 0 && draft?.durationSec) {
        // Generate simple subtitle segments from narrations
        const durationPerLine = (draft.durationSec * 1000) / narrationLines.length;
        const srtLines = narrationLines.map((line, index) => {
          const startMs = Math.round(index * durationPerLine);
          const endMs = Math.round((index + 1) * durationPerLine);
          return `${startMs},${endMs},Narrator,${line}`;
        });
        updateDraft({ srtText: srtLines.join("\n") });
        toast.info("Generated subtitles from narration lines");
      }
    }
  };

  const videoUrl = draft?.finalUrl || draft?.previewUrl;
  
  // Debug: log video URL
  useEffect(() => {
    if (videoUrl) {
      console.log("🎥 Story Preview - Video URL:", {
        videoUrl,
        previewUrl: draft?.previewUrl,
        finalUrl: draft?.finalUrl,
        status,
      });
    }
  }, [videoUrl, draft?.previewUrl, draft?.finalUrl, status]);

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={2} />
      
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Preview & Edit</h1>
          <p className="text-sm text-muted-foreground">
            Generate your story narration video and customize subtitles.
          </p>
        </header>

        {isGenerating && (
          <div className="space-y-2">
            <Progress value={renderProgress} className="w-full" />
            <p className="text-xs text-muted-foreground">Generating video...</p>
          </div>
        )}

        {/* TikTok-Style Editor with Video Player */}
        <div className="space-y-4">
          <TikTokVideoEditor
            videoUrl={videoUrl}
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
            onPlaybackRateChange={handlePlaybackRateChange}
            subtitleSingleLine={draft?.subtitleSingleLine ?? false}
            subtitleSingleWord={draft?.subtitleSingleWord ?? false}
          />
          
          {/* Subtitle Toggle */}
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
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <SubtitlesEditor
              value={subtitleText}
              onChange={(value) => {
                updateDraft({ srtText: value });
              }}
              onReset={handleResetSubtitles}
              segments={subtitleSegments}
            />
          </div>
          <div className="space-y-4">
            <SubtitleStyleSelector
              value={draft?.subtitleStyle || "classic"}
              onChange={(style) => {
                updateDraft({ subtitleStyle: style });
                toast.success(`Subtitle style: ${style.replace("-", " ")}`);
              }}
              fontSize={draft?.subtitleFontSize || 100}
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

        {/* Action Buttons & Progress */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="rounded-2xl"
              onClick={() => router.push("/app/create/story/background")}
            >
              Back
            </Button>
            {!videoUrl && (
              <Button
                className="rounded-2xl flex-1"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("🔘 Generate Preview button clicked", {
                    hasDraft: !!draft,
                    scriptInput: draft?.scriptInput?.substring(0, 30),
                    backgroundId: draft?.backgroundId,
                    isGenerating,
                  });
                  
                  // Double-check conditions before calling
                  if (!draft) {
                    console.error("❌ Draft is null when button clicked");
                    toast.error("Draft not loaded. Please refresh the page.");
                    return;
                  }
                  
                  if (!draft.scriptInput?.trim()) {
                    console.error("❌ No script input when button clicked");
                    toast.error("Please write narration first");
                    router.push("/app/create/story/script");
                    return;
                  }
                  
                  await handleGeneratePreview();
                }}
                disabled={isGenerating || !draft?.scriptInput?.trim() || !draft?.backgroundId}
                type="button"
              >
                {isGenerating ? "Generating..." : "Generate Preview"}
              </Button>
            )}
            {/* Show Render Final button if preview exists (in edit mode) or status is READY */}
            {((isEditing && (draft?.previewUrl || videoUrl)) || (videoUrl && status !== "RENDERING")) && !isRenderingFinal && (
              <Button
                className="rounded-2xl flex-1"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("🔘 Render Final button clicked", { 
                    status, 
                    videoUrl, 
                    previewUrl: draft?.previewUrl,
                    hasDraft: !!draft,
                    scriptInput: draft?.scriptInput?.substring(0, 30),
                    subtitleText: subtitleText?.substring(0, 30),
                  });
                  
                  // Double-check conditions before calling
                  if (!draft) {
                    console.error("❌ Draft is null when button clicked");
                    toast.error("Draft not loaded. Please refresh the page.");
                    return;
                  }
                  
                  if (!draft.scriptInput?.trim()) {
                    console.error("❌ No script input when button clicked");
                    toast.error("No narration script found");
                    router.push("/app/create/story/script");
                    return;
                  }
                  
                  if (!subtitleText?.trim()) {
                    console.warn("⚠️ No subtitle text - will generate from narrations");
                  }
                  
                  await handleRenderFinal();
                }}
                disabled={isRenderingFinal || !draft?.scriptInput?.trim()}
                type="button"
              >
                {draft?.finalUrl ? "Re-render Final Video" : "Render Final Video"}
              </Button>
            )}
            {videoUrl && status !== "RENDERING" && !isRenderingFinal && (
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={handleSaveDraft}
              >
                Save Draft
              </Button>
            )}
            {status === "READY" && draft?.finalUrl && (
              <Button
                variant="default"
                className="rounded-2xl"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = draft.finalUrl || "";
                  link.download = `story-narration-${draft.id || 'video'}.mp4`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  toast.success("Download started!");
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            )}
          </div>
          
          {/* Progress Bar for Final Rendering */}
          {(status === "RENDERING" || isRenderingFinal) && (
            <div className="space-y-2 rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rendering Final Video</span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progressValue)}%
                </span>
              </div>
              <Progress value={progressValue} className="h-2 w-full" />
              <p className="text-xs text-muted-foreground">
                {progressValue < 100 
                  ? "Processing video with subtitles and customizations..." 
                  : "Finalizing video..."}
              </p>
            </div>
          )}
          
          {/* Status Message */}
          {status === "READY" && draft?.finalUrl && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">
                ✅ Final video ready! Click Download to save.
              </p>
            </div>
          )}
          
          {status === "FAILED" && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                ❌ Rendering failed. Please try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

