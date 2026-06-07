export type ImportMode = "version" | "project";

export type VersionStats = {
  name: string;
  tableCount: number;
  fieldCount: number;
  relationCount: number;
  enumCount: number;
};

export type ParsedPreview = {
  type: "version" | "project";
  exportedAt: string;
  sourceProjectName: string;
  provider: string;
  versionCount: number;
  versions: VersionStats[];
};

// ─── Database import (introspect a connection → new project) ───────────────────

/** One change the compatibility pass made to the introspected schema. */
export type ImportReportEntry = {
  /** "coerced" = imported with a change; "skipped" = left out entirely. */
  level: "coerced" | "skipped";
  scope: "model" | "field" | "enum" | "relation" | "restriction";
  /** Model the entry concerns (the model's own name, or the owner of the field). */
  model: string;
  /** Field name, when the entry concerns a field/relation. */
  field?: string;
  /** Human-readable explanation of what changed and why. */
  message: string;
};

export type ImportReport = {
  entries: ImportReportEntry[];
  /** Model names that will be imported (after coercion). */
  modelsIncluded: string[];
  /** Model names dropped because they violate a non-fixable rule. */
  modelsSkipped: string[];
  /** Count of fields whose type/name/restriction was coerced. */
  fieldsCoerced: number;
};

/** Preview of a database import — the report plus the inferred provider. No project is created. */
export type ImportAnalysis = {
  provider: string;
  report: ImportReport;
};

/** Result of committing a database import — a fresh project with two versions. */
export type DatabaseImportResult = {
  projectId: string;
  projectName: string;
  /** version-0: the schema as imported, no rules applied (the fallback / migration source). */
  originalVersion: string;
  /** The rules-applied version (e.g. "1.0603"), derived from version-0 sharing stable IDs. */
  rulesVersion: string;
  report: ImportReport;
  stats: { tableCount: number; fieldCount: number; relationCount: number };
};
