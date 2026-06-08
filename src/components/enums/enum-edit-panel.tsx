"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconPencil, IconTrash, IconCheck, IconX, IconPlus, IconGripVertical } from "@tabler/icons-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTRPC } from "@/trpc/client";
import { validateEnumName, validateEnumValue } from "@/constants/enums";

export type EnumValue = { valueId: string; name: string };
export type CanonicalEnum = { enumId: string; name: string; values: EnumValue[] };

function InlineRenameValue({
  value,
  onSave,
  onCancel,
}: {
  value: EnumValue;
  onSave: (valueId: string, newName: string) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState(value.name);
  const [error, setError] = useState("");

  const save = () => {
    const err = validateEnumValue(input);
    if (err) { setError(err); return; }
    onSave(value.valueId, input.trim());
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={input}
        onChange={(e) => { setInput(e.target.value); setError(""); }}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
        className="h-7 min-w-0 flex-1 rounded border border-indigo-400 bg-card px-2 text-xs font-semibold text-foreground outline-none"
      />
      <button
        type="button"
        onClick={save}
        className="flex h-7 w-7 items-center justify-center rounded border border-indigo-500/40 bg-card text-indigo-300 transition hover:bg-indigo-500/15"
        aria-label="Save"
      >
        <IconCheck size={12} stroke={2.5} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-muted-foreground transition hover:bg-background"
        aria-label="Cancel"
      >
        <IconX size={12} stroke={2.5} />
      </button>
      {error && <span className="text-xs font-semibold text-rose-300">{error}</span>}
    </div>
  );
}

function SortableValueRow({
  value,
  isEditing,
  isDeleting,
  onEdit,
  onDelete,
  onSaveRename,
  onCancelRename,
}: {
  value: EnumValue;
  isEditing: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSaveRename: (valueId: string, newName: string) => void;
  onCancelRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: value.valueId });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}>
        <InlineRenameValue value={value} onSave={onSaveRename} onCancel={onCancelRename} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground transition hover:text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          tabIndex={-1}
        >
          <IconGripVertical size={14} stroke={2} />
        </button>
        <span className="font-mono text-sm font-semibold text-foreground">{value.name}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded border border-indigo-500/30 bg-card text-indigo-300 transition hover:bg-indigo-500/15"
          aria-label={`Rename ${value.name}`}
        >
          <IconPencil size={12} stroke={2} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="flex h-7 w-7 items-center justify-center rounded border border-rose-500/30 bg-card text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Delete ${value.name}`}
        >
          <IconTrash size={12} stroke={2} />
        </button>
      </div>
    </div>
  );
}

export function EnumEditPanel({
  enumEntry,
  projectName,
  version,
  onDone,
}: {
  enumEntry: CanonicalEnum;
  projectName: string;
  version: string;
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [renameName, setRenameName] = useState(enumEntry.name);
  const [renameError, setRenameError] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addError, setAddError] = useState("");
  const [editingValue, setEditingValue] = useState<EnumValue | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.enums.list.queryOptions({ projectName, version }).queryKey });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const renameMutation = useMutation({
    ...trpc.enums.rename.mutationOptions(),
    onSuccess: (data) => {
      const updated = data?.find((e) => e.name === renameName.trim());
      if (updated) onDone();
    },
    onError: (err) => setRenameError(err.message),
  });

  const addValueMutation = useMutation({
    ...trpc.enums.addValue.mutationOptions(),
    onSuccess: () => { void invalidate(); setNewValue(""); setAddError(""); },
    onError: (err) => setAddError(err.message),
  });

  const renameValueMutation = useMutation({
    ...trpc.enums.renameValue.mutationOptions(),
    onSuccess: () => { void invalidate(); setEditingValue(null); },
  });

  const deleteValueMutation = useMutation({
    ...trpc.enums.deleteValue.mutationOptions(),
    onSuccess: () => void invalidate(),
  });

  const reorderValuesMutation = useMutation({
    ...trpc.enums.reorderValues.mutationOptions(),
    onSuccess: () => void invalidate(),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = enumEntry.values.findIndex((v) => v.valueId === active.id);
    const newIndex = enumEntry.values.findIndex((v) => v.valueId === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(enumEntry.values, oldIndex, newIndex);
    reorderValuesMutation.mutate({
      projectName, version,
      enumName: currentEnumName,
      valueIds: reordered.map((v) => v.valueId),
    });
  };

  const saveRename = () => {
    const err = validateEnumName(renameName);
    if (err) { setRenameError(err); return; }
    setRenameError("");
    renameMutation.mutate({ projectName, version, oldName: enumEntry.name, newName: renameName.trim() });
    onDone();
  };

  const submitAddValue = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newValue.trim();
    if (enumEntry.values.some((v) => v.name === trimmed)) {
      setAddError(`"${trimmed}" already exists in this enum.`);
      return;
    }
    const err = validateEnumValue(trimmed);
    if (err) { setAddError(err); return; }
    setAddError("");
    addValueMutation.mutate({ projectName, version, enumName: enumEntry.name, value: trimmed });
  };

  const currentEnumName = renameName.trim() || enumEntry.name;

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/15 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-300">
          Edit Enum
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onDone}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-rose-500/30 bg-card text-rose-400 transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
            aria-label="Close"
          >
            <IconX size={15} stroke={2} />
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-emerald-500/40 bg-card text-emerald-300 transition hover:bg-emerald-500/15"
            aria-label="Done"
          >
            <IconCheck size={15} stroke={2.5} />
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="edit-enum-name" className="block text-sm font-semibold text-foreground">
          Enum name
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="edit-enum-name"
            value={renameName}
            onChange={(e) => { setRenameName(e.target.value); setRenameError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); }}
            className="h-10 flex-1 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition focus:border-indigo-600"
          />
          <button
            type="button"
            onClick={saveRename}
            disabled={renameMutation.isPending || renameName.trim() === enumEntry.name}
            className="h-10 rounded-md border border-indigo-500/40 bg-card px-4 text-sm font-semibold text-indigo-300 transition hover:bg-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {renameMutation.isPending ? "Saving…" : "Rename"}
          </button>
        </div>
        {renameError ? <p className="mt-1.5 text-xs font-semibold text-rose-300">{renameError}</p> : null}
        <p className="mt-1.5 text-xs text-muted-foreground">
          Renaming updates all fields that use this enum as their type.
        </p>
      </div>

      <div className="mt-6">
        <p className="text-sm font-semibold text-foreground">
          Values
          {enumEntry.values.length > 0 && (
            <span className="ml-2 rounded-md border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300">
              {enumEntry.values.length}
            </span>
          )}
        </p>

        {enumEntry.values.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-indigo-500/30 bg-card p-4 text-center text-sm text-muted-foreground">
            No values yet. Add your first value below.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={enumEntry.values.map((v) => v.valueId)} strategy={verticalListSortingStrategy}>
              <div className="mt-3 space-y-1.5">
                {enumEntry.values.map((v) => (
                  <SortableValueRow
                    key={v.valueId}
                    value={v}
                    isEditing={editingValue?.valueId === v.valueId}
                    isDeleting={deleteValueMutation.isPending}
                    onEdit={() => setEditingValue(v)}
                    onDelete={() => deleteValueMutation.mutate({ projectName, version, enumName: currentEnumName, valueId: v.valueId })}
                    onSaveRename={(valueId, newVal) =>
                      renameValueMutation.mutate({ projectName, version, enumName: currentEnumName, valueId, newValue: newVal })
                    }
                    onCancelRename={() => setEditingValue(null)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <form onSubmit={submitAddValue} className="mt-3 flex gap-2">
          <input
            value={newValue}
            onChange={(e) => { setNewValue(e.target.value); setAddError(""); }}
            placeholder="PENDING"
            className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition placeholder:font-mono placeholder:text-muted-foreground focus:border-indigo-600"
          />
          <button
            type="submit"
            disabled={addValueMutation.isPending || !newValue.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-muted"
          >
            <IconPlus size={14} stroke={2.5} />
            {addValueMutation.isPending ? "Adding…" : "Add"}
          </button>
        </form>
        {addError ? <p className="mt-1.5 text-xs font-semibold text-rose-300">{addError}</p> : null}
      </div>
    </div>
  );
}
