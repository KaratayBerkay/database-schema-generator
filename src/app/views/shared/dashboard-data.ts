import type { Project } from "@/types/projects";

export type { Project, ProjectVersion, SchemaOptions } from "@/types/projects";
export {
  defaultSchemaOptions,
  graphqlOptions,
  prismaClients,
  providers,
} from "@/constants/projects";

export type MenuItem = {
  label: string;
  href: string;
  later?: boolean;
  tone: string;
  metric: string;
};

/** Counts that aren't derivable from the project record itself. */
export type MenuCounts = {
  validators: number;
  exports: number;
  changes: number;
};

export const menuItemsBase: MenuItem[] = [
  { label: "Tables", href: "/tables", tone: "bg-cyan-400", metric: "0 tables" },
  { label: "Enums", href: "/enums", tone: "bg-indigo-400", metric: "0 enums" },
  { label: "Schema", href: "/schema", tone: "bg-rose-400", metric: "0 fields" },
  { label: "Relations", href: "/relations", tone: "bg-violet-400", metric: "0 links" },
  { label: "Restrictions", href: "/restrictions", tone: "bg-blue-400", metric: "0 rules" },
  { label: "Commentary", href: "/commentary", tone: "bg-fuchsia-400", metric: "" },
  { label: "Tracking", href: "/tracking", tone: "bg-yellow-400", metric: "0 changes" },
  { label: "Validation", href: "/validation", tone: "bg-amber-400", metric: "0 validators" },
  { label: "SQL Query", href: "/sql-query", tone: "bg-orange-400", metric: "" },
  { label: "Hierarchy", href: "/hierarchy", tone: "bg-emerald-400", metric: "" },
  { label: "Migrations", href: "/migrations", tone: "bg-slate-300", metric: "" },
  { label: "Exports", href: "/exports", tone: "bg-blue-400", metric: "0 exports" },
  { label: "Imports", href: "/imports", tone: "bg-lime-400", metric: "" },
  { label: "History", href: "/history", tone: "bg-teal-400", metric: "0 saves" },
];

export function computeMenuItems(
  project: Project | null,
  counts: MenuCounts,
): MenuItem[] {
  if (!project) {
    return menuItemsBase;
  }

  return menuItemsBase.map((item) => {
    switch (item.label) {
      case "Tables":
        return { ...item, metric: `${project.tables} tables` };
      case "Enums":
        return { ...item, metric: `${project.enums ?? 0} enums` };
      case "Schema":
        return { ...item, metric: `${project.fields} fields` };
      case "Relations":
        return { ...item, metric: `${project.relations} links` };
      case "Restrictions":
        return { ...item, metric: `${project.restrictions ?? 0} rules` };
      case "Validation":
        return { ...item, metric: `${counts.validators} validators` };
      case "Tracking":
        return { ...item, metric: `${counts.changes} changes` };
      case "Exports":
        return { ...item, metric: `${counts.exports} exports` };
      case "History":
        return { ...item, metric: `${project.versions.length} saves` };
      default:
        return item;
    }
  });
}
