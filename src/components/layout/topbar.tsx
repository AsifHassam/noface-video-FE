"use client";

import { useRouter } from "next/navigation";
import { Menu, LogOut, Coins, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/lib/stores/auth-store";
import { subscriptionApi } from "@/lib/api/subscription";
import { useEffect, useState, useCallback } from "react";

export const Topbar = () => {
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuthStore();
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);

  const initials = user?.email
    ? user.email
        .split("@")[0]
        .slice(0, 2)
        .toUpperCase()
    : "NV";

  const loadCredits = useCallback(async () => {
    if (!user?.id || authLoading) {
      setLoadingCredits(false);
      return;
    }

    try {
      setLoadingCredits(true);
      const result = await subscriptionApi.getSubscriptionInfo();
      setCredits(result.subscription.credits || 0);
    } catch (error) {
      console.error("Error loading credits:", error);
      setCredits(null);
    } finally {
      setLoadingCredits(false);
    }
  }, [user?.id, authLoading]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  // Refresh credits periodically (every 30 seconds)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      loadCredits();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [user?.id, loadCredits]);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <header className="flex items-center justify-between rounded-3xl border border-border/60 bg-white/80 px-4 py-3 text-sm shadow-lg shadow-primary/5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-none bg-background/95">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <div className="hidden flex-col text-xs uppercase tracking-wide text-muted-foreground lg:flex">
          <span className="font-semibold text-primary">noface.video</span>
          My Workspace
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Credits Balance */}
        {user?.id && (
          <div className="hidden items-center gap-2 sm:flex">
            {loadingCredits ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : credits !== null ? (
              <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1.5">
                <Coins className="h-3.5 w-3.5" />
                <span className="font-medium">{credits.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground">credits</span>
              </Badge>
            ) : null}
          </div>
        )}
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium text-foreground sm:inline">
              {user?.email ?? "Guest"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-xl text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
