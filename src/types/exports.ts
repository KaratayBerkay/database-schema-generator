export type ExportResponse = {
  id?: string;
  code?: string;
  fileName?: string;
  tableCount?: number;
  enumCount?: number;
  error?: string;
};

export type ExportDialogState = {
  exportId: string;
  code: string;
  fileName: string;
  lang: "ts" | "prisma" | "python" | "sql";
  tableCount: number;
  enumCount: number;
  // Format chip shown in the dialog header (e.g. SQLAlchemy / Django / SQL).
  // Distinguishes formats that share a highlight lang (SQLAlchemy & Django are both `python`).
  badge?: { label: string; className: string };
};
