"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { providers as allProviders } from "@/constants/projects";
import { typeBadgeClass, typeSelectClass } from "@/constants/schema";
import type { FieldTemplate } from "@/lib/stores/field-template-store";
import type { useFieldTemplates } from "@/hooks/use-field-templates";
import { useEscapeKey } from "@/hooks/use-escape-key";

type TemplateState = ReturnType<typeof useFieldTemplates>;

type TemplatesModalProps = TemplateState & {
  isOpen: boolean;
  selectedModelName: string;
  projectProvider: string;
  fieldTypeOptions: string[];
  onClose: () => void;
  onSelectTable: () => void;
};

function templateTypeLabel(template: FieldTemplate) {
  return template.type === "DateTime" && template.nativeAttribute?.name === "Timestamptz"
    ? "DateTime (Timestamp)"
    : template.type;
}

export function TemplatesModal({
  isOpen, selectedModelName, projectProvider, fieldTypeOptions,
  onClose, onSelectTable,
  templateField, editDraft, templateProviderFilter, templateTypeFilter, templatePage,
  templateOverrideNames, editingTemplateId, addingTemplateToTable,
  savingTemplateFieldId, deletingTemplateFieldId, templateError,
  templates, isLoading, filteredTemplates, templateTypeOptions, templatePageCount,
  paginatedTemplates, usedTemplateNames, templateDuplicateSuggestion, isCreating,
  updateTemplateField, createTemplateField, updateEditDraft,
  editTemplateField, cancelTemplateEdit, saveTemplateField, deleteTemplateField,
  addTemplateToTable, setTemplateProviderFilter, setTemplateTypeFilter,
  setTemplatePage, setTemplateOverrideNames,
}: TemplatesModalProps) {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3"
      onClick={onClose}
    >
      <div
        className="flex h-[96vh] w-[98vw] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Templates</p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">Field templates</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                {selectedModelName || "No table selected"}
              </span>
              <button type="button" onClick={onClose}
                className="h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-background">
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 xl:overflow-hidden">
          <div className="flex min-h-full flex-col xl:h-full xl:min-h-0">
            <div className="mb-4 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Reusable Templates</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">Stored in SQLite — apply to any table in any project</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Provider
                  <select value={templateProviderFilter} onChange={(e) => setTemplateProviderFilter(e.target.value)}
                    className="h-8 min-w-36 rounded-md border border-border bg-card px-2.5 text-xs font-semibold normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-600">
                    <option value="relevant">Relevant ({projectProvider || "—"})</option>
                    <option value="all">All providers</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Type
                  <select value={templateTypeFilter} onChange={(e) => setTemplateTypeFilter(e.target.value)}
                    className="h-8 min-w-36 rounded-md border border-border bg-card px-2.5 text-xs font-semibold normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-600">
                    <option value="All">All types</option>
                    {templateTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <span className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  {filteredTemplates.length} / {templates.length} templates
                </span>
                {!selectedModelName && (
                  <button type="button" onClick={onSelectTable}
                    className="h-8 rounded-md bg-cyan-600 px-3 text-xs font-semibold text-white transition hover:bg-cyan-700">
                    Select Table
                  </button>
                )}
              </div>
            </div>

            {!selectedModelName && (
              <div className="mb-4 shrink-0 rounded-md border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200">
                Select a table to see Used status and apply templates.
              </div>
            )}

            {templateError && (
              <div className="mb-3 shrink-0 rounded-md border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-300">
                {templateError}
              </div>
            )}

            {isLoading ? (
              <div className="rounded-lg border border-border bg-background p-8 text-center text-sm font-medium text-muted-foreground">
                Loading templates...
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
                <div className="overflow-auto xl:min-h-0 xl:flex-1">
                  <table className="min-w-[1300px] w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 bg-background text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        {["Name","Provider","Type","Default","Nullable","Unique","Comment","Status","Override Name","Actions"].map((h) => (
                          <th key={h} className="border-b border-border px-3 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {/* Add row */}
                      <tr className={classNames("align-middle border-b-2", editingTemplateId ? "border-border bg-background/50" : "border-emerald-500/30 bg-emerald-500/15")}>
                        {editingTemplateId ? (
                          <td colSpan={10} className="px-3 py-2.5 text-xs font-medium text-muted-foreground">
                            Save or cancel the row being edited to add a new template.
                          </td>
                        ) : (
                          <>
                            <td className="px-2 py-2">
                              <input value={templateField.name} onChange={(e) => updateTemplateField({ name: e.target.value })}
                                placeholder="field_name"
                                className={classNames("h-8 w-full rounded-md border bg-card px-2.5 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-cyan-600", templateDuplicateSuggestion ? "border-rose-400" : "border-border")}
                              />
                              {templateDuplicateSuggestion && (
                                <p className="mt-1 text-[10px] font-semibold text-rose-300">
                                  Taken — use{" "}
                                  <button type="button" onClick={() => updateTemplateField({ name: templateDuplicateSuggestion })} className="underline underline-offset-1">{templateDuplicateSuggestion}</button>?
                                </p>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <select value={templateField.provider} onChange={(e) => updateTemplateField({ provider: e.target.value })}
                                className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground outline-none focus:border-cyan-600">
                                <option value="All">All</option>
                                {allProviders.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <select value={templateField.type} onChange={(e) => updateTemplateField({ type: e.target.value })}
                                className={classNames("h-8 w-full rounded-md border px-2 text-xs font-medium outline-none focus:border-cyan-600", typeSelectClass(templateField.type))}>
                                {fieldTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-2">
                              <input value={templateField.defaultValue} onChange={(e) => updateTemplateField({ defaultValue: e.target.value })}
                                placeholder="Default value"
                                className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-cyan-600"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={() => updateTemplateField({ nullable: !templateField.nullable })}
                                className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", templateField.nullable ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300" : "border-amber-500/40 bg-amber-500/20 text-amber-300")}>
                                {templateField.nullable ? "Yes" : "No"}
                              </button>
                            </td>
                            <td className="px-2 py-2">
                              {templateField.type === "Boolean" ? (
                                <span className="text-xs font-semibold text-muted-foreground">N/A</span>
                              ) : (
                                <button type="button" onClick={() => updateTemplateField({ unique: !templateField.unique })}
                                  className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", templateField.unique ? "border-violet-500/40 bg-violet-500/20 text-violet-300" : "border-sky-500/40 bg-sky-500/20 text-sky-300")}>
                                  {templateField.unique ? "Yes" : "No"}
                                </button>
                              )}
                            </td>
                            <td className="px-2 py-2">
                              <input value={templateField.comment} onChange={(e) => updateTemplateField({ comment: e.target.value })}
                                placeholder="Description"
                                className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-cyan-600"
                              />
                            </td>
                            <td className="px-3 py-2 text-xs font-semibold text-muted-foreground">—</td>
                            <td className="px-3 py-2 text-xs font-semibold text-muted-foreground">—</td>
                            <td className="px-2 py-2">
                              <button type="button" onClick={createTemplateField}
                                disabled={!templateField.name.trim() || !!templateDuplicateSuggestion || isCreating}
                                className="h-8 rounded-md border border-emerald-500/40 bg-card px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40">
                                {isCreating ? "Adding..." : "Add"}
                              </button>
                            </td>
                          </>
                        )}
                      </tr>

                      {filteredTemplates.length === 0 && templates.length > 0 ? (
                        <tr>
                          <td colSpan={10} className="px-3 py-6 text-center text-sm font-medium text-muted-foreground">
                            No templates match the selected filters.
                          </td>
                        </tr>
                      ) : paginatedTemplates.map((template) => {
                        const overrideName = (templateOverrideNames[template.id] || template.name).trim();
                        const isUsed = selectedModelName ? usedTemplateNames.has(overrideName) : false;
                        const canAdd = Boolean(selectedModelName) && !isUsed && Boolean(overrideName);
                        const isBusy = addingTemplateToTable === template.id || savingTemplateFieldId === template.id || deletingTemplateFieldId === template.id;
                        const isEditing = editingTemplateId === template.id;

                        if (isEditing && editDraft) {
                          return (
                            <tr key={template.id} className="bg-cyan-500/15 align-middle">
                              <td className="px-2 py-2">
                                <input value={editDraft.name} onChange={(e) => updateEditDraft({ name: e.target.value })}
                                  className="h-8 w-full rounded-md border border-cyan-500/40 bg-card px-2.5 text-xs font-medium text-foreground outline-none focus:border-cyan-600" autoFocus />
                              </td>
                              <td className="px-2 py-2">
                                <select value={editDraft.provider} onChange={(e) => updateEditDraft({ provider: e.target.value })}
                                  className="h-8 w-full rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground outline-none focus:border-cyan-600">
                                  <option value="All">All</option>
                                  {allProviders.map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <select value={editDraft.type} onChange={(e) => updateEditDraft({ type: e.target.value })}
                                  className={classNames("h-8 w-full rounded-md border px-2 text-xs font-medium outline-none focus:border-cyan-600", typeSelectClass(editDraft.type))}>
                                  {fieldTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <input value={editDraft.defaultValue} onChange={(e) => updateEditDraft({ defaultValue: e.target.value })}
                                  placeholder="Default value"
                                  className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-cyan-600" />
                              </td>
                              <td className="px-2 py-2 text-center">
                                <button type="button" onClick={() => updateEditDraft({ nullable: !editDraft.nullable })}
                                  className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", editDraft.nullable ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300" : "border-amber-500/40 bg-amber-500/20 text-amber-300")}>
                                  {editDraft.nullable ? "Yes" : "No"}
                                </button>
                              </td>
                              <td className="px-2 py-2 text-center">
                                {editDraft.type === "Boolean" ? (
                                  <span className="text-xs font-semibold text-muted-foreground">N/A</span>
                                ) : (
                                  <button type="button" onClick={() => updateEditDraft({ unique: !editDraft.unique })}
                                    className={classNames("h-8 w-20 rounded-md border text-xs font-semibold transition", editDraft.unique ? "border-violet-500/40 bg-violet-500/20 text-violet-300" : "border-sky-500/40 bg-sky-500/20 text-sky-300")}>
                                    {editDraft.unique ? "Yes" : "No"}
                                  </button>
                                )}
                              </td>
                              <td className="px-2 py-2">
                                <input value={editDraft.comment} onChange={(e) => updateEditDraft({ comment: e.target.value })}
                                  placeholder="Description"
                                  className="h-8 w-full rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground outline-none placeholder:text-muted-foreground focus:border-cyan-600" />
                              </td>
                              <td className="px-3 py-2 text-xs font-semibold text-muted-foreground">—</td>
                              <td className="px-3 py-2 text-xs font-semibold text-muted-foreground">—</td>
                              <td className="px-2 py-2">
                                <div className="flex gap-1.5">
                                  <button type="button" onClick={saveTemplateField} disabled={!editDraft.name.trim() || isBusy}
                                    className="h-8 rounded-md border border-cyan-500/40 bg-card px-2.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40">
                                    {savingTemplateFieldId === template.id ? "Saving..." : "Save"}
                                  </button>
                                  <button type="button" onClick={cancelTemplateEdit}
                                    className="h-8 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition hover:bg-background">
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={template.id} className="align-middle">
                            <td className="px-3 py-3 font-semibold text-foreground">{template.name}</td>
                            <td className="px-3 py-3">
                              <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold",
                                template.provider === "All" ? "bg-muted text-muted-foreground"
                                : template.provider === projectProvider ? "bg-violet-500/20 text-violet-300"
                                : "bg-amber-500/20 text-amber-300")}>
                                {template.provider}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", typeBadgeClass(template.type))}>
                                {templateTypeLabel(template)}
                              </span>
                            </td>
                            <td className="max-w-48 truncate px-3 py-3 font-mono text-xs text-muted-foreground">{template.defaultValue || "—"}</td>
                            <td className="px-3 py-3">
                              <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", template.nullable ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
                                {template.nullable ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {template.type === "Boolean" ? (
                                <span className="text-xs font-semibold text-muted-foreground">N/A</span>
                              ) : (
                                <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold", template.unique ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
                                  {template.unique ? "Yes" : "No"}
                                </span>
                              )}
                            </td>
                            <td className="max-w-56 px-3 py-3 text-muted-foreground">
                              <span className="line-clamp-2">{template.comment || "—"}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={classNames("rounded-md px-2 py-1 text-xs font-semibold",
                                !selectedModelName ? "bg-muted text-muted-foreground"
                                : isUsed ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-cyan-500/20 text-cyan-300")}>
                                {!selectedModelName ? "No table" : isUsed ? "Used" : "Ready"}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <input
                                value={templateOverrideNames[template.id] ?? template.name}
                                onChange={(e) => setTemplateOverrideNames((cur) => ({ ...cur, [template.id]: e.target.value }))}
                                className="h-8 w-48 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground outline-none transition focus:border-cyan-600"
                                placeholder={template.name}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                <button type="button" onClick={() => editTemplateField(template)} disabled={isBusy || !!editingTemplateId}
                                  className="h-8 rounded-md border border-cyan-500/40 bg-card px-2.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
                                <button type="button" onClick={() => deleteTemplateField(template)} disabled={isBusy || !!editingTemplateId}
                                  className="h-8 rounded-md border border-rose-500/30 bg-card px-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40">
                                  {deletingTemplateFieldId === template.id ? "Deleting..." : "Delete"}
                                </button>
                                <button type="button" onClick={addTemplateToTable(template)} disabled={!canAdd || isBusy}
                                  className="h-8 min-w-24 rounded-md border border-emerald-500/40 bg-card px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-card">
                                  {addingTemplateToTable === template.id ? "Adding..." : isUsed ? "Used" : selectedModelName ? "Add to Table" : "Select Table"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {templatePageCount > 1 && (
                  <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border bg-background px-3 py-3">
                    <button type="button" onClick={() => setTemplatePage((p) => Math.max(1, p - 1))} disabled={templatePage === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-cyan-500/30 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                      <IconChevronLeft size={15} stroke={2} />
                    </button>
                    <span className="text-sm font-semibold text-muted-foreground">{templatePage} / {templatePageCount}</span>
                    <button type="button" onClick={() => setTemplatePage((p) => Math.min(templatePageCount, p + 1))} disabled={templatePage === templatePageCount}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-cyan-500/30 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                      <IconChevronRight size={15} stroke={2} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
