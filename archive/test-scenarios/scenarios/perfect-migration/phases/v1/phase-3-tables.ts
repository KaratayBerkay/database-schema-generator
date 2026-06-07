import { api, PROJECT_NAME, V1_VERSION } from "../../client";

// 22 tables, all with Int PK named "id".
// AuditLog   — deleted in v2 (table.removed, data_deleted warning)
// MediaAsset — renamed to Asset in v2 (table.renamed, diff badge only)
// Invoice    — PK Int → Uuid in v3 (pk_type_changed, breaking warning + FK cascade hints)

const TABLES = [
  "Account",
  "Profile",
  "Team",
  "TeamMember",
  "Project",
  "Sprint",
  "Task",
  "Comment",
  "Attachment",
  "Label",
  "TaskLabel",
  "Notification",
  "AuditLog",
  "Subscription",
  "Invoice",
  "InvoiceItem",
  "Product",
  "Category",
  "Tag",
  "Article",
  "ArticleTag",
  "MediaAsset",
];

export async function createTables() {
  const existing = await api.tables.list({ projectName: PROJECT_NAME, version: V1_VERSION });
  const existingNames = new Set(existing?.map((t) => t.name) ?? []);

  for (const name of TABLES) {
    if (existingNames.has(name)) {
      console.log(`  ✓ ${name} already exists — skipping.`);
      continue;
    }
    await api.tables.create({
      projectName: PROJECT_NAME,
      version: V1_VERSION,
      modelName: name,
      pkName: "id",
      pkType: "Int",
    });
    console.log(`  ✓ Created table ${name} (PK id Int)`);
  }
}
