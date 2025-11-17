# FacelessForge (Front-end MVP)

FacelessForge is a Next.js 14 application built with TypeScript, Tailwind CSS, Zustand, and shadcn/ui. It demonstrates the full "2 Characters Having a Conversation" creation flow with **real video generation** using the remotion video server.

## Features
- Mock authentication with localStorage persistence (optional Supabase button placeholder)
- Authenticated dashboard with seeded and user-created projects, status badges, and preview dialog
- Guided creation flow with stepper: character selection, script editor with validation, preview & overlays
- **Real video generation** with free Google TTS (no API keys required)
- Subtitles editor with auto-generation, overlay uploads (client previews)
- Framer Motion micro-interactions, accessible UI, responsive layouts, and sonner toasts

## Getting Started

### 1. Start the Video Server (Required for video generation)
```bash
cd ../remotion-video/server
npm install
npm start
```
Server will run on http://localhost:3001

### 2. Start the Frontend
```bash
npm install
npm run dev
```
> Prefer pnpm? Run `pnpm install && pnpm dev` instead.

Open http://localhost:3000 to explore the marketing page. Sign in with any email to access the dashboard and creation flow.

**🎬 To generate TikTok/Reels videos:**
1. Select 2 characters
2. Write your script
3. Click "Next: Preview"
4. Click "Generate TikTok/Reels Preview"
5. Wait 30-60 seconds for your vertical video (1080×1920)!

See [VIDEO_PREVIEW_INTEGRATION.md](./VIDEO_PREVIEW_INTEGRATION.md) for detailed documentation.

## Tech Stack
- Next.js 14 App Router + TypeScript
- Tailwind CSS (v4) + shadcn/ui components
- Zustand for state, React Hook Form + Zod for validation
- Framer Motion, lucide-react icons, sonner toasts

## Notes
- **Video Generation:** Real videos are generated using the remotion server with free Google TTS
- **Storage:** All data (draft projects, user preferences) stored in browser localStorage
- **Persist Middleware:** State persists across page refreshes thanks to Zustand persist middleware
- Pricing and Settings sections are intentionally disabled with tooltips ("Coming soon")

## Documentation
- [Video Preview Integration Guide](./VIDEO_PREVIEW_INTEGRATION.md) - How the video generation works
- [Frontend Specification](./FEspec.md) - Original design spec
- [Remotion Server Docs](../remotion-video/server/README.md) - Backend video server documentation
