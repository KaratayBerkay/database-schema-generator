import { api, PROJECT_NAME, V1_VERSION } from "../../client";

// 15 restrictions in V1:
//   Account:      UNIQUE(email), UNIQUE(username)       username UNIQUE removed in v2
//   Team:         UNIQUE(slug)
//   Product:      UNIQUE(slug)
//   Tag:          UNIQUE(name)
//   Article:      UNIQUE(slug)
//   Task:         INDEX(status), INDEX(priority), INDEX(dueDate)    status INDEX removed in v2; priority INDEX removed in v3
//   Notification: INDEX(recipientId)
//   TeamMember:   INDEX(accountId), INDEX(teamId)
//   Subscription: INDEX(accountId)
//   Invoice:      INDEX(accountId)
//   AuditLog:     INDEX(entityType, entityId)            auto-removed when AuditLog deleted in v2

type RestrictionDef = {
  modelName: string;
  type: "UNIQUE" | "INDEX";
  fields: string[];
  dbName: string;
};

const RESTRICTIONS: RestrictionDef[] = [
  { modelName: "Account",      type: "UNIQUE", fields: ["email"],               dbName: "uq_account_email" },
  { modelName: "Account",      type: "UNIQUE", fields: ["username"],            dbName: "uq_account_username" },
  { modelName: "Team",         type: "UNIQUE", fields: ["slug"],                dbName: "uq_team_slug" },
  { modelName: "Product",      type: "UNIQUE", fields: ["slug"],                dbName: "uq_product_slug" },
  { modelName: "Tag",          type: "UNIQUE", fields: ["name"],                dbName: "uq_tag_name" },
  { modelName: "Article",      type: "UNIQUE", fields: ["slug"],                dbName: "uq_article_slug" },
  { modelName: "Task",         type: "INDEX",  fields: ["status"],              dbName: "idx_task_status" },
  { modelName: "Task",         type: "INDEX",  fields: ["priority"],            dbName: "idx_task_priority" },
  { modelName: "Task",         type: "INDEX",  fields: ["dueDate"],             dbName: "idx_task_due_date" },
  { modelName: "Notification", type: "INDEX",  fields: ["recipientId"],         dbName: "idx_notification_recipient" },
  { modelName: "TeamMember",   type: "INDEX",  fields: ["accountId"],           dbName: "idx_team_member_account" },
  { modelName: "TeamMember",   type: "INDEX",  fields: ["teamId"],              dbName: "idx_team_member_team" },
  { modelName: "Subscription", type: "INDEX",  fields: ["accountId"],           dbName: "idx_subscription_account" },
  { modelName: "Invoice",      type: "INDEX",  fields: ["accountId"],           dbName: "idx_invoice_account" },
  { modelName: "AuditLog",     type: "INDEX",  fields: ["entityType", "entityId"], dbName: "idx_audit_entity" },
];

export async function addRestrictions() {
  for (const r of RESTRICTIONS) {
    const existing = await api.restrictions.list({
      projectName: PROJECT_NAME, version: V1_VERSION, modelName: r.modelName,
    });
    const alreadyExists = existing?.restrictions.some(
      (ex) => ex.type === r.type && ex.fields.join(",") === r.fields.join(","),
    );
    if (alreadyExists) {
      console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields}]) already exists — skipping.`);
      continue;
    }

    await api.restrictions.create({
      projectName: PROJECT_NAME,
      version: V1_VERSION,
      modelName: r.modelName,
      type: r.type,
      fields: r.fields,
      dbName: r.dbName,
    });
    console.log(`  ✓ ${r.modelName} @@${r.type.toLowerCase()}([${r.fields.join(", ")}])`);
  }
}
