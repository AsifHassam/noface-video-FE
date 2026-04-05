import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseServiceRole } from "@/lib/supabase-service";
import { ensureBundledBlogPostsInDb } from "@/lib/blog-data";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type CreateBody = {
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  body_markdown: string;
  author: string;
  published_at: string;
  hero_image_url?: string | null;
};

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Blog database unavailable. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
      },
      { status: 503 }
    );
  }

  await ensureBundledBlogPostsInDb();

  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id, slug, title, subtitle, excerpt, body_markdown, author, published_at, hero_image_url, updated_at"
    )
    .order("published_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, posts: data ?? [] });
}

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

  await ensureBundledBlogPostsInDb();

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const slug = slugify(body.slug || "");
  if (!slug || !body.title?.trim() || !body.excerpt?.trim()) {
    return NextResponse.json(
      { success: false, error: "Missing slug, title, or excerpt" },
      { status: 400 }
    );
  }

  const row = {
    slug,
    title: body.title.trim(),
    subtitle: body.subtitle?.trim() || null,
    excerpt: body.excerpt.trim(),
    body_markdown: body.body_markdown ?? "",
    author: (body.author || "noface.video team").trim(),
    published_at: body.published_at || new Date().toISOString().slice(0, 10),
    hero_image_url: body.hero_image_url ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("blog_posts")
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);

  return NextResponse.json({ success: true, post: data });
}
