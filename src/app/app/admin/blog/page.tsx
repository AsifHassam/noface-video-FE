"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  adminBlogListPosts,
  adminBlogGetPost,
  adminBlogCreatePost,
  adminBlogUpdatePost,
  adminBlogDeletePost,
  adminBlogUploadImage,
  type AdminBlogPostRow,
} from "@/lib/api/blog-admin";

const ADMIN_EMAIL = "asifhassam14@gmail.com";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyForm() {
  return {
    slug: "",
    title: "",
    subtitle: "",
    excerpt: "",
    body_markdown: "",
    author: "noface.video team",
    published_at: new Date().toISOString().slice(0, 10),
    hero_image_url: "",
  };
}

export default function AdminBlogEditorPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [listLoading, setListLoading] = useState(true);
  const [posts, setPosts] = useState<AdminBlogPostRow[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);

  const heroInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setConfigError(null);
    try {
      const res = await adminBlogListPosts();
      if (!res.success) {
        setConfigError(res.error || "Failed to load posts");
        setPosts([]);
        return;
      }
      setPosts(res.posts ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
      setPosts([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadList();
  }, [isAdmin, loadList]);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Access denied");
      router.push("/app/dashboard");
    }
  }, [isAdmin, router]);

  const openPost = async (slug: string) => {
    setIsCreating(false);
    setOriginalSlug(slug);
    try {
      const res = await adminBlogGetPost(slug);
      if (!res.success || !res.post) {
        toast.error(res.error || "Post not found");
        return;
      }
      const p = res.post;
      setForm({
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle ?? "",
        excerpt: p.excerpt,
        body_markdown: p.body_markdown,
        author: p.author,
        published_at: p.published_at?.slice(0, 10) ?? "",
        hero_image_url: p.hero_image_url ?? "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    }
  };

  const startNew = () => {
    setIsCreating(true);
    setOriginalSlug(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    const sl = slugify(form.slug || form.title);
    if (!sl) {
      toast.error("Add a title or slug");
      return;
    }
    if (!form.title.trim() || !form.excerpt.trim()) {
      toast.error("Title and excerpt are required");
      return;
    }

    setSaving(true);
    try {
      if (isCreating || !originalSlug) {
        const res = await adminBlogCreatePost({
          slug: sl,
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          excerpt: form.excerpt.trim(),
          body_markdown: form.body_markdown,
          author: form.author.trim() || "noface.video team",
          published_at: form.published_at,
          hero_image_url: form.hero_image_url.trim() || null,
        });
        if (!res.success) {
          toast.error(res.error || "Save failed");
          return;
        }
        toast.success("Post created");
        setIsCreating(false);
        setOriginalSlug(sl);
        setForm((f) => ({ ...f, slug: sl }));
        await loadList();
      } else {
        const newSlug = slugify(form.slug);
        const res = await adminBlogUpdatePost(originalSlug, {
          title: form.title.trim(),
          subtitle: form.subtitle.trim() || null,
          excerpt: form.excerpt.trim(),
          body_markdown: form.body_markdown,
          author: form.author.trim() || "noface.video team",
          published_at: form.published_at,
          hero_image_url: form.hero_image_url.trim() || null,
          ...(newSlug !== originalSlug ? { new_slug: newSlug } : {}),
        });
        if (!res.success) {
          toast.error(res.error || "Save failed");
          return;
        }
        toast.success("Post saved");
        if (newSlug !== originalSlug) {
          setOriginalSlug(newSlug);
          setForm((f) => ({ ...f, slug: newSlug }));
        }
        await loadList();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!originalSlug || isCreating) return;
    if (!confirm(`Delete post "${originalSlug}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await adminBlogDeletePost(originalSlug);
      if (!res.success) {
        toast.error(res.error || "Delete failed");
        return;
      }
      toast.success("Deleted");
      startNew();
      await loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const onHeroFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingHero(true);
    try {
      const res = await adminBlogUploadImage(file);
      if (!res.success || !res.url) {
        toast.error(res.error || "Upload failed");
        return;
      }
      setForm((f) => ({ ...f, hero_image_url: res.url! }));
      toast.success("Hero image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingHero(false);
    }
  };

  const onInlineFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingInline(true);
    try {
      const res = await adminBlogUploadImage(file);
      if (!res.success || !res.url) {
        toast.error(res.error || "Upload failed");
        return;
      }
      const alt = file.name.replace(/\.[^.]+$/, "") || "Image";
      const insert = `\n\n![${alt}](${res.url})\n\n`;
      setForm((f) => ({
        ...f,
        body_markdown: f.body_markdown + insert,
      }));
      toast.success("Image inserted at end of body (you can move the markdown)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingInline(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/app/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Admin home
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Blog editor</h1>
          <p className="text-sm text-muted-foreground">
            Edit markdown, hero image, and metadata. Requires{" "}
            <code className="rounded bg-muted px-1 text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
            on the server.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" asChild>
            <a href="/blog" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              View blog
            </a>
          </Button>
          <Button size="sm" className="rounded-xl" onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" />
            New post
          </Button>
        </div>
      </div>

      {configError ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-sm text-destructive">
            {configError}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <Card className="rounded-2xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Posts</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[480px] space-y-1 overflow-y-auto">
            {listLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No posts yet. Create one.</p>
            ) : (
              posts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openPost(p.slug)}
                  className={`w-full rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted ${
                    originalSlug === p.slug && !isCreating
                      ? "bg-muted font-medium"
                      : ""
                  }`}
                >
                  <div className="line-clamp-2 font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{p.slug}</div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">
              {isCreating ? "New post" : originalSlug ? `Edit: ${originalSlug}` : "Editor"}
            </CardTitle>
            <div className="flex gap-2">
              {!isCreating && originalSlug ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-xl"
                  disabled={saving}
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : null}
              <Button
                size="sm"
                className="rounded-xl"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  placeholder="my-post-url"
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-xs"
                  onClick={() =>
                    setForm((f) => ({ ...f, slug: slugify(f.title) }))
                  }
                >
                  Generate from title
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Published date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.published_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, published_at: e.target.value }))
                  }
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle (optional)</Label>
              <Input
                id="subtitle"
                value={form.subtitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subtitle: e.target.value }))
                }
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt / SEO description</Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
                rows={3}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={form.author}
                onChange={(e) =>
                  setForm((f) => ({ ...f, author: e.target.value }))
                }
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Hero image</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={form.hero_image_url}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hero_image_url: e.target.value }))
                  }
                  placeholder="https://..."
                  className="max-w-xl flex-1 rounded-xl"
                />
                <input
                  ref={heroInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={onHeroFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={uploadingHero}
                  onClick={() => heroInputRef.current?.click()}
                >
                  {uploadingHero ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" />
                  )}
                  Upload
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="body">Body (Markdown)</Label>
                <div>
                  <input
                    ref={inlineInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={onInlineFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-xs"
                    disabled={uploadingInline}
                    onClick={() => inlineInputRef.current?.click()}
                  >
                    {uploadingInline ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Insert image at end"
                    )}
                  </Button>
                </div>
              </div>
              <Textarea
                id="body"
                value={form.body_markdown}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body_markdown: e.target.value }))
                }
                rows={22}
                className="min-h-[320px] rounded-xl font-mono text-sm"
                spellCheck={false}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
