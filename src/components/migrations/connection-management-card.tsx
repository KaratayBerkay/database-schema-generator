"use client";

import { useState } from "react";
import { IconLink, IconPlus, IconX } from "@tabler/icons-react";
import { classNames } from "@/lib/utils";
import { Card, CardHeader, CardBody } from "@/components/built";
import { StepBadge } from "@/components/migrations/phase-state";
import { ErrorBox } from "@/components/migrations/error-box";
import { MigrationLabel as Label, MigrationInput as Input } from "@/components/migrations/migration-form";
import { shortUuid } from "@/constants/migrations";
import type { ConnectionRecord, PhaseState } from "@/types/migrations";

type TestResult = { success: boolean; tables?: string[]; error?: string };

type ConnectionManagementCardProps = {
  canDoAnyMigration: boolean;
  migrationPlan: "new" | "version" | null;
  connections: ConnectionRecord[];
  activeConnectionId: string;
  activeConnection: ConnectionRecord | null;
  loadingConnections: boolean;
  deletingId: string;
  testingId: string;
  testResults: Record<string, TestResult>;
  remoteTables: string[];
  showNewForm: boolean;
  connectionName: string;
  host: string;
  port: string;
  dbUser: string;
  password: string;
  database: string;
  connectState: PhaseState;
  connectError: string;
  isSQLite: boolean;
  /** The project's configured database provider — used to flag mismatched connections. */
  projectProvider: string;
  onSelectConnection: (uuid: string) => void;
  onDeleteConnection: (uuid: string) => void;
  onTestConnection: (uuid: string) => void;
  onOpenConnString: () => void;
  onToggleNewForm: () => void;
  onConnectionNameChange: (v: string) => void;
  onHostChange: (v: string) => void;
  onPortChange: (v: string) => void;
  onDbUserChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onDatabaseChange: (v: string) => void;
  onConnect: () => void;
};

function normaliseProvider(p: string) {
  const lc = p.toLowerCase();
  if (lc === "postgres" || lc === "postgresql") return "postgresql";
  return lc;
}

// ─── Status pill (replaces StateChip in the card header) ─────────────────────

function StatusPill({ state }: { state: PhaseState }) {
  const map: Record<PhaseState, { dot: string; text: string; cls: string }> = {
    idle:    { dot: "bg-muted",    text: "Pending", cls: "bg-background text-muted-foreground ring-slate-200"   },
    loading: { dot: "bg-amber-400 animate-pulse", text: "Connecting…", cls: "bg-amber-500/15 text-amber-300 ring-amber-200" },
    success: { dot: "bg-emerald-500",  text: "Connected", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-200" },
    error:   { dot: "bg-rose-500",     text: "Failed",  cls: "bg-rose-500/15 text-rose-300 ring-rose-200"      },
  };
  const { dot, text, cls } = map[state];
  return (
    <span className={classNames("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1", cls)}>
      <span className={classNames("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      {text}
    </span>
  );
}

// ─── New connection form with blur validation ─────────────────────────────────

function NewConnectionForm({
  connectionName, connections, host, port, dbUser, password, database, isSQLite,
  connectState, connectError,
  onConnectionNameChange, onHostChange, onPortChange, onDbUserChange,
  onPasswordChange, onDatabaseChange, onConnect,
}: {
  connectionName: string;
  connections: ConnectionRecord[];
  host: string; port: string; dbUser: string; password: string; database: string;
  isSQLite: boolean;
  connectState: PhaseState;
  connectError: string;
  onConnectionNameChange: (v: string) => void;
  onHostChange: (v: string) => void;
  onPortChange: (v: string) => void;
  onDbUserChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onDatabaseChange: (v: string) => void;
  onConnect: () => void;
}) {
  const [nameHint, setNameHint] = useState<{ kind: "info" | "warning"; msg: string } | null>(null);

  const handleNameBlur = () => {
    const trimmed = connectionName.trim();
    if (!trimmed) {
      const autoName = isSQLite ? database || "SQLite DB" : `${host || "host"}:${port || "port"} / ${database || "db"}`;
      setNameHint({ kind: "info", msg: `Will be saved as "${autoName}" if left blank.` });
      return;
    }
    const duplicate = connections.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setNameHint({ kind: "warning", msg: `A connection named "${trimmed}" already exists.` });
    } else {
      setNameHint(null);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">New Connection</p>

      <div className="flex flex-col gap-1">
        <Label>Connection Name</Label>
        <Input
          value={connectionName}
          onChange={(v) => { onConnectionNameChange(v); setNameHint(null); }}
          onBlur={handleNameBlur}
          placeholder="e.g. Production DB"
        />
        {nameHint && (
          <p className={classNames("text-[11px] font-medium",
            nameHint.kind === "warning" ? "text-amber-300" : "text-muted-foreground")}>
            {nameHint.kind === "warning" ? "⚠ " : "ℹ "}{nameHint.msg}
          </p>
        )}
      </div>

      {isSQLite ? (
        <div className="flex flex-col gap-1">
          <Label>SQLite File Path</Label>
          <Input value={database} onChange={onDatabaseChange} placeholder="./path/to/database.db" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-1 lg:col-span-2">
            <Label>Host / IP</Label>
            <Input value={host} onChange={onHostChange} placeholder="localhost" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Port</Label>
            <Input value={port} onChange={onPortChange} placeholder="5432" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Username</Label>
            <Input value={dbUser} onChange={onDbUserChange} placeholder="postgres" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Password</Label>
            <Input value={password} onChange={onPasswordChange} type="password" placeholder="••••••••" />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Database</Label>
            <Input value={database} onChange={onDatabaseChange} placeholder="mydb" />
          </div>
        </div>
      )}

      {connectError && <ErrorBox message={connectError} />}

      <div className="flex justify-end">
        <button type="button" onClick={onConnect}
          disabled={connectState === "loading" || nameHint?.kind === "warning" || undefined}
          className="h-9 min-w-40 rounded-md bg-slate-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-muted">
          {connectState === "loading" ? "Connecting…" : "Test & Save Connection"}
        </button>
      </div>
    </div>
  );
}

export function ConnectionManagementCard({
  canDoAnyMigration, migrationPlan,
  connections, activeConnectionId, activeConnection, loadingConnections,
  deletingId, testingId, testResults, remoteTables,
  showNewForm, connectionName, host, port, dbUser, password, database,
  connectState, connectError, isSQLite, projectProvider,
  onSelectConnection, onDeleteConnection, onTestConnection, onOpenConnString,
  onToggleNewForm, onConnectionNameChange, onHostChange, onPortChange,
  onDbUserChange, onPasswordChange, onDatabaseChange, onConnect,
}: ConnectionManagementCardProps) {
  return (
    <Card locked={!canDoAnyMigration}>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StepBadge n={1} state={connectState} />
            <div>
              <p className="text-sm font-semibold text-foreground">Database Connection</p>
              <p className="text-xs text-muted-foreground">Select a saved connection or add a new one.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status pill — only shown when not yet connected (idle/loading/error) */}
            {connectState !== "success" && <StatusPill state={connectState} />}

            {/* Connection String — secondary ghost */}
            {activeConnectionId && !showNewForm && (
              <button
                type="button"
                onClick={onOpenConnString}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground shadow-sm transition hover:border-border hover:bg-background hover:text-foreground active:scale-[0.97]"
              >
                <IconLink size={13} stroke={1.8} />
                Connection String
              </button>
            )}

            {/* New Connection / Cancel — primary vs ghost-danger */}
            {showNewForm ? (
              <button
                type="button"
                onClick={onToggleNewForm}
                className={classNames(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium shadow-sm transition active:scale-[0.97]",
                  connectState === "error"
                    ? "animate-breathe border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/20"
                    : "border-border bg-card text-muted-foreground hover:border-rose-500/30 hover:bg-rose-500/15 hover:text-rose-300",
                )}
              >
                <IconX size={13} stroke={2} />
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleNewForm}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.97]"
              >
                <IconPlus size={13} stroke={2.5} />
                New Connection
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardBody>
        {loadingConnections ? (
          <p className="text-sm text-muted-foreground">Loading connections…</p>
        ) : connections.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Saved Connections</p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-border">
              {connections.map((conn) => {
                const isActive = conn.uuid === activeConnectionId;
                const providerMismatch = normaliseProvider(conn.provider) !== normaliseProvider(projectProvider);
                const testResult = testResults[conn.uuid];

                const providerLabel = (() => {
                  const lc = conn.provider.toLowerCase();
                  if (lc === "postgres" || lc === "postgresql") return "Postgres";
                  if (lc === "mysql") return "MySQL";
                  if (lc === "sqlite") return "SQLite";
                  return conn.provider;
                })();

                const providerCls = (() => {
                  const lc = conn.provider.toLowerCase();
                  if (providerMismatch) return "border-amber-500/40 bg-amber-500/15 text-amber-300";
                  if (lc === "postgres" || lc === "postgresql") return "border-indigo-500/30 bg-indigo-500/15 text-indigo-300";
                  if (lc === "mysql") return "border-orange-500/30 bg-orange-500/15 text-orange-300";
                  return "border-border bg-muted text-muted-foreground";
                })();

                const rowBg = isActive
                  ? "bg-emerald-500/15"
                  : providerMismatch
                    ? "bg-amber-500/15"
                    : "bg-card hover:bg-background/70";

                return (
                  <div key={conn.uuid} className={classNames("transition", rowBg)}>
                    {/*
                      4-column grid — entire row is clickable for selection;
                      only the actions div stops propagation.
                      [dot + name + badges]  [host:port / db — fills centre]  [date]  [| actions]
                    */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { if (!providerMismatch) onSelectConnection(conn.uuid); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!providerMismatch) onSelectConnection(conn.uuid); } }}
                      title={providerMismatch ? `Provider mismatch — connection is ${conn.provider}, project is ${projectProvider}` : undefined}
                      className={classNames(
                        "grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-6 px-4 py-3",
                        providerMismatch ? "cursor-not-allowed" : "cursor-pointer",
                      )}
                    >
                      {/* Col 1: status dot + name + provider/status badges */}
                      <div className="flex items-center gap-3">
                        <span className={classNames("h-2.5 w-2.5 shrink-0 rounded-full ring-2",
                          isActive
                            ? "bg-emerald-500 ring-emerald-100"
                            : providerMismatch
                              ? "bg-amber-400 ring-amber-100"
                              : "bg-muted ring-transparent")} />
                        <div className="flex items-center gap-2">
                          <p className={classNames("text-sm font-semibold whitespace-nowrap",
                            isActive ? "text-emerald-200" : "text-foreground")}>
                            {conn.name}
                          </p>
                          <span className={classNames("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold", providerCls)}>
                            {providerLabel}
                          </span>
                          {isActive && (
                            <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Active
                            </span>
                          )}
                          {providerMismatch && (
                            <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                              ⚠ Wrong provider
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Col 2: host:port / database — grows to fill empty centre */}
                      <p className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                        {conn.host ? `${conn.host}:${conn.port} / ${conn.database}` : conn.database}
                      </p>

                      {/* Col 3: date + test result */}
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-muted-foreground">{new Date(conn.lastUsedAt).toLocaleDateString()}</p>
                        {testResult && (
                          <p className={classNames("mt-0.5 text-[10px] font-semibold",
                            testResult.success ? "text-emerald-300" : "text-rose-300")}>
                            {testResult.success
                              ? `✓ ${testResult.tables?.length ?? 0} tables`
                              : `✗ ${testResult.error?.slice(0, 32) ?? "Failed"}`}
                          </p>
                        )}
                      </div>

                      {/* Col 4: actions — stop propagation so row click doesn't fire */}
                      <div
                        className="flex shrink-0 items-center gap-1 border-l border-border pl-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button type="button" onClick={() => onTestConnection(conn.uuid)}
                          disabled={testingId === conn.uuid || undefined}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                          {testingId === conn.uuid ? "Testing…" : "Test"}
                        </button>
                        <button type="button" onClick={() => onDeleteConnection(conn.uuid)}
                          disabled={deletingId === conn.uuid || undefined}
                          className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-rose-500/15 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50">
                          {deletingId === conn.uuid ? "…" : "Remove"}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !showNewForm ? (
          <p className="text-sm text-muted-foreground">
            No connections saved yet.{" "}
            <button type="button" onClick={onToggleNewForm}
              className="font-semibold text-foreground underline underline-offset-2">
              Add one
            </button>
          </p>
        ) : null}

        {showNewForm && (
          <NewConnectionForm
            connectionName={connectionName}
            connections={connections}
            host={host}
            port={port}
            dbUser={dbUser}
            password={password}
            database={database}
            isSQLite={isSQLite}
            connectState={connectState}
            connectError={connectError}
            onConnectionNameChange={onConnectionNameChange}
            onHostChange={onHostChange}
            onPortChange={onPortChange}
            onDbUserChange={onDbUserChange}
            onPasswordChange={onPasswordChange}
            onDatabaseChange={onDatabaseChange}
            onConnect={onConnect}
          />
        )}

        {activeConnection && !showNewForm && normaliseProvider(activeConnection.provider) !== normaliseProvider(projectProvider) && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-4 py-3">
            <p className="text-sm font-semibold text-amber-200">
              ⚠ Provider mismatch — active connection is <span className="font-mono">{activeConnection.provider}</span> but
              this project is configured as <span className="font-mono">{projectProvider}</span>.
            </p>
            <p className="mt-1 text-xs text-amber-300">
              Select a matching {projectProvider} connection or create a new one. Running migrations with a mismatched
              provider will fail.
            </p>
          </div>
        )}

        {remoteTables.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tables in DB ({remoteTables.length})</p>
            <div className="flex flex-wrap gap-2">
              {remoteTables.map((t) => (
                <span key={t} className="rounded-md border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground">{t}</span>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
