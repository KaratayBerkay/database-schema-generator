import type { graphToCanonicalStore } from "@/lib/schema-db/graph";
import { isInternalMigrationField, normalizeDatabaseIdentifier } from "@/lib/domain/schema-naming";

// ─── types ──────────────────────────────────────────────────────────────────────

type Store = ReturnType<typeof graphToCanonicalStore>;
type Model = Store["models"][number];
type Field = Model["fields"][number];
type EnumDef = NonNullable<Store["enums"]>[number];

type NativeConstraint = { type: "NATIVE"; name: string; args?: string[] };

// Conditional stdlib/django imports collected while rendering.
type Imports = { uuid: boolean; timezone: boolean };

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

function columnDbName(field: Field): string {
  return field.dbName || normalizeDatabaseIdentifier(field.name);
}

// Python attribute name for a field — snake_case is the Django convention.
function attrName(name: string): string {
  return toSnakeCase(name);
}

// Humanize an enum value name for the TextChoices label: ADMIN → "Admin", IN_PROGRESS → "In Progress".
function titleLabel(name: string): string {
  return name
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Prisma referential actions → Django on_delete option names.
function djangoAction(action: string): string {
  switch (action.trim().toLowerCase().replace(/[\s_]+/g, "")) {
    case "cascade": return "CASCADE";
    case "setnull": return "SET_NULL";
    case "setdefault": return "SET_DEFAULT";
    case "restrict": return "RESTRICT";
    case "noaction": return "DO_NOTHING";
    case "protect": return "PROTECT";
    default: return "CASCADE";
  }
}

// ─── type mapping ───────────────────────────────────────────────────────────────

// Returns the Django field class plus its type-specific constructor args.
function djangoField(
  field: Field,
  enumByName: Map<string, EnumDef>,
  isPk: boolean,
  isAuto: boolean,
): { cls: string; typeArgs: string[] } {
  const type = field.type;
  const native = nativeOf(field.constraints);

  const enumDef = enumByName.get(type);
  if (enumDef) {
    const maxLen = Math.max(1, ...enumDef.values.map((v) => (v.dbName || v.name).length));
    return { cls: "CharField", typeArgs: [`max_length=${maxLen}`, `choices=${type}.choices`] };
  }

  switch (type) {
    case "integer":
      if (isPk && isAuto) return { cls: "AutoField", typeArgs: [] };
      if (native?.name === "SmallInt") return { cls: "SmallIntegerField", typeArgs: [] };
      return { cls: "IntegerField", typeArgs: [] };
    case "bigint":
      if (isPk && isAuto) return { cls: "BigAutoField", typeArgs: [] };
      return { cls: "BigIntegerField", typeArgs: [] };
    case "float":
      return { cls: "FloatField", typeArgs: [] };
    case "decimal": {
      let digits = 10;
      let places = 2;
      if (native?.name === "Decimal" && native.args && native.args.length >= 2) {
        const p = parseInt(native.args[0], 10);
        const s = parseInt(native.args[1], 10);
        if (!isNaN(p)) digits = p;
        if (!isNaN(s)) places = s;
      }
      return { cls: "DecimalField", typeArgs: [`max_digits=${digits}`, `decimal_places=${places}`] };
    }
    case "boolean":
      return { cls: "BooleanField", typeArgs: [] };
    case "timestamp":
      return { cls: "DateTimeField", typeArgs: [] };
    case "json":
      return { cls: "JSONField", typeArgs: [] };
    case "bytes":
      return { cls: "BinaryField", typeArgs: [] };
    case "string":
    default: {
      if (native?.name === "Uuid") return { cls: "UUIDField", typeArgs: [] };
      if (native?.name === "VarChar") {
        const len = native.args?.[0] ? parseInt(native.args[0], 10) : 255;
        return { cls: "CharField", typeArgs: [`max_length=${isNaN(len) ? 255 : len}`] };
      }
      return { cls: "CharField", typeArgs: ["max_length=255"] };
    }
  }
}

// ─── default mapping ──────────────────────────────────────────────────────────────

function djangoDefault(field: Field, enumByName: Map<string, EnumDef>, imports: Imports): { args: string[]; notes: string[] } {
  const args: string[] = [];
  const notes: string[] = [];

  const isUpdatedAt = field.constraints.some((c) => c.type === "UPDATED_AT");
  if (isUpdatedAt && field.type === "timestamp") {
    args.push("auto_now=True");
    return { args, notes };
  }

  const value = (field.default ?? "").trim();
  if (!value || value === "autoincrement()") return { args, notes };

  if (value === "now()") {
    if (field.type === "timestamp") { args.push("auto_now_add=True"); return { args, notes }; }
    imports.timezone = true;
    args.push("default=timezone.now");
    return { args, notes };
  }
  if (value === "uuid()" || value.includes("gen_random_uuid")) {
    imports.uuid = true;
    args.push("default=uuid.uuid4");
    return { args, notes };
  }
  if (value === "true") { args.push("default=True"); return { args, notes }; }
  if (value === "false") { args.push("default=False"); return { args, notes }; }
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) { args.push(`default=${pyStr(value.slice(1, -1))}`); return { args, notes }; }
  if (!isNaN(Number(value))) { args.push(`default=${value}`); return { args, notes }; }

  // enum bareword default → Enum.MEMBER
  const enumDef = enumByName.get(field.type);
  if (enumDef) {
    const member = enumDef.values.find((v) => (v.dbName || v.name) === value || v.name === value);
    if (member) { args.push(`default=${field.type}.${member.name}`); return { args, notes }; }
  }

  if (value === "cuid()") { notes.push("cuid() default requires application-side generation"); return { args, notes }; }
  const dbgen = value.match(/^dbgenerated\((.*)\)$/);
  if (dbgen) { notes.push(`default: dbgenerated(${dbgen[1].trim()})`); return { args, notes }; }

  notes.push(`default: ${value}`);
  return { args, notes };
}

// ─── column / relation rendering ────────────────────────────────────────────────

function scalarLine(field: Field, enumByName: Map<string, EnumDef>, imports: Imports): string {
  const attr = attrName(field.name);
  const dbName = columnDbName(field);
  const isPk = field.constraints.some((c) => c.type === "PK");
  const isUnique = field.constraints.some((c) => c.type === "UNIQUE");
  const isAuto = (field.default ?? "").trim() === "autoincrement()";

  const { cls, typeArgs } = djangoField(field, enumByName, isPk, isAuto);
  const args = [...typeArgs];

  if (isPk) {
    args.push("primary_key=True");
  } else {
    if (field.nullable) { args.push("null=True", "blank=True"); }
    if (isUnique) args.push("unique=True");
  }

  const def = djangoDefault(field, enumByName, imports);
  args.push(...def.args);

  if (dbName !== attr) args.push(`db_column=${pyStr(dbName)}`);

  const comments: string[] = [];
  if (field.comment) comments.push(`    # ${field.comment}`);
  for (const note of def.notes) comments.push(`    # ${note}`);

  return [...comments, `    ${attr} = models.${cls}(${args.join(", ")})`].join("\n");
}

function foreignKeyLine(
  rf: Field,
  model: Model,
  modelByKey: Map<string, Model>,
  fieldsByModelKey: Map<string, Map<string, Field>>,
): string {
  const attr = attrName(rf.name);
  const target = modelByKey.get(rf.type);
  const targetClass = target ? target.name : rf.type;

  const thisFields = fieldsByModelKey.get(model.key)!;
  const localKey = rf.relation?.fields?.[0] ?? "";
  const scalar = thisFields.get(localKey);
  const scalarDbName = scalar ? columnDbName(scalar) : "";
  const scalarIsPk = scalar ? scalar.constraints.some((c) => c.type === "PK") : false;

  const action = rf.relation?.onDelete ? djangoAction(rf.relation.onDelete) : "CASCADE";

  // related_name: the inverse field on the target model that shares this relation's name.
  let related: string | undefined;
  if (target && rf.relation?.name) {
    const inverse = target.fields.find(
      (f) => f.relation && f.relation.name === rf.relation?.name && f.key !== rf.key,
    );
    related = inverse ? attrName(inverse.name) : undefined;
  }

  const args = [pyStr(targetClass), `on_delete=models.${action}`];
  if (related) args.push(`related_name=${pyStr(related)}`);
  if (scalarIsPk) args.push("primary_key=True");
  else if (rf.nullable) args.push("null=True", "blank=True");
  // Django's implicit FK column is `<attr>_id`; pin db_column when the real column differs.
  if (scalarDbName && scalarDbName !== `${attr}_id`) args.push(`db_column=${pyStr(scalarDbName)}`);

  return `    ${attr} = models.ForeignKey(${args.join(", ")})`;
}

// ─── public API ───────────────────────────────────────────────────────────────

export function generateDjangoSchema(store: Store): string {
  const provider = store.provider;
  const enumByName = new Map((store.enums ?? []).map((e) => [e.name, e]));
  const modelByKey = new Map(store.models.map((m) => [m.key, m]));
  const fieldsByModelKey = new Map(
    store.models.map((m) => [m.key, new Map(m.fields.map((f) => [f.key, f]))]),
  );

  const imports: Imports = { uuid: false, timezone: false };

  // ── enum classes (module-level TextChoices) ──
  const enumBlocks: string[] = [];
  for (const e of store.enums ?? []) {
    const members = e.values
      .map((v) => `    ${v.name} = ${pyStr(v.dbName || v.name)}, ${pyStr(titleLabel(v.name))}`)
      .join("\n");
    enumBlocks.push(`class ${e.name}(models.TextChoices):\n${members || "    pass"}`);
  }

  // ── model classes ──
  const classBlocks: string[] = [];
  for (const model of store.models) {
    const tableName = toSnakeCase(model.name);

    // Pre-pass: which scalar columns are FK-backed (so we don't double-render them),
    // and the attribute name each field key resolves to (for Meta constraints/indexes).
    const fkColumnKeys = new Set<string>();
    const attrNameByKey = new Map<string, string>();
    for (const f of model.fields) {
      if (f.relation === undefined) attrNameByKey.set(f.key, attrName(f.name));
    }
    const fkFields: Field[] = [];
    const compositeFkFields: Field[] = [];
    for (const rf of model.fields) {
      const locals = rf.relation?.fields ?? [];
      if (!rf.relation || locals.length === 0) continue; // back-reference or scalar
      if (locals.length === 1) {
        fkColumnKeys.add(locals[0]);
        attrNameByKey.set(locals[0], attrName(rf.name));
        fkFields.push(rf);
      } else {
        compositeFkFields.push(rf);
      }
    }

    const lines: string[] = [];
    for (const field of model.fields) {
      if (field.relation !== undefined) continue;
      if (isInternalMigrationField(field.name)) continue;
      if (fkColumnKeys.has(field.key)) continue; // becomes a ForeignKey instead
      lines.push(scalarLine(field, enumByName, imports));
    }
    for (const rf of fkFields) {
      lines.push(foreignKeyLine(rf, model, modelByKey, fieldsByModelKey));
    }
    for (const rf of compositeFkFields) {
      const target = modelByKey.get(rf.type);
      lines.push(`    # composite FK to ${target ? target.name : rf.type} via "${rf.name}" — define manually (Django core has no composite ForeignKey)`);
    }

    // ── Meta ──
    const metaLines = [`        db_table = ${pyStr(tableName)}`];
    const constraints: string[] = [];
    const indexes: string[] = [];
    for (const restriction of model.restrictions ?? []) {
      const attrs = restriction.fields.map((key) => attrNameByKey.get(key) ?? key);
      if (attrs.length === 0) continue;
      const fieldList = attrs.map(pyStr).join(", ");
      if (restriction.type === "UNIQUE") {
        if (restriction.fields.length <= 1) continue; // already unique=True on the field
        const name = restriction.dbName || `${tableName}_${attrs.join("_")}_key`;
        constraints.push(`models.UniqueConstraint(fields=[${fieldList}], name=${pyStr(name)})`);
      } else {
        const name = restriction.dbName || `${tableName}_${attrs.join("_")}_idx`;
        indexes.push(`models.Index(fields=[${fieldList}], name=${pyStr(name)})`);
      }
    }
    if (constraints.length > 0) metaLines.push(`        constraints = [${constraints.join(", ")}]`);
    if (indexes.length > 0) metaLines.push(`        indexes = [${indexes.join(", ")}]`);

    // ── assemble class ──
    const body: string[] = [];
    body.push(...(lines.length > 0 ? lines : ["    pass"]));
    body.push("");
    body.push("    class Meta:");
    body.push(...metaLines);

    classBlocks.push(`class ${model.name}(models.Model):\n${body.join("\n")}`);
  }

  // ── header (built after rendering so conditional imports are known) ──
  const header: string[] = [
    "# Generated by Schema Studio",
    `# Provider: ${provider}`,
    `# Project: ${store.projectName} – ${store.projectVersion}`,
    "",
  ];
  if (imports.uuid) header.push("import uuid");
  header.push("from django.db import models");
  if (imports.timezone) header.push("from django.utils import timezone");

  const parts = [header.join("\n")];
  if (enumBlocks.length > 0) parts.push(enumBlocks.join("\n\n\n"));
  if (classBlocks.length > 0) parts.push(classBlocks.join("\n\n\n"));

  return parts.join("\n\n\n") + "\n";
}
