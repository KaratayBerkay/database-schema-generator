"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTRPC } from "@/trpc/client";
import type { TrackingEntry, TrackingEntryKind, TrackingChangeKind } from "@/lib/domain/tracking-utils";
import { rowTint, kindLabel } from "@/constants/tracking";
import { ChangeBadge } from "./change-badge";
import { ValueDisplay } from "./value-display";
import { Pagination } from "@/components/built";

export function AllChangesTab({
  projectId,
  fromVersion,
  toVersion,
}: {
  projectId: string;
  fromVersion: string;
  toVersion: string;
}) {
  const trpc = useTRPC();
  const [kindFilter, setKindFilter]     = useState<TrackingEntryKind | "all">("all");
  const [changeFilter, setChangeFilter] = useState<TrackingChangeKind | "all">("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data, isLoading } = useQuery(
    trpc.tracking.allChanges.queryOptions({ projectId }, { enabled: !!projectId }),
  );

  const allEntries: TrackingEntry[] = useMemo(() => {
    if (!data?.entries) return [];
    return data.entries.filter(
      (e) => e.fromVersion === fromVersion && e.toVersion === toVersion,
    );
  }, [data, fromVersion, toVersion]);

  const entityNames = useMemo(() => {
    const seen = new Set<string>();
    for (const e of allEntries) seen.add(e.entityName);
    return [...seen].sort();
  }, [allEntries]);

  const filtered = useMemo(() => allEntries.filter((e) => {
    if (kindFilter   !== "all" && e.entityKind  !== kindFilter)   return false;
    if (changeFilter !== "all" && e.changeKind  !== changeFilter) return false;
    if (entityFilter !== "all" && e.entityName  !== entityFilter) return false;
    return true;
  }), [allEntries, kindFilter, changeFilter, entityFilter]);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  useEffect(() => { setPage(1); }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedFiltered = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => {
    const c = { field_default: 0, enum: 0, enum_value: 0 };
    for (const e of allEntries) c[e.entityKind]++;
    return c;
  }, [allEntries]);

  const anyFilter = kindFilter !== "all" || changeFilter !== "all" || entityFilter !== "all";
  const reset = () => { setKindFilter("all"); setChangeFilter("all"); setEntityFilter("all"); };

  if (isLoading) {
    return <div className="py-12 text-center text-sm font-medium text-muted-foreground">Loading…</div>;
  }

  if (allEntries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
        <p className="text-sm font-semibold text-muted-foreground">No schema changes detected for this version.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Modify field defaults or enums between {fromVersion} and {toVersion} to see entries here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {counts.field_default > 0 && (
          <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300">
            {counts.field_default} field default{counts.field_default !== 1 ? "s" : ""}
          </span>
        )}
        {counts.enum > 0 && (
          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-300">
            {counts.enum} enum{counts.enum !== 1 ? "s" : ""}
          </span>
        )}
        {counts.enum_value > 0 && (
          <span className="rounded-md border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-300">
            {counts.enum_value} enum value{counts.enum_value !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Kind</span>
          <div className="flex flex-1 divide-x divide-border overflow-hidden rounded-md border border-border">
            {([ ["all", "All"], ["field_default", "Field defaults"], ["enum", "Enums"], ["enum_value", "Enum values"] ] as [TrackingEntryKind | "all", string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setKindFilter(v)}
                className={`flex-1 py-1.5 text-xs font-medium transition ${kindFilter === v ? "bg-slate-800 text-white" : "bg-card text-muted-foreground hover:bg-background"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Change</span>
          <div className="flex flex-1 divide-x divide-border overflow-hidden rounded-md border border-border">
            {([ ["all","All"], ["added","Added"], ["removed","Removed"], ["changed","Changed"], ["renamed","Renamed"], ["value_added","Val. added"], ["value_removed","Val. removed"] ] as [TrackingChangeKind | "all", string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setChangeFilter(v)}
                className={`flex-1 py-1.5 text-xs font-medium transition ${changeFilter === v ? "bg-slate-800 text-white" : "bg-card text-muted-foreground hover:bg-background"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {entityNames.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Entity</span>
            <div className="flex flex-1 divide-x divide-border overflow-hidden rounded-md border border-border">
              {(["all", ...entityNames] as string[]).map((v) => (
                <button key={v} type="button" onClick={() => setEntityFilter(v)}
                  className={`flex-1 py-1.5 text-xs font-medium transition truncate ${entityFilter === v ? "bg-slate-800 text-white" : "bg-card text-muted-foreground hover:bg-background"}`}>
                  {v === "all" ? "All" : v}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          {anyFilter
            ? <button type="button" onClick={reset} className="text-[10px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">Reset filters</button>
            : <span />}
          <span className="text-[10px] font-semibold text-muted-foreground">{filtered.length} of {allEntries.length} entries</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">No entries match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"} · page {page} of {pageCount}
          </p>
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {(["Entity", "Kind", "Change", "From", "To", "View"] as const).map((h) => (
                  <th key={h} className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedFiltered.map((entry, idx) => {
                const isField = entry.entityKind === "field_default";
                return (
                  <tr key={idx} className={`${rowTint[entry.changeKind] ?? ""} transition-colors`}>
                    <td className="py-2.5 pr-4 align-middle">
                      <span className="font-semibold text-foreground">{entry.entityName}</span>
                      {entry.subName && (
                        <><span className="mx-1 text-muted-foreground">·</span><span className="text-muted-foreground">{entry.subName}</span></>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 align-middle">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${
                        entry.entityKind === "field_default" ? "border-amber-500/25 bg-amber-500/15 text-amber-300"
                        : entry.entityKind === "enum"        ? "border-indigo-500/25 bg-indigo-500/15 text-indigo-300"
                        :                                      "border-violet-500/25 bg-violet-500/15 text-violet-300"
                      }`}>
                        {kindLabel[entry.entityKind]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 align-middle"><ChangeBadge kind={entry.changeKind} /></td>
                    <td className="py-2.5 pr-4 align-middle"><ValueDisplay text={entry.fromDisplay} /></td>
                    <td className="py-2.5 pr-4 align-middle"><ValueDisplay text={entry.toDisplay} /></td>
                    <td className="py-2.5 align-middle">
                      <Link
                        href={isField ? `/schema?table=${entry.entityName}` : "/enums"}
                        className="inline-flex h-7 items-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-muted-foreground shadow-sm transition hover:border-teal-500/40 hover:bg-teal-500/15 hover:text-teal-300"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
