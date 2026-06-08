"use client";

import { classNames } from "@/lib/utils";
import type { ExportType } from "@/constants/exports";
import { useEscapeKey } from "@/hooks/use-escape-key";

type PickleConfirmDialogProps = {
  pendingPickle: ExportType | null;
  version: string;
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function PickleConfirmDialog({ pendingPickle, version, projectName, onConfirm, onCancel }: PickleConfirmDialogProps) {
  useEscapeKey(onCancel, !!pendingPickle);
  if (!pendingPickle) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Confirm Export</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">
            {pendingPickle === "pickle-version" ? "Version Pickle" : "Project Pickle"}
          </h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm leading-6 text-muted-foreground">
            {pendingPickle === "pickle-version" ? (
              <>You are about to pickle out <span className="font-semibold text-foreground">{version}</span>. Are you sure?</>
            ) : (
              <>You are about to pickle out all versions in <span className="font-semibold text-foreground">{projectName}</span>. Are you sure?</>
            )}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={classNames(
              "h-9 rounded-md px-4 text-xs font-semibold text-white shadow-sm transition",
              pendingPickle === "pickle-version" ? "bg-amber-500 hover:bg-amber-600" : "bg-orange-500 hover:bg-orange-600",
            )}
          >
            Yes, download
          </button>
        </div>
      </div>
    </div>
  );
}
