"use client";

import { cn } from "@/lib/utils";
import type { PhaseState } from "@/types/migrations";

const stateMap: Record<PhaseState, { label: string; cls: string }> = {
  idle:    { label: "Pending",   cls: "bg-muted text-muted-foreground"    },
  loading: { label: "Running…",  cls: "bg-amber-500/20 text-amber-300"    },
  success: { label: "Done",      cls: "bg-emerald-500/20 text-emerald-300" },
  error:   { label: "Failed",    cls: "bg-rose-500/20 text-rose-300"      },
};

export function StateChip({ state }: { state: PhaseState }) {
  const { label, cls } = stateMap[state];
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", cls)}>
      {label}
    </span>
  );
}

export function StepBadge({ n, state }: { n: number; state: PhaseState }) {
  const base = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold";
  if (state === "success") return <span className={cn(base, "bg-emerald-500 text-white")}>✓</span>;
  if (state === "error")   return <span className={cn(base, "bg-rose-500 text-white")}>✗</span>;
  if (state === "loading") return <span className={cn(base, "bg-amber-400 text-white")}>{n}</span>;
  return <span className={cn(base, "bg-muted text-muted-foreground")}>{n}</span>;
}
