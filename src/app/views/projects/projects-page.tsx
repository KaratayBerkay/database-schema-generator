"use client";

import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { useProjectsPageState } from "@/hooks/use-projects-page-state";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProjectsQuery, useProjectMutations } from "@/queries/projects";
import { useDashboard, useActiveProject } from "../shared/dashboard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter, useSearchParams } from "next/navigation";
import {
  defaultSchemaOptions,
  graphqlOptions,
  prismaClients,
  providerConfig,
  providers,
} from "@/constants/projects";
import { DatabaseIcon } from "@/components/projects/project-icons";
import { ProjectCard } from "@/components/projects/project-card";
import { classNames } from "@/lib/utils";
import { isOriginalVersion } from "@/lib/domain/version-rules";
import type { Project } from "@/types/projects";
import { InlineError } from "@/components/built";
import { useProjectReset } from "@/hooks/use-project-reset";

// ─── Schema ───────────────────────────────────────────────────────────────────

const projectFormSchema = z.object({
  name: z.string().min(8, "Project name must be at least 8 characters."),
  provider: z.enum(["Postgres", "MySQL", "SQLite"] as const),
  client: z.string().min(1),
  graphql: z.string().min(1),
});
type ProjectFormValues = z.infer<typeof projectFormSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function incrementVersion(version: string): string {
  const dotIdx = version.lastIndexOf(".");
  if (dotIdx === -1) return `${version}.0002`;
  const major = version.slice(0, dotIdx);
  const minor = version.slice(dotIdx + 1);
  const next = (parseInt(minor, 10) + 1).toString().padStart(minor.length, "0");
  return `${major}.${next}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectsPageContent() {
  const { data: projects = [] } = useProjectsQuery();
  const activeProject = useActiveProject();
  const { activeProjectId, selectedVersion, setActiveProjectId, setSelectedVersion } = useDashboard();
  const activeVersions = activeProject?.versions.map((v) => v.name) ?? [];
  const sourceVersion = activeVersions.at(-1) ?? "";
  const nextVersion = sourceVersion ? incrementVersion(sourceVersion) : "";
  const router = useRouter();

  // ── Search filters ───────────────────────────────────────────────────────────
  // Pre-fill the project search from `?search=` (e.g. the Scenarios "Manage in
  // Projects" shortcut passes the loaded project id so it's filtered on arrival).
  const searchParams = useSearchParams();
  const [projectSearch, setProjectSearch] = useState(() => searchParams.get("search") ?? "");
  const [versionSearch, setVersionSearch] = useState("");

  const projectQuery = projectSearch.trim().toLowerCase();
  const filteredProjects = projectQuery
    ? projects.filter(
        (p) => p.name.toLowerCase().includes(projectQuery) || p.id.toLowerCase().includes(projectQuery),
      )
    : projects;

  const versionQuery = versionSearch.trim().toLowerCase();
  const filteredVersions = versionQuery
    ? activeVersions.filter((v) => v.toLowerCase().includes(versionQuery))
    : activeVersions;

  // ── Forms ──────────────────────────────────────────────────────────────────

  const createForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      provider: "Postgres",
      client: defaultSchemaOptions.client,
      graphql: defaultSchemaOptions.graphql,
    },
  });

  const editForm = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { name: "", provider: "Postgres", client: "", graphql: "" },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const { invalidate: invalidateProjects, create: createMutation, update: updateMutation, delete: deleteMutation, fork: forkMutation } =
    useProjectMutations();

  // ── State ──────────────────────────────────────────────────────────────────

  const forkingVersion = forkMutation.isPending;
  const isCreating = createMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const reset = useProjectReset();
  const {
    showForkConfirm, setShowForkConfirm,
    forkError, setForkError,
    deleteConfirmation, setDeleteConfirmation,
    deleteTarget, setDeleteTarget,
    editingProjectId, setEditingProjectId,
    savingProjectId, setSavingProjectId,
  } = useProjectsPageState();

  // ── Create handler ─────────────────────────────────────────────────────────

  const nameValue = createForm.watch("name");
  const isNameDuplicate = projects.some(
    (p) => p.name.trim().toLowerCase() === nameValue.trim().toLowerCase(),
  );
  const canCreateProject = !isCreating && !isNameDuplicate && createForm.formState.isValid;

  const onCreateSubmit = createForm.handleSubmit((data) => {
    createMutation.mutate(
      {
        name: data.name.trim(),
        provider: data.provider,
        schemaOptions: { client: data.client, graphql: data.graphql },
      },
      {
        onSuccess: (project) => { void invalidateProjects(); if (project) setActiveProjectId(project.id); createForm.reset(); },
        onError: (err) => createForm.setError("root", { message: err.message }),
      },
    );
  });

  // ── Edit handlers ──────────────────────────────────────────────────────────

  const startProjectEdit = (project: Project) => {
    setEditingProjectId(project.id);
    editForm.reset({
      name: project.name.trim(),
      provider: project.provider as "Postgres" | "MySQL" | "SQLite",
      client: project.schemaOptions.client,
      graphql: project.schemaOptions.graphql,
    });
  };

  const cancelProjectEdit = () => {
    setEditingProjectId(null);
    editForm.reset();
  };

  const saveProjectEdit = editForm.handleSubmit((data) => {
    if (!editingProjectId) return;
    setSavingProjectId(editingProjectId);
    updateMutation.mutate(
      {
        id: editingProjectId,
        name: data.name.trim(),
        provider: data.provider,
        schemaOptions: { client: data.client, graphql: data.graphql },
      },
      {
        onSuccess: () => { void invalidateProjects(); setSavingProjectId(null); cancelProjectEdit(); },
        onError: (err) => { setSavingProjectId(null); editForm.setError("root", { message: err.message }); },
      },
    );
  });

  // ── Delete / reset handlers ────────────────────────────────────────────────

  const closeDeleteDialog = () => { setDeleteTarget(null); setDeleteConfirmation(""); };

  const confirmDelete = () => {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return;
    const wasActive = deleteTarget.id === activeProjectId;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: (remaining) => {
          void invalidateProjects();
          closeDeleteDialog();
          if (wasActive) router.push(remaining && remaining.length > 0 ? "/projects" : "/");
        },
      },
    );
  };


  // ── JSX ────────────────────────────────────────────────────────────────────

  const pCfg = (provider: string) => providerConfig[provider] ?? providerConfig.Postgres;



  return (
    <div className="space-y-8">

      {/* ── Section header ───────────────────────────────────────────────── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Schema Studio</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Projects</h2>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="projects" className="space-y-0">
        {/* Nav bar with bottom border */}
        <div className="-mx-5 border-b border-border px-5 md:-mx-8 md:px-8">
          <TabsList variant="line" className="h-auto gap-6 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="projects"
              className="h-11 gap-2 rounded-none bg-transparent px-0 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-active:text-foreground data-active:shadow-none"
            >
              Projects
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {projects.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="versions"
              className="h-11 gap-2 rounded-none bg-transparent px-0 text-sm font-medium text-muted-foreground shadow-none hover:text-foreground data-active:text-foreground data-active:shadow-none"
            >
              Versions
              {activeProject && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {activeVersions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Projects tab ────────────────────────────────────────────────── */}
        <TabsContent value="projects" className="mt-6 space-y-5">

          {/* Create form */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-gradient-to-r from-emerald-500/10 to-transparent px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600">
                  <DatabaseIcon />
                </div>
                <span className="text-sm font-semibold text-foreground">New Project</span>
              </div>
            </div>

            <Form {...createForm}>
              <form onSubmit={onCreateSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px_160px_auto]">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Project name</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-10" placeholder="e.g. Customer Portal" autoComplete="off" />
                        </FormControl>
                        {isNameDuplicate && field.value.trim().length >= 8 && (
                          <p className="text-[11px] font-medium text-rose-300">Name already exists.</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Provider</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem className="gap-1">
                        <FormLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Prisma client</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {prismaClients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button type="submit" disabled={!canCreateProject} className="h-10 w-full">
                      {isCreating ? "Creating…" : "Create"}
                    </Button>
                  </div>
                </div>

                {/* GraphQL — secondary option, full row */}
                <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
                  <FormField
                    control={createForm.control}
                    name="graphql"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-3 space-y-0">
                        <FormLabel className="shrink-0 text-xs font-medium text-muted-foreground">GraphQL</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-8 w-64">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {graphqlOptions.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {createForm.formState.errors.root && (
                  <p className="mt-2 text-sm font-semibold text-rose-300">
                    {createForm.formState.errors.root.message}
                  </p>
                )}
              </form>
            </Form>
          </div>

          {/* Project list */}
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <DatabaseIcon className="text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">No projects yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Fill in the form above to create your first project.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <IconSearch size={16} stroke={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects by name or ID…"
                  className="h-10 pl-9"
                  autoComplete="off"
                />
              </div>
              {filteredProjects.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-card py-8 text-center text-sm text-muted-foreground">
                  No projects match “{projectSearch.trim()}”.
                </p>
              ) : (
                filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={project.id === activeProjectId}
                    isEditing={editingProjectId === project.id}
                    isSaving={savingProjectId === project.id}
                    editForm={editForm}
                    cfg={pCfg(project.provider)}
                    onSetActive={() => setActiveProjectId(project.id)}
                    onNavigate={() => { setActiveProjectId(project.id); router.push("/tables"); }}
                    onStartEdit={() => startProjectEdit(project)}
                    onCancelEdit={cancelProjectEdit}
                    onSaveEdit={saveProjectEdit}
                    onDelete={() => setDeleteTarget(project)}
                  />
                ))
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Versions tab ────────────────────────────────────────────────── */}
        <TabsContent value="versions" className="mt-6">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            {!activeProject ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-sm font-semibold text-muted-foreground">No project selected</p>
                <p className="mt-1 text-xs text-muted-foreground">Activate a project from the Projects tab to manage its versions.</p>
              </div>
            ) : (
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Version history</p>
                    <p className="mt-0.5 text-base font-semibold text-foreground">{activeProject.name.trim()}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {activeVersions.length} {activeVersions.length === 1 ? "version" : "versions"}
                  </Badge>
                </div>
                <Separator className="my-4" />
                {activeVersions.length > 0 && (
                  <div className="relative mb-3">
                    <IconSearch size={16} stroke={1.8} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={versionSearch}
                      onChange={(e) => setVersionSearch(e.target.value)}
                      placeholder="Search versions…"
                      className="h-9 pl-9"
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  {activeVersions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No versions available.</p>
                  ) : filteredVersions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No versions match “{versionSearch.trim()}”.</p>
                  ) : (
                    filteredVersions.map((version) => {
                      const locked = isOriginalVersion(version);
                      const isSelected = !locked && version === selectedVersion;
                      const isLatest = version === activeVersions[activeVersions.length - 1];
                      return (
                        <button
                          key={version}
                          type="button"
                          disabled={locked}
                          onClick={() => { if (!locked) setSelectedVersion(version); }}
                          title={locked ? "Read-only original schema — selectable only as a migration source" : undefined}
                          className={classNames(
                            "group flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition",
                            locked ? "cursor-not-allowed border-border bg-background/70"
                            : isSelected ? "border-emerald-500/40 bg-emerald-500/15"
                            : "border-border bg-card hover:border-border hover:bg-background",
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={classNames("h-2 w-2 rounded-full", isSelected ? "bg-emerald-500" : "bg-muted")} />
                            <span className={classNames("font-mono text-sm font-semibold", locked ? "text-muted-foreground" : isSelected ? "text-emerald-200" : "text-foreground")}>
                              {version}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {locked && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-[10px] text-amber-300">read-only · migration source</Badge>}
                            {!locked && isLatest && <Badge variant="outline" className="border-border bg-background text-[10px] text-muted-foreground">latest</Badge>}
                            {isSelected && <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/20 text-[10px] text-emerald-300">viewing</Badge>}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <Separator className="my-4" />
                <InlineError message={forkError} className="mb-3 text-xs" />
                <Button
                  disabled={forkingVersion || activeVersions.length === 0}
                  onClick={() => { setForkError(""); setShowForkConfirm(true); }}
                  className="w-full"
                >
                  {forkingVersion ? "Creating…" : "+ Create new version"}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-500/15 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-rose-300">Danger Zone</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Permanently deletes all projects, schemas, and generated artifacts.</p>
        </div>
        <Button variant="destructive" onClick={reset.openReset} className="shrink-0">
          Reset All Data
        </Button>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <Dialog open={showForkConfirm && !!activeProject} onOpenChange={(open) => { if (!open) setShowForkConfirm(false); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Create a new version?</DialogTitle>
            <DialogDescription>
              Contents of <span className="font-semibold text-foreground">{sourceVersion}</span> will be copied into <span className="font-semibold text-foreground">{nextVersion}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-md border bg-muted/50 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">Source</p>
              <p className="mt-0.5 font-mono text-sm font-semibold">{sourceVersion}</p>
            </div>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-300">New version</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-200">{nextVersion}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForkConfirm(false)}>Cancel</Button>
            <Button disabled={forkingVersion} onClick={() => {
              setForkError(""); setShowForkConfirm(false);
              forkMutation.mutate({ projectId: activeProjectId }, { onSuccess: (result) => { void invalidateProjects(); if (result) setSelectedVersion(result.newVersion); }, onError: (err) => setForkError(err.message ?? "Could not create version.") });
            }}>
              {forkingVersion ? "Creating…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reset.showResetConfirm} onOpenChange={(open) => { if (!open) reset.closeReset(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset all data</DialogTitle>
            <DialogDescription>Irreversible. Type <span className="font-mono font-semibold text-destructive">RESET</span> to confirm.</DialogDescription>
          </DialogHeader>
          <Input value={reset.resetConfirmation} onChange={(e) => reset.setResetConfirmation(e.target.value)} placeholder="RESET" className="h-11" />
          {reset.resetError && <p className="text-sm text-destructive">{reset.resetError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={reset.closeReset}>Cancel</Button>
            <Button variant="destructive" onClick={reset.confirmReset} disabled={reset.resetConfirmation !== "RESET" || reset.isResetting}>
              {reset.isResetting ? "Resetting…" : "Reset Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>Permanent. Type the project name exactly.</DialogDescription>
          </DialogHeader>
          <p className="rounded-md bg-muted px-3 py-2 text-sm font-semibold">{deleteTarget?.name}</p>
          <div className="grid gap-1.5">
            <label htmlFor="delete-project-name" className="text-sm font-semibold">Copy project name</label>
            <Input id="delete-project-name" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} className="h-11" placeholder={deleteTarget?.name ?? ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteConfirmation !== (deleteTarget?.name ?? "") || isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
