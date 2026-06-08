export const MODAL_TABLES_PER_PAGE = 12;

import type { PrismaRelation } from "@/lib/stores/schema-store";
import type { RelationDraft } from "@/types/relation";

export const emptyRelationDraft: RelationDraft = {
  name: "", targetModel: "", backReferenceName: "", cardinality: "one-to-many",
  fields: "", references: "", onDelete: "NoAction", onUpdate: "NoAction", nullable: true,
};

/** Splits a comma-separated string into a trimmed string array. */
export function csvToList(value: string): string[] {
  return value.split(",").map((i) => i.trim()).filter(Boolean);
}

/** Joins a string array into a comma-separated string. */
export function listToCsv(value: string[]): string {
  return value.join(", ");
}

/** Derives a back-reference name from source model and relation names. */
export function deriveBackReferenceName(sourceName: string, relationName: string): string {
  if (!sourceName && !relationName) return "";
  const source = sourceName ? `${sourceName.charAt(0).toLowerCase()}${sourceName.slice(1)}` : "";
  const rel    = relationName ? `${relationName.charAt(0).toUpperCase()}${relationName.slice(1)}` : "";
  return `${source}${rel}`;
}

export const relationKindLabels: Record<PrismaRelation["kind"], string> = {
  "one-to-one": "One to one",
  "one-to-many": "One to many",
  "many-to-one": "Many to one",
  "many-to-many": "Many to many",
};

export const relationKindClasses: Record<PrismaRelation["kind"], string> = {
  "one-to-one": "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
  "one-to-many": "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  "many-to-one": "border-violet-500/30 bg-violet-500/15 text-violet-300",
  "many-to-many": "border-amber-500/30 bg-amber-500/15 text-amber-300",
};

export function relationKindLabel(kind: PrismaRelation["kind"]): string {
  return relationKindLabels[kind];
}

export function relationKindClass(kind: PrismaRelation["kind"]): string {
  return relationKindClasses[kind];
}
