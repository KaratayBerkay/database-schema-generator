import { describe, it, expect, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";
import { analyzeImportSchema } from "@/lib/stores/schema-store";

const SOURCE_PROJECT = "Import Source Alpha";
const VERSION = "1.0111";

let sourceProjectId: string;
let importedVersionProjectId: string;
let importedProjectProjectId: string;
let dbImportProjectId: string;

// An introspected schema that violates several of the app's rules: a Boolean @unique, an
// unsupported column type, and a table with no primary key.
const DB_IMPORT_PRISMA = `
datasource db {
  provider = "postgresql"
}

model GoodUser {
  id          Int      @id
  email       String   @unique
  active      Boolean  @unique
  shape       Geometry
  role        Role
  created_at  DateTime?
  account_ref String   @unique
}

model NoPkTable {
  label String
}

enum Role {
  ADMIN
  USER
}
`;

const setupSourceProject = async () => {
  if (sourceProjectId) return;
  const p = await caller.projects.create({
    name: SOURCE_PROJECT,
    provider: "Postgres",
    schemaOptions: DEFAULT_SCHEMA_OPTIONS,
  });
  sourceProjectId = p.id;
  await caller.tables.create({
    projectName: SOURCE_PROJECT,
    version: VERSION,
    modelName: "Order",
    pkName: "id",
    pkType: "Int",
  });
  await caller.fields.create({
    projectName: SOURCE_PROJECT,
    version: VERSION,
    modelName: "Order",
    name: "total",
    type: "Float",
    nullable: false,
    unique: false,
    defaultValue: "",
    comment: "",
    updatedAtAttribute: false,
    isId: false,
  });
};

afterAll(async () => {
  const ids = [sourceProjectId, importedVersionProjectId, importedProjectProjectId, dbImportProjectId].filter(Boolean);
  for (const id of ids) {
    try { await caller.projects.delete({ id }); } catch { /* best-effort cleanup */ }
  }
});

describe("imports — version pickle round-trip", () => {
  it("exports a version pickle and re-imports it as a new project", async () => {
    await setupSourceProject();

    const exported = await caller.exports.generate({
      projectName: SOURCE_PROJECT,
      version: VERSION,
      type: "pickle-version",
    });
    expect(exported?.code).toBeDefined();

    const result = await caller.imports.importVersion({
      content: exported!.code!,
      projectName: "Imported Version Beta",
    });

    expect(result?.projectId).toBeDefined();
    importedVersionProjectId = result!.projectId;
    expect(result?.versionName).toBeDefined();
    expect(result?.stats.tableCount).toBeGreaterThanOrEqual(1);
    expect(result?.stats.fieldCount).toBeGreaterThanOrEqual(1);
  });

  it("imported project appears in project list", async () => {
    const projects = await caller.projects.list();
    expect(projects.some((p) => p.id === importedVersionProjectId)).toBe(true);
  });

  it("imported project tables are queryable", async () => {
    const projects = await caller.projects.list();
    const imported = projects.find((p) => p.id === importedVersionProjectId);
    expect(imported).toBeDefined();

    const versionName = imported!.versions[0]?.name;
    expect(versionName).toBeDefined();

    const schema = await caller.tables.list({
      projectName: imported!.name,
      version: versionName!,
    });
    expect(schema?.some((m) => m.name === "Order")).toBe(true);
  });
});

describe("imports — project pickle round-trip", () => {
  it("exports a project pickle and re-imports it as a new project", async () => {
    await setupSourceProject();

    const exported = await caller.exports.generate({
      projectName: SOURCE_PROJECT,
      version: VERSION,
      type: "pickle-project",
    });
    expect(exported?.code).toBeDefined();

    const result = await caller.imports.importProject({
      content: exported!.code!,
      projectName: "Imported Project Gamma",
    });

    expect(result?.projectId).toBeDefined();
    importedProjectProjectId = result!.projectId;
    expect(result?.versionCount).toBeGreaterThanOrEqual(1);
  });
});

describe("imports.parse", () => {
  it("parses a version pickle without importing", async () => {
    await setupSourceProject();

    const exported = await caller.exports.generate({
      projectName: SOURCE_PROJECT,
      version: VERSION,
      type: "pickle-version",
    });

    const summary = await caller.imports.parse({ content: exported!.code! });
    expect(summary?.type).toBe("version");
    expect(summary?.sourceProjectName).toBe(SOURCE_PROJECT);
    expect(summary?.versionCount).toBe(1);
  });

  it("rejects invalid JSON", async () => {
    await expect(
      caller.imports.parse({ content: "not json at all" }),
    ).rejects.toThrow();
  });

  it("rejects wrong pickle version", async () => {
    const bad = JSON.stringify({ pickleVersion: 99, type: "version", project: {}, version: {} });
    await expect(
      caller.imports.parse({ content: bad }),
    ).rejects.toThrow();
  });
});

describe("imports — database schema compatibility", () => {
  it("auto-fixes and reports incompatibilities (pure analyze)", () => {
    const analysis = analyzeImportSchema(DB_IMPORT_PRISMA);
    expect(analysis.provider).toBe("postgresql");
    expect(analysis.report.modelsIncluded).toContain("GoodUser");
    expect(analysis.report.modelsIncluded).not.toContain("NoPkTable");
    expect(analysis.report.modelsSkipped).toContain("NoPkTable");
    // unsupported scalar type coerced to String
    expect(analysis.report.entries.some(
      (e) => e.level === "coerced" && e.scope === "field" && e.model === "GoodUser" && e.field === "shape",
    )).toBe(true);
    // Boolean @unique dropped
    expect(analysis.report.entries.some(
      (e) => e.level === "coerced" && e.scope === "restriction" && e.field === "active",
    )).toBe(true);
  });

  it("creates a project with version-0 (raw) and a rules-applied version", async () => {
    const result = await caller.imports.importFromDatabase({
      projectName: "DB Import Project One",
      content: DB_IMPORT_PRISMA,
    });
    expect(result?.projectId).toBeDefined();
    dbImportProjectId = result!.projectId;
    expect(result?.originalVersion).toBe("0");
    expect(result?.rulesVersion).toBeDefined();
    expect(result?.stats.tableCount).toBe(1); // rules version: GoodUser only

    // version-0 = imported as-is: keeps the PK-less table and the original (unsupported) type.
    const v0 = await caller.tables.list({ projectName: result!.projectName, version: "0" });
    expect(v0?.some((m) => m.name === "GoodUser")).toBe(true);
    expect(v0?.some((m) => m.name === "NoPkTable")).toBe(true);
    const v0fields = await caller.fields.list({ projectName: result!.projectName, version: "0", modelName: "GoodUser" });
    expect(v0fields?.fields.find((f) => f.name === "shape")?.type).toBe("Geometry"); // raw, not coerced

    // rules-applied version: rules dropped the PK-less table and coerced the unsupported type.
    const v1 = await caller.tables.list({ projectName: result!.projectName, version: result!.rulesVersion });
    expect(v1?.some((m) => m.name === "GoodUser")).toBe(true);
    expect(v1?.some((m) => m.name === "NoPkTable")).toBe(false);
    const v1fields = await caller.fields.list({ projectName: result!.projectName, version: result!.rulesVersion, modelName: "GoodUser" });
    expect(v1fields?.fields.find((f) => f.name === "shape")?.type).toBe("String"); // coerced
    expect(v1fields?.fields.find((f) => f.name === "active")?.unique).toBe(false); // boolean unique dropped
    expect(v1fields?.fields.some((f) => f.dbName === "created_at")).toBe(true); // physical name preserved
    // A @unique on a snake_case column must survive conversion (Prisma names resolve to keys).
    expect(v1fields?.fields.find((f) => f.dbName === "account_ref")?.unique).toBe(true);
  });

  it("version-0 is read-only — edits are rejected, the rules version is editable", async () => {
    const proj = (await caller.projects.list()).find((p) => p.id === dbImportProjectId)!;
    const rulesVersion = proj.versions.find((v) => v.name !== "0")!.name;
    const field = {
      modelName: "GoodUser", name: "note", type: "String", nullable: true, unique: false,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    };

    await expect(
      caller.fields.create({ projectName: proj.name, version: "0", ...field }),
    ).rejects.toThrow(/read-only|version-0/i);

    const ok = await caller.fields.create({ projectName: proj.name, version: rulesVersion, ...field });
    expect(ok).toBeDefined();
  });

  it("rejects a too-short new project name", async () => {
    await expect(
      caller.imports.importFromDatabase({ projectName: "short", content: DB_IMPORT_PRISMA }),
    ).rejects.toThrow();
  });
});
