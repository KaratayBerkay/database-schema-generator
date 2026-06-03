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
        isActive ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300",
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
              isActive ? "text-teal-500" : "text-slate-400",
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
                  isActive ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700",
                )}
              >
                {version.name}
              </span>
              {isActive && (
                <span className="rounded-md border border-teal-300 bg-white px-2 py-0.5 text-xs font-semibold text-teal-700">
                  Active
                </span>
              )}
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {summary.count} {summary.count === 1 ? "migration" : "migrations"}
              </span>
              <StatusRollup success={summary.success} partial={summary.partial} failed={summary.failed} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
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
                ? "cursor-default border-teal-200 bg-teal-50 text-teal-400"
                : "border-slate-300 bg-white text-slate-700 hover:border-teal-300 hover:text-teal-700",
            )}
          >
            {isActive ? "In use" : "Use"}
          </button>
        </div>
      </div>

      {/* Body: this version's migration runs */}
      {isOpen && (
        <div className="border-t border-slate-200/70 bg-white/60 px-4 py-3">
          {version.migrations.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs font-medium text-slate-400">
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
