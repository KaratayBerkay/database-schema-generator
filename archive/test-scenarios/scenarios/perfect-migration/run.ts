import { createProject } from "./phases/v1/phase-1-project";
import { setupEnums } from "./phases/v1/phase-2-enums";
import { createTables } from "./phases/v1/phase-3-tables";
import { addFields } from "./phases/v1/phase-4-fields";
import { addRelations } from "./phases/v1/phase-5-relations";
import { addRestrictions } from "./phases/v1/phase-6-restrictions";

import { forkToV2 } from "./phases/v2/phase-0-fork";
import { mutateFields as mutateFieldsV2 } from "./phases/v2/phase-1-fields";
import { mutateEnums as mutateEnumsV2 } from "./phases/v2/phase-2-enums";
import { mutateTables as mutateTablesV2 } from "./phases/v2/phase-3-tables";
import { mutateRelations as mutateRelationsV2 } from "./phases/v2/phase-4-relations";
import { mutateRestrictions as mutateRestrictionsV2 } from "./phases/v2/phase-5-restrictions";

import { forkToV3 } from "./phases/v3/phase-0-fork";
import { mutateFields as mutateFieldsV3 } from "./phases/v3/phase-1-fields";
import { mutateEnums as mutateEnumsV3 } from "./phases/v3/phase-2-enums";
import { mutateTables as mutateTablesV3 } from "./phases/v3/phase-3-tables";
import { mutateRelations as mutateRelationsV3 } from "./phases/v3/phase-4-relations";
import { mutateRestrictions as mutateRestrictionsV3 } from "./phases/v3/phase-5-restrictions";

import { PROJECT_NAME } from "./client";

const versionArg = process.argv[3];

if (versionArg && !["v1", "v2", "v3"].includes(versionArg)) {
  console.error(`Unknown version "${versionArg}". Use v1, v2, or v3 (or omit to run all).`);
  process.exit(1);
}

const runV1 = !versionArg || versionArg === "v1";
const runV2 = !versionArg || versionArg === "v2";
const runV3 = !versionArg || versionArg === "v3";

async function main() {
  console.log("=".repeat(60));
  console.log(` Perfect Migration Scenario — "${PROJECT_NAME}"`);
  if (versionArg) console.log(` Running: ${versionArg.toUpperCase()} only`);
  console.log("=".repeat(60));
  console.log(" Coverage: 22 tables · 6 enums · 27 relations · 15 restrictions");
  console.log(" Warnings: 19 schema_warnings v1→v2, 10 schema_warnings v2→v3");
  console.log(" All 5 resolution types · All 5 entity kinds · All diff badge types");
  console.log("=".repeat(60));

  if (runV1) {
    console.log("\n── V1 (baseline) ──────────────────────────────────────────");

    console.log("\n[ Phase 1 — Project ]");
    await createProject();

    console.log("\n[ Phase 2 — Enums ]");
    await setupEnums();

    console.log("\n[ Phase 3 — Tables ]");
    await createTables();

    console.log("\n[ Phase 4 — Fields ]");
    await addFields();

    console.log("\n[ Phase 5 — Relations ]");
    await addRelations();

    console.log("\n[ Phase 6 — Restrictions ]");
    await addRestrictions();
  }

  if (runV2) {
    console.log("\n── V2 (first mutations) ────────────────────────────────────");
    console.log("   Fields run before enums — Subscription.cycle retyped before BillingCycle deleted.");

    console.log("\n[ Phase 0 — Fork v1 → v2 ]");
    const v2 = await forkToV2();

    console.log("\n[ Phase 1 — Fields (runs first: enum-dependent retypes) ]");
    await mutateFieldsV2(v2);

    console.log("\n[ Phase 2 — Enums ]");
    await mutateEnumsV2(v2);

    console.log("\n[ Phase 3 — Tables ]");
    await mutateTablesV2(v2);

    console.log("\n[ Phase 4 — Relations ]");
    await mutateRelationsV2(v2);

    console.log("\n[ Phase 5 — Restrictions ]");
    await mutateRestrictionsV2(v2);
  }

  if (runV3) {
    console.log("\n── V3 (second mutations) ───────────────────────────────────");
    console.log("   Fields run before enums — ContentType fields retyped before enum deleted.");

    console.log("\n[ Phase 0 — Fork v2 → v3 ]");
    const v3 = await forkToV3();

    console.log("\n[ Phase 1 — Fields (runs first: enum-dependent retypes) ]");
    await mutateFieldsV3(v3);

    console.log("\n[ Phase 2 — Enums ]");
    await mutateEnumsV3(v3);

    console.log("\n[ Phase 3 — Tables ]");
    await mutateTablesV3(v3);

    console.log("\n[ Phase 4 — Relations ]");
    await mutateRelationsV3(v3);

    console.log("\n[ Phase 5 — Restrictions ]");
    await mutateRestrictionsV3(v3);
  }

  console.log("\n" + "=".repeat(60));
  console.log(" Done. Data persists in app.db.");
  console.log(` Open the app → navigate to "${PROJECT_NAME}"`);
  console.log(" V2 selected: check Enums / Tables / Schema / Relations / Restrictions");
  console.log(" V3 selected: check Tables (Invoice pk_type_changed) / Tracking");
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("\nScenario failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
