# Instagram Login (current implementation)

The app uses **Instagram API with Instagram Login**, not the Facebook `dialog/oauth` flow.

## User flow

1. User clicks **Connect** → redirect to `https://api.instagram.com/oauth/authorize`
2. User approves scopes: `instagram_business_basic`, `instagram_business_content_publish`
3. Callback page `/app/automate/instagram/callback` sends `code` to `POST /api/auth/instagram/exchange`
4. Server exchanges `code` at `https://api.instagram.com/oauth/access_token`, then long‑lived token at `https://graph.instagram.com/access_token`
5. Token + `ig_user_id` are stored in `user_instagram_connections` (`ig_user_id` always comes from **`GET graph.instagram.com/v25.0/me`** so large numeric IDs are never corrupted by JavaScript number precision).
6. Video server publishes via `https://graph.instagram.com/v25.0/{ig-user-id}/media` (see `INSTAGRAM_GRAPH_BASE_URL` in Remotion)

## Troubleshooting: Reels publish fails with Meta `OAuthException` / generic 500 on `POST .../media`

If publishing worked in Graph API Explorer but not from the app, **disconnect and reconnect Instagram** on the Automate page. Older connections may have stored `ig_user_id` from the OAuth `user_id` JSON number (which can be off by one digit for 17‑digit IG IDs).

## Environment (Next.js)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_INSTAGRAM_APP_ID` | **Required for Instagram Login.** The **Instagram app ID** shown at the top of **Instagram → API setup with Instagram login** (e.g. `865173062959827`). This is often **not** the same number as **App settings → Basic → App ID**. If you use the wrong ID, Instagram shows `Invalid platform app`. |
| `NEXT_PUBLIC_META_APP_ID` | Only use if it is **identical** to the Instagram app ID above; otherwise leave unset and use `NEXT_PUBLIC_INSTAGRAM_APP_ID` only. |
| `META_APP_SECRET` | **App secret** from **App settings → Basic** (same Meta app that contains the Instagram product). |
| `NEXT_PUBLIC_META_REDIRECT_URI` | Must match **exactly** what you register for Instagram OAuth, e.g. `http://localhost:3000/app/automate/instagram/callback` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Not required** for `/api/auth/instagram/exchange` — it uses your session JWT + RLS. (Optional for other server-only jobs.) |

## Troubleshooting: `Invalid platform app`

1. Open **Meta for Developers** → your app → **Instagram** → **API setup with Instagram login**.
2. Copy **Instagram app ID** from that page (not from Basic settings unless they match).
3. Set `NEXT_PUBLIC_INSTAGRAM_APP_ID` to that value in `.env.local`, restart Next.js.
4. Confirm **Valid OAuth Redirect URIs** under the Instagram product includes your callback URL.
5. `META_APP_SECRET` must be the **App secret** for the **same** Meta app (the parent app that owns the Instagram product).

## Meta Developer Console

1. **Instagram** → **API setup with Instagram login** (or equivalent).
2. Add **Valid OAuth Redirect URIs** for `api.instagram.com` (same URL as `NEXT_PUBLIC_META_REDIRECT_URI`).
3. Ensure permissions **`instagram_business_basic`** and **`instagram_business_content_publish`** are available for your app (and App Review when going live).

## Remotion server (publishing)

| Variable | Default |
|----------|---------|
| `INSTAGRAM_GRAPH_BASE_URL` | `https://graph.instagram.com/v21.0` |

## Reconnect after switching from Facebook OAuth

If you previously connected with Facebook Login, **disconnect and connect again** so tokens are Instagram User tokens compatible with `graph.instagram.com`.
