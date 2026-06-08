"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useTableSelector } from "@/hooks/use-table-selector";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiffLookup } from "@/hooks/use-version-diff";
import { useFieldEditor } from "@/hooks/use-field-editor";
import { useFieldTemplates } from "@/hooks/use-field-templates";
import Link from "next/link";
import { VersionDiffBadge } from "@/components/shared/version-diff-badge";
import { classNames } from "@/lib/utils";
import { EmptyState, InlineError, LoadingCard, Pagination } from "@/components/built";
import type { PrismaModel } from "@/lib/stores/schema-store";
import { typeBadgeClass } from "@/constants/schema";
import { FieldLegend } from "@/components/schema/field-legend";
import { TableSelectorModal } from "@/features/table-selector";
import { TemplatesModal } from "@/components/schema/templates-modal";
import { FieldCard } from "@/components/schema/field-card";
import { NewFieldCard } from "@/components/schema/new-field-card";
import { TemplateDropdown } from "@/components/schema/template-dropdown";
import { RemovedFieldsSection } from "@/components/schema/removed-fields-section";

export function SchemaPageContent() {
  const { projectName, version, versions, hasProject, provider: projectProvider } = useProjectInfo();
  const { diffByFieldKey, diffByTableKey } = useVersionDiffLookup(projectName, version);
  const versionIdx = versions.indexOf(version);
  const previousVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // ── UI toggle state ────────────────────────────────────────────────────────
  const [isFieldLegendOpen, setIsFieldLegendOpen] = useState(true);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const tablesQuery = useQuery(trpc.tables.list.queryOptions({ projectName, version }, { enabled: !!projectName && !!version }));
  const models: PrismaModel[] = useMemo(() => (tablesQuery.data ?? []) as PrismaModel[], [tablesQuery.data]);

  const {
    selectedModelName,
    tableSearch, setTableSearch,
    isTableSelectorOpen, setIsTableSelectorOpen,
    selectModel,
  } = useTableSelector({ models });

  const selectedModel = useMemo(() => models.find((m) => m.name === selectedModelName) ?? null, [models, selectedModelName]);
  const selectedModelKey = selectedModel?.key ?? "";

  const removedFieldDiffs = useMemo(() => {
    const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
    return (td?.fieldDiffs ?? []).filter((fd) => fd.changeKind === "removed" && !fd.isPk);
  }, [selectedModelKey, diffByTableKey]);

  const fieldsQuery = useQuery(trpc.fields.list.queryOptions(
    { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey },
    { enabled: !!selectedModelName },
  ));
  const fields = fieldsQuery.data?.fields ?? [];
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];
  const scalarTypes: string[] = fieldsQuery.data?.scalarTypes ?? [];

  const enumsListQuery = useQuery(trpc.enums.list.queryOptions({ projectName, version }, { enabled: !!projectName && !!version }));
  const enumsList = enumsListQuery.data ?? [];
  const getEnumValues = (enumName: string) => enumsList.find((e) => e.name === enumName)?.values ?? [];

  // ── Field editor hook (mutations, drafts, filter, pagination) ──────────────
  const editor = useFieldEditor({
    projectName, version, selectedModelName, selectedModelKey,
    fields, enumTypes, scalarTypes,
  });

  // ── Field templates hook ───────────────────────────────────────────────────
  const invalidateFields = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.fields.list.queryOptions({ projectName, version, modelName: selectedModelName, modelKey: selectedModelKey }).queryKey,
    });

  const templateState = useFieldTemplates({ selectedModelName, selectedModelKey, fields, invalidateFields });

  const baseDropdownTemplates = useMemo(
    () => templateState.templates.filter(
      (t) => (t.provider === "All" || t.provider === projectProvider) && !templateState.usedTemplateNames.has(t.name),
    ),
    [templateState.templates, projectProvider, templateState.usedTemplateNames],
  );


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {!hasProject ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Select a project to manage schema fields.</p>
          <button type="button" onClick={() => setIsTemplatesOpen(true)}
            className="mt-4 h-9 rounded-md border border-emerald-500/40 bg-card px-5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15">
            Field Templates
          </button>
        </div>
      ) : (
        <section className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Main Window</p>
                <h3 className="mt-1 text-xl font-semibold text-foreground">Schema workspace</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{projectName}-{version}.prisma</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Table:</span>
                  <span className="text-base font-bold text-cyan-300">{selectedModel ? selectedModel.name : "—"}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setIsTemplatesOpen(true)}
                  className="h-9 min-w-32 rounded-md border border-emerald-500/40 bg-card px-4 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15">
                  Templates
                </button>
                <button type="button" onClick={() => setIsTableSelectorOpen(true)}
                  className="h-9 min-w-36 rounded-md border border-cyan-500/40 bg-card px-5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15">
                  Select Table
                </button>
                {selectedModelName ? (
                  <TemplateDropdown
                    baseTemplates={baseDropdownTemplates}
                    addingTemplateId={templateState.addingTemplateToTable}
                    onAddNewField={editor.addNewFieldCard}
                    onAddTemplate={(t) => templateState.addTemplateToTable(t)()}
                    onOpenFullTemplates={() => setIsTemplatesOpen(true)}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-5">
            {!selectedModelName ? (
              <EmptyState
                message="Select a table to edit its fields."
                action={{ label: "Select Table", onClick: () => setIsTableSelectorOpen(true), tone: "cyan" }}
              />
            ) : fieldsQuery.isLoading ? (
              <LoadingCard message="Loading fields…" />
            ) : (
              <div className="space-y-5">
                <div>
                  {/* ── Header row: table name + controls ──────────────────── */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    {/* Left: label + name + diff badge */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selected Table</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <h4 className="text-xl font-bold text-foreground">{selectedModelName}</h4>
                        {(() => {
                          const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
                          return td ? <VersionDiffBadge severity={td.severity} title={td.message} /> : null;
                        })()}
                      </div>
                    </div>

                    {/* Right: type filter + count + legend */}
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Type
                        <select value={editor.fieldTypeFilter} onChange={(e) => editor.setFieldTypeFilter(e.target.value)}
                          className="h-9 min-w-36 rounded-md border border-border bg-card px-3 text-sm font-semibold normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-600">
                          <option value="All">All fields</option>
                          {editor.fieldFilterOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {editor.filteredFields.length} shown · {editor.editableFields.length} editable · {editor.preservedFieldCount} preserved
                      </span>
                      <button type="button" onClick={() => setIsFieldLegendOpen((o) => !o)}
                        className={classNames(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition",
                          isFieldLegendOpen
                            ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                            : "border-border bg-card text-muted-foreground hover:border-cyan-500/30 hover:text-cyan-300",
                        )}
                        title="Field legend">?</button>
                    </div>
                  </div>

                  {/* Resolve banner — full width, only when table has diffs */}
                  {(() => {
                    const td = selectedModelKey ? diffByTableKey.get(selectedModelKey) : null;
                    if (!td) return null;
                    return (
                      <Link
                        href="/tracking?resolve=schema"
                        className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/15 px-5 py-3.5 transition hover:bg-amber-500/20 hover:border-amber-400 active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">⚠</span>
                          <div>
                            <p className="text-sm font-bold text-amber-200">Schema changes need review</p>
                            <p className="mt-0.5 text-xs text-amber-300">
                              Some fields have type, nullability, or naming changes. Approve them in the Tracking workflow before running a migration.
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-lg border border-amber-500/40 bg-card px-4 py-2 text-sm font-semibold text-amber-300 shadow-sm">
                          Resolve in Tracking →
                        </span>
                      </Link>
                    );
                  })()}

                  {isFieldLegendOpen ? <FieldLegend /> : null}

                  {editor.editableFields.length === 0 ? (
                    <EmptyState message="No editable scalar fields found." />
                  ) : editor.filteredFields.length === 0 ? (
                    <EmptyState message="No fields match the selected type filter." />
                  ) : (
                    <div className="space-y-4">
                      {editor.newFieldDrafts.length > 0 && (
                        <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                          {editor.newFieldDrafts.map((draft) => (
                            <NewFieldCard key={draft.id} draft={draft}
                              enumTypes={enumTypes} scalarTypeOptions={editor.scalarTypeOptions}
                              savingNewCardId={editor.savingNewCardId} getEnumValues={getEnumValues}
                              onUpdate={editor.updateNewFieldDraft} onSave={editor.saveNewFieldDraft} onRemove={editor.removeNewFieldDraft}
                            />
                          ))}
                        </div>
                      )}
                      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                        {editor.paginatedFields.map((field) => {
                          const draft = editor.fieldDrafts[field.key];
                          if (!draft) return null;
                          const hasChanges =
                            draft.name !== field.name || draft.type !== field.type || draft.nullable !== field.nullable ||
                            draft.unique !== field.unique || (draft.defaultValue ?? "") !== (field.defaultValue ?? "") ||
                            (draft.comment ?? "") !== (field.comment ?? "");
                          const fieldDiff = diffByFieldKey.get(field.key);
                          const cardBorder = fieldDiff
                            ? fieldDiff.severity === "breaking" ? "border-red-500/40"
                              : fieldDiff.severity === "warning" ? "border-amber-500/40" : "border-sky-500/40"
                            : "border-border";
                          return (
                            <FieldCard key={field.key} field={field} draft={draft} hasChanges={hasChanges}
                              fieldDiff={fieldDiff} cardBorder={cardBorder}
                              enumTypes={enumTypes} scalarTypeOptions={editor.scalarTypeOptions}
                              savingFieldKey={editor.savingFieldKey} deletingFieldKey={editor.deletingFieldKey}
                              getEnumValues={getEnumValues}
                              onUpdateDraft={editor.updateDraft} onSave={editor.saveField} onDelete={editor.deleteField}
                              previousVersion={previousVersion}
                              currentVersion={version}
                            />
                          );
                        })}
                      </div>
                      <Pagination page={editor.fieldPage} pageCount={editor.fieldPageCount} onPageChange={editor.setFieldPage} />
                    </div>
                  )}
                </div>

                <RemovedFieldsSection
                  removedFieldDiffs={removedFieldDiffs}
                  isPending={editor.isCreatingField}
                  onRestore={editor.restoreRemovedField}
                />

                <InlineError message={editor.error} />
              </div>
            )}
          </div>
        </section>
      )}

      <TableSelectorModal
        isOpen={isTableSelectorOpen} models={models} selectedModelName={selectedModelName}
        search={tableSearch} isLoading={tablesQuery.isLoading} tone="cyan"
        onSearch={setTableSearch} onSelect={selectModel} onClose={() => setIsTableSelectorOpen(false)}
        typeBadgeClass={typeBadgeClass}
      />

      <TemplatesModal
        isOpen={isTemplatesOpen} selectedModelName={selectedModelName}
        projectProvider={projectProvider} fieldTypeOptions={editor.fieldTypeOptions}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectTable={() => { setIsTemplatesOpen(false); setIsTableSelectorOpen(true); }}
        {...templateState}
      />
    </div>
  );
}
