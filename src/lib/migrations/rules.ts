import { randomUUID } from "node:crypto";
import type { ProjectVersionGraph, SchemaGraphField } from "@/lib/schema-db/graph";
import { MIGRATION_REFERENCE_FIELD, MIGRATION_REFERENCES_FIELD } from "@/lib/domain/schema-naming";

export type TypeConversionRule = {
  compatible: boolean;
  warning?: string;
};

const KNOWN_SCALARS = new Set([
  "string", "text", "integer", "int", "bigint", "float", "decimal",
  "boolean", "timestamp", "datetime", "json", "bytes",
]);

const compatibleConversions: Record<string, Set<string>> = {
  integer: new Set(["decimal", "float", "string", "text", "bytes"]),
  string: new Set(["text"]),
  float: new Set(["decimal", "integer"]),
};

export function checkTypeConversion(fromType: string, toType: string): TypeConversionRule {
  const from = fromType.toLowerCase();
  const to = toType.toLowerCase();
  if (from === to) return { compatible: true };

  // Non-scalar target (enum): string source is compatible — values cast to enum member.
  if (!KNOWN_SCALARS.has(to)) {
    if (from === "string" || from === "text") {
      return { compatible: true, warning: `String values will be cast to enum "${toType}". Ensure all existing values match valid enum members.` };
    }
    return { compatible: false };
  }

  const compatible = compatibleConversions[from]?.has(to) ?? false;
  if (!compatible) return { compatible: false };
  if (from === "float" && to === "integer") {
    return { compatible: true, warning: "Float values will be truncated to integer." };
  }
  return { compatible: true };
}

export function generatedUniqueValue(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

export type MigrationOrderItem = {
  tableId: string;
  modelName: string;
  dbName: string;
  parentCount: number;
};

export function computeMigrationOrder(graph: ProjectVersionGraph): MigrationOrderItem[] {
  const tableById = new Map(graph.tables.map((table) => [table.id, table]));

  // FK direction: a relation's source owns the FK (child) and references its target (parent).
  // Rows must be inserted parent-before-child so the FK is satisfiable, so the child depends on
  // the parent. Self-relations impose no cross-table ordering and are ignored here.
  const parents = new Map<string, Set<string>>();   // table -> tables it references (must come first)
  const children = new Map<string, Set<string>>();  // table -> tables that reference it
  for (const table of graph.tables) {
    parents.set(table.id, new Set());
    children.set(table.id, new Set());
  }
  for (const relation of graph.relations) {
    if (!tableById.has(relation.sourceTableId) || !tableById.has(relation.targetTableId)) continue;
    if (relation.sourceTableId === relation.targetTableId) continue;
    parents.get(relation.sourceTableId)!.add(relation.targetTableId);
    children.get(relation.targetTableId)!.add(relation.sourceTableId);
  }

  // parentCount = number of transitive ancestor tables (cycle-safe), kept for reporting/UI.
  const parentCountByTable = new Map<string, number>();
  for (const table of graph.tables) {
    const seen = new Set<string>();
    const stack = [...(parents.get(table.id) ?? [])];
    while (stack.length > 0) {
      const ancestor = stack.pop()!;
      if (seen.has(ancestor)) continue;
      seen.add(ancestor);
      for (const grandparent of parents.get(ancestor) ?? []) stack.push(grandparent);
    }
    parentCountByTable.set(table.id, seen.size);
  }

  // Kahn topological sort, parents first. Ties break by sortOrder then name; a true FK cycle is
  // broken by force-emitting the lowest-sortOrder remaining table (its back-edge FK must be
  // nullable to be insertable at all).
  const remainingDeps = new Map<string, number>();
  for (const table of graph.tables) remainingDeps.set(table.id, parents.get(table.id)!.size);
  const remaining = new Set(graph.tables.map((table) => table.id));
  const bySortOrder = (left: string, right: string) => {
    const leftTable = tableById.get(left)!;
    const rightTable = tableById.get(right)!;
    return leftTable.sortOrder - rightTable.sortOrder || leftTable.name.localeCompare(rightTable.name);
  };

  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => remainingDeps.get(id) === 0).sort(bySortOrder);
    const next = ready.length > 0 ? ready[0]! : [...remaining].sort(bySortOrder)[0]!;
    remaining.delete(next);
    ordered.push(next);
    for (const child of children.get(next) ?? []) {
      remainingDeps.set(child, (remainingDeps.get(child) ?? 0) - 1);
    }
  }

  return ordered.map((tableId) => {
    const table = tableById.get(tableId)!;
    return {
      tableId: table.tableId,
      modelName: table.name,
      dbName: table.dbName ?? table.name,
      parentCount: parentCountByTable.get(table.id) ?? 0,
    };
  });
}

export function fieldReadName(field: SchemaGraphField) {
  return field.dbName || field.name;
}

export function getRecordReference(record: Record<string, unknown>, index: number) {
  const existing =
    record[MIGRATION_REFERENCE_FIELD] ??
    record.id ??
    record.uuid ??
    record._id ??
    record.ID;
  return existing === null || existing === undefined || existing === ""
    ? `row-${index}`
    : String(existing);
}

export function withMigrationReference(
  record: Record<string, unknown>,
  index: number,
  references: Record<string, unknown> = {},
) {
  return {
    ...record,
    [MIGRATION_REFERENCE_FIELD]: getRecordReference(record, index),
    [MIGRATION_REFERENCES_FIELD]: references,
  };
}
