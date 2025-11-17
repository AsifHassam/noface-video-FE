"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-8 lg:px-8">
      <Sidebar />
      <div className="flex flex-1 flex-col gap-6">
        <Topbar />
        <main className="flex-1 rounded-3xl border border-border/60 bg-white/80 p-6 shadow-lg shadow-primary/5 backdrop-blur-xl">
          {children}
        </main>
      </div>
    </div>
  );
};
