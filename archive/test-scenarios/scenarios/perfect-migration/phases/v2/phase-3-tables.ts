import { api, PROJECT_NAME } from "../../client";

// Table mutations for v2.
//
// Schema warnings produced (v1→v2):
//   AuditLog deleted       → table.removed, data_deleted
//   (AuditLog.actor relation auto-removed → relation.removed, data_deleted)
//
// Diff badges only:
//   MediaAsset → Asset     → table.renamed, warning badge
//   ContentHub created     → table.added, info badge

export async function mutateTables(version: string) {
  const current = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName = new Map(current?.map((t) => [t.name, t]) ?? []);

  // ── Delete AuditLog ───────────────────────────────────────────────────────
  if (byName.has("AuditLog")) {
    await api.tables.delete({ projectName: PROJECT_NAME, version, modelName: "AuditLog" });
    console.log("  ✓ Deleted table AuditLog (table.removed → data_deleted)");
  } else {
    console.log("  ✓ AuditLog already deleted — skipping.");
  }

  // ── Rename MediaAsset → Asset (PK stays id Int) ───────────────────────────
  const refreshed1 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName1 = new Map(refreshed1?.map((t) => [t.name, t]) ?? []);

  if (byName1.has("MediaAsset") && !byName1.has("Asset")) {
    const mediaAsset = byName1.get("MediaAsset")!;
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "MediaAsset", newModelName: "Asset",
      pkName: mediaAsset.pkName, pkType: "Int",
    });
    console.log("  ✓ Renamed MediaAsset → Asset (table.renamed, diff badge only)");
  } else if (byName1.has("Asset")) {
    console.log("  ✓ Asset already renamed — skipping.");
  }

  // ── Create ContentHub (new table, diff badge only) ────────────────────────
  const refreshed2 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const names2 = new Set(refreshed2?.map((t) => t.name) ?? []);

  if (!names2.has("ContentHub")) {
    await api.tables.create({
      projectName: PROJECT_NAME, version,
      modelName: "ContentHub", pkName: "id", pkType: "Int",
    });
    for (const field of [
      { name: "name", type: "String", defaultValue: "" },
      { name: "slug", type: "String", defaultValue: "" },
      { name: "createdAt", type: "DateTime", defaultValue: "now()" },
    ]) {
      await api.fields.create({
        projectName: PROJECT_NAME, version, modelName: "ContentHub",
        name: field.name, type: field.type,
        nullable: false, unique: false, defaultValue: field.defaultValue, comment: "",
        updatedAtAttribute: false, isId: false,
      });
    }
    console.log("  ✓ Created table ContentHub with minimal fields (table.added, diff badge only)");
  } else {
    console.log("  ✓ ContentHub already exists — skipping.");
  }
}
