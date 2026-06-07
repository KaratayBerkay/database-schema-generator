"use client";

import { useState } from "react";
import Link from "next/link";
import type { SchemaWarning } from "@/lib/stores/schema-warnings-store";
import { warningNavHref } from "@/lib/domain/tracking-utils";
import { ResolveModal } from "@/components/tracking/resolve-modal";
import { SeverityBadge } from "@/components/tracking/severity-badge";
import { StrategyBadge } from "@/components/tracking/strategy-badge";
import { WarningCellContent } from "@/components/tracking/warning-cell-content";

function ApproveCell({
  warning, canApprove, pendingValue, workerBusy, onApprove, onUnapprove,
}: {
  warning: SchemaWarning;
  canApprove: boolean;
  pendingValue: string;
  workerBusy: boolean;
  onApprove: (id: string, replacementValue?: string) => Promise<void>;
  onUnapprove: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const disabled = busy || workerBusy;

  // While the worker is busy, hide buttons entirely — the panel shows a banner
  if (workerBusy) return null;

  if (warning.approvedAt) {
    return (
      <button type="button" disabled={busy}
        onClick={async () => { setBusy(true); await onUnapprove(warning.id); setBusy(false); }}
        title="Undo approval"
        className="h-7 w-7 rounded-full border border-rose-300 text-rose-500 flex items-center justify-center text-sm font-bold transition hover:bg-rose-50 hover:border-rose-400 disabled:opacity-40">
        {busy ? "…" : "✗"}
      </button>
    );
  }

  return (
    <button type="button" disabled={!canApprove || busy}
      title={canApprove ? "Approve" : "Set a value first"}
      onClick={async () => {
        setBusy(true);
        await onApprove(warning.id, pendingValue.trim() || undefined);
        setBusy(false);
      }}
      className={`h-7 w-7 rounded-full border text-sm font-bold transition flex items-center justify-center ${
        canApprove
          ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400"
          : "border-slate-200 text-slate-300 cursor-not-allowed"
      }`}>
      {busy ? "…" : "✓"}
    </button>
  );
}

export function WarningRow({
  w, enumValuesMap, approve, unapprove, remap: _remap, applyFkType, workerBusy, cascadeHints,
}: {
  w: SchemaWarning;
  enumValuesMap: Record<string, string[]>;
  approve: (id: string, replacementValue?: string) => Promise<void>;
  unapprove: (id: string) => Promise<void>;
  remap: (id: string, replacementValue: string) => Promise<void>;
  applyFkType: (id: string) => Promise<void>;
  workerBusy: boolean;
  cascadeHints?: SchemaWarning[];
}) {
  const [pendingValue, setPendingValue] = useState(w.replacementValue ?? "");
  const [resolveOpen, setResolveOpen] = useState(false);
  const rowBg = w.approvedAt ? "bg-emerald-50/60" : "bg-rose-50/60";
  const isNullable = w.targetNullable === true;
  const isPkChange = w.changeKind === "pk_type_changed";

  const isEnumRemoval  = w.entityKind === "enum" && w.changeKind === "value_removed";
  const isFieldDefault = w.entityKind === "field" &&
    (w.resolution === "backfill_required" || w.resolution === "lossy_convert" || w.resolution === "precision_loss") &&
    w.targetNullable !== null;
  const isFkCascade = w.entityKind === "relation" && w.changeKind === "type_changed";

  const needsResolution = (isEnumRemoval || (isFieldDefault && !isNullable) || isFkCascade) && !w.approvedAt;
  const canApprove = isFkCascade
    ? false  // FK cascade must go through the resolver — direct approve blocked
    : isEnumRemoval
      ? pendingValue.trim().length > 0
      : isFieldDefault && !isNullable ? pendingValue.trim().length > 0 : true;

  return (
    <>
      <tr className={`${rowBg} border-b border-slate-100 transition-colors last:border-0`}>
        <td className="py-3 pl-4 pr-4 align-middle whitespace-nowrap">
          <SeverityBadge w={w} />
        </td>
        <td className="py-3 pr-4 align-middle font-semibold text-slate-800">{w.entityName}</td>
        <td className="py-3 pr-4 align-middle">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{w.changeKind}</code>
        </td>
        <td className="max-w-xs py-3 pr-4 align-middle text-xs text-slate-600">{w.message}</td>
        <td className="py-3 pr-4 align-middle whitespace-nowrap">
          {(w.fromValue || w.toValue) && (
            <span className="flex items-center gap-1 text-xs">
              {w.fromValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{w.fromValue}</code>}
              {w.fromValue && w.toValue && <span className="text-slate-400">→</span>}
              {w.toValue && <code className="rounded bg-slate-100 px-1 font-mono text-slate-600">{w.toValue}</code>}
            </span>
          )}
        </td>
        <td className="py-3 pr-4 align-middle"><WarningCellContent w={w} /></td>
        <td className="py-3 pr-4 align-middle">
          {needsResolution ? (
            <button type="button" onClick={() => setResolveOpen(true)}
              className="h-7 rounded-md border border-rose-300 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
              Resolve
            </button>
          ) : (
            <StrategyBadge w={w} />
          )}
        </td>
        <td className="py-3 pr-4 align-middle">
          <div className="flex justify-center">
            <ApproveCell warning={w} canApprove={canApprove} pendingValue={pendingValue} workerBusy={workerBusy} onApprove={approve} onUnapprove={unapprove} />
          </div>
        </td>
        <td className="py-3 pr-4 align-middle">
          <Link href={warningNavHref(w)}
            className="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 whitespace-nowrap">
            View
          </Link>
        </td>
      </tr>

      {isPkChange && cascadeHints && cascadeHints.length > 0 && (
        <tr className={rowBg}>
          <td colSpan={9} className="px-4 pb-4 pt-0">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold text-blue-800">
                Cascade Impact — {cascadeHints.length} FK field{cascadeHints.length !== 1 ? "s" : ""} reference this PK
              </p>
              <ul className="mt-2 space-y-1.5">
                {cascadeHints.map((hint) => {
                  const fkField = hint.entityName.split(" →")[0] ?? hint.entityName;
                  return (
                    <li key={hint.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-blue-700">
                      <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-blue-900">{fkField}</code>
                      <span className="text-blue-500">
                        {hint.fromValue} → {hint.toValue ?? "UUID"}
                      </span>
                      {hint.approvedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          ✓ schema updated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          ⚠ schema update required → Relations tab
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-blue-600">
                Data is collected in FK hierarchy order. Each parent row stores its old PK in{" "}
                <code className="rounded bg-blue-100 px-1 font-mono text-blue-900">_referance</code>.
                After INSERT, child FK values resolve to the new UUIDs automatically — no manual action needed for data.
              </p>
            </div>
          </td>
        </tr>
      )}

      {resolveOpen && (
        <ResolveModal
          warning={w} pendingValue={pendingValue} setPendingValue={setPendingValue}
          enumValuesMap={enumValuesMap} onApprove={approve} applyFkType={applyFkType} onClose={() => setResolveOpen(false)}
        />
      )}
    </>
  );
}
