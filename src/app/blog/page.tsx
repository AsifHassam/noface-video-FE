import type { Metadata } from "next";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BlogPageShell } from "@/components/blog/blog-page-shell";
import { getAllBlogPosts } from "@/lib/blog-data";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Blog | noface.video",
  description:
    "Tips, case studies, and playbooks for faceless video creators — TikTok, Reels, and Shorts.",
  alternates: {
    canonical: "https://noface.video/blog",
  },
  openGraph: {
    type: "website",
    url: "https://noface.video/blog",
    title: "Blog | noface.video",
    description:
      "Tips, case studies, and playbooks for faceless video creators — TikTok, Reels, and Shorts.",
    siteName: "noface.video",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | noface.video",
    description:
      "Tips, case studies, and playbooks for faceless video creators — TikTok, Reels, and Shorts.",
  },
};

export default async function BlogIndexPage() {
  const posts = await getAllBlogPosts();

  return (
    <BlogPageShell>
      <main className="relative z-10 mx-auto max-w-5xl px-3 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground sm:text-4xl lg:text-5xl">
            Blog
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-lg">
            Learn from faceless creators, growth tactics, and how to ship more
            videos with less friction.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6">
          {posts.map((post) => (
            <Card
              key={post.slug}
              className="border-2 border-border/60 bg-white/70 shadow-lg backdrop-blur-sm transition hover:shadow-xl"
            >
              <CardContent className="p-5 sm:p-6">
                <p className="text-xs text-muted-foreground sm:text-sm">
                  {format(parseISO(post.date), "MMMM d, yyyy")}
                </p>
                <h2 className="mt-2 text-lg font-bold leading-snug text-foreground sm:text-xl">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{post.subtitle}</p>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {post.excerpt}
                </p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/90"
                >
                  Read more
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </BlogPageShell>
  );
}
