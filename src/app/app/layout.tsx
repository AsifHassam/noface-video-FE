"use client";

import type { ReactNode } from "react";
import { AuthGate } from "@/components/app/auth-gate";
import { AppShell } from "@/components/app/app-shell";
import { usePathname } from "next/navigation";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Skip AppShell for editor route
  if (pathname?.includes("/app/create/ai-ugc/editor")) {
    return <AuthGate>{children}</AuthGate>;
  }

  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
