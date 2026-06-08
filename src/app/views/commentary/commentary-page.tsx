"use client";

import { useMemo, useState } from "react";
import { useTableSelector } from "@/hooks/use-table-selector";
import { useCommentaryEditorState } from "@/hooks/use-commentary-editor-state";
import { TABLE_PAGE_SIZE, FIELD_PAGE_SIZE } from "@/constants/commentary";
import { useTablesQuery } from "@/queries/tables";
import { useCommentaryFieldsQuery, useCommentaryMutations } from "@/queries/commentary";
import { classNames } from "@/lib/utils";
import { fieldTypeBadgeClass } from "@/lib/format/badge-utils";
import { useProjectInfo } from "../shared/project-info-context";
import type { PrismaField, PrismaModel } from "@/lib/stores/schema-store";
import { displayType } from "@/lib/format/display-utils";
import { TableSelectorModal } from "@/features/table-selector";
import { EmptyState, InlineError, LoadingCard } from "@/components/built";

export function CommentaryPageContent() {
  const { projectName, version, hasProject } = useProjectInfo();

  const tablesQuery = useTablesQuery(projectName, version);
  const models: PrismaModel[] = useMemo(() => (tablesQuery.data ?? []) as PrismaModel[], [tablesQuery.data]);

  const {
    selectedModelName,
    tableSearch, setTableSearch,
    isTableSelectorOpen, setIsTableSelectorOpen,
    selectModel,
  } = useTableSelector({ models });

  const [tablePage, setTablePage] = useState(1);

  const selectedModel = useMemo(
    () => models.find((m) => m.name === selectedModelName) ?? null,
    [models, selectedModelName],
  );
  const selectedModelKey = selectedModel?.key ?? "";

  const fieldsQuery = useCommentaryFieldsQuery(projectName, version, selectedModelName, selectedModelKey);
  const fields: PrismaField[] = useMemo(() => fieldsQuery.data?.fields ?? [], [fieldsQuery.data]);
  const enumTypes: string[] = fieldsQuery.data?.enumTypes ?? [];

  const {
    comments, setComments,
    dirtyKeys, setDirtyKeys,
    saveError, setSaveError,
    savedKeys, setSavedKeys,
    fieldSearch, setFieldSearch,
    fieldPage, setFieldPage,
  } = useCommentaryEditorState({ fields, fieldsData: fieldsQuery.data, selectedModelName });

  const { invalidate: invalidateCommentary, update: updateCommentsMutation } =
    useCommentaryMutations(projectName, version, selectedModelName, selectedModelKey);

  const visibleFields = useMemo(
    () => fields.filter((f) => !f.isRelation && f.name.toLowerCase().includes(fieldSearch.toLowerCase())),
    [fields, fieldSearch],
  );

  const paginatedFields = useMemo(() => {
    const start = (fieldPage - 1) * FIELD_PAGE_SIZE;
    return visibleFields.slice(start, start + FIELD_PAGE_SIZE);
  }, [visibleFields, fieldPage]);

  const totalFieldPages = Math.ceil(visibleFields.length / FIELD_PAGE_SIZE);

  const handleCommentChange = (fieldKey: string, value: string) => {
    setComments((prev) => ({ ...prev, [fieldKey]: value }));
    setDirtyKeys((prev) => new Set(prev).add(fieldKey));
    setSaveError("");
    setSavedKeys((prev) => {
      const next = new Set(prev);
      next.delete(fieldKey);
      return next;
    });
  };

  const handleSave = () => {
    if (dirtyKeys.size === 0) return;
    const updates = Array.from(dirtyKeys).map((key) => ({ fieldKey: key, comment: comments[key] ?? "" }));
    updateCommentsMutation.mutate(
      { projectName, version, modelName: selectedModelName, modelKey: selectedModelKey, updates },
      {
        onSuccess: () => { void invalidateCommentary(); setSavedKeys(new Set(dirtyKeys)); setDirtyKeys(new Set()); setSaveError(""); },
        onError: (err) => setSaveError(err.message),
      },
    );
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Select a project to add GraphQL comments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card shadow-sm min-h-[calc(100vh-140px)]">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Main Window
              </p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">
                Commentary
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add <code className="rounded bg-muted px-1 text-xs font-mono text-fuchsia-300">{"/// comment"}</code> style annotations to schema fields.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {projectName}-{version}
              </span>
              <span className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/15 px-3 py-1.5 text-xs font-semibold text-fuchsia-300">
                {selectedModel ? selectedModel.name : "No table selected"}
              </span>
              <button
                type="button"
                onClick={() => setIsTableSelectorOpen(true)}
                className="h-9 min-w-36 rounded-md border border-fuchsia-500/40 bg-card px-5 text-xs font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/15"
              >
                Select Table
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          {!selectedModelName ? (
            <EmptyState
              message="Select a table to add GraphQL-style comments to its fields."
              action={{ label: "Select Table", onClick: () => setIsTableSelectorOpen(true), tone: "fuchsia" }}
            />
          ) : fieldsQuery.isLoading ? (
            <LoadingCard message="Loading fields…" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Selected Table
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-foreground">
                    {selectedModelName}
                  </h4>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    {fields.length} fields
                    {dirtyKeys.size > 0 && (
                      <span className="ml-2 text-fuchsia-300">
                        · {dirtyKeys.size} unsaved
                      </span>
                    )}
                  </p>
                </div>
                <div className="ml-auto w-full flex-none lg:w-72">
                  <input
                    type="text"
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-md border border-border bg-card">
                {visibleFields.length === 0 ? (
                  <div className="py-10 text-center text-sm font-medium text-muted-foreground">
                    {fieldSearch ? "No fields match your search." : "No fields available."}
                  </div>
                ) : (
                  paginatedFields.map((field) => {
                    const isDirty = dirtyKeys.has(field.key);
                    const isSaved = savedKeys.has(field.key);
                    const displayFieldType = displayType(field, enumTypes);

                    return (
                      <div
                        key={field.key}
                        className="grid grid-cols-1 items-center gap-3 p-4 lg:grid-cols-[minmax(280px,0.55fr)_minmax(0,1fr)]"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {field.name}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className={classNames(
                                "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                                fieldTypeBadgeClass(displayFieldType),
                              )}
                            >
                              {displayFieldType}
                            </span>
                            {field.isId && (
                              <span className="inline-flex rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                                id
                              </span>
                            )}
                            {field.nullable && (
                              <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                nullable
                              </span>
                            )}
                            {isDirty && (
                              <span className="inline-flex rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300">
                                unsaved
                              </span>
                            )}
                            {isSaved && !isDirty && (
                              <span className="inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                saved
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0 select-none font-mono text-xs text-muted-foreground">
                            {"///"}
                          </span>
                          <input
                            type="text"
                            value={comments[field.key] ?? ""}
                            onChange={(e) =>
                              handleCommentChange(field.key, e.target.value)
                            }
                            placeholder="Add a comment for this field…"
                            className={classNames(
                              "h-9 w-full rounded-md border px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground",
                              isDirty
                                ? "border-fuchsia-500/40 focus:border-fuchsia-500"
                                : "border-border focus:border-fuchsia-400",
                            )}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <InlineError message={saveError} />

              <div className="flex items-center justify-between gap-4">
                <p className="shrink-0 text-sm font-medium text-muted-foreground">
                  {dirtyKeys.size > 0
                    ? `${dirtyKeys.size} field${dirtyKeys.size !== 1 ? "s" : ""} with unsaved changes`
                    : savedKeys.size > 0
                      ? `${savedKeys.size} field${savedKeys.size !== 1 ? "s" : ""} saved`
                      : "No changes"}
                </p>
                {totalFieldPages > 1 && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setFieldPage((p) => Math.max(1, p - 1))}
                      disabled={fieldPage === 1}
                      className="h-9 rounded-md border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-muted-foreground">
                      Page {fieldPage} of {totalFieldPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFieldPage((p) => Math.min(totalFieldPages, p + 1))}
                      disabled={fieldPage === totalFieldPages}
                      className="h-9 rounded-md border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      Next
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={updateCommentsMutation.isPending || dirtyKeys.size === 0}
                  className="ml-auto h-10 min-w-36 shrink-0 rounded-md bg-fuchsia-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  {updateCommentsMutation.isPending ? "Saving…" : "Save"}
                </button>
              </div>
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
        tone="fuchsia"
        page={tablePage}
        pageSize={TABLE_PAGE_SIZE}
        onSearch={setTableSearch}
        onSelect={selectModel}
        onClose={() => setIsTableSelectorOpen(false)}
        onPageChange={setTablePage}
        typeBadgeClass={fieldTypeBadgeClass}
      />
    </div>
  );
}
