import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAccessToken } from "@/lib/auth-rest";

/**
 * Instagram Login: exchange authorization code for Instagram User access token,
 * then long-lived token. Stores token + ig_user_id for graph.instagram.com publishing.
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/reference/access_token/
 */

const IG_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH_TOKEN_URL = "https://graph.instagram.com/access_token";
/** Use same API version as server-side publish (instagramPublish.js). */
const IG_GRAPH_ME = "https://graph.instagram.com/v25.0/me";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }

    const { user, error: userErr } = await verifyAccessToken(token);
    if (userErr || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await req.json();
    const code = body?.code as string | undefined;
    if (!code) {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }

    const appId =
      process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID ||
      process.env.NEXT_PUBLIC_META_APP_ID ||
      process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.NEXT_PUBLIC_META_REDIRECT_URI;

    if (!appId || !appSecret || !redirectUri) {
      return NextResponse.json(
        {
          error:
            "Missing META_APP_SECRET, redirect URI, or INSTAGRAM/META app id for Instagram Login",
        },
        { status: 503 }
      );
    }

    // 1) Short-lived Instagram User access token
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });

    const shortRes = await fetch(IG_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const shortJson = (await shortRes.json()) as {
      access_token?: string;
      user_id?: number | string;
      error_type?: string;
      error_message?: string;
      data?: Array<{ access_token?: string; user_id?: number | string }>;
    };

    let shortToken = shortJson.access_token;

    if (!shortToken && Array.isArray(shortJson.data) && shortJson.data[0]?.access_token) {
      shortToken = shortJson.data[0].access_token;
    }

    /**
     * Do NOT use shortJson.user_id for storage. OAuth may return user_id as a JSON number;
     * IDs like 26011477811877709 exceed Number.MAX_SAFE_INTEGER, so JSON.parse yields the
     * wrong digit (e.g. ...708 vs ...709) and Reels POST /media fails with generic Meta errors.
     * We always resolve ig_user_id from GET /me after we have a token (id is a string in the response).
     */

    if (!shortRes.ok || !shortToken) {
      const msg =
        shortJson.error_message ||
        shortJson.error_type ||
        JSON.stringify(shortJson) ||
        "Instagram token exchange failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 2) Long-lived token (~60 days)
    const longUrl = new URL(IG_GRAPH_TOKEN_URL);
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortToken);

    const longRes = await fetch(longUrl.toString());
    const longJson = (await longRes.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: { message?: string };
    };

    let longToken = longJson.access_token || shortToken;
    if (!longRes.ok && !longJson.access_token) {
      console.warn("[instagram/exchange] Long-lived exchange failed, using short token:", longJson);
      longToken = shortToken;
    }

    // 3) Resolve IG user id from Graph API only (string id — avoids JS number precision bugs)
    const meUrl = new URL(IG_GRAPH_ME);
    meUrl.searchParams.set("fields", "id,username");
    meUrl.searchParams.set("access_token", longToken);
    const meRes = await fetch(meUrl.toString());
    const meJson = (await meRes.json()) as {
      id?: string;
      username?: string;
      error?: { message?: string };
    };

    const igUserId = meJson.id?.trim() || "";
    if (!igUserId) {
      const msg =
        meJson.error?.message ||
        "Could not load Instagram user id from GET /me (required for publishing)";
      console.error("[instagram/exchange] GET /me failed:", meRes.status, meJson);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const expiresAt =
      longJson.expires_in != null
        ? new Date(Date.now() + longJson.expires_in * 1000).toISOString()
        : new Date(Date.now() + 55 * 24 * 60 * 60 * 1000).toISOString();

    // User JWT + anon key + RLS (no service role required on Next.js)
    const supabaseAsUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const { error: upsertErr } = await supabaseAsUser.from("user_instagram_connections").upsert(
      {
        user_id: user.id,
        ig_user_id: igUserId,
        page_id: null,
        access_token: longToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (upsertErr) {
      console.error(upsertErr);
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, igUserId });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "exchange failed" },
      { status: 500 }
    );
  }
}
