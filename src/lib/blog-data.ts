import { getSupabaseServiceRole } from "@/lib/supabase-service";
import { STATIC_BLOG_POSTS, type BlogPost } from "@/content/blog-posts";

export type { BlogPost, BlogFaqItem } from "@/content/blog-posts";

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  body_markdown: string;
  author: string;
  published_at: string;
  hero_image_url: string | null;
};

function rowToPost(row: BlogPostRow): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    excerpt: row.excerpt,
    date: row.published_at.slice(0, 10),
    author: row.author,
    bodyMarkdown: row.body_markdown,
    heroImageUrl: row.hero_image_url,
  };
}

function mergeStaticExtras(post: BlogPost): BlogPost {
  const s = STATIC_BLOG_POSTS.find((p) => p.slug === post.slug);
  if (!s) return post;
  return {
    ...post,
    metaDescription: s.metaDescription ?? post.metaDescription,
    faqItems: s.faqItems ?? post.faqItems,
    sortOrder: s.sortOrder ?? post.sortOrder,
  };
}

function sortBlogPosts(posts: BlogPost[]): BlogPost[] {
  return [...posts].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return (b.sortOrder ?? 0) - (a.sortOrder ?? 0);
  });
}

/**
 * Inserts bundled `STATIC_BLOG_POSTS` rows when that slug is missing.
 * Safe to call on every request: skips slugs that already exist (won't overwrite edits).
 */
export async function ensureBundledBlogPostsInDb(): Promise<void> {
  const supabase = getSupabaseServiceRole();
  if (!supabase) return;

  for (const p of STATIC_BLOG_POSTS) {
    const { data: existing, error: selErr } = await supabase
      .from("blog_posts")
      .select("id")
      .eq("slug", p.slug)
      .maybeSingle();

    if (selErr) {
      console.error("[blog-data] ensure select:", selErr.message);
      continue;
    }
    if (existing) continue;

    const { error } = await supabase.from("blog_posts").insert({
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle ?? null,
      excerpt: p.excerpt,
      body_markdown: p.bodyMarkdown,
      author: p.author,
      published_at: p.date,
      hero_image_url: p.heroImageUrl ?? null,
    });
    if (error) {
      console.error("[blog-data] ensure insert:", p.slug, error.message);
    }
  }
}

/** Public/blog pages: load from DB when configured, else static file. */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    return sortBlogPosts([...STATIC_BLOG_POSTS]);
  }

  await ensureBundledBlogPostsInDb();

  const { data, error } = await supabase
    .from("blog_posts")
    .select(
      "id, slug, title, subtitle, excerpt, body_markdown, author, published_at, hero_image_url"
    )
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[blog-data] getAllBlogPosts:", error.message);
    return sortBlogPosts([...STATIC_BLOG_POSTS]);
  }

  if (!data?.length) {
    return sortBlogPosts([...STATIC_BLOG_POSTS]);
  }

  return sortBlogPosts(
    (data as BlogPostRow[]).map(rowToPost).map(mergeStaticExtras)
  );
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const supabase = getSupabaseServiceRole();
  if (!supabase) {
    const p = STATIC_BLOG_POSTS.find((x) => x.slug === slug);
    return p ? mergeStaticExtras(p) : undefined;
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
    console.error("[blog-data] getBlogPostBySlug:", error.message);
    const p = STATIC_BLOG_POSTS.find((x) => x.slug === slug);
    return p ? mergeStaticExtras(p) : undefined;
  }

  if (!data) {
    const p = STATIC_BLOG_POSTS.find((x) => x.slug === slug);
    return p ? mergeStaticExtras(p) : undefined;
  }

  return mergeStaticExtras(rowToPost(data as BlogPostRow));
}

export async function getAllBlogSlugs(): Promise<string[]> {
  const posts = await getAllBlogPosts();
  return posts.map((p) => p.slug);
}
