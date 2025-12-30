"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createCustomCharacter } from "@/lib/api/custom-characters";

// Stewie's image dimensions (781 x 987)
const TARGET_IMAGE_WIDTH = 781;
const TARGET_IMAGE_HEIGHT = 987;

type CreateCharacterDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCharacterCreated?: () => void;
};

/**
 * Resize image to target dimensions using canvas
 */
const resizeImage = (file: File, targetWidth: number, targetHeight: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        // Create canvas with target dimensions
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Fill with transparent background
        ctx.clearRect(0, 0, targetWidth, targetHeight);

        // Calculate scaling to fit image while maintaining aspect ratio
        const imgAspect = img.width / img.height;
        const targetAspect = targetWidth / targetHeight;
        
        let drawWidth = targetWidth;
        let drawHeight = targetHeight;
        let drawX = 0;
        let drawY = 0;

        if (imgAspect > targetAspect) {
          // Image is wider - fit to height
          drawHeight = targetHeight;
          drawWidth = drawHeight * imgAspect;
          drawX = (targetWidth - drawWidth) / 2;
        } else {
          // Image is taller - fit to width
          drawWidth = targetWidth;
          drawHeight = drawWidth / imgAspect;
          drawY = (targetHeight - drawHeight) / 2;
        }

        // Draw image centered on canvas
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // Convert canvas to blob, then to File
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Failed to resize image"));
              return;
            }
            const resizedFile = new File([blob], file.name, {
              type: "image/png",
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          },
          "image/png",
          1.0 // Maximum quality
        );
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

export const CreateCharacterDialog = ({
  open,
  onOpenChange,
  onCharacterCreated,
}: CreateCharacterDialogProps) => {
  const [characterName, setCharacterName] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate it's PNG (transparent PNG preferred)
    if (file.type !== "image/png") {
      toast.warning("PNG format is recommended for transparent backgrounds");
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setIsProcessingImage(true);

    try {
      // Resize image to match Stewie's dimensions
      const resizedFile = await resizeImage(file, TARGET_IMAGE_WIDTH, TARGET_IMAGE_HEIGHT);
      setImageFile(resizedFile);

      // Create preview of resized image
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setIsProcessingImage(false);
      };
      reader.readAsDataURL(resizedFile);
    } catch (error) {
      console.error("Error processing image:", error);
      toast.error("Failed to process image. Please try again.");
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!characterName.trim()) {
      toast.error("Please enter a character name");
      return;
    }

    if (!voiceId.trim()) {
      toast.error("Please enter a Eleven Labs voice ID");
      return;
    }

    if (!imageFile) {
      toast.error("Please upload a character image");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!imageFile) {
        toast.error("Please upload a character image");
        setIsSubmitting(false);
        return;
      }

      await createCustomCharacter(characterName.trim(), voiceId.trim(), imageFile);
      toast.success("Character created successfully!");
      
      // Reset form
      setCharacterName("");
      setVoiceId("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      onOpenChange(false);
      onCharacterCreated?.();
    } catch (error) {
      console.error("Error creating character:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create character");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        // Reset form when closing
        setCharacterName("");
        setVoiceId("");
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-3xl max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Custom Character</DialogTitle>
          <DialogDescription>
            Upload a transparent PNG image and provide a Eleven Labs voice ID to create your own character.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Character Name */}
          <div className="space-y-2">
            <Label htmlFor="character-name">Character Name</Label>
            <Input
              id="character-name"
              type="text"
              placeholder="e.g., My Character"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className="rounded-2xl"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Voice ID */}
          <div className="space-y-2">
            <Label htmlFor="voice-id">Eleven Labs Voice ID</Label>
            <Input
              id="voice-id"
              type="text"
              placeholder="Enter your Eleven Labs voice ID"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="rounded-2xl"
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-muted-foreground">
              Make sure you have added your Eleven Labs API key in Settings.
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Character Image (PNG with transparent background)</Label>
            <div className="space-y-3">
              {isProcessingImage ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 bg-muted/40 p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Resizing image to {TARGET_IMAGE_WIDTH}x{TARGET_IMAGE_HEIGHT}px...</span>
                </div>
              ) : imagePreview ? (
                <div className="relative">
                  <div className="relative w-full max-w-xs mx-auto overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-muted to-muted/50" style={{ aspectRatio: `${TARGET_IMAGE_WIDTH}/${TARGET_IMAGE_HEIGHT}` }}>
                    <Image
                      src={imagePreview}
                      alt="Character preview"
                      fill
                      className="object-contain p-4"
                      unoptimized
                    />
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      Preview: {TARGET_IMAGE_WIDTH} × {TARGET_IMAGE_HEIGHT}px (matched to Stewie's size)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full"
                    onClick={handleRemoveImage}
                    disabled={isSubmitting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Label
                  htmlFor="character-image"
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 bg-muted/40 p-8 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:bg-muted/60",
                    (isSubmitting || isProcessingImage) && "pointer-events-none opacity-50"
                  )}
                >
                  <Upload className="h-8 w-8" />
                  <span>Upload transparent PNG image</span>
                  <span className="text-xs">Max 5MB - Will be resized to {TARGET_IMAGE_WIDTH}×{TARGET_IMAGE_HEIGHT}px</span>
                </Label>
              )}
              <Input
                id="character-image"
                ref={fileInputRef}
                type="file"
                accept="image/png,image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={isSubmitting || isProcessingImage}
              />
              {!imagePreview && !isProcessingImage && (
                <p className="text-xs text-muted-foreground">
                  Upload a PNG image with a transparent background. It will be automatically resized to match Stewie's image dimensions ({TARGET_IMAGE_WIDTH}×{TARGET_IMAGE_HEIGHT}px).
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-2xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !characterName.trim() || !voiceId.trim() || !imageFile}
              className="rounded-2xl"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Character"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

