"use client";

import { useLayoutEffect, useRef } from "react";
import { useProjectInfo } from "../shared/project-info-context";
import { useSchemaWarnings } from "@/hooks/use-schema-warnings";
import { useVersionPair } from "@/hooks/use-version-pair";
import { useMigrationPlan } from "@/hooks/use-migration-plan";
import { useRestoreMigrationState } from "@/hooks/use-restore-migration-state";
import { useMigrationConnections } from "@/hooks/use-migration-connections";
import { useSyncCheck } from "@/hooks/use-sync-check";
import { useDestroyDeploy } from "@/hooks/use-destroy-deploy";
import { useMigrationWorkflow } from "@/hooks/use-migration-workflow";
import { SessionHistory } from "@/components/migrations/session-history";
import { MigrationTypeSelector } from "@/components/migrations/migration-type-selector";
import { ConnectionManagementCard } from "@/components/migrations/connection-management-card";
import { DeploySchemaCard } from "@/components/migrations/deploy-schema-card";
import { VersionMigrationSteps } from "@/components/migrations/version-migration-steps";
import { MigrationLockedBanner } from "@/components/migrations/migration-locked-banner";
import { CollectResultModal } from "@/components/migrations/collect-result-modal";
import { DestroyDeployModal } from "@/components/migrations/destroy-deploy-modal";
import { PreflightModal } from "@/components/migrations/preflight-modal";
import { FixRowsModal } from "@/components/migrations/fix-rows-modal";
import { ConnectionStringModal } from "@/components/migrations/connection-string-modal";
import { MigrationProgressBar } from "@/components/migrations/migration-progress-bar";
import { MigrationPageHeader } from "@/components/migrations/migration-page-header";
import { PREFLIGHT_PAGE_SIZE } from "@/constants/migrations";
import {
  useMigrationSessionsQuery,
  useMigrationSavedStateQuery,
  usePersistMigrationState,
  useInvalidateMigrationSessions,
} from "@/queries/migrations";

// ─── component ────────────────────────────────────────────────────────────────

export function MigrationsPageContent() {
  const { projectId, projectName, provider, versions, hasProject } = useProjectInfo();
  const isSQLite          = provider.toLowerCase() === "sqlite";
  const canDoAnyMigration = versions.length >= 1;
  const canVersionMigrate = versions.length >= 2;

  // ── server state ─────────────────────────────────────────────────────────
  const { data: sessions = [] }  = useMigrationSessionsQuery(projectId, hasProject);
  const { data: savedState }     = useMigrationSavedStateQuery(projectId, hasProject);
  const persistMigrationState    = usePersistMigrationState(projectId);
  const invalidateSessions       = useInvalidateMigrationSessions(projectId);

  // ── ref trick: break the resetCollect ↔ useMigrationConnections cycle ────
  const resetCollectRef = useRef<() => void>(() => {});

  // ── plan state ────────────────────────────────────────────────────────────
  const {
    migrationPlan, setMigrationPlan,
    setDbTableCount,
    dbIsEmpty, isNewPlan, isVersionPlan,
    changePlan,
  } = useMigrationPlan({ onReset: () => { destroy.resetPush(); workflow.resetCollect(); } });

  // ── hooks ─────────────────────────────────────────────────────────────────
  const conn = useMigrationConnections({
    onConnected: (tableCount) => {
      setDbTableCount(tableCount);
      if (tableCount === 0) { setMigrationPlan("new"); destroy.resetPush(); }
    },
    onResetFromModelDiff: () => resetCollectRef.current(),
  });

  const {
    syncVersion, targetVersion,
    setSyncVersion, setTargetVersion,
    restoreSyncVersion, restoreTargetVersion,
  } = useVersionPair({
    projectId, projectName, hasProject,
    onReset: () => resetCollectRef.current(),
    onPersist: (patch) => persistMigrationState(patch),
  });

  const { warnings, breakingPendingCount, defaultsRequiredCount, trackingHref } =
    useSchemaWarnings(projectId, syncVersion, targetVersion);

  const sync    = useSyncCheck({ projectName, activeConnectionId: conn.activeConnectionId, syncVersion, migrationPlan, connectState: conn.connectState });
  const destroy = useDestroyDeploy({ projectName, activeConnectionId: conn.activeConnectionId, versions });

  // A version transition can be migrated only once *per connection*: lock the pair when a
  // session for (connection → from → to) has started (run_status set). Each database migrates
  // each transition independently, so locking v1→v2 on one connection leaves it open on the
  // others — the key includes connectionId.
  const migratedPairs = new Set(
    sessions.filter((s) => s.runStatus != null).map((s) => `${s.connectionId}->${s.fromVersion}->${s.toVersion}`),
  );
  const isPairLocked =
    isVersionPlan && !!syncVersion && !!targetVersion && !!conn.activeConnectionId &&
    migratedPairs.has(`${conn.activeConnectionId}->${syncVersion}->${targetVersion}`);

  // Migration steps may only run against a verified, reachable database. Selecting a saved
  // connection marks connectState "success" without testing it, so that can't be trusted.
  // The sync check actually connects, so "compatible" is the stable-connection signal — it
  // flips to "incompatible" on ECONNREFUSED or a schema mismatch.
  const connectionStable = sync.syncCheckState === "compatible";

  const workflow = useMigrationWorkflow({
    projectName, projectId,
    activeConnectionId: conn.activeConnectionId,
    syncVersion, targetVersion,
    breakingPendingCount, defaultsRequiredCount,
    alreadyMigrated: isPairLocked,
    connectionStable,
    persistMigrationState: (patch) => persistMigrationState(patch),
    onSessionsRefresh: invalidateSessions,
  });

  useLayoutEffect(() => { resetCollectRef.current = workflow.resetCollect; });

  useRestoreMigrationState({
    savedState, sessions, hasProject, projectId,
    onRestore: ({ connectionId, fromVersion, toVersion, snapshotId, saved }) => {
      if (connectionId) { conn.setActiveConnectionId(connectionId); conn.setConnectState("success"); }
      if (fromVersion)  restoreSyncVersion(fromVersion);
      if (toVersion)    restoreTargetVersion(toVersion);
      workflow.dispatch({ type: "RESTORE_PHASE_STATES", payload: { validate: saved.validationPassed, migrate: !!saved.runLogPath } });
      if (snapshotId) void persistMigrationState({ snapshotId });
      if (snapshotId && saved.snapshot) {
        workflow.dispatch({ type: "RESTORE_COLLECT_STATE", payload: { snapshotId, timestamp: saved.snapshot.collectedAt, tables: saved.snapshot.tables, total: saved.snapshot.rowCount } });
      } else if (snapshotId && saved.dataTimestamp) {
        workflow.dispatch({ type: "RESTORE_COLLECT_STATE", payload: { snapshotId, timestamp: saved.dataTimestamp, tables: [], total: 0 } });
      } else if (saved.dataTimestamp) {
        workflow.dispatch({ type: "RESTORE_TIMESTAMP_ONLY", payload: saved.dataTimestamp });
      }
      if (snapshotId || saved.dataTimestamp || saved.validationPassed || saved.runLogPath) setMigrationPlan("version");
    },
  });

  // Gate the version-migration steps on a verified connection, not just a selected one.
  const canCollect = connectionStable;

  // A restored connectionId can be stale — the connection was deleted, or its stored
  // credentials can't be decrypted after the encryption master key changed (e.g. the
  // Docker container was recreated without persisting the key). Such a connection
  // silently drops out of the loaded list, so don't trust connectState alone: require
  // the connection to actually be present before treating step 1 as connected (which
  // unlocks Deploy). Prevents a phantom green check with no usable database.
  const effectiveConnectState =
    conn.connectState === "success" && !conn.activeConnection && !conn.loadingConnections
      ? "idle"
      : conn.connectState;

  if (!hasProject) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Select a project to configure migrations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MigrationProgressBar
        phase={workflow.migratePhase}
        progressPct={workflow.progressPct}
        progressTables={workflow.migrateProgressTables}
        progressTotal={workflow.migrateProgressTotal}
      />

      <MigrationPageHeader
        provider={provider}
        projectName={projectName}
        migrationPlan={migrationPlan}
        isNewPlan={isNewPlan}
        newTargetVersion={destroy.newTargetVersion}
        targetVersion={targetVersion}
        activeConnection={conn.activeConnection}
      />

      <ConnectionManagementCard
        canDoAnyMigration={canDoAnyMigration}
        migrationPlan={migrationPlan}
        connections={conn.connections}
        activeConnectionId={conn.activeConnectionId}
        activeConnection={conn.activeConnection}
        loadingConnections={conn.loadingConnections}
        deletingId={conn.deletingId}
        testingId={conn.testingId}
        testResults={conn.testResults}
        remoteTables={conn.remoteTables}
        showNewForm={conn.showNewForm}
        connectionName={conn.connectionName}
        host={conn.host}
        port={conn.port}
        dbUser={conn.dbUser}
        password={conn.password}
        database={conn.database}
        connectState={effectiveConnectState}
        connectError={conn.connectError}
        isSQLite={isSQLite}
        projectProvider={provider}
        onSelectConnection={conn.selectConnection}
        onDeleteConnection={(uuid) => void conn.handleDelete(uuid)}
        onTestConnection={(uuid) => void conn.handleTestConnection(uuid)}
        onOpenConnString={() => void conn.openConnStringModal()}
        onToggleNewForm={() => { conn.setShowNewForm((v) => !v); conn.setConnectError(""); }}
        onConnectionNameChange={conn.setConnectionName}
        onHostChange={conn.setHost}
        onPortChange={conn.setPort}
        onDbUserChange={conn.setDbUser}
        onPasswordChange={conn.setPassword}
        onDatabaseChange={conn.setDatabase}
        onConnect={() => void conn.handleConnect((patch) => persistMigrationState(patch))}
      />

      {/* Session History is the migration history of the *selected* connection — only shown
          once a connection is active, and scoped to that database (a project can have several). */}
      {conn.activeConnectionId && (
        <SessionHistory
          sessions={sessions.filter((s) => s.connectionId === conn.activeConnectionId)}
          knownConnectionIds={new Set(conn.connections.map((c) => c.uuid))}
          onResume={(s) => {
            if (!conn.connections.find((c) => c.uuid === s.connectionId)) return;
            setMigrationPlan("version");
            restoreSyncVersion(s.fromVersion);
            restoreTargetVersion(s.toVersion);
            conn.setActiveConnectionId(s.connectionId);
            conn.setConnectState("success");
            if (s.snapshotId && s.collectTimestamp) {
              workflow.dispatch({ type: "RESTORE_COLLECT_STATE", payload: { snapshotId: s.snapshotId, timestamp: s.collectTimestamp, tables: s.collectTables ?? [], total: s.collectRowCount ?? 0 } });
            }
            void persistMigrationState({ connectionId: s.connectionId, syncVersion: s.fromVersion, targetVersion: s.toVersion, snapshotId: s.snapshotId ?? null, dataTimestamp: s.collectTimestamp });
          }}
        />
      )}

      <MigrationTypeSelector
        canDoAnyMigration={canDoAnyMigration}
        connectionRequired={effectiveConnectState !== "success"}
        isNewPlan={isNewPlan}
        isVersionPlan={isVersionPlan}
        canVersionMigrate={canVersionMigrate}
        dbIsEmpty={dbIsEmpty}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        versions={versions}
        syncCheckState={sync.syncCheckState}
        syncCheckResult={sync.syncCheckResult}
        onChangePlan={changePlan}
        onSyncVersionChange={setSyncVersion}
        onTargetVersionChange={setTargetVersion}
      />

      {isNewPlan && (
        <DeploySchemaCard
          connectState={effectiveConnectState}
          pushState={destroy.pushState}
          pushError={destroy.pushError}
          lastPushMode={destroy.lastPushMode}
          newTargetVersion={destroy.newTargetVersion}
          versions={versions}
          onVersionChange={(v) => { destroy.setNewTargetVersion(v); destroy.resetPush(); }}
          onDeploySchema={() => void destroy.handlePushNew(false)}
          onDestroyOpen={destroy.handleDestroyOpen}
          onDeployAgain={destroy.resetPush}
        />
      )}

      {isPairLocked && (
        <MigrationLockedBanner fromVersion={syncVersion} toVersion={targetVersion} />
      )}

      <VersionMigrationSteps
        isVersionPlan={isVersionPlan}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        warnings={warnings}
        breakingPendingCount={breakingPendingCount}
        defaultsRequiredCount={defaultsRequiredCount}
        trackingHref={trackingHref}
        onGoToTracking={() => {}}
        canCollect={canCollect}
        connectionStable={connectionStable}
        collectState={workflow.collectState}
        collectError={workflow.collectError}
        collectTables={workflow.collectTables}
        collectTotal={workflow.collectTotal}
        collectTimestamp={workflow.collectTimestamp}
        migrationOrder={workflow.migrationOrder}
        restoreState={workflow.restoreState}
        restoreError={workflow.restoreError}
        restoreTables={workflow.restoreTables}
        collectBtnDisabled={workflow.collectBtnDisabled}
        onCollect={() => void workflow.handleCollect()}
        onRestore={() => void workflow.handleRestore()}
        canMigrate={workflow.canMigrate}
        migrateState={workflow.migrateState}
        migrateError={workflow.migrateError}
        validateState={workflow.validateState}
        validateError={workflow.validateError}
        stage1Issues={workflow.stage1Issues}
        stage2Issues={workflow.stage2Issues}
        errorCount={workflow.errorCount}
        migrateTables={workflow.migrateTables}
        migrateVersion={workflow.migrateVersion}
        activeConnection={conn.activeConnection}
        validateBtnDisabled={workflow.validateBtnDisabled}
        migrateBtnDisabled={workflow.migrateBtnDisabled}
        migrateDisabledReason={workflow.migrateDisabledReason}
        onValidate={() => void workflow.handleValidate()}
        onShowPreflight={() => workflow.dispatch({ type: "SHOW_PREFLIGHT", payload: true })}
      />

      <CollectResultModal
        isOpen={workflow.showEmptyModal}
        isVersionPlan={isVersionPlan}
        syncVersion={syncVersion}
        collectTotal={workflow.collectTotal}
        collectTables={workflow.collectTables}
        collectQueryError={workflow.collectQueryError}
        collectMismatches={workflow.collectMismatches}
        collectTimestamp={workflow.collectTimestamp}
        collectModalPage={workflow.collectModalPage}
        migrationOrder={workflow.migrationOrder}
        onPageChange={(p) => workflow.dispatch({ type: "SET_COLLECT_MODAL_PAGE", payload: p })}
        onCancel={() => workflow.dispatch({ type: "SET_SHOW_EMPTY_MODAL", payload: false })}
        onProceed={() => {
          workflow.dispatch({ type: "COLLECT_CONFIRMED" });
          void persistMigrationState({ dataTimestamp: workflow.collectTimestamp });
          invalidateSessions();
        }}
      />

      <DestroyDeployModal
        isOpen={destroy.showDestroyModal}
        newTargetVersion={destroy.newTargetVersion}
        destroyConfirmText={destroy.destroyConfirmText}
        destroyDbPreview={destroy.destroyDbPreview}
        destroyDbPreviewLoading={destroy.destroyDbPreviewLoading}
        onConfirmTextChange={destroy.setDestroyConfirmText}
        onCancel={() => destroy.setShowDestroyModal(false)}
        onConfirm={() => { destroy.setShowDestroyModal(false); void destroy.handlePushNew(true); }}
      />

      <PreflightModal
        isOpen={workflow.showPreflightModal}
        comparison={null}
        warnings={warnings}
        activeConnection={conn.activeConnection}
        syncVersion={syncVersion}
        targetVersion={targetVersion}
        collectTables={workflow.collectTables}
        collectTotal={workflow.collectTotal}
        migrationOrder={workflow.migrationOrder}
        preflightTab={workflow.preflightTab}
        preflightPage={workflow.preflightPage}
        preflightPageSize={PREFLIGHT_PAGE_SIZE}
        onTabChange={(tab) => workflow.dispatch({ type: "SET_PREFLIGHT_TAB", payload: tab })}
        onPageChange={(p) => workflow.dispatch({ type: "SET_PREFLIGHT_PAGE", payload: p })}
        onCancel={() => workflow.dispatch({ type: "SHOW_PREFLIGHT", payload: false })}
        onBeginMigration={() => { workflow.dispatch({ type: "SHOW_PREFLIGHT", payload: false }); void workflow.handleMigrate(); }}
      />

      <FixRowsModal
        isOpen={workflow.showFixModal}
        invalidRows={workflow.invalidRows}
        rowPatches={workflow.rowPatches}
        fixModalLoading={workflow.fixModalLoading}
        fixModalError={workflow.fixModalError}
        onPatch={(p) => workflow.dispatch({ type: "SET_ROW_PATCHES", payload: p })}
        onCancel={() => { workflow.dispatch({ type: "SET_SHOW_FIX_MODAL", payload: false }); workflow.dispatch({ type: "MIGRATE_ERROR", payload: "" }); }}
        onFixAndMigrate={() => void workflow.handleFixAndMigrate()}
      />

      <ConnectionStringModal
        isOpen={conn.showConnStringModal}
        isLoading={conn.isLoadingConnString}
        testFailed={conn.testResults[conn.activeConnectionId]?.success === false}
        connStringValue={conn.connStringValue}
        connStringORM={conn.connStringORM}
        connStringEnvName={conn.connStringEnvName}
        connStringCopied={conn.connStringCopied}
        onClose={() => conn.setShowConnStringModal(false)}
        onOrmChange={(orm) => { conn.setConnStringORM(orm); conn.rebuildConnStringValue(orm, conn.connStringEnvName); conn.setConnStringCopied(false); }}
        onEnvNameChange={(v) => { conn.setConnStringEnvName(v); conn.rebuildConnStringValue("custom", v); conn.setConnStringCopied(false); }}
        onValueChange={(v) => { conn.setConnStringValue(v); conn.setConnStringCopied(false); }}
        onCopy={() => { void navigator.clipboard.writeText(conn.connStringValue); conn.setConnStringCopied(true); setTimeout(() => conn.setConnStringCopied(false), 2000); }}
      />
    </div>
  );
}
