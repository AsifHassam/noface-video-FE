import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | noface.video",
  description:
    "Plans and pricing for noface.video — start free and scale with Pro or Premium when you are ready.",
};

/** Placeholder route so /pricing is crawlable; full pricing lives on the homepage. */
export default function PricingPlaceholderPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/70 to-muted" />
      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center justify-center gap-6 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-foreground">Pricing</h1>
        <p className="text-muted-foreground">
          Full plan details and comparison are on the homepage. We&apos;ll expand this
          page as we add more resources.
        </p>
        <Link
          href="/#pricing"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          View pricing on the home page
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
