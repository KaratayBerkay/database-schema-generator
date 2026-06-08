"use client";

import { classNames } from "@/lib/utils";
import { formatDate } from "@/constants/history";
import { StatBadge } from "./stat-badge";
import { StatusRollup } from "./migration-status";
import { MigrationRunRow } from "./migration-run-row";
import type { VersionHistory } from "@/types/history";

type VersionAccordionProps = {
  version: VersionHistory;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onUse: () => void;
};

export function VersionAccordion({ version, isActive, isOpen, onToggle, onUse }: VersionAccordionProps) {
  const summary = version.migrationSummary;

  return (
    <div
      className={classNames(
        "overflow-hidden rounded-lg border transition",
        isActive ? "border-teal-500/40 bg-teal-500/15" : "border-border bg-card hover:border-border",
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Toggle: chevron + version identity + migration summary */}
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <svg
            viewBox="0 0 16 16"
            fill="none"
            strokeWidth={2}
            stroke="currentColor"
            className={classNames(
              "mt-1 h-4 w-4 shrink-0 transition-transform duration-200",
              isActive ? "text-teal-500" : "text-muted-foreground",
              isOpen && "rotate-90",
            )}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4l4 4-4 4" />
          </svg>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={classNames(
                  "rounded-md px-2.5 py-1 text-sm font-bold",
                  isActive ? "bg-teal-600 text-white" : "bg-muted text-foreground",
                )}
              >
                {version.name}
              </span>
              {isActive && (
                <span className="rounded-md border border-teal-500/40 bg-card px-2 py-0.5 text-xs font-semibold text-teal-300">
                  Active
                </span>
              )}
              <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {summary.count} {summary.count === 1 ? "migration" : "migrations"}
              </span>
              <StatusRollup success={summary.success} partial={summary.partial} failed={summary.failed} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>Created {formatDate(version.createdAt)}</span>
              {summary.totalRowsCreated > 0 && (
                <span>{summary.totalRowsCreated.toLocaleString()} rows migrated</span>
              )}
            </div>
          </div>
        </button>

        {/* Schema stats + activation */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StatBadge label="Tables" value={version.tables} />
          <StatBadge label="Fields" value={version.fields} />
          <StatBadge label="Relations" value={version.relations} />
          <StatBadge label="Restrictions" value={version.restrictions} />
          <button
            type="button"
            disabled={isActive}
            onClick={onUse}
            className={classNames(
              "h-9 shrink-0 rounded-md border px-4 text-sm font-semibold transition",
              isActive
                ? "cursor-default border-teal-500/30 bg-teal-500/15 text-teal-400"
                : "border-border bg-card text-foreground hover:border-teal-500/40 hover:text-teal-300",
            )}
          >
            {isActive ? "In use" : "Use"}
          </button>
        </div>
      </div>

      {/* Body: this version's migration runs */}
      {isOpen && (
        <div className="border-t border-border/70 bg-card px-4 py-3">
          {version.migrations.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-xs font-medium text-muted-foreground">
              No migrations recorded for this version yet.
            </p>
          ) : (
            <div className="space-y-2">
              {version.migrations.map((run) => (
                <MigrationRunRow key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
