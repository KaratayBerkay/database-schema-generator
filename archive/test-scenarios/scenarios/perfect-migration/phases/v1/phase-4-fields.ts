import { api, PROJECT_NAME, V1_VERSION } from "../../client";

// FK scalar fields (accountId, projectId, etc.) are created automatically by phase-5-relations.
// Only non-FK business fields are listed here.
//
// Fields marked with (* v2) or (* v3) are the ones that mutate in those versions.

type FieldDef = {
  name: string;
  type: string;
  nullable?: boolean;
  unique?: boolean;
  defaultValue?: string;
};

const FIELDS: Record<string, FieldDef[]> = {
  Account: [
    { name: "email",        type: "String" },
    { name: "username",     type: "String" },            // * v2: renamed handle + String→Int (multiple, lossy_convert)
    { name: "role",         type: "AccountRole" },
    { name: "passwordHash", type: "String" },
    { name: "isVerified",   type: "Boolean", defaultValue: "false" }, // * v2: default removed (default_changed, backfill_required)
    { name: "plan",         type: "String" },             // * v2: deleted (removed, data_deleted)
    { name: "credits",      type: "Float",   defaultValue: "0" },     // * v2: Float→Int (type_changed, precision_loss)
    { name: "createdAt",    type: "DateTime", defaultValue: "now()" },
  ],
  Profile: [
    { name: "displayName", type: "String" },
    { name: "bio",         type: "String", nullable: true },  // * v2: optional→required (nullability_changed, backfill_required)
    { name: "avatarUrl",   type: "String", nullable: true },
    { name: "location",    type: "String", nullable: true },
    { name: "score",       type: "Int",    defaultValue: "0" },
    { name: "birthDate",   type: "DateTime", nullable: true },
  ],
  Team: [
    { name: "name",        type: "String" },
    { name: "slug",        type: "String" },
    { name: "description", type: "String", nullable: true },
    { name: "maxMembers",  type: "Int",    defaultValue: "10" },
    { name: "createdAt",   type: "DateTime", defaultValue: "now()" },
  ],
  TeamMember: [
    { name: "role",     type: "AccountRole" },
    { name: "joinedAt", type: "DateTime", defaultValue: "now()" },
  ],
  Project: [
    { name: "name",        type: "String" },
    { name: "status",      type: "String", defaultValue: '"ACTIVE"' },
    { name: "priority",    type: "Priority" },
    { name: "description", type: "String", nullable: true },
    { name: "createdAt",   type: "DateTime", defaultValue: "now()" },
  ],
  Sprint: [
    { name: "name",      type: "String" },
    { name: "goal",      type: "String", nullable: true },  // * v3: optional→required (nullability_changed, backfill_required)
    { name: "startDate", type: "DateTime" },
    { name: "endDate",   type: "DateTime" },
  ],
  Task: [
    { name: "title",       type: "String" },
    { name: "description", type: "String", nullable: true },
    { name: "status",      type: "TaskStatus" },
    { name: "priority",    type: "Priority" },
    { name: "dueDate",     type: "DateTime", nullable: true },
    { name: "storyPoints", type: "Int",    nullable: true },  // * v2: optional→required (nullability_changed, backfill_required)
    { name: "threadRef",   type: "String", nullable: true },  // * v2: renamed sequenceId + String→Int (multiple, lossy_convert)
  ],
  Comment: [
    { name: "body",      type: "String" },              // * v3: required→optional (nullability_changed, info diff badge)
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  Attachment: [
    { name: "filename",   type: "String" },
    { name: "url",        type: "String" },
    { name: "size",       type: "Int" },
    { name: "mimeType",   type: "String" },
    { name: "uploadedAt", type: "DateTime", defaultValue: "now()" },
  ],
  Label: [
    { name: "name",  type: "String" },
    { name: "color", type: "String", defaultValue: '"#6366f1"' },
  ],
  // TaskLabel — only FK fields, created by relations
  Notification: [
    { name: "type",      type: "String" },
    { name: "message",   type: "String" },
    { name: "isRead",    type: "Boolean", defaultValue: "false" },
    { name: "createdAt", type: "DateTime", defaultValue: "now()" },
  ],
  AuditLog: [
    // * v2: entire table deleted (table.removed, data_deleted warning)
    { name: "action",      type: "String" },
    { name: "entityType",  type: "String" },
    { name: "entityId",    type: "String" },
    { name: "metadata",    type: "String", nullable: true },
    { name: "performedAt", type: "DateTime", defaultValue: "now()" },
  ],
  Subscription: [
    { name: "plan",      type: "String" },
    { name: "cycle",     type: "BillingCycle" },  // * v2: BillingCycle→String before enum deleted (type_changed, data_deleted)
    { name: "startedAt", type: "DateTime", defaultValue: "now()" },
    { name: "expiresAt", type: "DateTime", nullable: true },
    { name: "isActive",  type: "Boolean", defaultValue: "true" },
  ],
  Invoice: [
    // * v3: PK id Int → Uuid (pk_type_changed, breaking, cascade hints to InvoiceItem.invoiceId)
    { name: "amount",   type: "Float" },
    { name: "status",   type: "String", defaultValue: '"PENDING"' },
    { name: "issuedAt", type: "DateTime", defaultValue: "now()" },
    { name: "paidAt",   type: "DateTime", nullable: true },
  ],
  InvoiceItem: [
    { name: "description", type: "String" },
    { name: "quantity",    type: "Int" },
    { name: "unitPrice",   type: "Float" },
  ],
  Product: [
    { name: "name",        type: "String" },
    { name: "slug",        type: "String" },
    { name: "price",       type: "Float" },
    { name: "stock",       type: "Int",  defaultValue: "0" },  // * v3: default removed (default_changed, backfill_required)
    { name: "contentType", type: "ContentType" },               // * v3: ContentType→String before enum deleted (type_changed, data_deleted)
  ],
  Category: [
    { name: "name",     type: "String" },
    { name: "slug",     type: "String" },
    { name: "parentId", type: "Int", nullable: true },  // self-ref as plain Int? (no formal relation)
  ],
  Tag: [
    { name: "name", type: "String" },
    // colorHex String? added in v3 (field.added, info diff badge)
  ],
  Article: [
    { name: "title",       type: "String" },          // * v2: renamed headline (renamed, diff badge only)
    { name: "slug",        type: "String" },
    { name: "body",        type: "String", nullable: true },  // * v2: deleted (removed, data_deleted)
    { name: "contentType", type: "ContentType" },             // * v3: ContentType→String (type_changed, data_deleted)
    { name: "publishedAt", type: "DateTime", nullable: true },
    { name: "viewCount",   type: "Int", defaultValue: "0" },
  ],
  // ArticleTag — only FK fields, created by relations
  MediaAsset: [
    // * v2: table renamed to Asset (table.renamed, diff badge only)
    { name: "filename",   type: "String" },
    { name: "url",        type: "String" },
    { name: "type",       type: "String" },
    { name: "size",       type: "Int" },
    { name: "uploadedAt", type: "DateTime", defaultValue: "now()" },
  ],
};

export async function addFields() {
  for (const [modelName, fields] of Object.entries(FIELDS)) {
    const res = await api.fields.list({
      projectName: PROJECT_NAME, version: V1_VERSION, modelName,
    });
    const existingNames = new Set(res?.fields.map((f) => f.name) ?? []);

    for (const field of fields) {
      if (existingNames.has(field.name)) {
        console.log(`  ✓ ${modelName}.${field.name} already exists — skipping.`);
        continue;
      }
      await api.fields.create({
        projectName: PROJECT_NAME,
        version: V1_VERSION,
        modelName,
        name: field.name,
        type: field.type,
        nullable: field.nullable ?? false,
        unique: field.unique ?? false,
        defaultValue: field.defaultValue ?? "",
        comment: "",
        updatedAtAttribute: false,
        isId: false,
      });
      console.log(`  ✓ ${modelName}.${field.name} (${field.type}${field.nullable ? "?" : ""})`);
    }
  }
}
