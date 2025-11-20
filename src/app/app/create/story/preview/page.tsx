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
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { RenderWaitGame } from "@/components/create/RenderWaitGame";

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
    subscribeToRenderJob,
    unsubscribeFromRenderJob,
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
  const [isSubtitlesExpanded, setIsSubtitlesExpanded] = useState(false); // Initially closed
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  // Cleanup: Unsubscribe from realtime updates when component unmounts
  useEffect(() => {
    return () => {
      console.log("🧹 Cleaning up render job subscription on unmount");
      unsubscribeFromRenderJob();
    };
  }, [unsubscribeFromRenderJob]);
  
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

  // Reset generating state when render completes or fails
  useEffect(() => {
    if (status === "READY" || status === "FAILED") {
      if (isGenerating) {
        setIsGenerating(false);
      }
      if (isRenderingFinal) {
        setIsRenderingFinal(false);
      }
    }
  }, [status, isGenerating, isRenderingFinal]);

  // Calculate progress value for progress bar
  const progressValue = useMemo(() => {
    if (status === "READY" && draft?.finalUrl) return 100;
    if (status === "RENDERING") return isRenderingFinal ? Math.min(renderProgress, 95) : (draft?.renderProgress ?? 50);
    if (status === "QUEUED") return 20;
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

      const queueData = await response.json();
      console.log("✅ Queue response:", queueData);
      
      if (!queueData.success || !queueData.projectId) {
        throw new Error(queueData.error || "Failed to queue render job");
      }
      
      const storyProjectId = queueData.projectId;
      const renderJobId = queueData.render_job_id;
      
      // Update draft with queue status immediately and set the correct project ID
      // The worker will create the project with this ID, so we need to use it
      updateDraft({
        id: storyProjectId, // Use the project ID returned from the API
        status: "QUEUED" as const,
        queuePosition: queueData.queue_position,
        estimatedWaitTime: queueData.estimated_wait_time,
      });
      
      // Set up Supabase Realtime subscription for real-time updates
      if (renderJobId) {
        console.log("🔔 Setting up realtime subscription for job:", renderJobId, "project:", storyProjectId);
        subscribeToRenderJob(renderJobId, storyProjectId);
        
        // Skip initial status check for story narrations - project doesn't exist yet
        // The Realtime subscription will handle all status updates
        // Note: For story narrations, we skip the initial status check because:
        // 1. The project doesn't exist yet (created by worker after render)
        // 2. The API endpoint requires the project to exist
        // 3. Realtime subscription will handle all status updates anyway
        console.log("📡 Realtime subscription set up - status updates will come via Realtime");
      } else {
        console.warn("⚠️ No render_job_id returned, cannot set up Realtime subscription");
      }
      
      // Don't set isGenerating to false here - let it stay true so the game shows
      // The useEffect will reset it when status becomes READY or FAILED
    } catch (error) {
      console.error("❌ Preview generation error:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to generate video. Make sure the video server is running.";
      toast.error(errorMessage);
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
      
      // Check if project exists in database (story narrations create project after preview)
      // First, check if we have a project in the projects list (from store)
      const projects = useProjectStore.getState().projects;
      let projectId = draft?.id;
      
      // If draft.id doesn't exist or is a mock ID, try to find project by previewUrl
      if (!projectId || projectId.startsWith('mock-')) {
        // Try to find project by previewUrl in the projects list
        const projectByPreview = projects.find(p => p.previewUrl === draft?.previewUrl);
        if (projectByPreview) {
          projectId = projectByPreview.id;
          console.log("✅ Found project by previewUrl:", projectId);
          // Update draft with the correct project ID
          updateDraft({ id: projectId });
        } else {
          // If project doesn't exist yet, try to create it now
          if (draft?.previewUrl) {
            console.log("📝 Project not found, creating it now...");
            try {
              const session = await supabase.auth.getSession();
              const userId = session.data.session?.user?.id || "mock-user";
              
              if (!draft.title || draft.title === "Untitled Conversation") {
                const firstLine = draft?.scriptInput?.split('\n')?.[0]?.trim() || "Untitled Story";
                updateDraft({ title: firstLine.substring(0, 50) });
              }
              
              const newProject = await createProjectFromDraft(userId);
              if (newProject) {
                projectId = newProject.id;
                console.log("✅ Project created:", projectId);
                updateDraft({ id: projectId });
                
                // Update project with preview URL and settings
                await updateProject(projectId, {
                  previewUrl: draft.previewUrl,
                  durationSec: draft.durationSec || 0,
                  srtText: draft.srtText || '',
                  textOverlays: draft?.textOverlays || [],
                  imageOverlays: draft?.imageOverlays || [],
                  subtitleStyle: draft?.subtitleStyle,
                  subtitlePosition: draft?.subtitlePosition,
                  subtitleFontSize: draft?.subtitleFontSize,
                  subtitleEnabled: true,
                  playbackRate: draft?.playbackRate || 1,
                } as any);
              } else {
                throw new Error("Failed to create project. Please try again.");
              }
            } catch (createError) {
              console.error("❌ Failed to create project:", createError);
              throw new Error("Project not found. Please generate a preview first and wait for it to complete.");
            }
          } else {
            throw new Error("Project not found. Please generate a preview first.");
          }
        }
      }
      
      // Final check - ensure projectId is valid
      if (!projectId || projectId.startsWith('mock-')) {
        throw new Error("Project not found. Please generate a preview first.");
      }

      // Verify project exists in database before calling final render
      console.log("🔍 Verifying project exists in database:", projectId);
      try {
        const verifyResponse = await fetch(
          `${config.remotionServerUrl}/api/projects/${projectId}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
            },
          }
        );
        
        if (!verifyResponse.ok) {
          console.error("❌ Project verification failed:", verifyResponse.status);
          if (verifyResponse.status === 404) {
            throw new Error("Project not found in database. Please generate a preview first and wait for it to complete.");
          }
          throw new Error(`Failed to verify project: ${verifyResponse.status}`);
        }
        
        const projectData = await verifyResponse.json();
        console.log("✅ Project verified:", {
          id: projectData.project?.id,
          hasPreview: !!projectData.project?.preview_url,
          userId: projectData.project?.user_id
        });
        
        if (!projectData.project?.preview_url) {
          throw new Error("Project preview not found. Please generate a preview first.");
        }
      } catch (verifyError) {
        console.error("❌ Project verification error:", verifyError);
        if (verifyError instanceof Error) {
          throw verifyError;
        }
        throw new Error("Failed to verify project. Please try again.");
      }

      console.log("📤 Sending final render request:", {
        url: `${config.remotionServerUrl}/api/projects/${projectId}/render/final`,
        projectId,
        hasSrtText: !!requestBody.srtText,
        srtTextLength: requestBody.srtText?.length || 0,
        scriptLines: narrationLines.length,
        playbackRate: requestBody.playbackRate,
      });
      
      const response = await fetch(
        `${config.remotionServerUrl}/api/projects/${projectId}/render/final`,
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

      const queueData = await response.json();
      console.log("✅ Queue response:", queueData);
      
      if (!queueData.success || !queueData.render_job_id) {
        throw new Error(queueData.error || "Failed to queue final render job");
      }
      
      const renderJobId = queueData.render_job_id;
      
      // Update draft with queue status
      updateDraft({
        status: "QUEUED" as const,
        queuePosition: queueData.queue_position,
        estimatedWaitTime: queueData.estimated_wait_time,
      });
      
      // Stop the progress interval (we'll use Realtime for updates)
      clearInterval(progressInterval);
      
      // Set up Supabase Realtime subscription for final render updates
      if (renderJobId) {
        console.log("🔔 Setting up realtime subscription for final render job:", renderJobId, "project:", projectId);
        subscribeToRenderJob(renderJobId, projectId);
        
        // Also get initial status immediately
        try {
          const { getRenderJobStatus } = await import('@/lib/api/projects');
          const initialStatus = await getRenderJobStatus(projectId, renderJobId);
          if (initialStatus.render_job) {
            const job = initialStatus.render_job;
            const jobStatus = (job.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
            
            // Map backend status to frontend status
            let frontendStatus: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
            if (jobStatus === 'completed') {
              frontendStatus = 'READY';
            } else if (jobStatus === 'failed') {
              frontendStatus = 'FAILED';
            } else if (jobStatus === 'processing') {
              frontendStatus = 'RENDERING';
            } else {
              frontendStatus = 'QUEUED';
            }
            
            updateDraft({
              status: frontendStatus,
              renderProgress: job.progress || 0,
            });
            
            // If already completed, handle completion
            if (jobStatus === 'completed' && job.result_url) {
              const fullVideoUrl = job.result_url.startsWith('http') 
                ? job.result_url 
                : `${config.remotionServerUrl}${job.result_url}`;
              
              updateDraft({
                finalUrl: fullVideoUrl,
                status: "READY" as const,
                renderProgress: 100,
              });
              
              setIsRenderingFinal(false);
              setRenderProgress(0);
              toast.success("Final video rendered successfully! 🎬");
            }
          }
        } catch (statusError) {
          console.warn("⚠️ Failed to get initial status:", statusError);
          // Continue with Realtime subscription
        }
      } else {
        console.warn("⚠️ No render_job_id returned, cannot set up Realtime subscription");
      }
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
          subtitleSingleLine: draft.subtitleSingleLine ?? false,
          subtitleSingleWord: draft.subtitleSingleWord ?? false,
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

        {/* Collapsible Subtitles Section */}
        <div className="space-y-4">
          <Button
            variant="outline"
            onClick={() => setIsSubtitlesExpanded(!isSubtitlesExpanded)}
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
          )}
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
          
          {/* Queue Status */}
          {status === "QUEUED" && (
            <div className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">⏳ Video in Queue</span>
                <span className="text-sm text-blue-600">
                  Position #{draft?.queuePosition || '?'}
                </span>
              </div>
              <Progress value={20} className="h-2 w-full" />
              <p className="text-xs text-blue-700">
                {draft?.estimatedWaitTime 
                  ? `Estimated wait time: ${Math.round(draft.estimatedWaitTime / 60)} minutes`
                  : "Waiting in queue..."}
              </p>
            </div>
          )}
          
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

      {/* Render Wait Game - Show during preview or final rendering */}
      <RenderWaitGame
        open={
          (isGenerating && (status === "QUEUED" || status === "RENDERING" || status === null)) ||
          (isRenderingFinal && (status === "RENDERING" || status === null))
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

