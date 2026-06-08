import type { TrackingEntryKind, TrackingChangeKind } from "@/lib/domain/tracking-utils";

// ─── Warning severity ─────────────────────────────────────────────────────────

export type Severity = "breaking" | "warning" | "info" | "approved";

export const severityConfig: Record<Severity, { row: string; badge: string; label: string; dot: string }> = {
  breaking: { row: "bg-red-500/15",    badge: "border-red-500/30 bg-red-500/15 text-red-300",       label: "Breaking", dot: "bg-red-500"    },
  warning:  { row: "bg-amber-500/15",  badge: "border-amber-500/30 bg-amber-500/15 text-amber-300", label: "Warning",  dot: "bg-amber-500"  },
  info:     { row: "",                badge: "border-sky-500/30 bg-sky-500/15 text-sky-300",        label: "Info",     dot: "bg-sky-400"    },
  approved: { row: "bg-emerald-500/15",badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300", label: "Approved", dot: "bg-emerald-400" },
};

// ─── Resolution strategy ──────────────────────────────────────────────────────

export type StrategyName =
  | "Unique Prefix + UUID" | "Static Default" | "Set NULL"
  | "Type Cast" | "Remapped" | "Data Dropped" | "Acknowledged" | "Pending";

export const STRATEGIES_BY_KIND: Record<string, StrategyName[]> = {
  table:       ["Data Dropped", "Acknowledged"],
  enum:        ["Remapped", "Set NULL", "Data Dropped", "Acknowledged"],
  field:       ["Unique Prefix + UUID", "Static Default", "Type Cast", "Set NULL", "Data Dropped", "Acknowledged"],
  relation:    ["Data Dropped", "Acknowledged"],
  restriction: ["Acknowledged"],
};

export const strategyStyle: Record<StrategyName, { cls: string }> = {
  "Unique Prefix + UUID": { cls: "border-violet-500/30 bg-violet-500/15 text-violet-300"  },
  "Static Default":       { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" },
  "Set NULL":             { cls: "border-border bg-muted text-muted-foreground"           },
  "Type Cast":            { cls: "border-sky-500/30 bg-sky-500/15 text-sky-300"            },
  "Remapped":             { cls: "border-amber-500/30 bg-amber-500/15 text-amber-300"      },
  "Data Dropped":         { cls: "border-rose-500/30 bg-rose-500/15 text-rose-300"         },
  "Acknowledged":         { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" },
  "Pending":              { cls: "border-border bg-card text-muted-foreground"             },
};

export const VALID_TABS = ["all", "tables", "enums", "schema", "relations", "restrictions"] as const;
export type TrackingTab = typeof VALID_TABS[number];

export const changeBadge: Record<TrackingChangeKind, { cls: string; label: string }> = {
  added:         { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",  label: "Added"         },
  removed:       { cls: "border-red-500/30 bg-red-500/15 text-red-300",              label: "Removed"       },
  changed:       { cls: "border-amber-500/30 bg-amber-500/15 text-amber-300",        label: "Changed"       },
  renamed:       { cls: "border-sky-500/30 bg-sky-500/15 text-sky-300",              label: "Renamed"       },
  value_added:   { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",  label: "Value added"   },
  value_removed: { cls: "border-red-500/30 bg-red-500/15 text-red-300",              label: "Value removed" },
};

export const rowTint: Partial<Record<TrackingChangeKind, string>> = {
  added:         "bg-emerald-500/15",
  removed:       "bg-red-500/15",
  changed:       "bg-amber-500/15",
  renamed:       "bg-sky-500/15",
  value_added:   "bg-emerald-500/15",
  value_removed: "bg-red-500/15",
};

export const kindLabel: Record<TrackingEntryKind, string> = {
  field_default: "Field default",
  enum:          "Enum",
  enum_value:    "Enum value",
};

export const tabMeta: Record<string, { dot: string; label: string }> = {
  all:          { dot: "bg-slate-400",   label: "All Changes"  },
  tables:       { dot: "bg-cyan-500",    label: "Tables"       },
  enums:        { dot: "bg-indigo-500",  label: "Enums"        },
  schema:       { dot: "bg-rose-500",    label: "Schema"       },
  relations:    { dot: "bg-violet-500",  label: "Relations"    },
  restrictions: { dot: "bg-blue-500",    label: "Restrictions" },
};

export const tabAccent: Record<string, string> = {
  all:          "data-active:border-slate-700",
  tables:       "data-active:border-cyan-600",
  enums:        "data-active:border-indigo-600",
  schema:       "data-active:border-rose-600",
  relations:    "data-active:border-violet-600",
  restrictions: "data-active:border-blue-600",
};
