export function fieldTypeBadgeClass(type: string): string {
  if (type === "Int" || type === "integer" || type === "BigInt" || type === "bigint") return "bg-blue-500/15 text-blue-300";
  if (type === "String" || type === "string") return "bg-green-500/15 text-green-300";
  if (type === "DateTime" || type === "timestamp") return "bg-orange-500/15 text-orange-300";
  if (type === "Uuid") return "bg-purple-500/15 text-purple-300";
  if (type === "Float" || type === "float" || type === "Decimal" || type === "decimal") return "bg-cyan-500/15 text-cyan-300";
  if (type === "Boolean" || type === "boolean") return "bg-emerald-500/15 text-emerald-300";
  if (type === "Bytes" || type === "bytes") return "bg-amber-500/15 text-amber-300";
  if (type === "Json" || type === "json") return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
}
