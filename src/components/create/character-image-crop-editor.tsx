"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  TARGET_IMAGE_WIDTH,
  TARGET_IMAGE_HEIGHT,
  cropAndResizeImage,
  type CropArea,
} from "@/lib/utils/resize-image";
import { Loader2, Crop } from "lucide-react";

type CharacterImageCropEditorProps = {
  imageUrl: string;
  fileName?: string;
  onApply: (file: File) => void;
  onCancel: () => void;
  compact?: boolean;
};

const TARGET_ASPECT = TARGET_IMAGE_WIDTH / TARGET_IMAGE_HEIGHT;

export function CharacterImageCropEditor({
  imageUrl,
  fileName = "character.png",
  onApply,
  onCancel,
  compact = false,
}: CharacterImageCropEditorProps) {
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropWidth, setCropWidth] = useState(50);
  const [applying, setApplying] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (img && img.naturalWidth) {
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    }
  }, []);

  const imgAspect = imageSize ? imageSize.w / imageSize.h : 1;
  const cropHeightPercent = imageSize
    ? cropWidth * (imageSize.w / imageSize.h) * (TARGET_IMAGE_HEIGHT / TARGET_IMAGE_WIDTH)
    : cropWidth;

  const cropArea: CropArea = {
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeightPercent,
  };

  const maxCropWidth = imageSize
    ? Math.min(
        100 - cropX,
        (100 - cropY) * (imageSize.h / imageSize.w) * (TARGET_IMAGE_WIDTH / TARGET_IMAGE_HEIGHT)
      )
    : 100 - cropX;

  const handleApply = async () => {
    setApplying(true);
    try {
      const file = await cropAndResizeImage(
        imageUrl,
        cropArea,
        TARGET_IMAGE_WIDTH,
        TARGET_IMAGE_HEIGHT,
        fileName
      );
      onApply(file);
    } catch (e) {
      console.error("Crop failed:", e);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Crop className="h-4 w-4" />
        Crop to character size ({TARGET_IMAGE_WIDTH}×{TARGET_IMAGE_HEIGHT})
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/20">
        <div className="relative w-full" style={{ aspectRatio: imageSize ? `${imageSize.w}/${imageSize.h}` : "1" }}>
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop preview"
            className="block w-full h-full object-contain"
            onLoad={onImageLoad}
          />
          {imageSize && (
            <div
              className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
              style={{
                left: `${cropX}%`,
                top: `${cropY}%`,
                width: `${cropWidth}%`,
                height: `${cropHeightPercent}%`,
              }}
            />
          )}
        </div>
      </div>
      {imageSize && (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">X: {cropX.toFixed(0)}%</Label>
              <Slider
                value={[cropX]}
                onValueChange={([v]) => setCropX(v)}
                min={0}
                max={Math.max(0, 100 - cropWidth)}
                step={1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Y: {cropY.toFixed(0)}%</Label>
              <Slider
                value={[cropY]}
                onValueChange={([v]) => setCropY(v)}
                min={0}
                max={Math.max(0, 100 - cropHeightPercent)}
                step={1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Width: {cropWidth.toFixed(0)}%</Label>
              <Slider
                value={[cropWidth]}
                onValueChange={([v]) => setCropWidth(v)}
                min={10}
                max={Math.min(100 - cropX, maxCropWidth)}
                step={1}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size={compact ? "sm" : "default"}
              className="rounded-xl"
              onClick={onCancel}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size={compact ? "sm" : "default"}
              className="rounded-xl"
              onClick={handleApply}
              disabled={applying}
            >
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Applying…
                </>
              ) : (
                "Use this crop"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
