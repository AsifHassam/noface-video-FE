"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  CreditCard,
  Settings2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  tooltip?: string;
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
    label: "Pricing",
    href: "/app/pricing",
    icon: CreditCard,
    disabled: true,
    tooltip: "Coming soon",
  },
  {
    label: "Settings",
    href: "/app/settings",
    icon: Settings2,
    disabled: true,
    tooltip: "Coming soon",
  },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden h-full w-64 flex-col rounded-3xl border border-border/60 bg-white/70 p-6 shadow-xl shadow-primary/5 backdrop-blur-xl lg:flex">
      <div className="mb-12 flex items-center gap-3 text-lg font-semibold text-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          NV
        </span>
        noface.video
      </div>
      <nav className="flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const content = (
            <span
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
            </span>
          );

          if (item.disabled) {
            return (
              <Tooltip key={item.label} delayDuration={150}>
                <TooltipTrigger asChild>
                  <div role="link" aria-disabled className="w-full">
                    {content}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{item.tooltip}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link key={item.label} href={item.href} className="w-full">
              {content}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
