"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={0}>
      {children}
      <Toaster
        toastOptions={{
          style: {
            borderRadius: "18px",
          },
        }}
        position="top-right"
        richColors
      />
    </TooltipProvider>
  );
};
