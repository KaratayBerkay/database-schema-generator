"use client";

import { classNames } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  success: "bg-emerald-500/20 text-emerald-300",
  partial: "bg-amber-500/20 text-amber-300",
};

/** A single status pill for one migration run (success / partial / anything-else = failed). */
export function MigrationStatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-rose-500/20 text-rose-300";
  return (
    <span className={classNames("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", style)}>
      {status}
    </span>
  );
}

/** Compact ✓/⚠/✗ rollup for a version's runs. Renders nothing when there are no runs. */
export function StatusRollup({ success, partial, failed }: { success: number; partial: number; failed: number }) {
  if (success === 0 && partial === 0 && failed === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {success > 0 && (
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          ✓ {success}
        </span>
      )}
      {partial > 0 && (
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          ⚠ {partial}
        </span>
      )}
      {failed > 0 && (
        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
          ✗ {failed}
        </span>
      )}
    </span>
  );
}
