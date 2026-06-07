"use client";

import { useState } from "react";
import { useImportMutations } from "@/queries/imports";
import { ImportInfoLegend } from "./import-info-legend";
import { ImportConnectionCard } from "./import-connection-card";
import { ImportCompatibilityReport } from "./import-compatibility-report";
import type { ImportReport } from "@/types/imports";

type Analysis = { report: ImportReport; provider: string; schema: string };

/**
 * "Import from a database" flow inside the Imports workspace: paste a connection URL → introspect +
 * fidelity-check → review → name and create a *fresh* project (no pre-existing project, no
 * provider-match). The project keeps the raw `.prisma` as the original; its canonical version is the
 * working schema.
 */
export function DatabaseImportSection() {
  const { analyzeDatabaseImportFromUrl, importFromDatabase } = useImportMutations();
  const [url, setUrl] = useState("");
  const [analyzeError, setAnalyzeError] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [projectName, setProjectName] = useState("");
  const [result, setResult] = useState("");
  const [importError, setImportError] = useState("");

  const handleAnalyze = async () => {
    setAnalyzeError(""); setResult(""); setImportError(""); setAnalysis(null);
    try {
      const data = await analyzeDatabaseImportFromUrl.mutateAsync({ url: url.trim() });
      setAnalysis({ report: data.report, provider: data.provider, schema: data.schema });
      setProjectName(data.suggestedName ?? "");
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Could not read the database schema.");
    }
  };

  const handleImport = async () => {
    if (!analysis) return;
    setImportError(""); setResult("");
    try {
      const data = await importFromDatabase.mutateAsync({ projectName: projectName.trim(), content: analysis.schema });
      setResult(`Created "${data.projectName}" with version-0 (original) and ${data.rulesVersion} (rules applied) — ${data.stats.tableCount} tables in the rules version. Switch projects to open it.`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    }
  };

  return (
    <div className="space-y-4">
      <ImportInfoLegend />
      <ImportConnectionCard
        url={url}
        onUrlChange={setUrl}
        onAnalyze={() => void handleAnalyze()}
        isAnalyzing={analyzeDatabaseImportFromUrl.isPending}
        analyzeError={analyzeError}
      />
      {analysis && (
        <ImportCompatibilityReport
          report={analysis.report}
          provider={analysis.provider}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          isImporting={importFromDatabase.isPending}
          onImport={() => void handleImport()}
          resultMessage={result}
          errorMessage={importError}
        />
      )}
    </div>
  );
}
