import { api, PROJECT_NAME } from "../../client";

// Restriction mutations for v2.
//
// Schema warnings produced (v1→v2):
//   TeamMember UNIQUE([accountId, teamId]) added → restriction.unique_added, lossy_convert
//
// Diff badges only (no schema warnings):
//   Account UNIQUE([username]) removed           → restriction.unique_removed, info
//   Task INDEX([status]) removed                 → restriction.index_removed, info
//   Comment INDEX([createdAt]) added             → restriction.index_added, info

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
  // ── Add UNIQUE([accountId, teamId]) to TeamMember ─────────────────────────
  const existingUniq = await findRestriction(version, "TeamMember", "UNIQUE", ["accountId", "teamId"]);
  if (!existingUniq) {
    await api.restrictions.create({
      projectName: PROJECT_NAME, version,
      modelName: "TeamMember",
      type: "UNIQUE",
      fields: ["accountId", "teamId"],
      dbName: "uq_team_member_account_team",
    });
    console.log("  ✓ TeamMember UNIQUE([accountId, teamId]) added (unique_added → lossy_convert)");
  } else {
    console.log("  ✓ TeamMember UNIQUE([accountId, teamId]) already exists — skipping.");
  }

  // ── Remove UNIQUE([username]) from Account ────────────────────────────────
  const usernameUniq = await findRestriction(version, "Account", "UNIQUE", ["username"]);
  if (usernameUniq) {
    await api.restrictions.delete({
      projectName: PROJECT_NAME, version,
      modelName: "Account",
      restrictionKey: usernameUniq.key,
    });
    console.log("  ✓ Account UNIQUE([username]) removed (unique_removed, diff badge only)");
  } else {
    console.log("  ✓ Account UNIQUE([username]) already removed — skipping.");
  }

  // ── Remove INDEX([status]) from Task ─────────────────────────────────────
  const statusIdx = await findRestriction(version, "Task", "INDEX", ["status"]);
  if (statusIdx) {
    await api.restrictions.delete({
      projectName: PROJECT_NAME, version,
      modelName: "Task",
      restrictionKey: statusIdx.key,
    });
    console.log("  ✓ Task INDEX([status]) removed (index_removed, diff badge only)");
  } else {
    console.log("  ✓ Task INDEX([status]) already removed — skipping.");
  }

  // ── Add INDEX([createdAt]) to Comment ────────────────────────────────────
  const createdAtIdx = await findRestriction(version, "Comment", "INDEX", ["createdAt"]);
  if (!createdAtIdx) {
    await api.restrictions.create({
      projectName: PROJECT_NAME, version,
      modelName: "Comment",
      type: "INDEX",
      fields: ["createdAt"],
      dbName: "idx_comment_created_at",
    });
    console.log("  ✓ Comment INDEX([createdAt]) added (index_added, diff badge only)");
  } else {
    console.log("  ✓ Comment INDEX([createdAt]) already exists — skipping.");
  }
}
