import { api, PROJECT_NAME } from "../../client";

// Field mutations for v2. Runs BEFORE enum mutations because Subscription.cycle
// must be retyped String before the BillingCycle enum is deleted.
//
// Schema warnings produced (v1→v2):
//   Account.plan             removed          → data_deleted
//   Account.isVerified       default_changed  → backfill_required
//   Account.reputation       added (required) → backfill_required
//   Account.username→handle  multiple         → lossy_convert   (rename + String→Int)
//   Account.credits          type_changed     → precision_loss  (Float→Int, keep default 0)
//   Profile.bio              nullability_changed → backfill_required (optional→required)
//   Task.storyPoints         nullability_changed → backfill_required (optional→required)
//   Task.threadRef→sequenceId multiple        → lossy_convert   (rename + String→Int)
//   Article.body             removed          → data_deleted
//   Article.wordCount        added (required) → backfill_required
//   Article.title→headline   renamed          → (diff badge only, no warning)
//   Subscription.cycle       type_changed     → data_deleted    (BillingCycle→String)

async function fieldNames(version: string, modelName: string): Promise<Set<string>> {
  const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName });
  return new Set(res?.fields.map((f) => f.name) ?? []);
}

async function fieldList(version: string, modelName: string) {
  const res = await api.fields.list({ projectName: PROJECT_NAME, version, modelName });
  return res?.fields ?? [];
}

export async function mutateFields(version: string) {
  // ── Account: delete plan ─────────────────────────────────────────────────
  const accountNames1 = await fieldNames(version, "Account");
  if (accountNames1.has("plan")) {
    await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Account", fieldName: "plan" });
    console.log("  ✓ Deleted Account.plan (removed → data_deleted)");
  } else {
    console.log("  ✓ Account.plan already removed — skipping.");
  }

  // ── Account: remove default from isVerified (stays required Boolean) ─────
  const accountFields2 = await fieldList(version, "Account");
  const isVerified = accountFields2.find((f) => f.name === "isVerified");
  if (isVerified && isVerified.defaultValue !== "") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Account",
      oldFieldName: "isVerified", name: "isVerified", type: "Boolean",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Account.isVerified: default removed (default_changed → backfill_required)");
  } else if (isVerified?.defaultValue === "") {
    console.log("  ✓ Account.isVerified default already removed — skipping.");
  }

  // ── Account: add reputation Int required no default ───────────────────────
  const accountNames3 = await fieldNames(version, "Account");
  if (!accountNames3.has("reputation")) {
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Account",
      name: "reputation", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Added Account.reputation (Int required, no default → backfill_required)");
  } else {
    console.log("  ✓ Account.reputation already exists — skipping.");
  }

  // ── Account: rename username→handle + type String→Int (multiple) ─────────
  const accountNames4 = await fieldNames(version, "Account");
  if (accountNames4.has("username") && !accountNames4.has("handle")) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Account",
      oldFieldName: "username", name: "handle", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Account.username → handle (String→Int, multiple → lossy_convert)");
  } else if (accountNames4.has("handle")) {
    console.log("  ✓ Account.handle already renamed — skipping.");
  }

  // ── Account: credits Float → Int (keep default 0 → precision_loss) ───────
  const accountFields5 = await fieldList(version, "Account");
  const credits = accountFields5.find((f) => f.name === "credits");
  if (credits && credits.type !== "Int") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Account",
      oldFieldName: "credits", name: "credits", type: "Int",
      nullable: false, unique: false, defaultValue: "0", comment: "",
    });
    console.log("  ✓ Account.credits: Float → Int (type_changed → precision_loss)");
  } else if (credits?.type === "Int") {
    console.log("  ✓ Account.credits already Int — skipping.");
  }

  // ── Profile: bio optional → required ─────────────────────────────────────
  const profileFields = await fieldList(version, "Profile");
  const bio = profileFields.find((f) => f.name === "bio");
  if (bio && bio.nullable) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Profile",
      oldFieldName: "bio", name: "bio", type: "String",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Profile.bio: optional → required (nullability_changed → backfill_required)");
  } else if (bio && !bio.nullable) {
    console.log("  ✓ Profile.bio already required — skipping.");
  }

  // ── Task: storyPoints optional → required ─────────────────────────────────
  const taskFields1 = await fieldList(version, "Task");
  const storyPoints = taskFields1.find((f) => f.name === "storyPoints");
  if (storyPoints && storyPoints.nullable) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Task",
      oldFieldName: "storyPoints", name: "storyPoints", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Task.storyPoints: optional → required (nullability_changed → backfill_required)");
  } else if (storyPoints && !storyPoints.nullable) {
    console.log("  ✓ Task.storyPoints already required — skipping.");
  }

  // ── Task: rename threadRef→sequenceId + String→Int (multiple) ────────────
  const taskNames2 = await fieldNames(version, "Task");
  if (taskNames2.has("threadRef") && !taskNames2.has("sequenceId")) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Task",
      oldFieldName: "threadRef", name: "sequenceId", type: "Int",
      nullable: true, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Task.threadRef → sequenceId (String→Int, multiple → lossy_convert)");
  } else if (taskNames2.has("sequenceId")) {
    console.log("  ✓ Task.sequenceId already renamed — skipping.");
  }

  // ── Article: delete body ──────────────────────────────────────────────────
  const articleNames1 = await fieldNames(version, "Article");
  if (articleNames1.has("body")) {
    await api.fields.delete({ projectName: PROJECT_NAME, version, modelName: "Article", fieldName: "body" });
    console.log("  ✓ Deleted Article.body (removed → data_deleted)");
  } else {
    console.log("  ✓ Article.body already removed — skipping.");
  }

  // ── Article: add wordCount Int required no default ────────────────────────
  const articleNames2 = await fieldNames(version, "Article");
  if (!articleNames2.has("wordCount")) {
    await api.fields.create({
      projectName: PROJECT_NAME, version, modelName: "Article",
      name: "wordCount", type: "Int",
      nullable: false, unique: false, defaultValue: "", comment: "",
      updatedAtAttribute: false, isId: false,
    });
    console.log("  ✓ Added Article.wordCount (Int required, no default → backfill_required)");
  } else {
    console.log("  ✓ Article.wordCount already exists — skipping.");
  }

  // ── Article: rename title → headline (diff badge only, no schema warning) ─
  const articleNames3 = await fieldNames(version, "Article");
  if (articleNames3.has("title") && !articleNames3.has("headline")) {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Article",
      oldFieldName: "title", name: "headline", type: "String",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Article.title → headline (renamed, diff badge only)");
  } else if (articleNames3.has("headline")) {
    console.log("  ✓ Article.headline already renamed — skipping.");
  }

  // ── Subscription: cycle BillingCycle → String (MUST run before enum delete) ─
  const subFields = await fieldList(version, "Subscription");
  const cycle = subFields.find((f) => f.name === "cycle");
  if (cycle && cycle.type !== "String") {
    await api.fields.update({
      projectName: PROJECT_NAME, version, modelName: "Subscription",
      oldFieldName: "cycle", name: "cycle", type: "String",
      nullable: false, unique: false, defaultValue: "", comment: "",
    });
    console.log("  ✓ Subscription.cycle: BillingCycle → String (type_changed → data_deleted)");
  } else if (cycle?.type === "String") {
    console.log("  ✓ Subscription.cycle already String — skipping.");
  }
}
