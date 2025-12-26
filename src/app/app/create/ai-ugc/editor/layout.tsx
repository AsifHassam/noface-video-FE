"use client";

import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Settings2,
  Clock,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";

const ADMIN_EMAIL = "asifhassam14@gmail.com";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Create",
    href: "/app/create",
    icon: Sparkles,
  },
  {
    label: "Render Queue",
    href: "/app/render-queue",
    icon: Clock,
  },
  {
    label: "Admin",
    href: "/app/admin",
    icon: Shield,
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: Settings2,
    disabled: true,
  },
];

export default function EditorLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const visibleNavItems = NAV_ITEMS.filter(item => {
    if (item.label === "Admin" && !isAdmin) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    // Remove all margins and padding from body/html for full screen
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";
    document.documentElement.style.overflow = "hidden";
    
    return () => {
      // Cleanup
      document.body.style.margin = "";
      document.body.style.padding = "";
      document.documentElement.style.margin = "";
      document.documentElement.style.padding = "";
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 flex h-screen w-screen flex-col overflow-hidden bg-white" style={{ left: 0, right: 0, top: 0, bottom: 0, margin: 0, padding: 0, width: '100vw', height: '100vh' }}>
      {/* Top Header with Hamburger */}
      <div className="flex h-14 flex-shrink-0 items-center justify-between border-b bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex h-full flex-col p-6">
                <div className="mb-8 flex items-center gap-3 text-lg font-semibold text-foreground">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    NV
                  </span>
                  noface.video
                </div>
                <nav className="flex flex-1 flex-col gap-2">
                  {visibleNavItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const content = (
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
                          item.disabled
                            ? "cursor-not-allowed text-muted-foreground"
                            : "hover:bg-primary/10 hover:text-primary",
                          isActive && !item.disabled && "bg-primary/10 text-primary shadow-sm",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                    return <div key={item.label}>{content}</div>;
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          
          {/* Desktop: Hamburger menu */}
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="hidden lg:flex"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="flex h-full flex-col p-6">
                <div className="mb-8 flex items-center gap-3 text-lg font-semibold text-foreground">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    NV
                  </span>
                  noface.video
                </div>
                <nav className="flex flex-1 flex-col gap-2">
                  {visibleNavItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    const content = (
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
                          item.disabled
                            ? "cursor-not-allowed text-muted-foreground"
                            : "hover:bg-primary/10 hover:text-primary",
                          isActive && !item.disabled && "bg-primary/10 text-primary shadow-sm",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                    return <div key={item.label}>{content}</div>;
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
              NV
            </span>
            <span className="text-sm font-semibold">noface.video</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold">NOFACE.VIDEO</div>
            <div className="text-xs text-muted-foreground">MY WORKSPACE</div>
          </div>
          {user?.email && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {user.email}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Editor Content - Full Screen */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

