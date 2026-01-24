"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/create/stepper";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";
import { Play, Pause, RotateCcw, Download, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { IMessageTemplate } from "@/components/create/texting/imessage-template";
import type { TextingMessage, TextingVideoSettings } from "../script/page";
import { supabase } from "@/lib/supabase";

const steps = [
  { label: "Step 1", description: "Write your messages" },
  { label: "Step 2", description: "Customize settings" },
  { label: "Step 3", description: "Preview & render" },
];

export default function TextingPreviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");
  const { draft, updateDraft, loadProjectIntoDraft } = useProjectStore();
  const { user } = useAuthStore();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState<'QUEUED' | 'RENDERING' | 'READY' | 'FAILED' | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const renderJobSubscriptionRef = useRef<any>(null);

  // Load project data when projectId is in URL (edit mode)
  useEffect(() => {
    if (!projectIdFromUrl) return;
    
    // Check if we already have the correct project loaded
    const hasCorrectProject = draft?.id === projectIdFromUrl;
    const hasMessages = draft?.metadata?.messages && Array.isArray(draft.metadata.messages) && draft.metadata.messages.length > 0;
    
    // Only load if we don't have the project or are missing messages
    if (!hasCorrectProject || !hasMessages) {
      if (!isLoadingProject) {
        const loadProject = async () => {
          try {
            setIsLoadingProject(true);
            console.log("🔄 Loading texting video project:", projectIdFromUrl);
            await loadProjectIntoDraft(projectIdFromUrl);
            console.log("✅ Loaded texting video project:", projectIdFromUrl);
          } catch (error) {
            console.error("Failed to load project:", error);
            toast.error("Failed to load project. Please try again.");
          } finally {
            setIsLoadingProject(false);
          }
        };
        
        loadProject();
      }
    } else {
      console.log("✅ Project already loaded:", projectIdFromUrl);
    }
  }, [projectIdFromUrl, isLoadingProject, loadProjectIntoDraft, draft?.id, draft?.metadata?.messages]);

  // Get settings and messages from draft
  const textingSettings = useMemo<TextingVideoSettings>(() => {
    return (draft?.metadata as any)?.textingSettings || {
      contactName: "Willa",
      contactAvatar: "🎾",
      typingSpeed: 8,
      messageDelay: 500,
      keepKeyboardOpen: false,
    };
  }, [draft?.metadata]);
  
  // State for keep keyboard open toggle
  const [keepKeyboardOpen, setKeepKeyboardOpen] = useState(textingSettings.keepKeyboardOpen || false);
  
  // Update keepKeyboardOpen when textingSettings change
  useEffect(() => {
    setKeepKeyboardOpen(textingSettings.keepKeyboardOpen || false);
  }, [textingSettings.keepKeyboardOpen]);
  
  // Save keepKeyboardOpen setting to draft
  const handleKeepKeyboardOpenChange = async (checked: boolean) => {
    setKeepKeyboardOpen(checked);
    const updatedSettings = {
      ...textingSettings,
      keepKeyboardOpen: checked,
    };
    await updateDraft({
      metadata: {
        ...(draft?.metadata as any),
        textingSettings: updatedSettings,
      },
    });
  };

  // Parse messages from scriptInput if not in metadata
  useEffect(() => {
    const savedMessages = (draft?.metadata as any)?.messages || [];
    const uploadedImages = (draft?.metadata as any)?.uploadedImages || {}; // Get saved image mappings
    
    // If no messages in metadata but we have scriptInput, parse and save them
    if (savedMessages.length === 0 && draft?.scriptInput) {
      const lines = draft.scriptInput
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0);
      
      if (lines.length > 0) {
        let currentTime = 0;
        const parsedMessages: TextingMessage[] = [];
        
        lines.forEach((line: string, index: number) => {
          let sender: 'user' | 'contact' = 'user';
          let messageText = line;
          let needsTyping = true;
          let imageUrl: string | undefined = undefined;
          
          // Check for "me: " or "you: " tags (case insensitive)
          if (line.match(/^me:\s*/i)) {
            sender = 'user';
            messageText = line.replace(/^me:\s*/i, '');
            needsTyping = true;
          } else if (line.match(/^you:\s*/i)) {
            sender = 'contact';
            messageText = line.replace(/^you:\s*/i, '');
            needsTyping = false;
          } else if (line.startsWith('[USER]')) {
            sender = 'user';
            messageText = line.replace(/^\[USER\]\s*/, '');
            needsTyping = true;
          } else if (line.startsWith('[CONTACT]')) {
            sender = 'contact';
            messageText = line.replace(/^\[CONTACT\]\s*/, '');
            needsTyping = false;
          }
          
          // Check for image syntax: [image:url] or [image:imageId]
          const imageMatch = messageText.match(/\[image:(.+?)\]/i);
          if (imageMatch) {
            const imageRef = imageMatch[1];
            // Check if it's a URL or an image ID
            if (imageRef.startsWith('http://') || imageRef.startsWith('https://')) {
              imageUrl = imageRef;
            } else {
              // It's an image ID - look it up from saved images in metadata
              imageUrl = uploadedImages[imageRef] || imageRef; // Use saved URL or fallback to ID
            }
            // Remove the image syntax from text
            messageText = messageText.replace(/\[image:.+?\]/gi, '').trim();
            if (!messageText) {
              messageText = ''; // Image-only message
            }
          }
          
          // Calculate timing
          let messageDuration = 0;
          const SEND_BUTTON_DURATION = 300;
          const MESSAGE_APPEAR_DELAY = 150;
          
          if (imageUrl) {
            // Image messages: shorter duration
            messageDuration = 500 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
          } else if (needsTyping) {
            const typingDuration = (messageText.length / textingSettings.typingSpeed) * 1000;
            messageDuration = typingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
          } else {
            // Contact messages: 2 second delay + appearance
            const CONTACT_RESPONSE_DELAY = 2000;
            messageDuration = CONTACT_RESPONSE_DELAY + 300; // 2s delay + 300ms appearance
          }
          
          const delay = index > 0 ? textingSettings.messageDelay : 0;
          
          // Ensure messages are added in the exact order they appear in the script
          parsedMessages.push({
            id: `msg-${index}`,
            text: messageText,
            sender,
            timestamp: currentTime,
            needsTyping: imageUrl ? false : needsTyping,
            imageUrl,
            // Preserve original index to ensure order is maintained
            _index: index,
          });
          
          currentTime += messageDuration + delay;
        });
        
        // Calculate total duration (includes send button + message appear delay)
        if (parsedMessages.length > 0) {
          const lastMessage = parsedMessages[parsedMessages.length - 1];
          const SEND_BUTTON_DURATION = 300;
          const MESSAGE_APPEAR_DELAY = 150;
          const END_BUFFER = 4000; // 3 seconds extra buffer at end (was 1000ms, now 4000ms)
          
          let lastMessageDuration = 0;
          if (lastMessage.needsTyping !== false) {
            const lastTypingDuration = (lastMessage.text.length / textingSettings.typingSpeed) * 1000;
            lastMessageDuration = lastTypingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
          } else {
            // Contact messages: 2 second delay + appearance
            const CONTACT_RESPONSE_DELAY = 2000;
            lastMessageDuration = CONTACT_RESPONSE_DELAY + 300; // 2s delay + 300ms appearance
          }
          
          const calculatedDuration = lastMessage.timestamp + lastMessageDuration + END_BUFFER;
          
          updateDraft({
            metadata: {
              ...(draft?.metadata || {}),
              messages: parsedMessages,
              totalDuration: calculatedDuration,
            },
          });
        }
      }
    }
  }, [draft?.metadata, draft?.scriptInput, textingSettings.typingSpeed, textingSettings.messageDelay, updateDraft]);

  const messages = useMemo<TextingMessage[]>(() => {
    const savedMessages = (draft?.metadata as any)?.messages || [];
    const uploadedImages = (draft?.metadata as any)?.uploadedImages || {};
    
    // Resolve image URLs from saved mappings
    // IMPORTANT: Preserve the exact order of messages as they appear in the array
    // Do not sort or reorder - messages should be in chronological order already
    const resolvedMessages = savedMessages.map((msg: TextingMessage, index: number) => {
      if (msg.imageUrl && !msg.imageUrl.startsWith('http://') && !msg.imageUrl.startsWith('https://')) {
        // It's an image ID, resolve it from uploadedImages
        const resolvedUrl = uploadedImages[msg.imageUrl];
        if (resolvedUrl) {
          return { ...msg, imageUrl: resolvedUrl, _index: msg._index ?? index };
        }
      }
      return { ...msg, _index: msg._index ?? index };
    });
    
    // Ensure messages are in the correct order (by _index if available, otherwise by array order)
    // This is a defensive check - messages should already be in order
    return resolvedMessages.sort((a: TextingMessage, b: TextingMessage) => {
      const indexA = (a as any)._index ?? savedMessages.indexOf(a);
      const indexB = (b as any)._index ?? savedMessages.indexOf(b);
      return indexA - indexB;
    });
  }, [draft?.metadata]);

  const totalDuration = useMemo(() => {
    const savedDuration = (draft?.metadata as any)?.totalDuration;
    if (savedDuration && savedDuration > 0) {
      return savedDuration;
    }
    
    // Recalculate from messages if duration is missing (includes send button + message appear delay)
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const SEND_BUTTON_DURATION = 300;
      const MESSAGE_APPEAR_DELAY = 150;
      const END_BUFFER = 3000; // 3 seconds buffer to ensure all messages are rendered and shown
      
      let lastMessageDuration = 0;
      if (lastMessage.needsTyping !== false) {
        const lastTypingDuration = (lastMessage.text.length / textingSettings.typingSpeed) * 1000;
        lastMessageDuration = lastTypingDuration + 100 + SEND_BUTTON_DURATION + MESSAGE_APPEAR_DELAY;
      } else {
        lastMessageDuration = 300; // Small delay for appearance
      }
      
      return lastMessage.timestamp + lastMessageDuration + END_BUFFER;
    }
    
    return 0;
  }, [draft?.metadata, messages, textingSettings.typingSpeed]);
  
  // Keep refs in sync - must be after totalDuration is defined
  useEffect(() => {
    totalDurationRef.current = totalDuration;
  }, [totalDuration]);
  
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Redirect if no script (skip if loading project from URL)
  useEffect(() => {
    if (projectIdFromUrl && isLoadingProject) {
      return; // Don't redirect while loading project
    }
    if (!draft?.scriptInput && !messages.length && !projectIdFromUrl) {
      toast.info("Write messages before previewing.");
      router.replace("/app/create/texting/script");
      return;
    }
  }, [draft?.scriptInput, messages.length, router, projectIdFromUrl, isLoadingProject]);

  // Animation loop - use refs to avoid dependency issues
  const animate = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }
    
    const duration = totalDurationRef.current;
    if (duration <= 0) {
      console.warn("Animation stopped: totalDuration is", duration);
      setIsPlaying(false);
      return;
    }

    const now = performance.now();
    const elapsed = now - startTimeRef.current;
    const newTime = pausedTimeRef.current + elapsed;

    if (newTime >= duration) {
      setCurrentTime(duration);
      setIsPlaying(false);
      pausedTimeRef.current = 0;
      console.log("Animation completed");
      return;
    }

    setCurrentTime(newTime);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, []); // No dependencies - use refs instead

  // Start/stop animation - only depend on isPlaying to avoid restart loops
  useEffect(() => {
    if (isPlaying) {
      if (totalDuration <= 0) {
        console.warn("Cannot play: totalDuration is", totalDuration);
        setIsPlaying(false);
        toast.error("Cannot play: Invalid duration. Please check your messages.");
        return;
      }
      console.log("Starting animation:", { totalDuration, currentTime, messages: messages.length });
      startTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pausedTimeRef.current = currentTime;
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]); // Only depend on isPlaying - use refs for other values

  const handlePlayPause = () => {
    if (messages.length === 0) {
      toast.error("No messages to play. Please go back and write messages first.");
      return;
    }
    if (totalDuration <= 0) {
      toast.error("Invalid video duration. Please check your messages.");
      return;
    }
    console.log("Play/Pause clicked:", { isPlaying, messages: messages.length, totalDuration, currentTime });
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    pausedTimeRef.current = 0;
  };

  const handleTimeChange = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;
    if (isPlaying) {
      startTimeRef.current = performance.now();
    }
  };

  const handleRenderFinal = async () => {
    if (!messages.length) {
      toast.error("Please write messages first");
      return;
    }

    // Use projectId from URL if editing, otherwise use draft.id
    const projectId = projectIdFromUrl || draft?.id;
    if (!projectId) {
      toast.error("Project not found. Please go back and click Preview again.");
      return;
    }

    try {
      setIsRenderingFinal(true);
      setRenderStatus('RENDERING');
      setRenderProgress(0);
      
      toast.info("Queuing final render...");

      // Call render API to queue final render
      const { projectsApi } = await import('@/lib/api/projects');
      const { config } = await import('@/lib/config');
      
      // Get auth token
      const { getCachedToken } = await import('@/lib/utils/token-cache');
      const token = await getCachedToken();
      
      if (!token) {
        throw new Error('Authentication required. Please log in and try again.');
      }

      const response = await fetch(`${config.remotionServerUrl}/api/projects/${projectId}/render/final`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Texting video specific params will be read from project metadata
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to queue render: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to queue render');
      }

      // Get render job ID from response
      const jobId = data.render_job_id || data.renderJobId;
      if (jobId) {
        setRenderJobId(jobId);
        console.log("📡 Render job ID:", jobId);
      }

      toast.success("Final render queued! Updates will appear here automatically.");
      setRenderStatus('RENDERING');
      
    } catch (error: any) {
      console.error("Failed to render final video:", error);
      setIsRenderingFinal(false);
      setRenderStatus('FAILED');
      toast.error(
        error instanceof Error 
          ? error.message 
          : "Failed to queue render. Please try again."
      );
    }
  };

  // Subscribe to render job updates via Supabase Realtime
  useEffect(() => {
    if (!renderJobId) return;

    // Unsubscribe from any existing subscription
    if (renderJobSubscriptionRef.current) {
      supabase.removeChannel(renderJobSubscriptionRef.current);
      renderJobSubscriptionRef.current = null;
    }

    console.log("🔔 Setting up Realtime subscription for render job:", renderJobId);
    
    const channel = supabase
      .channel(`texting-render-job-${renderJobId}`)
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
          console.log("📡 Render job update received:", renderJob);

          if (!renderJob) return;

          const jobStatus = (renderJob.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';

          // Map backend status to frontend status
          let frontendStatus: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
          if (jobStatus === 'completed') {
            frontendStatus = 'READY';
            setRenderProgress(100);
            if (renderJob.result_url) {
              setFinalVideoUrl(renderJob.result_url);
              // Update draft with final URL
              updateDraft({
                finalUrl: renderJob.result_url,
              });
              toast.success("Video render completed! You can now download it.");
            }
          } else if (jobStatus === 'failed') {
            frontendStatus = 'FAILED';
            setIsRenderingFinal(false);
            toast.error(renderJob.error_message || "Render failed. Please try again.");
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
            setIsRenderingFinal(false);
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Realtime subscription status:", status);
      });

    renderJobSubscriptionRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (renderJobSubscriptionRef.current) {
        supabase.removeChannel(renderJobSubscriptionRef.current);
        renderJobSubscriptionRef.current = null;
      }
    };
  }, [renderJobId, updateDraft]);

  const handleBack = () => {
    router.push("/app/create/texting/script");
  };

  // Show loading state while project is being loaded
  if (isLoadingProject) {
    return (
      <div className="flex flex-col gap-8">
        <Stepper steps={steps} activeIndex={2} />
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Stepper steps={steps} activeIndex={2} />
      
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Preview your texting video</h1>
          <p className="text-sm text-muted-foreground">
            Review your video and make adjustments before rendering the final version.
          </p>
        </header>

        {/* Debug Info - Remove in production */}
        {process.env.NODE_ENV === 'development' && (
          <div className="rounded-3xl border border-border/40 bg-yellow-50 p-4 text-xs">
            <p><strong>Debug Info:</strong></p>
            <p>Messages: {messages.length}</p>
            <p>Total Duration: {totalDuration}ms ({(totalDuration / 1000).toFixed(2)}s)</p>
            <p>Current Time: {currentTime}ms ({(currentTime / 1000).toFixed(2)}s)</p>
            <p>Is Playing: {isPlaying ? 'Yes' : 'No'}</p>
            <p>Script Input: {draft?.scriptInput ? `${draft.scriptInput.length} chars` : 'None'}</p>
          </div>
        )}

        {/* Preview Area */}
        <div className="rounded-3xl border border-border/40 bg-white/70 p-6">
          <div className="flex flex-col items-center gap-4">
            {/* Video Preview */}
            <div className="w-full max-w-md">
              {messages.length === 0 ? (
                <div className="aspect-[9/16] bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-center p-6">
                    <p className="text-sm text-gray-500 mb-2">No messages to preview</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/app/create/texting/script")}
                    >
                      Go to Script
                    </Button>
                  </div>
                </div>
              ) : (
                <IMessageTemplate
                  messages={messages}
                  contactName={textingSettings.contactName}
                  contactAvatar={textingSettings.contactAvatar}
                  currentTime={currentTime}
                  typingSpeed={textingSettings.typingSpeed}
                  messageDelay={textingSettings.messageDelay}
                  keepKeyboardOpen={keepKeyboardOpen}
                />
              )}
            </div>

            {/* Playback Controls */}
            <div className="w-full max-w-md space-y-4">
              {/* Timeline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{((currentTime / 1000) || 0).toFixed(1)}s</span>
                  <span>{((totalDuration / 1000) || 0).toFixed(1)}s</span>
                </div>
                <Slider
                  value={[currentTime]}
                  onValueChange={handleTimeChange}
                  min={0}
                  max={totalDuration || 1000}
                  step={50}
                  className="w-full"
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={handleReset}
                  disabled={currentTime === 0}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  className="rounded-full px-8"
                  onClick={handlePlayPause}
                  disabled={totalDuration === 0}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Play
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="rounded-3xl border border-border/40 bg-white/70 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground">
                Customize your video settings
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="keepKeyboardOpen"
              checked={keepKeyboardOpen}
              onCheckedChange={(checked) => handleKeepKeyboardOpenChange(checked === true)}
            />
            <label
              htmlFor="keepKeyboardOpen"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Keep keyboard open full time
            </label>
          </div>
        </div>

        {/* Render Controls */}
        <div className="rounded-3xl border border-border/40 bg-white/70 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Render Video</h2>
              <p className="text-sm text-muted-foreground">
                Render the final video in 1080p quality
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              className="rounded-2xl"
              onClick={handleRenderFinal}
              disabled={isRenderingFinal || messages.length === 0}
            >
              {isRenderingFinal ? "Rendering..." : "Render Final (1080p)"}
            </Button>
            
            {renderStatus && (
              <div className="flex-1 min-w-[200px]">
                <Progress 
                  value={renderStatus === 'RENDERING' ? renderProgress : renderStatus === 'READY' ? 100 : 0} 
                  className="h-2" 
                />
                <span className="text-xs text-muted-foreground mt-1 block">
                  Status: {renderStatus}
                </span>
              </div>
            )}
          </div>

          {renderStatus === 'READY' && (finalVideoUrl || draft?.finalUrl) && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => window.open(finalVideoUrl || draft?.finalUrl || '', '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Video
              </Button>
            </div>
          )}
        </div>

        {/* Settings Panel (Collapsible) */}
        <div className="rounded-3xl border border-border/40 bg-white/70 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preview-contact-name">Contact Name</Label>
              <Input
                id="preview-contact-name"
                value={textingSettings.contactName}
                onChange={(e) => {
                  const newSettings = { ...textingSettings, contactName: e.target.value };
                  updateDraft({
                    metadata: {
                      ...(draft?.metadata || {}),
                      textingSettings: newSettings,
                    },
                  });
                }}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preview-contact-avatar">Contact Avatar</Label>
              <Input
                id="preview-contact-avatar"
                value={textingSettings.contactAvatar}
                onChange={(e) => {
                  const newSettings = { ...textingSettings, contactAvatar: e.target.value };
                  updateDraft({
                    metadata: {
                      ...(draft?.metadata || {}),
                      textingSettings: newSettings,
                    },
                  });
                }}
                className="rounded-xl text-2xl"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={handleBack}
          >
            Back to Script
          </Button>
          <Button
            variant="ghost"
            className="rounded-2xl"
            onClick={() => router.push("/app/create")}
          >
            Back to Create
          </Button>
        </div>
      </div>
    </div>
  );
}

