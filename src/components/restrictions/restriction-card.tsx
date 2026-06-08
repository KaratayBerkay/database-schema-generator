"use client";

import { classNames } from "@/lib/utils";
import { restrictionTypeLabel, restrictionTypeClass } from "@/constants/restrictions";
import type { PrismaRestriction } from "@/lib/stores/schema-store";

type RestrictionCardProps = {
  restriction: PrismaRestriction;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

export function RestrictionCard({ restriction, isDeleting, onEdit, onDelete }: RestrictionCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={classNames("rounded-md border px-2 py-1 text-xs font-semibold", restrictionTypeClass(restriction.type))}>
              {restrictionTypeLabel(restriction.type)}
            </span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
              {restriction.source === "field" ? "Field" : "Model"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {restriction.fields.map((fieldName) => (
              <span
                key={fieldName}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground"
              >
                {fieldName}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="h-8 rounded-md border border-violet-500/30 bg-card px-2.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/15"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="h-8 rounded-md border border-rose-500/30 bg-card px-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>

      {restriction.dbName && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          DB name: <span className="text-foreground">{restriction.dbName}</span>
        </p>
      )}
      <code className="mt-3 block overflow-x-auto rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-50">
        {restriction.preview}
      </code>
    </div>
  );
}
