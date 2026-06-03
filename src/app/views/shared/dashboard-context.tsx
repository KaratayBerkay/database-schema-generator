"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useProjectsQuery } from "@/queries/projects";
import { isOriginalVersion, defaultWorkingVersion } from "@/lib/version-rules";
import type { SchemaOptions } from "@/types/projects";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardContextValue = {
  // UI state only — no project data / no API calls
  activeProjectId: string;
  selectedVersion: string;
  selectedVersions: Record<string, string>;
  setActiveProjectId: (projectId: string) => void;
  setSelectedVersion: (version: string) => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const DashboardContext = createContext<DashboardContextValue | null>(null);

async function persistActiveProject(projectId: string) {
  await fetch("/api/ui-state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activeProjectId: projectId }),
  }).catch(() => {/* best-effort */});
}

async function persistVersion(projectId: string, version: string) {
  await fetch("/api/ui-state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, version }),
  }).catch(() => {/* best-effort */});
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DashboardProvider({
  children,
  initialProjectId,
  initialVersionsMap = {},
}: {
  children: ReactNode;
  initialProjectId?: string;
  initialVersionsMap?: Record<string, string>;
}) {
  const { data: projects = [] } = useProjectsQuery();

  const [activeProjectId, setActiveProjectIdState] = useState<string>(
    initialProjectId ?? projects[0]?.id ?? "",
  );

  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>(() => {
    const fromServer: Record<string, string> = { ...initialVersionsMap };
    for (const p of projects) {
      // Never default to (or keep a persisted) version-0 — it's read-only.
      const persisted = fromServer[p.id];
      if (!persisted || isOriginalVersion(persisted)) {
        fromServer[p.id] = defaultWorkingVersion(p.versions.map((v) => v.name)) ?? "1.0111";
      }
    }
    return fromServer;
  });

  const setActiveProjectId = useCallback((projectId: string) => {
    setActiveProjectIdState(projectId);
    void persistActiveProject(projectId);
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );

  const rawSelected = activeProject ? selectedVersions[activeProject.id] : undefined;
  const selectedVersion =
    (rawSelected && !isOriginalVersion(rawSelected) ? rawSelected : undefined) ??
    defaultWorkingVersion(activeProject?.versions.map((v) => v.name) ?? []) ??
    "No version";

  const setSelectedVersion = useCallback(
    (version: string) => {
      if (!activeProject) return;
      // version-0 is the read-only imported original — not selectable as a working version.
      if (isOriginalVersion(version)) return;
      setSelectedVersions((cur) => ({ ...cur, [activeProject.id]: version }));
      void persistVersion(activeProject.id, version);
    },
    [activeProject],
  );

  return (
    <DashboardContext.Provider
      value={{
        activeProjectId: activeProject?.id ?? activeProjectId,
        selectedVersion,
        selectedVersions,
        setActiveProjectId,
        setSelectedVersion,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error("useDashboard must be used within DashboardProvider");
  return context;
}

// ─── Derived hook — gives callers the active project from tRPC cache ──────────

export function useActiveProject() {
  const { data: projects = [] } = useProjectsQuery();
  const { activeProjectId } = useDashboard();
  return useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0] ?? null,
    [activeProjectId, projects],
  );
}

// Re-export SchemaOptions so callers that previously imported from here still compile.
export type { SchemaOptions };
