"use client";

type ProgressEvent = { name: string; created: number; updated: number; errors: number };

export function MigrationProgressBar({
  phase,
  progressPct,
  progressTables,
  progressTotal,
}: {
  phase: "idle" | "schema_push" | "inserting";
  progressPct: number;
  progressTables: ProgressEvent[];
  progressTotal: number;
}) {
  if (phase === "idle") return null;

  const successCount  = progressTables.reduce((s, t) => s + t.created + t.updated, 0);
  const rejectedCount = progressTables.reduce((s, t) => s + t.errors, 0);

  return (
    <div className="fixed left-0 right-0 top-0 z-60">
      {/* Bar — 4× taller than the original h-1 */}
      <div className="h-4 bg-muted">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Status row */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-5 py-2 shadow-sm">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
        <p className="text-xs font-semibold text-foreground">
          {phase === "schema_push"
            ? "Applying schema…"
            : `Inserting records — ${progressTables.length} / ${progressTotal} tables`}
        </p>
        {phase === "inserting" && progressTables.length > 0 && (
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            {progressTables[progressTables.length - 1]!.name}
          </span>
        )}
      </div>

      {/* Row counts — only shown once inserting has started */}
      {phase === "inserting" && progressTables.length > 0 && (
        <div className="flex items-center gap-6 border-b border-border bg-card px-5 py-1.5">
          <span className="text-sm font-medium text-emerald-300">
            Successfully Migrated: <span className="font-bold tabular-nums">{successCount.toLocaleString()}</span>
          </span>
          <span className={rejectedCount > 0 ? "text-sm font-medium text-rose-300" : "text-sm font-medium text-muted-foreground"}>
            Rejected: <span className="font-bold tabular-nums">{rejectedCount.toLocaleString()}</span>
          </span>
        </div>
      )}
    </div>
  );
}
