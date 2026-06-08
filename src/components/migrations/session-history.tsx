"use client";

import { useState } from "react";
import { classNames } from "@/lib/utils";

type MigrationSession = {
  id: string;
  projectId: string;
  projectName: string;
  connectionId: string;
  fromVersion: string;
  toVersion: string;
  snapshotId: string | null;
  collectTimestamp: string | null;
  collectTableCount: number | null;
  collectRowCount: number | null;
  collectTables: { name: string; count: number }[] | null;
  runStatus: string | null;
  runLogPath: string | null;
  updatedAt: string;
};

type SessionHistoryProps = {
  sessions: MigrationSession[];
  knownConnectionIds: Set<string>;
  onResume: (session: MigrationSession) => void;
};

export function SessionHistory({ sessions, knownConnectionIds, onResume }: SessionHistoryProps) {
  const [open, setOpen] = useState(false);

  if (sessions.length === 0) return null;

  const successCount = sessions.filter((s) => s.runStatus === "success").length;
  const partialCount = sessions.filter((s) => s.runStatus === "partial").length;
  const failCount    = sessions.filter((s) => s.runStatus && s.runStatus !== "success" && s.runStatus !== "partial").length;

  // Order rows by Snapshot ascending (earliest collect first) so the oldest
  // transition (e.g. 1.0111 → 1.0112) sits on top.
  const orderedSessions = [...sessions].sort((a, b) =>
    (a.collectTimestamp ?? "").localeCompare(b.collectTimestamp ?? ""),
  );

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* ── Accordion header (always visible) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-background/60"
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            strokeWidth={2}
            stroke="currentColor"
            className={classNames("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-90")}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4l4 4-4 4" />
          </svg>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Session History
              <span className="ml-2 font-mono normal-case tracking-normal text-muted-foreground">({sessions.length})</span>
            </p>
            {!open && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Click to expand past migration runs.
              </p>
            )}
          </div>
        </div>

        {/* Summary pills — visible when collapsed */}
        {!open && (
          <div className="flex shrink-0 items-center gap-1.5">
            {successCount > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {successCount} success
              </span>
            )}
            {partialCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                {partialCount} partial
              </span>
            )}
            {failCount > 0 && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                {failCount} failed
              </span>
            )}
          </div>
        )}
      </button>

      {/* ── Expandable table ─────────────────────────────────────────────── */}
      {open && (
        <>
          <div className="border-t border-border px-5 pb-1 pt-1.5">
            <p className="text-[11px] text-muted-foreground">Click a row to resume that session.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Project</th>
                  <th className="px-4 py-2.5 text-left">From</th>
                  <th className="px-4 py-2.5 text-left">To</th>
                  <th className="px-4 py-2.5 text-right">Tables</th>
                  <th className="px-4 py-2.5 text-right">Rows</th>
                  <th className="px-4 py-2.5 text-left">Snapshot</th>
                  <th className="px-4 py-2.5 text-left">Run</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderedSessions.map((s) => (
                  <tr key={s.id} className="group transition hover:bg-background">
                    <td className="px-4 py-3 font-semibold text-foreground">{s.projectName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{s.fromVersion}</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{s.toVersion}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {s.collectTableCount ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {s.collectRowCount != null ? s.collectRowCount.toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {s.collectTimestamp ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {s.runStatus ? (
                        <span className={classNames(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          s.runStatus === "success" ? "bg-emerald-500/20 text-emerald-300"
                          : s.runStatus === "partial" ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300",
                        )}>
                          {s.runStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {knownConnectionIds.has(s.connectionId) ? (
                        <button
                          type="button"
                          onClick={() => onResume(s)}
                          className="rounded-md border border-border bg-card px-3 py-1 text-xs font-semibold text-foreground transition hover:border-teal-500/40 hover:bg-teal-500/15 hover:text-teal-300"
                        >
                          Resume
                        </button>
                      ) : (
                        <span
                          title="Connection was deleted — cannot resume this session"
                          className="rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground cursor-not-allowed"
                        >
                          No connection
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
