import type { PrismaRestrictionType } from "@/lib/stores/schema-store";

export type RestrictionDraft = {
  type: PrismaRestrictionType;
  fields: string[];
  dbName: string;
};
