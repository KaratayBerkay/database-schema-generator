import type { graphToCanonicalStore } from "@/lib/schema-db/graph";
import { isInternalMigrationField, normalizeDatabaseIdentifier } from "@/lib/domain/schema-naming";

// ─── types ──────────────────────────────────────────────────────────────────────

type Store = ReturnType<typeof graphToCanonicalStore>;
type Model = Store["models"][number];
type Field = Model["fields"][number];
type EnumDef = NonNullable<Store["enums"]>[number];

type NativeConstraint = { type: "NATIVE"; name: string; args?: string[] };

// ─── helpers ──────────────────────────────────────────────────────────────────

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

// Quote an identifier for the target dialect: backticks for MySQL, double quotes otherwise.
function quoteId(name: string, provider: string): string {
  if (provider === "mysql") return `\`${name.replace(/`/g, "``")}\``;
  return `"${name.replace(/"/g, '""')}"`;
}

// Quote a string literal (single quotes, SQL-standard doubling to escape).
function quoteStr(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function nativeOf(constraints: Field["constraints"]): NativeConstraint | undefined {
  return constraints.find((c): c is NativeConstraint => c.type === "NATIVE");
}

function columnDbName(field: Field): string {
  return field.dbName || normalizeDatabaseIdentifier(field.name);
}

// Prisma referential actions → SQL ON DELETE/UPDATE keywords.
function sqlAction(action: string): string {
  switch (action.trim().toLowerCase().replace(/[\s_]+/g, "")) {
    case "cascade": return "CASCADE";
    case "setnull": return "SET NULL";
    case "setdefault": return "SET DEFAULT";
    case "restrict": return "RESTRICT";
    case "noaction": return "NO ACTION";
    default: return action.toUpperCase();
  }
}

// ─── type mapping ───────────────────────────────────────────────────────────────

function sqlType(field: Field, provider: string, enumByName: Map<string, EnumDef>): string {
  const type = field.type;

  const enumDef = enumByName.get(type);
  if (enumDef) {
    if (provider === "postgresql") return quoteId(toSnakeCase(type), provider);
    if (provider === "mysql") return `ENUM(${enumDef.values.map((v) => quoteStr(v.dbName || v.name)).join(", ")})`;
    return "TEXT"; // sqlite — constrained with a CHECK at the column level
  }

  const native = nativeOf(field.constraints);

  switch (type) {
    case "integer":
      if (native?.name === "SmallInt") return provider === "sqlite" ? "INTEGER" : "SMALLINT";
      return provider === "mysql" ? "INT" : "INTEGER";
    case "bigint":
      return provider === "sqlite" ? "INTEGER" : "BIGINT";
    case "float":
      return provider === "postgresql" ? "DOUBLE PRECISION" : provider === "mysql" ? "DOUBLE" : "REAL";
    case "decimal":
      return provider === "sqlite" ? "DECIMAL" : "DECIMAL(65,30)";
    case "boolean":
      return provider === "postgresql" ? "BOOLEAN" : provider === "mysql" ? "TINYINT(1)" : "INTEGER";
    case "timestamp":
      if (provider === "postgresql") return native?.name === "Timestamptz" ? "TIMESTAMPTZ" : "TIMESTAMP";
      if (provider === "mysql") return "DATETIME";
      return "TEXT"; // sqlite stores datetimes as text
    case "json":
      return provider === "postgresql" ? "JSONB" : provider === "mysql" ? "JSON" : "TEXT";
    case "bytes":
      return provider === "postgresql" ? "BYTEA" : "BLOB";
    case "string":
    default: {
      if (native?.name === "Uuid") {
        if (provider === "postgresql") return "UUID";
        if (provider === "mysql") return "CHAR(36)";
        return "TEXT";
      }
      if (native?.name === "VarChar") {
        const len = native.args?.[0] ? parseInt(native.args[0], 10) : 255;
        const n = isNaN(len) ? 255 : len;
        return provider === "sqlite" ? "TEXT" : `VARCHAR(${n})`;
      }
      return provider === "mysql" ? "VARCHAR(191)" : "TEXT";
    }
  }
}

// ─── default mapping ──────────────────────────────────────────────────────────────

function sqlDefault(field: Field, provider: string): { value?: string; note?: string } {
  const value = (field.default ?? "").trim();
  if (!value || value === "autoincrement()") return {};
  if (value === "now()") return { value: "CURRENT_TIMESTAMP" };
  if (value === "uuid()" || value.includes("gen_random_uuid")) {
    if (provider === "postgresql") return { value: "gen_random_uuid()" };
    if (provider === "mysql") return { value: "(UUID())" };
    return { note: "uuid() default requires application-side generation" };
  }
  if (value === "cuid()") return { note: "cuid() default requires application-side generation" };
  if (value === "true") return { value: provider === "postgresql" ? "TRUE" : "1" };
  if (value === "false") return { value: provider === "postgresql" ? "FALSE" : "0" };
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) return { value: quoteStr(value.slice(1, -1)) };
  if (!isNaN(Number(value))) return { value };
  const dbgen = value.match(/^dbgenerated\((.*)\)$/);
  if (dbgen) return { value: dbgen[1].trim().replace(/^["']|["']$/g, "") };
  return { note: `default: ${value}` };
}

// ─── column rendering ───────────────────────────────────────────────────────────

// Renders one column as a CREATE TABLE member. Leading `-- comment` lines are part
// of the member so the trailing comma attaches to the definition, never a comment.
function columnMember(field: Field, provider: string, enumByName: Map<string, EnumDef>): string {
  const dbName = columnDbName(field);
  const isPk = field.constraints.some((c) => c.type === "PK");
  const isUnique = field.constraints.some((c) => c.type === "UNIQUE");
  const isUpdatedAt = field.constraints.some((c) => c.type === "UPDATED_AT");
  const isAuto = (field.default ?? "").trim() === "autoincrement()";
  const intLike = field.type === "integer" || field.type === "bigint";
  const enumDef = enumByName.get(field.type);

  const comments: string[] = [];
  if (field.comment) comments.push(`  -- ${field.comment}`);

  let line: string;
  if (isPk && isAuto && intLike && provider === "sqlite") {
    // SQLite rowid alias must be the literal type INTEGER.
    line = `  ${quoteId(dbName, provider)} INTEGER PRIMARY KEY AUTOINCREMENT`;
  } else {
    let typeStr = sqlType(field, provider, enumByName);
    if (isPk && isAuto && intLike && provider === "postgresql") {
      typeStr = field.type === "bigint" ? "BIGSERIAL" : "SERIAL";
    }
    const tokens = [quoteId(dbName, provider), typeStr];
    if (!field.nullable && !isPk) tokens.push("NOT NULL");
    const dft = sqlDefault(field, provider);
    if (dft.value) tokens.push(`DEFAULT ${dft.value}`);
    if (dft.note) comments.push(`  -- ${dft.note}`);
    if (isPk && isAuto && intLike && provider === "mysql") tokens.push("AUTO_INCREMENT");
    if (isUnique && !isPk) tokens.push("UNIQUE");
    if (isPk) tokens.push("PRIMARY KEY");
    line = "  " + tokens.join(" ");
    if (enumDef && provider === "sqlite") {
      const allowed = enumDef.values.map((v) => quoteStr(v.dbName || v.name)).join(", ");
      line += ` CHECK (${quoteId(dbName, provider)} IN (${allowed}))`;
    }
  }

  if (isUpdatedAt) comments.push("  -- @updatedAt (application-managed)");

  return [...comments, line].join("\n");
}

// ─── public API ───────────────────────────────────────────────────────────────

export function generateSqlSchema(store: Store): string {
  const provider = store.provider;
  const enumByName = new Map((store.enums ?? []).map((e) => [e.name, e]));
  const modelByKey = new Map(store.models.map((m) => [m.key, m]));
  const fieldsByModelKey = new Map(
    store.models.map((m) => [m.key, new Map(m.fields.map((f) => [f.key, f]))]),
  );

  const statements: string[] = [];

  // ── enum types (PostgreSQL renders these as standalone CREATE TYPE) ──
  if (provider === "postgresql") {
    for (const e of store.enums ?? []) {
      const vals = e.values.map((v) => quoteStr(v.dbName || v.name)).join(", ");
      statements.push(`CREATE TYPE ${quoteId(toSnakeCase(e.name), provider)} AS ENUM (${vals});`);
    }
  }

  // FKs (Postgres/MySQL) and indexes are emitted after every table is created.
  const fkAlters: string[] = [];
  const indexStmts: string[] = [];

  for (const model of store.models) {
    const tableName = toSnakeCase(model.name);
    const thisFields = fieldsByModelKey.get(model.key)!;
    const members: string[] = [];

    // ── columns ──
    for (const field of model.fields) {
      if (field.relation !== undefined) continue;
      if (isInternalMigrationField(field.name)) continue;
      members.push(columnMember(field, provider, enumByName));
    }

    // ── multi-column UNIQUE constraints + indexes (single-column UNIQUE is inline) ──
    for (const restriction of model.restrictions ?? []) {
      const cols = restriction.fields.map((key) => {
        const f = thisFields.get(key);
        return f ? columnDbName(f) : key;
      });
      if (cols.length === 0) continue;
      const quoted = cols.map((c) => quoteId(c, provider)).join(", ");
      if (restriction.type === "UNIQUE") {
        if (restriction.fields.length <= 1) continue;
        const name = restriction.dbName || `${tableName}_${cols.join("_")}_key`;
        members.push(`  CONSTRAINT ${quoteId(name, provider)} UNIQUE (${quoted})`);
      } else {
        const name = restriction.dbName || `${tableName}_${cols.join("_")}_idx`;
        indexStmts.push(`CREATE INDEX ${quoteId(name, provider)} ON ${quoteId(tableName, provider)} (${quoted});`);
      }
    }

    // ── foreign keys ──
    for (const rf of model.fields) {
      const locals = rf.relation?.fields ?? [];
      if (!rf.relation || locals.length === 0) continue;
      const target = modelByKey.get(rf.type);
      const targetFields = target ? fieldsByModelKey.get(target.key) : undefined;
      const refs = rf.relation.references ?? [];
      const localCols = locals.map((key) => {
        const f = thisFields.get(key);
        return f ? columnDbName(f) : key;
      });
      const targetCols = refs.map((key) => {
        const f = targetFields?.get(key);
        return f ? columnDbName(f) : "id";
      });
      const targetTable = target ? toSnakeCase(target.name) : toSnakeCase(rf.type);
      const fkName = `${tableName}_${localCols.join("_")}_fkey`;
      let body =
        `FOREIGN KEY (${localCols.map((c) => quoteId(c, provider)).join(", ")}) ` +
        `REFERENCES ${quoteId(targetTable, provider)} (${targetCols.map((c) => quoteId(c, provider)).join(", ")})`;
      if (rf.relation.onDelete) body += ` ON DELETE ${sqlAction(rf.relation.onDelete)}`;
      if (rf.relation.onUpdate) body += ` ON UPDATE ${sqlAction(rf.relation.onUpdate)}`;

      if (provider === "sqlite") {
        // SQLite cannot ALTER TABLE ADD CONSTRAINT — inline the FK instead.
        members.push(`  CONSTRAINT ${quoteId(fkName, provider)} ${body}`);
      } else {
        fkAlters.push(`ALTER TABLE ${quoteId(tableName, provider)} ADD CONSTRAINT ${quoteId(fkName, provider)} ${body};`);
      }
    }

    statements.push(`CREATE TABLE ${quoteId(tableName, provider)} (\n${members.join(",\n")}\n);`);
  }

  statements.push(...fkAlters);
  statements.push(...indexStmts);

  const header = [
    "-- Generated by Schema Studio",
    `-- Provider: ${provider}`,
    `-- Project: ${store.projectName} – ${store.projectVersion}`,
  ].join("\n");

  return [header, ...statements].join("\n\n") + "\n";
}
