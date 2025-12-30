"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type CreateCharacterCardProps = {
  onClick: () => void;
};

export const CreateCharacterCard = ({ onClick }: CreateCharacterCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={onClick}
      role="button"
      aria-label="Create custom character"
      className={cn(
        "flex w-full flex-col gap-4 rounded-3xl border-2 border-dashed border-border/60 bg-muted/20 p-5 text-left transition cursor-pointer hover:border-primary/60 hover:bg-primary/5"
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="h-8 w-8 text-primary" />
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-foreground">
            Create Custom
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Add your own character
        </p>
      </div>
    </motion.div>
  );
};

