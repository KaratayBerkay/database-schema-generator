import { api, PROJECT_NAME, V1_VERSION } from "../../client";

// 6 enums:
//   AccountRole   — VIEWER, EDITOR, MANAGER, ADMIN, OWNER       (OWNER removed in v3)
//   TaskStatus    — BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED  (CANCELLED removed in v2; ON_HOLD added v2; ARCHIVED added v3)
//   Priority      — LOW, MEDIUM, HIGH, CRITICAL                 (LOW + MEDIUM removed in v2)
//   ContentType   — ARTICLE, VIDEO, PODCAST, GUIDE, TUTORIAL    (entire enum deleted in v3 after field retypes)
//   BillingCycle  — MONTHLY, QUARTERLY, ANNUALLY                (entire enum deleted in v2 after field retype)
//   ShipmentStatus— PENDING, PACKED, SHIPPED, DELIVERED, RETURNED (PROCESSING added in v2)

const ENUMS: Record<string, string[]> = {
  AccountRole:    ["VIEWER", "EDITOR", "MANAGER", "ADMIN", "OWNER"],
  TaskStatus:     ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "CANCELLED"],
  Priority:       ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
  ContentType:    ["ARTICLE", "VIDEO", "PODCAST", "GUIDE", "TUTORIAL"],
  BillingCycle:   ["MONTHLY", "QUARTERLY", "ANNUALLY"],
  ShipmentStatus: ["PENDING", "PACKED", "SHIPPED", "DELIVERED", "RETURNED"],
};

export async function setupEnums() {
  const existing = await api.enums.list({ projectName: PROJECT_NAME, version: V1_VERSION });
  const existingNames = new Set(existing?.map((e) => e.name) ?? []);

  for (const [enumName, values] of Object.entries(ENUMS)) {
    if (!existingNames.has(enumName)) {
      await api.enums.create({ projectName: PROJECT_NAME, version: V1_VERSION, name: enumName });
      console.log(`  ✓ Created enum ${enumName}`);
    } else {
      console.log(`  ✓ ${enumName} already exists — skipping create.`);
    }

    const refreshed = await api.enums.list({ projectName: PROJECT_NAME, version: V1_VERSION });
    const enumRow = refreshed?.find((e) => e.name === enumName);
    const existingValues = new Set(enumRow?.values.map((v) => v.name) ?? []);

    for (const val of values) {
      if (!existingValues.has(val)) {
        await api.enums.addValue({
          projectName: PROJECT_NAME, version: V1_VERSION,
          enumName, value: val,
        });
        console.log(`    + ${enumName}.${val}`);
      }
    }
  }
}
