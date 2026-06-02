"use client";

import { useMemo } from "react";
import { useTablesPageState } from "@/hooks/use-tables-page-state";
import { TABLES_PAGE_SIZE } from "@/constants/tables";
import type { FormEvent } from "react";
import { useTablesQuery, useTableMutations } from "@/queries/tables";
import { useProjectInfo } from "../shared/project-info-context";
import { useVersionDiffLookup } from "@/hooks/use-version-diff";
import { useSchemaWarnings } from "@/hooks/use-schema-warnings";
import { TableDiffDetailModal } from "@/components/tables/table-diff-detail-modal";
import type { PrismaModel } from "@/lib/schema-store";
import {
  pkTypeDetails,
  defaultPkType,
  prismaIdentifierPattern,
  providerKey,
  providerLabel,
  pkOptionsForProvider,
  pkTypeBadgeClass as fieldTypeBadgeClass,
  type ProviderKey,
  type PkTypeValue,
} from "@/constants/tables";
import { AddTableForm } from "@/components/tables/add-table-form";
import { EditTablePanel } from "@/components/tables/edit-table-panel";
import { TablesGrid } from "@/components/tables/tables-grid";
import { TableHelpDialog } from "@/components/tables/table-help-dialog";
import { EmptyState, LoadingCard } from "@/components/built";

export function TablesPageContent() {
  const { projectName, version, versions, provider, hasProject, projectId } = useProjectInfo();
  const { diffByTableKey } = useVersionDiffLookup(projectName, version);
  const versionIdx = versions.indexOf(version);
  const previousVersion = versionIdx > 0 ? versions[versionIdx - 1]! : "";
  const { getWarning, approveMany } = useSchemaWarnings(projectId, previousVersion, version);

  const listQuery = useTablesQuery(projectName, version);
  const models: PrismaModel[] = (listQuery.data ?? []) as PrismaModel[];
  const { invalidate: invalidateTables, create: createMutation, update: updateMutation, delete: deleteMutation } = useTableMutations(projectName, version);

  const {
    modelName, setModelName,
    pkName, setPkName,
    pkType, setPkType,
    createError, setCreateError,
    selectedModel,
    editModelName, setEditModelName,
    editPkName, setEditPkName,
    editPkType, setEditPkType,
    isEditing,
    updateError, setUpdateError,
    currentPage, setCurrentPage,
    searchTerm, setSearchTerm,
    helpDialog, setHelpDialog,
    diffDetail, setDiffDetail,
    openEdit, closeEdit,
  } = useTablesPageState();

  const activeProvider = providerKey(provider);
  const providerDisplay = providerLabel(activeProvider);
  const pkTypes = useMemo(() => pkOptionsForProvider(activeProvider), [activeProvider]);
  const effectivePkType = pkTypes.some((t) => t.value === pkType) ? pkType : pkTypes[0]?.value ?? defaultPkType;
  const selectedPkSummary = pkTypeDetails[effectivePkType as PkTypeValue]?.summary ?? "Primary key field.";
  const selectedEditPkSummary = pkTypeDetails[editPkType as PkTypeValue]?.summary ?? "Primary key field.";

  const submitModel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = modelName.trim();
    if (!name) { setCreateError("Model name is required."); return; }
    if (!pkName.trim()) { setCreateError("Primary key name is required."); return; }
    if (!prismaIdentifierPattern.test(pkName.trim())) {
      setCreateError("Primary key name must start with a letter and contain only letters, numbers, and underscores.");
      return;
    }
    if (!effectivePkType) { setCreateError("Primary key type is required."); return; }
    if (!prismaIdentifierPattern.test(name)) {
      setCreateError("Model name must start with a letter and contain only letters, numbers, and underscores.");
      return;
    }
    if (models.some((m) => m.name === name)) { setCreateError("A model with this name already exists."); return; }
    setCreateError("");
    createMutation.mutate(
      { projectName, version, modelName: name, pkName: pkName.trim(), pkType: effectivePkType as "String" | "Int" | "BigInt" | "DateTime" | "Uuid" },
      {
        onSuccess: () => { void invalidateTables(); setModelName(""); setPkName("id"); setPkType(defaultPkType); setCurrentPage(1); setCreateError(""); },
        onError: (err) => setCreateError(err.message),
      },
    );
  };

  const saveEdit = () => {
    if (!selectedModel) return;
    const name = editModelName.trim();
    if (!name) { setUpdateError("Model name is required."); return; }
    if (!editPkName.trim()) { setUpdateError("Primary key name is required."); return; }
    if (!prismaIdentifierPattern.test(editPkName.trim())) {
      setUpdateError("Primary key name must start with a letter and contain only letters, numbers, and underscores.");
      return;
    }
    if (!editPkType) { setUpdateError("Primary key type is required."); return; }
    setUpdateError("");
    updateMutation.mutate(
      { projectName, version, modelKey: selectedModel.key, oldModelName: selectedModel.name, newModelName: name, pkName: editPkName.trim(), pkType: editPkType as "String" | "Int" | "BigInt" | "DateTime" | "Uuid" },
      {
        onSuccess: () => { void invalidateTables(); closeEdit(); },
        onError: (err) => setUpdateError(err.message),
      },
    );
  };

  const deleteSelectedModel = () => {
    if (!selectedModel) return;
    if (!window.confirm(`Delete ${selectedModel.name}? This will also remove its fields and relations.`)) return;
    setUpdateError("");
    deleteMutation.mutate(
      { projectName, version, modelName: selectedModel.name, modelKey: selectedModel.key },
      {
        onSuccess: () => { void invalidateTables(); setCurrentPage(1); closeEdit(); },
        onError: (err) => setUpdateError(err.message),
      },
    );
  };

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-600">Select a project to manage tables.</p>
      </div>
    );
  }

  return (
    <div>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Main Window</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Tables workspace</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-slate-500">{projectName}-{version}.prisma</span>
              <span className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                {models.length} tables
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
          <AddTableForm
            modelName={modelName}
            pkName={pkName}
            effectivePkType={effectivePkType}
            createError={createError}
            isPending={createMutation.isPending}
            modelCount={models.length}
            pkTypes={pkTypes}
            selectedPkSummary={selectedPkSummary}
            providerDisplay={providerDisplay}
            activeProvider={activeProvider as ProviderKey}
            onModelNameChange={(v) => { setModelName(v); setCreateError(""); }}
            onPkNameChange={(v) => { setPkName(v); setCreateError(""); }}
            onPkTypeChange={(v) => { setPkType(v); setCreateError(""); }}
            onHelpClick={setHelpDialog}
            onSubmit={submitModel}
          />

          <div className="p-5">
            {listQuery.isLoading ? (
              <LoadingCard bordered={false} />
            ) : models.length === 0 ? (
              <EmptyState message="No tables yet. Add your first table above." />
            ) : isEditing && selectedModel ? (
              <EditTablePanel
                editModelName={editModelName}
                editPkName={editPkName}
                editPkType={editPkType}
                updateError={updateError}
                isSaving={updateMutation.isPending}
                isDeleting={deleteMutation.isPending}
                pkTypes={pkTypes}
                selectedEditPkSummary={selectedEditPkSummary}
                providerDisplay={providerDisplay}
                activeProvider={activeProvider as ProviderKey}
                onModelNameChange={(v) => { setEditModelName(v); setUpdateError(""); }}
                onPkNameChange={(v) => { setEditPkName(v); setUpdateError(""); }}
                onPkTypeChange={(v) => { setEditPkType(v); setUpdateError(""); }}
                onSave={saveEdit}
                onCancel={closeEdit}
                onDelete={deleteSelectedModel}
              />
            ) : (
              <TablesGrid
                models={models}
                searchTerm={searchTerm}
                currentPage={currentPage}
                itemsPerPage={TABLES_PAGE_SIZE}
                diffByTableKey={diffByTableKey}
                fieldTypeBadgeClass={fieldTypeBadgeClass}
                onSearchChange={setSearchTerm}
                onPageChange={setCurrentPage}
                onEdit={openEdit}
                onShowDiff={setDiffDetail}
              />
            )}
          </div>
        </div>
      </section>

      <TableHelpDialog
        helpDialog={helpDialog}
        pkTypes={pkTypes}
        providerDisplay={providerDisplay}
        pkName={pkName}
        pkType={effectivePkType}
        activeProvider={activeProvider as ProviderKey}
        onClose={() => setHelpDialog(null)}
      />

      {diffDetail && (
        <TableDiffDetailModal
          tableDiff={diffDetail}
          fromVersion={previousVersion}
          toVersion={version}
          pendingWarningIds={[
            getWarning("table", diffDetail.tableId, diffDetail.changeKind),
            ...diffDetail.fieldDiffs.filter((fd) => fd.isPk).map((fd) =>
              getWarning("field", fd.fieldId, fd.changeKind)
            ),
          ].filter((w): w is NonNullable<typeof w> => !!w && !w.approvedAt).map((w) => w.id)}
          onApproveAll={approveMany}
          onClose={() => setDiffDetail(null)}
        />
      )}
    </div>
  );
}
