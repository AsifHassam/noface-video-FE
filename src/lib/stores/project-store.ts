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
  SubtitleFontFamily,
  TextOverlay,
  ImageOverlay,
  CharacterSizes,
  CharacterPositions,
} from "@/types";
import { CHARACTERS } from "@/lib/data/characters";
import { generateMockFromScript, parseSrtText, serializeSrt } from "@/lib/utils/srt";
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
  subtitleFontFamily?: SubtitleFontFamily;
  subtitleSingleLine?: boolean;
  subtitleSingleWord?: boolean;
  karaokePillColor?: string; // Color for karaoke-pink style pill highlight
  boldGreenColor?: string; // Color for bold-green style accent word
  characterSizes?: CharacterSizes;
  characterPositions?: CharacterPositions;
  characterCustomPositions?: Record<string, { x: number; y: number }>;
  renderProgress?: number;
  playbackRate?: number;
  queuePosition?: number;
  estimatedWaitTime?: number;
  audioFiles?: Array<{
    speaker: string;
    text: string;
    publicUrl: string | null;
    startMs: number;
    endMs: number;
    durationMs: number;
  }>;
  mergedAudioUrl?: string | null;
  mergedDurationMs?: number;
  audioTotalDurationMs?: number;
  redditTitle?: string;
  metadata?: any; // Full metadata object (needed for texting videos, UGC, etc.)
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
  subtitleStyle: "bold-green",
  subtitlePosition: { x: 50, y: 85 }, // Lower position to avoid cutting off
  subtitleFontSize: 100,
  subtitleFontFamily: "zy-resolve",
  subtitleSingleLine: true,  // Default to 3-word subtitle mode
  subtitleSingleWord: false,
  karaokePillColor: '#E96BA8', // Default pink color for karaoke-pink style
  boldGreenColor: '#63E443', // Default green color for bold-green style accent word
  characterSizes: {
    Peter: { width: 320, height: 400 },
    Stewie: { width: 280, height: 360 },
    Rick: { width: 480, height: 600 }, // Reduced for better fit
    Brian: { width: 280, height: 360 },
    Morty: { width: 400, height: 520 }, // Reduced for better fit
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
        
        // Normalize status: if status is READY but no final_url, it should be DRAFT
        let normalizedStatus = p.status;
        if (normalizedStatus === 'READY' && !p.final_url) {
          normalizedStatus = 'DRAFT';
        }
        // Also ensure DRAFT status if no final_url and status is null/undefined
        if (!normalizedStatus && !p.final_url) {
          normalizedStatus = 'DRAFT';
        }
        
        return {
          ...p,
          userId: p.user_id,
          type: projectType as ProjectType, // Set type from metadata
          status: normalizedStatus as RenderStatus,
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
          redditTitle: metadata.redditTitle,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
      });
      
      set({ projects: formattedProjects, loading: false });
    } catch (error) {
      set({ error: "Failed to load projects", loading: false });
    }
  },

  /**
   * Create a new project from draft
   */
  createProjectFromDraft: async (userId: string) => {
    const currentDraft = get().draft;

    if (!currentDraft.title.trim()) {
      return null;
    }

    try {
      set({ loading: true, error: null });

      // Generate mock subtitles if they don't exist
      let draftToSave = currentDraft;
      if (!currentDraft.srtText && currentDraft.script.length > 0) {
        const mockSrt = generateMockFromScript(currentDraft.script);
        get().updateDraft({ srtText: mockSrt });
        draftToSave = { ...currentDraft, srtText: mockSrt };
      }

      // 1. Create project in API
      const { project } = await projectsApi.create({
        title: draftToSave.title,
        description: `Created on ${new Date().toLocaleDateString()}`,
        type: draftToSave.type,
        backgroundId: draftToSave.backgroundId || "minecraft",
      });

      // 2. Add characters if they exist
      const characters: { A: any; B: any } = { A: null, B: null };
      
      if (currentDraft.characters.A) {
        const charA = currentDraft.characters.A;
        const result = await charactersApi.create(project.id, {
          name: charA.name,
          voice_id: charA.voiceId ?? undefined,
          voice_provider: "elevenlabs",
          avatar_url: charA.avatarUrl || '',
          position: 0,
        });
        characters.A = {
          ...charA,
          id: (result as any).character.id,
        };
      }

      if (currentDraft.characters.B) {
        const charB = currentDraft.characters.B;
        const result = await charactersApi.create(project.id, {
          name: charB.name,
          voice_id: charB.voiceId ?? undefined,
          voice_provider: "elevenlabs",
          avatar_url: charB.avatarUrl || '',
          position: 1,
        });
        characters.B = {
          ...charB,
          id: (result as any).character.id,
        };
      }

      // 3. Add script segments if they exist
      if (currentDraft.script.length > 0 && characters.A && characters.B) {
        const segments = currentDraft.script.map((line, index) => ({
          character_id: line.speaker === "A" ? characters.A.id : characters.B.id,
          content: line.text,
          position: index,
        }));

        await scriptApi.bulkUpsert(project.id, segments);
      }

      // 4. Save subtitles, text overlays, and settings
      const updates: any = {};
      
      if (draftToSave.srtText) {
        updates.srt_text = draftToSave.srtText;
      }
      
      // Save text overlays if they exist
      if (draftToSave.textOverlays && draftToSave.textOverlays.length > 0) {
        updates.text_overlays = draftToSave.textOverlays;
      }
      
      // Save image overlays if they exist
      if (draftToSave.imageOverlays && draftToSave.imageOverlays.length > 0) {
        updates.image_overlays = draftToSave.imageOverlays;
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
      if (draftToSave.characterCustomPositions) {
        metadata.characterCustomPositions = draftToSave.characterCustomPositions;
      }
      if (draftToSave.redditTitle) {
        metadata.redditTitle = draftToSave.redditTitle;
      }
      
      if (Object.keys(updates).length > 0 || Object.keys(metadata).length > 1) {
        updates.metadata = metadata;
        await projectsApi.update(project.id, updates);
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
    } catch (error) {
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
      }
      if (updates.imageOverlays) {
        apiUpdates.image_overlays = updates.imageOverlays;
      }
      
      // Handle subtitle settings, character sizes, positions, playback rate, and merged audio - need to merge with existing metadata
      const hasMetadataUpdates = updates.subtitleStyle || updates.subtitlePosition || updates.subtitleFontSize !== undefined || updates.subtitleEnabled !== undefined || (updates as any).characterSizes || (updates as any).characterPositions || (updates as any).playbackRate !== undefined || (updates as any).mergedAudioUrl !== undefined || (updates as any).mergedDurationMs !== undefined || (updates as any).audioFiles !== undefined;
      
      if (hasMetadataUpdates) {
        // Fetch current project to get existing metadata
        try {
          const { project: currentProject } = await projectsApi.get(id);
          const existingMetadata = (currentProject as any).metadata || {};
          
          // Merge subtitle settings, character sizes, and playback rate into metadata
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
          if ((updates as any).playbackRate !== undefined) metadata.playbackRate = (updates as any).playbackRate;
          if ((updates as any).characterSizes) metadata.characterSizes = (updates as any).characterSizes;
          if ((updates as any).characterPositions) metadata.characterPositions = (updates as any).characterPositions;
          if ((updates as any).characterCustomPositions) metadata.characterCustomPositions = (updates as any).characterCustomPositions;
          if ((updates as any).mergedAudioUrl !== undefined) metadata.mergedAudioUrl = (updates as any).mergedAudioUrl;
          if ((updates as any).mergedDurationMs !== undefined) metadata.mergedDurationMs = (updates as any).mergedDurationMs;
          if ((updates as any).audioFiles !== undefined) metadata.audioFiles = (updates as any).audioFiles;
          
          apiUpdates.metadata = metadata;
        } catch (error) {
          // Create new metadata if we can't fetch
          const metadata: any = {};
          if (updates.subtitleStyle !== undefined) metadata.subtitleStyle = updates.subtitleStyle;
          if (updates.subtitlePosition !== undefined) metadata.subtitlePosition = updates.subtitlePosition;
          if (updates.subtitleFontSize !== undefined) metadata.subtitleFontSize = updates.subtitleFontSize;
          if ((updates as any).subtitleSingleLine !== undefined) metadata.subtitleSingleLine = (updates as any).subtitleSingleLine;
          if ((updates as any).subtitleSingleWord !== undefined) metadata.subtitleSingleWord = (updates as any).subtitleSingleWord;
          if (updates.subtitleEnabled !== undefined) metadata.subtitleEnabled = updates.subtitleEnabled;
          if ((updates as any).playbackRate !== undefined) metadata.playbackRate = (updates as any).playbackRate;
          if ((updates as any).characterSizes) metadata.characterSizes = (updates as any).characterSizes;
          if ((updates as any).characterPositions) metadata.characterPositions = (updates as any).characterPositions;
          if ((updates as any).characterCustomPositions) metadata.characterCustomPositions = (updates as any).characterCustomPositions;
          if ((updates as any).mergedAudioUrl !== undefined) metadata.mergedAudioUrl = (updates as any).mergedAudioUrl;
          if ((updates as any).mergedDurationMs !== undefined) metadata.mergedDurationMs = (updates as any).mergedDurationMs;
          if ((updates as any).audioFiles !== undefined) metadata.audioFiles = (updates as any).audioFiles;
          apiUpdates.metadata = metadata;
        }
      }
      
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
    } catch (error) {
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
      // Fetch full project details from API (includes script segments, characters, etc.)
      const { project } = await projectsApi.get(projectId);

      // Convert text overlays from database format to frontend format
      const rawTextOverlays = (project as any).text_overlays || [];
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
      
      // Format characters from API response
      // API returns characters as an array, we need to convert to { A: Character | null, B: Character | null }
      const rawCharacters = (project as any).characters || [];
      const formattedCharacters: { A: Character | null; B: Character | null } = { A: null, B: null };
      
      // Helper function to construct avatar URL from character name if not provided
      const getAvatarUrl = (char: any): string => {
        // First try to use the avatar_url from database
        if (char.avatar_url && char.avatar_url.trim() !== '') {
          return char.avatar_url;
        }
        // Try avatar field
        if ((char as any).avatar && (char as any).avatar.trim() !== '') {
          return (char as any).avatar;
        }
        // If no avatar URL, construct it from character name (matching CHARACTERS data format)
        if (char.name) {
          const slug = char.name.toLowerCase().replace(/\s+/g, "-");
          return `/avatars/${slug}.png`;
        }
        // Fallback to placeholder
        return "/avatars/placeholder.svg";
      };

      if (Array.isArray(rawCharacters)) {
        // Characters are returned as an array with position field (0 = A, 1 = B)
        rawCharacters.forEach((char: any) => {
          const position = char.position !== undefined ? char.position : (char.id ? 0 : 1); // Default to 0 if not specified
          const avatarUrl = getAvatarUrl(char);
          const slug = char.slug || char.name?.toLowerCase().replace(/\s+/g, "-") || `character-${char.id}`;
          
          const formattedChar: Character = {
            id: char.id,
            slug: slug,
            name: char.name,
            avatarUrl: avatarUrl,
            enabled: char.enabled !== undefined ? char.enabled : true,
            isPlaceholder: false,
            voiceId: char.voice_id || null,
          };
          
          if (position === 0 || position === 'A' || position === 'a') {
            formattedCharacters.A = formattedChar;
          } else if (position === 1 || position === 'B' || position === 'b') {
            formattedCharacters.B = formattedChar;
          }
        });
      } else if (rawCharacters && typeof rawCharacters === 'object' && !Array.isArray(rawCharacters)) {
        // Characters might already be in { A: ..., B: ... } format
        // But we still need to ensure they have proper avatarUrl and slug
        if (rawCharacters.A) {
          const charA = rawCharacters.A as any;
          formattedCharacters.A = {
            id: charA.id,
            slug: charA.slug || charA.name?.toLowerCase().replace(/\s+/g, "-") || `character-a-${charA.id}`,
            name: charA.name,
            avatarUrl: getAvatarUrl(charA),
            enabled: charA.enabled !== undefined ? charA.enabled : true,
            isPlaceholder: false,
            voiceId: charA.voiceId || charA.voice_id || null,
          } as Character;
        }
        if (rawCharacters.B) {
          const charB = rawCharacters.B as any;
          formattedCharacters.B = {
            id: charB.id,
            slug: charB.slug || charB.name?.toLowerCase().replace(/\s+/g, "-") || `character-b-${charB.id}`,
            name: charB.name,
            avatarUrl: getAvatarUrl(charB),
            enabled: charB.enabled !== undefined ? charB.enabled : true,
            isPlaceholder: false,
            voiceId: charB.voiceId || charB.voice_id || null,
          } as Character;
        }
      }
      
      // Normalize status: if status is READY but no final_url, it should be DRAFT
      let normalizedStatus = (project as any).status;
      if (normalizedStatus === 'READY' && !(project as any).final_url) {
        normalizedStatus = 'DRAFT';
      }
      // Also ensure DRAFT status if no final_url and status is null/undefined
      if (!normalizedStatus && !(project as any).final_url) {
        normalizedStatus = 'DRAFT';
      }
      
      // Convert API format to local format
      const formattedProject = {
        ...project,
        userId: (project as any).user_id,
        type: projectType as ProjectType, // Set type from metadata
        status: normalizedStatus as RenderStatus,
        characters: formattedCharacters,
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

      // Extract subtitle settings from metadata (reusing projectMetadata)
      const metadata = projectMetadata;
      const subtitleStyle = metadata.subtitleStyle || "bold-green";
      // Use centered position (y: 50) for story type, lower position (y: 85) for two-char conversations
      const defaultSubtitleY = (projectType === "story" || projectType === "STORY_NARRATION" || projectType === "NORMAL_STORY" || projectType === "REDDIT_STORY") ? 50 : 85;
      const subtitlePosition = metadata.subtitlePosition || { x: 50, y: defaultSubtitleY };
      const subtitleFontSize = metadata.subtitleFontSize || 100;
      const subtitleFontFamily = metadata.subtitleFontFamily || "zy-resolve";
      const subtitleSingleLine = metadata.subtitleSingleLine !== undefined ? metadata.subtitleSingleLine : true;  // Default to 3-word mode
      const subtitleSingleWord = metadata.subtitleSingleWord || false;
      const karaokePillColor = metadata.karaokePillColor || '#E96BA8';
      const boldGreenColor = metadata.boldGreenColor || '#63E443';
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
      const characterCustomPositions = metadata.characterCustomPositions || undefined;
      
      // Extract merged audio URL and duration from metadata
      const mergedAudioUrl = metadata.mergedAudioUrl || null;
      const mergedDurationMs = metadata.mergedDurationMs || null;
      
      // Extract audioFiles from metadata if available (for browser preview mode in edit)
      const audioFilesMetadata = metadata.audioFiles || null;

      // Convert project to draft format
      // For story narration projects, we need to preserve scriptInput from metadata or reconstruct it
      // Story narration projects don't have script segments with speakers, they have plain text
      let scriptInput = "";
      if (projectType === "story" || projectType === "STORY_NARRATION" || projectType === "NORMAL_STORY" || projectType === "REDDIT_STORY") {
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
          } catch (e) {
            // Failed to reconstruct scriptInput from SRT
          }
        }
      } else {
        // For two-char projects, use speaker: text format
        scriptInput = formattedProject.script?.map((line: ScriptLine) => `${line.speaker}: ${line.text}`).join('\n') || "";
      }
      
      // Extract background_id from project (it's stored as background_id in the database)
      const backgroundId = (project as any).background_id || null;

      // Extract redditTitle from metadata
      const redditTitle = projectMetadata.redditTitle || null;

      const draft: DraftProject = {
        id: formattedProject.id,
        type: formattedProject.type,
        title: formattedProject.title,
        status: formattedProject.status,
        characters: formattedProject.characters || { A: null, B: null },
        script: formattedProject.script || [],
        scriptInput: scriptInput,
        backgroundId: backgroundId as BackgroundId | null,
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
        subtitleFontFamily: subtitleFontFamily,
        subtitleSingleLine: subtitleSingleLine,
        subtitleSingleWord: subtitleSingleWord,
        playbackRate: playbackRate,
        characterSizes: characterSizes,
        characterPositions: characterPositions,
        characterCustomPositions: characterCustomPositions,
        mergedAudioUrl: mergedAudioUrl,
        mergedDurationMs: mergedDurationMs || null,
        audioFiles: audioFilesMetadata || undefined,
        redditTitle: redditTitle,
        metadata: projectMetadata, // Preserve full metadata object (needed for texting videos)
        updatedAt: new Date().toISOString(),
      };

      set({ draft });
    } catch (error) {
      throw error;
    }
  },

  /**
   * Generate preview video
   */
  enqueuePreview: async (projectId?: string, userId?: string) => {
    try {
      const draft = get().draft;
      
      // Check if projectId is a valid database project ID
      // If it's a local UUID (from draft), it won't exist in the projects list
      let targetProjectId = projectId;
      const existingProject = projectId ? get().projects.find(p => p.id === projectId) : null;
      
      // If no valid projectId or project doesn't exist in database, create project first
      if (!targetProjectId || !existingProject) {
        
        // Check if we have a draft with script
        if (!draft?.script?.length) {
          throw new Error("No script available for preview");
        }
        
        // Create project from draft first
        // Use provided userId or fallback to null (for dev mode)
        const finalUserId = userId || null;
        const newProject = await get().createProjectFromDraft(finalUserId || "mock-user");
        
        if (!newProject) {
          throw new Error("Failed to create project");
        }
        
        if (!newProject.id) {
          throw new Error("Project created but ID is missing");
        }
        
        targetProjectId = newProject.id;
        
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
      } else {
        // When editing existing project, characters and script should already exist
        // But let's verify the project has what it needs
        if (!draft?.script?.length) {
          throw new Error("No script available for preview");
        }
      }
      
      // Validate targetProjectId before calling API
      if (!targetProjectId) {
        throw new Error("Project ID is missing - cannot generate audio");
      }
      
      // Generate audio files only (no video render for preview)
      let audioResult;
      try {
        audioResult = await renderApi.generateAudio(targetProjectId);
      } catch (apiError) {
        throw apiError;
      }
      
      if (!audioResult || !audioResult.success || !audioResult.audioFiles) {
        throw new Error("Failed to generate audio - invalid response");
      }
      
      // Generate subtitles from audio timing
      // Map conversations to subtitle segments with speaker info
      // Note: 'draft' is already declared at the top of this function (line 776)
      const subtitleSegments = audioResult.conversations.map((conv, index) => {
        // Determine speaker: check if this matches character A or B from draft
        const speakerName = conv.speaker.toLowerCase();
        const charAName = draft.characters.A?.name?.toLowerCase() || '';
        const charBName = draft.characters.B?.name?.toLowerCase() || '';
        
        // Match speaker name to character
        let speaker: "A" | "B" = "A"; // Default to A
        if (charAName && speakerName === charAName) {
          speaker = "A";
        } else if (charBName && speakerName === charBName) {
          speaker = "B";
        } else {
          // Fallback: alternate based on index if names don't match
          speaker = index % 2 === 0 ? "A" : "B";
        }
        
        return {
          startMs: conv.startMs,
          endMs: conv.endMs,
          speaker: speaker,
          text: conv.text
        };
      });
      
      // Generate SRT text in comma-separated format (startMs,endMs,speaker,text)
      // This matches the parseSrtText function's expected format
      const srtText = serializeSrt(subtitleSegments);
      
      // Update draft with audio files and enable browser preview mode
      set((state) => {
        const updatedDraft: DraftProject = {
          ...state.draft,
          id: targetProjectId,
          status: "READY" as const, // Ready for browser preview
          audioFiles: audioResult.audioFiles.map(af => ({
            speaker: af.speaker,
            text: af.text,
            publicUrl: af.publicUrl,
            startMs: af.startMs,
            endMs: af.endMs,
            durationMs: af.durationMs,
          })),
          mergedAudioUrl: audioResult.mergedAudioUrl || null,
          mergedDurationMs: audioResult.mergedDurationMs || audioResult.totalDurationMs,
          audioTotalDurationMs: audioResult.totalDurationMs,
          durationSec: audioResult.totalDurationSec,
          srtText: srtText,
          originalSrtText: srtText,
          subtitleEnabled: true,
        };
        return { draft: updatedDraft };
      });
      
      // Save audio files info and merged audio URL to database
      try {
        const currentDraft = get().draft;
        await get().updateProject(targetProjectId, {
          status: "READY" as RenderStatus,
          srtText: srtText,
          durationSec: audioResult.totalDurationSec,
          // Store merged audio URL and audio files in metadata for edit mode
          mergedAudioUrl: currentDraft.mergedAudioUrl || audioResult.mergedAudioUrl || null,
          mergedDurationMs: currentDraft.mergedDurationMs || audioResult.mergedDurationMs || null,
          audioFiles: currentDraft.audioFiles || audioResult.audioFiles || null,
        } as any).catch(() => {});
      } catch (error) {
        // Failed to save to database
      }
      
      // Show success message
      import('sonner').then(({ toast }) => {
        toast.success("Audio generated! Preview is ready 🎉");
      }).catch(() => {});
      
    } catch (error) {
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
      
      // Get redditTitle from draft or fetch from project metadata
      let finalRedditTitle = draft.redditTitle;
      
      // If redditTitle not in draft, try to get it from project metadata
      if (!finalRedditTitle && targetProjectId) {
        try {
          const { project } = await projectsApi.get(targetProjectId);
          const metadata = (project as any).metadata || {};
          finalRedditTitle = metadata.redditTitle || null;
          console.log("📖 Fetched redditTitle from project metadata:", finalRedditTitle);
          
          // Update draft with redditTitle from metadata
          if (finalRedditTitle) {
            get().updateDraft({ redditTitle: finalRedditTitle });
          }
        } catch (error) {
          console.warn("⚠️ Failed to fetch redditTitle from metadata:", error);
        }
      }
      
      // Save redditTitle to project metadata if it exists in draft and differs from metadata
      if (draft.redditTitle && targetProjectId && draft.redditTitle !== finalRedditTitle) {
        try {
          // Fetch existing project to get current metadata
          const { project } = await projectsApi.get(targetProjectId);
          const existingMetadata = (project as any).metadata || {};
          
          // Merge redditTitle into existing metadata
          const updatedMetadata = {
            ...existingMetadata,
            redditTitle: draft.redditTitle,
          };
          
          await projectsApi.update(targetProjectId, { metadata: updatedMetadata });
          console.log("✅ Saved redditTitle to project metadata:", draft.redditTitle);
          finalRedditTitle = draft.redditTitle;
        } catch (error) {
          console.warn("⚠️ Failed to save redditTitle to metadata:", error);
        }
      }
      
      // Use finalRedditTitle (from draft or metadata)
      const redditTitleToSend = finalRedditTitle || draft.redditTitle || null;
      
      // Call render API with customizations
      console.log("📤 Sending character sizes and positions to backend:", {
        characterSizes: draft.characterSizes,
        characterPositions: draft.characterPositions,
        characterCustomPositions: draft.characterCustomPositions,
      });
      console.log("📤 Sending redditTitle to backend:", {
        hasRedditTitle: !!redditTitleToSend,
        redditTitle: redditTitleToSend,
        fromDraft: !!draft.redditTitle,
        fromMetadata: !!finalRedditTitle && !draft.redditTitle,
        draftKeys: Object.keys(draft),
      });
      // Initialize character sizes for custom characters if missing
      const defaultSizes: Record<string, { width: number; height: number }> = {
        Peter: { width: 320, height: 400 },
        Stewie: { width: 280, height: 360 },
        Rick: { width: 480, height: 600 },
        Brian: { width: 280, height: 360 },
        Morty: { width: 400, height: 520 },
      };
      const DEFAULT_CUSTOM_SIZE = { width: 400, height: 500 };
      
      const initializedCharacterSizes = {
        ...draft.characterSizes || {},
      };
      
      // Ensure selected characters have sizes
      [draft.characters?.A?.name, draft.characters?.B?.name]
        .filter(Boolean)
        .forEach((charName) => {
          if (charName && !initializedCharacterSizes[charName]) {
            initializedCharacterSizes[charName] = defaultSizes[charName] || DEFAULT_CUSTOM_SIZE;
          }
        });
      
      // Initialize character positions for custom characters if missing
      const defaultPositions: Record<string, 'left' | 'right' | 'center'> = {
        Peter: 'left',
        Stewie: 'right',
        Rick: 'left',
        Brian: 'right',
        Morty: 'right',
      };
      
      const initializedCharacterPositions = {
        ...draft.characterPositions || {},
      };
      
      // Ensure selected characters have positions
      [draft.characters?.A?.name, draft.characters?.B?.name]
        .filter(Boolean)
        .forEach((charName, index) => {
          if (charName && !initializedCharacterPositions[charName]) {
            initializedCharacterPositions[charName] = defaultPositions[charName] || (index === 0 ? 'left' : 'right');
          }
        });
      
      // Build the request payload
      const requestPayload: any = {
        textOverlays: draft.textOverlays,
        subtitleCustomizations: {
          style: draft.subtitleStyle,
          position: draft.subtitlePosition,
          fontSize: draft.subtitleFontSize,
          fontFamily: draft.subtitleFontFamily || 'bebas-neue',
          singleLine: draft.subtitleSingleLine ?? true,  // Default to 3-word mode
          singleWord: draft.subtitleSingleWord ?? false,
          karaokePillColor: draft.karaokePillColor || '#E96BA8',
          boldGreenColor: draft.boldGreenColor || '#63E443',
        },
        srtText: draft.srtText,
        imageOverlays: draft.imageOverlays,
        playbackRate: draft.playbackRate || 1, // Include playback rate
        characterSizes: initializedCharacterSizes, // Include initialized character sizes (with custom characters)
        characterPositions: initializedCharacterPositions, // Include initialized character positions (with custom characters)
        characterCustomPositions: draft.characterCustomPositions, // Include custom character positions
      };
      
      // Only include redditTitle if it has a value (don't send null/undefined)
      if (redditTitleToSend) {
        requestPayload.redditTitle = redditTitleToSend;
      }
      
      console.log("📤 Final request payload keys:", Object.keys(requestPayload));
      console.log("📤 Final request payload redditTitle:", requestPayload.redditTitle);
      console.log("📤 Final request payload FULL object:", JSON.stringify(requestPayload, null, 2));
      console.log("📤 Draft state at render time:", {
        hasRedditTitle: !!draft.redditTitle,
        redditTitle: draft.redditTitle,
        draftId: draft.id,
        draftType: draft.type,
        allDraftKeys: Object.keys(draft),
      });
      
      const result = await renderApi.generateFinal(targetProjectId, requestPayload);
      
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
                // Failed to save final URL to database
              }
              
              // Unsubscribe when completed
              get().unsubscribeFromRenderJob();
            }
          }
        } catch (statusError) {
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
          await get().updateProject(targetProjectId, {
            finalUrl: result.videoUrl,
          });
        } catch (dbError) {
          // Don't throw - final video still works locally
        }
      }
      
    } catch (error) {
      
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
      supabase.removeChannel(existingSub);
    }
    
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
          const renderJob = payload.new as any;
          
          if (!renderJob) {
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

          // Handle story narrations - project is created by worker, just need to load it
          const isStoryPreview = renderJob.type === 'STORY_PREVIEW';
          let actualProjectId = projectId;
          const metadata = renderJob.metadata || {};
          
          // For story narrations, the worker creates the project, so we need to refresh projects list
          if (isStoryPreview && jobStatus === 'completed' && renderJob.result_url && projectId) {
            const existingProject = get().projects.find(p => p.id === projectId);
            
            if (!existingProject) {
              try {
                // Refresh projects list to include the project created by the worker
                await get().loadProjects();
              } catch (loadError) {
                // Continue - we can still update the draft
              }
            }
            
            // Ensure draft ID matches the project ID created by worker
            const currentDraft = get().draft;
            if (currentDraft.id !== projectId) {
              get().updateDraft({ id: projectId });
            }
          }

          // Update draft with realtime data (use actualProjectId which may have been updated above)
          const finalProjectId = actualProjectId;
          set((state) => {
            const draftUpdate: Partial<DraftProject> = {
              renderProgress: renderJob.progress || 0,
              status: frontendStatus,
            };
            

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
              const isFinalRender = renderJob.type === 'FINAL' || renderJob.type === 'STORY_FINAL';
              
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
                  }).catch(() => {});
                }

                // Show success toast
                import('sonner').then(({ toast }) => {
                  toast.success("Final video rendered successfully! 🎬");
                }).catch(() => {});
              } else {
                // Preview render - update previewUrl
                // Transform URL to full URL if needed (for story narrations, result_url might be relative)
                const fullVideoUrl = renderJob.result_url.startsWith('http') 
                  ? renderJob.result_url 
                  : `${config.remotionServerUrl}${renderJob.result_url}`;
                
                draftUpdate.previewUrl = fullVideoUrl;
                draftUpdate.durationSec = metadata.durationSec || 0;
                draftUpdate.srtText = metadata.srtText || '';
                draftUpdate.originalSrtText = metadata.srtText || '';
                draftUpdate.subtitleEnabled = true;

                // Update projects list if project exists
                // Note: For story narrations, project is created by worker and loaded above
                if (finalProjectId) {
                  // Transform URL for projects list too
                  const fullVideoUrl = renderJob.result_url.startsWith('http') 
                    ? renderJob.result_url 
                    : `${config.remotionServerUrl}${renderJob.result_url}`;
                  
                  const updatedProjects = state.projects.map((p) =>
                    p.id === finalProjectId
                      ? {
                          ...p,
                          status: "READY" as RenderStatus,
                          previewUrl: fullVideoUrl,
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
                    }).catch(() => {});
                  }

                  // Show success toast
                  import('sonner').then(({ toast }) => {
                    toast.success("Preview generated successfully! 🎉");
                  }).catch(() => {});
                }
              }

              // Unsubscribe when completed
              get().unsubscribeFromRenderJob();
            }

            // If failed, update status
            if (jobStatus === 'failed') {
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
                  
                  const isFinalRender = renderJob.type === 'FINAL' || renderJob.type === 'STORY_FINAL';
                  const metadata = renderJob.metadata || {};
                  
                  if (isFinalRender) {
                    return {
                      ...p,
                      status: "READY" as RenderStatus,
                      finalUrl: renderJob.result_url!,
                    };
                  } else {
                    // Transform URL for projects list
                    const fullVideoUrl = renderJob.result_url.startsWith('http') 
                      ? renderJob.result_url 
                      : `${config.remotionServerUrl}${renderJob.result_url}`;
                    
                    return {
                      ...p,
                      status: "READY" as RenderStatus,
                      previewUrl: fullVideoUrl,
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
          set({ realtimeConnected: true });
        } else if (status === 'CHANNEL_ERROR') {
          set({ realtimeConnected: false });
        } else if (status === 'TIMED_OUT') {
          set({ realtimeConnected: false });
        } else if (status === 'CLOSED') {
          set({ realtimeConnected: false });
        } else {
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
      supabase.removeChannel(subscription);
      set({ renderJobSubscription: null });
    }
  },
}));

