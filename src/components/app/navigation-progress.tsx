"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useNavigationStore } from "@/lib/stores/navigation-store";
import { cn } from "@/lib/utils";

/**
 * Thin progress bar at the top of the viewport when a route transition is in progress.
 * Clear navigating state when pathname changes.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const isNavigating = useNavigationStore((s) => s.isNavigating);
  const setNavigating = useNavigationStore((s) => s.setNavigating);

  useEffect(() => {
    setNavigating(false);
  }, [pathname, setNavigating]);

  return (
    <div
      role="progressbar"
      aria-hidden={!isNavigating}
      className={cn(
        "fixed left-0 top-0 z-[100] h-0.5 bg-primary transition-[width,opacity] duration-200 ease-out",
        isNavigating ? "w-full opacity-100 animate-pulse" : "w-0 opacity-0"
      )}
    />
  );
}
