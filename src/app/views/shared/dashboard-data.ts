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
  detail?: string;
  later?: boolean;
  tone: string;
  metric: string;
};

export const menuItemsBase: MenuItem[] = [
  { label: "Tables", href: "/tables", tone: "bg-cyan-400", metric: "0 tables" },
  { label: "Enums", href: "/enums", tone: "bg-indigo-400", metric: "0 enums" },
  {
    label: "Schema",
    href: "/schema",
    detail: "Fields & Templates",
    tone: "bg-rose-400",
    metric: "draft",
  },
  {
    label: "Relations",
    href: "/relations",
    detail: "Relations & Templates",
    tone: "bg-violet-400",
    metric: "0 links",
  },
  {
    label: "Restrictions",
    href: "/restrictions",
    detail: "Restrictions & Templates",
    tone: "bg-blue-400",
    metric: "0 links",
  },
  {
    label: "Commentary",
    href: "/commentary",
    detail: "GraphQL like comment",
    tone: "bg-fuchsia-400",
    metric: "",
  },
  {
    label: "Tracking",
    href: "/tracking",
    detail: "Default value changes",
    tone: "bg-yellow-400",
    metric: "0 changes",
  },
  { label: "Validation", href: "/validation", tone: "bg-amber-400", metric: "0 rules" },
  {
    label: "SQL Query",
    href: "/sql-query",
    detail: "Example",
    tone: "bg-orange-400",
    metric: "draft",
  },
  {
    label: "Hierarchy",
    href: "/hierarchy",
    detail: "Order",
    tone: "bg-emerald-400",
    metric: "",
  },
  {
    label: "Migrations",
    href: "/migrations",
    detail: "Sync",
    tone: "bg-slate-300",
    metric: "",
  },
  { label: "Exports", href: "/exports", tone: "bg-blue-400", metric: "0 targets" },
  { label: "Imports", href: "/imports", tone: "bg-lime-400", metric: "" },
  { label: "History", href: "/history", tone: "bg-teal-400", metric: "0 saves" },
];

export function computeMenuItems(project: Project | null): MenuItem[] {
  if (!project) {
    return menuItemsBase;
  }

  return menuItemsBase.map((item) => {
    switch (item.label) {
      case "Tables":
        return { ...item, metric: `${project.tables} tables` };
      case "Enums":
        return { ...item, metric: `${project.enums ?? 0} enums` };
      case "Validation":
        return { ...item, metric: `${Math.max(0, project.fields - project.tables)} rules` };
      case "Relations":
        return { ...item, metric: `${project.relations} links` };
      case "Restrictions":
        return { ...item, metric: `${project.restrictions ?? 0} rules` };
      case "Hierarchy":
        return { ...item, metric: `${project.relations} deps` };
      case "Imports":
        return item;
      case "History":
        return { ...item, metric: `${project.versions.length} saves` };
      default:
        return item;
    }
  });
}
