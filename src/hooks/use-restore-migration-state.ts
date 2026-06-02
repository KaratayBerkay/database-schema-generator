"use client";

import { useEffect, useRef } from "react";
import type { MigrationSession, RestoreParams, SavedMigrationState } from "@/types/migrations";

type UseRestoreMigrationStateOptions = {
  savedState: SavedMigrationState | undefined;
  sessions: MigrationSession[];
  hasProject: boolean;
  projectId: string;
  onRestore: (params: RestoreParams) => void;
};

export function useRestoreMigrationState({
  savedState,
  sessions,
  hasProject,
  projectId,
  onRestore,
}: UseRestoreMigrationStateOptions) {
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!savedState || !hasProject || hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const connectionId = savedState.connectionId ?? savedState.snapshot?.connectionId ?? null;
    const fromVersion  = savedState.syncVersion  ?? savedState.snapshot?.fromVersion  ?? null;
    const toVersion    = savedState.targetVersion ?? savedState.snapshot?.toVersion   ?? null;

    // Recover snapshotId from session list when workflow state lost it
    let snapshotId = savedState.snapshotId ?? null;
    if (!snapshotId && savedState.dataTimestamp) {
      const match = sessions.find((s) =>
        s.connectionId === connectionId &&
        s.fromVersion === fromVersion &&
        s.toVersion === toVersion &&
        s.collectTimestamp === savedState.dataTimestamp &&
        s.snapshotId,
      );
      if (match?.snapshotId) snapshotId = match.snapshotId;
    }

    onRestore({ connectionId, fromVersion, toVersion, snapshotId, saved: savedState });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedState, hasProject]);

  // Reset restore flag when project changes so the new project's state loads fresh
  useEffect(() => { hasRestoredRef.current = false; }, [projectId]);
}
