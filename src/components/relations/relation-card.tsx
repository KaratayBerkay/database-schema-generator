"use client";

import { IconChevronDown, IconPencil, IconTrash } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { VersionDiffBadge } from "@/components/shared/version-diff-badge";
import type { PrismaRelation } from "@/lib/stores/schema-store";
import type { RelationTab } from "@/types/relation";
import type { FkTypeMismatch } from "@/components/relations/fk-type-detail-modal";
import { relationKindLabel, relationKindClass } from "@/constants/relations";

type FkCascadeHint = { toType: string; targetTableName: string; fromType: string };

type RelationCardProps = {
  relation: PrismaRelation;
  activeRelationTab: RelationTab;
  selectedModelName: string;
  modelCascadeHints: Map<string, FkCascadeHint> | undefined;
  fksMissing: boolean;
  hasFkTypeMismatch: boolean;
  fkTypeMismatches: FkTypeMismatch[];
  isNewRelation: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onShowFkDetail: (mismatches: FkTypeMismatch[], relationName: string, targetTableName: string) => void;
  /** Navigate to the given table in the Relations workspace */
  onNavigateToTable?: (tableName: string) => void;
};

export function RelationCard({
  relation, activeRelationTab, selectedModelName,
  modelCascadeHints, fksMissing, hasFkTypeMismatch, fkTypeMismatches,
  isNewRelation, isDeleting, onEdit, onDelete, onShowFkDetail,
  onNavigateToTable,
}: RelationCardProps) {
  const cardBorder = hasFkTypeMismatch ? "border-red-500/40"
    : isNewRelation ? "border-sky-500/40"
    : fksMissing ? "border-amber-500/40"
    : "border-border";

  // Target model badge colours
  const targetCls = activeRelationTab === "references"
    ? "border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/20"
    : "border-violet-500/40 bg-violet-500/15 text-violet-200 hover:bg-violet-500/20";

  return (
    <div
      id={`relation-card-${relation.key}`}
      className={classNames("rounded-xl border bg-card p-4 shadow-sm transition", cardBorder)}
    >
      {/* ── Row 1: kind → name → target + status badges + actions ─────── */}
      <div className="flex items-start justify-between gap-3">

        {/* Left: relation anatomy */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {/* Relation kind pill — same height as the target model badge */}
          <span className={classNames("shrink-0 rounded-lg border px-3.5 py-1.5 text-sm font-bold shadow-sm", relationKindClass(relation.kind))}>
            {relationKindLabel(relation.kind)}
          </span>

          {/* Relation name */}
          <span className="font-semibold text-foreground">{relation.name}</span>

          {/* Directional arrow */}
          <span className="text-sm font-bold text-muted-foreground">
            {activeRelationTab === "references" ? "←" : "→"}
          </span>

          {/* Target model — big, clickable, navigates to that table */}
          <button
            type="button"
            onClick={() => onNavigateToTable?.(relation.targetModel)}
            title={`Switch to ${relation.targetModel}`}
            className={classNames(
              "shrink-0 rounded-lg border px-3.5 py-1.5 text-sm font-bold shadow-sm transition active:scale-[0.97]",
              onNavigateToTable ? "cursor-pointer " + targetCls : targetCls,
            )}
          >
            {relation.targetModel}
          </button>

          {/* Back-reference name */}
          {activeRelationTab === "relations" && relation.backReferenceName && (
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
              ↩ {relation.backReferenceName}
            </span>
          )}
        </div>

        {/* Right: status badges + edit/delete actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isNewRelation && <VersionDiffBadge severity="info" label="new" />}
          {hasFkTypeMismatch && (
            <button
              type="button"
              onClick={() => onShowFkDetail(fkTypeMismatches, relation.name, relation.targetModel)}
            >
              <VersionDiffBadge severity="breaking" label="FK type" />
            </button>
          )}
          {fksMissing && (
            <span
              title={`FK column "${relation.fields.find((f) => !modelCascadeHints?.has(f))}" not found on ${selectedModelName}`}
              className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
            >
              FK missing
            </span>
          )}
          {activeRelationTab === "relations" && (
            <>
              <button type="button" onClick={onEdit} title="Edit"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-violet-500/30 bg-card text-violet-300 transition hover:bg-violet-500/15">
                <IconPencil size={13} stroke={2} />
              </button>
              <button type="button" onClick={onDelete} disabled={isDeleting} title="Delete"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-card text-rose-500 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:text-muted-foreground">
                <IconTrash size={13} stroke={2} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: FK mapping + cardinality + cascade ──────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border pt-3">
        {/* FK field → reference field */}
        <div className="flex flex-wrap items-center gap-1">
          {relation.fields.length > 0 ? (
            relation.fields.map((f) => {
              const mismatch = modelCascadeHints?.get(f);
              return (
                <span key={f}
                  title={mismatch ? `Update to ${mismatch.toType} — ${mismatch.targetTableName} PK changed from ${mismatch.fromType}` : undefined}
                  className={classNames("rounded-md border px-2 py-0.5 text-xs font-semibold",
                    mismatch ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-transparent bg-muted text-muted-foreground")}>
                  {f}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">implicit</span>
          )}
          <span className="text-xs font-semibold text-muted-foreground">→</span>
          {relation.references.length > 0 ? (
            relation.references.map((r) => (
              <span key={r} className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{r}</span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">managed</span>
          )}
        </div>

        {/* Cardinality */}
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {relation.isArray ? "List" : relation.nullable ? "Optional" : "Required"}
        </span>

        {/* Cascade rules */}
        {relation.onDelete && (
          <span className="rounded-md bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-300">
            onDelete: {relation.onDelete}
          </span>
        )}
        {relation.onUpdate && (
          <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-300">
            onUpdate: {relation.onUpdate}
          </span>
        )}
      </div>

      {/* ── Row 3: collapsible Prisma preview ──────────────────────────── */}
      <details className="group mt-3">
        <summary className="flex cursor-pointer select-none items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-muted-foreground">
          <IconChevronDown size={11} className="-rotate-90 transition-transform group-open:rotate-0" />
          Prisma preview
        </summary>
        <code className="mt-1.5 block overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-50">
          {relation.preview}
        </code>
      </details>
    </div>
  );
}
