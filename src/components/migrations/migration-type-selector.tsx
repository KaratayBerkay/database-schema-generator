"use client";

import { classNames } from "@/lib/utils";
import { MigrationLabel as Label } from "@/components/migrations/migration-form";
import { StateChip, StepBadge } from "@/components/migrations/phase-state";
import { Card, CardHeader, CardBody } from "@/components/built";
import type { CheckSyncResponse, MigrationPlan } from "@/types/migrations";

type SyncCheckState = "idle" | "loading" | "compatible" | "incompatible";

type MigrationTypeSelectorProps = {
  canDoAnyMigration: boolean;
  /** When true the selector is dimmed and interactions are blocked — shown before a connection is established. */
  connectionRequired?: boolean;
  isNewPlan: boolean;
  isVersionPlan: boolean;
  canVersionMigrate: boolean;
  dbIsEmpty: boolean;
  syncVersion: string;
  targetVersion: string;
  versions: string[];
  syncCheckState: SyncCheckState;
  syncCheckResult: CheckSyncResponse | null;
  onChangePlan: (plan: MigrationPlan) => void;
  onSyncVersionChange: (v: string) => void;
  onTargetVersionChange: (v: string) => void;
};

export function MigrationTypeSelector({
  canDoAnyMigration, connectionRequired, isNewPlan, isVersionPlan, canVersionMigrate, dbIsEmpty,
  syncVersion, targetVersion, versions, syncCheckState, syncCheckResult,
  onChangePlan, onSyncVersionChange, onTargetVersionChange,
}: MigrationTypeSelectorProps) {
  const planSelected = isNewPlan || isVersionPlan;
  const stepState = planSelected ? "success" : "idle";

  return (
    <Card locked={connectionRequired}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StepBadge n={2} state={stepState} />
            <div>
              <p className="text-sm font-semibold text-foreground">Migration Type</p>
              <p className="text-xs text-muted-foreground">
                {connectionRequired
                  ? "Connect to a database first."
                  : planSelected
                    ? isNewPlan ? "Destroy and Deploy Schema" : "Sync and Migrate to Another Version"
                    : "Choose how you want to migrate."}
              </p>
            </div>
          </div>
          <StateChip state={stepState} />
        </div>
      </CardHeader>

      <CardBody>
        {!canDoAnyMigration ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/15 px-4 py-3">
            <p className="text-sm font-semibold text-amber-300">At least one project version is required to run a migration.</p>
            <p className="mt-1 text-xs text-amber-300">Go to the Projects workspace and create a version before continuing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => onChangePlan("new")}
              className={classNames("rounded-lg border-2 p-4 text-left transition",
                isNewPlan ? "border-cyan-500 bg-cyan-500/15" : "border-border bg-card hover:border-border hover:bg-background")}>
              <div className="flex items-start gap-3">
                <span className={classNames("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                  isNewPlan ? "border-cyan-500 bg-cyan-500" : "border-border")}>
                  {isNewPlan && <span className="h-1.5 w-1.5 rounded-full bg-card" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Destroy and Deploy Schema</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Wipe the database and deploy a schema version from scratch. All existing data will be lost.</p>
                  {dbIsEmpty && <span className="mt-2 inline-block rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">Empty DB detected</span>}
                </div>
              </div>
            </button>

            <button type="button"
              onClick={() => { if (!dbIsEmpty && canVersionMigrate) onChangePlan("version"); }}
              disabled={dbIsEmpty || !canVersionMigrate || undefined}
              className={classNames("rounded-lg border-2 p-4 text-left transition",
                isVersionPlan ? "border-cyan-500 bg-cyan-500/15"
                : dbIsEmpty || !canVersionMigrate ? "cursor-not-allowed border-border bg-background opacity-50"
                : "border-border bg-card hover:border-border hover:bg-background")}>
              <div className="flex items-start gap-3">
                <span className={classNames("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                  isVersionPlan ? "border-cyan-500 bg-cyan-500" : "border-border")}>
                  {isVersionPlan && <span className="h-1.5 w-1.5 rounded-full bg-card" />}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sync and Migrate to Another Version</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Collect existing data, validate, and migrate between schema versions.</p>
                  {dbIsEmpty && <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">DB is empty — use Destroy and Deploy Schema</span>}
                  {!canVersionMigrate && !dbIsEmpty && <span className="mt-2 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Requires 2+ project versions</span>}
                </div>
              </div>
            </button>
          </div>
        )}

        {isVersionPlan && (
          <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-border pt-4">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1">
              <Label>Database is currently at</Label>
              <select value={syncVersion} onChange={(e) => onSyncVersionChange(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-slate-500">
                <option value="" disabled>Select a version…</option>
                {versions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              {syncVersion && syncCheckState === "loading" && <p className="text-[11px] text-muted-foreground">Checking compatibility…</p>}
              {syncVersion && syncCheckState === "compatible" && <p className="text-[11px] font-semibold text-emerald-300">✓ Schema matches database</p>}
              {syncVersion && syncCheckState === "incompatible" && (
                <div className="space-y-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-rose-300">✗ Schema does not match this database</p>
                  {syncCheckResult?.error && <p className="text-[11px] text-rose-500">{syncCheckResult.error}</p>}
                  {(syncCheckResult?.missingTables?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-rose-500">Missing tables: <span className="font-mono">{syncCheckResult!.missingTables!.join(", ")}</span></p>
                  )}
                  {(syncCheckResult?.columnIssues?.length ?? 0) > 0 && (
                    <div className="space-y-0.5">
                      {syncCheckResult!.columnIssues!.map((issue) => (
                        <p key={issue.table} className="text-[11px] text-rose-500">
                          <span className="font-mono font-semibold">{issue.table}</span>: missing <span className="font-mono">{issue.missingColumns.join(", ")}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] italic text-rose-400">Select the version that reflects the database&apos;s current state.</p>
                </div>
              )}
            </div>

            {syncVersion && syncCheckState === "compatible" && (
              <>
                <span className="mt-6 shrink-0 text-muted-foreground">→</span>
                <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <Label>Migrate to</Label>
                  <select value={targetVersion} onChange={(e) => onTargetVersionChange(e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-slate-500">
                    <option value="" disabled>Select a version…</option>
                    {versions.filter((_, idx) => idx > versions.indexOf(syncVersion)).map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
