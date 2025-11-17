"use client";

import type { RenderStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<RenderStatus | 'DRAFT', { className: string; icon?: React.ReactNode }> = {
  DRAFT: {
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  QUEUED: {
    className: "bg-secondary text-muted-foreground",
  },
  RENDERING: {
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    icon: <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />,
  },
  READY: {
    className: "bg-emerald-500 text-emerald-50",
  },
  FAILED: {
    className: "bg-destructive text-destructive-foreground",
  },
};

export const StatusBadge = ({ status }: { status: RenderStatus | string }) => {
  const style = STATUS_STYLES[status as RenderStatus] || {
    className: "bg-secondary text-muted-foreground",
  };
  return (
    <Badge
      className={cn(
        "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.className,
      )}
    >
      {style.icon}
      {status}
    </Badge>
  );
};
