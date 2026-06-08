"use client";

import { classNames } from "@/lib/utils";
import type { ConnectionRecord, ModelComparisonResult, MigrationOrderItem, PreflightItem } from "@/types/migrations";
import type { SchemaWarning } from "@/lib/stores/schema-warnings-store";
import { useEscapeKey } from "@/hooks/use-escape-key";

type CollectTable = { name: string; count: number };

type PreflightModalProps = {
  isOpen: boolean;
  comparison: ModelComparisonResult | null;
  warnings: SchemaWarning[];
  activeConnection: ConnectionRecord | null;
  syncVersion: string;
  targetVersion: string;
  collectTables: CollectTable[];
  collectTotal: number;
  migrationOrder: MigrationOrderItem[];
  preflightTab: "crucial" | "warning";
  preflightPage: number;
  preflightPageSize: number;
  onTabChange: (tab: "crucial" | "warning") => void;
  onPageChange: (page: number) => void;
  onCancel: () => void;
  onBeginMigration: () => void;
};

const KNOWN_SCALARS = new Set(["string","text","integer","int","bigint","float","decimal","boolean","timestamp","datetime","json","bytes"]);
const COMPAT: Record<string, Set<string>> = {
  integer: new Set(["decimal","float","string","text","bytes"]),
  string: new Set(["text"]),
  float: new Set(["decimal","integer"]),
};

function isCompatible(from: string, to: string): boolean {
  const f = from.toLowerCase(); const t = to.toLowerCase();
  if (f === t) return true;
  if (!KNOWN_SCALARS.has(t)) return f === "string" || f === "text";
  return COMPAT[f]?.has(t) ?? false;
}

function buildPreflightItems(
  comparison: ModelComparisonResult | null,
  warnings: SchemaWarning[],
): { crucial: PreflightItem[]; warning: PreflightItem[] } {
  const crucial: PreflightItem[] = [];
  const warning: PreflightItem[] = [];
  if (!comparison) return { crucial, warning };

  const warningByEntity = new Map(warnings.map((w) => [w.entityName, w]));

  for (const m of comparison.removedModels) {
    crucial.push({ id: `rm-${m.name}`, field: m.name, change: "model removed",
      resolution: "All rows permanently dropped from the database.", actionLabel: "Data deleted", hasValue: false });
  }

  for (const m of comparison.matchedModels) {
    for (const f of m.matchedFields) {
      if (!f.isRelation && f.typeChanged) {
        const w = warningByEntity.get(`${m.toName}.${f.toName}`);
        const rv = w?.replacementValue;
        const compatible = isCompatible(f.fromType, f.toType);
        if (compatible) {
          warning.push({ id: `tc-${m.toName}-${f.toName}`, field: `${m.toName}.${f.toName}`,
            change: `${f.fromType} → ${f.toType}`,
            resolution: `Values will be cast to ${f.toType}. Existing string values carry over — ensure all are valid ${f.toType} members.`,
            actionLabel: "Cast — data carries over", hasValue: true });
        } else {
          crucial.push({ id: `tc-${m.toName}-${f.toName}`, field: `${m.toName}.${f.toName}`,
            change: `${f.fromType} → ${f.toType}`,
            resolution: rv ? `All rows will receive "${rv}" as set in Tracking.` : `All rows will receive an auto-generated placeholder — set a default in Tracking.`,
            actionLabel: rv ? `Replace → "${rv}"` : "Auto-generated placeholder", hasValue: Boolean(rv) });
        }
      }
    }
    for (const f of m.removedFields) {
      warning.push({ id: `rf-${m.toName}-${f.name}`, field: `${m.toName}.${f.name}`, change: "field removed",
        resolution: "Column and all its data will be permanently dropped from the target database.",
        actionLabel: "Data dropped", hasValue: false });
    }
    for (const f of m.addedFields) {
      if (!f.nullable) {
        const w = warningByEntity.get(`${m.toName}.${f.name}`);
        const rv = w?.replacementValue;
        warning.push({ id: `af-${m.toName}-${f.name}`, field: `${m.toName}.${f.name}`,
          change: `new required ${f.type} field`,
          resolution: rv ? `All existing rows will receive "${rv}" as set in Tracking.` : `All existing rows will receive an auto-generated placeholder. Set a backfill value in Tracking.`,
          actionLabel: rv ? `Backfill → "${rv}"` : "Auto-generated placeholder", hasValue: Boolean(rv) });
      }
    }
    for (const f of m.matchedFields) {
      if (!f.isRelation && f.fromNullable && !f.toNullable) {
        const w = warningByEntity.get(`${m.toName}.${f.toName}`);
        const rv = w?.replacementValue;
        warning.push({ id: `nr-${m.toName}-${f.toName}`, field: `${m.toName}.${f.toName}`,
          change: "nullable → required",
          resolution: rv ? `Existing NULL rows will receive "${rv}" as set in Tracking.` : `Existing NULL rows will receive an auto-generated placeholder.`,
          actionLabel: rv ? `Backfill NULLs → "${rv}"` : "Auto-generated for NULLs", hasValue: Boolean(rv) });
      }
    }
  }

  return { crucial, warning };
}

export function PreflightModal({
  isOpen, comparison, warnings, activeConnection,
  syncVersion, targetVersion, collectTables, collectTotal, migrationOrder,
  preflightTab, preflightPage, preflightPageSize,
  onTabChange, onPageChange, onCancel, onBeginMigration,
}: PreflightModalProps) {
  useEscapeKey(onCancel, isOpen);
  if (!isOpen) return null;

  const { crucial, warning } = buildPreflightItems(comparison, warnings);
  const activeItems = preflightTab === "crucial" ? crucial : warning;
  const pageCount = Math.ceil(activeItems.length / preflightPageSize);
  const pageItems = activeItems.slice(preflightPage * preflightPageSize, (preflightPage + 1) * preflightPageSize);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex w-full max-w-5xl flex-col rounded-lg border border-border bg-card shadow-2xl" style={{ maxHeight: "88vh" }}>
        <div className="shrink-0 border-b border-border px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Migration Plan</p>
          <h3 className="mt-0.5 text-lg font-semibold text-foreground">Review before running</h3>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Summary strip */}
          <div className="grid grid-cols-4 gap-4 border-b border-border bg-background px-6 py-4 text-xs">
            <div>
              <p className="font-semibold uppercase tracking-widest text-muted-foreground">Connection</p>
              <p className="mt-1 truncate font-semibold text-foreground">{activeConnection?.name ?? "—"}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{activeConnection ? `${activeConnection.host}:${activeConnection.port}/${activeConnection.database}` : ""}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-widest text-muted-foreground">Versions</p>
              <p className="mt-1 font-semibold text-foreground">
                <span className="font-mono">{syncVersion}</span>
                <span className="mx-2 text-muted-foreground">→</span>
                <span className="font-mono">{targetVersion}</span>
              </p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-widest text-muted-foreground">Tables / Rows</p>
              <p className="mt-1 font-semibold text-foreground">{collectTables.length} tables · {collectTotal.toLocaleString()} rows</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-widest text-muted-foreground">Insert Order</p>
              <p className="mt-1 truncate font-mono text-[10px] text-foreground">{migrationOrder.map((i) => i.modelName).join(" → ") || "—"}</p>
            </div>
          </div>

          {/* Tabs */}
          {(crucial.length > 0 || warning.length > 0) && (
            <div className="flex border-b border-border px-6 pt-3">
              {(["crucial", "warning"] as const).map((tab) => {
                const count = tab === "crucial" ? crucial.length : warning.length;
                const isActive = preflightTab === tab;
                return (
                  <button key={tab} type="button"
                    onClick={() => { onTabChange(tab); onPageChange(0); }}
                    className={classNames("relative mr-6 pb-3 text-sm font-semibold capitalize transition",
                      isActive ? (tab === "crucial" ? "text-rose-300" : "text-amber-300") : "text-muted-foreground hover:text-foreground")}>
                    {tab}
                    <span className={classNames("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      tab === "crucial" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300")}>
                      {count}
                    </span>
                    {isActive && <span className={classNames("absolute bottom-0 left-0 right-0 h-0.5 rounded-full",
                      tab === "crucial" ? "bg-rose-500" : "bg-amber-500")} />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Item list */}
          <div className="space-y-2 px-6 py-4">
            {pageItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No {preflightTab} items for this migration.</p>
            ) : pageItems.map((item) => {
              const isCrucial = preflightTab === "crucial";
              return (
                <div key={item.id}
                  className={classNames("grid grid-cols-[1fr_auto] items-start gap-x-6 gap-y-1 rounded-lg border px-4 py-3",
                    isCrucial ? "border-rose-500/30 bg-rose-500/15" : "border-amber-500/25 bg-amber-500/15")}>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className={classNames("font-mono text-xs font-semibold",
                        isCrucial ? "text-rose-200" : "text-amber-200")}>{item.field}</code>
                      <span className={classNames("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        isCrucial ? "bg-rose-200 text-rose-300" : "bg-amber-200 text-amber-300")}>{item.change}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{item.resolution}</p>
                  </div>
                  <div className="mt-0.5 shrink-0">
                    <span className={classNames("inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                      item.hasValue ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" : "border-border bg-muted text-muted-foreground")}>
                      {item.actionLabel}
                    </span>
                  </div>
                </div>
              );
            })}

            {pageCount > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  {preflightPage * preflightPageSize + 1}–{Math.min((preflightPage + 1) * preflightPageSize, activeItems.length)} of {activeItems.length}
                </span>
                <div className="flex gap-1">
                  <button type="button" disabled={preflightPage === 0 || undefined}
                    onClick={() => onPageChange(preflightPage - 1)}
                    className="h-7 rounded border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-40">
                    ← Prev
                  </button>
                  <button type="button" disabled={preflightPage >= pageCount - 1 || undefined}
                    onClick={() => onPageChange(preflightPage + 1)}
                    className="h-7 rounded border border-border px-2.5 text-xs font-semibold text-foreground hover:bg-background disabled:cursor-not-allowed disabled:opacity-40">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mx-6 mb-4 rounded-md border border-amber-500/30 bg-amber-500/15 px-4 py-2.5">
            <p className="text-xs font-semibold text-amber-300">The target database will be force-reset and rebuilt. Ensure the snapshot is current before proceeding.</p>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button type="button" onClick={onCancel}
            className="h-9 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-background">
            Cancel
          </button>
          <button type="button" onClick={onBeginMigration}
            className="h-9 min-w-40 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700">
            Begin Migration
          </button>
        </div>
      </div>
    </div>
  );
}
