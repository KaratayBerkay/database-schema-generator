import { NextResponse } from "next/server";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Field, Model } from "@mrleebo/prisma-ast";
import { z } from "zod";
import type { ValidationIssue } from "@/types/migrations";
import { db } from "@/lib/db/client";
import { getSnapshotData } from "@/lib/db/migration-state";
import { renderMigrationPrismaSchema } from "@/lib/migrations/migration-schema-artifacts";
import { checkTypeConversion, generatedUniqueValue } from "@/lib/migrations/rules";


function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ─── canonical model types (for field rename map) ─────────────────────────────

type CanonicalField = { key: string; fieldId?: string; name: string; dbName?: string; type?: string; nullable?: boolean };
type CanonicalModel = { key: string; tableId?: string; name: string; fields: CanonicalField[] };
type CanonicalStore = { models: CanonicalModel[] };

function readModelStoreFromDb(projectName: string, version: string): CanonicalStore | null {
  try {
    const projectRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (!projectRow) return null;
    const storeRow = db.prepare("SELECT content FROM model_stores WHERE project_id = ? AND version = ?").get(projectRow.id, version) as { content: string } | undefined;
    if (!storeRow) return null;
    return JSON.parse(storeRow.content) as CanonicalStore;
  } catch {
    return null;
  }
}

// Build per-model rename maps: v1 field name → v2 field name, keyed by model name.
// Fields are matched by stable fieldId (falls back to key for pre-fieldId data).
function buildRenameMapsByModel(
  v1Store: CanonicalStore,
  v2Store: CanonicalStore,
): Map<string, Map<string, string>> {
  const result = new Map<string, Map<string, string>>();
  for (const v2Model of v2Store.models) {
    const v2TableId = v2Model.tableId ?? v2Model.key;
    const v1Model = v1Store.models.find((m) => (m.tableId ?? m.key) === v2TableId);
    if (!v1Model) continue;
    const fieldMap = new Map<string, string>();
    for (const v2Field of v2Model.fields) {
      const v2FieldId = v2Field.fieldId ?? v2Field.key;
      const v1Field = v1Model.fields.find((f) => (f.fieldId ?? f.key) === v2FieldId);
      const fromName = v1Field?.dbName || v1Field?.name || "";
      const toName = v2Field.dbName || v2Field.name;
      if (v1Field && fromName !== toName) {
        fieldMap.set(fromName, toName);
      }
    }
    if (fieldMap.size > 0) {
      result.set(v2Model.name, fieldMap);
      result.set(v1Model.name, fieldMap);
    }
  }
  return result;
}

// Rename record keys from v1 field names to v2 field names before Zod validation.
function applyRenames(
  record: Record<string, unknown>,
  renameMap: Map<string, string>,
): Record<string, unknown> {
  if (renameMap.size === 0) return record;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    out[renameMap.get(k) ?? k] = v;
  }
  return out;
}

// ─── prisma schema field extraction ──────────────────────────────────────────

type SchemaField = { name: string; type: string; optional: boolean; hasDefault: boolean };
type SchemaModel = { name: string; tableName: string; fields: SchemaField[] };

function getFieldTypeName(fieldType: Field["fieldType"]): string {
  if (typeof fieldType === "string") return fieldType;
  if (fieldType && typeof fieldType === "object" && "name" in fieldType) {
    return String((fieldType as { name: unknown }).name);
  }
  return String(fieldType);
}

function valueToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function fieldDbName(field: Field) {
  const mapAttribute = field.attributes?.find(
    (attribute) => attribute.type === "attribute" && attribute.name === "map",
  );
  const firstArg = mapAttribute?.args?.[0]?.value;
  return valueToString(firstArg).replace(/^["']|["']$/g, "") || field.name;
}

function extractSchemaModels(content: string): SchemaModel[] {
  const schema = getSchema(content);
  return schema.list
    .filter((b) => b.type === "model")
    .map((b) => {
      const model = b as Model;
      const mapAttr = model.properties.find(
        (p) => p.type === "attribute" && (p as { name?: string }).name === "map",
      ) as { args?: { value?: unknown }[] } | undefined;
      let tableName = model.name;
      if (mapAttr?.args?.[0]?.value && typeof mapAttr.args[0].value === "string") {
        tableName = mapAttr.args[0].value;
      }
      const fields: SchemaField[] = model.properties
        .filter((p) => p.type === "field")
        .map((p) => {
          const f = p as Field;
          return {
            name: fieldDbName(f),
            type: getFieldTypeName(f.fieldType),
            optional: f.optional ?? false,
            hasDefault: JSON.stringify(f).includes('"default"'),
          };
        });
      return { name: model.name, tableName, fields };
    });
}

// ─── stage 1: shape vs sync schema (no rename — data has v1 field names) ─────

const NUMERIC_TYPES = new Set(["Int", "BigInt", "Float", "Decimal"]);

function isCoercible(value: unknown, type: string): boolean {
  if (value === null || value === undefined) return false;
  if (type === "String") return true;
  if (NUMERIC_TYPES.has(type)) return !isNaN(Number(value));
  if (type === "Boolean") return typeof value === "boolean" || value === 0 || value === 1 || value === "true" || value === "false";
  if (type === "DateTime") return !isNaN(Date.parse(String(value)));
  return true;
}

function runStage1(
  models: SchemaModel[],
  snapshotsByTable: Map<string, Record<string, unknown>[]>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scalarTypes = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);

  for (const model of models) {
    const records = snapshotsByTable.get(model.tableName) ?? snapshotsByTable.get(model.name) ?? [];
    if (records.length === 0) continue;

    for (const field of model.fields) {
      if (!scalarTypes.has(field.type)) continue;
      for (let i = 0; i < records.length; i++) {
        const record = records[i]!;
        const val = record[field.name];
        if ((val === null || val === undefined) && !field.optional && !field.hasDefault) {
          issues.push({
            model: model.name, field: field.name,
            issue: `Record [${i}] is missing required field "${field.name}"`,
            suggestion: "Add a default value or make the field optional in the source schema.",
            severity: "error",
          });
          break;
        }
        if (val !== null && val !== undefined && !isCoercible(val, field.type)) {
          issues.push({
            model: model.name, field: field.name,
            issue: `Record [${i}] value for "${field.name}" cannot be coerced to ${field.type}`,
            suggestion: `Check the data type for field "${field.name}" in the source DB.`,
            severity: "error",
          });
          break;
        }
      }
    }
  }

  return issues;
}

// ─── approved lossy/deleted field warnings ────────────────────────────────────

// Returns: modelName → Map<fieldDbName, { changeKind, fromValue, toValue }> for approved lossy warnings.
// Used to determine whether a field should be stripped from Zod validation (truly incompatible)
// or left in place (compatible conversion like String → Enum carries actual data through).
type ApprovedLossyEntry2 = { changeKind: string; resolution: string; fromValue: string | null; toValue: string | null };
type ApprovedLossySet = Map<string, Map<string, ApprovedLossyEntry2>>;

function loadApprovedLossyFields(
  projectName: string,
  syncVersion: string,
  targetVersion: string,
): ApprovedLossySet {
  const projectRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
  if (!projectRow) return new Map();
  const rows = db.prepare(`
    SELECT entity_name, change_kind, resolution, from_value, to_value FROM schema_warnings
    WHERE project_id = ? AND from_version = ? AND to_version = ?
      AND entity_kind = 'field'
      AND resolution IN ('lossy_convert', 'data_deleted', 'precision_loss', 'backfill_required')
      AND approved_at IS NOT NULL
  `).all(projectRow.id, syncVersion, targetVersion) as { entity_name: string; change_kind: string; resolution: string; from_value: string | null; to_value: string | null }[];
  const result = new Map<string, Map<string, ApprovedLossyEntry2>>();
  for (const row of rows) {
    const dot = row.entity_name.indexOf(".");
    if (dot === -1) continue;
    const model = row.entity_name.slice(0, dot);
    const fieldDbName = row.entity_name.slice(dot + 1).toLowerCase();
    const inner = result.get(model) ?? new Map<string, ApprovedLossyEntry2>();
    inner.set(fieldDbName, { changeKind: row.change_kind, resolution: row.resolution, fromValue: row.from_value, toValue: row.to_value });
    result.set(model, inner);
  }
  return result;
}

// ─── pk-type-change skip set ──────────────────────────────────────────────────

// Returns modelName → Set<lowercased DB field name> for fields that must be
// skipped in Stage 2 because their values will be regenerated or remapped:
//   • pk_type_changed (table-level) → the PK field will get a new UUID at run time
//   • FK cascade (relation type_changed) → the FK field will be remapped via _referance
type PkSkipSet = Map<string, Set<string>>;

type ExtCanonicalField = CanonicalField & { constraints?: { type: string }[] };

function loadPkSkipFields(
  projectName: string,
  syncVersion: string,
  targetVersion: string,
  v2Store: CanonicalStore | null,
): PkSkipSet {
  const projectRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
  if (!projectRow) return new Map();
  const result = new Map<string, Set<string>>();

  // PK fields whose type changed → will receive new generated values on migration
  if (v2Store) {
    const tableRows = db.prepare(`
      SELECT entity_name FROM schema_warnings
      WHERE project_id = ? AND from_version = ? AND to_version = ?
        AND entity_kind = 'table' AND change_kind = 'pk_type_changed'
        AND approved_at IS NOT NULL
    `).all(projectRow.id, syncVersion, targetVersion) as { entity_name: string }[];
    for (const { entity_name: tableName } of tableRows) {
      const model = v2Store.models.find((m) => m.name === tableName);
      if (!model) continue;
      const pkField = (model.fields as ExtCanonicalField[]).find(
        (f) => f.constraints?.some((c) => c.type === "PK"),
      );
      if (!pkField) continue;
      const dbName = (pkField.dbName || pkField.name).toLowerCase();
      const set = result.get(tableName) ?? new Set<string>();
      set.add(dbName);
      result.set(tableName, set);
    }
  }

  // FK fields that reference a pk_type_changed PK → will be remapped via _referance
  const fkRows = db.prepare(`
    SELECT entity_name FROM schema_warnings
    WHERE project_id = ? AND from_version = ? AND to_version = ?
      AND entity_kind = 'relation' AND change_kind = 'type_changed'
      AND approved_at IS NOT NULL
  `).all(projectRow.id, syncVersion, targetVersion) as { entity_name: string }[];
  for (const { entity_name } of fkRows) {
    // entity_name format: "TableName.fieldName → (PK changed)"
    const dotIdx = entity_name.indexOf(".");
    const arrowIdx = entity_name.indexOf(" →");
    if (dotIdx === -1 || arrowIdx === -1) continue;
    const tableName = entity_name.slice(0, dotIdx);
    const fieldName = entity_name.slice(dotIdx + 1, arrowIdx).toLowerCase();
    const set = result.get(tableName) ?? new Set<string>();
    set.add(fieldName);
    result.set(tableName, set);
  }

  return result;
}

// ─── stage 2: zod vs target schema (rename v1 → v2 field names first) ────────

function prismaTypeToZod(type: string, optional: boolean): z.ZodTypeAny {
  // Numeric and date checks coerce: the pg/mysql drivers return Decimal/BigInt (and timestamp)
  // columns as strings to preserve precision, and the native-driver run re-inserts those strings
  // fine. Strict z.number() would over-report every Decimal value as "expected number, received
  // string". Coercion mirrors Stage 1's isCoercible and the actual run behavior.
  let base: z.ZodTypeAny;
  switch (type) {
    case "String":   base = z.string(); break;
    case "Int":      base = z.coerce.number().int(); break;
    case "BigInt":   base = z.coerce.bigint(); break;
    case "Float":
    case "Decimal":  base = z.coerce.number(); break;
    case "Boolean":  base = z.boolean(); break;
    case "DateTime": base = z.coerce.date(); break;
    default:         base = z.unknown(); break;
  }
  if (optional) return base.nullable().optional();
  return base;
}

function runStage2(
  targetModels: SchemaModel[],
  snapshotsByTable: Map<string, Record<string, unknown>[]>,
  renameMapsByModel: Map<string, Map<string, string>>,
  approvedLossy: ApprovedLossySet,
  pkSkipFields: PkSkipSet,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scalarTypes = new Set(["String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes"]);

  for (const model of targetModels) {
    const records = snapshotsByTable.get(model.tableName) ?? snapshotsByTable.get(model.name) ?? [];
    if (records.length === 0) continue;

    const renameMap = renameMapsByModel.get(model.name) ?? new Map<string, string>();
    // Strip a field from Zod validation when its v1 value cannot be valid for the v2 type:
    //   pk_type_changed         — old Int PK cannot be a UUID
    //   incompatible conversion — value replaced by default at run time (String→Int, etc.)
    //   precision_loss Float→Int — float values fail z.number().int(); migration truncates them
    // Compatible conversions (String→Enum) keep actual v1 data — do NOT strip.
    const lossyFieldMap = approvedLossy.get(model.name) ?? new Map<string, ApprovedLossyEntry2>();
    const trulyLossyFields = new Set(
      [...lossyFieldMap.entries()]
        .filter(([, entry]) => {
          if (entry.changeKind === "pk_type_changed") return true;
          // Float/Decimal → Int: compatible by truncation, but z.number().int() rejects floats
          if (entry.fromValue && entry.toValue) {
            const from = entry.fromValue.toLowerCase();
            const to = entry.toValue.toLowerCase();
            if ((from === "float" || from === "decimal") && (to === "int" || to === "integer" || to === "bigint")) return true;
            return !checkTypeConversion(entry.fromValue, entry.toValue).compatible;
          }
          return false;
        })
        .map(([fieldName]) => fieldName),
    );

    // PK / FK fields being regenerated or remapped — strip entirely from Zod validation.
    const pkSkip = pkSkipFields.get(model.name) ?? new Set<string>();

    const presentKeys = new Set(Object.keys(applyRenames(records[0]!, renameMap)));
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const field of model.fields) {
      if (!scalarTypes.has(field.type)) continue;
      const fieldLower = field.name.toLowerCase();
      const isNewField = !presentKeys.has(field.name);
      const isLossy = trulyLossyFields.has(field.name.toLowerCase());
      const isPkSkip = pkSkip.has(fieldLower);
      const isBackfill = lossyFieldMap.get(fieldLower)?.resolution === "backfill_required";
      shape[field.name] = prismaTypeToZod(field.type, field.optional || isNewField || isLossy || isBackfill || isPkSkip);
    }
    const schema = z.object(shape).passthrough();

    for (let i = 0; i < records.length; i++) {
      const renamed = applyRenames(records[i]!, renameMap);
      // Strip incompatible lossy fields AND pk/fk-skip fields before Zod parsing.
      const skipSet = new Set([...trulyLossyFields, ...pkSkip]);
      const forValidation = skipSet.size > 0
        ? Object.fromEntries(Object.entries(renamed).filter(([k]) => !skipSet.has(k) && !skipSet.has(k.toLowerCase())))
        : renamed;
      const result = schema.safeParse(forValidation);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const fieldName = issue.path.join(".") || "(record)";
          issues.push({
            model: model.name,
            field: fieldName,
            issue: `Record [${i}]: ${issue.message}`,
            suggestion: `Field "${fieldName}" in target schema is ${model.fields.find(f => f.name === fieldName)?.type ?? "unknown"}.`,
            severity: "error",
          });
        }
      }
    }
  }

  return issues;
}

function runUpgradeRules(
  v1Store: CanonicalStore | null,
  v2Store: CanonicalStore | null,
  snapshotsByTable: Map<string, Record<string, unknown>[]>,
  approvedLossy: ApprovedLossySet,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!v1Store || !v2Store) return issues;

  for (const targetModel of v2Store.models) {
    const sourceModel = v1Store.models.find(
      (model) => (model.tableId ?? model.key) === (targetModel.tableId ?? targetModel.key),
    );
    if (!sourceModel) continue;

    const records =
      snapshotsByTable.get(sourceModel.name) ??
      snapshotsByTable.get(targetModel.name) ??
      [];

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const targetField of targetModel.fields) {
      // Relation back-references store the relation UUID as their type — skip them.
      // They have no DB column and no collected data counterpart.
      if (UUID_RE.test(targetField.type ?? "")) continue;

      const sourceField = sourceModel.fields.find(
        (field) => (field.fieldId ?? field.key) === (targetField.fieldId ?? targetField.key),
      );
      const targetName = targetField.dbName || targetField.name;
      const sourceName = sourceField?.dbName || sourceField?.name || targetName;

      if (!sourceField) {
        if (!targetField.nullable) {
          issues.push({
            model: targetModel.name,
            field: targetName,
            issue: `Required field "${targetName}" does not exist in the source version.`,
            suggestion: `Existing rows will be filled using generated unique values like ${generatedUniqueValue(targetName)}.`,
            severity: "warning",
          });
        }
        continue;
      }

      const conversion = checkTypeConversion(sourceField.type ?? "", targetField.type ?? "");
      // Approved-lossy entries are keyed by the warning's logical (canonical) field name; match on
      // that first, falling back to the physical dbName. They differ for snake_case columns — logical
      // "ipBlock" vs db "ip_block" — which otherwise drops the approval and over-reports the error.
      const lossyMap = approvedLossy.get(targetModel.name) ?? new Map<string, ApprovedLossyEntry2>();
      const lossyApproved =
        lossyMap.has((targetField.name ?? "").toLowerCase()) || lossyMap.has(targetName.toLowerCase());
      if (!conversion.compatible && !lossyApproved) {
        issues.push({
          model: targetModel.name,
          field: targetName,
          issue: `Cannot safely convert ${sourceField.type} to ${targetField.type}.`,
          suggestion: "Choose a compatible type conversion or provide a custom migration.",
          severity: "error",
        });
      } else if (conversion.warning) {
        issues.push({
          model: targetModel.name,
          field: targetName,
          issue: conversion.warning,
          suggestion: `Values from "${sourceName}" will be converted before writing "${targetName}".`,
          severity: "warning",
        });
      }

      if (sourceField.nullable && !targetField.nullable) {
        const hasNulls = records.some((record) => record[sourceName] === null || record[sourceName] === undefined);
        if (hasNulls) {
          issues.push({
            model: targetModel.name,
            field: targetName,
            issue: `Field '${targetName}' contains null values.`,
            suggestion: "Existing rows will be filled using generated unique values.",
            severity: "warning",
          });
        }
      }
    }
  }

  return issues;
}

// ─── route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const connectionId = getString(body.connectionId);
  const syncVersion = getString(body.syncVersion);
  const targetVersion = getString(body.targetVersion);
  const snapshotId = getString(body.snapshotId);

  if (!projectName || !connectionId || !syncVersion || !targetVersion || !snapshotId) {
    return jsonError("Project name, connection ID, sync version, target version, and snapshotId are required.");
  }

  // Block composite PK type changes — the migration engine models a single PK field per table.
  // A composite PK where the type changes would only remap the first field and silently corrupt
  // the second. Return a hard error so the user knows to split the change.
  const compositePkError = (() => {
    const projectRow = db.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
    if (!projectRow) return null;
    const pkChangedTables = db.prepare(`
      SELECT entity_name FROM schema_warnings
      WHERE project_id = ? AND from_version = ? AND to_version = ?
        AND entity_kind = 'table' AND change_kind = 'pk_type_changed'
    `).all(projectRow.id, syncVersion, targetVersion) as { entity_name: string }[];
    if (pkChangedTables.length === 0) return null;
    const targetVerRow = db.prepare(
      "SELECT id FROM project_versions WHERE project_id = ? AND name = ?",
    ).get(projectRow.id, targetVersion) as { id: number } | undefined;
    if (!targetVerRow) return null;
    for (const { entity_name: tableName } of pkChangedTables) {
      const pkConstraint = db.prepare(`
        SELECT sc.id FROM schema_constraints sc
        JOIN schema_tables st ON st.id = sc.table_id
        WHERE st.version_id = ? AND st.name = ? AND sc.type = 'PK'
      `).get(targetVerRow.id, tableName) as { id: string } | undefined;
      if (!pkConstraint) continue;
      const fieldCount = (db.prepare(
        "SELECT COUNT(*) as n FROM schema_constraint_fields WHERE constraint_id = ?",
      ).get(pkConstraint.id) as { n: number }).n;
      if (fieldCount > 1) {
        return `Table "${tableName}" has a composite primary key (${fieldCount} fields). Composite PK type changes are not supported — split into separate single-field PK changes.`;
      }
    }
    return null;
  })();
  if (compositePkError) return jsonError(compositePkError, 422);

  try {
    const [syncContent, targetContent] = await Promise.all([
      Promise.resolve(renderMigrationPrismaSchema(projectName, syncVersion).content),
      Promise.resolve(renderMigrationPrismaSchema(projectName, targetVersion).content),
    ]);

    const syncModels = extractSchemaModels(syncContent);
    const targetModels = extractSchemaModels(targetContent);

    const v1Store = readModelStoreFromDb(projectName, syncVersion);
    const v2Store = readModelStoreFromDb(projectName, targetVersion);
    const renameMapsByModel = (v1Store && v2Store)
      ? buildRenameMapsByModel(v1Store, v2Store)
      : new Map<string, Map<string, string>>();

    // Load collected data snapshots from SQLite
    const snapshotRows = getSnapshotData(snapshotId);
    if (snapshotRows.length === 0) {
      return jsonError("Data snapshot not found. Run Collect first.", 404);
    }

    const snapshotsByTable = new Map<string, Record<string, unknown>[]>();
    for (const row of snapshotRows) {
      snapshotsByTable.set(row.tableName, row.records);
      if (row.schemaTable && row.schemaTable !== row.tableName) {
        snapshotsByTable.set(row.schemaTable, row.records);
      }
    }

    const approvedLossy = loadApprovedLossyFields(projectName, syncVersion, targetVersion);
    const pkSkipFields = loadPkSkipFields(projectName, syncVersion, targetVersion, v2Store);

    const stage1Issues = runStage1(syncModels, snapshotsByTable);
    const stage2Issues = [
      ...runStage2(targetModels, snapshotsByTable, renameMapsByModel, approvedLossy, pkSkipFields),
      ...runUpgradeRules(v1Store, v2Store, snapshotsByTable, approvedLossy),
    ];
    const passed =
      !stage1Issues.some((i) => i.severity === "error") &&
      !stage2Issues.some((i) => i.severity === "error");

    return NextResponse.json({ success: true, stage1Issues, stage2Issues, passed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
