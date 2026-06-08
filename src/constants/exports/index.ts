type ExportType = "prisma" | "drizzle" | "sqlalchemy" | "django" | "sql" | "pickle-version" | "pickle-project";

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

export const PYTHON_KEYWORDS = new Set([
  "import", "from", "class", "def", "return", "pass", "if", "else", "elif",
  "for", "while", "in", "is", "not", "and", "or", "None", "True", "False",
  "as", "with", "lambda", "yield", "raise", "try", "except", "finally",
]);

export const PYTHON_TYPES = new Set([
  "str", "int", "float", "bool", "bytes", "dict", "list", "datetime",
  "Decimal", "Optional", "Mapped", "Base",
  "String", "Integer", "BigInteger", "SmallInteger", "Float", "Numeric",
  "Boolean", "DateTime", "LargeBinary", "JSON", "JSONB", "UUID", "Enum",
  // Django model fields / helpers
  "models", "CharField", "TextField", "IntegerField", "BigIntegerField",
  "SmallIntegerField", "FloatField", "DecimalField", "BooleanField",
  "DateTimeField", "JSONField", "UUIDField", "BinaryField", "AutoField",
  "BigAutoField", "ForeignKey", "TextChoices", "Meta",
]);

export const SQL_KEYWORDS = new Set([
  "CREATE", "TABLE", "TYPE", "AS", "ENUM", "ALTER", "ADD", "CONSTRAINT",
  "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE", "INDEX", "ON",
  "NOT", "NULL", "DEFAULT", "CHECK", "IN", "AUTOINCREMENT", "AUTO_INCREMENT",
  "DELETE", "UPDATE", "CASCADE", "RESTRICT", "SET", "NO", "ACTION",
  "TRUE", "FALSE", "CURRENT_TIMESTAMP",
]);

export const SQL_TYPES = new Set([
  "INTEGER", "INT", "SMALLINT", "BIGINT", "SERIAL", "BIGSERIAL", "TEXT",
  "VARCHAR", "CHAR", "UUID", "BOOLEAN", "TINYINT", "NUMERIC", "DECIMAL",
  "REAL", "DOUBLE", "PRECISION", "TIMESTAMP", "TIMESTAMPTZ", "DATETIME",
  "JSON", "JSONB", "BYTEA", "BLOB",
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
    type: "sqlalchemy",
    label: "SQLAlchemy Python",
    fileLabel: ".py",
    description:
      "Generate a SQLAlchemy 2.0 declarative model file from the canonical model. Includes Mapped[] columns, foreign keys with relationship() pairs, enums, and table-level UNIQUE/INDEX constraints.",
    accent: "border-violet-500/25 bg-violet-500/10",
    badgeClass: "bg-violet-500/20 text-violet-300",
  },
  {
    type: "django",
    label: "Django Models",
    fileLabel: ".py",
    description:
      "Generate a Django models.py from the canonical model. Includes models.Model classes with field types, ForeignKey relations, module-level TextChoices enums, and a Meta class with db_table, UniqueConstraint, and Index.",
    accent: "border-lime-500/25 bg-lime-500/10",
    badgeClass: "bg-lime-500/20 text-lime-300",
  },
  {
    type: "sql",
    label: "Plain SQL",
    fileLabel: ".sql",
    description:
      "Generate a plain SQL DDL script for the selected provider. Includes CREATE TABLE statements with column types, primary keys, UNIQUE/INDEX constraints, foreign keys, and enum types.",
    accent: "border-cyan-500/25 bg-cyan-500/10",
    badgeClass: "bg-cyan-500/20 text-cyan-300",
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
