import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db/client";
import { upsertWarnings, type NewSchemaWarning } from "@/lib/stores/schema-warnings-store";
import { getTypeResolution, getPkTypeResolution, worstResolution, type Resolution } from "@/solutions/type-conversion-matrix";
import type { VersionDiff, FieldDiff, TableDiff, EnumDiff, RelationDiff, RestrictionDiff, CascadeHint, FkRelationHint } from "@/lib/version-diff/detect-changes";

function projectIdFromName(projectName: string): string | null {
  const row = db
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  return row?.id ?? null;
}

function fieldResolution(fd: FieldDiff): Resolution | null {
  switch (fd.changeKind) {
    case "added":
      return fd.severity === "warning" ? "backfill_required" : null;
    case "removed":
      return "data_deleted";
    case "renamed":
      return null; // safe
    case "nullability_changed":
      return fd.message.includes("Made required") ? "backfill_required" : null;
    case "default_changed":
      return "backfill_required";
    case "type_changed": {
      const r = getTypeResolution(fd.from, fd.to);
      return r === "safe" ? null : r;
    }
    case "pk_type_changed": {
      const r = getPkTypeResolution(fd.from, fd.to);
      return r === "safe" ? null : r;
    }
    case "multiple": {
      const parts: (Resolution | undefined)[] = [];
      if (fd.from !== fd.to) parts.push(getTypeResolution(fd.from, fd.to));
      if (fd.message.includes("Made required") || fd.message.includes("Default removed")) parts.push("backfill_required");
      const worst = worstResolution(...parts);
      return worst === "safe" ? null : worst;
    }
    default:
      return null;
  }
}

function tableWarning(projectId: string, fromVersion: string, toVersion: string, td: TableDiff): NewSchemaWarning | null {
  if (td.changeKind !== "removed") return null;
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "table",
    entityId: td.tableId,
    entityName: td.tableName,
    changeKind: td.changeKind,
    resolution: "data_deleted",
    fromValue: null,
    toValue: null,
    message: `Table "${td.tableName}" was removed. All data in this table will be permanently deleted when migrating.`,
  };
}

function fieldWarnings(projectId: string, fromVersion: string, toVersion: string, tableName: string, fds: FieldDiff[]): NewSchemaWarning[] {
  const results: NewSchemaWarning[] = [];
  for (const fd of fds) {
    // pk_type_changed is emitted as a table-level warning (with the table's ID) directly in
    // writeWarningsForDiff where tableId is available — skip it here to avoid a duplicate field warning.
    if (fd.changeKind === "pk_type_changed") continue;
    // cascade-driven FK type change — the Relations tab fkCascadeWarning is the gate.
    // Emitting a field-level warning too creates a duplicate unapproved blocker in the Schema tab.
    if (fd.isCascadeFk) continue;
    const resolution = fieldResolution(fd);
    if (!resolution) continue;
    results.push({
      id: randomUUID(),
      projectId,
      fromVersion,
      toVersion,
      entityKind: "field",
      entityId: fd.fieldId,
      entityName: `${tableName}.${fd.fieldName}`,
      changeKind: fd.changeKind,
      resolution,
      fromValue: fd.from || null,
      toValue: fd.to || null,
      message: fd.message,
    });

    // If this FK field changed TYPE, emit a relation-tab warning (type mismatch needs user awareness).
    // Pure renames are safe — the FK value is unchanged, so no warning row is needed.
    for (const hint of fd.fkHints) {
      if (fd.from !== fd.to) {
        results.push(fkFieldChangedWarning(projectId, fromVersion, toVersion, tableName, fd, hint));
      }
    }
  }
  return results;
}

function enumWarnings(projectId: string, fromVersion: string, toVersion: string, ed: EnumDiff): NewSchemaWarning[] {
  if (ed.changeKind === "added") return [];

  // Whole-enum deletion: one warning for the enum entity itself.
  if (ed.changeKind === "removed") {
    return [{
      id: randomUUID(),
      projectId,
      fromVersion,
      toVersion,
      entityKind: "enum",
      entityId: ed.enumId,
      entityName: ed.enumName,
      changeKind: "removed",
      resolution: "data_deleted",
      fromValue: null,
      toValue: null,
      message: ed.message,
    }];
  }

  // values_changed: one warning per removed value so each gets its own replacement mapping.
  if (ed.changeKind === "values_changed") {
    return ed.removedValues.map((removedValue) => ({
      id: randomUUID(),
      projectId,
      fromVersion,
      toVersion,
      entityKind: "enum",
      // Composite entity ID keeps lookup stable across re-renders.
      entityId: `${ed.enumId}:${removedValue}`,
      entityName: `${ed.enumName}.${removedValue}`,
      changeKind: "value_removed",
      resolution: "data_deleted",
      fromValue: removedValue,
      toValue: null,
      message: `Enum value "${removedValue}" was removed from "${ed.enumName}". Existing rows with this value will need a replacement.`,
    }));
  }

  return [];
}

function relationWarning(projectId: string, fromVersion: string, toVersion: string, rd: RelationDiff): NewSchemaWarning | null {
  if (rd.changeKind !== "removed") return null;
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "relation",
    entityId: rd.relationId,
    entityName: `${rd.sourceTableName}.${rd.fieldName} → ${rd.targetTableName}`,
    changeKind: rd.changeKind,
    resolution: "data_deleted",
    fromValue: null,
    toValue: null,
    message: rd.message,
  };
}

function fkFieldChangedWarning(
  projectId: string,
  fromVersion: string,
  toVersion: string,
  tableName: string,
  fd: FieldDiff,
  hint: FkRelationHint,
): NewSchemaWarning {
  const isTypeChange = fd.from !== fd.to;
  const changeDesc = isTypeChange
    ? `type changed from ${fd.from} to ${fd.to} (references ${hint.targetTableName}.id which is ${hint.targetPkType})`
    : `renamed to "${fd.fieldName}"`;
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "relation",
    entityId: fd.fieldId,
    entityName: `${tableName}.${fd.fieldName} → ${hint.targetTableName}`,
    changeKind: fd.changeKind,
    resolution: isTypeChange ? "lossy_convert" : "data_deleted",
    fromValue: fd.from || null,
    toValue: fd.to || null,
    message: `FK field "${tableName}.${fd.fieldName}" ${changeDesc}. Verify the relation to "${hint.targetTableName}" is still consistent.`,
  };
}

function pkTypeWarning(
  projectId: string,
  fromVersion: string,
  toVersion: string,
  tableId: string,
  tableName: string,
  fd: FieldDiff,
): NewSchemaWarning {
  const resolution = getPkTypeResolution(fd.from, fd.to);
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "table",
    entityId: tableId,
    entityName: tableName,
    changeKind: "pk_type_changed",
    resolution: resolution === "safe" ? "data_deleted" : resolution,
    fromValue: fd.from || null,
    toValue: fd.to || null,
    message: `PK field "${tableName}.${fd.fieldName}" type changed from ${fd.from} to ${fd.to}. All existing rows receive new PK values on migration — FK fields in child tables are remapped automatically via the _referance technique. See cascade impact below.`,
  };
}

function fkCascadeWarning(
  projectId: string,
  fromVersion: string,
  toVersion: string,
  pkDiff: FieldDiff,
  hint: CascadeHint,
  pkTableName: string,
): NewSchemaWarning {
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "relation",
    entityId: hint.fieldId,
    entityName: `${hint.tableName}.${hint.fieldName} → ${pkTableName}`,
    changeKind: "type_changed",
    resolution: "lossy_convert",
    fromValue: pkDiff.from || null,
    toValue: pkDiff.to || null,
    message: `Schema type must match the new PK (${pkDiff.from} → ${pkDiff.to}). Click "Apply & Approve" to update the field type in the schema. Data FK values are remapped automatically during migration via _referance — no manual data action needed.`,
  };
}

export function writeWarningsForDiff(
  projectName: string,
  fromVersion: string,
  toVersion: string,
  diff: VersionDiff,
): void {
  const projectId = projectIdFromName(projectName);
  if (!projectId) return;

  const warnings: NewSchemaWarning[] = [];

  for (const td of diff.tableDiffs) {
    const tw = tableWarning(projectId, fromVersion, toVersion, td);
    if (tw) warnings.push(tw);
    const fws = fieldWarnings(projectId, fromVersion, toVersion, td.tableName, td.fieldDiffs);
    warnings.push(...fws);

    // pk_type_changed → table-level warning (Tables tab) + cascade FK warnings (Relations tab)
    for (const fd of td.fieldDiffs) {
      if (fd.changeKind !== "pk_type_changed") continue;
      warnings.push(pkTypeWarning(projectId, fromVersion, toVersion, td.tableId, td.tableName, fd));
      for (const hint of fd.cascade) {
        warnings.push(fkCascadeWarning(projectId, fromVersion, toVersion, fd, hint, td.tableName));
      }
    }
  }

  for (const ed of diff.enumDiffs) {
    warnings.push(...enumWarnings(projectId, fromVersion, toVersion, ed));
  }

  for (const rd of diff.relationDiffs) {
    const rw = relationWarning(projectId, fromVersion, toVersion, rd);
    if (rw) warnings.push(rw);
  }

  for (const resd of diff.restrictionDiffs) {
    const rw = restrictionWarning(projectId, fromVersion, toVersion, resd);
    if (rw) warnings.push(rw);
  }

  if (warnings.length > 0) upsertWarnings(warnings);
}

function restrictionWarning(
  projectId: string,
  fromVersion: string,
  toVersion: string,
  rd: RestrictionDiff,
): NewSchemaWarning | null {
  // Only unique_added requires approval — others are safe info notices
  if (rd.changeKind !== "unique_added") return null;
  return {
    id: randomUUID(),
    projectId,
    fromVersion,
    toVersion,
    entityKind: "restriction" as const,
    entityId: rd.constraintKey,
    entityName: `${rd.tableName}.(${rd.fields.join(",")})`,
    changeKind: rd.changeKind,
    resolution: "lossy_convert",
    fromValue: null,
    toValue: rd.dbName,
    message: rd.message,
  };
}
