"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useScenariosQuery, useLoadScenarioMutation } from "@/queries/scenarios";
import { useProjectMutations } from "@/queries/projects";
import { useDashboard } from "../shared/dashboard-context";
import { classNames } from "@/lib/utils";
import { EmptyState, InlineError, LoadingCard } from "@/components/built";

type ScenarioSummary = {
  id: string;
  title: string;
  provider: string;
  accent: string;
  summary: string;
  highlights: string[];
  exploreNext: { label: string; href: string }[];
  tableCount: number;
  fieldCount: number;
  relationCount: number;
  enumCount: number;
};

export function ScenariosPageContent() {
  const router = useRouter();
  const scenariosQuery = useScenariosQuery();
  const loadMutation = useLoadScenarioMutation();
  const { invalidate: invalidateProjects } = useProjectMutations();
  const { setActiveProjectId } = useDashboard();

  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const scenarios = (scenariosQuery.data ?? []) as ScenarioSummary[];

  const openForm = (scenario: ScenarioSummary) => {
    setOpenId(scenario.id);
    setName(`${scenario.title} Demo`);
    setError("");
  };

  const closeForm = () => {
    setOpenId(null);
    setName("");
    setError("");
  };

  const submit = (scenario: ScenarioSummary) => {
    const trimmed = name.trim();
    if (trimmed.length < 8) {
      setError("Project name must be at least 8 characters.");
      return;
    }
    setError("");
    setPendingId(scenario.id);
    loadMutation.mutate(
      { scenarioId: scenario.id, projectName: trimmed },
      {
        onSuccess: (result) => {
          void invalidateProjects();
          setPendingId(null);
          closeForm();
          if (result) {
            setActiveProjectId(result.projectId);
            router.push("/tables");
          }
        },
        onError: (err) => {
          setPendingId(null);
          setError(err.message ?? "Could not load scenario.");
        },
      },
    );
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Main Window
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground">Scenarios</h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Spin up a fully-designed example schema in a brand-new project. Each scenario is a
            realistic, ready-to-explore data model — load one, then walk it through the workflows
            in the sidebar to learn the app by example. Loading a scenario never touches your
            existing projects.
          </p>
        </div>

        <div className="p-5">
          {scenariosQuery.isLoading ? (
            <LoadingCard message="Loading scenarios…" />
          ) : scenarios.length === 0 ? (
            <EmptyState message="No scenarios are available." />
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {scenarios.map((scenario) => {
                const isOpen = openId === scenario.id;
                const isPending = pendingId === scenario.id;

                return (
                  <div
                    key={scenario.id}
                    className="flex flex-col rounded-lg border border-border bg-background"
                  >
                    <div className="border-b border-border px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className={classNames("h-2.5 w-2.5 rounded-full", scenario.accent)} />
                          <h4 className="text-base font-semibold text-foreground">{scenario.title}</h4>
                        </div>
                        <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {scenario.provider}
                        </span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <CountChip label="tables" value={scenario.tableCount} />
                        <CountChip label="fields" value={scenario.fieldCount} />
                        <CountChip label="relations" value={scenario.relationCount} />
                        <CountChip label="enums" value={scenario.enumCount} />
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-4 px-4 py-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {scenario.summary}
                      </p>

                      <ul className="space-y-1.5">
                        {scenario.highlights.map((highlight) => (
                          <li
                            key={highlight}
                            className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground"
                          >
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

                        {isOpen ? (
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
                                if (e.key === "Enter") submit(scenario);
                                if (e.key === "Escape") closeForm();
                              }}
                              placeholder="At least 8 characters, unique"
                              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-500"
                            />
                            <InlineError message={error} />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => submit(scenario)}
                                disabled={isPending}
                                className="h-9 flex-1 rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-muted"
                              >
                                {isPending ? "Creating…" : "Create project"}
                              </button>
                              <button
                                type="button"
                                onClick={closeForm}
                                disabled={isPending}
                                className="h-9 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openForm(scenario)}
                            className="h-10 w-full rounded-md border border-cyan-500/40 bg-card px-5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15"
                          >
                            Load as demo project
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
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
