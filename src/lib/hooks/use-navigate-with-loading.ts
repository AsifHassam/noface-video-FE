"use client";

import { useRouter } from "next/navigation";
import { useNavigationStore } from "@/lib/stores/navigation-store";

/**
 * Returns a navigate function that shows the global navigation progress bar
 * when navigating. Use instead of router.push for smoother perceived transitions.
 */
export function useNavigateWithLoading() {
  const router = useRouter();
  const setNavigating = useNavigationStore((s) => s.setNavigating);

  return (href: string) => {
    setNavigating(true);
    router.push(href);
  };
}
