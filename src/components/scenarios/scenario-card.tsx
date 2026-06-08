"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck, IconCopy, IconTrash } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { InlineError } from "@/components/built";
import type { ScenarioSummary, ScenarioCardHandlers } from "@/types/scenarios";

export function ScenarioCard({
  scenario,
  busy,
  anyBusy,
  errorMessage,
  handlers,
}: {
  scenario: ScenarioSummary;
  busy: boolean;
  anyBusy: boolean;
  errorMessage: string;
  handlers: ScenarioCardHandlers;
}) {
  const { onLoad, onReload, onRemove, onOpen } = handlers;
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [copied, setCopied] = useState(false);

  const loaded = scenario.loaded;
  const isLoaded = loaded !== null;

  const copyId = () => {
    if (!loaded) return;
    void navigator.clipboard?.writeText(loaded.projectId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const openForm = () => {
    setFormOpen(true);
    setName(`${scenario.title} Demo`);
  };

  const submit = () => {
    if (name.trim().length < 8) return;
    onLoad(scenario.id, name.trim());
  };

  return (
    <div
      className={classNames(
        "flex flex-col rounded-lg border bg-background",
        isLoaded ? "border-emerald-500/40" : "border-border",
      )}
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className={classNames("h-2.5 w-2.5 rounded-full", scenario.accent)} />
            <h4 className="text-base font-semibold text-foreground">{scenario.title}</h4>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {scenario.provider}
            </span>
            {isLoaded && (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={anyBusy}
                title="Remove this project"
                aria-label="Remove this project"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/30 bg-card text-rose-400 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconTrash size={15} stroke={1.8} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <CountChip label="tables" value={scenario.tableCount} />
          <CountChip label="fields" value={scenario.fieldCount} />
          <CountChip label="relations" value={scenario.relationCount} />
          <CountChip label="enums" value={scenario.enumCount} />
          {scenario.versionCount > 1 && <CountChip label="versions" value={scenario.versionCount} />}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{scenario.summary}</p>

        <ul className="space-y-1.5">
          {scenario.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              After loading
            </span>
            {scenario.exploreNext.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[12px] font-medium text-cyan-400 underline-offset-2 hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {isLoaded && confirmRemove ? (
            <div className="space-y-2 rounded-md border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="text-xs font-medium text-rose-200">
                Remove <span className="font-semibold">{loaded.projectName}</span> and all its versions?
                This can&apos;t be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onRemove(scenario.id, loaded.projectId)}
                  disabled={busy}
                  className="h-9 flex-1 rounded-md bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  {busy ? "Removing…" : "Remove project"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={busy}
                  className="h-9 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
              <InlineError message={errorMessage} />
            </div>
          ) : isLoaded ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-xs text-emerald-300">
                  Loaded as{" "}
                  <button
                    type="button"
                    onClick={() => onOpen(loaded.projectId)}
                    className="font-semibold underline underline-offset-2 hover:text-emerald-200"
                  >
                    {loaded.projectName}
                  </button>
                </p>
                <span className="inline-flex items-center gap-1.5">
                  <span className="break-all font-mono text-[11px] text-muted-foreground">
                    #{loaded.projectId}
                  </span>
                  <button
                    type="button"
                    onClick={copyId}
                    title="Copy project id"
                    aria-label="Copy project id"
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:text-foreground"
                  >
                    {copied ? (
                      <IconCheck size={13} stroke={2} className="text-emerald-400" />
                    ) : (
                      <IconCopy size={13} stroke={1.8} />
                    )}
                  </button>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onReload(scenario.id)}
                disabled={anyBusy}
                className="h-10 w-full rounded-md border border-amber-500/40 bg-card px-5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Resetting…" : "Re-load project from start"}
              </button>
              <InlineError message={errorMessage} />
            </div>
          ) : formOpen ? (
            <div className="space-y-2 rounded-md border border-border bg-card p-3">
              <label className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                New project name
              </label>
              <input
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setFormOpen(false);
                }}
                placeholder="At least 8 characters, unique"
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-500"
              />
              <InlineError message={errorMessage} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || name.trim().length < 8}
                  className="h-9 flex-1 rounded-md bg-cyan-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-muted"
                >
                  {busy ? "Creating…" : "Create project"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={busy}
                  className="h-9 rounded-md border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-card disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={openForm}
              disabled={anyBusy}
              className="h-10 w-full rounded-md border border-cyan-500/40 bg-card px-5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Load as demo project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  );
}
