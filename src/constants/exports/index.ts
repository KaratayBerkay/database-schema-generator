type ExportType = "prisma" | "drizzle" | "pickle-version" | "pickle-project";

export type { ExportType };

export const TS_KEYWORDS = new Set([
  "import", "export", "from", "const", "let", "var", "function", "return",
  "type", "interface", "extends", "as", "if", "else", "for", "while",
  "true", "false", "null", "undefined", "new", "class", "static",
]);

export const TS_TYPES = new Set([
  "string", "number", "boolean", "void", "never", "unknown", "object",
  "any", "bigint",
]);

export const PRISMA_KEYWORDS = new Set([
  "model", "datasource", "generator", "enum", "type",
]);

export const PRISMA_TYPES = new Set([
  "String", "Int", "BigInt", "Float", "Decimal", "Boolean",
  "DateTime", "Bytes", "Json",
]);

export const EXPORT_OPTIONS: Array<{
  type: ExportType;
  label: string;
  fileLabel: string;
  description: string;
  accent: string;
  badgeClass: string;
}> = [
  {
    type: "prisma",
    label: "Prisma Schema",
    fileLabel: ".prisma",
    description:
      "Export the generated Prisma schema for the selected project version. Includes datasource, generator, models, relations, and constraints.",
    accent: "border-blue-500/25 bg-blue-500/10",
    badgeClass: "bg-blue-500/20 text-blue-300",
  },
  {
    type: "drizzle",
    label: "Drizzle TypeScript",
    fileLabel: ".ts",
    description:
      "Generate a Drizzle ORM TypeScript schema from the canonical model. Includes table definitions, column types, foreign key references, and index helpers.",
    accent: "border-emerald-500/25 bg-emerald-500/10",
    badgeClass: "bg-emerald-500/20 text-emerald-300",
  },
  {
    type: "pickle-version",
    label: "Version Pickle",
    fileLabel: ".json",
    description:
      "Download a full JSON backup of the current version's schema — tables, fields, relations, restrictions, and enums. Downloads directly as a file.",
    accent: "border-amber-500/25 bg-amber-500/10",
    badgeClass: "bg-amber-500/20 text-amber-300",
  },
  {
    type: "pickle-project",
    label: "Project Pickle",
    fileLabel: ".json",
    description:
      "Download a full JSON backup of all versions in this project. Every schema version's complete graph in one file.",
    accent: "border-orange-500/25 bg-orange-500/10",
    badgeClass: "bg-orange-500/20 text-orange-300",
  },
];
