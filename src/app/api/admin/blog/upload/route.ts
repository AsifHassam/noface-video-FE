import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseServiceRole } from "@/lib/supabase-service";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: "File too large (max 5MB)" },
      { status: 400 }
    );
  }

  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json(
      { success: false, error: "Only JPEG, PNG, WebP, or GIF allowed" },
      { status: 400 }
    );
  }

  const ext =
    type === "image/jpeg"
      ? "jpg"
      : type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : "gif";

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `uploads/${Date.now()}-${safeName || `image.${ext}`}`;

  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("blog-images")
    .upload(path, buf, {
      contentType: type,
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json(
      { success: false, error: upErr.message },
      { status: 500 }
    );
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publicUrl = `${base}/storage/v1/object/public/blog-images/${path}`;

  return NextResponse.json({
    success: true,
    url: publicUrl,
    path,
  });
}
