"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Video, Trash2, Eye, EyeOff, Plus, ArrowLeft } from "lucide-react";
import { 
  getAllBackgroundVideos, 
  uploadBackgroundVideo, 
  updateBackgroundVideo, 
  deleteBackgroundVideo,
  type BackgroundVideo 
} from "@/lib/api/background-videos";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";

const ADMIN_EMAIL = "asifhassam14@gmail.com";

export default function AdminBackgroundVideosPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const [backgrounds, setBackgrounds] = useState<BackgroundVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  
  // Upload form state
  const [backgroundId, setBackgroundId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [length, setLength] = useState("1080p @ 60fps");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  useEffect(() => {
    const { loading: authLoading } = useAuthStore.getState();
    if (authLoading) {
      return;
    }

    if (!isAdmin) {
      toast.error("Access denied. Admin access required.");
      router.push("/app/dashboard");
      return;
    }
    loadBackgrounds();
  }, [isAdmin, router, user]);

  const loadBackgrounds = async () => {
    try {
      setLoading(true);
      const data = await getAllBackgroundVideos();
      setBackgrounds(data);
    } catch (error) {
      console.error("Failed to load background videos:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load background videos");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!backgroundId.trim()) {
      toast.error("Background ID is required");
      return;
    }

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!videoFile) {
      toast.error("Please select a video file");
      return;
    }

    setUploading(true);

    try {
      await uploadBackgroundVideo(
        backgroundId.trim(),
        name.trim(),
        videoFile,
        description.trim() || undefined,
        durationSeconds ? parseInt(durationSeconds) : undefined,
        length.trim() || undefined
      );
      
      toast.success("Background video uploaded successfully!");
      
      // Reset form
      setBackgroundId("");
      setName("");
      setDescription("");
      setDurationSeconds("");
      setLength("1080p @ 60fps");
      setVideoFile(null);
      setShowUploadForm(false);
      
      // Reload backgrounds
      await loadBackgrounds();
    } catch (error) {
      console.error("Error uploading background video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload background video");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleEnabled = async (background: BackgroundVideo) => {
    try {
      await updateBackgroundVideo(background.id, {
        enabled: !background.enabled,
      });
      toast.success(`Background video ${!background.enabled ? 'enabled' : 'disabled'}`);
      await loadBackgrounds();
    } catch (error) {
      console.error("Error updating background video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update background video");
    }
  };

  const handleDelete = async (background: BackgroundVideo) => {
    if (!confirm(`Are you sure you want to delete "${background.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteBackgroundVideo(background.id);
      toast.success("Background video deleted successfully");
      await loadBackgrounds();
    } catch (error) {
      console.error("Error deleting background video:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete background video");
    }
  };

  const { loading: authLoading } = useAuthStore.getState();
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/app/admin")}
            className="rounded-2xl"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Background Videos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage gameplay background videos for video renders
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="rounded-2xl"
          disabled={uploading}
        >
          {showUploadForm ? (
            <>
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Upload Video
            </>
          )}
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Upload New Background Video</CardTitle>
            <CardDescription>
              Upload a new gameplay background video to S3. Videos will be available for use in video renders.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="backgroundId">Background ID *</Label>
                  <Input
                    id="backgroundId"
                    value={backgroundId}
                    onChange={(e) => setBackgroundId(e.target.value)}
                    placeholder="e.g., minecraft_new"
                    className="rounded-2xl"
                    required
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Unique identifier (lowercase, no spaces)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Minecraft Adventure"
                    className="rounded-2xl"
                    required
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of the video"
                  className="rounded-2xl"
                  disabled={uploading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="durationSeconds">Duration (seconds)</Label>
                  <Input
                    id="durationSeconds"
                    type="number"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                    placeholder="120"
                    className="rounded-2xl"
                    disabled={uploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="length">Length/Quality</Label>
                  <Input
                    id="length"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="1080p @ 60fps"
                    className="rounded-2xl"
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video">Video File *</Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="rounded-2xl"
                  required
                  disabled={uploading}
                />
                <p className="text-xs text-muted-foreground">
                  MP4 format recommended. Max 500MB.
                </p>
              </div>

              <Button
                type="submit"
                disabled={uploading || !backgroundId.trim() || !name.trim() || !videoFile}
                className="rounded-2xl w-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Video
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Background Videos List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {backgrounds.map((background) => (
            <Card key={background.id} className="rounded-3xl">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{background.name}</CardTitle>
                    <CardDescription className="mt-1">
                      ID: {background.background_id}
                    </CardDescription>
                  </div>
                  <Badge variant={background.enabled ? "default" : "secondary"}>
                    {background.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {background.description && (
                  <p className="text-sm text-muted-foreground">{background.description}</p>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{background.duration_seconds ? `${background.duration_seconds}s` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quality:</span>
                    <span>{background.length || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">File:</span>
                    <span className="truncate max-w-[150px]" title={background.video_file_name}>
                      {background.video_file_name}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleEnabled(background)}
                    className="flex-1 rounded-2xl"
                  >
                    {background.enabled ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Disable
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Enable
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(background)}
                    className="rounded-2xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <a
                  href={background.s3_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full rounded-2xl" size="sm">
                    <Video className="h-4 w-4 mr-2" />
                    View Video
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && backgrounds.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Video className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No background videos</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload your first background video to get started
            </p>
            <Button
              onClick={() => setShowUploadForm(true)}
              className="rounded-2xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

