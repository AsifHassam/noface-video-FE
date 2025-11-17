"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play, Eye } from "lucide-react";
import type { Background } from "@/types";
import { cn } from "@/lib/utils";

type BackgroundCardProps = {
  background: Background;
  selected: boolean;
  onSelect: (background: Background) => void;
};

export function BackgroundCard({
  background,
  selected,
  onSelect,
}: BackgroundCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 bg-white text-left transition-all hover:border-primary/50 hover:shadow-md cursor-pointer",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border/40",
      )}
      onClick={() => onSelect(background)}
    >
      <Badge
        variant={selected ? "default" : "secondary"}
        className="absolute right-4 top-4 z-10"
      >
        {selected ? "Active clip" : "Tap to use"}
      </Badge>
      
      {/* Video Preview */}
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        {background.previewUrl ? (
          <video
            src={background.previewUrl}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Play className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity group-hover:bg-black/10">
          <div className="rounded-full bg-black/60 p-3 backdrop-blur-sm transition-transform group-hover:scale-110">
            <Play className="h-6 w-6 text-white" fill="white" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 px-6 pb-6">
        <h3 className="text-lg font-semibold text-foreground">
          {background.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {background.description}
        </p>
        <p className="text-xs text-muted-foreground/70">{background.length}</p>
        
        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                View
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl rounded-3xl">
              <DialogHeader>
                <DialogTitle>{background.name}</DialogTitle>
                <DialogDescription>
                  Preview this background video before selecting it for your project.
                </DialogDescription>
              </DialogHeader>
              <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
                {background.previewUrl ? (
                  <video
                    src={background.previewUrl}
                    controls
                    className="h-full w-full"
                    autoPlay
                  >
                    <source src={background.previewUrl} type="video/mp4" />
                  </video>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    Preview not available
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant={selected ? "default" : "outline"}
            size="sm"
            className="flex-1 rounded-xl"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(background);
            }}
          >
            {selected ? "Selected" : "Select"}
          </Button>
        </div>
      </div>
    </div>
  );
}

