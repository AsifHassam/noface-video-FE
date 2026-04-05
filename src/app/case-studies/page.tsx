import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Case studies | noface.video",
  description:
    "Real creator and brand results with noface.video — faceless videos for TikTok, Shorts, and Instagram.",
};

/** Placeholder route so /case-studies is crawlable; stories are on the homepage. */
export default function CaseStudiesPlaceholderPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/70 to-muted" />
      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Case studies</h1>
        <p className="text-muted-foreground">
          Featured stories and metrics live on the homepage for now. This page will
          host longer-form case studies soon.
        </p>
        <Link
          href="/#case-studies"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View case studies on the home page
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
