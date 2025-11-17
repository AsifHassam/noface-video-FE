"use client";

import { useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

export const Topbar = () => {
  const router = useRouter();
  const { user, signOut } = useAuthStore();

  const initials = user?.email
    ? user.email
        .split("@")[0]
        .slice(0, 2)
        .toUpperCase()
    : "NV";

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
    </header>
  );
};
