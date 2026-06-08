"use client";

import { classNames } from "@/lib/utils";
import type { MigrateResult } from "@/types/sql-query";
import { useEscapeKey } from "@/hooks/use-escape-key";

type MigrationModalProps = {
  isOpen: boolean;
  migrating: boolean;
  migrateResult: MigrateResult | null;
  deletingSchema: boolean;
  onDeleteSchema: () => void;
  onClose: () => void;
};

export function MigrationModal({
  isOpen, migrating, migrateResult, deletingSchema, onDeleteSchema, onClose,
}: MigrationModalProps) {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="flex max-h-[85vh] w-[96vw] max-w-3xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Database Migration</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">
              {migrating
                ? "Validating and pushing schema…"
                : migrateResult?.success
                  ? "Migration succeeded"
                  : migrateResult?.stage === "validate"
                    ? "Schema validation failed"
                    : "Push failed"}
            </h3>
            {!migrating && migrateResult?.relPath && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">{migrateResult.relPath}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!migrating && migrateResult?.stage === "validate" && migrateResult.schemaRelPath && (
              <button
                type="button"
                onClick={onDeleteSchema}
                disabled={deletingSchema}
                className="h-9 rounded-md border border-rose-500/40 bg-card px-3 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingSchema ? "Deleting…" : "Delete Schema"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={migrating}
              className="h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {migrating ? (
            <div className="rounded-lg border border-border bg-background p-8 text-center text-sm font-semibold text-muted-foreground">
              Running prisma validate then prisma db push…
            </div>
          ) : migrateResult ? (
            <>
              <div className={classNames(
                "rounded-md border px-4 py-3",
                migrateResult.success ? "border-emerald-500/30 bg-emerald-500/15"
                : migrateResult.stage === "validate" ? "border-amber-500/30 bg-amber-500/15"
                : "border-rose-500/30 bg-rose-500/15",
              )}>
                <p className={classNames(
                  "text-sm font-semibold",
                  migrateResult.success ? "text-emerald-300"
                  : migrateResult.stage === "validate" ? "text-amber-300"
                  : "text-rose-300",
                )}>
                  {migrateResult.success
                    ? "SQLite database created and schema pushed."
                    : migrateResult.stage === "validate"
                      ? "The SQLite schema has validation errors. Fix the issues in your project schema (Relations page) then try again."
                      : "Schema is valid but the push failed — see output below."}
                </p>
                {migrateResult.success && migrateResult.schemaRelPath && (
                  <p className="mt-1 font-mono text-xs text-emerald-300">Schema written to {migrateResult.schemaRelPath}</p>
                )}
                {!migrateResult.success && migrateResult.schemaRelPath && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">Generated schema: {migrateResult.schemaRelPath}</p>
                )}
                {migrateResult.backupRelPath && (
                  <p className="mt-1 font-mono text-xs text-amber-300">Backup saved to {migrateResult.backupRelPath}</p>
                )}
              </div>
              {(migrateResult.steps ?? []).map((step) => (
                <div key={step.name} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={classNames("inline-flex h-2 w-2 rounded-full", step.success ? "bg-emerald-500" : "bg-rose-500")} />
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {step.name === "validate" ? "prisma validate" : "prisma db push"}
                    </p>
                    <span className={classNames("rounded px-1.5 py-0.5 text-[11px] font-bold", step.success ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
                      {step.success ? "passed" : "failed"}
                    </span>
                  </div>
                  {step.output && (
                    <pre className="overflow-x-auto rounded-md border border-border bg-slate-950 px-4 py-3 font-mono text-xs leading-6 text-slate-200 whitespace-pre-wrap">
                      {step.output}
                    </pre>
                  )}
                </div>
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
