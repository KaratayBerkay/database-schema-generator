"use client";

import { IconCopy, IconCheck, IconX, IconDownload } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { highlightCode } from "@/lib/format/code-highlighting";
import { useEscapeKey } from "@/hooks/use-escape-key";

type DialogState = {
  exportId: string;
  code: string;
  fileName: string;
  lang: "ts" | "prisma" | "python" | "sql";
  tableCount: number;
  enumCount: number;
  badge?: { label: string; className: string };
};

type ExportedCodeDialogProps = {
  dialog: DialogState | null;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onClose: () => void;
};

export function ExportedCodeDialog({ dialog, copied, onCopy, onDownload, onClose }: ExportedCodeDialogProps) {
  useEscapeKey(onClose, !!dialog);
  if (!dialog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="flex max-h-[92vh] w-[96vw] max-w-[1400px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Exported Code</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{dialog.fileName}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {dialog.lang === "ts" || dialog.lang === "python" || dialog.lang === "sql" ? (
                <>
                  {dialog.badge && (
                    <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", dialog.badge.className)}>
                      {dialog.badge.label}
                    </span>
                  )}
                  <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                    {dialog.tableCount} {dialog.tableCount === 1 ? "table" : "tables"}
                  </span>
                  {dialog.enumCount > 0 && (
                    <span className="rounded-md bg-indigo-500/15 px-2 py-1 text-xs font-semibold text-indigo-300">
                      {dialog.enumCount} {dialog.enumCount === 1 ? "enum" : "enums"}
                    </span>
                  )}
                </>
              ) : (
                <span className="rounded-md bg-blue-500/15 px-2 py-1 text-xs font-semibold text-blue-300">Prisma Schema</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCopy}
              title={copied ? "Copied!" : "Copy to clipboard"}
              className={classNames(
                "flex h-9 w-9 items-center justify-center rounded-md border transition",
                copied
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  : "border-border bg-card text-foreground hover:bg-background",
              )}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </button>
            <button
              type="button"
              onClick={onDownload}
              title="Download file"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-background"
            >
              <IconDownload size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-background"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="min-w-max rounded-md border border-border bg-card px-4 py-4 font-mono text-xs">
            {highlightCode(dialog.code, dialog.lang)}
          </div>
        </div>
      </div>
    </div>
  );
}
