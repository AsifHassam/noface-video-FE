import { getAuthToken } from "@/lib/api/projects";

async function authBearerJson(): Promise<HeadersInit> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Sign in required");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function authBearerOnly(): Promise<HeadersInit> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Sign in required");
  }
  return { Authorization: `Bearer ${token}` };
}

export type AdminBlogPostRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  body_markdown: string;
  author: string;
  published_at: string;
  hero_image_url: string | null;
  updated_at?: string;
};

export async function adminBlogListPosts(): Promise<{
  success: boolean;
  posts?: AdminBlogPostRow[];
  error?: string;
}> {
  const res = await fetch("/api/admin/blog/posts", {
    headers: await authBearerOnly(),
  });
  return res.json() as Promise<{
    success: boolean;
    posts?: AdminBlogPostRow[];
    error?: string;
  }>;
}

export async function adminBlogGetPost(slug: string): Promise<{
  success: boolean;
  post?: AdminBlogPostRow | null;
  error?: string;
}> {
  const res = await fetch(
    `/api/admin/blog/posts/${encodeURIComponent(slug)}`,
    { headers: await authBearerOnly() }
  );
  return res.json() as Promise<{
    success: boolean;
    post?: AdminBlogPostRow | null;
    error?: string;
  }>;
}

export async function adminBlogCreatePost(body: {
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  body_markdown: string;
  author: string;
  published_at: string;
  hero_image_url?: string | null;
}): Promise<{ success: boolean; post?: AdminBlogPostRow; error?: string }> {
  const res = await fetch("/api/admin/blog/posts", {
    method: "POST",
    headers: await authBearerJson(),
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function adminBlogUpdatePost(
  slug: string,
  body: {
    title: string;
    subtitle?: string | null;
    excerpt: string;
    body_markdown: string;
    author: string;
    published_at: string;
    hero_image_url?: string | null;
    new_slug?: string;
  }
): Promise<{ success: boolean; post?: AdminBlogPostRow; error?: string }> {
  const res = await fetch(
    `/api/admin/blog/posts/${encodeURIComponent(slug)}`,
    {
      method: "PUT",
      headers: await authBearerJson(),
      body: JSON.stringify(body),
    }
  );
  return res.json();
}

export async function adminBlogDeletePost(
  slug: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(
    `/api/admin/blog/posts/${encodeURIComponent(slug)}`,
    {
      method: "DELETE",
      headers: await authBearerOnly(),
    }
  );
  return res.json();
}

export async function adminBlogUploadImage(
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Sign in required");
  }
  const fd = new FormData();
  fd.set("file", file);
  const res = await fetch("/api/admin/blog/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  return res.json();
}
