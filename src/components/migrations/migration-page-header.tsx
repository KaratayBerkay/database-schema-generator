"use client";

import type { MigrationPlan } from "@/types/migrations";

type ActiveConnection = { name: string } | null;

export function MigrationPageHeader({
  provider,
  projectName,
  migrationPlan,
  isNewPlan,
  newTargetVersion,
  targetVersion,
  activeConnection,
}: {
  provider: string;
  projectName: string;
  migrationPlan: MigrationPlan | null;
  isNewPlan: boolean;
  newTargetVersion: string;
  targetVersion: string;
  activeConnection: ActiveConnection;
}) {
  const displayTarget = migrationPlan && (isNewPlan ? newTargetVersion : targetVersion);

  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Migrations</p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">Schema Migration Workflow</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect to a database, then deploy a fresh schema or migrate data between versions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {provider}
          </span>
          <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {projectName}
          </span>
          {displayTarget && (
            <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              Target: {displayTarget}
            </span>
          )}
          {activeConnection && (
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              ● {activeConnection.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
