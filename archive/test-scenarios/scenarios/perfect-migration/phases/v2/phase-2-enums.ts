import { api, PROJECT_NAME } from "../../client";

// Enum mutations for v2. Runs AFTER field mutations (Subscription.cycle already retyped to String).
//
// Schema warnings produced (v1→v2):
//   TaskStatus.CANCELLED removed   → enum.value_removed, data_deleted
//   Priority.LOW removed           → enum.value_removed, data_deleted
//   Priority.MEDIUM removed        → enum.value_removed, data_deleted
//   BillingCycle entire enum deleted → enum.removed, data_deleted
//
// Diff badges only (no schema warnings):
//   TaskStatus: ON_HOLD added      → values_changed (add only), warning badge
//   ShipmentStatus: PROCESSING added → values_changed (add only), warning badge
//   Visibility (new enum): PUBLIC, PRIVATE, DRAFT → enum.added, info badge

export async function mutateEnums(version: string) {
  const allEnums = await api.enums.list({ projectName: PROJECT_NAME, version });
  const byName = new Map(allEnums?.map((e) => [e.name, e]) ?? []);

  // ── TaskStatus: remove CANCELLED ─────────────────────────────────────────
  const taskStatus = byName.get("TaskStatus");
  if (taskStatus) {
    const cancelled = taskStatus.values.find((v) => v.name === "CANCELLED");
    if (cancelled) {
      await api.enums.deleteValue({
        projectName: PROJECT_NAME, version, enumName: "TaskStatus", valueId: cancelled.valueId,
      });
      console.log("  ✓ TaskStatus.CANCELLED removed (value_removed → data_deleted)");
    } else {
      console.log("  ✓ TaskStatus.CANCELLED already removed — skipping.");
    }

    // Add ON_HOLD (diff badge only)
    const refreshed = (await api.enums.list({ projectName: PROJECT_NAME, version }))
      ?.find((e) => e.name === "TaskStatus");
    if (!refreshed?.values.find((v) => v.name === "ON_HOLD")) {
      await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: "TaskStatus", value: "ON_HOLD" });
      console.log("  ✓ TaskStatus.ON_HOLD added (diff badge only)");
    } else {
      console.log("  ✓ TaskStatus.ON_HOLD already exists — skipping.");
    }
  }

  // ── Priority: remove LOW and MEDIUM ──────────────────────────────────────
  const priority = byName.get("Priority");
  if (priority) {
    for (const valueName of ["LOW", "MEDIUM"]) {
      const refreshedPriority = (await api.enums.list({ projectName: PROJECT_NAME, version }))
        ?.find((e) => e.name === "Priority");
      const val = refreshedPriority?.values.find((v) => v.name === valueName);
      if (val) {
        await api.enums.deleteValue({
          projectName: PROJECT_NAME, version, enumName: "Priority", valueId: val.valueId,
        });
        console.log(`  ✓ Priority.${valueName} removed (value_removed → data_deleted)`);
      } else {
        console.log(`  ✓ Priority.${valueName} already removed — skipping.`);
      }
    }
  }

  // ── BillingCycle: delete entire enum (field already retyped in phase-1) ──
  const billingCycleExists = byName.has("BillingCycle");
  const freshEnums = await api.enums.list({ projectName: PROJECT_NAME, version });
  if (freshEnums?.find((e) => e.name === "BillingCycle")) {
    await api.enums.delete({ projectName: PROJECT_NAME, version, name: "BillingCycle" });
    console.log("  ✓ BillingCycle enum deleted (enum.removed → data_deleted)");
  } else if (!billingCycleExists) {
    console.log("  ✓ BillingCycle already deleted — skipping.");
  }

  // ── ShipmentStatus: add PROCESSING (diff badge only) ─────────────────────
  const freshEnums2 = await api.enums.list({ projectName: PROJECT_NAME, version });
  const shipment = freshEnums2?.find((e) => e.name === "ShipmentStatus");
  if (shipment && !shipment.values.find((v) => v.name === "PROCESSING")) {
    await api.enums.addValue({
      projectName: PROJECT_NAME, version, enumName: "ShipmentStatus", value: "PROCESSING",
    });
    console.log("  ✓ ShipmentStatus.PROCESSING added (diff badge only)");
  } else {
    console.log("  ✓ ShipmentStatus.PROCESSING already exists — skipping.");
  }

  // ── Visibility: create new enum with PUBLIC, PRIVATE, DRAFT (diff badge only) ─
  const freshEnums3 = await api.enums.list({ projectName: PROJECT_NAME, version });
  if (!freshEnums3?.find((e) => e.name === "Visibility")) {
    await api.enums.create({ projectName: PROJECT_NAME, version, name: "Visibility" });
    for (const val of ["PUBLIC", "PRIVATE", "DRAFT"]) {
      await api.enums.addValue({ projectName: PROJECT_NAME, version, enumName: "Visibility", value: val });
    }
    console.log("  ✓ Visibility enum created with PUBLIC, PRIVATE, DRAFT (enum.added, diff badge only)");
  } else {
    console.log("  ✓ Visibility already exists — skipping.");
  }
}
