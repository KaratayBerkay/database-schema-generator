export type MigrationRunTable = {
  name: string;
  created: number;
  updated: number;
  errors: number;
};

export type VersionMigrationRun = {
  id: string;
  fromVersion: string | null;
  toVersion: string;
  status: string; // "success" | "partial" | "error"
  startedAt: string | null;
  completedAt: string | null;
  rowsCreated: number;
  errors: number;
  stage1IssueCount: number;
  tables: MigrationRunTable[];
  error: string | null;
  connectionId: string;
  connectionLabel: string | null;
  createdAt: string;
};

export type VersionMigrationSummary = {
  count: number;
  success: number;
  partial: number;
  failed: number;
  totalRowsCreated: number;
};

export type VersionHistory = {
  name: string;
  createdAt: string;
  tables: number;
  fields: number;
  relations: number;
  restrictions: number;
  migrations: VersionMigrationRun[];
  migrationSummary: VersionMigrationSummary;
};
