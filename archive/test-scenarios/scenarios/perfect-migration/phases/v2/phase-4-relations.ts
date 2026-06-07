import { api, PROJECT_NAME } from "../../client";

// Relation mutations for v2.
//
// Schema warnings produced (v1→v2):
//   Comment.task → Task removed (standalone)   → relation.removed, data_deleted
//   AuditLog.actor → Account auto-removed with AuditLog table → relation.removed, data_deleted
//
// The AuditLog.actor removal happens automatically when AuditLog is deleted in phase-3.
// This phase only handles the standalone Comment→Task deletion.

export async function mutateRelations(version: string) {
  // ── Delete Comment.task → Task (standalone relation removal) ──────────────
  const commentRels = await api.relations.list({
    projectName: PROJECT_NAME, version, modelName: "Comment",
  });
  const taskRel = commentRels?.relations.find((r) => r.name === "task");

  if (taskRel) {
    await api.relations.delete({
      projectName: PROJECT_NAME, version,
      modelName: "Comment",
      relationKey: taskRel.key,
    });
    console.log("  ✓ Deleted Comment.task → Task (standalone relation.removed → data_deleted)");
  } else {
    console.log("  ✓ Comment.task relation already removed — skipping.");
  }
}
