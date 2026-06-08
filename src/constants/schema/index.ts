// Style helpers for schema field type badges and selects

export const defaultFieldTypes = [
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Timestamp",
  "Json",
  "Bytes",
] as const;

export function typeBadgeClass(type: string): string {
  if (type === "Int") return "bg-blue-500/15 text-blue-300";
  if (type === "String") return "bg-green-500/15 text-green-300";
  if (type === "DateTime") return "bg-orange-500/15 text-orange-300";
  if (type === "Uuid") return "bg-purple-500/15 text-purple-300";
  if (type === "BigInt") return "bg-rose-500/15 text-rose-300";
  return "bg-muted text-muted-foreground";
}

export function typeSelectClass(type: string): string {
  if (type === "Int")                         return "border-blue-500/30 bg-blue-500/15 text-blue-200";
  if (type === "BigInt")                      return "border-rose-500/30 bg-rose-500/15 text-rose-200";
  if (type === "Float" || type === "Decimal") return "border-sky-500/30 bg-sky-500/15 text-sky-200";
  if (type === "String")                      return "border-green-500/30 bg-green-500/15 text-green-200";
  if (type === "Boolean")                     return "border-amber-500/30 bg-amber-500/15 text-amber-200";
  if (type === "DateTime")                    return "border-orange-500/30 bg-orange-500/15 text-orange-200";
  if (type === "Timestamp")                   return "border-orange-500/30 bg-orange-500/15 text-orange-200";
  if (type === "Json")                        return "border-violet-500/30 bg-violet-500/15 text-violet-200";
  if (type === "Uuid")                        return "border-purple-500/30 bg-purple-500/15 text-purple-200";
  if (type === "Bytes")                       return "border-border bg-muted text-muted-foreground";
  return "border-border bg-card text-foreground";
}

export const fieldLegendItems = [
  { label: "Name", desc: "Prisma field name — camelCase, used in generated code and queries." },
  { label: "Type", desc: "Scalar type written into the Prisma schema (String, Int, Boolean…)." },
  { label: "Enum (indigo)", desc: "Project-defined enum type — select \"Enum\" in Type to reveal the enum picker. Values are shown as chips below." },
  { label: "Default", desc: "Default value expression in the schema, e.g. now(), false, 0." },
  { label: "Comment", desc: "Free-text note stored as a Prisma comment (/// …) above the field." },
  { label: "Nullable (green)", desc: "Field is optional — Prisma adds ? suffix, column accepts NULL." },
  { label: "Required (amber)", desc: "Field is required — column cannot be NULL, Prisma enforces presence." },
  { label: "Unique (violet)", desc: "Adds @unique — no two rows can share this value." },
  { label: "Multiple (sky)", desc: "No unique constraint — duplicate values across rows are allowed." },
  { label: "✓ Save", desc: "Persist unsaved edits to this field into the schema." },
  { label: "🗑 Delete", desc: "Remove this field from the table entirely (shown when no edits are pending)." },
] as const;
