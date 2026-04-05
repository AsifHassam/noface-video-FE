import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL?.toLowerCase() || "asifhassam14@gmail.com";

export type AdminAuthResult = { email: string; userId: string };

/**
 * Verifies Bearer JWT and checks admin email. Used by /api/admin/* routes.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AdminAuthResult | Response> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    return Response.json(
      { success: false, error: "Missing authorization" },
      { status: 401 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return Response.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user?.email) {
    return Response.json(
      { success: false, error: "Invalid session" },
      { status: 401 }
    );
  }

  if (user.email.toLowerCase() !== ADMIN_EMAIL) {
    return Response.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    );
  }

  return { email: user.email, userId: user.id };
}
