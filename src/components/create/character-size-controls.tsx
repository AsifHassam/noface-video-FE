"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CharacterSizes, CharacterPositions, CharacterPosition } from "@/types";

interface CharacterSizeControlsProps {
  characterSizes: CharacterSizes;
  onCharacterSizesChange: (sizes: CharacterSizes) => void;
  characterPositions: CharacterPositions;
  onCharacterPositionsChange: (positions: CharacterPositions) => void;
  selectedCharacters: string[]; // Names of selected characters
}

const defaultSizes: CharacterSizes = {
  Peter: { width: 400, height: 500 },
  Stewie: { width: 350, height: 450 },
  Rick: { width: 800, height: 1000 }, // 2x default size
  Brian: { width: 350, height: 450 },
  Morty: { width: 560, height: 720 }, // 2x default size, reduced by 20%
};

const defaultPositions: CharacterPositions = {
  Peter: 'left',
  Stewie: 'right',
  Rick: 'left',
  Brian: 'right',
  Morty: 'right',
};

export function CharacterSizeControls({
  characterSizes,
  onCharacterSizesChange,
  characterPositions,
  onCharacterPositionsChange,
  selectedCharacters,
}: CharacterSizeControlsProps) {
  const [localSizes, setLocalSizes] = useState<CharacterSizes>(characterSizes);
  const [localPositions, setLocalPositions] = useState<CharacterPositions>(characterPositions);
  const [isOpen, setIsOpen] = useState(true);

  const updateSize = (character: keyof CharacterSizes, dimension: 'width' | 'height', value: number) => {
    const newSizes = {
      ...localSizes,
      [character]: {
        ...(localSizes[character] || defaultSizes[character]!),
        [dimension]: value,
      },
    };
    setLocalSizes(newSizes);
    onCharacterSizesChange(newSizes);
  };

  const updatePosition = (character: keyof CharacterPositions, position: CharacterPosition) => {
    const newPositions = {
      ...localPositions,
      [character]: position,
    };
    setLocalPositions(newPositions);
    onCharacterPositionsChange(newPositions);
  };

  const resetCharacter = (character: keyof CharacterSizes) => {
    const defaultSize = defaultSizes[character];
    const defaultPosition = defaultPositions[character];
    if (!defaultSize || !defaultPosition) return;
    
    const newSizes = {
      ...localSizes,
      [character]: defaultSize,
    };
    const newPositions = {
      ...localPositions,
      [character]: defaultPosition,
    };
    setLocalSizes(newSizes);
    setLocalPositions(newPositions);
    onCharacterSizesChange(newSizes);
    onCharacterPositionsChange(newPositions);
  };

  const resetAll = () => {
    setLocalSizes(defaultSizes);
    setLocalPositions(defaultPositions);
    onCharacterSizesChange(defaultSizes);
    onCharacterPositionsChange(defaultPositions);
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
            Select characters to adjust their size and position
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
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
                {/* Position Selection */}
                <div className="space-y-2">
                  <Label className="text-sm">Position</Label>
                  <RadioGroup
                    value={localPositions[character] || defaultPositions[character] || 'left'}
                    onValueChange={(value) => updatePosition(character, value as CharacterPosition)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="left" id={`${character}-left`} />
                      <Label htmlFor={`${character}-left`} className="cursor-pointer text-sm">
                        Left
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="center" id={`${character}-center`} />
                      <Label htmlFor={`${character}-center`} className="cursor-pointer text-sm">
                        Center
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="right" id={`${character}-right`} />
                      <Label htmlFor={`${character}-right`} className="cursor-pointer text-sm">
                        Right
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

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
                      max={800}
                      step={10}
                      className="w-full"
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
                      max={800}
                      step={10}
                      className="w-full"
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

