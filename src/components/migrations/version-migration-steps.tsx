"use client";

import { useState } from "react";
import Link from "next/link";
import { classNames } from "@/lib/utils";
import { Card, CardHeader, CardBody } from "@/components/built";
import { StateChip, StepBadge } from "@/components/migrations/phase-state";
import { ErrorBox } from "@/components/migrations/error-box";
import { IssueSection } from "@/components/migrations/issue-section";
import { shortUuid } from "@/constants/migrations";
import type {
  ConnectionRecord,
  MigrationOrderItem,
  PhaseState,
  RunResponse,
  ValidationIssue,
} from "@/types/migrations";
import type { SchemaWarning } from "@/lib/schema-warnings-store";

type CollectTable = { name: string; count: number };

type VersionMigrationStepsProps = {
  isVersionPlan: boolean;
  syncVersion: string;
  targetVersion: string;
  warnings: SchemaWarning[];
  breakingPendingCount: number;
  defaultsRequiredCount: number;
  trackingHref: string;
  onGoToTracking?: () => void;
  // Collect
  canCollect: boolean;
  collectState: PhaseState;
  collectError: string;
  collectTables: CollectTable[];
  collectTotal: number;
  collectTimestamp: string;
  migrationOrder: MigrationOrderItem[];
  restoreState: "idle" | "loading" | "success" | "error";
  restoreError: string;
  restoreTables: { name: string; created: number; updated: number; errors: number }[];
  collectBtnDisabled: boolean | undefined;
  onCollect: () => void;
  onRestore: () => void;
  // Validate & Migrate
  canMigrate: boolean;
  migrateState: PhaseState;
  migrateError: string;
  validateState: PhaseState;
  validateError: string;
  stage1Issues: ValidationIssue[];
  stage2Issues: ValidationIssue[];
  errorCount: number;
  migrateTables: RunResponse["tables"];
  migrateVersion: string;
  activeConnection: ConnectionRecord | null;
  validateBtnDisabled: boolean | undefined;
  migrateBtnDisabled: boolean | undefined;
  onValidate: () => void;
  onShowPreflight: () => void;
};

export function VersionMigrationSteps({
  isVersionPlan,
  syncVersion, targetVersion,
  warnings, breakingPendingCount, defaultsRequiredCount,
  trackingHref, onGoToTracking,
  canCollect, collectState, collectError, collectTables, collectTotal,
  collectTimestamp, migrationOrder, restoreState, restoreError, restoreTables,
  collectBtnDisabled, onCollect, onRestore,
  canMigrate, migrateState, migrateError, validateState, validateError,
  stage1Issues, stage2Issues, errorCount, migrateTables, migrateVersion,
  activeConnection, validateBtnDisabled, migrateBtnDisabled, onValidate, onShowPreflight,
}: VersionMigrationStepsProps) {
  if (!isVersionPlan) return null;

  const hasUnresolvedWarnings = breakingPendingCount > 0 || defaultsRequiredCount > 0;
  const unresolvedCount = breakingPendingCount + defaultsRequiredCount;

  return (
    <>
      {/* ── Tracking gate: block collect/run until all warnings resolved ── */}
      {hasUnresolvedWarnings ? (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-5 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7 text-amber-500">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {unresolvedCount} schema {unresolvedCount === 1 ? "change requires" : "changes require"} resolution before migrating
                </p>
                <p className="mt-1.5 max-w-md text-sm text-slate-500">
                  Breaking changes, type incompatibilities, or required defaults must be approved in the Tracking workflow before migration can proceed.
                </p>
              </div>
              <Link href={trackingHref} onClick={() => onGoToTracking?.()}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98]">
                Go to Tracking →
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : <>

      {/* Step 3: Collect Data */}
      <Card locked={!canCollect}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepBadge n={3} state={collectState} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Collect Data</p>
                <p className="text-xs text-slate-500">Query all tables from the source database and store a local snapshot.</p>
              </div>
            </div>
            <StateChip state={collectState} />
          </div>
        </CardHeader>
        <CardBody>
          {collectState === "success" && collectTables.length > 0 && (
            <CollectTableAccordion
              collectTables={collectTables}
              collectTotal={collectTotal}
              collectTimestamp={collectTimestamp}
              migrationOrder={migrationOrder}
            />
          )}
          {collectError && <ErrorBox message={collectError} />}
          <div className="flex items-center justify-between gap-3">
            {collectState === "success" && collectTimestamp && (
              <div className="flex flex-col gap-1">
                <button type="button" onClick={onRestore}
                  disabled={restoreState === "loading" || undefined}
                  className="h-8 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
                  {restoreState === "loading" ? "Restoring…" : restoreState === "success" ? "✓ Restored" : "Restore to Sync Version"}
                </button>
                {restoreState === "success" && restoreTables.length > 0 && (
                  <p className="text-[10px] font-semibold text-emerald-600">
                    ✓ {restoreTables.reduce((s, t) => s + t.created, 0).toLocaleString()} rows re-inserted
                  </p>
                )}
                {restoreState === "error" && restoreError && <p className="text-[10px] text-rose-600">{restoreError}</p>}
              </div>
            )}
            <button type="button" onClick={onCollect} disabled={collectBtnDisabled}
              className="ml-auto h-9 min-w-48 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              {collectState === "loading" ? "Collecting…" : "Collect All Tables"}
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Step 4: Validate & Migrate */}
      <Card locked={!canMigrate}>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StepBadge n={4} state={migrateState} />
              <div>
                <p className="text-sm font-semibold text-slate-950">Validate &amp; Migrate</p>
                <p className="text-xs text-slate-500">Check collected data against both schema versions, then run the migration.</p>
              </div>
            </div>
            <StateChip state={migrateState} />
          </div>
        </CardHeader>
        <CardBody>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Connection</p>
                <p className="mt-1 truncate text-sm font-semibold text-slate-950">{activeConnection?.name ?? "—"}</p>
                <p className="font-mono text-[10px] text-slate-400">{activeConnection ? shortUuid(activeConnection.uuid) : ""}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">From</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{syncVersion}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">To</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{targetVersion}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Snapshot</p>
                <p className="mt-1 font-mono text-xs text-slate-700">{collectTimestamp || "—"}</p>
              </div>
            </div>
          </div>

          {/* Step A — Validate */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">Step A — Validate Data</p>
                <p className="text-[11px] text-slate-500">Check collected rows against both schema versions.</p>
              </div>
              <div className="flex items-center gap-2">
                {validateState !== "idle" && <StateChip state={validateState} />}
                <button type="button" onClick={onValidate} disabled={validateBtnDisabled}
                  className="h-8 min-w-36 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {validateState === "loading" ? "Validating…" : "Validate Data"}
                </button>
              </div>
            </div>
            {validateState === "success" && stage1Issues.length === 0 && stage2Issues.length === 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5">
                <p className="text-sm font-semibold text-emerald-700">✓ All records pass both validation stages.</p>
              </div>
            )}
            {validateError && <ErrorBox message={validateError} />}
            {validateState === "success" && (
              <>
                <IssueSection title="Stage 1 — Shape vs Source Schema" issues={stage1Issues} />
                <IssueSection title="Stage 2 — Strategy vs Target Schema" issues={stage2Issues} />
              </>
            )}
          </div>

          {validateState === "success" && errorCount > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-rose-700">
                {errorCount} blocking error{errorCount !== 1 ? "s" : ""} must be resolved before migrating.
              </p>
            </div>
          )}

          {/* Step B — Migrate */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-800">Step B — Review &amp; Run</p>
                <p className="text-[11px] text-slate-500">Review the migration plan and begin. The target schema will be reset and all validated records re-inserted.</p>
              </div>
              <button type="button" onClick={onShowPreflight} disabled={migrateBtnDisabled}
                className="h-8 min-w-36 rounded-md bg-slate-800 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {migrateState === "loading" ? "Migrating…" : "Review & Run"}
              </button>
            </div>
            {migrateState === "success" && migrateTables && migrateTables.length > 0 && (
              <MigrateResultAccordion migrateTables={migrateTables} migrateVersion={migrateVersion} />
            )}
            {migrateError && <ErrorBox message={migrateError} />}
          </div>
        </CardBody>
      </Card>

      </>} {/* end tracking gate */}
    </>
  );
}

// ─── Collect table accordion ──────────────────────────────────────────────────

function CollectTableAccordion({
  collectTables, collectTotal, collectTimestamp, migrationOrder,
}: {
  collectTables: { name: string; count: number }[];
  collectTotal: number;
  collectTimestamp: string;
  migrationOrder: MigrationOrderItem[];
}) {
  const [open, setOpen] = useState(false);
  const maxCount = Math.max(...collectTables.map((t) => t.count), 1);

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 transition hover:bg-emerald-100/60 select-none"
      >
        <span className="text-sm font-semibold text-emerald-800">✓ Snapshot collected</span>
        <span className="text-emerald-300">·</span>
        <span className="text-xs text-emerald-700">{collectTables.length} table{collectTables.length !== 1 ? "s" : ""}</span>
        <span className="text-emerald-300">·</span>
        <span className="text-xs font-semibold text-emerald-700">{collectTotal.toLocaleString()} rows total</span>
        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11px] text-emerald-600">
          {collectTimestamp}
          <svg
            viewBox="0 0 16 16" fill="none" strokeWidth={2} stroke="currentColor"
            className={classNames("h-3.5 w-3.5 shrink-0 transition-transform duration-200", open && "rotate-180")}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
          </svg>
        </span>
      </div>

      {open && (
        <>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(80px,35%)_4.5rem] items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <span>Table</span><span>Distribution</span><span className="text-right">Rows</span>
            </div>
            {collectTables.map((t) => (
              <div key={t.name} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,35%)_4.5rem] items-center gap-4 border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50">
                <span className="truncate font-mono text-xs font-semibold text-slate-800">{t.name}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-500 transition-all duration-500"
                    style={{ width: `${Math.max((t.count / maxCount) * 100, t.count > 0 ? 2 : 0)}%` }} />
                </div>
                <span className="text-right font-mono text-xs text-slate-600">{t.count.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {migrationOrder.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Migration order</p>
              <p className="mt-1 font-mono text-xs text-slate-700">{migrationOrder.map((item) => item.modelName).join(" → ")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Migrate result accordion ─────────────────────────────────────────────────

function MigrateResultAccordion({
  migrateTables,
  migrateVersion,
}: {
  migrateTables: { name: string; created: number; updated: number; errors: number }[];
  migrateVersion: string;
}) {
  const [open, setOpen] = useState(false);
  const totalCreated = migrateTables.reduce((s, t) => s + t.created, 0);
  const totalErrors  = migrateTables.reduce((s, t) => s + t.errors, 0);

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 transition hover:bg-emerald-100/60 select-none"
      >
        <p className="text-sm font-semibold text-emerald-700">✓ Migration complete — now at version {migrateVersion}</p>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-emerald-600">
          {totalCreated.toLocaleString()} rows inserted
          {totalErrors > 0 && (
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              {totalErrors} errors
            </span>
          )}
          <svg
            viewBox="0 0 16 16" fill="none" strokeWidth={2} stroke="currentColor"
            className={classNames("h-3.5 w-3.5 shrink-0 transition-transform duration-200", open && "rotate-180")}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
          </svg>
        </span>
      </div>

      {open && (
        <div className="overflow-hidden rounded-md border border-slate-200">
          <div className="grid grid-cols-[1fr_5rem_5rem_5rem] border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            <span>Table</span>
            <span className="text-right">Created</span>
            <span className="text-right">Updated</span>
            <span className="text-right">Errors</span>
          </div>
          {migrateTables.map((t) => (
            <div key={t.name} className="grid grid-cols-[1fr_5rem_5rem_5rem] border-b border-slate-100 px-4 py-2.5 last:border-0 hover:bg-slate-50">
              <span className="font-mono text-xs font-semibold text-slate-800">{t.name}</span>
              <span className="text-right font-mono text-xs text-emerald-700">{t.created.toLocaleString()}</span>
              <span className="text-right font-mono text-xs text-blue-700">{t.updated.toLocaleString()}</span>
              <span className={classNames("text-right font-mono text-xs", t.errors > 0 ? "font-semibold text-rose-700" : "text-slate-400")}>
                {t.errors.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
