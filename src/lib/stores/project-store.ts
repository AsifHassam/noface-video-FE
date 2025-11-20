"use client";

import { create } from "zustand";
import { projectsApi, charactersApi, scriptApi, renderApi } from "@/lib/api/projects";
import { v4 as uuid } from "uuid";
import type {
  BackgroundId,
  Character,
  OverlayItem,
  Project,
  ProjectType,
  RenderStatus,
  ScriptLine,
  SubtitleStyle,
  SubtitlePosition,
  TextOverlay,
  ImageOverlay,
  CharacterSizes,
  CharacterPositions,
} from "@/types";
import { CHARACTERS } from "@/lib/data/characters";
import { generateMockFromScript, parseSrtText } from "@/lib/utils/srt";
import { config } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type DraftProject = {
  id: string;
  type: ProjectType;
  title: string;
  status: RenderStatus | null;
  characters: { A: Character | null; B: Character | null };
  script: ScriptLine[];
  scriptInput: string;
  backgroundId?: BackgroundId | null;
  overlays: OverlayItem[];
  textOverlays: TextOverlay[];
  imageOverlays: ImageOverlay[];
  srtText: string;
  originalSrtText?: string;
  previewUrl?: string | null;
  finalUrl?: string | null;
  durationSec?: number | null;
  subtitleEnabled: boolean;
  subtitleStyle: SubtitleStyle;
  subtitlePosition: SubtitlePosition;
  subtitleFontSize: number;
  subtitleSingleLine?: boolean;
  subtitleSingleWord?: boolean;
  characterSizes?: CharacterSizes;
  characterPositions?: CharacterPositions;
  renderProgress?: number;
  playbackRate?: number;
  queuePosition?: number;
  estimatedWaitTime?: number;
  updatedAt: string;
};

type ProjectStoreState = {
  projects: Project[];
  draft: DraftProject;
  loading: boolean;
  error: string | null;
  renderJobSubscription: RealtimeChannel | null;
  realtimeConnected: boolean;
  
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
  loadProjectIntoDraft: (projectId: string) => Promise<void>;
  
  // Video generation
  enqueuePreview: (projectId?: string, userId?: string) => Promise<void>;
  simulateRender: (projectId?: string) => Promise<void>;
  
  // Realtime subscriptions
  subscribeToRenderJob: (jobId: string, projectId: string) => void;
  unsubscribeFromRenderJob: () => void;
};

const initialDraft = (): DraftProject => ({
  id: uuid(),
  type: "TWO_CHAR_CONVO",
  title: "Untitled Conversation",
  status: null,
  characters: { A: null, B: null },
  script: [],
  scriptInput: "",
  backgroundId: null,
  overlays: [],
  textOverlays: [],
  imageOverlays: [],
  srtText: "",
  originalSrtText: undefined,
  previewUrl: null,
  finalUrl: null,
  durationSec: null,
  subtitleEnabled: true,
  subtitleStyle: "classic",
  subtitlePosition: { x: 50, y: 60 },
  subtitleFontSize: 100,
  subtitleSingleLine: false,
  subtitleSingleWord: false,
  characterSizes: {
    Peter: { width: 400, height: 500 },
    Stewie: { width: 350, height: 450 },
    Rick: { width: 800, height: 1000 }, // 2x default size
    Brian: { width: 350, height: 450 },
    Morty: { width: 560, height: 720 }, // 2x default size, reduced by 20%
  },
  characterPositions: {
    Peter: 'left',
    Stewie: 'right',
    Rick: 'left',
    Brian: 'right',
    Morty: 'right',
  },
  updatedAt: new Date().toISOString(),
});

export const useProjectStore = create<ProjectStoreState>()((set, get) => ({
  projects: [],
  draft: initialDraft(),
  loading: false,
  error: null,
  renderJobSubscription: null,
  realtimeConnected: false,

  /**
   * Load all projects from API
   */
  loadProjects: async () => {
    try {
      set({ loading: true, error: null });
      const { projects } = await projectsApi.list();
      
      // Convert API format to local format if needed
      const formattedProjects = projects.map((p: any) => {
        // Extract subtitle settings from metadata
        const metadata = p.metadata || {};
        // Extract type from metadata (projects table doesn't have a type column, it's in metadata)
        const projectType = metadata.type || 'TWO_CHAR_CONVO'; // Default to TWO_CHAR_CONVO if not set
        
        return {
          ...p,
          userId: p.user_id,
          type: projectType as ProjectType, // Set type from metadata
          characters: p.characters || { A: null, B: null },
          script: p.script_segments || [],
          overlays: p.text_overlays || [],
          textOverlays: p.text_overlays || [],
          srtText: p.srt_text || "",
          previewUrl: p.preview_url,
          finalUrl: p.final_url,
          durationSec: p.duration_seconds,
          subtitleStyle: metadata.subtitleStyle,
          subtitlePosition: metadata.subtitlePosition,
          subtitleFontSize: metadata.subtitleFontSize,
          subtitleSingleLine: metadata.subtitleSingleLine,
          subtitleSingleWord: metadata.subtitleSingleWord,
          subtitleEnabled: metadata.subtitleEnabled,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
      });
      
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
    console.log("🟡 createProjectFromDraft called with userId:", userId);
    const currentDraft = get().draft;
    console.log("🟡 Current draft:", currentDraft);

    if (!currentDraft.title.trim()) {
      console.error("❌ Project title is required");
      return null;
    }

    try {
      set({ loading: true, error: null });

      // Generate mock subtitles if they don't exist
      let draftToSave = currentDraft;
      if (!currentDraft.srtText && currentDraft.script.length > 0) {
        console.log("📝 Generating mock subtitles from script...");
        const mockSrt = generateMockFromScript(currentDraft.script);
        get().updateDraft({ srtText: mockSrt });
        draftToSave = { ...currentDraft, srtText: mockSrt };
      }

      console.log("🟡 Calling projectsApi.create...");
      // 1. Create project in API
      const { project } = await projectsApi.create({
        title: draftToSave.title,
        description: `Created on ${new Date().toLocaleDateString()}`,
        type: draftToSave.type,
        backgroundId: draftToSave.backgroundId || "minecraft",
      });

      console.log("✅ Project created:", project.id);

      // 2. Add characters if they exist
      const characters: { A: any; B: any } = { A: null, B: null };
      
      if (currentDraft.characters.A) {
        const charA = currentDraft.characters.A;
        const result = await charactersApi.create(project.id, {
          name: charA.name,
          voice_id: charA.voiceId ?? undefined,
          voice_provider: "elevenlabs",
          avatar_url: (charA as any).imageUrl || (charA as any).avatar || '',
          position: 0,
        });
        characters.A = {
          ...charA,
          id: (result as any).character.id,
        };
        console.log("✅ Character A created:", (result as any).character.id);
      }

      if (currentDraft.characters.B) {
        const charB = currentDraft.characters.B;
        const result = await charactersApi.create(project.id, {
          name: charB.name,
          voice_id: charB.voiceId ?? undefined,
          voice_provider: "elevenlabs",
          avatar_url: (charB as any).imageUrl || (charB as any).avatar || '',
          position: 1,
        });
        characters.B = {
          ...charB,
          id: (result as any).character.id,
        };
        console.log("✅ Character B created:", (result as any).character.id);
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

      // 4. Save subtitles, text overlays, and settings
      const updates: any = {};
      
      if (draftToSave.srtText) {
        updates.srt_text = draftToSave.srtText;
      }
      
      // Save text overlays if they exist
      if (draftToSave.textOverlays && draftToSave.textOverlays.length > 0) {
        updates.text_overlays = draftToSave.textOverlays;
        console.log(`💾 Saving ${draftToSave.textOverlays.length} text overlay(s) to project...`);
      }
      
      // Save image overlays if they exist
      if (draftToSave.imageOverlays && draftToSave.imageOverlays.length > 0) {
        updates.image_overlays = draftToSave.imageOverlays;
        console.log(`🖼️ Saving ${draftToSave.imageOverlays.length} image overlay(s) to project...`);
      }
      
      // Store subtitle settings and character sizes in metadata
      const metadata: any = { type: draftToSave.type };
      if (draftToSave.subtitleStyle) {
        metadata.subtitleStyle = draftToSave.subtitleStyle;
      }
      if (draftToSave.subtitlePosition) {
        metadata.subtitlePosition = draftToSave.subtitlePosition;
      }
      if (draftToSave.subtitleFontSize) {
        metadata.subtitleFontSize = draftToSave.subtitleFontSize;
      }
      if (draftToSave.subtitleSingleLine !== undefined) {
        metadata.subtitleSingleLine = draftToSave.subtitleSingleLine;
      }
      if (draftToSave.subtitleSingleWord !== undefined) {
        metadata.subtitleSingleWord = draftToSave.subtitleSingleWord;
      }
      if (draftToSave.subtitleEnabled !== undefined) {
        metadata.subtitleEnabled = draftToSave.subtitleEnabled;
      }
      if (draftToSave.playbackRate !== undefined) {
        metadata.playbackRate = draftToSave.playbackRate;
      }
      if (draftToSave.characterSizes) {
        metadata.characterSizes = draftToSave.characterSizes;
      }
      if (draftToSave.characterPositions) {
        metadata.characterPositions = draftToSave.characterPositions;
      }
      
      if (Object.keys(updates).length > 0 || Object.keys(metadata).length > 1) {
        updates.metadata = metadata;
        console.log("💬 Saving subtitle and overlay data to project...");
        await projectsApi.update(project.id, updates);
        console.log(`✅ Subtitles and overlays saved to project`);
      }

      // 5. Create local project object
      const newProject: Project = {
        id: project.id,
        userId: userId,
        type: currentDraft.type,
        title: currentDraft.title,
        status: "QUEUED" as RenderStatus,
        characters: characters,
        script: currentDraft.script,
        overlays: currentDraft.overlays,
        textOverlays: currentDraft.textOverlays,
        imageOverlays: currentDraft.imageOverlays,
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

      // DON'T clear draft yet - user is still on preview page
      // Draft will be cleared when they navigate away or click "Finish"
      
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
      if (updates.textOverlays) {
        apiUpdates.text_overlays = updates.textOverlays;
        console.log('💾 Sending text_overlays to API:', {
          count: updates.textOverlays.length,
          overlays: updates.textOverlays
        });
      }
      if (updates.imageOverlays) {
        apiUpdates.image_overlays = updates.imageOverlays;
        console.log('🖼️ Sending image_overlays to API:', {
          count: updates.imageOverlays.length,
          overlays: updates.imageOverlays
        });
      }
      
      // Handle subtitle settings, character sizes, and positions - need to merge with existing metadata
      if (updates.subtitleStyle || updates.subtitlePosition || updates.subtitleFontSize !== undefined || updates.subtitleEnabled !== undefined || (updates as any).characterSizes || (updates as any).characterPositions) {
        // Fetch current project to get existing metadata
        try {
          const { project: currentProject } = await projectsApi.get(id);
          const existingMetadata = (currentProject as any).metadata || {};
          
          // Merge subtitle settings and character sizes into metadata
          const metadata = {
            ...existingMetadata,
            type: existingMetadata.type || 'TWO_CHAR_CONVO',
          };
          
          if (updates.subtitleStyle !== undefined) metadata.subtitleStyle = updates.subtitleStyle;
          if (updates.subtitlePosition !== undefined) metadata.subtitlePosition = updates.subtitlePosition;
          if (updates.subtitleFontSize !== undefined) metadata.subtitleFontSize = updates.subtitleFontSize;
          if ((updates as any).subtitleSingleLine !== undefined) metadata.subtitleSingleLine = (updates as any).subtitleSingleLine;
          if ((updates as any).subtitleSingleWord !== undefined) metadata.subtitleSingleWord = (updates as any).subtitleSingleWord;
          if (updates.subtitleEnabled !== undefined) metadata.subtitleEnabled = updates.subtitleEnabled;
          if ((updates as any).characterSizes) metadata.characterSizes = (updates as any).characterSizes;
          if ((updates as any).characterPositions) metadata.characterPositions = (updates as any).characterPositions;
          
          apiUpdates.metadata = metadata;
          console.log('💾 Sending subtitle settings, character sizes, and positions in metadata:', metadata);
        } catch (error) {
          console.error('⚠️ Failed to fetch current project for metadata merge:', error);
          // Create new metadata if we can't fetch
          const metadata: any = {};
          if (updates.subtitleStyle !== undefined) metadata.subtitleStyle = updates.subtitleStyle;
          if (updates.subtitlePosition !== undefined) metadata.subtitlePosition = updates.subtitlePosition;
          if (updates.subtitleFontSize !== undefined) metadata.subtitleFontSize = updates.subtitleFontSize;
          if ((updates as any).subtitleSingleLine !== undefined) metadata.subtitleSingleLine = (updates as any).subtitleSingleLine;
          if ((updates as any).subtitleSingleWord !== undefined) metadata.subtitleSingleWord = (updates as any).subtitleSingleWord;
          if (updates.subtitleEnabled !== undefined) metadata.subtitleEnabled = updates.subtitleEnabled;
          if ((updates as any).characterSizes) metadata.characterSizes = (updates as any).characterSizes;
          if ((updates as any).characterPositions) metadata.characterPositions = (updates as any).characterPositions;
          apiUpdates.metadata = metadata;
        }
      }
      
      console.log('💾 API updates being sent:', JSON.stringify(apiUpdates, null, 2));
      await projectsApi.update(id, apiUpdates);
      
      // Update local state (also update draft if it's the same project)
      set((state) => {
        const updatedProjects = state.projects.map((p) =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        );
        
        // If the draft is for this project, update it too (preserve previewUrl/finalUrl)
        const shouldUpdateDraft = state.draft.id === id;
        let updatedDraft = state.draft;
        
        if (shouldUpdateDraft) {
          // Merge updates into draft, preserving previewUrl/finalUrl and status
          const draftUpdates: Partial<DraftProject> = {
            ...updates,
            // Explicitly preserve previewUrl and finalUrl if they weren't in updates
            previewUrl: updates.previewUrl !== undefined ? (updates.previewUrl || null) : state.draft.previewUrl,
            finalUrl: updates.finalUrl !== undefined ? (updates.finalUrl || null) : state.draft.finalUrl,
            // Ensure srtText is always a string (not null)
            srtText: updates.srtText !== undefined ? (updates.srtText || '') : state.draft.srtText,
            // Preserve status if it wasn't explicitly updated (don't overwrite QUEUED/RENDERING with null)
            status: updates.status !== undefined ? updates.status : state.draft.status,
            updatedAt: new Date().toISOString(),
          };
          
          updatedDraft = {
            ...state.draft,
            ...draftUpdates,
          };
        }
        
        return {
          projects: updatedProjects,
          draft: updatedDraft,
          loading: false,
        };
      });
      
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
   * Load an existing project into draft for editing
   * Fetches full project details from API to ensure we have everything
   */
  loadProjectIntoDraft: async (projectId: string) => {
    try {
      console.log("📝 Loading project into draft, ID:", projectId);
      
      // Fetch full project details from API (includes script segments, characters, etc.)
      const { project } = await projectsApi.get(projectId);
      
      console.log("📝 Project fetched from API:", project);
      console.log("📝 Full project object:", JSON.stringify(project, null, 2));
      console.log("📝 Project script_segments:", (project as any).script_segments);
      console.log("📝 Project characters:", (project as any).characters);
      console.log("📝 Project characters length:", (project as any).characters?.length);

      // Convert text overlays from database format to frontend format
      const rawTextOverlays = (project as any).text_overlays || [];
      console.log("📝 Raw text overlays from API:", rawTextOverlays);
      console.log("📝 Raw text overlays count:", rawTextOverlays.length);
      const formattedTextOverlays = rawTextOverlays.map((overlay: any) => {
        // Parse position if it's stored as "x,y" string
        let x = 50, y = 50;
        if (overlay.position && typeof overlay.position === 'string' && overlay.position.includes(',')) {
          const [xStr, yStr] = overlay.position.split(',');
          x = parseFloat(xStr) || 50;
          y = parseFloat(yStr) || 50;
        }
        
        // Calculate endMs from startMs + duration_ms
        const startMs = overlay.start_time_ms || 0;
        const durationMs = overlay.duration_ms || 2500;
        const endMs = startMs + durationMs;
        
        // Extract style data from style JSONB column
        const styleData = overlay.style || {};
        const fontSize = styleData.fontSize || 48;
        const color = styleData.color || '#FFFFFF';
        const style = styleData.style || 'classic';
        const rotation = styleData.rotation || undefined;
        
        return {
          id: overlay.id || overlay.text?.substring(0, 8) + '-' + Date.now(),
          text: overlay.text || '',
          startMs: startMs,
          endMs: endMs,
          x: x,
          y: y,
          fontSize: fontSize,
          color: color,
          style: style,
          rotation: rotation,
        };
      });

      // Convert image overlays from database format to frontend format
      const rawImageOverlays = (project as any).image_overlays || [];
      console.log("🖼️ Raw image overlays from API:", rawImageOverlays);
      console.log("🖼️ Raw image overlays count:", rawImageOverlays.length);
      const formattedImageOverlays = rawImageOverlays.map((overlay: any) => {
        // Calculate endMs from startMs + duration_ms
        const startMs = overlay.start_time_ms || 0;
        const durationMs = overlay.duration_ms || 2500;
        const endMs = startMs + durationMs;
        
        return {
          id: overlay.id || `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          imageUrl: overlay.image_url || '',
          startMs: startMs,
          endMs: endMs,
          x: overlay.position_x !== undefined ? Number(overlay.position_x) : 50,
          y: overlay.position_y !== undefined ? Number(overlay.position_y) : 50,
          width: overlay.width !== undefined ? Number(overlay.width) : 20,
          height: overlay.height !== undefined ? Number(overlay.height) : 20,
          opacity: overlay.opacity !== undefined ? Number(overlay.opacity) : 1,
          rotation: overlay.rotation !== undefined ? Number(overlay.rotation) : 0,
          cropData: overlay.crop_data || undefined,
        };
      });

      // Extract type from metadata (projects table doesn't have a type column, it's in metadata)
      const projectMetadata = (project as any).metadata || {};
      const projectType = projectMetadata.type || 'TWO_CHAR_CONVO'; // Default to TWO_CHAR_CONVO if not set
      
      // Convert API format to local format
      const formattedProject = {
        ...project,
        userId: (project as any).user_id,
        type: projectType as ProjectType, // Set type from metadata
        characters: (project as any).characters || { A: null, B: null },
        script: (project as any).script_segments || [],
        overlays: formattedTextOverlays,
        textOverlays: formattedTextOverlays,
        imageOverlays: formattedImageOverlays,
        srtText: (project as any).srt_text || "",
        previewUrl: (project as any).preview_url,
        finalUrl: (project as any).final_url,
        durationSec: (project as any).duration_seconds,
        createdAt: (project as any).created_at,
        updatedAt: (project as any).updated_at,
      };

      console.log("📝 Formatted project text overlays count:", formattedProject.textOverlays.length);
      console.log("📝 Formatted project image overlays count:", formattedProject.imageOverlays.length);

      console.log("📝 Formatted project script:", formattedProject.script);
      console.log("📝 Formatted project script length:", formattedProject.script?.length);
      console.log("🎥 Formatted project previewUrl:", formattedProject.previewUrl);
      console.log("🎥 Formatted project finalUrl:", formattedProject.finalUrl);

      // Extract subtitle settings from metadata (reusing projectMetadata)
      const metadata = projectMetadata;
      const subtitleStyle = metadata.subtitleStyle || "classic";
      const subtitlePosition = metadata.subtitlePosition || { x: 50, y: 85 };
      const subtitleFontSize = metadata.subtitleFontSize || 100;
      const subtitleSingleLine = metadata.subtitleSingleLine || false;
      const subtitleSingleWord = metadata.subtitleSingleWord || false;
      const subtitleEnabled = metadata.subtitleEnabled !== undefined ? metadata.subtitleEnabled : true;
      const playbackRate = metadata.playbackRate || 1;
      const characterSizes = metadata.characterSizes || {
        Peter: { width: 400, height: 500 },
        Stewie: { width: 350, height: 450 },
        Rick: { width: 800, height: 1000 }, // 2x default size
        Brian: { width: 350, height: 450 },
        Morty: { width: 560, height: 720 }, // 2x default size, reduced by 20%
      };
      const characterPositions = metadata.characterPositions || {
        Peter: 'left',
        Stewie: 'right',
        Rick: 'left',
        Brian: 'right',
        Morty: 'right',
      };

      console.log("📝 Subtitle settings from metadata:", {
        style: subtitleStyle,
        position: subtitlePosition,
        fontSize: subtitleFontSize,
        enabled: subtitleEnabled,
      });
      console.log("🎬 Playback rate from metadata:", playbackRate);
      console.log("📏 Character sizes from metadata:", characterSizes);
      console.log("📍 Character positions from metadata:", characterPositions);

      // Convert project to draft format
      // For story narration projects, we need to preserve scriptInput from metadata or reconstruct it
      // Story narration projects don't have script segments with speakers, they have plain text
      let scriptInput = "";
      if (projectType === "story" || projectType === "NORMAL_STORY" || projectType === "REDDIT_STORY") {
        // For story narration, check if scriptInput is stored in metadata or reconstruct from script segments
        // If not available, try to reconstruct from SRT text (extract text from subtitle segments)
        scriptInput = projectMetadata.scriptInput || formattedProject.script?.map((line: ScriptLine) => line.text).join('\n') || "";
        
        // If still empty and we have SRT text, reconstruct from subtitles
        if (!scriptInput && formattedProject.srtText) {
          try {
            // Use the parseSrtText utility to parse subtitle segments
            const segments = parseSrtText(formattedProject.srtText);
            // Extract text from each segment and join with newlines
            scriptInput = segments.map(seg => seg.text).join('\n');
            console.log("📝 Reconstructed scriptInput from SRT text:", scriptInput.substring(0, 100));
          } catch (e) {
            console.warn("⚠️ Failed to reconstruct scriptInput from SRT:", e);
          }
        }
      } else {
        // For two-char projects, use speaker: text format
        scriptInput = formattedProject.script?.map((line: ScriptLine) => `${line.speaker}: ${line.text}`).join('\n') || "";
      }
      
      const draft: DraftProject = {
        id: formattedProject.id,
        type: formattedProject.type,
        title: formattedProject.title,
        status: formattedProject.status,
        characters: formattedProject.characters || { A: null, B: null },
        script: formattedProject.script || [],
        scriptInput: scriptInput,
        overlays: formattedProject.overlays || [],
        textOverlays: formattedProject.textOverlays || [],
        imageOverlays: formattedProject.imageOverlays || [],
        srtText: formattedProject.srtText || "",
        originalSrtText: formattedProject.srtText || "",
        previewUrl: formattedProject.previewUrl || null,
        finalUrl: formattedProject.finalUrl || null,
        durationSec: formattedProject.durationSec || null,
        subtitleEnabled: subtitleEnabled,
        subtitleStyle: subtitleStyle,
        subtitlePosition: subtitlePosition,
        subtitleFontSize: subtitleFontSize,
        subtitleSingleLine: subtitleSingleLine,
        subtitleSingleWord: subtitleSingleWord,
        playbackRate: playbackRate,
        characterSizes: characterSizes,
        characterPositions: characterPositions,
        updatedAt: new Date().toISOString(),
      };

      set({ draft });
      console.log("✅ Project loaded into draft successfully");
      console.log("✅ Draft script length:", draft.script.length);
      console.log("✅ Draft script:", draft.script);
      console.log("✅ Draft text overlays count:", draft.textOverlays.length);
      console.log("✅ Draft text overlays:", draft.textOverlays);
      console.log("✅ Draft image overlays count:", draft.imageOverlays.length);
      console.log("✅ Draft image overlays:", draft.imageOverlays);
      console.log("🎥 Draft previewUrl:", draft.previewUrl);
      console.log("🎥 Draft finalUrl:", draft.finalUrl);
      console.log("🎥 Draft durationSec:", draft.durationSec);
    } catch (error) {
      console.error("❌ Failed to load project into draft:", error);
      throw error;
    }
  },

  /**
   * Generate preview video
   */
  enqueuePreview: async (projectId?: string, userId?: string) => {
    console.log("🎬 enqueuePreview called with projectId:", projectId, "userId:", userId);
    
    try {
      const draft = get().draft;
      
      // Check if projectId is a valid database project ID
      // If it's a local UUID (from draft), it won't exist in the projects list
      let targetProjectId = projectId;
      const existingProject = projectId ? get().projects.find(p => p.id === projectId) : null;
      
      // If no valid projectId or project doesn't exist in database, create project first
      if (!targetProjectId || !existingProject) {
        console.log("📝 No valid projectId provided, need to create project first");
        
        // Check if we have a draft with script
        if (!draft?.script?.length) {
          throw new Error("No script available for preview");
        }
        
        // Create project from draft first
        // Use provided userId or fallback to null (for dev mode)
        const finalUserId = userId || null;
        console.log("📝 Creating project with userId:", finalUserId);
        const newProject = await get().createProjectFromDraft(finalUserId || "mock-user");
        
        if (!newProject) {
          throw new Error("Failed to create project");
        }
        
        if (!newProject.id) {
          console.error("❌ CRITICAL: Project created but ID is missing!", newProject);
          throw new Error("Project created but ID is missing");
        }
        
        targetProjectId = newProject.id;
        console.log("✅ Project created with ID:", targetProjectId);
        console.log("🔍 Verifying targetProjectId:", {
          targetProjectId,
          type: typeof targetProjectId,
          isUndefined: targetProjectId === undefined,
          isNull: targetProjectId === null,
          isEmpty: targetProjectId === ''
        });
        
        // IMPORTANT: Update draft ID to match the new project ID
        // This ensures the status update works correctly
        // targetProjectId is guaranteed to be a string at this point (we validated above)
        const projectIdForDraft: string = targetProjectId;
        set((state) => ({
          draft: {
            ...state.draft,
            id: projectIdForDraft,
          }
        }));
        console.log("🔄 Updated draft ID to match project ID:", projectIdForDraft);
      } else {
        console.log("📝 Using existing project ID:", targetProjectId);
        console.log("📝 Draft has characters:", draft?.characters);
        
        // When editing existing project, characters and script should already exist
        // But let's verify the project has what it needs
        if (!draft?.script?.length) {
          throw new Error("No script available for preview");
        }
      }
      
      // Validate targetProjectId before calling API
      if (!targetProjectId) {
        console.error("❌ CRITICAL: targetProjectId is undefined/null before calling render API!");
        throw new Error("Project ID is missing - cannot queue render job");
      }
      
      // Call render API (now returns queue info)
      console.log("🎬 Calling renderApi.generatePreview for project:", targetProjectId);
      console.log("🔍 Final targetProjectId validation:", {
        targetProjectId,
        type: typeof targetProjectId,
        length: targetProjectId?.length
      });
      
      let queueResult;
      try {
        console.log("⏳ Waiting for render API response...");
        queueResult = await renderApi.generatePreview(targetProjectId);
        console.log("✅ Preview job queued:", queueResult);
        console.log("🔍 Queue result details:", {
          hasRenderJobId: !!queueResult.render_job_id,
          renderJobId: queueResult.render_job_id,
          status: queueResult.status,
          queuePosition: queueResult.queue_position,
          estimatedWaitTime: queueResult.estimated_wait_time,
          success: queueResult.success
        });
      } catch (apiError) {
        console.error("❌ Failed to queue render job:", apiError);
        throw apiError;
      }
      
      if (!queueResult || !queueResult.render_job_id) {
        console.error("❌ Invalid queue result:", queueResult);
        throw new Error("Failed to queue render job - no job ID returned");
      }
      
      // Update status to QUEUED in draft immediately - CRITICAL: This must happen synchronously
      console.log("🔄 About to update draft status to QUEUED...", {
        currentStatus: get().draft.status,
        queuePosition: queueResult.queue_position,
        estimatedWaitTime: queueResult.estimated_wait_time,
        targetProjectId
      });
      
      // Use a synchronous update to ensure React sees the change immediately
      set((state) => {
        const updatedDraft: DraftProject = {
          ...state.draft,
          id: targetProjectId,
          status: "QUEUED" as const,
          queuePosition: queueResult.queue_position,
          estimatedWaitTime: queueResult.estimated_wait_time,
        };
        console.log("📝 Updated draft status to QUEUED:", {
          status: updatedDraft.status,
          queuePosition: updatedDraft.queuePosition,
          estimatedWaitTime: updatedDraft.estimatedWaitTime,
          draftId: updatedDraft.id,
          fullDraft: updatedDraft
        });
        return { draft: updatedDraft };
      });
      
      // Verify the update happened immediately
      const verifyStatus = get().draft.status;
      const verifyQueuePosition = get().draft.queuePosition;
      console.log("✅ Verified draft status after update:", {
        status: verifyStatus,
        queuePosition: verifyQueuePosition,
        draftId: get().draft.id
      });
      
      if (verifyStatus !== "QUEUED") {
        console.error("❌ CRITICAL: Status update failed! Expected QUEUED, got:", verifyStatus);
        // Force update again
        set((state) => ({
          draft: {
            ...state.draft,
            status: "QUEUED" as const,
            queuePosition: queueResult.queue_position,
            estimatedWaitTime: queueResult.estimated_wait_time,
          }
        }));
      }
      
      // CRITICAL: Capture targetProjectId and render_job_id for realtime subscription
      const capturedProjectId = targetProjectId;
      const capturedJobId = queueResult.render_job_id!;
      
      console.log("🔒 Captured values for realtime subscription:", {
        capturedProjectId,
        capturedJobId,
        currentTargetProjectId: targetProjectId,
        currentDraftId: get().draft.id
      });
      
      // Do one initial status check to get current state (not polling, just one check)
      try {
        const initialStatus = await renderApi.getRenderJobStatus(capturedProjectId, capturedJobId);
        const job = initialStatus.render_job;
        const jobStatus = job.status.toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
        
        console.log("📊 Initial status check:", jobStatus, "Progress:", job.progress);
        
        // Map backend status to frontend status
        let frontendStatus: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
        if (jobStatus === 'completed') {
          frontendStatus = 'READY';
        } else if (jobStatus === 'failed') {
          frontendStatus = 'FAILED';
        } else if (jobStatus === 'processing') {
          frontendStatus = 'RENDERING';
        } else {
          frontendStatus = 'QUEUED';
        }
        
        // Update status if it's different from what we set
        if (get().draft.status !== frontendStatus) {
          set((state) => ({
            draft: {
              ...state.draft,
              renderProgress: job.progress || 0,
              status: frontendStatus,
            }
          }));
        }
        
        // If already completed, handle it immediately
        if (jobStatus === 'completed' && job.video_url && job.metadata) {
          const metadata = job.metadata;
          set((state) => ({
            draft: {
              ...state.draft,
              status: "READY" as const,
              previewUrl: job.video_url!,
              durationSec: metadata.durationSec || 0,
              srtText: metadata.srtText || '',
              originalSrtText: metadata.srtText || '',
              subtitleEnabled: true,
            }
          }));
          
          // Save to database
          await get().updateProject(capturedProjectId, {
            previewUrl: job.video_url!,
            durationSec: metadata.durationSec || 0,
            srtText: metadata.srtText || '',
            status: "READY" as RenderStatus,
          }).catch(err => {
            console.error("⚠️ Failed to save preview URL to database:", err);
          });
          
          import('sonner').then(({ toast }) => {
            toast.success("Preview generated successfully! 🎉");
          }).catch(() => {});
        }
      } catch (error) {
        console.warn("⚠️ Initial status check failed (realtime will handle updates):", error);
      }
      
      // Set up Supabase Realtime subscription for real-time updates
      // This will listen for status changes in the render_jobs table
      // Use captured values to ensure we're subscribing to the correct job
      console.log("🔔 Setting up realtime subscription for job:", capturedJobId, "project:", capturedProjectId);
      get().subscribeToRenderJob(capturedJobId, capturedProjectId);
      
    } catch (error) {
      console.error("❌ Preview generation failed:", error);
      
      // Update status to FAILED
      if (!projectId) {
        set((state) => ({
          draft: { ...state.draft, status: "FAILED" }
        }));
      }
      
      throw error;
    }
  },

  /**
   * Generate final video with Supabase Realtime updates
   */
  simulateRender: async (projectId?: string) => {
    console.log("🎬 simulateRender called with projectId:", projectId);
    
    try {
      const draft = get().draft;
      
      // Need projectId for final render
      if (!projectId && !draft?.id) {
        throw new Error("No project ID available for final render");
      }
      
      const targetProjectId = projectId || draft.id;
      
      // Update status to QUEUED initially (will be updated by realtime)
      if (!projectId) {
        set((state) => ({
          draft: {
            ...state.draft,
            status: 'QUEUED' as const,
          }
        }));
      }
      
      // Call render API with customizations
      console.log("🎬 Calling renderApi.generateFinal...");
      const result = await renderApi.generateFinal(targetProjectId, {
        textOverlays: draft.textOverlays,
        subtitleCustomizations: {
          style: draft.subtitleStyle,
          position: draft.subtitlePosition,
          fontSize: draft.subtitleFontSize,
          singleLine: draft.subtitleSingleLine ?? false,
          singleWord: draft.subtitleSingleWord ?? false,
        },
        srtText: draft.srtText,
        imageOverlays: draft.imageOverlays,
        playbackRate: draft.playbackRate || 1, // Include playback rate
        characterSizes: draft.characterSizes, // Include character sizes
        characterPositions: draft.characterPositions, // Include character positions
      });
      
      console.log("✅ Final render result:", result);
      
      // Update draft with queue status immediately
      if (!projectId && (result.queue_position !== undefined || result.estimated_wait_time !== undefined)) {
        set((state) => ({
          draft: {
            ...state.draft,
            status: 'QUEUED' as const,
            queuePosition: result.queue_position,
            estimatedWaitTime: result.estimated_wait_time,
          }
        }));
      }
      
      // If we have a render job ID, set up Realtime subscription
      if (result.render_job_id) {
        console.log("🔔 Setting up realtime subscription for final render job:", result.render_job_id, "project:", targetProjectId);
        get().subscribeToRenderJob(result.render_job_id, targetProjectId);
        
        // Also get initial status immediately
          try {
          const initialStatus = await renderApi.getRenderJobStatus(targetProjectId, result.render_job_id);
          if (initialStatus.render_job) {
            const job = initialStatus.render_job;
            const jobStatus = (job.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
            
            // Map backend status to frontend status
            let frontendStatus: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
            if (jobStatus === 'completed') {
              frontendStatus = 'READY';
            } else if (jobStatus === 'failed') {
              frontendStatus = 'FAILED';
            } else if (jobStatus === 'processing') {
              frontendStatus = 'RENDERING';
            } else {
              frontendStatus = 'QUEUED';
            }
            
            if (!projectId) {
              set((state) => ({
                draft: {
                  ...state.draft,
                  status: frontendStatus,
                  renderProgress: job.progress || 0,
                  // Keep queue position if still queued
                  queuePosition: frontendStatus === 'QUEUED' ? result.queue_position : undefined,
                  estimatedWaitTime: frontendStatus === 'QUEUED' ? result.estimated_wait_time : undefined,
                }
              }));
            }
            
            // If already completed, handle completion
            if (jobStatus === 'completed' && job.video_url) {
              const fullVideoUrl = job.video_url.startsWith('http') 
                ? job.video_url 
                : `${config.remotionServerUrl}${job.video_url}`;
              
              if (!projectId) {
                set((state) => ({
                  draft: {
                    ...state.draft,
                    finalUrl: fullVideoUrl,
                    status: 'READY' as const,
                    renderProgress: 100,
                  }
                }));
              }
              
              // Update in projects list
              set((state) => ({
                projects: state.projects.map((p) =>
                  p.id === targetProjectId
                    ? { ...p, finalUrl: fullVideoUrl }
                    : p
                ),
              }));
              
              // Save final URL to database
              try {
                await get().updateProject(targetProjectId, {
                  finalUrl: fullVideoUrl,
                });
              } catch (dbError) {
                console.error("⚠️ Failed to save final URL to database:", dbError);
              }
              
              // Unsubscribe when completed
              get().unsubscribeFromRenderJob();
            }
          }
        } catch (statusError) {
          console.warn("⚠️ Failed to get initial status:", statusError);
          // Continue with Realtime subscription
        }
      } else {
        // No render job ID, use direct result (backward compatibility)
        // Update draft with final URL
        if (!projectId) {
          set((state) => ({
            draft: {
              ...state.draft,
              finalUrl: result.videoUrl,
              status: 'READY' as const,
            }
          }));
        }
        
        // Update in projects list
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === targetProjectId
              ? { ...p, finalUrl: result.videoUrl }
              : p
          ),
        }));
        
        // IMPORTANT: Save final URL to database so it persists
        try {
          console.log("💾 Saving final URL to database...");
          await get().updateProject(targetProjectId, {
            finalUrl: result.videoUrl,
          });
          console.log("✅ Final URL saved to database");
        } catch (dbError) {
          console.error("⚠️ Failed to save final URL to database:", dbError);
          // Don't throw - final video still works locally
        }
      }
      
      console.log("✅ Final render queued!");
      
    } catch (error) {
      console.error("❌ Final render failed:", error);
      
      // Update status to FAILED
      if (!projectId) {
        set((state) => ({
          draft: {
            ...state.draft,
            status: 'FAILED' as const,
          }
        }));
      }
      
      throw error;
    }
  },

  /**
   * Subscribe to render job status changes via Supabase Realtime
   */
  subscribeToRenderJob: (jobId: string, projectId: string) => {
    // Unsubscribe from any existing subscription
    const existingSub = get().renderJobSubscription;
    if (existingSub) {
      console.log("🔄 Unsubscribing from existing render job subscription");
      supabase.removeChannel(existingSub);
    }

    console.log("📡 Setting up Supabase Realtime subscription for render job:", jobId);
    
    const channel = supabase
      .channel(`render-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'render_jobs',
          filter: `id=eq.${jobId}`,
        },
        async (payload) => {
          console.log("📨 Realtime update received:", payload);
          const renderJob = payload.new as any;
          
          if (!renderJob) {
            console.warn("⚠️ Realtime update missing render job data");
            return;
          }

          const jobStatus = (renderJob.status || '').toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
          
          // Map backend status to frontend status
          let frontendStatus: 'QUEUED' | 'RENDERING' | 'READY' | 'FAILED';
          if (jobStatus === 'completed') {
            frontendStatus = 'READY';
          } else if (jobStatus === 'failed') {
            frontendStatus = 'FAILED';
          } else if (jobStatus === 'processing') {
            frontendStatus = 'RENDERING';
          } else {
            // pending -> QUEUED
            frontendStatus = 'QUEUED';
          }

          console.log("🔄 Realtime status update:", {
            jobId,
            jobStatus,
            frontendStatus,
            progress: renderJob.progress,
            hasVideoUrl: !!renderJob.result_url,
            hasMetadata: !!renderJob.metadata,
            currentDraftStatus: get().draft.status
          });

          // Handle project creation for story narrations (async, outside of set callback)
          const isStoryPreview = renderJob.type === 'STORY_PREVIEW';
          let actualProjectId = projectId;
          const metadata = renderJob.metadata || {};
          
          // If this is a completed story preview and project doesn't exist, create it first
          if (isStoryPreview && jobStatus === 'completed' && renderJob.result_url) {
            const currentDraft = get().draft;
            const existingProject = projectId 
              ? get().projects.find(p => p.id === projectId)
              : null;
            
            if (!existingProject) {
              console.log("📝 Story narration: Project doesn't exist, creating it...");
              try {
                // Ensure draft has a title
                if (!currentDraft.title || currentDraft.title === "Untitled Conversation") {
                  const firstLine = currentDraft.scriptInput?.split('\n')?.[0]?.trim() || "Untitled Story";
                  get().updateDraft({ title: firstLine.substring(0, 50) });
                }
                
                // Get user ID
                const session = await supabase.auth.getSession();
                const userId = session.data.session?.user?.id || "mock-user";
                
                // Create project
                const newProject = await get().createProjectFromDraft(userId);
                if (newProject) {
                  actualProjectId = newProject.id;
                  console.log("✅ Story narration project created:", actualProjectId);
                  
                  // Update draft with new project ID
                  get().updateDraft({ id: actualProjectId });
                  
                  // Update projects list
                  set((state) => ({
                    projects: [newProject, ...state.projects]
                  }));
                  
                  // Now update the project with preview URL
                  await get().updateProject(actualProjectId, {
                    previewUrl: renderJob.result_url!,
                    durationSec: metadata.durationSec || 0,
                    srtText: metadata.srtText || '',
                    status: "READY" as RenderStatus,
                  });
                  
                  console.log("✅ Project updated with preview URL");
                } else {
                  console.error("❌ Failed to create story narration project");
                }
              } catch (createError) {
                console.error("❌ Error creating story narration project:", createError);
              }
            }
          }

          // Update draft with realtime data (use actualProjectId which may have been updated above)
          const finalProjectId = actualProjectId;
          set((state) => {
            const draftUpdate: Partial<DraftProject> = {
              renderProgress: renderJob.progress || 0,
              status: frontendStatus,
            };
            
            console.log("💾 Realtime: Updating draft status from", state.draft.status, "to", frontendStatus);

            // Preserve queue info if status is QUEUED
            if (frontendStatus === 'QUEUED') {
              if (state.draft.queuePosition !== undefined) {
                draftUpdate.queuePosition = state.draft.queuePosition;
              }
              if (state.draft.estimatedWaitTime !== undefined) {
                draftUpdate.estimatedWaitTime = state.draft.estimatedWaitTime;
              }
            }

            // If completed, update with video URL and metadata
            if (jobStatus === 'completed' && renderJob.result_url) {
              const isFinalRender = renderJob.type === 'FINAL';
              
              if (isFinalRender) {
                // Final render - update finalUrl
                draftUpdate.finalUrl = renderJob.result_url;
                draftUpdate.status = 'READY' as const;
                draftUpdate.renderProgress = 100;

                // Also update in projects list
                const updatedProjects = state.projects.map((p) =>
                  p.id === finalProjectId
                    ? {
                        ...p,
                        status: "READY" as RenderStatus,
                        finalUrl: renderJob.result_url!,
                      }
                    : p
                );

                // Save to database
                if (finalProjectId && !finalProjectId.startsWith('mock-')) {
                  get().updateProject(finalProjectId, {
                    finalUrl: renderJob.result_url!,
                    status: "READY" as RenderStatus,
                  }).catch(err => {
                    console.error("⚠️ Failed to save final URL to database:", err);
                  });
                }

                // Show success toast
                import('sonner').then(({ toast }) => {
                  toast.success("Final video rendered successfully! 🎬");
                }).catch(err => {
                  console.warn("Failed to show success toast:", err);
                });
              } else {
                // Preview render - update previewUrl
                draftUpdate.previewUrl = renderJob.result_url;
                draftUpdate.durationSec = metadata.durationSec || 0;
                draftUpdate.srtText = metadata.srtText || '';
                draftUpdate.originalSrtText = metadata.srtText || '';
                draftUpdate.subtitleEnabled = true;

                // Update projects list if project exists
                // Note: For story narrations, project creation happens above (before this set callback)
                if (finalProjectId) {
                  const updatedProjects = state.projects.map((p) =>
                    p.id === finalProjectId
                      ? {
                          ...p,
                          status: "READY" as RenderStatus,
                          previewUrl: renderJob.result_url!,
                          durationSec: metadata.durationSec || 0,
                          srtText: metadata.srtText || '',
                        }
                      : p
                  );

                  // Save to database (only if project exists and wasn't just created above)
                  // For story narrations, the project was already updated above
                  if (finalProjectId && !finalProjectId.startsWith('mock-') && !isStoryPreview) {
                    get().updateProject(finalProjectId, {
                      previewUrl: renderJob.result_url!,
                      durationSec: metadata.durationSec || 0,
                      srtText: metadata.srtText || '',
                      status: "READY" as RenderStatus,
                    }).catch(err => {
                      console.error("⚠️ Failed to save preview URL to database:", err);
                    });
                  }

                  // Show success toast
                  import('sonner').then(({ toast }) => {
                    toast.success("Preview generated successfully! 🎉");
                  }).catch(err => {
                    console.warn("Failed to show success toast:", err);
                  });
                }
              }

              // Unsubscribe when completed
              get().unsubscribeFromRenderJob();
            }

            // If failed, update status
            if (jobStatus === 'failed') {
              console.error("❌ Render job failed:", renderJob.error_message);
              draftUpdate.status = 'FAILED' as const;
              get().unsubscribeFromRenderJob();
            }

            return {
              draft: {
                ...state.draft,
                ...draftUpdate,
              },
              ...(jobStatus === 'completed' && renderJob.result_url ? {
                projects: state.projects.map((p) => {
                  if (p.id !== finalProjectId) return p;
                  
                  const isFinalRender = renderJob.type === 'FINAL';
                  const metadata = renderJob.metadata || {};
                  
                  if (isFinalRender) {
                    return {
                      ...p,
                      status: "READY" as RenderStatus,
                      finalUrl: renderJob.result_url!,
                    };
                  } else {
                    return {
                      ...p,
                      status: "READY" as RenderStatus,
                      previewUrl: renderJob.result_url!,
                      durationSec: metadata.durationSec || 0,
                      srtText: metadata.srtText || '',
                    };
                  }
                }),
              } : {}),
            };
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log("✅ Successfully subscribed to render job realtime updates for job:", jobId);
          set({ realtimeConnected: true });
        } else if (status === 'CHANNEL_ERROR') {
          console.error("❌ Realtime subscription error:", err);
          console.warn("⚠️ Realtime subscription failed - will use polling fallback");
          set({ realtimeConnected: false });
        } else if (status === 'TIMED_OUT') {
          console.warn("⏱️ Realtime subscription timed out - will use polling fallback");
          set({ realtimeConnected: false });
        } else if (status === 'CLOSED') {
          console.log("🔌 Realtime subscription closed");
          set({ realtimeConnected: false });
        } else {
          console.log("📡 Realtime subscription status:", status, err ? `Error: ${err}` : '');
          if (status !== 'SUBSCRIBED') {
            set({ realtimeConnected: false });
          }
        }
      });

    set({ renderJobSubscription: channel });
  },

  /**
   * Unsubscribe from render job status changes
   */
  unsubscribeFromRenderJob: () => {
    const subscription = get().renderJobSubscription;
    if (subscription) {
      console.log("🔌 Unsubscribing from render job realtime updates");
      supabase.removeChannel(subscription);
      set({ renderJobSubscription: null });
    }
  },
}));

