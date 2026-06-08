import type { PrismaRestrictionType } from "@/lib/stores/schema-store";

export function restrictionTypeLabel(type: PrismaRestrictionType): string {
  return type === "UNIQUE" ? "Unique" : "Index";
}

export function restrictionTypeClass(type: PrismaRestrictionType): string {
  return type === "UNIQUE"
    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
    : "border-violet-500/30 bg-violet-500/15 text-violet-300";
}
