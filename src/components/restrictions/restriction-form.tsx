"use client";

import { classNames } from "@/lib/utils";
import { restrictionTypeLabel } from "@/constants/restrictions";
import type { PrismaField, PrismaRestrictionType } from "@/lib/stores/schema-store";
import type { RestrictionDraft } from "@/types/restriction";

type RestrictionFormProps = {
  draft: RestrictionDraft;
  selectableFields: PrismaField[];
  savingRestriction: boolean;
  isEdit?: boolean;
  onTypeChange: (type: PrismaRestrictionType) => void;
  onFieldToggle: (fieldName: string) => void;
  onDbNameChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function RestrictionForm({
  draft, selectableFields, savingRestriction, isEdit = false,
  onTypeChange, onFieldToggle, onDbNameChange, onSave, onCancel,
}: RestrictionFormProps) {
  return (
    <div className="flex flex-wrap gap-5">
      <div className="shrink-0">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Type</p>
        <div className="flex gap-1.5">
          {(["UNIQUE", "INDEX"] as PrismaRestrictionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTypeChange(t)}
              className={classNames(
                "h-8 rounded-md border px-3 text-xs font-semibold transition",
                draft.type === t
                  ? t === "UNIQUE"
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                    : "border-violet-400 bg-violet-500/15 text-violet-300"
                  : "border-border bg-card text-muted-foreground hover:border-border hover:bg-background",
              )}
            >
              {restrictionTypeLabel(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-48 flex-1">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fields</p>
        {selectableFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">No fields available for this type.</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-3 xl:grid-cols-4">
            {selectableFields.map((field) => {
              const isSelected = draft.fields.includes(field.name);
              return (
                <button
                  key={field.key}
                  type="button"
                  onClick={() => onFieldToggle(field.name)}
                  className={classNames(
                    "flex items-center justify-between rounded-lg border px-2.5 py-2 text-left transition",
                    isSelected
                      ? "border-violet-400 bg-violet-500/15 shadow-sm"
                      : "border-border bg-card hover:border-violet-500/40",
                  )}
                >
                  <span className={classNames("truncate text-sm font-semibold", isSelected ? "text-violet-200" : "text-foreground")}>
                    {field.name}
                  </span>
                  <span className={classNames(
                    "ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                    isSelected ? "bg-violet-500/20 text-violet-300" : "bg-muted text-muted-foreground",
                  )}>
                    {field.type}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 min-w-44 flex-col justify-between gap-3">
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Database Name
          <input
            value={draft.dbName}
            onChange={(e) => onDbNameChange(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-card px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground focus:border-violet-600"
            placeholder="users_email_ix"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={savingRestriction || draft.fields.length === 0}
            className="h-9 flex-1 rounded-md bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-muted"
          >
            {savingRestriction ? "Saving..." : isEdit ? "Save Restriction" : "Add Restriction"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-background"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
