"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const EmptyState = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-primary/40 bg-white/70 p-12 text-center shadow-inner">
      <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </span>
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold text-foreground">
          No videos yet—let&apos;s create one
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          Craft a faceless conversation with two characters, add overlays, and simulate a final render.
        </p>
      </div>
      <Button asChild className="h-11 rounded-2xl px-6 text-base">
        <Link href="/app/create">Create new video</Link>
      </Button>
    </div>
  );
};
