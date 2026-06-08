"use client";

import { useEffect, useMemo, useState } from "react";
import { useTablesQuery } from "@/queries/tables";
import { useTableSelector } from "@/hooks/use-table-selector";
import { useRestrictionsQuery, useRestrictionMutations } from "@/queries/restrictions";
import { fieldTypeBadgeClass } from "@/lib/format/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import type {
  PrismaField,
  PrismaModel,
  PrismaRestriction,
  PrismaRestrictionType,
} from "@/lib/stores/schema-store";
import type { RestrictionDraft } from "@/types/restriction";
import { RestrictionTypeGuide } from "@/components/restrictions/restriction-type-guide";
import { RestrictionForm } from "@/components/restrictions/restriction-form";
import { RestrictionCard } from "@/components/restrictions/restriction-card";
import { TableSelectorModal } from "@/features/table-selector";
import { EmptyState, InlineError, LoadingCard } from "@/components/built";

const emptyRestrictionDraft: RestrictionDraft = { type: "UNIQUE", fields: [], dbName: "" };

function getDbNameSuggestion(fieldNames: string[]) {
  const seen = new Set<string>();
  const parts = fieldNames
    .map((n) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 3))
    .filter((p) => { if (!p || seen.has(p)) return false; seen.add(p); return true; });
  return parts.length ? `${parts.join("_")}_ix` : "";
}

export function RestrictionsPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();

  const [draft, setDraft] = useState<RestrictionDraft>(emptyRestrictionDraft);
  const [editingRestrictionKey, setEditingRestrictionKey] = useState("");
  const [isAddingRestriction, setIsAddingRestriction] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [deletingRestrictionKey, setDeletingRestrictionKey] = useState("");
  const [error, setError] = useState("");

  const tablesQuery = useTablesQuery(projectName, version);
  const models: PrismaModel[] = useMemo(() => (tablesQuery.data ?? []) as PrismaModel[], [tablesQuery.data]);

  const {
    selectedModelName,
    tableSearch, setTableSearch,
    isTableSelectorOpen, setIsTableSelectorOpen,
    selectModel,
  } = useTableSelector({ models });

  const selectedModel = useMemo(() => models.find((m) => m.name === selectedModelName) ?? null, [models, selectedModelName]);
  const selectedModelKey = selectedModel?.key ?? "";

  const restrictionsQuery = useRestrictionsQuery(projectName, version, selectedModelName, selectedModelKey);
  const fields: PrismaField[] = useMemo(() => restrictionsQuery.data?.fields ?? [], [restrictionsQuery.data]);
  const restrictions: PrismaRestriction[] = restrictionsQuery.data?.restrictions ?? [];

  const selectableFields = useMemo(
    () => fields.filter((f) => draft.type !== "UNIQUE" || f.type !== "Boolean"),
    [draft.type, fields],
  );

  const { invalidate: invalidateRestrictions, create: createRestrictionMutation, update: updateRestrictionMutation, delete: deleteRestrictionMutation } =
    useRestrictionMutations(projectName, version, selectedModelName, selectedModelKey);

  const savingRestriction = createRestrictionMutation.isPending || updateRestrictionMutation.isPending;

  useEffect(() => {
    setDraft(emptyRestrictionDraft); setEditingRestrictionKey(""); setIsAddingRestriction(false);
  }, [selectedModelName]);

  const updateDraft = (patch: Partial<RestrictionDraft>) => {
    setDraft((cur) => {
      const next = { ...cur, ...patch };
      if (patch.type === "UNIQUE") next.fields = next.fields.filter((n) => fields.find((f) => f.name === n)?.type !== "Boolean");
      if (patch.fields || patch.type) next.dbName = getDbNameSuggestion(next.fields);
      return next;
    });
    setError("");
  };

  const toggleDraftField = (fieldName: string) =>
    updateDraft({ fields: draft.fields.includes(fieldName) ? draft.fields.filter((n) => n !== fieldName) : [...draft.fields, fieldName] });

  const resetDraft = () => { setDraft(emptyRestrictionDraft); setEditingRestrictionKey(""); setIsAddingRestriction(false); setError(""); };

  const editRestriction = (r: PrismaRestriction) => {
    setIsAddingRestriction(false);
    setDraft({ type: r.type, fields: r.fields, dbName: r.dbName });
    setEditingRestrictionKey(r.key);
    setError("");
  };

  const saveRestriction = () => {
    if (!selectedModelName || draft.fields.length === 0) { setError("Select at least one field for this restriction."); return; }
    setError("");
    const payload = { projectName, version, modelKey: selectedModelKey, modelName: selectedModelName, type: draft.type, fields: draft.fields, dbName: draft.dbName };
    const callbacks = { onSuccess: () => { void invalidateRestrictions(); resetDraft(); }, onError: (err: { message: string }) => setError(err.message) };
    if (editingRestrictionKey) updateRestrictionMutation.mutate({ ...payload, restrictionKey: editingRestrictionKey }, callbacks);
    else createRestrictionMutation.mutate(payload, callbacks);
  };

  const deleteRestriction = (r: PrismaRestriction) => {
    setDeletingRestrictionKey(r.key); setError("");
    deleteRestrictionMutation.mutate(
      { projectName, version, modelKey: selectedModelKey, modelName: selectedModelName, restrictionKey: r.key },
      { onSuccess: () => { void invalidateRestrictions(); setDeletingRestrictionKey(""); }, onError: (err) => { setError(err.message); setDeletingRestrictionKey(""); } },
    );
    if (editingRestrictionKey === r.key) resetDraft();
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Select a project to manage restrictions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Main Window</p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">Restrictions workspace</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">{projectName}-{version}.prisma</span>
              <span className="rounded-md border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-300">
                {selectedModel ? selectedModel.name : "No table selected"}
              </span>
              <button type="button" onClick={() => setIsTableSelectorOpen(true)}
                className="h-9 min-w-36 rounded-md border border-violet-500/40 bg-card px-5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/15">
                Select Table
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {!selectedModelName ? (
            <EmptyState
              message="Select a table to edit its unique and index restrictions."
              action={{ label: "Select Table", onClick: () => setIsTableSelectorOpen(true), tone: "violet" }}
            />
          ) : restrictionsQuery.isLoading ? (
            <LoadingCard message="Loading restrictions…" />
          ) : (
            <div>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selected Table</p>
                  <h4 className="mt-1 text-lg font-semibold text-foreground">{selectedModelName}</h4>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    {restrictions.length} restrictions / {fields.length} fields
                  </span>
                  {!isAddingRestriction && !editingRestrictionKey && (
                    <button type="button" onClick={() => { resetDraft(); setIsAddingRestriction(true); }}
                      className="h-9 rounded-md border border-violet-500/40 bg-card px-4 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/15">
                      + Add Restriction
                    </button>
                  )}
                </div>
              </div>

              <RestrictionTypeGuide isOpen={isGuideOpen} onToggle={() => setIsGuideOpen((o) => !o)} />

              <InlineError message={error} className="mb-4" />

              {isAddingRestriction && (
                <div className="mb-4 rounded-lg border-2 border-dashed border-violet-500/40 bg-violet-500/15 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">New Restriction</p>
                  <RestrictionForm
                    draft={draft}
                    selectableFields={selectableFields}
                    savingRestriction={savingRestriction}
                    onTypeChange={(t: PrismaRestrictionType) => updateDraft({ type: t })}
                    onFieldToggle={toggleDraftField}
                    onDbNameChange={(v) => updateDraft({ dbName: v })}
                    onSave={saveRestriction}
                    onCancel={resetDraft}
                  />
                </div>
              )}

              {restrictions.length === 0 && !isAddingRestriction ? (
                <EmptyState
                  message="No unique or index restrictions found for this table."
                  action={{ label: "Add Restriction", onClick: () => { resetDraft(); setIsAddingRestriction(true); }, tone: "violet" }}
                />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                  {restrictions.map((restriction) =>
                    editingRestrictionKey === restriction.key ? (
                      <div key={restriction.key} className="rounded-lg border-2 border-violet-400 bg-card p-4 shadow-sm">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-violet-300">Edit Restriction</p>
                        <RestrictionForm
                          draft={draft}
                          selectableFields={selectableFields}
                          savingRestriction={savingRestriction}
                          isEdit
                          onTypeChange={(t: PrismaRestrictionType) => updateDraft({ type: t })}
                          onFieldToggle={toggleDraftField}
                          onDbNameChange={(v) => updateDraft({ dbName: v })}
                          onSave={saveRestriction}
                          onCancel={resetDraft}
                        />
                      </div>
                    ) : (
                      <RestrictionCard
                        key={restriction.key}
                        restriction={restriction}
                        isDeleting={deletingRestrictionKey === restriction.key}
                        onEdit={() => editRestriction(restriction)}
                        onDelete={() => deleteRestriction(restriction)}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <TableSelectorModal
        isOpen={isTableSelectorOpen}
        models={models}
        selectedModelName={selectedModelName}
        search={tableSearch}
        isLoading={tablesQuery.isLoading}
        tone="violet"
        onSearch={setTableSearch}
        onSelect={selectModel}
        onClose={() => setIsTableSelectorOpen(false)}
        typeBadgeClass={fieldTypeBadgeClass}
      />
    </div>
  );
}
