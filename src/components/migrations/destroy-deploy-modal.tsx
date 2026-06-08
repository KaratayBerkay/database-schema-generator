"use client";

import { useEscapeKey } from "@/hooks/use-escape-key";

type DestroyDeployModalProps = {
  isOpen: boolean;
  newTargetVersion: string;
  destroyConfirmText: string;
  destroyDbPreview: { tables: { name: string; count: number }[]; total: number } | null;
  destroyDbPreviewLoading: boolean;
  onConfirmTextChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DestroyDeployModal({
  isOpen, newTargetVersion, destroyConfirmText,
  destroyDbPreview, destroyDbPreviewLoading,
  onConfirmTextChange, onCancel, onConfirm,
}: DestroyDeployModalProps) {
  useEscapeKey(onCancel, isOpen);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-rose-500/30 bg-card shadow-2xl">
        <div className="border-b border-rose-500/25 bg-rose-500/15 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">Destructive Action</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Destroy and Deploy Schema</h3>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-4 py-3">
            <p className="text-sm font-semibold text-rose-300">All existing data will be permanently lost.</p>
            <p className="text-xs text-rose-300">
              This will wipe every table in the connected database and apply schema version{" "}
              <span className="font-mono font-semibold">{newTargetVersion}</span> from scratch. This cannot be undone.
            </p>
          </div>

          {destroyDbPreviewLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-border border-t-slate-600" />
              Checking database for existing data…
            </div>
          )}

          {!destroyDbPreviewLoading && destroyDbPreview && destroyDbPreview.total > 0 && (
            <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/15 px-4 py-3">
              <p className="text-xs font-semibold text-amber-200">
                {destroyDbPreview.total.toLocaleString()} rows found across{" "}
                {destroyDbPreview.tables.filter((t) => t.count > 0).length} table{destroyDbPreview.tables.filter((t) => t.count > 0).length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-300">This data exists in the target database and will be permanently deleted by the force-reset.</p>
            </div>
          )}

          {!destroyDbPreviewLoading && destroyDbPreview && destroyDbPreview.total === 0 && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-300">No existing rows detected — safe to deploy from scratch.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">
              Type <span className="font-mono text-rose-300">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={destroyConfirmText}
              onChange={(e) => onConfirmTextChange(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="h-9 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-rose-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
          <button type="button" onClick={onCancel}
            className="h-9 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-background">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            disabled={destroyConfirmText !== "DELETE" || undefined}
            className="h-9 min-w-36 rounded-md bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-muted">
            Destroy &amp; Deploy
          </button>
        </div>
      </div>
    </div>
  );
}
