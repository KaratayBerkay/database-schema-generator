import { api, PROJECT_NAME } from "../../client";

// Relation mutations for v3.
//
// Schema warnings produced (v2→v3):
//   Invoice.subscription → Subscription deleted → relation.removed, data_deleted
//
// Diff badges only:
//   ReportCache.account → Account added → relation.added, info badge

export async function mutateRelations(version: string) {
  // ── Delete Invoice.subscription → Subscription ────────────────────────────
  const invoiceRels = await api.relations.list({
    projectName: PROJECT_NAME, version, modelName: "Invoice",
  });
  const subscriptionRel = invoiceRels?.relations.find((r) => r.name === "subscription");

  if (subscriptionRel) {
    await api.relations.delete({
      projectName: PROJECT_NAME, version,
      modelName: "Invoice",
      relationKey: subscriptionRel.key,
    });
    console.log("  ✓ Deleted Invoice.subscription → Subscription (relation.removed → data_deleted)");
  } else {
    console.log("  ✓ Invoice.subscription relation already removed — skipping.");
  }

  // ── Add ReportCache.account → Account (new table relation, diff badge only) ─
  const reportCacheRels = await api.relations.list({
    projectName: PROJECT_NAME, version, modelName: "ReportCache",
  });
  const alreadyHasAccount = reportCacheRels?.relations.some((r) => r.name === "account");

  if (!alreadyHasAccount) {
    await api.relations.create({
      projectName: PROJECT_NAME, version,
      modelName: "ReportCache",
      name: "account",
      targetModel: "Account",
      backReferenceName: "reportCaches",
      fields: ["accountId"],
      references: ["id"],
      onDelete: "Cascade",
      onUpdate: "Cascade",
      nullable: false,
      isArray: false,
      backReferenceIsArray: true,
    });
    console.log("  ✓ Added ReportCache.account → Account (relation.added, diff badge only)");
  } else {
    console.log("  ✓ ReportCache.account already exists — skipping.");
  }
}
