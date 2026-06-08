"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useScenariosQuery, useScenarioMutations } from "@/queries/scenarios";
import { useProjectMutations } from "@/queries/projects";
import { useDashboard } from "../shared/dashboard-context";
import { ScenarioCard } from "@/components/scenarios/scenario-card";
import { EmptyState, LoadingCard } from "@/components/built";
import type { ScenarioSummary, LoadScenarioResult, ScenarioCardHandlers } from "@/types/scenarios";

export function ScenariosPageContent() {
  const router = useRouter();
  const scenariosQuery = useScenariosQuery();
  const { invalidate: invalidateScenarios, load, reload } = useScenarioMutations();
  const { invalidate: invalidateProjects, delete: deleteProject } = useProjectMutations();
  const { setActiveProjectId } = useDashboard();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const scenarios = (scenariosQuery.data ?? []) as ScenarioSummary[];
  const basic = scenarios.filter((s) => s.category === "basic");
  const advanced = scenarios.filter((s) => s.category === "advanced");

  const openProject = (projectId: string) => {
    setActiveProjectId(projectId);
    router.push("/tables");
  };

  const failed = (scenarioId: string, message: string) => {
    setBusyId(null);
    setError({ id: scenarioId, message });
  };

  const onCreated = (res: LoadScenarioResult | undefined) => {
    void invalidateScenarios();
    void invalidateProjects();
    setBusyId(null);
    if (res) openProject(res.projectId);
  };

  const handleLoad = (scenarioId: string, name: string) => {
    setBusyId(scenarioId);
    setError(null);
    load.mutate(
      { scenarioId, projectName: name },
      { onSuccess: onCreated, onError: (err) => failed(scenarioId, err.message) },
    );
  };

  const handleReload = (scenarioId: string) => {
    setBusyId(scenarioId);
    setError(null);
    reload.mutate(
      { scenarioId },
      { onSuccess: onCreated, onError: (err) => failed(scenarioId, err.message) },
    );
  };

  const handleRemove = (scenarioId: string, projectId: string) => {
    setBusyId(scenarioId);
    setError(null);
    deleteProject.mutate(
      { id: projectId },
      {
        onSuccess: () => {
          void invalidateScenarios();
          void invalidateProjects();
          setBusyId(null);
        },
        onError: (err) => failed(scenarioId, err.message),
      },
    );
  };

  const handlers: ScenarioCardHandlers = {
    onLoad: handleLoad,
    onReload: handleReload,
    onRemove: handleRemove,
    onOpen: openProject,
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/15 px-5 py-4">
        <div className="flex items-start gap-3.5">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          <div className="space-y-1.5">
            <p className="text-base font-bold uppercase tracking-[0.1em] text-amber-200">
              These projects require a PostgreSQL or MySQL database
            </p>
            <p className="text-sm leading-relaxed text-amber-100/90">
              The scenarios below target <span className="font-semibold">PostgreSQL</span> and{" "}
              <span className="font-semibold">MySQL</span>. You can design and explore the schema
              without a database, but to run migrations or push data you need one running. A{" "}
              <code className="rounded bg-amber-500/25 px-1 py-0.5 font-mono text-xs text-amber-100">
                database.compose.yaml
              </code>{" "}
              is included at the project root — start the databases with{" "}
              <code className="rounded bg-amber-500/25 px-1 py-0.5 font-mono text-xs text-amber-100">
                docker compose -f database.compose.yaml up
              </code>
              .
            </p>
            <p className="text-xs leading-relaxed text-amber-200/80">
              Postgres →{" "}
              <code className="font-mono text-amber-100">postgresql://dev:dev@localhost:54321/dev</code>{" "}
              · MySQL →{" "}
              <code className="font-mono text-amber-100">mysql://dev:dev@localhost:54322/dev</code>
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Main Window
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">Scenarios</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Spin up a fully-designed example schema in a brand-new project, then walk it through the
            workflows in the sidebar to learn the app by example. <span className="font-semibold text-foreground">Basic</span>{" "}
            scenarios are a single version; <span className="font-semibold text-foreground">advanced</span>{" "}
            scenarios ship multiple versions (always starting at v1). Once you load a scenario, use{" "}
            <span className="font-semibold text-foreground">Re-load</span> to reset it, or the trash icon to remove it.
          </p>
        </div>

        <div className="space-y-6 p-5">
          {scenariosQuery.isLoading ? (
            <LoadingCard message="Loading scenarios…" />
          ) : scenarios.length === 0 ? (
            <EmptyState message="No scenarios are available." />
          ) : (
            <>
              <ScenarioGroup
                title="Basic"
                description="Single-version schemas — a quick, complete model to explore."
                scenarios={basic}
                busyId={busyId}
                error={error}
                handlers={handlers}
              />
              <ScenarioGroup
                title="Advanced"
                description="Multi-version schemas that evolve from v1 — built for Tracking & Migrations."
                scenarios={advanced}
                busyId={busyId}
                error={error}
                handlers={handlers}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ScenarioGroup({
  title,
  description,
  scenarios,
  busyId,
  error,
  handlers,
}: {
  title: string;
  description: string;
  scenarios: ScenarioSummary[];
  busyId: string | null;
  error: { id: string; message: string } | null;
  handlers: ScenarioCardHandlers;
}) {
  if (scenarios.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <h4 className="text-sm font-bold uppercase tracking-[0.14em] text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            busy={busyId === scenario.id}
            anyBusy={busyId !== null}
            errorMessage={error?.id === scenario.id ? error.message : ""}
            handlers={handlers}
          />
        ))}
      </div>
    </div>
  );
}
