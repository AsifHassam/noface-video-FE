"use client";

import { useState } from "react";
import { Check, Type } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SubtitleStyle, SubtitleFontFamily } from "@/types";
import { SUBTITLE_STYLES } from "@/lib/data/subtitle-styles";
import { cn } from "@/lib/utils";

type SubtitleStyleSelectorProps = {
  value: SubtitleStyle;
  onChange: (style: SubtitleStyle) => void;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
  fontFamily?: SubtitleFontFamily;
  onFontFamilyChange?: (font: SubtitleFontFamily) => void;
  // Karaoke single-line toggle
  singleLine?: boolean;
  onSingleLineChange?: (value: boolean) => void;
  // Single-line mode variant: single word vs 3-word chunk
  singleWord?: boolean;
  onSingleWordChange?: (value: boolean) => void;
  // Karaoke-pink pill color
  karaokePillColor?: string;
  onKaraokePillColorChange?: (color: string) => void;
  // Bold-green accent color
  boldGreenColor?: string;
  onBoldGreenColorChange?: (color: string) => void;
};

export const SubtitleStyleSelector = ({
  value,
  onChange,
  fontSize = 100,
  onFontSizeChange,
  fontFamily = 'bebas-neue',
  onFontFamilyChange,
  singleLine = false,
  onSingleLineChange,
  singleWord = false,
  onSingleWordChange,
  karaokePillColor = '#E96BA8',
  onKaraokePillColorChange,
  boldGreenColor = '#63E443',
  onBoldGreenColorChange,
}: SubtitleStyleSelectorProps) => {
  const [open, setOpen] = useState(false);
  const selectedStyle = SUBTITLE_STYLES.find((s) => s.id === value) || SUBTITLE_STYLES[0];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-black">Subtitle Style</Label>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 rounded-2xl"
          >
            <span className="text-lg">{selectedStyle.icon}</span>
            <span className="flex-1 text-left font-medium text-foreground">{selectedStyle.name}</span>
            <span className="text-xs text-muted-foreground">Change</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Choose Subtitle Style</DialogTitle>
            <DialogDescription>
              Pick a style for your subtitles. TikTok-inspired designs to make your videos pop!
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2 overflow-y-auto pr-2 max-h-[calc(85vh-120px)]">
            {SUBTITLE_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  onChange(style.id);
                  setOpen(false);
                }}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-2xl border-2 bg-muted/30 p-4 text-left transition hover:bg-muted/50",
                  value === style.id
                    ? "border-primary bg-primary/10"
                    : "border-border"
                )}
              >
                {value === style.id && (
                  <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{style.icon}</span>
                  <span className="font-semibold">{style.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {style.description}
                </p>
                {/* Preview */}
                <div className="mt-2 flex min-h-[60px] items-center justify-center rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 p-3">
                  <div
                    className={cn(
                      "text-center",
                      style.containerClassName || "rounded-2xl"
                    )}
                  >
                    {style.id === "karaoke-pink" ? (
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['Sample', 'Text'].map((word, idx) => (
                          <span
                            key={idx}
                            style={{
                              color: '#FFFFFF',
                              marginRight: '2px',
                              display: 'inline-block',
                              textShadow: `0 0 10px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 0, 0, 0.35), 0 0 20px rgba(0, 0, 0, 0.25)`,
                              WebkitTextStroke: '2.5px #000000',
                              paintOrder: 'stroke fill',
                              fontWeight: '800',
                              textTransform: 'uppercase',
                              letterSpacing: '0px',
                              lineHeight: '1.05',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              fontFamily: fontFamily === 'impact' ? 'var(--font-impact)' :
                                         fontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                         fontFamily === 'poppins' ? 'var(--font-poppins)' :
                                         fontFamily === 'futura' ? 'var(--font-futura)' :
                                         fontFamily === 'roboto' ? 'var(--font-roboto)' :
                                         fontFamily === 'inter' ? 'var(--font-inter)' :
                                         fontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                         'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                              ...(idx === 0 ? {
                                backgroundColor: karaokePillColor,
                                padding: '4px 4px',
                                borderRadius: '6px',
                                transform: 'scale(1.12)',
                              } : {})
                            }}
                            className="text-sm md:text-base"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    ) : style.id === "magic-loops" ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['TO', 'MAGIC', 'LOOPS'].map((word, idx) => {
                          const isEmphasized = idx === 1; // "MAGIC" is emphasized
                          return (
                            <span
                              key={idx}
                              style={{
                                color: isEmphasized ? '#6CE846' : '#FFFFFF',
                                WebkitTextStroke: '1px #000000',
                                paintOrder: 'stroke fill',
                                fontWeight: '800',
                                textTransform: 'uppercase',
                                letterSpacing: '0.4px',
                                lineHeight: '1.05',
                                marginRight: '0px',
                                display: 'inline-block',
                                transform: isEmphasized ? 'scale(1.3)' : 'scale(1)',
                                transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                textShadow: `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 2px 4px rgba(0,0,0,0.40)`,
                                WebkitFontSmoothing: 'antialiased',
                                MozOsxFontSmoothing: 'grayscale',
                                fontFamily: fontFamily === 'impact' ? 'var(--font-impact)' :
                                           fontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                           fontFamily === 'poppins' ? 'var(--font-poppins)' :
                                           fontFamily === 'futura' ? 'var(--font-futura)' :
                                           fontFamily === 'roboto' ? 'var(--font-roboto)' :
                                           fontFamily === 'inter' ? 'var(--font-inter)' :
                                           fontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                           'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                                verticalAlign: 'baseline',
                              }}
                              className="text-sm md:text-base"
                            >
                              {word}
                            </span>
                          );
                        })}
                      </div>
                    ) : style.id === "bold-green" ? (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['THIS', 'IS', 'STYLE'].map((word, idx) => {
                          const isEmphasized = idx === 2; // "STYLE" is emphasized
                          return (
                            <span
                              key={idx}
                              style={{
                                color: isEmphasized ? '#63E443' : '#FFFFFF',
                                WebkitTextStroke: '2.5px #000000',
                                paintOrder: 'stroke fill',
                                textShadow: '2px 2px 0px #000000',
                                fontWeight: '900',
                                textTransform: 'uppercase',
                                letterSpacing: '0.2px',
                                lineHeight: '1.0',
                                marginRight: '0px',
                                display: 'inline-block',
                                WebkitFontSmoothing: 'antialiased',
                                MozOsxFontSmoothing: 'grayscale',
                                fontFamily: fontFamily === 'impact' ? 'var(--font-impact)' :
                                           fontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                           fontFamily === 'poppins' ? 'var(--font-poppins)' :
                                           fontFamily === 'futura' ? 'var(--font-futura)' :
                                           fontFamily === 'roboto' ? 'var(--font-roboto)' :
                                           fontFamily === 'inter' ? 'var(--font-inter)' :
                                           fontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                           'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                              }}
                              className="text-sm md:text-base"
                            >
                              {word}
                            </span>
                          );
                        })}
                      </div>
                    ) : style.id === "chip" ? (
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: 'rgba(0, 0, 0, 0.70)',
                          borderRadius: '10px',
                          padding: '6px 14px',
                          color: '#FFFFFF',
                          fontWeight: 700,
                          fontSize: '16px',
                          letterSpacing: '0px',
                          lineHeight: 1.1,
                          textShadow: '0 1px 3px rgba(0,0,0,0.45)',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.28)',
                          fontFamily: fontFamily === 'impact' ? 'var(--font-impact)' :
                                     fontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                     fontFamily === 'poppins' ? 'var(--font-poppins)' :
                                     fontFamily === 'futura' ? 'var(--font-futura)' :
                                     fontFamily === 'roboto' ? 'var(--font-roboto)' :
                                     fontFamily === 'inter' ? 'var(--font-inter)' :
                                     fontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                     'var(--font-inter), system-ui, sans-serif',
                        }}
                      >
                        Sample text
                      </span>
                    ) : (
                    <p
                      className={cn(style.className, "text-sm md:text-base")}
                      style={{
                        ...(style.id === "outlined"
                          ? {
                              textShadow: `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000`,
                            }
                          : {}),
                        fontFamily: fontFamily === 'impact' ? 'var(--font-impact)' :
                                   fontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                                   fontFamily === 'poppins' ? 'var(--font-poppins)' :
                                   fontFamily === 'futura' ? 'var(--font-futura)' :
                                   fontFamily === 'roboto' ? 'var(--font-roboto)' :
                                   fontFamily === 'inter' ? 'var(--font-inter)' :
                                     fontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' :
                                   'var(--font-bebas-neue), Arial Black, Arial, sans-serif',
                      }}
                    >
                      Sample Text
                    </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Font Family Control */}
      {onFontFamilyChange && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium flex items-center gap-2 text-black">
            <Type className="h-4 w-4" />
            Font Family
          </Label>
          <Select
            value={fontFamily}
            onValueChange={(value) => onFontFamilyChange(value as SubtitleFontFamily)}
          >
            <SelectTrigger className="w-full rounded-xl">
              <SelectValue>
                <span style={{
                  fontFamily: fontFamily === 'bebas-neue' ? 'var(--font-bebas-neue)' :
                             fontFamily === 'impact' ? 'var(--font-impact)' :
                             fontFamily === 'montserrat' ? 'var(--font-montserrat)' :
                             fontFamily === 'poppins' ? 'var(--font-poppins)' :
                             fontFamily === 'futura' ? 'var(--font-futura)' :
                             fontFamily === 'roboto' ? 'var(--font-roboto)' :
                             fontFamily === 'inter' ? 'var(--font-inter)' :
                             fontFamily === 'zy-resolve' ? 'var(--font-zy-resolve)' : 'inherit'
                }}>
                  {fontFamily === 'bebas-neue' ? 'Bebas Neue' :
                   fontFamily === 'impact' ? 'Impact' :
                   fontFamily === 'montserrat' ? 'Montserrat' :
                   fontFamily === 'poppins' ? 'Poppins' :
                   fontFamily === 'futura' ? 'Futura' :
                   fontFamily === 'roboto' ? 'Roboto' :
                   fontFamily === 'inter' ? 'Inter' :
                   fontFamily === 'zy-resolve' ? 'ZY Resolve' : 'Bebas Neue'}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bebas-neue" style={{ fontFamily: 'var(--font-bebas-neue)' }}>
                Bebas Neue
              </SelectItem>
              <SelectItem value="impact" style={{ fontFamily: 'var(--font-impact)' }}>
                Impact
              </SelectItem>
              <SelectItem value="montserrat" style={{ fontFamily: 'var(--font-montserrat)' }}>
                Montserrat
              </SelectItem>
              <SelectItem value="poppins" style={{ fontFamily: 'var(--font-poppins)' }}>
                Poppins
              </SelectItem>
              <SelectItem value="futura" style={{ fontFamily: 'var(--font-futura)' }}>
                Futura
              </SelectItem>
              <SelectItem value="roboto" style={{ fontFamily: 'var(--font-roboto)' }}>
                Roboto
              </SelectItem>
              <SelectItem value="inter" style={{ fontFamily: 'var(--font-inter)' }}>
                Inter
              </SelectItem>
              <SelectItem value="zy-resolve" style={{ fontFamily: 'var(--font-zy-resolve)' }}>
                ZY Resolve
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Font Size Control */}
      {onFontSizeChange && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-2 text-white">
              <Type className="h-4 w-4" />
              Font Size
            </Label>
            <span className="text-sm text-muted-foreground">{fontSize}%</span>
          </div>
          <Slider
            min={50}
            max={200}
            step={5}
            value={[fontSize]}
            onValueChange={([val]) => onFontSizeChange(val)}
            className="w-full"
          />
        </div>
      )}

      {/* Single-line Toggle (applies to all styles) */}
      {onSingleLineChange && (
        <div className="space-y-1.5">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!!singleLine}
              onChange={(e) => onSingleLineChange(e.target.checked)}
              className="h-4 w-4"
            />
            <span>Single-line subtitles (show only current word)</span>
          </label>
          <p className="text-xs text-muted-foreground">
            Keeps the screen clean by showing one word at a time, synced to audio.
          </p>
        </div>
      )}

      {/* Single-line variant controls */}
      {singleLine && onSingleWordChange && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-white">Single-line Variant</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="singleline-variant"
                checked={!!singleWord}
                onChange={() => onSingleWordChange(true)}
              />
              <span>Single word</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="singleline-variant"
                checked={!singleWord}
                onChange={() => onSingleWordChange(false)}
              />
              <span>3-word chunks</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose whether to show a single word or a moving 3-word chunk.
          </p>
        </div>
      )}

      {/* Karaoke-pink pill color picker */}
      {value === 'karaoke-pink' && onKaraokePillColorChange && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-white">Pill Highlight Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={karaokePillColor}
              onChange={(e) => onKaraokePillColorChange(e.target.value)}
              className="h-10 w-20 cursor-pointer rounded-lg border-2 border-border"
            />
            <input
              type="text"
              value={karaokePillColor}
              onChange={(e) => onKaraokePillColorChange(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="#E96BA8"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Choose the color for the highlighted word background.
          </p>
        </div>
      )}

      {/* Bold-green accent color picker */}
      {value === 'bold-green' && onBoldGreenColorChange && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-white">Accent Word Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={boldGreenColor}
              onChange={(e) => onBoldGreenColorChange(e.target.value)}
              className="h-9 w-16 cursor-pointer rounded-lg border-2 border-border"
            />
            <input
              type="text"
              value={boldGreenColor}
              onChange={(e) => onBoldGreenColorChange(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              placeholder="#63E443"
            />
          </div>
          <p className="text-xs text-muted-foreground leading-tight">
            Choose the color for the highlighted accent word.
          </p>
        </div>
      )}
    </div>
  );
};

