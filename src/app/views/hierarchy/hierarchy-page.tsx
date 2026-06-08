"use client";

import { useMemo } from "react";
import { useHierarchyQuery } from "@/queries/hierarchy";
import { classNames } from "@/lib/utils";
import { useProjectInfo } from "../shared/project-info-context";
import { EmptyState } from "@/components/built";

type HierarchyResponse = {
  order: {
    tableId: string;
    modelName: string;
    dbName: string;
    parentCount: number;
  }[];
  edges: {
    relationId: string;
    name: string;
    sourceModel: string;
    targetModel: string;
    cardinality: string;
    fieldPairs: { sourceField: string; targetField: string }[];
  }[];
  tableCount: number;
  relationCount: number;
};

export function HierarchyPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();
  const hierarchyQuery = useHierarchyQuery(projectName, version);

  const data = hierarchyQuery.data as HierarchyResponse | undefined;
  const maxParentCount = useMemo(
    () => Math.max(...(data?.order.map((item) => item.parentCount) ?? [0]), 1),
    [data?.order],
  );

  if (!hasProject) {
    return <EmptyState message="Select a project to review hierarchy." />;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Hierarchy
              </p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                Dependency Order
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {projectName}
              </span>
              <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {version}
              </span>
              {data && (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                  {data.tableCount} tables / {data.relationCount} relations
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="border-b border-border p-5 xl:border-b-0 xl:border-r">
            {hierarchyQuery.isLoading && (
              <div className="rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                Loading hierarchy...
              </div>
            )}

            {hierarchyQuery.error && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/15 px-4 py-3">
                <p className="text-sm font-semibold text-rose-300">
                  {hierarchyQuery.error.message}
                </p>
              </div>
            )}

            {data && data.order.length === 0 && (
              <EmptyState message="No tables found for this version." />
            )}

            {data && data.order.length > 0 && (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-background px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Migration execution order
                  </p>
                  <p className="mt-2 font-mono text-sm text-foreground">
                    {data.order.map((item) => item.modelName).join(" -> ")}
                  </p>
                </div>

                <div className="overflow-hidden rounded-md border border-border">
                  <div className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(90px,32%)_6rem] items-center gap-4 border-b border-border bg-background px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <span>#</span>
                    <span>Table</span>
                    <span>Parent Count</span>
                    <span className="text-right">Deps</span>
                  </div>
                  {data.order.map((item, index) => (
                    <div
                      key={item.tableId}
                      className="grid grid-cols-[3rem_minmax(0,1fr)_minmax(90px,32%)_6rem] items-center gap-4 border-b border-border px-4 py-3 last:border-0 hover:bg-background"
                    >
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{item.modelName}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{item.dbName}</p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max((item.parentCount / maxParentCount) * 100, item.parentCount > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-xs font-semibold text-muted-foreground">
                        {item.parentCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="p-5">
            <div className="rounded-md border border-border bg-card">
              <div className="border-b border-border bg-background px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Relation Edges</p>
              </div>
              <div className="max-h-[560px] overflow-y-auto divide-y divide-slate-100">
                {data && data.edges.length === 0 && (
                  <p className="px-4 py-5 text-sm text-muted-foreground">
                    No relations found. Migration order follows table order.
                  </p>
                )}
                {data?.edges.map((edge) => (
                  <div key={edge.relationId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {edge.sourceModel} -&gt; {edge.targetModel}
                        </p>
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          {edge.name || "unnamed relation"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                        {edge.cardinality}
                      </span>
                    </div>
                    {edge.fieldPairs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {edge.fieldPairs.map((pair, index) => (
                          <span
                            key={`${pair.sourceField}-${pair.targetField}-${index}`}
                            className={classNames(
                              "rounded bg-muted px-2 py-1 font-mono text-[11px]",
                              pair.sourceField && pair.targetField ? "text-muted-foreground" : "text-muted-foreground",
                            )}
                          >
                            {pair.sourceField || "?"} -&gt; {pair.targetField || "?"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
