"use client";

import { useState } from "react";
import { classNames } from "@/lib/utils";
import { formatDate, formatDuration } from "@/constants/history";
import { MigrationStatusPill } from "./migration-status";
import type { VersionMigrationRun } from "@/types/history";

/** One data-migration run inside a version accordion, with a per-table breakdown expander. */
export function MigrationRunRow({ run }: { run: VersionMigrationRun }) {
  const [showTables, setShowTables] = useState(false);
  const isError = run.status !== "success" && run.status !== "partial";
  const hasTables = run.tables.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MigrationStatusPill status={run.status} />
          <span className="font-mono text-xs text-foreground">
            {run.fromVersion ? (
              <>
                from <span className="font-semibold">{run.fromVersion}</span> →{" "}
                <span className="font-semibold">{run.toVersion}</span>
              </>
            ) : (
              <>
                initial → <span className="font-semibold">{run.toVersion}</span>
              </>
            )}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {formatDate(run.startedAt ?? run.createdAt)} · {formatDuration(run.startedAt, run.completedAt)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{run.rowsCreated.toLocaleString()}</span> rows created
        </span>
        {run.errors > 0 && (
          <span className="text-rose-300">
            <span className="font-semibold">{run.errors}</span> errors
          </span>
        )}
        {run.stage1IssueCount > 0 && (
          <span className="text-amber-300">
            <span className="font-semibold">{run.stage1IssueCount}</span> validation issues
          </span>
        )}
        {run.connectionLabel && <span className="text-muted-foreground">via {run.connectionLabel}</span>}
        {hasTables && (
          <button
            type="button"
            onClick={() => setShowTables((s) => !s)}
            className="font-semibold text-teal-300 transition hover:text-teal-200"
          >
            {showTables ? "Hide" : "Show"} {run.tables.length} tables
          </button>
        )}
      </div>

      {isError && run.error && (
        <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-medium text-rose-300">
          {run.error}
        </p>
      )}

      {showTables && hasTables && (
        <div className="mt-2 overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-background text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-1.5 text-left">Table</th>
                <th className="px-3 py-1.5 text-right">Created</th>
                <th className="px-3 py-1.5 text-right">Updated</th>
                <th className="px-3 py-1.5 text-right">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {run.tables.map((t) => (
                <tr key={t.name}>
                  <td className="px-3 py-1.5 font-medium text-foreground">{t.name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{t.created.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{t.updated.toLocaleString()}</td>
                  <td className={classNames("px-3 py-1.5 text-right font-mono", t.errors > 0 ? "text-rose-300" : "text-muted-foreground")}>
                    {t.errors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
