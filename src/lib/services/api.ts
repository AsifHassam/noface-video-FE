"use client";

import type { Character, OverlayItem, Project, ScriptLine } from "@/types";
import { useProjectStore } from "@/lib/stores/project-store";
import { useCharacterStore } from "@/lib/stores/character-store";
import { config } from "@/lib/config";

type VideoGenerationResponse = {
  projectId: string;
  videoUrl: string;
  conversations: Array<{
    speaker: string;
    text: string;
    latexEquation?: string;
    startMs?: number;
    endMs?: number;
    duration?: number;
  }>;
  ttsProvider: string;
  durationSec?: number;
};

/**
 * Format script lines into the format expected by the remotion server
 * Converts { speaker: "A"|"B", text: string } to "CharacterName: text"
 */
function formatScriptForServer(
  script: ScriptLine[],
  characters: { A: Character | null; B: Character | null }
): string {
  return script
    .map((line) => {
      const characterName = line.speaker === "A" 
        ? (characters.A?.name || "Speaker A")
        : (characters.B?.name || "Speaker B");
      return `${characterName}: ${line.text}`;
    })
    .join("\n");
}

export const api = {
  async listCharacters() {
    return useCharacterStore.getState().characters;
  },
  async fetchProjects(): Promise<Project[]> {
    return useProjectStore.getState().projects;
  },
  async createProject(params: {
    userId: string;
    title: string;
    script: ScriptLine[];
    overlays: OverlayItem[];
  }) {
    const store = useProjectStore.getState();
    store.updateDraft({
      title: params.title,
      script: params.script,
      overlays: params.overlays,
    });
    return useProjectStore.getState().createProjectFromDraft(params.userId);
  },
  async deleteProject(id: string) {
    useProjectStore.getState().deleteProject(id);
  },
  async enqueuePreview(id?: string) {
    useProjectStore.getState().enqueuePreview(id);
  },
  async simulateRender(id?: string) {
    useProjectStore.getState().simulateRender(id);
  },
  
  /**
   * Generate a preview video using the free TTS endpoint
   */
  async generateVideoPreview(params: {
    script: ScriptLine[];
    characters: { A: Character | null; B: Character | null };
    backgroundId?: string;
  }): Promise<VideoGenerationResponse> {
    const formattedScript = formatScriptForServer(params.script, params.characters);
    
    const formData = new FormData();
    formData.append("script", formattedScript);
    formData.append("backgroundId", params.backgroundId || "minecraft");

    const response = await fetch(
      `${config.remotionServerUrl}/generate-video-free`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      projectId: data.projectId,
      videoUrl: data.videoUrl,
      conversations: data.conversations || [],
      ttsProvider: data.ttsProvider || "google-tts",
      durationSec: data.durationSec,
    };
  },

  /**
   * Generate final video with text overlays and subtitle customizations
   */
  async generateFinalVideo(params: {
    script: ScriptLine[];
    characters: { A: Character | null; B: Character | null };
    backgroundId?: string;
    textOverlays: any[]; // Array of text overlay objects
    subtitleCustomizations: {
      style: string;
      position: { x: number; y: number };
      fontSize: number;
    } | null;
    srtText: string; // Edited subtitle text
    imageOverlays?: any[]; // Array of image overlay objects
  }): Promise<VideoGenerationResponse> {
    const formattedScript = formatScriptForServer(params.script, params.characters);
    
    const formData = new FormData();
    formData.append("script", formattedScript);
    formData.append("backgroundId", params.backgroundId || "minecraft");
    formData.append("textOverlays", JSON.stringify(params.textOverlays));
    formData.append("subtitleCustomizations", JSON.stringify(params.subtitleCustomizations));
    formData.append("srtText", params.srtText);
    if (params.imageOverlays && params.imageOverlays.length > 0) {
      formData.append("imageOverlays", JSON.stringify(params.imageOverlays));
    }

    const response = await fetch(
      `${config.remotionServerUrl}/generate-video-final`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      projectId: data.projectId,
      videoUrl: data.videoUrl,
      conversations: data.conversations || [],
      ttsProvider: data.ttsProvider || "google-free",
      durationSec: data.durationSec,
    };
  },
};
