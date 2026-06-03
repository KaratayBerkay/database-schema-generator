"use client";

import { useState } from "react";
import { useHistoryQuery } from "@/queries/history";
import { useDashboard } from "../shared/dashboard-context";
import { useProjectInfo } from "../shared/project-info-context";
import type { VersionHistory } from "@/types/history";
import { VersionAccordion } from "@/components/history/version-accordion";

export function HistoryPageContent() {
  const { setSelectedVersion } = useDashboard();
  const { projectId: activeProjectId, projectName, version: selectedVersion, hasProject } = useProjectInfo();
  const historyQuery = useHistoryQuery(activeProjectId);
  const versions: VersionHistory[] = (historyQuery.data?.versions ?? []) as VersionHistory[];

  // Open state is derived: a version is open when the user has overridden it,
  // otherwise the active version is open by default (and follows version switches).
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const isOpen = (name: string) => (overrides.has(name) ? overrides.get(name)! : name === selectedVersion);
  const toggle = (name: string) =>
    setOverrides((prev) => {
      const currentlyOpen = prev.has(name) ? prev.get(name)! : name === selectedVersion;
      const next = new Map(prev);
      next.set(name, !currentlyOpen);
      return next;
    });

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to view its version history.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">
                Version History
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
                {projectName}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {versions.length} {versions.length === 1 ? "version" : "versions"}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5">
          {historyQuery.isLoading ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500">
              Loading history…
            </div>
          ) : versions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <p className="text-sm font-medium text-slate-500">No version history found for this project.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <VersionAccordion
                  key={v.name}
                  version={v}
                  isActive={v.name === selectedVersion}
                  isOpen={isOpen(v.name)}
                  onToggle={() => toggle(v.name)}
                  onUse={() => setSelectedVersion(v.name)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
