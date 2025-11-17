import type { SubtitleSegment } from "@/types";

/**
 * Configuration for subtitle splitting
 */
const MAX_WORDS_PER_SEGMENT = 4;
const MIN_SEGMENT_DURATION_MS = 700;
const WORDS_PER_MINUTE = 150;

/**
 * Calculate duration based on word count
 */
function calculateDuration(wordCount: number): number {
  const baseDuration = Math.round((wordCount / WORDS_PER_MINUTE) * 60_000);
  return Math.max(MIN_SEGMENT_DURATION_MS, baseDuration);
}

/**
 * Split text at natural break points (commas, conjunctions, etc.)
 */
function findNaturalBreakPoints(text: string): number[] {
  const words = text.split(/\s+/);
  const breakPoints: number[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Break after punctuation
    if (word.match(/[,;]$/)) {
      breakPoints.push(i + 1);
    }
    // Break before common conjunctions
    else if (['and', 'but', 'or', 'so', 'yet', 'because', 'when', 'while', 'where'].includes(word.toLowerCase())) {
      if (i > 0) breakPoints.push(i);
    }
    // Break after "that", "which", "who"
    else if (['that', 'which', 'who'].includes(word.toLowerCase())) {
      breakPoints.push(i + 1);
    }
  }
  
  return breakPoints;
}

/**
 * Split a long subtitle segment into multiple shorter segments
 * IMPORTANT: This creates overlapping subtitles that show sequentially during the SAME audio
 * to maintain sync with pre-recorded audio. The audio timing cannot be changed.
 */
export function splitLongSubtitle(segment: SubtitleSegment): SubtitleSegment[] {
  const words = segment.text.split(/\s+/).filter(Boolean);
  
  // If short enough, return as-is
  if (words.length <= MAX_WORDS_PER_SEGMENT) {
    return [segment];
  }
  
  // Find natural break points
  const naturalBreaks = findNaturalBreakPoints(segment.text);
  
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);
    
    // Check if we should break here
    const shouldBreak = 
      currentChunk.length >= MAX_WORDS_PER_SEGMENT ||
      (naturalBreaks.includes(i + 1) && currentChunk.length >= 2);
    
    if (shouldBreak && i < words.length - 1) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }
  
  // Add remaining words
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  // CRITICAL: Keep the EXACT same timing as the original segment
  // Split the time proportionally based on word count so subtitles appear sequentially
  // but all within the same audio timeframe
  const totalDuration = segment.endMs - segment.startMs;
  const result: SubtitleSegment[] = [];
  let currentTime = segment.startMs;
  
  chunks.forEach((chunk, index) => {
    const chunkWords = chunk.split(/\s+/).length;
    const totalWords = words.length;
    
    // Distribute duration proportionally based on word count
    // This ensures each chunk appears for an appropriate time during the audio
    let duration: number;
    if (index === chunks.length - 1) {
      // Last chunk gets remaining time to exactly match original end time
      duration = segment.endMs - currentTime;
    } else {
      duration = Math.round((chunkWords / totalWords) * totalDuration);
      // Ensure minimum duration for readability
      duration = Math.max(MIN_SEGMENT_DURATION_MS, duration);
    }
    
    result.push({
      startMs: currentTime,
      endMs: currentTime + duration,
      speaker: segment.speaker,
      text: chunk,
    });
    
    currentTime += duration;
  });
  
  return result;
}

/**
 * Split all long subtitles in a list of segments
 */
export function splitAllLongSubtitles(segments: SubtitleSegment[]): SubtitleSegment[] {
  const result: SubtitleSegment[] = [];
  
  segments.forEach(segment => {
    const split = splitLongSubtitle(segment);
    result.push(...split);
  });
  
  return result;
}

/**
 * Check if a subtitle segment is too long
 */
export function isSubtitleTooLong(segment: SubtitleSegment): boolean {
  const words = segment.text.split(/\s+/).filter(Boolean);
  return words.length > MAX_WORDS_PER_SEGMENT;
}

/**
 * Get recommendations for a subtitle segment
 */
export function getSubtitleRecommendations(segment: SubtitleSegment): {
  status: 'good' | 'consider-splitting' | 'should-split';
  wordCount: number;
  recommendedFontSize: number;
  message: string;
} {
  const words = segment.text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const duration = segment.endMs - segment.startMs;
  const wordsPerMinute = (wordCount / duration) * 60_000;
  
  if (wordCount <= 4) {
    return {
      status: 'good',
      wordCount,
      recommendedFontSize: 100,
      message: 'Perfect length! Easy to read.',
    };
  } else if (wordCount <= 6) {
    return {
      status: 'consider-splitting',
      wordCount,
      recommendedFontSize: 90,
      message: `Consider splitting into ${Math.ceil(wordCount / 4)} segments for better readability.`,
    };
  } else {
    return {
      status: 'should-split',
      wordCount,
      recommendedFontSize: 80,
      message: `This is too long! Split into ${Math.ceil(wordCount / 4)} segments.`,
    };
  }
}

