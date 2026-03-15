export interface AvatarWizardState {
  step: number;
  setStep: (n: number) => void;
  mode: "selfie" | "studio" | null;
  setMode: (m: "selfie" | "studio" | null) => void;
  sourceType: "upload" | "random" | "own" | null;
  setSourceType: (s: "upload" | "random" | "own" | null) => void;
  uploadedImageUrl: string | null;
  setUploadedImageUrl: (u: string | null) => void;
  gender: string;
  setGender: (g: string) => void;
  vibe: string;
  setVibe: (v: string) => void;
  generatedUrls: string[];
  setGeneratedUrls: (u: string[]) => void;
  selectedAvatarUrl: string | null;
  setSelectedAvatarUrl: (u: string | null) => void;
  animationVideoUrl: string | null;
  setAnimationVideoUrl: (u: string | null) => void;
  motionStyle: "calm" | "expressive";
  setMotionStyle: (m: "calm" | "expressive") => void;
  voiceType: "upload" | "preset" | null;
  setVoiceType: (t: "upload" | "preset" | null) => void;
  voiceReferenceUrl: string | null;
  setVoiceReferenceUrl: (u: string | null) => void;
  presetVoiceName: string | null;
  setPresetVoiceName: (n: string | null) => void;
  characterName: string;
  setCharacterName: (n: string) => void;
  error: string | null;
  setError: (e: string | null) => void;
  /** When set, we're editing an existing character (load prefill, PATCH on save). */
  characterId: string | null;
}
