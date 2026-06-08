import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { caller, DEFAULT_SCHEMA_OPTIONS } from "./helpers";

const PROJECT_NAME = "Test Exports Project";
const VERSION = "1.0111";
let projectId: string;

beforeAll(async () => {
  const p = await caller.projects.create({
    name: PROJECT_NAME,
    provider: "Postgres",
    schemaOptions: DEFAULT_SCHEMA_OPTIONS,
  });
  projectId = p.id;
  await caller.tables.create({
    projectName: PROJECT_NAME,
    version: VERSION,
    modelName: "User",
    pkName: "id",
    pkType: "Int",
  });
  await caller.fields.create({
    projectName: PROJECT_NAME,
    version: VERSION,
    modelName: "User",
    name: "email",
    type: "String",
    nullable: false,
    unique: true,
    defaultValue: "",
    comment: "",
    updatedAtAttribute: false,
    isId: false,
  });
});

afterAll(async () => {
  if (projectId) await caller.projects.delete({ id: projectId });
});

describe("exports.generate — prisma", () => {
  it("generates a valid Prisma schema string", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "prisma",
    });
    expect(result?.code).toBeDefined();
    expect(result?.code).toContain("model User");
    expect(result?.code).toContain("email");
    expect(result?.fileName).toMatch(/\.prisma$/);
  });
});

describe("exports.generate — drizzle", () => {
  it("generates a valid Drizzle TypeScript schema string", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "drizzle",
    });
    expect(result?.code).toBeDefined();
    expect(result?.code).toContain("user");
    expect(result?.fileName).toMatch(/\.ts$/);
    expect(result?.tableCount).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.generate — sqlalchemy", () => {
  it("generates a basic SQLAlchemy model from the shared project", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "sqlalchemy",
    });
    expect(result?.code).toBeDefined();
    expect(result?.code).toContain("class Base(DeclarativeBase):");
    expect(result?.code).toContain("class User(Base):");
    expect(result?.code).toContain('__tablename__ = "user"');
    expect(result?.code).toContain("from sqlalchemy.orm import");
    expect(result?.fileName).toMatch(/\.py$/);
    expect(result?.tableCount).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.generate — sql", () => {
  it("generates a plain SQL DDL script from the shared project", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "sql",
    });
    expect(result?.code).toBeDefined();
    expect(result?.code).toContain('CREATE TABLE "user"');
    expect(result?.code).toContain("PRIMARY KEY");
    expect(result?.code).toContain('"email"');
    expect(result?.fileName).toMatch(/\.sql$/);
    expect(result?.tableCount).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.generate — django", () => {
  it("generates a Django models.py from the shared project", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "django",
    });
    expect(result?.code).toBeDefined();
    expect(result?.code).toContain("from django.db import models");
    expect(result?.code).toContain("class User(models.Model):");
    expect(result?.code).toContain('db_table = "user"');
    expect(result?.fileName).toMatch(/\.py$/);
    expect(result?.tableCount).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.generate — sqlalchemy (relations + enum + native types)", () => {
  const SA_PROJECT = "Test SQLAlchemy Export";
  let saProjectId: string;

  beforeAll(async () => {
    const p = await caller.projects.create({
      name: SA_PROJECT,
      provider: "Postgres",
      schemaOptions: DEFAULT_SCHEMA_OPTIONS,
    });
    saProjectId = p.id;

    await caller.enums.create({ projectName: SA_PROJECT, version: VERSION, name: "Role" });
    await caller.enums.addValue({ projectName: SA_PROJECT, version: VERSION, enumName: "Role", value: "ADMIN" });
    await caller.enums.addValue({ projectName: SA_PROJECT, version: VERSION, enumName: "Role", value: "USER" });

    await caller.tables.create({ projectName: SA_PROJECT, version: VERSION, modelName: "User", pkName: "id", pkType: "Int" });
    await caller.fields.create({
      projectName: SA_PROJECT, version: VERSION, modelName: "User",
      name: "email", type: "String", nullable: false, unique: true,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    });
    await caller.fields.create({
      projectName: SA_PROJECT, version: VERSION, modelName: "User",
      name: "role", type: "Role", nullable: false, unique: false,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    });
    await caller.fields.create({
      projectName: SA_PROJECT, version: VERSION, modelName: "User",
      name: "createdAt", type: "DateTime", nullable: false, unique: false,
      defaultValue: "now()", comment: "", nativeAttribute: { name: "Timestamptz" },
      updatedAtAttribute: false, isId: false,
    });

    await caller.tables.create({ projectName: SA_PROJECT, version: VERSION, modelName: "Post", pkName: "id", pkType: "Int" });
    await caller.fields.create({
      projectName: SA_PROJECT, version: VERSION, modelName: "Post",
      name: "title", type: "String", nullable: false, unique: false,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    });
    await caller.relations.create({
      projectName: SA_PROJECT, version: VERSION, modelName: "Post",
      name: "author", targetModel: "User", backReferenceName: "posts",
      fields: ["authorId"], references: ["id"],
      onDelete: "Cascade", onUpdate: "",
      nullable: false, isArray: false, backReferenceIsArray: true,
    });
  });

  afterAll(async () => {
    if (saProjectId) await caller.projects.delete({ id: saProjectId });
  });

  it("renders enum class, FK + relationship pairs, and timezone-aware timestamp", async () => {
    const result = await caller.exports.generate({
      projectName: SA_PROJECT,
      version: VERSION,
      type: "sqlalchemy",
    });
    const code = result!.code!;

    // enum class + enum column
    expect(code).toContain("class Role(enum.Enum):");
    expect(code).toContain("ADMIN = ");
    expect(code).toContain("Enum(Role, name=");

    // both model classes
    expect(code).toContain("class User(Base):");
    expect(code).toContain("class Post(Base):");

    // foreign key on the scalar column, with ON DELETE mapped to SQL
    expect(code).toContain('ForeignKey("user.id", ondelete="CASCADE")');

    // bidirectional relationship() pairs resolved via back_populates
    expect(code).toContain('relationship(back_populates="posts")');
    expect(code).toContain('relationship(back_populates="author")');
    expect(code).toContain('Mapped[list["Post"]]');

    // native Timestamptz → timezone-aware DateTime with server_default
    expect(code).toContain("DateTime(timezone=True)");
    expect(code).toContain("server_default=func.now()");

    expect(result?.tableCount).toBeGreaterThanOrEqual(2);
    expect(result?.enumCount).toBeGreaterThanOrEqual(1);
  });

  it("emits syntactically valid Python (py_compile)", async () => {
    const result = await caller.exports.generate({
      projectName: SA_PROJECT,
      version: VERSION,
      type: "sqlalchemy",
    });
    const dir = mkdtempSync(join(tmpdir(), "sa-export-"));
    const file = join(dir, "models.py");
    writeFileSync(file, result!.code!, "utf8");
    // py_compile checks syntax only; it does not import sqlalchemy.
    expect(() => execFileSync("python3", ["-m", "py_compile", file], { stdio: "pipe" })).not.toThrow();
  });

  it("renders Postgres DDL with enum type, FK constraint, and timezone-aware timestamp", async () => {
    const result = await caller.exports.generate({
      projectName: SA_PROJECT,
      version: VERSION,
      type: "sql",
    });
    const code = result!.code!;

    // enum rendered as a standalone CREATE TYPE
    expect(code).toContain(`CREATE TYPE "role" AS ENUM ('ADMIN', 'USER')`);

    // both tables
    expect(code).toContain('CREATE TABLE "user"');
    expect(code).toContain('CREATE TABLE "post"');

    // single-column UNIQUE stays inline on the column (not duplicated as a constraint)
    expect(code).toMatch(/"email"[^\n]*UNIQUE/);

    // FK emitted as ALTER TABLE with the referential action mapped to SQL
    expect(code).toContain('ALTER TABLE "post" ADD CONSTRAINT');
    expect(code).toContain('FOREIGN KEY ("authorid") REFERENCES "user" ("id") ON DELETE CASCADE');

    // native Timestamptz → TIMESTAMPTZ, now() → CURRENT_TIMESTAMP
    expect(code).toContain("TIMESTAMPTZ");
    expect(code).toContain("DEFAULT CURRENT_TIMESTAMP");

    expect(result?.tableCount).toBeGreaterThanOrEqual(2);
    expect(result?.enumCount).toBeGreaterThanOrEqual(1);
  });

  it("renders Django models with TextChoices enum, ForeignKey, and auto_now_add", async () => {
    const result = await caller.exports.generate({
      projectName: SA_PROJECT,
      version: VERSION,
      type: "django",
    });
    const code = result!.code!;

    // single import + module-level TextChoices enum
    expect(code).toContain("from django.db import models");
    expect(code).toContain("class Role(models.TextChoices):");
    expect(code).toContain('ADMIN = "ADMIN", "Admin"');

    // both model classes with explicit db_table
    expect(code).toContain("class User(models.Model):");
    expect(code).toContain("class Post(models.Model):");
    expect(code).toContain('db_table = "user"');
    expect(code).toContain('db_table = "post"');

    // integer autoincrement PK → AutoField; enum column references choices
    expect(code).toContain("models.AutoField(primary_key=True)");
    expect(code).toContain("choices=Role.choices");

    // now() → auto_now_add
    expect(code).toContain("auto_now_add=True");

    // relation becomes a ForeignKey; the scalar FK column is NOT rendered separately
    expect(code).toContain('models.ForeignKey("User", on_delete=models.CASCADE, related_name="posts"');
    expect(code).not.toContain("author_id = models.");

    expect(result?.fileName).toMatch(/\.py$/);
    expect(result?.tableCount).toBeGreaterThanOrEqual(2);
    expect(result?.enumCount).toBeGreaterThanOrEqual(1);
  });

  it("emits syntactically valid Python for Django models (py_compile)", async () => {
    const result = await caller.exports.generate({
      projectName: SA_PROJECT,
      version: VERSION,
      type: "django",
    });
    const dir = mkdtempSync(join(tmpdir(), "dj-export-"));
    const file = join(dir, "models.py");
    writeFileSync(file, result!.code!, "utf8");
    // py_compile checks syntax only; it does not import django.
    expect(() => execFileSync("python3", ["-m", "py_compile", file], { stdio: "pipe" })).not.toThrow();
  });
});

describe("exports.generate — sql (SQLite executes the generated DDL)", () => {
  const LITE_PROJECT = "Test SQL SQLite Export";
  let liteId: string;

  beforeAll(async () => {
    const p = await caller.projects.create({
      name: LITE_PROJECT,
      provider: "SQLite",
      schemaOptions: DEFAULT_SCHEMA_OPTIONS,
    });
    liteId = p.id;

    await caller.enums.create({ projectName: LITE_PROJECT, version: VERSION, name: "Status" });
    await caller.enums.addValue({ projectName: LITE_PROJECT, version: VERSION, enumName: "Status", value: "ACTIVE" });
    await caller.enums.addValue({ projectName: LITE_PROJECT, version: VERSION, enumName: "Status", value: "ARCHIVED" });

    await caller.tables.create({ projectName: LITE_PROJECT, version: VERSION, modelName: "Account", pkName: "id", pkType: "Int" });
    await caller.fields.create({
      projectName: LITE_PROJECT, version: VERSION, modelName: "Account",
      name: "email", type: "String", nullable: false, unique: true,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    });
    await caller.fields.create({
      projectName: LITE_PROJECT, version: VERSION, modelName: "Account",
      name: "status", type: "Status", nullable: false, unique: false,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    });

    await caller.tables.create({ projectName: LITE_PROJECT, version: VERSION, modelName: "Note", pkName: "id", pkType: "Int" });
    await caller.fields.create({
      projectName: LITE_PROJECT, version: VERSION, modelName: "Note",
      name: "body", type: "String", nullable: false, unique: false,
      defaultValue: "", comment: "", updatedAtAttribute: false, isId: false,
    });
    await caller.relations.create({
      projectName: LITE_PROJECT, version: VERSION, modelName: "Note",
      name: "account", targetModel: "Account", backReferenceName: "notes",
      fields: ["accountId"], references: ["id"],
      onDelete: "Cascade", onUpdate: "",
      nullable: false, isArray: false, backReferenceIsArray: true,
    });
  });

  afterAll(async () => {
    if (liteId) await caller.projects.delete({ id: liteId });
  });

  it("produces SQLite DDL that executes against a fresh database", async () => {
    const result = await caller.exports.generate({
      projectName: LITE_PROJECT,
      version: VERSION,
      type: "sql",
    });
    const code = result!.code!;

    expect(code).toContain('CREATE TABLE "account"');
    expect(code).toContain('CREATE TABLE "note"');
    // enum becomes a TEXT column constrained by CHECK
    expect(code).toContain(`CHECK ("status" IN ('ACTIVE', 'ARCHIVED'))`);
    // SQLite inlines the FK — no ALTER TABLE ADD CONSTRAINT, no Postgres-only constructs
    expect(code).toContain('FOREIGN KEY ("accountid") REFERENCES "account" ("id") ON DELETE CASCADE');
    expect(code).not.toContain("ALTER TABLE");
    expect(code).not.toContain("TIMESTAMPTZ");
    expect(code).not.toContain("CREATE TYPE");

    // The real check: the script runs as-is against a fresh SQLite database.
    const db = new Database(":memory:");
    try {
      expect(() => db.exec(code)).not.toThrow();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as { name: string }[];
      const names = tables.map((t) => t.name);
      expect(names).toContain("account");
      expect(names).toContain("note");
    } finally {
      db.close();
    }
  });
});

describe("exports.generate — pickle-version", () => {
  it("generates a version pickle JSON", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "pickle-version",
    });
    expect(result?.code).toBeDefined();
    const parsed = JSON.parse(result!.code!);
    expect(parsed.pickleVersion).toBe(1);
    expect(parsed.type).toBe("version");
    expect(parsed.project.name).toBe(PROJECT_NAME);
    expect(parsed.version.tables.length).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.generate — pickle-project", () => {
  it("generates a project pickle JSON with all versions", async () => {
    const result = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "pickle-project",
    });
    expect(result?.code).toBeDefined();
    const parsed = JSON.parse(result!.code!);
    expect(parsed.pickleVersion).toBe(1);
    expect(parsed.type).toBe("project");
    expect(Array.isArray(parsed.versions)).toBe(true);
    expect(parsed.versions.length).toBeGreaterThanOrEqual(1);
  });
});

describe("exports.list", () => {
  it("returns an array for the project (may be empty since pickles aren't logged)", async () => {
    const history = await caller.exports.list({ projectName: PROJECT_NAME });
    expect(Array.isArray(history)).toBe(true);
  });
});

describe("exports.markDownloaded + reset", () => {
  it("marks an export as downloaded and it appears in history", async () => {
    const gen = await caller.exports.generate({
      projectName: PROJECT_NAME,
      version: VERSION,
      type: "prisma",
    });
    const exportId = (gen as { id?: string } | undefined)?.id;
    expect(exportId).toBeDefined();

    await caller.exports.markDownloaded({ id: exportId! });

    const history = await caller.exports.list({ projectName: PROJECT_NAME });
    expect(history.some((r) => r.id === exportId)).toBe(true);
  });

  it("reset clears download history", async () => {
    await caller.exports.reset({ projectName: PROJECT_NAME });
    const history = await caller.exports.list({ projectName: PROJECT_NAME });
    expect(history).toHaveLength(0);
  });
});
