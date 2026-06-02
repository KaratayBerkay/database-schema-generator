import { api, PROJECT_NAME, V1_VERSION } from "../../client";

// 27 relations.
// Comment.task → Task is deleted in v2 (standalone relation.removed warning).
// AuditLog.actor → Account is auto-removed when AuditLog is deleted in v2.
// Invoice.subscription → Subscription is deleted in v3 (relation.removed warning).

type RelDef = {
  modelName: string;
  name: string;
  targetModel: string;
  backReferenceName: string;
  fields: string[];
  references: string[];
  onDelete: string;
  onUpdate: string;
  nullable: boolean;
  isArray: boolean;
  backReferenceIsArray: boolean;
};

const RELATIONS: RelDef[] = [
  // Profile belongs to Account
  {
    modelName: "Profile", name: "account", targetModel: "Account",
    backReferenceName: "profile", fields: ["accountId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: false,
  },
  // TeamMember belongs to Account
  {
    modelName: "TeamMember", name: "account", targetModel: "Account",
    backReferenceName: "teamMemberships", fields: ["accountId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // TeamMember belongs to Team
  {
    modelName: "TeamMember", name: "team", targetModel: "Team",
    backReferenceName: "members", fields: ["teamId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Project belongs to Account (owner)
  {
    modelName: "Project", name: "owner", targetModel: "Account",
    backReferenceName: "ownedProjects", fields: ["ownerId"], references: ["id"],
    onDelete: "Restrict", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Sprint belongs to Project
  {
    modelName: "Sprint", name: "project", targetModel: "Project",
    backReferenceName: "sprints", fields: ["projectId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Task belongs to Project
  {
    modelName: "Task", name: "project", targetModel: "Project",
    backReferenceName: "tasks", fields: ["projectId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Task optionally belongs to Sprint
  {
    modelName: "Task", name: "sprint", targetModel: "Sprint",
    backReferenceName: "tasks", fields: ["sprintId"], references: ["id"],
    onDelete: "SetNull", onUpdate: "Cascade",
    nullable: true, isArray: false, backReferenceIsArray: true,
  },
  // Task optionally assigned to Account
  {
    modelName: "Task", name: "assignee", targetModel: "Account",
    backReferenceName: "assignedTasks", fields: ["assigneeId"], references: ["id"],
    onDelete: "SetNull", onUpdate: "Cascade",
    nullable: true, isArray: false, backReferenceIsArray: true,
  },
  // Comment belongs to Account (author)
  {
    modelName: "Comment", name: "author", targetModel: "Account",
    backReferenceName: "comments", fields: ["authorId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Comment belongs to Task — deleted in v2 (relation.removed warning)
  {
    modelName: "Comment", name: "task", targetModel: "Task",
    backReferenceName: "comments", fields: ["taskId"], references: ["id"],
    onDelete: "SetNull", onUpdate: "Cascade",
    nullable: true, isArray: false, backReferenceIsArray: true,
  },
  // Attachment belongs to Task
  {
    modelName: "Attachment", name: "task", targetModel: "Task",
    backReferenceName: "attachments", fields: ["taskId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Attachment belongs to Account (uploader)
  {
    modelName: "Attachment", name: "uploader", targetModel: "Account",
    backReferenceName: "uploads", fields: ["uploaderId"], references: ["id"],
    onDelete: "Restrict", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Label belongs to Project
  {
    modelName: "Label", name: "project", targetModel: "Project",
    backReferenceName: "labels", fields: ["projectId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // TaskLabel belongs to Task
  {
    modelName: "TaskLabel", name: "task", targetModel: "Task",
    backReferenceName: "labels", fields: ["taskId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // TaskLabel belongs to Label
  {
    modelName: "TaskLabel", name: "label", targetModel: "Label",
    backReferenceName: "tasks", fields: ["labelId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Notification belongs to Account (recipient)
  {
    modelName: "Notification", name: "recipient", targetModel: "Account",
    backReferenceName: "notifications", fields: ["recipientId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // AuditLog belongs to Account (actor) — auto-removed when AuditLog deleted in v2
  {
    modelName: "AuditLog", name: "actor", targetModel: "Account",
    backReferenceName: "auditLogs", fields: ["actorId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Subscription belongs to Account
  {
    modelName: "Subscription", name: "account", targetModel: "Account",
    backReferenceName: "subscriptions", fields: ["accountId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Invoice belongs to Account
  {
    modelName: "Invoice", name: "account", targetModel: "Account",
    backReferenceName: "invoices", fields: ["accountId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Invoice optionally belongs to Subscription — deleted in v3 (relation.removed warning)
  {
    modelName: "Invoice", name: "subscription", targetModel: "Subscription",
    backReferenceName: "invoices", fields: ["subscriptionId"], references: ["id"],
    onDelete: "SetNull", onUpdate: "Cascade",
    nullable: true, isArray: false, backReferenceIsArray: true,
  },
  // InvoiceItem belongs to Invoice
  {
    modelName: "InvoiceItem", name: "invoice", targetModel: "Invoice",
    backReferenceName: "items", fields: ["invoiceId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Product optionally belongs to Category
  {
    modelName: "Product", name: "category", targetModel: "Category",
    backReferenceName: "products", fields: ["categoryId"], references: ["id"],
    onDelete: "SetNull", onUpdate: "Cascade",
    nullable: true, isArray: false, backReferenceIsArray: true,
  },
  // ArticleTag belongs to Article
  {
    modelName: "ArticleTag", name: "article", targetModel: "Article",
    backReferenceName: "tags", fields: ["articleId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // ArticleTag belongs to Tag
  {
    modelName: "ArticleTag", name: "tag", targetModel: "Tag",
    backReferenceName: "articles", fields: ["tagId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // Article belongs to Account (author)
  {
    modelName: "Article", name: "author", targetModel: "Account",
    backReferenceName: "articles", fields: ["authorId"], references: ["id"],
    onDelete: "Restrict", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
  // MediaAsset belongs to Account (owner)
  {
    modelName: "MediaAsset", name: "owner", targetModel: "Account",
    backReferenceName: "mediaAssets", fields: ["ownerId"], references: ["id"],
    onDelete: "Cascade", onUpdate: "Cascade",
    nullable: false, isArray: false, backReferenceIsArray: true,
  },
];

export async function addRelations() {
  for (const rel of RELATIONS) {
    const existing = await api.relations.list({
      projectName: PROJECT_NAME, version: V1_VERSION, modelName: rel.modelName,
    });
    const alreadyExists = existing?.relations.some((r) => r.name === rel.name);
    if (alreadyExists) {
      console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel} already exists — skipping.`);
      continue;
    }

    await api.relations.create({
      projectName: PROJECT_NAME,
      version: V1_VERSION,
      ...rel,
    });
    console.log(`  ✓ ${rel.modelName}.${rel.name} → ${rel.targetModel}`);
  }
}
