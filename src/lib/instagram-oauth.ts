/**
 * Instagram API with Instagram Login (Business/Creator).
 * OAuth: https://api.instagram.com/oauth/authorize
 *
 * IMPORTANT — client_id must be the "Instagram app ID" from:
 *   Meta Developer → Your App → Instagram → API setup with Instagram login
 *   (top of that page). It is NOT always the same number as
 *   App settings → Basic → App ID. Using the wrong ID causes:
 *   "Invalid platform app" on instagram.com/oauth/authorize.
 *
 * Set NEXT_PUBLIC_INSTAGRAM_APP_ID to that Instagram app ID (required for this URL).
 * Do not rely on NEXT_PUBLIC_META_APP_ID unless you have verified it matches
 * the Instagram product ID exactly.
 *
 * Register redirect URI under Instagram → OAuth settings for api.instagram.com.
 */

const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
].join(",");

export function getInstagramLoginUrl(state: string): string {
  const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const redirectUri = process.env.NEXT_PUBLIC_META_REDIRECT_URI;
  if (!appId || !redirectUri) {
    throw new Error(
      "Set NEXT_PUBLIC_INSTAGRAM_APP_ID (Instagram product app ID) and NEXT_PUBLIC_META_REDIRECT_URI"
    );
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: INSTAGRAM_SCOPES,
    response_type: "code",
    state,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

/** @deprecated Use getInstagramLoginUrl — Facebook OAuth dialog */
export function getMetaOAuthUrl(state: string): string {
  return getInstagramLoginUrl(state);
}
