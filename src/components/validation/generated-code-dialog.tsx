"use client";

import { IconCopy, IconCheck, IconX } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { highlightCode } from "@/lib/format/code-highlighting";
import { useEscapeKey } from "@/hooks/use-escape-key";

type GeneratedCodeDialogProps = {
  isOpen: boolean;
  code: string;
  filePath: string;
  schemaName: string;
  modelName: string;
  date: string;
  schemaCount: number;
  enumCount: number;
  warnings: string[];
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
};

export function GeneratedCodeDialog({
  isOpen, code, filePath, schemaName, modelName, date,
  schemaCount, enumCount, warnings, copied, onCopy, onClose,
}: GeneratedCodeDialogProps) {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="max-h-[92vh] w-[96vw] max-w-[1400px] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Generated Code</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-foreground">{schemaName}</span>
              {modelName && schemaName !== modelName && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{modelName}</span>
              )}
              {date && (
                <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  v{date}
                </span>
              )}
              {schemaCount > 0 && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {schemaCount} schema{schemaCount !== 1 ? "s" : ""}
                  {enumCount > 0 ? ` · ${enumCount} enum${enumCount !== 1 ? "s" : ""}` : ""}
                </span>
              )}
              {filePath && (
                <span className="truncate text-xs font-medium text-muted-foreground" title={filePath}>{filePath}</span>
              )}
            </div>
            {warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {warnings.map((w, i) => <p key={i} className="text-xs font-medium text-amber-300">{w}</p>)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              title={copied ? "Copied!" : "Copy code"}
              className={classNames(
                "flex h-8 w-8 items-center justify-center rounded border transition",
                copied
                  ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                  : "border-border bg-card text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {copied ? <IconCheck size={15} stroke={2.5} /> : <IconCopy size={15} stroke={2} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-muted-foreground transition hover:bg-background hover:text-foreground"
            >
              <IconX size={15} stroke={2} />
            </button>
          </div>
        </div>
        <div className="custom-scrollbar overflow-auto p-5 pb-12" style={{ maxHeight: "calc(92vh - 140px)" }}>
          <div className="min-w-max rounded-md border border-border bg-card px-4 py-4 font-mono text-xs">
            {highlightCode(code, "ts")}
          </div>
        </div>
      </div>
    </div>
  );
}
