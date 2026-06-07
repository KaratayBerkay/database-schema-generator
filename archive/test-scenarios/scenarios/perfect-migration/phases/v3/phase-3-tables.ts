import { api, PROJECT_NAME } from "../../client";

// Table mutations for v3.
//
// Schema warnings produced (v2→v3):
//   Invoice PK id Int → Uuid   → pk_type_changed, data_deleted (breaking)
//     Cascade hint: InvoiceItem.invoiceId Int still points to Invoice.id (now Uuid)
//
// Diff badges only:
//   ContentHub → PublishingHub  → table.renamed, warning badge
//   ReportCache created         → table.added, info badge

export async function mutateTables(version: string) {
  const current = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName = new Map(current?.map((t) => [t.name, t]) ?? []);

  // ── Invoice: PK type Int → Uuid (pk_type_changed, breaking warning) ───────
  const invoice = byName.get("Invoice");
  if (invoice && invoice.pkType !== "Uuid") {
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "Invoice", newModelName: "Invoice",
      pkName: invoice.pkName, pkType: "Uuid",
    });
    console.log("  ✓ Invoice.id: Int → Uuid (pk_type_changed → data_deleted, cascade hints to InvoiceItem.invoiceId)");
  } else if (invoice?.pkType === "Uuid") {
    console.log("  ✓ Invoice.id already Uuid — skipping.");
  }

  // ── Rename ContentHub → PublishingHub (diff badge only) ───────────────────
  const refreshed1 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const byName1 = new Map(refreshed1?.map((t) => [t.name, t]) ?? []);

  if (byName1.has("ContentHub") && !byName1.has("PublishingHub")) {
    const hub = byName1.get("ContentHub")!;
    await api.tables.update({
      projectName: PROJECT_NAME, version,
      oldModelName: "ContentHub", newModelName: "PublishingHub",
      pkName: hub.pkName, pkType: "Int",
    });
    console.log("  ✓ Renamed ContentHub → PublishingHub (table.renamed, diff badge only)");
  } else if (byName1.has("PublishingHub")) {
    console.log("  ✓ PublishingHub already renamed — skipping.");
  }

  // ── Create ReportCache (new table, diff badge only) ───────────────────────
  const refreshed2 = await api.tables.list({ projectName: PROJECT_NAME, version });
  const names2 = new Set(refreshed2?.map((t) => t.name) ?? []);

  if (!names2.has("ReportCache")) {
    await api.tables.create({
      projectName: PROJECT_NAME, version,
      modelName: "ReportCache", pkName: "id", pkType: "Int",
    });
    for (const field of [
      { name: "key", type: "String", defaultValue: "" },
      { name: "data", type: "Json", defaultValue: "" },
      { name: "cachedAt", type: "DateTime", defaultValue: "now()" },
    ]) {
      await api.fields.create({
        projectName: PROJECT_NAME, version, modelName: "ReportCache",
        name: field.name, type: field.type,
        nullable: false, unique: false, defaultValue: field.defaultValue, comment: "",
        updatedAtAttribute: false, isId: false,
      });
    }
    console.log("  ✓ Created table ReportCache with minimal fields (table.added, diff badge only)");
  } else {
    console.log("  ✓ ReportCache already exists — skipping.");
  }
}
