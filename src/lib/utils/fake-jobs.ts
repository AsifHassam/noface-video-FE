import type { RenderStatus } from "@/types";

type StatusCallback = (status: RenderStatus) => void;

export const simulatePreviewJob = (
  onStatusChange: StatusCallback,
  onReady: () => void,
) => {
  const phases: { status: RenderStatus; delay: number }[] = [
    { status: "QUEUED", delay: 0 },
    { status: "RENDERING", delay: 800 },
    { status: "READY", delay: 2000 },
  ];

  const timers = phases.map(({ status, delay }) =>
    window.setTimeout(() => {
      onStatusChange(status);
      if (status === "READY") {
        onReady();
      }
    }, delay),
  );

  return () => timers.forEach((timer) => window.clearTimeout(timer));
};

export const simulateFinalRenderJob = (
  onStatusChange: StatusCallback,
  onComplete: () => void,
) => {
  onStatusChange("RENDERING");
  const timer = window.setTimeout(() => {
    onStatusChange("READY");
    onComplete();
  }, 1500);

  return () => window.clearTimeout(timer);
};
