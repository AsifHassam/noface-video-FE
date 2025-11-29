"use client";

import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/stores/auth-store";

export const Providers = ({ children }: { children: React.ReactNode }) => {
  const initialize = useAuthStore((state) => state.initialize);

  // Initialize auth on app load to ensure persistence across all pages
  useEffect(() => {
    initialize();
  }, [initialize]);

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
