"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { CharacterSizes, CharacterPositions } from "@/types";

interface CharacterSizeControlsProps {
  characterSizes: CharacterSizes;
  onCharacterSizesChange: (sizes: CharacterSizes) => void;
  characterPositions?: CharacterPositions; // Optional, kept for backwards compatibility but not used
  onCharacterPositionsChange?: (positions: CharacterPositions) => void; // Optional, kept for backwards compatibility but not used
  selectedCharacters: string[]; // Names of selected characters
  defaultExpanded?: boolean; // Whether to start expanded (default: true)
  disabled?: boolean; // Whether controls are disabled
}

const defaultSizes: CharacterSizes = {
  Peter: { width: 400, height: 500 },
  Stewie: { width: 350, height: 450 },
  Rick: { width: 800, height: 1000 }, // 2x default size
  Brian: { width: 350, height: 450 },
  Morty: { width: 560, height: 720 }, // 2x default size, reduced by 20%
};

// Calculate aspect ratios from default sizes (width/height)
const aspectRatios: Record<keyof CharacterSizes, number> = {
  Peter: (defaultSizes.Peter?.width ?? 400) / (defaultSizes.Peter?.height ?? 500), // 0.8
  Stewie: (defaultSizes.Stewie?.width ?? 350) / (defaultSizes.Stewie?.height ?? 450), // ~0.778
  Rick: (defaultSizes.Rick?.width ?? 800) / (defaultSizes.Rick?.height ?? 1000), // 0.8
  Brian: (defaultSizes.Brian?.width ?? 350) / (defaultSizes.Brian?.height ?? 450), // ~0.778
  Morty: (defaultSizes.Morty?.width ?? 560) / (defaultSizes.Morty?.height ?? 720), // ~0.778
};

export function CharacterSizeControls({
  characterSizes,
  onCharacterSizesChange,
  characterPositions,
  onCharacterPositionsChange,
  selectedCharacters,
  defaultExpanded = true,
  disabled = false,
}: CharacterSizeControlsProps) {
  const [localSizes, setLocalSizes] = useState<CharacterSizes>(characterSizes);
  const [isOpen, setIsOpen] = useState(defaultExpanded);

  const updateSize = (character: keyof CharacterSizes, dimension: 'width' | 'height', value: number) => {
    if (disabled) return;
    
    const currentSize = localSizes[character] || defaultSizes[character]!;
    
    // Calculate aspect ratio from current size (if it exists and is valid), otherwise use default
    // This ensures we preserve the aspect ratio that the user has already set (which may differ from defaults)
    const currentAspectRatio = currentSize.width > 0 && currentSize.height > 0
      ? currentSize.width / currentSize.height
      : aspectRatios[character];
    
    // Maintain aspect ratio: when width changes, adjust height; when height changes, adjust width
    const newSizes = {
      ...localSizes,
      [character]: dimension === 'width'
        ? {
            width: value,
            height: Math.round(value / currentAspectRatio), // Maintain aspect ratio
          }
        : {
            width: Math.round(value * currentAspectRatio), // Maintain aspect ratio
            height: value,
      },
    };
    
    setLocalSizes(newSizes);
    onCharacterSizesChange(newSizes);
  };

  const resetCharacter = (character: keyof CharacterSizes) => {
    const defaultSize = defaultSizes[character];
    if (!defaultSize) return;
    
    const newSizes = {
      ...localSizes,
      [character]: defaultSize,
    };
    setLocalSizes(newSizes);
    onCharacterSizesChange(newSizes);
  };

  const resetAll = () => {
    setLocalSizes(defaultSizes);
    onCharacterSizesChange(defaultSizes);
  };

  // Only show controls for selected characters
  const charactersToShow = selectedCharacters.filter(
    (name): name is keyof CharacterSizes => 
      name in defaultSizes
  ) as (keyof CharacterSizes)[];

  if (charactersToShow.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Character Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Select characters to adjust their size
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={disabled ? "opacity-50" : ""}>
      <CardHeader 
        className={disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/50 transition-colors"}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Character Settings</CardTitle>
            {isOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOpen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  resetAll();
                }}
                className="h-8"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
        {charactersToShow.map((character) => {
          const currentSize = localSizes[character] || defaultSizes[character]!;
          
          return (
            <div key={character} className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold capitalize">
                  {character}
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCharacter(character)}
                  className="h-7 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Size Controls */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Width</Label>
                      <span className="text-sm font-mono text-muted-foreground">
                        {currentSize.width}px
                      </span>
                    </div>
                    <Slider
                      value={[currentSize.width]}
                      onValueChange={([value]) => updateSize(character, 'width', value)}
                      min={200}
                      max={1200}
                      step={10}
                      className="w-full"
                      disabled={disabled}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Height</Label>
                      <span className="text-sm font-mono text-muted-foreground">
                        {currentSize.height}px
                      </span>
                    </div>
                    <Slider
                      value={[currentSize.height]}
                      onValueChange={([value]) => updateSize(character, 'height', value)}
                      min={200}
                      max={1200}
                      step={10}
                      className="w-full"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </CardContent>
      )}
    </Card>
  );
}

