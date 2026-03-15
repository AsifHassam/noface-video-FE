# Production environment variables (Next.js app)

Set these in your frontend host (e.g. Netlify, Vercel) under **Environment variables**. Use **Build** or **Runtime** as required by your host. All `NEXT_PUBLIC_*` vars are exposed to the browser.

## Required for production

| Variable | Description | Example (prod) |
|----------|-------------|----------------|
| **`NEXT_PUBLIC_REMOTION_SERVER_URL`** | **Backend API base URL** (video, projects, subscription, admin, etc.) | `https://api.yourdomain.com` or your Remotion server URL |
| **`NEXT_PUBLIC_SUPABASE_URL`** | Supabase project URL | `https://YOUR_PROJECT.supabase.co` |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Supabase anon/public key | `eyJ...` (safe to expose in client) |

## Optional

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_STT_SERVER_URL` | STT/Whisper server for subtitles; only if you use a separate STT service |

## Production checklist

1. **Point to prod backend**: `NEXT_PUBLIC_REMOTION_SERVER_URL` must be your **production** Remotion server URL (same as server’s `SERVER_URL` / public URL).
2. **Same Supabase project**: Use the same `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as the one the Remotion server uses (so auth and DB match).
3. **CORS**: The Remotion server must list your frontend origin in `CORS_ALLOWED_ORIGINS` (e.g. `https://noface-video.netlify.app`).

No server-side secrets belong in the Next.js app; billing, webhooks, and Paystack keys stay on the Remotion server.
