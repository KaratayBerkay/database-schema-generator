"use client";

import { useState } from "react";
import { useExportsPageState } from "@/hooks/use-exports-page-state";
import { InlineError, Pagination } from "@/components/built";
import { useExportHistoryQuery, useExportMutations } from "@/queries/exports";
import { classNames } from "@/lib/utils";
import { useProjectInfo } from "../shared/project-info-context";
import { EXPORT_OPTIONS, type ExportType } from "@/constants/exports";
import { ExportedCodeDialog } from "@/components/exports/exported-code-dialog";
import { PickleConfirmDialog } from "@/components/exports/pickle-confirm-dialog";

// Format chip shown in the code dialog header. Distinguishes formats that share a
// highlight lang (SQLAlchemy & Django both render as `python`).
const FORMAT_BADGE: Partial<Record<ExportType, { label: string; className: string }>> = {
  sqlalchemy: { label: "SQLAlchemy", className: "bg-violet-500/15 text-violet-300" },
  django: { label: "Django", className: "bg-lime-500/15 text-lime-300" },
  sql: { label: "SQL", className: "bg-cyan-500/15 text-cyan-300" },
};

export function ExportsPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();
  const {
    exportError, setExportError,
    dialog, setDialog,
    copied, setCopied,
    activeExportType, setActiveExportType,
    pendingPickle, setPendingPickle,
    resetConfirm, setResetConfirm,
    closeDialog,
  } = useExportsPageState();

  const historyQuery = useExportHistoryQuery(projectName ?? "");
  const { invalidate: invalidateExports, generate: exportMutation, reset: resetMutation, markDownloaded: markDownloadedMutation } =
    useExportMutations(projectName ?? "");

  const runExport = (type: ExportType) => {
    if (!projectName || !version) return;
    setActiveExportType(type);
    setExportError("");
    exportMutation.mutate({ projectName, version, type }, {
      onSuccess: (data, vars) => {
        const t = vars.type;
        if (t === "pickle-version" || t === "pickle-project") {
          const blob = new Blob([(data as { code?: string } | undefined)?.code ?? ""], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = (data as { fileName?: string } | undefined)?.fileName ?? "export.pickle.json";
          a.click(); URL.revokeObjectURL(url);
          setActiveExportType(null); return;
        }
        setDialog({ exportId: (data as { id?: string } | undefined)?.id ?? "", code: (data as { code?: string } | undefined)?.code ?? "",
          fileName: (data as { fileName?: string } | undefined)?.fileName ?? (t === "prisma" ? `${version}.prisma` : t === "sqlalchemy" || t === "django" ? "models.py" : t === "sql" ? "schema.sql" : "schema.ts"),
          lang: t === "prisma" ? "prisma" : t === "sqlalchemy" || t === "django" ? "python" : t === "sql" ? "sql" : "ts",
          tableCount: (data as { tableCount?: number } | undefined)?.tableCount ?? 0,
          enumCount: (data as { enumCount?: number } | undefined)?.enumCount ?? 0,
          badge: FORMAT_BADGE[t],
        });
        setActiveExportType(null);
      },
      onError: (err) => { setExportError(err.message); setActiveExportType(null); },
    });
  };

  // Pickle exports confirm first via a dialog; everything else runs immediately.
  const handleExport = (type: ExportType) => {
    if (type === "pickle-version" || type === "pickle-project") { setPendingPickle(type); return; }
    runExport(type);
  };

  const confirmPickle = () => {
    if (!pendingPickle) return;
    const type = pendingPickle;
    setPendingPickle(null);
    runExport(type);
  };

  const handleCopy = async () => {
    if (!dialog) return;
    try {
      await navigator.clipboard.writeText(dialog.code);
    } catch {
      const el = document.createElement("textarea");
      el.value = dialog.code;
      el.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!dialog) return;
    const blob = new Blob([dialog.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dialog.fileName;
    a.click();
    URL.revokeObjectURL(url);
    if (dialog.exportId) {
      markDownloadedMutation.mutate({ id: dialog.exportId }, { onSuccess: () => void invalidateExports() });
    }
  };

  const PAGE_SIZE = 5;
  const [historyPage, setHistoryPage] = useState(0);
  const [trackedProject, setTrackedProject] = useState(projectName);
  if (trackedProject !== projectName) {
    setTrackedProject(projectName);
    setHistoryPage(0);
    setResetConfirm(false);
  }

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Select a project to export schemas.</p>
      </div>
    );
  }

  const exportHistory = historyQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(exportHistory.length / PAGE_SIZE));
  const safePage = Math.min(historyPage, totalPages - 1);
  const pageRows = exportHistory.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5">

      {/* Export history */}
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Download History
              </p>
              <h3 className="mt-1 text-base font-semibold text-foreground">
                Exported Schemas
              </h3>
            </div>
            {exportHistory.length > 0 ? (
              <div className="flex items-center gap-2">
                {resetConfirm ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setResetConfirm(false)}
                      className="h-8 rounded-md border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition hover:bg-background"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => resetMutation.mutate({ projectName: projectName ?? "" }, { onSuccess: () => { setResetConfirm(false); void invalidateExports(); } })}
                      disabled={resetMutation.isPending}
                      className="h-8 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      {resetMutation.isPending ? "Clearing…" : "Yes, clear all"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setResetConfirm(true)}
                    className="h-8 rounded-md border border-rose-500/30 bg-rose-500/15 px-3 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                  >
                    Reset
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {exportHistory.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground">No exports yet for this project.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    File
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Type
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Version
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Downloaded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-background/50">
                    <td className="px-5 py-3 font-mono text-xs">
                      <span className="text-muted-foreground">~/Downloads/</span>
                      <span className="font-semibold text-foreground">{row.file_name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={classNames(
                          "rounded px-2 py-0.5 text-[11px] font-bold",
                          row.export_type === "prisma"
                            ? "bg-blue-500/20 text-blue-300"
                            : row.export_type === "sqlalchemy"
                              ? "bg-violet-500/20 text-violet-300"
                              : row.export_type === "django"
                                ? "bg-lime-500/20 text-lime-300"
                                : row.export_type === "sql"
                                  ? "bg-cyan-500/20 text-cyan-300"
                                  : "bg-emerald-500/20 text-emerald-300",
                        )}
                      >
                        {row.export_type === "prisma" ? "Prisma" : row.export_type === "sqlalchemy" ? "SQLAlchemy" : row.export_type === "django" ? "Django" : row.export_type === "sql" ? "SQL" : "Drizzle"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {row.version}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {new Date(row.exported_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  {exportHistory.length} {exportHistory.length === 1 ? "export" : "exports"} total
                </p>
                <Pagination
                  page={safePage + 1}
                  pageCount={totalPages}
                  onPageChange={(p) => setHistoryPage(p - 1)}
                />
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                Exports workspace
              </h3>
            </div>
            <span className="w-fit rounded-md border border-blue-500/30 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-300">
              {projectName} – {version}
            </span>
          </div>
        </div>

        {/* Export cards */}
        <div className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {EXPORT_OPTIONS.map((opt) => {
              const isLoading = activeExportType === opt.type;
              const isDisabled = activeExportType !== null;

              return (
                <div
                  key={opt.type}
                  className={classNames(
                    "rounded-lg border p-5 transition",
                    opt.accent,
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-foreground">
                          {opt.label}
                        </h4>
                        <span
                          className={classNames(
                            "rounded px-2 py-0.5 text-[11px] font-bold",
                            opt.badgeClass,
                          )}
                        >
                          {opt.fileLabel}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExport(opt.type)}
                    disabled={isDisabled}
                    className={classNames(
                      "mt-4 h-10 min-w-32 rounded-md px-5 text-sm font-semibold text-white shadow-sm transition",
                      opt.type === "prisma"
                        ? "bg-blue-700 hover:bg-blue-800"
                        : opt.type === "drizzle"
                          ? "bg-emerald-700 hover:bg-emerald-800"
                          : opt.type === "sqlalchemy"
                            ? "bg-violet-700 hover:bg-violet-800"
                            : opt.type === "django"
                              ? "bg-lime-700 hover:bg-lime-800"
                              : opt.type === "sql"
                                ? "bg-cyan-700 hover:bg-cyan-800"
                                : opt.type === "pickle-version"
                                  ? "bg-amber-700 hover:bg-amber-800"
                                  : "bg-orange-700 hover:bg-orange-800",
                      isDisabled ? "cursor-not-allowed bg-muted hover:bg-muted" : "",
                    )}
                  >
                    {isLoading
                      ? "Loading..."
                      : opt.type === "pickle-version" || opt.type === "pickle-project"
                        ? "Download"
                        : "Export"}
                  </button>
                </div>
              );
            })}
          </div>

          <InlineError message={exportError} className="mt-4" />
        </div>
      </section>

      <ExportedCodeDialog
        dialog={dialog}
        copied={copied}
        onCopy={() => void handleCopy()}
        onDownload={handleDownload}
        onClose={closeDialog}
      />

      <PickleConfirmDialog
        pendingPickle={pendingPickle}
        version={version ?? ""}
        projectName={projectName ?? ""}
        onConfirm={confirmPickle}
        onCancel={() => setPendingPickle(null)}
      />
    </div>
  );
}
