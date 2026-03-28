import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const IG_GRAPH_ME = "https://graph.instagram.com/v25.0/me";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) {
      return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const { data: rows, error } = await supabase
      .from("user_instagram_connections")
      .select("ig_user_id,access_token")
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ connected: false });
    }

    let username: string | null = null;
    const connectionId = row.ig_user_id ? String(row.ig_user_id) : null;

    if (row.access_token) {
      const meUrl = new URL(IG_GRAPH_ME);
      meUrl.searchParams.set("fields", "id,username");
      meUrl.searchParams.set("access_token", row.access_token);
      try {
        const meRes = await fetch(meUrl.toString());
        const meJson = (await meRes.json()) as { id?: string; username?: string };
        if (meRes.ok && meJson.username) {
          username = meJson.username;
        }
      } catch {
        // Best effort only; keep connection visible even if Graph fetch fails.
      }
    }

    return NextResponse.json({
      connected: true,
      igUserId: connectionId,
      username,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "connection status failed" },
      { status: 500 }
    );
  }
}
