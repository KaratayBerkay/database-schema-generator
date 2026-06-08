"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/hooks/use-escape-key";
import type { SchemaWarning } from "@/lib/stores/schema-warnings-store";

export function ResolveModal({
  warning,
  pendingValue,
  setPendingValue,
  enumValuesMap,
  onApprove,
  applyFkType,
  onClose,
}: {
  warning: SchemaWarning;
  pendingValue: string;
  setPendingValue: (v: string) => void;
  enumValuesMap: Record<string, string[]>;
  onApprove: (id: string, replacementValue?: string) => Promise<void>;
  applyFkType: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isNullable = warning.targetNullable === true;
  const isEnumRemoval = warning.entityKind === "enum" && warning.changeKind === "value_removed";
  const isFieldDefault = warning.entityKind === "field" && warning.targetNullable !== null;
  const isFkCascade = warning.entityKind === "relation" && warning.changeKind === "type_changed";

  const targetType = warning.toValue ?? "";
  const fieldName = warning.entityName.split(".")[1] ?? warning.entityName;
  const enumName = warning.entityName.split(".")[0] ?? "";
  const removedValue = warning.entityName.split(".")[1] ?? "";
  const enumAvailable = enumValuesMap[enumName] ?? [];

  useEscapeKey(onClose);

  // Auto-select the first available replacement as soon as options load —
  // prevents the Approve button being stuck disabled on the empty placeholder.
  useEffect(() => {
    if (isEnumRemoval && pendingValue === "" && enumAvailable.length > 0) {
      setPendingValue(enumAvailable[0]!);
    }
  // Re-run if options arrive asynchronously after the modal opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enumAvailable.length]);

  const isStringTarget = !["Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"].includes(targetType);
  const isUniqueField = warning.targetUnique === true;
  const isUniquePrefix = isStringTarget && isUniqueField;

  const canApprove = isEnumRemoval
    ? pendingValue.trim().length > 0
    : isFieldDefault && !isNullable
      ? pendingValue.trim().length > 0
      : true;

  async function handleApprove(overrideValue?: string) {
    setBusy(true);
    const val = (overrideValue ?? pendingValue).trim() || undefined;
    await onApprove(warning.id, val);
    setBusy(false);
    onClose();
  }

  async function handleResolveForMe() {
    const prefix = fieldName;
    setPendingValue(prefix);
    await handleApprove(prefix);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resolve</p>
          <h3 className="mt-0.5 text-base font-semibold text-foreground">{warning.entityName}</h3>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="space-y-2 rounded-md border border-border bg-background px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-16 font-semibold text-muted-foreground">Change</span>
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{warning.changeKind}</code>
            </div>
            {(warning.fromValue || warning.toValue) && (
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold text-muted-foreground">Type</span>
                <span className="flex items-center gap-1">
                  {warning.fromValue && <code className="rounded bg-muted px-1 font-mono text-muted-foreground">{warning.fromValue}</code>}
                  {warning.fromValue && warning.toValue && <span className="text-muted-foreground">→</span>}
                  {warning.toValue && <code className="rounded bg-muted px-1 font-mono text-muted-foreground">{warning.toValue}</code>}
                </span>
              </div>
            )}
            {warning.entityKind === "field" && (
              <div className="flex items-center gap-2">
                <span className="w-16 font-semibold text-muted-foreground">Field</span>
                <div className="flex gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                    isNullable ? "border-sky-500/30 bg-sky-500/15 text-sky-300" : "border-border bg-card text-muted-foreground"
                  }`}>
                    {isNullable ? "nullable" : "required"}
                  </span>
                  {warning.targetUnique !== null && (
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                      isUniqueField ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-border bg-card text-muted-foreground"
                    }`}>
                      {isUniqueField ? "unique" : "not unique"}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <span className="w-16 shrink-0 font-semibold text-muted-foreground">Message</span>
              <span className="leading-relaxed text-muted-foreground">{warning.message}</span>
            </div>
          </div>

          {isEnumRemoval && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Map <code className="rounded bg-red-500/20 px-1 font-mono text-red-300">{removedValue}</code> to a remaining value
              </p>
              <select
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-slate-500 focus:outline-none"
              >
                <option value="">— select replacement value</option>
                {enumAvailable.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          )}

          {isFieldDefault && !isNullable && isUniquePrefix && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Prefix
                  <span className="ml-1.5 text-[10px] font-normal text-rose-500">required</span>
                </p>
                <span className="rounded border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                  unique field — UUID appended per row
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  value={pendingValue}
                  onChange={(e) => setPendingValue(e.target.value)}
                  placeholder={fieldName}
                  autoFocus
                  className="h-9 flex-1 rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground focus:border-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleResolveForMe}
                  disabled={busy}
                  title={`Use "${fieldName}" as prefix and approve`}
                  className="h-9 rounded-md border border-teal-500/40 bg-teal-500/15 px-3 text-xs font-semibold text-teal-300 transition hover:bg-teal-500/20 disabled:opacity-50"
                >
                  {busy ? "Resolving…" : "Resolve it for me"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Each row will receive: <code className="font-mono text-foreground">{pendingValue || fieldName}-</code><code className="font-mono text-muted-foreground">{"{uuid}"}</code>
              </p>
            </div>
          )}

          {isFieldDefault && !isNullable && !isUniquePrefix && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                Migration default value
                <span className="ml-1.5 text-[10px] font-normal text-rose-500">required</span>
              </p>
              <p className="text-[10px] text-muted-foreground">This value will be set on every existing row.</p>
              {targetType === "Boolean" ? (
                <div className="flex gap-2">
                  {(["true", "false"] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPendingValue(val)}
                      className={`flex h-10 flex-1 items-center justify-center rounded-md border font-mono text-sm font-semibold transition ${
                        pendingValue === val
                          ? val === "true"
                            ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                            : "border-rose-400 bg-rose-500/20 text-rose-300"
                          : val === "true"
                            ? "border-border bg-card text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-300"
                            : "border-border bg-card text-muted-foreground hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              ) : (
              <input
                value={pendingValue}
                onChange={(e) => setPendingValue(e.target.value)}
                placeholder={
                  targetType === "Int" || targetType === "BigInt" ? "e.g. 0"
                  : targetType === "Float" || targetType === "Decimal" ? "e.g. 0.0"
                  : "default value"
                }
                autoFocus
                className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground focus:border-slate-500 focus:outline-none"
              />)}
            </div>
          )}

          {isFieldDefault && isNullable && (
            <p className="text-sm text-muted-foreground">
              This field is nullable — existing rows will be set to <code className="rounded bg-muted px-1 font-mono text-sm">NULL</code>.
            </p>
          )}

          {isFkCascade && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/15 px-4 py-3">
              <p className="text-sm font-semibold text-amber-200">Schema update required</p>
              <p className="mt-1 text-xs text-amber-300">
                Clicking <strong>Apply &amp; Approve</strong> will change{" "}
                <code className="rounded bg-amber-500/20 px-1 font-mono">{warning.entityName.split(" →")[0]}</code> from{" "}
                <code className="rounded bg-amber-500/20 px-1 font-mono">{warning.fromValue}</code> to{" "}
                <code className="rounded bg-amber-500/20 px-1 font-mono">{warning.toValue === "Uuid" ? "String @db.Uuid" : warning.toValue}</code>{" "}
                in the schema, then mark this warning approved.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Cancel
          </button>
          {isFkCascade ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => { setBusy(true); await applyFkType(warning.id); setBusy(false); onClose(); }}
              className="h-9 min-w-36 rounded-md bg-amber-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-muted"
            >
              {busy ? "Applying…" : "Apply & Approve"}
            </button>
          ) : (
            <button
              type="button"
              disabled={!canApprove || busy}
              onClick={() => handleApprove()}
              className="h-9 min-w-32 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-muted"
            >
              {busy ? "Saving…" : "Approve"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
