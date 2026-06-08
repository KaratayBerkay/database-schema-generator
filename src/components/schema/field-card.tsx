"use client";

import { IconCheck, IconTrash } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { typeSelectClass } from "@/constants/schema";
import type { PrismaField, PrismaFieldInput } from "@/lib/stores/schema-store";
import type { FieldDiff } from "@/lib/version-diff/detect-changes";

type EnumValue = { valueId: string; name: string };

type FieldCardProps = {
  field: PrismaField;
  draft: PrismaFieldInput;
  hasChanges: boolean;
  fieldDiff: FieldDiff | null | undefined;
  cardBorder: string;
  enumTypes: string[];
  scalarTypeOptions: string[];
  savingFieldKey: string;
  deletingFieldKey: string;
  getEnumValues: (name: string) => EnumValue[];
  onUpdateDraft: (fieldKey: string, patch: Partial<PrismaFieldInput>) => void;
  onSave: (field: PrismaField) => void;
  onDelete: (field: PrismaField) => void;
  /** Previous version label shown in the diff tooltip (e.g. "1.0111") */
  previousVersion?: string;
  /** Current / selected version label (e.g. "1.0112") */
  currentVersion?: string;
};

export function FieldCard({
  field, draft, hasChanges, fieldDiff, cardBorder,
  enumTypes, scalarTypeOptions, savingFieldKey, deletingFieldKey,
  getEnumValues, onUpdateDraft, onSave, onDelete,
  previousVersion, currentVersion,
}: FieldCardProps) {
  const isEnum = enumTypes.includes(draft.type);

  // Background tint based on severity
  const diffBg = !fieldDiff ? "bg-card"
    : fieldDiff.severity === "breaking" ? "bg-rose-500/15"
    : fieldDiff.severity === "warning"  ? "bg-amber-500/15"
    : "bg-sky-500/15";

  return (
    // When a badge is present, extra top padding clears the badge so it never overlaps content
    <div className={classNames("relative rounded-lg border shadow-sm",
      fieldDiff ? "px-3 pb-3 pt-5" : "p-3",
      cardBorder, diffBg)}>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 grid gap-2">
          <div className={classNames("grid gap-2", isEnum ? "grid-cols-[1fr_minmax(0,120px)_minmax(0,140px)_1fr]" : "grid-cols-[1fr_minmax(0,140px)_1fr]")}>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Name
              <input value={draft.name}
                onChange={(e) => onUpdateDraft(field.key, { name: e.target.value })}
                className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-600"
              />
            </label>
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Type
              <select
                value={isEnum ? "Enum" : draft.type}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateDraft(field.key, { type: val === "Enum" ? (enumTypes[0] ?? draft.type) : val });
                }}
                className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal outline-none transition focus:border-cyan-600",
                  isEnum ? "border-indigo-500/30 bg-indigo-500/15 text-indigo-200" : typeSelectClass(draft.type))}>
                {scalarTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="Enum" disabled={enumTypes.length === 0}>Enum</option>
              </select>
              {fieldDiff?.from && fieldDiff?.to && fieldDiff.from !== fieldDiff.to && (
                <span className="mt-0.5 block font-semibold normal-case tracking-normal text-amber-300">was: {fieldDiff.from}</span>
              )}
            </label>
            {isEnum && (
              <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Enum
                <select value={draft.type} onChange={(e) => onUpdateDraft(field.key, { type: e.target.value })}
                  className="mt-1 h-8 w-full rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2.5 text-xs font-medium normal-case tracking-normal text-indigo-200 outline-none transition focus:border-indigo-400">
                  {enumTypes.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Default
              <input value={draft.defaultValue} readOnly={isEnum}
                onChange={(e) => { if (!isEnum) onUpdateDraft(field.key, { defaultValue: e.target.value }); }}
                className={classNames("mt-1 h-8 w-full rounded-md border px-2.5 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition",
                  isEnum ? "cursor-default border-indigo-500/25 bg-indigo-500/15 text-indigo-300" : "border-border bg-card placeholder:text-muted-foreground focus:border-cyan-600")}
                placeholder={isEnum ? "Pick a value ↓" : "Default value"}
              />
            </label>
          </div>

          {isEnum && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-indigo-500/25 bg-indigo-500/15 px-2.5 py-1.5">
              <span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-indigo-400">Values</span>
              {getEnumValues(draft.type).length === 0 ? (
                <span className="text-[10px] font-medium text-indigo-300">No values defined</span>
              ) : (
                <>
                  {getEnumValues(draft.type).slice(0, 12).map((v) => {
                    const isActive = draft.defaultValue === `"${v.name}"`;
                    return (
                      <button key={v.valueId} type="button"
                        onClick={() => onUpdateDraft(field.key, { defaultValue: isActive ? "" : `"${v.name}"` })}
                        className={classNames("rounded px-1.5 py-0.5 text-[10px] font-semibold transition",
                          isActive ? "bg-indigo-600 text-white" : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-200")}>
                        {v.name}
                      </button>
                    );
                  })}
                  {getEnumValues(draft.type).length > 12 && (
                    <span className="text-[10px] font-medium text-indigo-400">+{getEnumValues(draft.type).length - 12} more</span>
                  )}
                </>
              )}
            </div>
          )}

          <label className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Comment
            <input value={draft.comment}
              onChange={(e) => onUpdateDraft(field.key, { comment: e.target.value })}
              className="mt-1 h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs font-medium normal-case tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-600"
              placeholder="FK companies"
            />
          </label>

        </div>

        <div className="flex w-1/5 min-w-0 flex-col gap-1.5">
          <button type="button" onClick={() => onUpdateDraft(field.key, { nullable: !draft.nullable })}
            className={classNames("h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
              draft.nullable ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30" : "border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30")}>
            {draft.nullable ? "Nullable" : "Required"}
          </button>
          <button type="button" onClick={() => onUpdateDraft(field.key, { unique: !draft.unique })}
            disabled={draft.type === "Boolean"}
            className={classNames("h-8 rounded-md border px-2.5 text-[11px] font-semibold transition",
              draft.unique ? "border-violet-500/40 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30" : "border-sky-500/40 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30",
              draft.type === "Boolean" && "cursor-not-allowed opacity-30")}>
            {draft.unique ? "Unique" : "Multiple"}
          </button>
          <div className="mt-auto">
            {hasChanges ? (
              <button type="button" onClick={() => onSave(field)} disabled={savingFieldKey === field.key}
                className="flex h-8 w-full items-center justify-center rounded-md border border-cyan-500/40 bg-card text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                title="Save">
                <IconCheck size={15} stroke={2.5} />
              </button>
            ) : (
              <button type="button" onClick={() => onDelete(field)} disabled={deletingFieldKey === field.key}
                className="flex h-8 w-full items-center justify-center rounded-md border border-rose-500/30 bg-card text-rose-500 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                title="Delete">
                <IconTrash size={15} stroke={2} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alert badge — straddles the top-left border, never overlaps content */}
      {fieldDiff && (
        <div className="group/badge pointer-events-auto absolute -left-2 -top-4 z-20">
          {/* h-8 badge centred on the card's top border; pt-5 on the card keeps content clear */}
          <div className={classNames(
            "flex h-8 w-8 cursor-help items-center justify-center rounded-full shadow-lg ring-2 ring-white transition-transform duration-100 group-hover/badge:scale-110",
            fieldDiff.severity === "breaking" ? "bg-rose-500" : fieldDiff.severity === "warning" ? "bg-amber-400" : "bg-sky-400",
          )}>
            <span className="select-none text-[18px] font-black leading-none text-white">!</span>
          </div>

          {/* Tooltip — only visible when hovering the badge */}
          <div className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-[640px] opacity-0 transition-opacity duration-150 group-hover/badge:opacity-100">
            <div className={classNames(
              "rounded-xl border px-5 py-4 shadow-xl",
              fieldDiff.severity === "breaking"
                ? "border-rose-500/30 bg-card text-rose-300"
                : fieldDiff.severity === "warning"
                  ? "border-amber-500/30 bg-card text-amber-300"
                  : "border-sky-500/30 bg-card text-sky-300",
            )}>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">
                {fieldDiff.severity === "breaking" ? "Breaking Change" : fieldDiff.severity === "warning" ? "Warning" : "Info"}
              </p>
              <p className="mt-1.5 text-sm font-semibold leading-snug">{fieldDiff.message}</p>

              {/* version:type → version:type row */}
              {fieldDiff.from && fieldDiff.to && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-current/10 bg-current/5 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {previousVersion && (
                      <span className="rounded bg-current/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold opacity-60">
                        {previousVersion}
                      </span>
                    )}
                    <span className="font-mono text-sm font-bold">{fieldDiff.from}</span>
                  </div>
                  <span className="text-base opacity-40">→</span>
                  <div className="flex items-center gap-1.5">
                    {currentVersion && (
                      <span className="rounded bg-current/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold opacity-60">
                        {currentVersion}
                      </span>
                    )}
                    <span className="font-mono text-sm font-bold">{fieldDiff.to}</span>
                  </div>
                </div>
              )}

              {fieldDiff.cascade.length > 0 && (
                <p className="mt-2 text-[11px] opacity-50">
                  {fieldDiff.cascade.length} FK field{fieldDiff.cascade.length > 1 ? "s" : ""} also affected
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
