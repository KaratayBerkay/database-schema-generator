"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { classNames } from "@/lib/utils";
import { graphqlOptions, prismaClients, providers } from "@/constants/projects";
import type { Project } from "@/types/projects";
import { PencilIcon } from "@/components/projects/project-icons";
import { Stat } from "@/components/built";

type ProjectFormValues = {
  name: string;
  provider: "Postgres" | "MySQL" | "SQLite";
  client: string;
  graphql: string;
};

type ProviderCfg = { border: string; badge: string; dot: string };

type ProjectCardProps = {
  project: Project;
  isActive: boolean;
  isEditing: boolean;
  isSaving: boolean;
  editForm: UseFormReturn<ProjectFormValues>;
  cfg: ProviderCfg;
  onSetActive: () => void;
  onNavigate: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
};

export function ProjectCard({
  project, isActive, isEditing, isSaving, editForm, cfg,
  onSetActive, onNavigate, onStartEdit, onCancelEdit, onSaveEdit, onDelete,
}: ProjectCardProps) {
  return (
    <div
      onClick={!isEditing ? onSetActive : undefined}
      className={classNames(
        "overflow-hidden rounded-xl border border-l-4 shadow-sm transition-all",
        !isEditing && "cursor-pointer",
        isEditing
          ? "border-l-amber-400 bg-card"
          : isActive
            ? "border-emerald-500/30 bg-emerald-500/15 ring-1 ring-emerald-200 hover:bg-emerald-500/20"
            : `${cfg.border} border-border bg-card hover:bg-background hover:shadow-md`,
      )}
    >
      {isEditing ? (
        <div className="space-y-3 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Editing</p>
          <div className="flex gap-3">
            <Input
              {...editForm.register("name")}
              className="h-9 flex-1 font-semibold"
              placeholder="Project name"
            />
            <Controller control={editForm.control} name="provider" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            <Controller control={editForm.control} name="client" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{prismaClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            <Controller control={editForm.control} name="graphql" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{graphqlOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          {editForm.formState.errors.root && (
            <p className="text-xs font-semibold text-rose-300">{editForm.formState.errors.root.message}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={isSaving}>Cancel</Button>
            <Button size="sm" onClick={onSaveEdit} disabled={isSaving}>{isSaving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className={classNames("inline-block h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
              <button
                type="button"
                onClick={onNavigate}
                className="truncate text-sm font-semibold text-foreground transition-colors hover:text-emerald-300"
              >
                {project.name.trim() || "Untitled"}
              </button>
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{project.id}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-4">
              <Badge variant="outline" className={classNames("text-[11px]", cfg.badge)}>{project.provider}</Badge>
              <Badge variant="outline" className="border-border bg-background text-[11px] text-muted-foreground">{project.schemaOptions.client}</Badge>
              {project.schemaOptions.graphql !== "None" && (
                <Badge variant="outline" className="border-violet-500/30 bg-violet-500/15 text-[11px] text-violet-300">{project.schemaOptions.graphql}</Badge>
              )}
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-5 sm:flex">
            <Stat label="tables" value={project.tables} />
            <Stat label="fields" value={project.fields} />
            <Stat label="relations" value={project.relations} />
            <Stat label={project.versions.length === 1 ? "version" : "versions"} value={project.versions.length} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isActive && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300">Active</Badge>
            )}
            <Button variant="ghost" size="sm"
              className="hidden text-muted-foreground hover:text-emerald-300 md:inline-flex"
              onClick={onNavigate}
            >
              Open →
            </Button>
            <Button variant="outline" size="icon-sm"
              onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
              className="hover:border-emerald-500/30 hover:bg-emerald-500/15 hover:text-emerald-300"
              aria-label="Edit"
            >
              <PencilIcon />
            </Button>
            <Button variant="destructive" size="sm" className="h-7"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
