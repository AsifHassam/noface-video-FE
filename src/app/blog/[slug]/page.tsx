import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";
import { BlogMarkdown } from "@/components/blog/blog-markdown";
import { BlogPageShell } from "@/components/blog/blog-page-shell";
import { Button } from "@/components/ui/button";
import {
  getAllBlogSlugs,
  getBlogPostBySlug,
  type BlogPost,
} from "@/lib/blog-data";

const SITE = "https://noface.video";

export const revalidate = 120;

type PageProps = {
  params: Promise<{ slug: string }>;
};

function metaDescription(post: BlogPost) {
  return post.metaDescription ?? post.excerpt;
}

function buildArticleJsonLd(post: BlogPost, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: metaDescription(post),
    datePublished: `${post.date}T12:00:00.000Z`,
    author: {
      "@type": "Person",
      name: post.author,
    },
    publisher: {
      "@type": "Organization",
      name: "noface.video",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };
}

function buildFaqJsonLd(items: NonNullable<BlogPost["faqItems"]>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) {
    return { title: "Post not found | noface.video" };
  }
  const url = `${SITE}/blog/${post.slug}`;
  const desc = metaDescription(post);
  const ogImages = post.heroImageUrl
    ? [
        {
          url: post.heroImageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ]
    : [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ];
  return {
    title: `${post.title} | noface.video`,
    description: desc,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: desc,
      siteName: "noface.video",
      publishedTime: `${post.date}T12:00:00.000Z`,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: desc,
      images: ogImages.map((i) => i.url),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) {
    notFound();
  }

  const url = `${SITE}/blog/${post.slug}`;
  const articleLd = buildArticleJsonLd(post, url);
  const faqLd =
    post.faqItems && post.faqItems.length > 0
      ? buildFaqJsonLd(post.faqItems)
      : null;

  return (
    <BlogPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      {faqLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      ) : null}
      <main className="relative z-10 mx-auto max-w-3xl px-3 pb-20 pt-6 sm:px-6 sm:pt-10">
        <nav className="mb-8 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <Link href="/blog" className="hover:text-foreground">
            Blog
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span className="text-foreground">Article</span>
        </nav>

        <article>
          <header className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              {format(parseISO(post.date), "MMMM d, yyyy")} · {post.author}
            </p>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {post.title}
            </h1>
            {post.subtitle ? (
              <p className="mt-3 text-lg text-muted-foreground sm:text-xl">
                {post.subtitle}
              </p>
            ) : null}
          </header>

          <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-purple-500/15 to-pink-500/15 shadow-inner">
            {post.heroImageUrl ? (
              <Image
                src={post.heroImageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
                <span className="text-sm font-medium text-muted-foreground">
                  Article image
                </span>
              </div>
            )}
          </div>

          <div className="mt-10 max-w-none">
            <BlogMarkdown content={post.bodyMarkdown} />
          </div>

          <section
            className="mt-14 rounded-2xl border border-border/60 bg-white/60 p-6 text-center shadow-sm backdrop-blur-sm sm:p-8"
            aria-labelledby="post-cta-heading"
          >
            <h2
              id="post-cta-heading"
              className="text-lg font-semibold text-foreground sm:text-xl"
            >
              Ready to go faceless? Start free at noface.video
            </h2>
            <Button className="mt-5 rounded-full" size="lg" asChild>
              <Link href="/app">
                Start free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </section>
        </article>
      </main>
    </BlogPageShell>
  );
}
