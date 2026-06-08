import "server-only";
import { db } from "@/lib/db/client";
import {
  createImportedProject,
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

const SCENARIO_VERSION = "1.0111";

export type ScenarioSummary = {
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

const prismaToProviderLabel: Record<ScenarioBlueprint["prismaProvider"], string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

function summarize(blueprint: ScenarioBlueprint): ScenarioSummary {
  const { models, enums } = blueprint.store;
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
    provider: prismaToProviderLabel[blueprint.prismaProvider],
    accent: blueprint.accent,
    summary: blueprint.summary,
    highlights: blueprint.highlights,
    exploreNext: blueprint.exploreNext,
    tableCount: models.length,
    fieldCount,
    relationCount,
    enumCount: enums.length,
  };
}

export function listScenarios(): ScenarioSummary[] {
  return SCENARIO_BLUEPRINTS.map(summarize);
}

// Mirror of the import flow's `syncModelStore`: after writing the normalized
// schema_* tables, derive the canonical store back so the legacy read path
// (`readModelStore` in schema-store) sees identical data.
function syncModelStore(projectId: string, projectName: string, versionName: string): void {
  const graph = readProjectVersionGraph(projectName, versionName);
  const store = graphToCanonicalStore(graph);
  db.prepare(
    "INSERT OR REPLACE INTO model_stores (project_id, version, content, updated_at) VALUES (?, ?, ?, ?)",
  ).run(projectId, versionName, JSON.stringify(store), new Date().toISOString());
}

export type LoadScenarioResult = {
  projectId: string;
  projectName: string;
  version: string;
};

/**
 * Create a fresh project seeded with a scenario's schema. Uses the same
 * canonical-store → normalized-schema migration path as a legacy project load,
 * then re-syncs the model store so both read paths agree.
 */
export async function loadScenario(
  scenarioId: string,
  requestedName: string,
): Promise<LoadScenarioResult> {
  const blueprint = findBlueprint(scenarioId);
  if (!blueprint) throw new Error("Unknown scenario.");

  const { project } = await createImportedProject(
    requestedName,
    blueprint.prismaProvider,
    SCENARIO_VERSION,
  );

  // Build the normalized schema graph from the authored canonical store. This is
  // transaction-wrapped inside the helper.
  replaceNormalizedSchemaFromCanonicalStore(project.name, SCENARIO_VERSION, {
    ...blueprint.store,
    projectName: project.name,
    projectVersion: SCENARIO_VERSION,
  });

  syncModelStore(project.id, project.name, SCENARIO_VERSION);
  await refreshProjectStats(project.name);

  return { projectId: project.id, projectName: project.name, version: SCENARIO_VERSION };
}
