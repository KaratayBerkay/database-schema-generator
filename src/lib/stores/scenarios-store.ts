import "server-only";
import { db } from "@/lib/db/client";
import {
  createImportedProject,
  addImportedProjectVersion,
  deleteProject,
  refreshProjectStats,
} from "@/lib/stores/projects-store";
import {
  replaceNormalizedSchemaFromCanonicalStore,
  readProjectVersionGraph,
  graphToCanonicalStore,
} from "@/lib/schema-db/graph";
import {
  SCENARIO_BLUEPRINTS,
  findBlueprint,
  type ScenarioBlueprint,
} from "@/lib/scenarios/blueprints";
import type { ScenarioLoadedInfo, ScenarioSummary, LoadScenarioResult } from "@/types/scenarios";

export type { ScenarioLoadedInfo, ScenarioSummary, LoadScenarioResult };

const prismaToProviderLabel: Record<ScenarioBlueprint["prismaProvider"], string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

function summarize(blueprint: ScenarioBlueprint, loaded: ScenarioLoadedInfo | null): ScenarioSummary {
  // Counts describe the first (v1) version — the shape you land on after loading.
  const { models, enums } = blueprint.versions[0]!.store;
  // Owner relations only — back-references share the same relation, so counting
  // the FK-holding side avoids double-counting each link.
  const relationCount = models.reduce(
    (total, model) =>
      total + model.fields.filter((f) => (f.relation?.fields?.length ?? 0) > 0).length,
    0,
  );
  const fieldCount = models.reduce(
    (total, model) => total + model.fields.filter((f) => !f.relation).length,
    0,
  );

  return {
    id: blueprint.id,
    title: blueprint.title,
    category: blueprint.category,
    provider: prismaToProviderLabel[blueprint.prismaProvider],
    accent: blueprint.accent,
    summary: blueprint.summary,
    highlights: blueprint.highlights,
    exploreNext: blueprint.exploreNext,
    tableCount: models.length,
    fieldCount,
    relationCount,
    enumCount: enums.length,
    versionCount: blueprint.versions.length,
    loaded,
  };
}

// Scenario → existing project map. The JOIN guarantees we only report scenarios
// whose project still exists (the scenario_loads row also cascades on delete).
function loadedScenarioMap(): Map<string, ScenarioLoadedInfo> {
  const rows = db
    .prepare(
      `SELECT s.scenario_id AS scenarioId, s.project_id AS projectId, p.name AS projectName
       FROM scenario_loads s
       JOIN projects p ON p.id = s.project_id`,
    )
    .all() as { scenarioId: string; projectId: string; projectName: string }[];
  return new Map(rows.map((r) => [r.scenarioId, { projectId: r.projectId, projectName: r.projectName }]));
}

export function listScenarios(): ScenarioSummary[] {
  const loaded = loadedScenarioMap();
  return SCENARIO_BLUEPRINTS.map((b) => summarize(b, loaded.get(b.id) ?? null));
}

// Mirror of the import flow's `syncModelStore`: after writing the normalized
// schema_* tables, derive the canonical store back so the legacy read path
// (`readModelStore` in schema-store) sees identical data.
function syncModelStore(projectId: string, projectName: string, versionName: string): void {
  const graph = readProjectVersionGraph(projectName, versionName);
  const canonical = graphToCanonicalStore(graph);
  db.prepare(
    "INSERT OR REPLACE INTO model_stores (project_id, version, content, updated_at) VALUES (?, ?, ?, ?)",
  ).run(projectId, versionName, JSON.stringify(canonical), new Date().toISOString());
}

function recordLoad(scenarioId: string, projectId: string, projectName: string): void {
  db.prepare(
    "INSERT OR REPLACE INTO scenario_loads (scenario_id, project_id, project_name, loaded_at) VALUES (?, ?, ?, ?)",
  ).run(scenarioId, projectId, projectName, new Date().toISOString());
}

// Create the project and write every version's schema. Each version uses the same
// canonical-store → normalized-schema migration path as a legacy project load,
// then re-syncs the model store so both read paths agree.
async function buildProject(blueprint: ScenarioBlueprint, requestedName: string) {
  const [first, ...rest] = blueprint.versions;
  const { project } = await createImportedProject(requestedName, blueprint.prismaProvider, first!.name);

  for (const version of rest) {
    await addImportedProjectVersion(project.id, version.name);
  }

  for (const version of blueprint.versions) {
    replaceNormalizedSchemaFromCanonicalStore(project.name, version.name, {
      ...version.store,
      projectName: project.name,
      projectVersion: version.name,
    });
    syncModelStore(project.id, project.name, version.name);
  }

  await refreshProjectStats(project.name);
  return project;
}

/** Create a fresh project seeded with a scenario's schema (all versions). */
export async function loadScenario(
  scenarioId: string,
  requestedName: string,
): Promise<LoadScenarioResult> {
  const blueprint = findBlueprint(scenarioId);
  if (!blueprint) throw new Error("Unknown scenario.");

  if (loadedScenarioMap().has(scenarioId)) {
    throw new Error("This scenario is already loaded. Use Re-load to reset it.");
  }

  const project = await buildProject(blueprint, requestedName);
  recordLoad(scenarioId, project.id, project.name);

  return { projectId: project.id, projectName: project.name, version: blueprint.versions[0]!.name };
}

/**
 * Reset a scenario's loaded project to its pristine state: delete the existing
 * project (discarding any user edits) and recreate it from the blueprint under
 * the same name. Used by the per-card "Re-load" action.
 */
export async function reloadScenario(scenarioId: string): Promise<LoadScenarioResult> {
  const blueprint = findBlueprint(scenarioId);
  if (!blueprint) throw new Error("Unknown scenario.");

  const existing = loadedScenarioMap().get(scenarioId);
  if (!existing) throw new Error("This scenario is not loaded yet.");

  // Cascade also removes the scenario_loads row; we re-insert after rebuilding.
  await deleteProject(existing.projectId);

  const project = await buildProject(blueprint, existing.projectName);
  recordLoad(scenarioId, project.id, project.name);

  return { projectId: project.id, projectName: project.name, version: blueprint.versions[0]!.name };
}
