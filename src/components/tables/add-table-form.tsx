"use client";

import type { FormEvent } from "react";
import { pkExampleLine, type ProviderKey } from "@/constants/tables";
import type { HelpDialog } from "@/types/tables";
import { HelpIcon } from "@/components/tables/table-icons";

type PkOption = { value: string; label: string; summary: string; badgeClass: string };

type AddTableFormProps = {
  modelName: string;
  pkName: string;
  effectivePkType: string;
  createError: string;
  isPending: boolean;
  modelCount: number;
  pkTypes: PkOption[];
  selectedPkSummary: string;
  providerDisplay: string;
  activeProvider: ProviderKey;
  onModelNameChange: (v: string) => void;
  onPkNameChange: (v: string) => void;
  onPkTypeChange: (v: string) => void;
  onHelpClick: (dialog: HelpDialog) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export function AddTableForm({
  modelName, pkName, effectivePkType, createError, isPending, modelCount,
  pkTypes, selectedPkSummary, providerDisplay, activeProvider,
  onModelNameChange, onPkNameChange, onPkTypeChange, onHelpClick, onSubmit,
}: AddTableFormProps) {
  return (
    <form onSubmit={onSubmit} className="border-b border-border p-5 lg:border-b-0 lg:border-r">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Add Table</p>
      <p className="mt-1 text-sm text-muted-foreground">Create a new model in the Prisma schema.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onHelpClick("primaryKeys")}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:border-cyan-500/30 hover:text-cyan-300"
          aria-label="Open primary key rules"
        >
          <HelpIcon />
          <span>Primary Keys</span>
        </button>
        <button
          type="button"
          onClick={() => onHelpClick("naming")}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:border-cyan-500/30 hover:text-cyan-300"
          aria-label="Open naming convention rules"
        >
          <HelpIcon />
          <span>Naming</span>
        </button>
      </div>

      <label htmlFor="table-name" className="mt-5 block text-sm font-semibold text-foreground">Model name</label>
      <input
        id="table-name"
        value={modelName}
        onChange={(e) => onModelNameChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-600"
        placeholder="Customer"
      />

      <label htmlFor="table-pk-name" className="mt-5 block text-sm font-semibold text-foreground">Primary Key Name</label>
      <input
        id="table-pk-name"
        value={pkName}
        onChange={(e) => onPkNameChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-600"
        placeholder="id"
      />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Use a Prisma field name. The conventional choice is{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">id</code>.
      </p>

      <label htmlFor="table-pk-type" className="mt-5 block text-sm font-semibold text-foreground">Primary Key Type</label>
      <select
        id="table-pk-type"
        value={effectivePkType}
        onChange={(e) => onPkTypeChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition focus:border-cyan-600"
      >
        {pkTypes.map((type) => (
          <option key={type.value} value={type.value}>{type.label}</option>
        ))}
      </select>
      <div className="mt-3 rounded-md border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{providerDisplay}</span>
          <span className="text-xs font-medium text-muted-foreground">{selectedPkSummary}</span>
        </div>
        <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-card px-2 py-2 font-mono text-xs text-foreground">
          {pkExampleLine(pkName, effectivePkType, activeProvider)}
        </code>
      </div>

      {createError && <p className="mt-3 text-sm font-semibold text-rose-300">{createError}</p>}

      <button
        type="submit"
        disabled={isPending || modelCount >= 50}
        className="mt-5 h-10 w-full rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-muted"
      >
        {isPending ? "Creating..." : "Add Table"}
      </button>
    </form>
  );
}
