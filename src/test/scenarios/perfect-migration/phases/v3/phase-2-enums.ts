import { api, PROJECT_NAME } from "../../client";

// Enum mutations for v3. Runs AFTER field mutations (ContentType fields already retyped).
//
// Schema warnings produced (v2→v3):
//   AccountRole.OWNER removed       → enum.value_removed, data_deleted
//   ContentType entire enum deleted → enum.removed, data_deleted
//
// Diff badges only (no schema warnings):
//   TaskStatus: ARCHIVED added      → values_changed (add only), warning badge
//   ExportFormat (new): CSV, JSON, XML → enum.added, info badge

export async function mutateEnums(version: string) {
  // ── AccountRole: remove OWNER ─────────────────────────────────────────────
  const allEnums = await api.enums.list({ projectName: PROJECT_NAME, version });
  const accountRole = allEnums?.find((e) => e.name === "AccountRole");
  if (accountRole) {
    const owner = accountRole.values.find((v) => v.name === "OWNER");
    if (owner) {
      await api.enums.deleteValue({
        projectName: PROJECT_NAME, version, enumName: "AccountRole", valueId: owner.valueId,
      });
      console.log("  ✓ AccountRole.OWNER removed (value_removed → data_deleted)");
    } else {
      console.log("  ✓ AccountRole.OWNER already removed — skipping.");
    }
  }

  // ── ContentType: delete entire enum (fields already retyped in phase-1) ───
  const freshEnums1 = await api.enums.list({ projectName: PROJECT_NAME, version });
  if (freshEnums1?.find((e) => e.name === "ContentType")) {
    await api.enums.delete({ projectName: PROJECT_NAME, version, name: "ContentType" });
    console.log("  ✓ ContentType enum deleted (enum.removed → data_deleted)");
  } else {
    console.log("  ✓ ContentType already deleted — skipping.");
  }

  // ── TaskStatus: add ARCHIVED (diff badge only) ────────────────────────────
  const freshEnums2 = await api.enums.list({ projectName: PROJECT_NAME, version });
  const taskStatus = freshEnums2?.find((e) => e.name === "TaskStatus");
  if (taskStatus && !taskStatus.values.find((v) => v.name === "ARCHIVED")) {
    await api.enums.addValue({
      projectName: PROJECT_NAME, version, enumName: "TaskStatus", value: "ARCHIVED",
    });
    console.log("  ✓ TaskStatus.ARCHIVED added (diff badge only)");
  } else {
    console.log("  ✓ TaskStatus.ARCHIVED already exists — skipping.");
  }

  // ── ExportFormat: create new enum with CSV, JSON, XML (diff badge only) ───
  const freshEnums3 = await api.enums.list({ projectName: PROJECT_NAME, version });
  if (!freshEnums3?.find((e) => e.name === "ExportFormat")) {
    await api.enums.create({ projectName: PROJECT_NAME, version, name: "ExportFormat" });
    for (const val of ["CSV", "JSON", "XML"]) {
      await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: "ExportFormat", value: val });
    }
    console.log("  ✓ ExportFormat enum created with CSV, JSON, XML (enum.added, diff badge only)");
  } else {
    console.log("  ✓ ExportFormat already exists — skipping.");
  }
}
