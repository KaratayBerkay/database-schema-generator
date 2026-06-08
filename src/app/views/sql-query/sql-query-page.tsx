"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { format as formatSql } from "sql-formatter";
import CodeMirror from "@uiw/react-codemirror";
import { sql as sqlLang, SQLite } from "@codemirror/lang-sql";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { classNames } from "@/lib/utils";
import { fieldTypeBadgeClass } from "@/lib/format/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import { useSchemaModels } from "@/hooks/use-schema-models";
import { useDbManagement } from "@/hooks/use-db-management";
import { useQueryTemplates } from "@/hooks/use-query-templates";
import type { QueryResult } from "@/types/sql-query";
import { MigrationModal } from "@/components/sql-query/migration-modal";
import {
  formatDuration, cellDisplay, generateSelect, generateInsert, generateUpdate, generateDelete,
} from "@/lib/sql-query/generators";
import { TableSelectorModal } from "@/features/table-selector";
import { EmptyState, InlineError } from "@/components/built";

export function SqlQueryPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();

  const db = useDbManagement({ projectName, version });
  const tpl = useQueryTemplates({ projectName, version });

  const { models: templateModels } = useSchemaModels(projectName, version);

  // ── query state (closely tied to CodeMirror editor, lives in page) ─────────
  const [sql, setSql] = useState("");
  const [executing, setExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const handleRun = async () => {
    if (!sql.trim() || executing) return;
    setExecuting(true);
    setQueryResult(null);
    try {
      const res = await fetch("/api/sql-query/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, version, sql }),
      });
      const data = await res.json() as QueryResult | { error: string };
      setQueryResult("error" in data ? { kind: "error", error: data.error } : data);
    } catch (err) {
      setQueryResult({ kind: "error", error: err instanceof Error ? err.message : "Query failed." });
    } finally {
      setExecuting(false);
    }
  };

  const handleFormat = () => {
    if (!sql.trim()) return;
    try { setSql(formatSql(sql, { language: "sqlite", tabWidth: 2, keywordCase: "upper" })); }
    catch { /* leave sql unchanged if formatter can't parse it */ }
  };

  // Stable refs so keymap callbacks are always current
  const handleRunRef = useRef(handleRun);
  const handleFormatRef = useRef(handleFormat);
  useLayoutEffect(() => { handleRunRef.current = handleRun; handleFormatRef.current = handleFormat; });

  /* eslint-disable react-hooks/refs */
  const runKeyBinding    = useCallback(() => { void handleRunRef.current(); return true; }, []);
  const formatKeyBinding = useCallback(() => { handleFormatRef.current(); return true; }, []);
  const editorExtensions = useMemo(() => [
    sqlLang({ dialect: SQLite }),
    Prec.highest(keymap.of([
      { key: "Mod-Enter", run: runKeyBinding },
      { key: "Shift-Alt-f", run: formatKeyBinding },
    ])),
  ], [runKeyBinding, formatKeyBinding]);
  /* eslint-enable react-hooks/refs */

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Select a project to use the SQL query workspace.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + DB status */}
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Main Window</p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">SQL Query workspace</h3>
            </div>
            <span className="w-fit rounded-md border border-orange-500/30 bg-orange-500/15 px-3 py-1.5 text-xs font-semibold text-orange-300">
              {projectName} – {version}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className={classNames(
              "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
              db.loadingStatus ? "bg-muted" : db.isInitialized ? "bg-emerald-500" : "bg-amber-400",
            )} />
            {db.loadingStatus ? (
              <span className="text-sm font-medium text-muted-foreground">Checking database…</span>
            ) : db.isInitialized ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Database ready
                  <span className="ml-2 font-mono text-xs text-muted-foreground">{db.dbStatus?.relPath}</span>
                </span>
                <span className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  SQLite preview — queries use SQLite syntax regardless of project provider
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium text-muted-foreground">No SQLite database — initialize to enable queries</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void db.handleMigrate()}
            disabled={!projectName || !version || db.migrating}
            className={classNames(
              "h-9 min-w-36 shrink-0 rounded-md px-4 text-sm font-semibold text-white shadow-sm transition",
              db.isInitialized ? "bg-slate-600 hover:bg-slate-700" : "bg-orange-600 hover:bg-orange-700",
              (!projectName || !version || db.migrating) ? "cursor-not-allowed bg-muted hover:bg-muted" : "",
            )}
          >
            {db.migrating ? "Migrating…" : db.isInitialized ? "Re-migrate" : "Initialize Database"}
          </button>
        </div>
      </section>

      {/* Query templates */}
      {db.isInitialized && templateModels.length > 0 ? (
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Templates</p>
            <button type="button" onClick={() => tpl.setIsTemplateSelectorOpen(true)}
              className="h-8 rounded-md border border-orange-500/40 bg-card px-3 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/15">
              {tpl.selectedTemplate || "Select Table"}
            </button>
            {tpl.loadingTemplateFields ? (
              <span className="text-xs font-medium text-muted-foreground">Loading…</span>
            ) : tpl.selectedTemplate && tpl.templateFields.length > 0 ? (
              <>
                <span className="text-muted-foreground">|</span>
                {([
                  { label: "SELECT", fn: generateSelect, color: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/20" },
                  { label: "INSERT", fn: generateInsert, color: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20" },
                  { label: "UPDATE", fn: generateUpdate, color: "border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/20" },
                  { label: "DELETE", fn: generateDelete, color: "border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/20" },
                ] as const).map(({ label, fn, color }) => (
                  <button key={label} type="button"
                    onClick={() => setSql(fn(tpl.selectedTemplate, tpl.templateFields))}
                    className={classNames("h-8 rounded-md border px-3 text-xs font-semibold transition", color)}>
                    {label}
                  </button>
                ))}
                <span className="text-xs font-medium text-muted-foreground">
                  {tpl.templateFields.filter((f) => !f.isRelation).length} cols
                </span>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* SQL editor */}
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">SQL Editor</p>
          <p className="text-xs font-medium text-muted-foreground">Ctrl+Enter to run · Shift+Alt+F to format</p>
        </div>
        <div className={classNames("transition", !db.isInitialized && "pointer-events-none opacity-50")}>
          <CodeMirror
            value={sql} theme={dracula} height="260px" editable={db.isInitialized}
            placeholder={db.isInitialized ? "SELECT * FROM users LIMIT 20;" : "Initialize the database first to run queries."}
            extensions={editorExtensions}
            onChange={(value) => setSql(value)}
            basicSetup={{ lineNumbers: true, highlightActiveLineGutter: true, highlightActiveLine: true,
              foldGutter: false, bracketMatching: true, closeBrackets: true, autocompletion: true, indentOnInput: true }}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-[#282a36] px-4 py-3">
          <button type="button" onClick={handleFormat} disabled={!sql.trim()}
            className="h-9 rounded-md border border-slate-500 bg-transparent px-4 text-sm font-semibold text-muted-foreground transition hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">
            Format
          </button>
          <button type="button" onClick={() => void handleRun()} disabled={!db.isInitialized || !sql.trim() || executing}
            className="h-9 min-w-28 rounded-md bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-muted-foreground">
            {executing ? "Running…" : "Run Query"}
          </button>
        </div>
      </section>

      {/* Results */}
      {queryResult ? (
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Results</p>
            {queryResult.kind !== "error" && (
              <span className="text-xs font-medium text-muted-foreground">{formatDuration(queryResult.duration)}</span>
            )}
          </div>
          <div className="p-5">
            {queryResult.kind === "error" && <InlineError message={queryResult.error} mono />}
            {queryResult.kind === "mutation" && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-300">
                  {queryResult.affectedRows} row{queryResult.affectedRows !== 1 ? "s" : ""} affected
                  {queryResult.lastInsertRowid ? ` · last insert id: ${queryResult.lastInsertRowid}` : ""}
                </p>
              </div>
            )}
            {queryResult.kind === "exec" && (
              <div className="rounded-md border border-border bg-background px-4 py-3">
                <p className="text-sm font-semibold text-muted-foreground">Executed successfully.</p>
              </div>
            )}
            {queryResult.kind === "rows" && (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""}
                  </p>
                  {queryResult.truncated && (
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">
                      Showing first 500 — add LIMIT to see fewer
                    </span>
                  )}
                </div>
                {queryResult.rowCount === 0 ? (
                  <EmptyState message="Query returned no rows." className="px-4 py-6" />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="min-w-full">
                      <thead className="bg-background">
                        <tr>
                          {queryResult.columns.map((col) => (
                            <th key={col} className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {queryResult.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-background/60">
                            {queryResult.columns.map((col, colIndex) => {
                              const { text, muted } = cellDisplay(row[col]);
                              return (
                                <td key={col}
                                  className={classNames("px-3 py-1.5 font-mono text-[11px]",
                                    colIndex === 0 ? "whitespace-nowrap" : "max-w-[180px] truncate whitespace-nowrap",
                                    muted ? "text-muted-foreground" : "text-foreground")}
                                  title={colIndex !== 0 ? text : undefined}>
                                  {text}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      ) : null}

      <TableSelectorModal
        isOpen={tpl.isTemplateSelectorOpen}
        models={templateModels}
        selectedModelName={tpl.selectedTemplate}
        search={tpl.templateSearch}
        isLoading={false}
        tone="orange"
        onSearch={tpl.setTemplateSearch}
        onSelect={tpl.selectTemplate}
        onClose={tpl.closeTemplateSelector}
        typeBadgeClass={fieldTypeBadgeClass}
      />

      <MigrationModal
        isOpen={db.migrateOpen}
        migrating={db.migrating}
        migrateResult={db.migrateResult}
        deletingSchema={db.deletingSchema}
        onDeleteSchema={() => void db.handleDeleteSchema()}
        onClose={() => db.setMigrateOpen(false)}
      />
    </div>
  );
}
