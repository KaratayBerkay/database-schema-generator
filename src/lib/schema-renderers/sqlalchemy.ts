import type { graphToCanonicalStore } from "@/lib/schema-db/graph";
import { isInternalMigrationField, normalizeDatabaseIdentifier } from "@/lib/domain/schema-naming";

// ─── types ──────────────────────────────────────────────────────────────────────

type Store = ReturnType<typeof graphToCanonicalStore>;
type Model = Store["models"][number];
type Field = Model["fields"][number];

type NativeConstraint = { type: "NATIVE"; name: string; args?: string[] };

// Import accumulators threaded through the helpers.
type Imports = {
  sa: Set<string>; // names from `sqlalchemy`
  pg: Set<string>; // names from `sqlalchemy.dialects.postgresql`
  enum: boolean;
  uuid: boolean;
  datetime: boolean;
  decimal: boolean;
  optional: boolean;
  relationship: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function pyStr(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function nativeOf(constraints: Field["constraints"]): NativeConstraint | undefined {
  return constraints.find((c): c is NativeConstraint => c.type === "NATIVE");
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

function columnDbName(field: Field): string {
  return field.dbName || normalizeDatabaseIdentifier(field.name);
}

// ─── type mapping ───────────────────────────────────────────────────────────────

// Returns the SQLAlchemy column type expression and the Python type for `Mapped[…]`.
function mapType(field: Field, provider: string, enumNames: Set<string>, imports: Imports): { sa: string; py: string } {
  const type = field.type;

  if (enumNames.has(type)) {
    imports.sa.add("Enum");
    return { sa: `Enum(${type}, name=${pyStr(toSnakeCase(type))})`, py: type };
  }

  const native = nativeOf(field.constraints);

  switch (type) {
    case "integer":
      if (native?.name === "SmallInt") { imports.sa.add("SmallInteger"); return { sa: "SmallInteger", py: "int" }; }
      imports.sa.add("Integer"); return { sa: "Integer", py: "int" };
    case "bigint":
      imports.sa.add("BigInteger"); return { sa: "BigInteger", py: "int" };
    case "float":
      imports.sa.add("Float"); return { sa: "Float", py: "float" };
    case "decimal":
      imports.sa.add("Numeric"); imports.decimal = true; return { sa: "Numeric", py: "Decimal" };
    case "boolean":
      imports.sa.add("Boolean"); return { sa: "Boolean", py: "bool" };
    case "timestamp": {
      imports.sa.add("DateTime"); imports.datetime = true;
      return { sa: native?.name === "Timestamptz" ? "DateTime(timezone=True)" : "DateTime", py: "datetime" };
    }
    case "json":
      if (provider === "postgresql") { imports.pg.add("JSONB"); return { sa: "JSONB", py: "dict" }; }
      imports.sa.add("JSON"); return { sa: "JSON", py: "dict" };
    case "bytes":
      imports.sa.add("LargeBinary"); return { sa: "LargeBinary", py: "bytes" };
    case "string":
    default: {
      if (native?.name === "Uuid") {
        if (provider === "postgresql") { imports.pg.add("UUID"); imports.uuid = true; return { sa: "UUID(as_uuid=True)", py: "uuid.UUID" }; }
        imports.sa.add("String"); return { sa: "String(36)", py: "str" };
      }
      if (native?.name === "VarChar") {
        const len = native.args?.[0] ? parseInt(native.args[0], 10) : 255;
        imports.sa.add("String"); return { sa: `String(${isNaN(len) ? 255 : len})`, py: "str" };
      }
      imports.sa.add("String"); return { sa: "String", py: "str" };
    }
  }
}

// ─── default mapping ──────────────────────────────────────────────────────────────

function pyDefault(field: Field, imports: Imports): { arg?: string; note?: string } {
  const value = (field.default ?? "").trim();
  if (!value || value === "autoincrement()") return {};
  if (value === "now()") { imports.sa.add("func"); return { arg: "server_default=func.now()" }; }
  if (value === "uuid()" || value.includes("gen_random_uuid")) { imports.uuid = true; return { arg: "default=uuid.uuid4" }; }
  if (value === "true") return { arg: "default=True" };
  if (value === "false") return { arg: "default=False" };
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) return { arg: `default=${pyStr(value.slice(1, -1))}` };
  if (!isNaN(Number(value))) return { arg: `default=${value}` };
  if (value === "cuid()") return { note: "cuid() default is not representable in SQLAlchemy" };
  const dbgen = value.match(/^dbgenerated\((.*)\)$/);
  if (dbgen) {
    imports.sa.add("text");
    const inner = dbgen[1].trim().replace(/^["']|["']$/g, "");
    return { arg: `server_default=text(${pyStr(inner)})` };
  }
  return { note: `default: ${value}` };
}

// ─── public API ───────────────────────────────────────────────────────────────

export function generateSqlAlchemySchema(store: Store): string {
  const provider = store.provider;
  const enumNames = new Set((store.enums ?? []).map((e) => e.name));
  const modelByKey = new Map(store.models.map((m) => [m.key, m]));
  const fieldsByModelKey = new Map(
    store.models.map((m) => [m.key, new Map(m.fields.map((f) => [f.key, f]))]),
  );

  const imports: Imports = {
    sa: new Set(), pg: new Set(),
    enum: false, uuid: false, datetime: false, decimal: false, optional: false, relationship: false,
  };

  // ── enum classes ──
  const enumBlocks: string[] = [];
  for (const e of store.enums ?? []) {
    imports.enum = true;
    const members = e.values.map((v) => `    ${v.name} = ${pyStr(v.dbName || v.name)}`).join("\n");
    enumBlocks.push(`class ${e.name}(enum.Enum):\n${members || "    pass"}`);
  }

  // ── model classes ──
  const classBlocks: string[] = [];
  for (const model of store.models) {
    const className = model.name;
    const tableName = toSnakeCase(model.name);
    const thisFields = fieldsByModelKey.get(model.key)!;

    // Map each owning-side FK column (by field key) → its referenced table.column.
    const fkByLocalKey = new Map<string, { ref: string; onDelete?: string; onUpdate?: string }>();
    for (const rf of model.fields) {
      const locals = rf.relation?.fields ?? [];
      if (!rf.relation || locals.length === 0) continue;
      const target = modelByKey.get(rf.type);
      const targetFields = target ? fieldsByModelKey.get(target.key) : undefined;
      const refs = rf.relation.references ?? [];
      locals.forEach((localKey, index) => {
        const refField = targetFields?.get(refs[index] ?? "");
        const targetTable = target ? toSnakeCase(target.name) : toSnakeCase(rf.type);
        const targetCol = refField ? columnDbName(refField) : "id";
        fkByLocalKey.set(localKey, { ref: `${targetTable}.${targetCol}`, onDelete: rf.relation?.onDelete, onUpdate: rf.relation?.onUpdate });
      });
    }

    // ── scalar columns ──
    const colLines: string[] = [];
    for (const field of model.fields) {
      if (field.relation !== undefined) continue;
      if (isInternalMigrationField(field.name)) continue;

      const dbName = columnDbName(field);
      const isPk = field.constraints.some((c) => c.type === "PK");
      const isUnique = field.constraints.some((c) => c.type === "UNIQUE");
      const isUpdatedAt = field.constraints.some((c) => c.type === "UPDATED_AT");
      const nullable = field.nullable && !isPk;

      const { sa, py } = mapType(field, provider, enumNames, imports);

      const args: string[] = [];
      if (dbName !== field.name) args.push(pyStr(dbName));
      args.push(sa);

      const fk = fkByLocalKey.get(field.key);
      if (fk) {
        imports.sa.add("ForeignKey");
        const fkArgs = [pyStr(fk.ref)];
        if (fk.onDelete) fkArgs.push(`ondelete=${pyStr(sqlAction(fk.onDelete))}`);
        if (fk.onUpdate) fkArgs.push(`onupdate=${pyStr(sqlAction(fk.onUpdate))}`);
        args.push(`ForeignKey(${fkArgs.join(", ")})`);
      }

      if (isPk) args.push("primary_key=True");
      else if (!field.nullable) args.push("nullable=False");
      if (isUnique && !isPk) args.push("unique=True");

      const def = pyDefault(field, imports);
      if (def.arg) args.push(def.arg);
      if (isUpdatedAt) { imports.sa.add("func"); args.push("onupdate=func.now()"); }

      const annotation = nullable ? `Optional[${py}]` : py;
      if (nullable) imports.optional = true;

      if (field.comment) colLines.push(`    # ${field.comment}`);
      if (def.note) colLines.push(`    # ${def.note}`);
      colLines.push(`    ${field.name}: Mapped[${annotation}] = mapped_column(${args.join(", ")})`);
    }

    // ── relationship() attributes ──
    const relLines: string[] = [];
    for (const rf of model.fields) {
      if (rf.relation === undefined) continue;
      if (isInternalMigrationField(rf.name)) continue;
      imports.relationship = true;

      const target = modelByKey.get(rf.type);
      const targetClass = target ? target.name : rf.type;

      let backName: string | undefined;
      if (target && rf.relation.name) {
        const inverse = target.fields.find(
          (f) => f.relation && f.relation.name === rf.relation?.name && f.key !== rf.key,
        );
        backName = inverse?.name;
      }

      const ref = pyStr(targetClass);
      const annotation = rf.array ? `list[${ref}]` : rf.nullable ? `Optional[${ref}]` : ref;
      if (rf.nullable && !rf.array) imports.optional = true;

      const relArgs = backName ? `back_populates=${pyStr(backName)}` : "";
      const note = backName ? "" : "  # back_populates unresolved";
      relLines.push(`    ${rf.name}: Mapped[${annotation}] = relationship(${relArgs})${note}`);
    }

    // ── __table_args__ from UNIQUE / INDEX restrictions ──
    const tableArgs: string[] = [];
    for (const restriction of model.restrictions ?? []) {
      // Single-column UNIQUEs are already rendered as `unique=True` on the column.
      if (restriction.type === "UNIQUE" && restriction.fields.length <= 1) continue;
      const cols = restriction.fields.map((key) => {
        const f = thisFields.get(key);
        return f ? columnDbName(f) : key;
      });
      const suffix = restriction.type === "UNIQUE" ? "uq" : "idx";
      const name = restriction.dbName || `${tableName}_${cols.join("_")}_${suffix}`;
      if (restriction.type === "UNIQUE") {
        imports.sa.add("UniqueConstraint");
        tableArgs.push(`UniqueConstraint(${cols.map(pyStr).join(", ")}, name=${pyStr(name)})`);
      } else {
        imports.sa.add("Index");
        tableArgs.push(`Index(${pyStr(name)}, ${cols.map(pyStr).join(", ")})`);
      }
    }

    // ── assemble class ──
    const body: string[] = [`    __tablename__ = ${pyStr(tableName)}`];
    if (tableArgs.length > 0) body.push(`    __table_args__ = (${tableArgs.join(", ")},)`);
    body.push("");
    if (colLines.length > 0) body.push(...colLines);
    if (relLines.length > 0) {
      if (colLines.length > 0) body.push("");
      body.push(...relLines);
    }
    if (colLines.length === 0 && relLines.length === 0) body.push("    pass");

    classBlocks.push(`class ${className}(Base):\n${body.join("\n")}`);
  }

  // ── imports ──
  const header: string[] = [
    "# Generated by Schema Studio",
    `# Provider: ${provider}`,
    `# Project: ${store.projectName} – ${store.projectVersion}`,
    "",
  ];

  if (imports.enum) header.push("import enum");
  if (imports.uuid) header.push("import uuid");
  if (imports.datetime) header.push("from datetime import datetime");
  if (imports.decimal) header.push("from decimal import Decimal");
  if (imports.optional) header.push("from typing import Optional");
  if (imports.sa.size > 0) header.push(`from sqlalchemy import ${[...imports.sa].sort().join(", ")}`);
  if (imports.pg.size > 0) header.push(`from sqlalchemy.dialects.postgresql import ${[...imports.pg].sort().join(", ")}`);

  const orm = ["DeclarativeBase", "Mapped", "mapped_column"];
  if (imports.relationship) orm.push("relationship");
  header.push(`from sqlalchemy.orm import ${orm.sort().join(", ")}`);

  const parts = [
    header.join("\n"),
    "class Base(DeclarativeBase):\n    pass",
  ];
  if (enumBlocks.length > 0) parts.push(enumBlocks.join("\n\n\n"));
  if (classBlocks.length > 0) parts.push(classBlocks.join("\n\n\n"));

  return parts.join("\n\n\n") + "\n";
}
