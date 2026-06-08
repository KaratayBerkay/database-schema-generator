"use client";

export function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex flex-col items-center rounded-md border border-border bg-background px-3 py-1.5 text-center">
      <span className="text-base font-bold text-foreground">{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    </span>
  );
}
