import { api, PROJECT_NAME } from "../../client";

// Field mutations for v3. Runs BEFORE enum mutations because Product.contentType and
// Article.contentType must be retyped to String before the ContentType enum is deleted.
//
// Schema warnings produced (v2→v3):
//   Product.contentType     type_changed   → data_deleted    (ContentType→String)
//   Article.contentType     type_changed   → data_deleted    (ContentType→String)
//   Sprint.goal             nullability_changed → backfill_required (optional→required)
//   Sprint.capacity         added (required) → backfill_required
//   Product.stock           default_changed → backfill_required (default 0 removed)
//
// Diff badges only (no schema warnings):
//   Comment.body            nullability_changed → info badge (required→optional)
//   Tag.colorHex            added (optional)    → info badge

async function fieldNames(version: string, modelName: string): Promise<Set<string>> {
  const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName });
  return new Set(res?.fields.map((f) => f.name) ?? []);
}

async function fieldList(version: string, modelName: string) {
  const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName });
  return res?.fields ?? [];
}

export async function mutateFields(version: string) {
  // ── Product: contentType ContentType → String (MUST run before enum delete) ─
  const productFields1 = await fieldList(version, "Product");
  const contentType = productFields1.find((f) => f.name === "contentType");
  if (contentType && contentType.type !== "String") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Product",
      oldFieldName: "contentType", name: "contentType", type: "String",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Product.contentType: ContentType → String (type_changed → data_deleted)");
  } else if (contentType?.type === "String") {
    console.log("  ✓ Product.contentType already String — skipping.");
  }

  // ── Article: contentType ContentType → String (MUST run before enum delete) ─
  const articleFields1 = await fieldList(version, "Article");
  const articleContentType = articleFields1.find((f) => f.name === "contentType");
  if (articleContentType && articleContentType.type !== "String") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Article",
      oldFieldName: "contentType", name: "contentType", type: "String",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Article.contentType: ContentType → String (type_changed → data_deleted)");
  } else if (articleContentType?.type === "String") {
    console.log("  ✓ Article.contentType already String — skipping.");
  }

  // ── Sprint: goal optional → required ─────────────────────────────────────
  const sprintFields = await fieldList(version, "Sprint");
  const goal = sprintFields.find((f) => f.name === "goal");
  if (goal && goal.nullable) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Sprint",
      oldFieldName: "goal", name: "goal", type: "String",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Sprint.goal: optional → required (nullability_changed → backfill_required)");
  } else if (goal && !goal.nullable) {
    console.log("  ✓ Sprint.goal already required — skipping.");
  }

  // ── Sprint: add capacity Int required no default ──────────────────────────
  const sprintNames = await fieldNames(version, "Sprint");
  if (!sprintNames.has("capacity")) {
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Sprint",
      name: "capacity", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Added Sprint.capacity (Int required, no default → backfill_required)");
  } else {
    console.log("  ✓ Sprint.capacity already exists — skipping.");
  }

  // ── Product: remove default from stock (stays required Int) ──────────────
  const productFields2 = await fieldList(version, "Product");
  const stock = productFields2.find((f) => f.name === "stock");
  if (stock && stock.defaultValue !== "") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Product",
      oldFieldName: "stock", name: "stock", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Product.stock: default 0 removed (default_changed → backfill_required)");
  } else if (stock?.defaultValue === "") {
    console.log("  ✓ Product.stock default already removed — skipping.");
  }

  // ── Comment: body required → optional (diff badge only, info) ────────────
  const commentFields = await fieldList(version, "Comment");
  const body = commentFields.find((f) => f.name === "body");
  if (body && !body.nullable) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Comment",
      oldFieldName: "body", name: "body", type: "String",
      nullable: true, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Comment.body: required → optional (nullability_changed, diff badge only)");
  } else if (body?.nullable) {
    console.log("  ✓ Comment.body already optional — skipping.");
  }

  // ── Tag: add colorHex String? optional (diff badge only, info) ───────────
  const tagNames = await fieldNames(version, "Tag");
  if (!tagNames.has("colorHex")) {
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Tag",
      name: "colorHex", type: "String",
      nullable: true, unique: false, defaultValue: "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Added Tag.colorHex (String? optional → added, diff badge only)");
  } else {
    console.log("  ✓ Tag.colorHex already exists — skipping.");
  }
}
