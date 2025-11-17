"use client";

import { create } from "zustand";
import { projectsApi, charactersApi, scriptApi } from "@/lib/api/projects";
import { v4 as uuid } from "uuid";
import type {
  Character,
  OverlayItem,
  Project,
  ProjectType,
  RenderStatus,
  ScriptLine,
  SubtitleStyle,
  SubtitlePosition,
  TextOverlay,
} from "@/types";
import { CHARACTERS } from "@/lib/data/characters";
import { generateMockFromScript } from "@/lib/utils/srt";

type DraftProject = {
  id: string;
  type: ProjectType;
  title: string;
  status: RenderStatus | null;
  characters: { A: Character | null; B: Character | null };
  script: ScriptLine[];
  scriptInput: string;
  overlays: OverlayItem[];
  textOverlays: TextOverlay[];
  srtText: string;
  originalSrtText?: string;
  previewUrl?: string | null;
  finalUrl?: string | null;
  durationSec?: number | null;
  subtitleEnabled: boolean;
  subtitleStyle: SubtitleStyle;
  subtitlePosition: SubtitlePosition;
  subtitleFontSize: number;
  updatedAt: string;
};

type ProjectStoreState = {
  projects: Project[];
  draft: DraftProject;
  loading: boolean;
  error: string | null;
  
  // Project management
  loadProjects: () => Promise<void>;
  createProjectFromDraft: (userId: string) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  
  // Draft management
  startDraft: () => DraftProject;
  updateDraft: (updates: Partial<DraftProject>) => void;
  setDraftCharacters: (characters: Character[]) => void;
  clearDraft: () => void;
  
  // Video generation
  enqueuePreview: (projectId?: string) => Promise<void>;
  simulateRender: (projectId?: string) => Promise<void>;
};

const initialDraft = (): DraftProject => ({
  id: uuid(),
  type: "TWO_CHAR_CONVO",
  title: "Untitled Conversation",
  status: null,
  characters: { A: null, B: null },
  script: [],
  scriptInput: "",
  overlays: [],
  textOverlays: [],
  srtText: "",
  originalSrtText: undefined,
  previewUrl: null,
  finalUrl: null,
  durationSec: null,
  subtitleEnabled: true,
  subtitleStyle: "classic",
  subtitlePosition: { x: 50, y: 60 },
  subtitleFontSize: 100,
  updatedAt: new Date().toISOString(),
});

export const useProjectStore = create<ProjectStoreState>()((set, get) => ({
  projects: [],
  draft: initialDraft(),
  loading: false,
  error: null,

  /**
   * Load all projects from API
   */
  loadProjects: async () => {
    try {
      set({ loading: true, error: null });
      const { projects } = await projectsApi.list();
      
      // Convert API format to local format if needed
      const formattedProjects = projects.map((p: any) => ({
        ...p,
        userId: p.user_id,
        characters: p.characters || { A: null, B: null },
        script: p.script_segments || [],
        overlays: p.text_overlays || [],
        textOverlays: p.text_overlays || [],
        srtText: p.srt_text || "",
        previewUrl: p.preview_url,
        finalUrl: p.final_url,
        durationSec: p.duration_seconds,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
      
      set({ projects: formattedProjects, loading: false });
    } catch (error) {
      console.error("Failed to load projects:", error);
      set({ error: "Failed to load projects", loading: false });
    }
  },

  /**
   * Create a new project from draft
   */
  createProjectFromDraft: async (userId: string) => {
    const currentDraft = get().draft;

    if (!currentDraft.title.trim()) {
      console.error("Project title is required");
      return null;
    }

    try {
      set({ loading: true, error: null });

      // 1. Create project in API
      const { project } = await projectsApi.create({
        title: currentDraft.title,
        description: `Created on ${new Date().toLocaleDateString()}`,
        type: currentDraft.type,
        backgroundId: "minecraft",
      });

      console.log("✅ Project created:", project.id);

      // 2. Add characters if they exist
      const characters: { A: any; B: any } = { A: null, B: null };
      
      if (currentDraft.characters.A) {
        const result = await charactersApi.create(project.id, {
          name: currentDraft.characters.A.name,
          voice_id: currentDraft.characters.A.voiceId ?? undefined,
          voice_provider: "elevenlabs",
          avatar_url: currentDraft.characters.A.avatarUrl,
          position: 0,
        });
        const character = (result as any).character;
        characters.A = {
          ...currentDraft.characters.A,
          id: character.id,
        };
        console.log("✅ Character A created:", character.id);
      }

      if (currentDraft.characters.B) {
        const result = await charactersApi.create(project.id, {
          name: currentDraft.characters.B.name,
          voice_id: currentDraft.characters.B.voiceId ?? undefined,
          voice_provider: "elevenlabs",
          avatar_url: currentDraft.characters.B.avatarUrl,
          position: 1,
        });
        const character = (result as any).character;
        characters.B = {
          ...currentDraft.characters.B,
          id: character.id,
        };
        console.log("✅ Character B created:", character.id);
      }

      // 3. Add script segments if they exist
      if (currentDraft.script.length > 0 && characters.A && characters.B) {
        const segments = currentDraft.script.map((line, index) => ({
          character_id: line.speaker === "A" ? characters.A.id : characters.B.id,
          content: line.text,
          position: index,
        }));

        await scriptApi.bulkUpsert(project.id, segments);
        console.log(`✅ Script created: ${segments.length} segments`);
      }

      // 4. Create local project object
      const newProject: Project = {
        id: project.id,
        userId: userId,
        type: currentDraft.type,
        title: currentDraft.title,
        status: "QUEUED",
        characters: characters as { A: Character; B: Character },
        script: currentDraft.script,
        overlays: currentDraft.overlays,
        textOverlays: currentDraft.textOverlays,
        srtText: currentDraft.srtText,
        previewUrl: null,
        finalUrl: null,
        durationSec: null,
        createdAt: (project as any).created_at || new Date().toISOString(),
        updatedAt: (project as any).updated_at || new Date().toISOString(),
      };

      // Add to local state
      set((state) => ({
        projects: [...state.projects, newProject],
        loading: false,
      }));

      // Clear draft
      get().clearDraft();

      return newProject;
    } catch (error) {
      console.error("Failed to create project:", error);
      set({ error: "Failed to create project", loading: false });
      return null;
    }
  },

  /**
   * Delete a project
   */
  deleteProject: async (id: string) => {
    try {
      set({ loading: true, error: null });
      await projectsApi.delete(id);
      
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        loading: false,
      }));
      
      console.log("✅ Project deleted:", id);
    } catch (error) {
      console.error("Failed to delete project:", error);
      set({ error: "Failed to delete project", loading: false });
      throw error;
    }
  },

  /**
   * Update a project
   */
  updateProject: async (id: string, updates: Partial<Project>) => {
    try {
      set({ loading: true, error: null });
      
      // Convert to API format
      const apiUpdates: any = {};
      if (updates.title) apiUpdates.title = updates.title;
      if (updates.status) apiUpdates.status = updates.status;
      if (updates.previewUrl) apiUpdates.preview_url = updates.previewUrl;
      if (updates.finalUrl) apiUpdates.final_url = updates.finalUrl;
      if (updates.srtText) apiUpdates.srt_text = updates.srtText;
      
      await projectsApi.update(id, apiUpdates);
      
      // Update local state
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ),
        loading: false,
      }));
      
      console.log("✅ Project updated:", id);
    } catch (error) {
      console.error("Failed to update project:", error);
      set({ error: "Failed to update project", loading: false });
      throw error;
    }
  },

  /**
   * Start a new draft
   */
  startDraft: () => {
    const draft = initialDraft();
    set({ draft });
    return draft;
  },

  /**
   * Update draft
   */
  updateDraft: (updates: Partial<DraftProject>) => {
    set((state) => ({
      draft: {
        ...state.draft,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  /**
   * Set draft characters
   */
  setDraftCharacters: (characters: Character[]) => {
    const [charA, charB] = characters;
    set((state) => ({
      draft: {
        ...state.draft,
        characters: {
          A: charA || null,
          B: charB || null,
        },
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  /**
   * Clear draft
   */
  clearDraft: () => {
    set({ draft: initialDraft() });
  },

  /**
   * Generate preview video (kept for compatibility)
   */
  enqueuePreview: async (projectId?: string) => {
    // TODO: Implement preview generation API call
    console.log("Preview generation not yet implemented");
  },

  /**
   * Generate final video (kept for compatibility)
   */
  simulateRender: async (projectId?: string) => {
    // TODO: Implement final video generation API call
    console.log("Final render not yet implemented");
  },
}));

