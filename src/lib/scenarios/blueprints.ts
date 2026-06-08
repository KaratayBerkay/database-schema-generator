// Authored "user-guide" scenario blueprints for the Scenarios workflow.
//
// Each blueprint is a complete, hand-authored schema expressed in the canonical
// store format (the same legacy JSON shape `migrateLegacyStore` consumes). The
// Scenarios loader writes one of these into a brand-new project so newcomers can
// explore the app against a realistic, fully-wired schema instead of an empty one.
//
// These are NOT mock *row* data — they are schema designs (tables, fields,
// relations, restrictions, enums). No records are seeded.
//
// Authoring notes (must hold for `migrateLegacyStore` to wire relations):
//   • A relation has an OWNER field (the FK holder, `relation.fields` non-empty)
//     and a BACK-REF field on the target (`relation.fields` empty).
//   • Both sides share the same `relation.name`, generated as
//     `${OwnerModel}_${ownerFieldName}_${TargetModel}_rl` — use `rlName()`.
//   • The owner field's `type` is the TARGET model name; the back-ref field's
//     `type` is the OWNER model name. Models/fields resolve by name or key.
//   • `relation.fields` / `relation.references` list the FK column key and the
//     referenced PK column key respectively.
//   • `onDelete: "SetNull"` requires the owning FK field to be nullable.

export type ScenarioConstraint =
  | { type: "PK" | "UNIQUE" | "UPDATED_AT" }
  | { type: "NATIVE"; name: string; args?: string[] };

export type ScenarioRelation = {
  name: string;
  fields?: string[];
  references?: string[];
  onDelete?: string;
  onUpdate?: string;
};

export type ScenarioField = {
  key: string;
  name: string;
  type: string;
  nullable: boolean;
  default: string;
  comment: string;
  constraints: ScenarioConstraint[];
  array: boolean;
  relation?: ScenarioRelation;
};

export type ScenarioRestriction = {
  key: string;
  type: "UNIQUE" | "INDEX";
  fields: string[];
  dbName?: string;
};

export type ScenarioModel = {
  key: string;
  name: string;
  fields: ScenarioField[];
  restrictions?: ScenarioRestriction[];
};

export type ScenarioEnum = {
  enumId: string;
  name: string;
  values: { valueId: string; name: string }[];
};

export type ScenarioStore = {
  schemaVersion: number;
  projectName: string;
  projectVersion: string;
  provider: string;
  enums: ScenarioEnum[];
  models: ScenarioModel[];
};

export type ScenarioBlueprint = {
  id: string;
  title: string;
  /** Project provider in Prisma terms — mapped to the app provider on load. */
  prismaProvider: "postgresql" | "mysql" | "sqlite";
  /** Tailwind accent (matches the sidebar tone vocabulary). */
  accent: string;
  summary: string;
  /** Short bullet points describing what the schema demonstrates. */
  highlights: string[];
  /** Where to go next after loading — workflow-relative hrefs. */
  exploreNext: { label: string; href: string }[];
  store: ScenarioStore;
};

// ─── authoring helpers ──────────────────────────────────────────────────────────

const pk = (slug: string): ScenarioField => ({
  key: `${slug}_id`,
  name: "id",
  type: "integer",
  nullable: false,
  default: "autoincrement()",
  comment: "",
  constraints: [{ type: "PK" }],
  array: false,
});

const field = (
  key: string,
  name: string,
  type: string,
  opts: { nullable?: boolean; unique?: boolean; default?: string; comment?: string } = {},
): ScenarioField => ({
  key,
  name,
  type,
  nullable: opts.nullable ?? false,
  default: opts.default ?? "",
  comment: opts.comment ?? "",
  constraints: opts.unique ? [{ type: "UNIQUE" }] : [],
  array: false,
});

/** Stable relation name shared by both sides. */
const rlName = (ownerModel: string, ownerField: string, targetModel: string) =>
  `${ownerModel}_${ownerField}_${targetModel}_rl`;

/** Owning side: the model that holds the foreign key. */
const owns = (
  key: string,
  name: string,
  targetModel: string,
  relName: string,
  fkKey: string,
  refKey: string,
  opts: { nullable?: boolean; onDelete?: string; onUpdate?: string } = {},
): ScenarioField => ({
  key,
  name,
  type: targetModel,
  nullable: opts.nullable ?? false,
  default: "",
  comment: "",
  constraints: [],
  array: false,
  relation: {
    name: relName,
    fields: [fkKey],
    references: [refKey],
    onDelete: opts.onDelete ?? "",
    onUpdate: opts.onUpdate ?? "",
  },
});

/** Back-reference side: the target of the foreign key. */
const backref = (
  key: string,
  name: string,
  sourceModel: string,
  relName: string,
  opts: { array?: boolean; nullable?: boolean } = {},
): ScenarioField => ({
  key,
  name,
  type: sourceModel,
  nullable: opts.nullable ?? true,
  default: "",
  comment: "",
  constraints: [],
  array: opts.array ?? true,
  relation: { name: relName, fields: [], references: [], onDelete: "", onUpdate: "" },
});

const enumDef = (enumId: string, name: string, values: string[]): ScenarioEnum => ({
  enumId,
  name,
  values: values.map((v) => ({ valueId: `${enumId}_${v.toLowerCase()}`, name: v })),
});

// ─── 1. Blog Platform ─────────────────────────────────────────────────────────────

const blogPlatform: ScenarioBlueprint = {
  id: "blog-platform",
  title: "Blog Platform",
  prismaProvider: "postgresql",
  accent: "bg-rose-400",
  summary:
    "A classic content site: authors publish posts in categories, readers leave comments, and posts are tagged through a join table.",
  highlights: [
    "6 tables incl. a PostTag join table for a many-to-many relation",
    "Enums for user roles and post status",
    "Nullable foreign key (Post → Category) with on-delete SetNull",
    "Unique constraints on email, slugs, and tag names",
  ],
  exploreNext: [
    { label: "See the tables", href: "/tables" },
    { label: "Inspect relations", href: "/relations" },
    { label: "View dependency order", href: "/hierarchy" },
  ],
  store: {
    schemaVersion: 2,
    projectName: "Blog Platform",
    projectVersion: "1.0111",
    provider: "postgresql",
    enums: [
      enumDef("blog_user_role", "UserRole", ["ADMIN", "AUTHOR", "READER"]),
      enumDef("blog_post_status", "PostStatus", ["DRAFT", "PUBLISHED", "ARCHIVED"]),
    ],
    models: [
      {
        key: "user",
        name: "User",
        fields: [
          pk("user"),
          field("user_email", "email", "string", { unique: true }),
          field("user_name", "name", "string"),
          field("user_role", "role", "UserRole", { default: "READER" }),
          field("user_created", "createdAt", "timestamp", { default: "now()" }),
          backref("user_posts", "posts", "Post", rlName("Post", "author", "User"), { array: true }),
          backref("user_comments", "comments", "Comment", rlName("Comment", "author", "User"), { array: true }),
        ],
      },
      {
        key: "category",
        name: "Category",
        fields: [
          pk("category"),
          field("category_name", "name", "string", { unique: true }),
          field("category_slug", "slug", "string", { unique: true }),
          backref("category_posts", "posts", "Post", rlName("Post", "category", "Category"), { array: true }),
        ],
      },
      {
        key: "post",
        name: "Post",
        fields: [
          pk("post"),
          field("post_title", "title", "string"),
          field("post_slug", "slug", "string", { unique: true }),
          field("post_body", "body", "string", { nullable: true }),
          field("post_status", "status", "PostStatus", { default: "DRAFT" }),
          field("post_published", "publishedAt", "timestamp", { nullable: true }),
          field("post_author_id", "authorId", "integer"),
          owns("post_author", "author", "User", rlName("Post", "author", "User"), "post_author_id", "user_id", {
            onDelete: "Cascade",
            onUpdate: "Cascade",
          }),
          field("post_category_id", "categoryId", "integer", { nullable: true }),
          owns("post_category", "category", "Category", rlName("Post", "category", "Category"), "post_category_id", "category_id", {
            nullable: true,
            onDelete: "SetNull",
          }),
          backref("post_comments", "comments", "Comment", rlName("Comment", "post", "Post"), { array: true }),
          backref("post_tags", "postTags", "PostTag", rlName("PostTag", "post", "Post"), { array: true }),
        ],
      },
      {
        key: "comment",
        name: "Comment",
        fields: [
          pk("comment"),
          field("comment_body", "body", "string"),
          field("comment_created", "createdAt", "timestamp", { default: "now()" }),
          field("comment_post_id", "postId", "integer"),
          owns("comment_post", "post", "Post", rlName("Comment", "post", "Post"), "comment_post_id", "post_id", {
            onDelete: "Cascade",
          }),
          field("comment_author_id", "authorId", "integer"),
          owns("comment_author", "author", "User", rlName("Comment", "author", "User"), "comment_author_id", "user_id", {
            onDelete: "Cascade",
          }),
        ],
      },
      {
        key: "tag",
        name: "Tag",
        fields: [
          pk("tag"),
          field("tag_name", "name", "string", { unique: true }),
          backref("tag_posts", "postTags", "PostTag", rlName("PostTag", "tag", "Tag"), { array: true }),
        ],
      },
      {
        key: "posttag",
        name: "PostTag",
        fields: [
          pk("posttag"),
          field("posttag_post_id", "postId", "integer"),
          owns("posttag_post", "post", "Post", rlName("PostTag", "post", "Post"), "posttag_post_id", "post_id", {
            onDelete: "Cascade",
          }),
          field("posttag_tag_id", "tagId", "integer"),
          owns("posttag_tag", "tag", "Tag", rlName("PostTag", "tag", "Tag"), "posttag_tag_id", "tag_id", {
            onDelete: "Cascade",
          }),
        ],
        restrictions: [
          { key: "posttag_uq", type: "UNIQUE", fields: ["posttag_post_id", "posttag_tag_id"], dbName: "uq_post_tag" },
        ],
      },
    ],
  },
};

// ─── 2. Task Tracker ────────────────────────────────────────────────────────────

const taskTracker: ScenarioBlueprint = {
  id: "task-tracker",
  title: "Task Tracker",
  prismaProvider: "postgresql",
  accent: "bg-cyan-400",
  summary:
    "A project-management workspace: teams own projects, members belong to a workspace, and tasks carry a status, priority, and optional assignee.",
  highlights: [
    "4 tables with a clean Workspace → Project → Task ownership chain",
    "Status and Priority enums on tasks",
    "Composite unique (workspace + project key) plus an index on task status",
    "Optional self-service assignee (nullable FK, SetNull on delete)",
  ],
  exploreNext: [
    { label: "Browse the tables", href: "/tables" },
    { label: "Check restrictions", href: "/restrictions" },
    { label: "Generate validators", href: "/validation" },
  ],
  store: {
    schemaVersion: 2,
    projectName: "Task Tracker",
    projectVersion: "1.0111",
    provider: "postgresql",
    enums: [
      enumDef("task_status", "TaskStatus", ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
      enumDef("task_priority", "Priority", ["LOW", "MEDIUM", "HIGH", "URGENT"]),
    ],
    models: [
      {
        key: "workspace",
        name: "Workspace",
        fields: [
          pk("workspace"),
          field("workspace_name", "name", "string", { unique: true }),
          field("workspace_created", "createdAt", "timestamp", { default: "now()" }),
          backref("workspace_members", "members", "Member", rlName("Member", "workspace", "Workspace"), { array: true }),
          backref("workspace_projects", "projects", "Project", rlName("Project", "workspace", "Workspace"), { array: true }),
        ],
      },
      {
        key: "member",
        name: "Member",
        fields: [
          pk("member"),
          field("member_email", "email", "string", { unique: true }),
          field("member_name", "displayName", "string"),
          field("member_workspace_id", "workspaceId", "integer"),
          owns("member_workspace", "workspace", "Workspace", rlName("Member", "workspace", "Workspace"), "member_workspace_id", "workspace_id", {
            onDelete: "Cascade",
          }),
          backref("member_tasks", "assignedTasks", "Task", rlName("Task", "assignee", "Member"), { array: true }),
        ],
      },
      {
        key: "project",
        name: "Project",
        fields: [
          pk("project"),
          field("project_name", "name", "string"),
          field("project_key", "key", "string"),
          field("project_workspace_id", "workspaceId", "integer"),
          owns("project_workspace", "workspace", "Workspace", rlName("Project", "workspace", "Workspace"), "project_workspace_id", "workspace_id", {
            onDelete: "Cascade",
          }),
          backref("project_tasks", "tasks", "Task", rlName("Task", "project", "Project"), { array: true }),
        ],
        restrictions: [
          { key: "project_uq", type: "UNIQUE", fields: ["project_workspace_id", "project_key"], dbName: "uq_project_workspace_key" },
        ],
      },
      {
        key: "task",
        name: "Task",
        fields: [
          pk("task"),
          field("task_title", "title", "string"),
          field("task_desc", "description", "string", { nullable: true }),
          field("task_status", "status", "TaskStatus", { default: "TODO" }),
          field("task_priority", "priority", "Priority", { default: "MEDIUM" }),
          field("task_due", "dueDate", "timestamp", { nullable: true }),
          field("task_project_id", "projectId", "integer"),
          owns("task_project", "project", "Project", rlName("Task", "project", "Project"), "task_project_id", "project_id", {
            onDelete: "Cascade",
          }),
          field("task_assignee_id", "assigneeId", "integer", { nullable: true }),
          owns("task_assignee", "assignee", "Member", rlName("Task", "assignee", "Member"), "task_assignee_id", "member_id", {
            nullable: true,
            onDelete: "SetNull",
          }),
        ],
        restrictions: [
          { key: "task_status_idx", type: "INDEX", fields: ["task_status"], dbName: "idx_task_status" },
        ],
      },
    ],
  },
};

// ─── 3. E-Commerce Shop ───────────────────────────────────────────────────────────

const ecommerceShop: ScenarioBlueprint = {
  id: "ecommerce-shop",
  title: "E-Commerce Shop",
  prismaProvider: "mysql",
  accent: "bg-amber-400",
  summary:
    "A storefront on MySQL: customers place orders, each order has line items pointing at products, and products live in categories.",
  highlights: [
    "5 tables modelling orders and line items with Decimal money columns",
    "OrderStatus enum tracking the fulfilment lifecycle",
    "Index on Order.customerId and a unique (order, product) line-item pair",
    "Stock column with a literal default of 0",
  ],
  exploreNext: [
    { label: "Open the tables", href: "/tables" },
    { label: "Export the schema", href: "/exports" },
    { label: "Try the SQL workspace", href: "/sql-query" },
  ],
  store: {
    schemaVersion: 2,
    projectName: "E-Commerce Shop",
    projectVersion: "1.0111",
    provider: "mysql",
    enums: [
      enumDef("order_status", "OrderStatus", ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"]),
    ],
    models: [
      {
        key: "customer",
        name: "Customer",
        fields: [
          pk("customer"),
          field("customer_email", "email", "string", { unique: true }),
          field("customer_name", "fullName", "string"),
          field("customer_created", "createdAt", "timestamp", { default: "now()" }),
          backref("customer_orders", "orders", "Order", rlName("Order", "customer", "Customer"), { array: true }),
        ],
      },
      {
        key: "category",
        name: "Category",
        fields: [
          pk("category"),
          field("category_name", "name", "string", { unique: true }),
          backref("category_products", "products", "Product", rlName("Product", "category", "Category"), { array: true }),
        ],
      },
      {
        key: "product",
        name: "Product",
        fields: [
          pk("product"),
          field("product_sku", "sku", "string", { unique: true }),
          field("product_name", "name", "string"),
          field("product_price", "price", "decimal"),
          field("product_stock", "stock", "integer", { default: "0" }),
          field("product_category_id", "categoryId", "integer", { nullable: true }),
          owns("product_category", "category", "Category", rlName("Product", "category", "Category"), "product_category_id", "category_id", {
            nullable: true,
            onDelete: "SetNull",
          }),
          backref("product_items", "orderItems", "OrderItem", rlName("OrderItem", "product", "Product"), { array: true }),
        ],
      },
      {
        key: "order",
        name: "Order",
        fields: [
          pk("order"),
          field("order_status", "status", "OrderStatus", { default: "PENDING" }),
          field("order_total", "total", "decimal"),
          field("order_placed", "placedAt", "timestamp", { default: "now()" }),
          field("order_customer_id", "customerId", "integer"),
          owns("order_customer", "customer", "Customer", rlName("Order", "customer", "Customer"), "order_customer_id", "customer_id", {
            onDelete: "Cascade",
          }),
          backref("order_items", "items", "OrderItem", rlName("OrderItem", "order", "Order"), { array: true }),
        ],
        restrictions: [
          { key: "order_customer_idx", type: "INDEX", fields: ["order_customer_id"], dbName: "idx_order_customer" },
        ],
      },
      {
        key: "orderitem",
        name: "OrderItem",
        fields: [
          pk("orderitem"),
          field("orderitem_qty", "quantity", "integer"),
          field("orderitem_price", "unitPrice", "decimal"),
          field("orderitem_order_id", "orderId", "integer"),
          owns("orderitem_order", "order", "Order", rlName("OrderItem", "order", "Order"), "orderitem_order_id", "order_id", {
            onDelete: "Cascade",
          }),
          field("orderitem_product_id", "productId", "integer"),
          owns("orderitem_product", "product", "Product", rlName("OrderItem", "product", "Product"), "orderitem_product_id", "product_id", {
            onDelete: "Restrict",
          }),
        ],
        restrictions: [
          { key: "orderitem_uq", type: "UNIQUE", fields: ["orderitem_order_id", "orderitem_product_id"], dbName: "uq_order_product" },
        ],
      },
    ],
  },
};

export const SCENARIO_BLUEPRINTS: ScenarioBlueprint[] = [blogPlatform, taskTracker, ecommerceShop];

export function findBlueprint(id: string): ScenarioBlueprint | undefined {
  return SCENARIO_BLUEPRINTS.find((b) => b.id === id);
}
