"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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
import {
  simulateFinalRenderJob,
  simulatePreviewJob,
} from "@/lib/utils/fake-jobs";

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
  originalSrtText?: string; // Store original server-generated subtitles for restoration
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
  startDraft: () => DraftProject;
  updateDraft: (updates: Partial<DraftProject>) => void;
  setDraftCharacters: (characters: Character[]) => void;
  clearDraft: () => void;
  createProjectFromDraft: (userId: string) => Project | null;
  deleteProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  enqueuePreview: (projectId?: string) => void;
  simulateRender: (projectId?: string) => void;
};

const createSeedProject = (): Project[] => {
  const hero1 = CHARACTERS.find((character) => character.id === "hero1");
  const hero2 = CHARACTERS.find((character) => character.id === "hero2");

  if (!hero1 || !hero2) return [];

  const now = new Date().toISOString();

  return [
    {
      id: uuid(),
      userId: "seed-user",
      type: "TWO_CHAR_CONVO",
      title: "Galactic Negotiations",
      status: "READY",
      characters: { A: hero1, B: hero2 },
      script: [
        { speaker: "A", text: "Welcome aboard the FacelessForge!" },
        { speaker: "B", text: "Glad to be here—shall we start crafting?" },
      ],
      overlays: [],
      previewUrl: "/videos/sample-preview.mp4",
      finalUrl: "/videos/sample-preview.mp4",
      srtText:
        "0,1200,A,Welcome aboard the FacelessForge!\n1200,2300,B,Glad to be here—shall we start crafting?",
      durationSec: 12,
      createdAt: now,
      updatedAt: now,
    },
  ];
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
  previewUrl: null,
  finalUrl: null,
  durationSec: null,
  subtitleEnabled: true,
  subtitleStyle: "classic",
  subtitlePosition: { x: 50, y: 60 },
  subtitleFontSize: 100,
  updatedAt: new Date().toISOString(),
});

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      projects: createSeedProject(),
      draft: initialDraft(),
      startDraft: () => {
        const draft = initialDraft();
        set({ draft });
        return draft;
      },
      updateDraft: (updates) => {
        set((state) => ({
          draft: {
            ...state.draft,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        }));
      },
      setDraftCharacters: (characters) => {
        const [first, second] = characters;
        set((state) => ({
          draft: {
            ...state.draft,
            characters: {
              A: first ?? null,
              B: second ?? null,
            },
            updatedAt: new Date().toISOString(),
          },
        }));
      },
      clearDraft: () => {
        set({ draft: initialDraft() });
      },
      createProjectFromDraft: (userId) => {
        const { draft } = get();
        if (!draft.characters.A || !draft.characters.B) {
          return null;
        }

        const now = new Date().toISOString();
        const project: Project = {
          id: draft.id,
          userId,
          type: draft.type,
          title: draft.title || "Untitled Conversation",
          status: draft.status ?? "READY",
          characters: {
            A: draft.characters.A,
            B: draft.characters.B,
          },
          script: draft.script,
          overlays: draft.overlays,
          textOverlays: draft.textOverlays,
          previewUrl: draft.previewUrl,
          finalUrl: draft.finalUrl,
          srtText: draft.srtText,
          subtitleStyle: draft.subtitleStyle,
          durationSec: draft.durationSec,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          projects: [project, ...state.projects.filter((item) => item.id !== project.id)],
          draft: initialDraft(),
        }));

        return project;
      },
      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
        }));
      },
      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, ...updates, updatedAt: new Date().toISOString() }
              : project,
          ),
        }));
      },
      enqueuePreview: async (projectId) => {
        const applyStatus = (status: RenderStatus) => {
          if (projectId) {
            get().updateProject(projectId, {
              status,
              ...(status === "QUEUED" ? { previewUrl: null } : {}),
            });
          } else {
            set((state) => ({
              draft: {
                ...state.draft,
                status,
                ...(status === "QUEUED" ? { previewUrl: null } : {}),
                updatedAt: new Date().toISOString(),
              },
            }));
          }
        };

        // Set initial status to QUEUED
        applyStatus("QUEUED");

        try {
          // Get the script and characters from either project or draft
          let script: ScriptLine[];
          let characters: { A: Character | null; B: Character | null };

          if (projectId) {
            const project = get().projects.find((item) => item.id === projectId);
            if (!project) {
              throw new Error("Project not found");
            }
            script = project.script;
            characters = project.characters;
          } else {
            const currentDraft = get().draft;
            script = currentDraft.script;
            characters = currentDraft.characters;
          }

          // Validate that we have both characters
          if (!characters.A || !characters.B) {
            throw new Error("Both characters must be selected");
          }

          // Set status to RENDERING
          applyStatus("RENDERING");

          // Call the real API to generate the video
          const { api } = await import("@/lib/services/api");
          const response = await api.generateVideoPreview({
            script,
            characters,
            backgroundId: "minecraft",
          });

          // Construct the full video URL
          const { config } = await import("@/lib/config");
          const videoUrl = `${config.remotionServerUrl}${response.videoUrl}`;

          // Generate SRT text from actual timing data
          let srtText = "";
          if (response.conversations && response.conversations.length > 0) {
            // Use actual timing from server
            // The server returns speaker names like "Stewie", "Peter" etc.
            // We need to map them back to "A" or "B" based on the script
            srtText = response.conversations
              .map((conv, index) => {
                const startMs = conv.startMs ?? 0;
                const endMs = conv.endMs ?? 1000;
                // Map speaker back to A or B based on script order
                const scriptLine = script[index];
                const speaker = scriptLine?.speaker || "A";
                return `${startMs},${endMs},${speaker},${conv.text}`;
              })
              .join("\n");
          } else {
            // Fallback to mock if no timing data
            srtText = generateMockFromScript(script);
          }

          // Update with the successful result
          if (projectId) {
            const project = get().projects.find((item) => item.id === projectId);
            get().updateProject(projectId, {
              status: "READY",
              previewUrl: videoUrl,
              durationSec: response.durationSec || 12,
              srtText: srtText,
            });
          } else {
            const currentDraft = get().draft;
            set({
              draft: {
                ...currentDraft,
                status: "READY",
                previewUrl: videoUrl,
                durationSec: response.durationSec || 12,
                srtText: srtText,
                originalSrtText: srtText, // Store original for restoration
                updatedAt: new Date().toISOString(),
              },
            });
          }
        } catch (error) {
          console.error("Failed to generate video preview:", error);
          
          // Set status to FAILED
          if (projectId) {
            get().updateProject(projectId, {
              status: "FAILED",
            });
          } else {
            set((state) => ({
              draft: {
                ...state.draft,
                status: "FAILED",
                updatedAt: new Date().toISOString(),
              },
            }));
          }

          // Re-throw the error so the UI can handle it
          throw error;
        }
      },
      simulateRender: async (projectId) => {
        // Helper to update status
        const applyStatus = (status: RenderStatus) => {
          if (projectId) {
            get().updateProject(projectId, { status });
          } else {
            set((state) => ({
              draft: {
                ...state.draft,
                status,
                updatedAt: new Date().toISOString(),
              },
            }));
          }
        };

        // Set initial status to RENDERING
        applyStatus("RENDERING");

        try {
          // Get data from either project or draft
          let script: ScriptLine[];
          let characters: { A: Character | null; B: Character | null };
          let textOverlays: TextOverlay[];
          let subtitleStyle: SubtitleStyle;
          let subtitlePosition: SubtitlePosition;
          let subtitleFontSize: number;
          let srtText: string;

          if (projectId) {
            const project = get().projects.find((item) => item.id === projectId);
            if (!project) {
              throw new Error("Project not found");
            }
            script = project.script;
            characters = project.characters;
            textOverlays = project.textOverlays || [];
            subtitleStyle = (project as any).subtitleStyle || "classic";
            subtitlePosition = (project as any).subtitlePosition || { x: 50, y: 60 };
            subtitleFontSize = (project as any).subtitleFontSize || 100;
            srtText = project.srtText || "";
          } else {
            const currentDraft = get().draft;
            script = currentDraft.script;
            characters = currentDraft.characters;
            textOverlays = currentDraft.textOverlays || [];
            subtitleStyle = currentDraft.subtitleStyle;
            subtitlePosition = currentDraft.subtitlePosition;
            subtitleFontSize = currentDraft.subtitleFontSize;
            srtText = currentDraft.srtText;
          }

          // Validate that we have both characters
          if (!characters.A || !characters.B) {
            throw new Error("Both characters must be selected");
          }

          // Call the real API to generate the final video
          const { api } = await import("@/lib/services/api");
          const response = await api.generateFinalVideo({
            script,
            characters,
            backgroundId: "minecraft",
            textOverlays,
            subtitleCustomizations: {
              style: subtitleStyle,
              position: subtitlePosition,
              fontSize: subtitleFontSize,
            },
            srtText,
          });

          // Construct the full video URL
          const { config } = await import("@/lib/config");
          const videoUrl = `${config.remotionServerUrl}${response.videoUrl}`;

          // Update with final URL
          if (projectId) {
            get().updateProject(projectId, {
              finalUrl: videoUrl,
              status: "READY",
            });
          } else {
            set((state) => ({
              draft: {
                ...state.draft,
                finalUrl: videoUrl,
                status: "READY",
                updatedAt: new Date().toISOString(),
              },
            }));
          }
        } catch (error) {
          console.error("Error generating final video:", error);
          applyStatus("READY"); // Reset to previous state
          // Re-throw the error so the UI can handle it
          throw error;
        }
      },
    }),
    {
      name: "facelessforge-projects",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        draft: state.draft,
      }),
    },
  ),
);
