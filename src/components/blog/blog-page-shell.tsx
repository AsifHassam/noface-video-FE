import Link from "next/link";
import type { ReactNode } from "react";

/** Shared background and top bar for blog routes — matches landing visual language. */
export function BlogPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/70 to-muted" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.08),_transparent_50%)]" />
      <header className="relative z-10 mx-auto max-w-7xl px-3 sm:px-6 pt-3 sm:pt-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg sm:text-2xl font-bold text-foreground">
            noface.video
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-4 sm:gap-6 text-sm font-medium">
            <Link
              href="/#case-studies"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Case studies
            </Link>
            <Link href="/blog" className="text-foreground">
              Blog
            </Link>
            <Link
              href="/#pricing"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/privacy"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
