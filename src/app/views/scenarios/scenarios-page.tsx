"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useScenariosQuery, useScenarioMutations } from "@/queries/scenarios";
import { useProjectMutations } from "@/queries/projects";
import { useDashboard } from "../shared/dashboard-context";
import { classNames } from "@/lib/utils";
import { EmptyState, InlineError, LoadingCard } from "@/components/built";

type ScenarioSummary = {
  id: string;
  title: string;
  category: "basic" | "advanced";
  provider: string;
  accent: string;
  summary: string;
  highlights: string[];
  exploreNext: { label: string; href: string }[];
  tableCount: number;
  fieldCount: number;
  relationCount: number;
  enumCount: number;
  versionCount: number;
  loaded: { projectId: string; projectName: string } | null;
};

type LoadResult = { projectId: string; projectName: string; version: string } | undefined;

export function ScenariosPageContent() {
  const router = useRouter();
  const scenariosQuery = useScenariosQuery();
  const { invalidate: invalidateScenarios, load, reload } = useScenarioMutations();
  const { invalidate: invalidateProjects } = useProjectMutations();
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

  const afterLoad = (res: LoadResult) => {
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
      {
        onSuccess: (res) => afterLoad(res),
        onError: (err) => {
          setBusyId(null);
          setError({ id: scenarioId, message: err.message });
        },
      },
    );
  };

  const handleReload = (scenarioId: string) => {
    setBusyId(scenarioId);
    setError(null);
    reload.mutate(
      { scenarioId },
      {
        onSuccess: (res) => afterLoad(res),
        onError: (err) => {
          setBusyId(null);
          setError({ id: scenarioId, message: err.message });
        },
      },
    );
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
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Spin up a fully-designed example schema in a brand-new project, then walk it through the
            workflows in the sidebar to learn the app by example. <span className="font-semibold text-foreground">Basic</span>{" "}
            scenarios are a single version; <span className="font-semibold text-foreground">advanced</span>{" "}
            scenarios ship multiple versions (always starting at v1) so you can explore the Tracking
            and Migrations flows. Once you load a scenario it&apos;s disabled — use{" "}
            <span className="font-semibold text-foreground">Re-load</span> to reset it if you change things.
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
                onLoad={handleLoad}
                onReload={handleReload}
                onOpen={openProject}
              />
              <ScenarioGroup
                title="Advanced"
                description="Multi-version schemas that evolve from v1 — built for Tracking & Migrations."
                scenarios={advanced}
                busyId={busyId}
                error={error}
                onLoad={handleLoad}
                onReload={handleReload}
                onOpen={openProject}
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
  onLoad,
  onReload,
  onOpen,
}: {
  title: string;
  description: string;
  scenarios: ScenarioSummary[];
  busyId: string | null;
  error: { id: string; message: string } | null;
  onLoad: (scenarioId: string, name: string) => void;
  onReload: (scenarioId: string) => void;
  onOpen: (projectId: string) => void;
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
            onLoad={onLoad}
            onReload={onReload}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  busy,
  anyBusy,
  errorMessage,
  onLoad,
  onReload,
  onOpen,
}: {
  scenario: ScenarioSummary;
  busy: boolean;
  anyBusy: boolean;
  errorMessage: string;
  onLoad: (scenarioId: string, name: string) => void;
  onReload: (scenarioId: string) => void;
  onOpen: (projectId: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirmReload, setConfirmReload] = useState(false);

  const isLoaded = scenario.loaded !== null;

  const openForm = () => {
    setFormOpen(true);
    setName(`${scenario.title} Demo`);
  };

  const submit = () => {
    if (name.trim().length < 8) return;
    onLoad(scenario.id, name.trim());
  };

  return (
    <div
      className={classNames(
        "flex flex-col rounded-lg border bg-background",
        isLoaded ? "border-emerald-500/40" : "border-border",
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={classNames("h-2.5 w-2.5 rounded-full", scenario.accent)} />
            <h4 className="text-base font-semibold text-foreground">{scenario.title}</h4>
          </div>
          <div className="flex items-center gap-1.5">
            {isLoaded && (
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                Loaded
              </span>
            )}
            <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {scenario.provider}
            </span>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <CountChip label="tables" value={scenario.tableCount} />
          <CountChip label="fields" value={scenario.fieldCount} />
          <CountChip label="relations" value={scenario.relationCount} />
          <CountChip label="enums" value={scenario.enumCount} />
          {scenario.versionCount > 1 && <CountChip label="versions" value={scenario.versionCount} />}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{scenario.summary}</p>

        <ul className="space-y-1.5">
          {scenario.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              After loading
            </span>
            {scenario.exploreNext.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[12px] font-medium text-cyan-400 underline-offset-2 hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {isLoaded ? (
            <div className="space-y-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-200">
                Loaded as{" "}
                <span className="font-semibold">{scenario.loaded!.projectName}</span>
              </p>
              {confirmReload ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-amber-200">
                    Re-loading discards any changes and resets this project to the original scenario.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onReload(scenario.id)}
                      disabled={busy}
                      className="h-9 flex-1 rounded-md bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      {busy ? "Resetting…" : "Confirm re-load"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReload(false)}
                      disabled={busy}
                      className="h-9 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpen(scenario.loaded!.projectId)}
                    disabled={anyBusy}
                    className="h-9 flex-1 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-muted"
                  >
                    Open project
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReload(true)}
                    disabled={anyBusy}
                    className="h-9 rounded-md border border-amber-500/40 bg-card px-4 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/15 disabled:cursor-not-allowed"
                  >
                    Re-load
                  </button>
                </div>
              )}
              <InlineError message={errorMessage} />
            </div>
          ) : formOpen ? (
            <div className="space-y-2 rounded-md border border-border bg-card p-3">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                New project name
              </label>
              <input
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setFormOpen(false);
                }}
                placeholder="At least 8 characters, unique"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-500"
              />
              <InlineError message={errorMessage} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || name.trim().length < 8}
                  className="h-9 flex-1 rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  {busy ? "Creating…" : "Create project"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={busy}
                  className="h-9 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openForm}
              disabled={anyBusy}
              className="h-10 w-full rounded-md border border-cyan-500/40 bg-card px-5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Load as demo project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  );
}
