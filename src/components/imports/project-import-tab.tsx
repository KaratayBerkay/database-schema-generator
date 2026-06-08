"use client";

import { DropZone } from "@/components/imports/drop-zone";
import { VersionPreviewCard, ProviderBadge } from "@/components/imports/version-preview-card";
import type { ParsedPreview } from "@/types/imports";

type ProjectImportTabProps = {
  file: { name: string; content: string } | null;
  preview: ParsedPreview | null;
  parseError: string;
  projectName: string;
  isImporting: boolean;
  canImport: boolean;
  onFileSelect: (name: string, content: string) => void;
  onProjectNameChange: (v: string) => void;
  onChangeFile: () => void;
  onImport: () => void;
};

export function ProjectImportTab({
  file, preview, parseError, projectName,
  isImporting, canImport,
  onFileSelect, onProjectNameChange, onChangeFile, onImport,
}: ProjectImportTabProps) {
  if (!file) {
    return (
      <>
        <DropZone accept=".json" onFile={onFileSelect} label="Select a Project pickle file" />
        {parseError && <p className="mt-2 text-sm font-medium text-rose-300">{parseError}</p>}
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-orange-500/25 bg-orange-500/15 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-orange-300">
                Project Pickle
              </span>
              <ProviderBadge provider={preview?.provider ?? ""} />
              <span className="text-xs font-medium text-muted-foreground">
                {preview?.versionCount ?? 0} version{(preview?.versionCount ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="mt-1.5 max-w-xs truncate text-sm font-semibold text-foreground">{file.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              From <span className="font-semibold">{preview?.sourceProjectName}</span>
              {preview?.exportedAt ? ` · ${new Date(preview.exportedAt).toLocaleString()}` : ""}
            </p>
          </div>
          <button type="button" onClick={onChangeFile}
            className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">
            Change
          </button>
        </div>
        {preview && preview.versions.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {preview.versions.map((v) => <VersionPreviewCard key={v.name} stats={v} />)}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Import Options</p>
        <div className="max-w-sm">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Project name <span className="font-normal text-muted-foreground">(min 8 chars)</span>
          </label>
          <input value={projectName} onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder={preview?.sourceProjectName ?? "Project name"}
            className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-lime-500"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onImport} disabled={!canImport}
          className="h-9 rounded-md bg-lime-600 px-5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:cursor-not-allowed disabled:bg-muted">
          {isImporting ? "Importing..." : "Import Project"}
        </button>
      </div>
    </>
  );
}
