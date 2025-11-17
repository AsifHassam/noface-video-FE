"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StepperStep = {
  label: string;
  description: string;
};

type StepperProps = {
  steps: StepperStep[];
  activeIndex: number;
};

export const Stepper = ({ steps, activeIndex }: StepperProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-3xl border border-border/60 bg-white/70 p-6 shadow-inner shadow-primary/5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const isCompleted = index < activeIndex;
        return (
          <div
            key={step.label}
            className={cn(
              "flex items-center gap-3 text-left transition sm:gap-4",
              isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-md"
                  : isCompleted
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-white",
              )}
            >
              {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium sm:text-base">{step.label}</span>
              <span className="text-xs text-muted-foreground">{step.description}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
