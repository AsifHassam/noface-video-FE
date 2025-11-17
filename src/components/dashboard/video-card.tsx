"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Play, EllipsisVertical, Download, Trash2, Edit, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatRelativeTime } from "@/lib/utils/time";
import type { Project } from "@/types";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/lib/stores/project-store";
import { toast } from "sonner";

export const VideoCard = ({ project, onDelete }: { project: Project; onDelete: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(project.title);
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { loadProjectIntoDraft, updateProject } = useProjectStore();
  const mediaSrc = project.finalUrl ?? project.previewUrl;

  // Update edited title when project title changes
  useEffect(() => {
    if (!isEditingTitle) {
      setEditedTitle(project.title);
    }
  }, [project.title, isEditingTitle]);

  // Debug: Log video URL availability
  useEffect(() => {
    console.log(`Project ${project.id}:`, {
      title: project.title,
      status: project.status,
      previewUrl: project.previewUrl,
      finalUrl: project.finalUrl,
      mediaSrc: mediaSrc,
    });
  }, [project, mediaSrc]);

  const handleEdit = async () => {
    try {
      // Load project into draft (now fetches from API)
      await loadProjectIntoDraft(project.id);
      
      // Get the draft after loading to check its type
      const draft = useProjectStore.getState().draft;
      
      // Determine the correct preview page based on project type or draft type
      let previewRoute = "/app/create/two-char/preview?editing=true"; // Default to two-char
      
      // Check project type from metadata or draft type
      const projectType = project.type || (draft?.type as any);
      const metadataType = (project as any).metadata?.type;
      const effectiveType = projectType || metadataType || (draft?.type as any);
      
      console.log("🔀 Edit routing check:", {
        projectType: project.type,
        metadataType: metadataType,
        draftType: draft?.type,
        effectiveType: effectiveType,
        hasScriptInput: !!draft?.scriptInput,
        hasCharacters: { A: !!draft?.characters?.A, B: !!draft?.characters?.B },
        projectId: project.id
      });
      
      // Prioritize explicit type over inferred type
      // Check if it's explicitly a TWO_CHAR_CONVO project first
      if (effectiveType === "TWO_CHAR_CONVO" || project.type === "TWO_CHAR_CONVO") {
        previewRoute = "/app/create/two-char/preview?editing=true";
      } 
      // Check if it's explicitly a story narration project
      // Note: "story" is stored as metadata.type, not in ProjectType enum
      else if (
        String(effectiveType) === "story" || 
        effectiveType === "NORMAL_STORY" || 
        effectiveType === "REDDIT_STORY" ||
        metadataType === "story"
      ) {
        previewRoute = "/app/create/story/preview?editing=true";
      }
      // Fallback: Infer from draft content (only if type is not explicitly set)
      else if (!effectiveType && draft) {
        // Only infer story if there's scriptInput but NO characters
        // If there are characters, it's a 2-char project
        const hasCharacters = draft.characters?.A || draft.characters?.B;
        if (draft.scriptInput && !hasCharacters) {
          previewRoute = "/app/create/story/preview?editing=true";
        } else if (hasCharacters) {
          previewRoute = "/app/create/two-char/preview?editing=true";
        }
      }
      
      console.log("🔀 Routing to preview page:", previewRoute, "for effective type:", effectiveType);
      
      // Navigate to the correct preview/editor page with editing flag
      router.push(previewRoute);
    } catch (error) {
      console.error("Failed to load project:", error);
    }
  };

  const handleStartEditTitle = () => {
    setIsEditingTitle(true);
    setEditedTitle(project.title);
    // Focus input after state update
    setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  };

  const handleSaveTitle = async () => {
    if (isSaving) return; // Prevent double-save
    
    const trimmedTitle = editedTitle.trim();
    
    if (!trimmedTitle) {
      toast.error("Title cannot be empty");
      setEditedTitle(project.title);
      setIsEditingTitle(false);
      return;
    }

    if (trimmedTitle === project.title) {
      // No change, just cancel editing
      setIsEditingTitle(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateProject(project.id, { title: trimmedTitle });
      toast.success("Title updated");
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to update title:", error);
      toast.error("Failed to update title");
      setEditedTitle(project.title);
      setIsEditingTitle(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditTitle = () => {
    setEditedTitle(project.title);
    setIsEditingTitle(false);
    setIsSaving(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEditTitle();
    }
  };

  // Loop first 5 seconds of video preview
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaSrc) {
      console.log("Video element or mediaSrc not available:", { video: !!video, mediaSrc });
      return;
    }

    const handleTimeUpdate = () => {
      // Loop first 5 seconds
      if (video.currentTime >= 5) {
        video.currentTime = 0;
      }
    };

    const handleLoadedData = () => {
      console.log("Video loaded successfully for:", project.title);
      video.play().catch(err => console.log("Auto-play prevented:", err));
    };

    const handleError = (e: Event) => {
      console.error("Video load error for:", project.title, e);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("error", handleError);
    
    // Try to play immediately if already loaded
    if (video.readyState >= 2) {
      video.play().catch(err => console.log("Auto-play prevented:", err));
    }

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
    };
  }, [mediaSrc, project.title]);

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-3xl border-none bg-white/70 shadow-lg shadow-primary/5 transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-video overflow-hidden bg-muted">
        {mediaSrc ? (
          <>
            <video
              ref={videoRef}
              src={mediaSrc}
              className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
              muted
              playsInline
              crossOrigin="anonymous"
            />
            {/* Debug indicator */}
            <div className="absolute top-2 left-2 rounded-full bg-green-500/80 px-2 py-0.5 text-[10px] text-white">
              VIDEO
            </div>
          </>
        ) : (
          <>
            <Image
              src="/thumbs/default.svg"
              alt={project.title}
              fill
              sizes="(min-width: 1024px) 320px, 100vw"
              className="object-cover transition group-hover:scale-105"
            />
            {/* Debug indicator */}
            <div className="absolute top-2 left-2 rounded-full bg-orange-500/80 px-2 py-0.5 text-[10px] text-white">
              NO VIDEO
            </div>
          </>
        )}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
          <Play className="h-3.5 w-3.5" />
          {project.durationSec ? `${project.durationSec}s` : "Preview"}
        </div>
        <div className="absolute right-4 top-4">
          <StatusBadge status={project.status} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={titleInputRef}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={(e) => {
                    // Only save on blur if not clicking a button
                    if (!isSaving) {
                      handleSaveTitle();
                    }
                  }}
                  onKeyDown={handleTitleKeyDown}
                  className="h-7 text-lg font-semibold rounded-xl"
                  onClick={(e) => e.stopPropagation()}
                  disabled={isSaving}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsSaving(true);
                    handleSaveTitle();
                  }}
                  disabled={isSaving}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-full"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsSaving(true);
                    handleCancelEditTitle();
                  }}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <h3
                className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={handleStartEditTitle}
                title="Click to edit title"
              >
                {project.title}
              </h3>
            )}
            <p className="text-xs uppercase tracking-wide text-muted-foreground/70">
              Two Characters · {formatRelativeTime(project.createdAt)}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <EllipsisVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem
                disabled={!mediaSrc}
                className={cn("flex items-center gap-2 rounded-xl")}
                onSelect={() => setOpen(true)}
              >
                <Play className="h-4 w-4" />
                Play
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!project.finalUrl}
                className={cn(
                  "flex items-center gap-2 rounded-xl",
                  !!project.finalUrl && "opacity-50 cursor-not-allowed"
                )}
                onSelect={(e) => {
                  if (!project.finalUrl) {
                    handleEdit();
                  } else {
                    e.preventDefault();
                  }
                }}
                title={project.finalUrl ? "Cannot edit after final video is rendered" : "Edit project"}
              >
                <Edit className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                disabled={!project.finalUrl && !project.previewUrl}
                className={cn(
                  "flex items-center gap-2 rounded-xl",
                  (!project.finalUrl && !project.previewUrl) && "opacity-50 cursor-not-allowed"
                )}
                onSelect={() => {
                  const videoUrl = project.finalUrl || project.previewUrl;
                  if (videoUrl) {
                    const link = document.createElement('a');
                    link.href = videoUrl;
                    link.download = `${project.title || 'video'}-${project.finalUrl ? 'final' : 'preview'}.mp4`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success("Download started!");
                  }
                }}
              >
                <Download className="h-4 w-4" />
                Download {project.finalUrl ? "Final" : "Preview"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onDelete(project.id)}
                className="flex items-center gap-2 rounded-xl text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="rounded-2xl bg-primary/10 text-primary hover:bg-primary/20" disabled={!mediaSrc}>
              <Play className="mr-2 h-4 w-4" />
              Play preview
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl rounded-3xl">
            <DialogHeader>
              <DialogTitle>{project.title}</DialogTitle>
              <DialogDescription>
                Preview your video in vertical format (9:16) optimized for TikTok and Reels.
              </DialogDescription>
            </DialogHeader>
            {/* Vertical video container for TikTok/Reels format (9:16) */}
            <div className="mx-auto aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl bg-black">
              {mediaSrc ? (
                <video controls className="h-full w-full" poster="/thumbs/default.svg">
                  <source src={mediaSrc} type="video/mp4" />
                </video>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Generate a preview to play this video.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
};
