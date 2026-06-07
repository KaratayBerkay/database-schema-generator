import { api, PROJECT_NAME } from "../../client";

// Restriction mutations for v3.
//
// Schema warnings produced (v2→v3):
//   Sprint UNIQUE([name, projectId]) added → restriction.unique_added, lossy_convert
//
// Diff badges only (no schema warnings):
//   Task INDEX([priority]) removed          → restriction.index_removed, info
//   Article INDEX([wordCount]) added        → restriction.index_added, info
//   Comment INDEX([createdAt]) removed      → restriction.index_removed, info  (added in v2)

async function findRestriction(
  version: string,
  modelName: string,
  type: "UNIQUE" | "INDEX",
  fields: string[],
) {
  const res = await api.restrictions.list({ projectName: PROJECT_NAME, version, modelName });
  return res?.restrictions.find(
    (r) => r.type === type && r.fields.join(",") === fields.join(","),
  );
}

export async function mutateRestrictions(version: string) {
  // ── Add UNIQUE([name, projectId]) to Sprint ───────────────────────────────
  const existingUniq = await findRestriction(version, "Sprint", "UNIQUE", ["name", "projectId"]);
  if (!existingUniq) {
    await api.restrictions.create({
      projectName: PROJECT_NAME, version,
      modelName: "Sprint",
      type: "UNIQUE",
      fields: ["name", "projectId"],
      dbName: "uq_sprint_name_project",
    });
    console.log("  ✓ Sprint UNIQUE([name, projectId]) added (unique_added → lossy_convert)");
  } else {
    console.log("  ✓ Sprint UNIQUE([name, projectId]) already exists — skipping.");
  }

  // ── Remove INDEX([priority]) from Task ────────────────────────────────────
  const priorityIdx = await findRestriction(version, "Task", "INDEX", ["priority"]);
  if (priorityIdx) {
    await api.restrictions.delete({
      projectName: PROJECT_NAME, version,
      modelName: "Task",
      restrictionKey: priorityIdx.key,
    });
    console.log("  ✓ Task INDEX([priority]) removed (index_removed, diff badge only)");
  } else {
    console.log("  ✓ Task INDEX([priority]) already removed — skipping.");
  }

  // ── Add INDEX([wordCount]) to Article ─────────────────────────────────────
  const wordCountIdx = await findRestriction(version, "Article", "INDEX", ["wordCount"]);
  if (!wordCountIdx) {
    await api.restrictions.create({
      projectName: PROJECT_NAME, version,
      modelName: "Article",
      type: "INDEX",
      fields: ["wordCount"],
      dbName: "idx_article_word_count",
    });
    console.log("  ✓ Article INDEX([wordCount]) added (index_added, diff badge only)");
  } else {
    console.log("  ✓ Article INDEX([wordCount]) already exists — skipping.");
  }

  // ── Remove INDEX([createdAt]) from Comment (was added in v2) ─────────────
  const createdAtIdx = await findRestriction(version, "Comment", "INDEX", ["createdAt"]);
  if (createdAtIdx) {
    await api.restrictions.delete({
      projectName: PROJECT_NAME, version,
      modelName: "Comment",
      restrictionKey: createdAtIdx.key,
    });
    console.log("  ✓ Comment INDEX([createdAt]) removed (index_removed, diff badge only)");
  } else {
    console.log("  ✓ Comment INDEX([createdAt]) already removed — skipping.");
  }
}
