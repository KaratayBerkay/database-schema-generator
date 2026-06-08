"use client";

import { classNames } from "@/lib/utils";
import { useImportMutations } from "@/queries/imports";
import { useImportsPageState } from "@/hooks/use-imports-page-state";
import { todayVersionName, parsePicklePreview } from "@/constants/imports";
import { VersionImportTab } from "@/components/imports/version-import-tab";
import { ProjectImportTab } from "@/components/imports/project-import-tab";
import { DatabaseImportSection } from "@/components/imports/database-import-section";

export function ImportsPageContent() {
  const {
    mode, setMode,
    vFile, setVFile, vPreview, setVPreview, vParseError, setVParseError,
    vProjectName, setVProjectName, vVersionName, setVVersionName,
    pFile, setPFile, pPreview, setPPreview, pParseError, setPParseError,
    pProjectName, setPProjectName,
    result, setResult, error, setError,
    resetVersion, resetProject,
  } = useImportsPageState();

  const { importVersion: importVersionMutation, importProject: importProjectMutation } = useImportMutations();

  const handleVersionFile = (name: string, content: string) => {
    setError(""); setResult(""); setVParseError("");
    try {
      const preview = parsePicklePreview(content);
      if (preview.type !== "version") { setVParseError("This is a Project pickle. Switch to the 'Import Project' tab."); return; }
      setVFile({ name, content }); setVPreview(preview);
      setVProjectName(preview.sourceProjectName); setVVersionName(todayVersionName());
    } catch (err) { setVParseError(err instanceof Error ? err.message : "Could not parse file."); }
  };

  const handleProjectFile = (name: string, content: string) => {
    setError(""); setResult(""); setPParseError("");
    try {
      const preview = parsePicklePreview(content);
      if (preview.type !== "project") { setPParseError("This is a Version pickle. Switch to the 'Import Version' tab."); return; }
      setPFile({ name, content }); setPPreview(preview); setPProjectName(preview.sourceProjectName);
    } catch (err) { setPParseError(err instanceof Error ? err.message : "Could not parse file."); }
  };

  const handleImportVersion = async () => {
    if (!vFile) return;
    setError(""); setResult("");
    try {
      const data = await importVersionMutation.mutateAsync({ content: vFile.content, projectName: vProjectName || undefined, versionName: vVersionName || undefined });
      const s = data?.stats;
      setResult(`Imported version "${data?.versionName ?? ""}" — ${s?.tableCount ?? 0} tables, ${s?.fieldCount ?? 0} fields, ${s?.relationCount ?? 0} relations, ${s?.enumCount ?? 0} enums.`);
      resetVersion();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
  };

  const handleImportProject = async () => {
    if (!pFile) return;
    setError(""); setResult("");
    try {
      const data = await importProjectMutation.mutateAsync({ content: pFile.content, projectName: pProjectName || undefined });
      const totalTables = data?.stats?.reduce((n, s) => n + s.tableCount, 0) ?? 0;
      setResult(`Imported project "${data?.projectName ?? ""}" — ${data?.versionCount ?? 0} versions, ${totalTables} total tables.`);
      resetProject();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Main Window</p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">Imports workspace</h3>
        </div>

        <div className="flex border-b border-border">
          {(["version", "project"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => { setMode(tab); setError(""); setResult(""); }}
              className={classNames(
                "flex-1 px-4 py-3 text-sm font-semibold transition",
                mode === tab ? "border-b-2 border-lime-600 text-lime-700" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "version" ? "Import Version" : "Import Project"}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-300">{error}</div>
          )}
          {result && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-300">{result}</div>
          )}

          {mode === "version" && (
            <VersionImportTab
              file={vFile}
              preview={vPreview}
              parseError={vParseError}
              projectName={vProjectName}
              versionName={vVersionName}
              isImporting={importVersionMutation.isPending}
              canImport={!!vFile && !importVersionMutation.isPending && vProjectName.trim().length >= 8}
              onFileSelect={handleVersionFile}
              onProjectNameChange={setVProjectName}
              onVersionNameChange={setVVersionName}
              onChangeFile={() => { setVFile(null); setVPreview(null); setVParseError(""); }}
              onImport={() => void handleImportVersion()}
            />
          )}

          {mode === "project" && (
            <ProjectImportTab
              file={pFile}
              preview={pPreview}
              parseError={pParseError}
              projectName={pProjectName}
              isImporting={importProjectMutation.isPending}
              canImport={!!pFile && !importProjectMutation.isPending && pProjectName.trim().length >= 8}
              onFileSelect={handleProjectFile}
              onProjectNameChange={setPProjectName}
              onChangeFile={() => { setPFile(null); setPPreview(null); setPParseError(""); }}
              onImport={() => void handleImportProject()}
            />
          )}
        </div>
      </section>

      <DatabaseImportSection />

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">File Format</p>
          <h3 className="mt-1 text-base font-semibold text-foreground">Accepted pickle types</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-indigo-500/25 bg-indigo-500/15 p-3">
              <span className="text-xs font-bold uppercase tracking-wide text-indigo-300">Version Pickle</span>
              <p className="mt-1 text-sm text-muted-foreground">
                A snapshot of a single project version — tables, fields, relations, restrictions and enums.
                Generated from <strong>Exports → Version Pickle</strong>.
              </p>
            </div>
            <div className="rounded-lg border border-orange-500/25 bg-orange-500/15 p-3">
              <span className="text-xs font-bold uppercase tracking-wide text-orange-300">Project Pickle</span>
              <p className="mt-1 text-sm text-muted-foreground">
                A full project backup containing every version.
                Generated from <strong>Exports → Project Pickle</strong>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
