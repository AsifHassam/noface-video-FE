import type { ImageOverlay } from "@/types";

/** Horizontal offset (px) for slide-in; 0 when disabled or after animation. */
export function getImageOverlaySlideOffsetPx(
  overlay: ImageOverlay,
  currentMs: number,
  containerWidthPx: number
): number {
  const dir = overlay.slideInFrom;
  if (dir !== "left" && dir !== "right") return 0;
  const durationMs = Math.max(80, overlay.slideInDurationMs ?? 400);
  const elapsed = currentMs - overlay.startMs;
  const t = Math.min(1, Math.max(0, elapsed / durationMs));
  const from = dir === "left" ? -containerWidthPx * 0.38 : containerWidthPx * 0.38;
  const eased = 1 - (1 - t) ** 3; // ease-out cubic (match Remotion)
  return from * (1 - eased);
}
