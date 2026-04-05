import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { getSupabaseServiceRole } from "@/lib/supabase-service";
import { ensureBundledBlogPostsInDb } from "@/lib/blog-data";

type Body = {
  title: string;
  subtitle?: string | null;
  excerpt: string;
  body_markdown: string;
  author: string;
  published_at: string;
  hero_image_url?: string | null;
  new_slug?: string;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const { slug } = await ctx.params;
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 503 }
    );
  }

  await ensureBundledBlogPostsInDb();

  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id, slug, title, subtitle, excerpt, body_markdown, author, published_at, hero_image_url"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, post: data });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const { slug: paramSlug } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 503 }
    );
  }

  await ensureBundledBlogPostsInDb();

  const targetSlug =
    typeof body.new_slug === "string" && body.new_slug.trim()
      ? slugify(body.new_slug)
      : paramSlug;

  if (!targetSlug || !body.title?.trim() || !body.excerpt?.trim()) {
    return NextResponse.json(
      { success: false, error: "Missing title, excerpt, or slug" },
      { status: 400 }
    );
  }

  const fields = {
    slug: targetSlug,
    title: body.title.trim(),
    subtitle: body.subtitle?.trim() || null,
    excerpt: body.excerpt.trim(),
    body_markdown: body.body_markdown ?? "",
    author: (body.author || "noface.video team").trim(),
    published_at: body.published_at || new Date().toISOString().slice(0, 10),
    hero_image_url: body.hero_image_url ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("blog_posts")
    .select("id")
    .eq("slug", paramSlug)
    .maybeSingle();

  if (!existing?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Post not found. Use POST /api/admin/blog/posts to create a new post.",
      },
      { status: 404 }
    );
  }

  const payload = { ...fields, slug: targetSlug };

  const { data, error: err } = await supabase
    .from("blog_posts")
    .update(payload)
    .eq("id", existing.id)
    .select()
    .single();

  if (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${targetSlug}`);
  revalidatePath(`/blog/${paramSlug}`);

  return NextResponse.json({ success: true, post: data });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const admin = await requireAdmin(req);
  if (admin instanceof Response) return admin;

  const { slug } = await ctx.params;
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 503 }
    );
  }

  const { error } = await supabase.from("blog_posts").delete().eq("slug", slug);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);

  return NextResponse.json({ success: true });
}
