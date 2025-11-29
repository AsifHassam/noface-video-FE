/**
 * Duration estimation utilities
 * Matches the calculation used in ScriptEditor component
 */

// Character limits: 1200 chars ≈ 50 seconds (24 chars/second)
const CHARS_PER_50_SEC = 1200;

/**
 * Estimate video duration from total character count
 * Uses the same formula as ScriptEditor: (charCount / 1200) * 50
 * This equals approximately 24 characters per second
 */
export function estimateDurationFromCharCount(charCount: number): number {
  return Math.round((charCount / CHARS_PER_50_SEC) * 50);
}

/**
 * Estimate video duration from script lines (for two-char conversations)
 * For two-char, we should use scriptInput (full text including speaker names)
 * to match the ScriptEditor calculation exactly
 */
export function estimateDurationFromScriptLines(
  scriptLines: Array<{ text: string; speaker?: string }> | undefined,
  scriptInput?: string
): number {
  // If scriptInput is available, use it to match ScriptEditor exactly
  // ScriptEditor uses value.length which includes [Speaker]: text format
  if (scriptInput !== undefined && scriptInput !== null) {
    return estimateDurationFromCharCount(scriptInput.length);
  }
  
  // Fallback: count characters from parsed lines
  if (!scriptLines || scriptLines.length === 0) return 0;
  
  let totalChars = 0;
  scriptLines.forEach((line) => {
    totalChars += line.text.trim().length;
  });
  
  return estimateDurationFromCharCount(totalChars);
}

/**
 * Estimate video duration from script text (for story narration)
 * Uses the same formula as ScriptEditor
 */
export function estimateDurationFromScriptText(scriptText: string | undefined): number {
  if (!scriptText || !scriptText.trim()) return 0;
  
  // Calculate total characters in script
  const totalChars = scriptText.trim().length;
  
  // Use the same formula as ScriptEditor
  return estimateDurationFromCharCount(totalChars);
}

