"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

type UseVersionPairOptions = {
  projectId: string;
  projectName: string;
  hasProject: boolean;
  onReset: () => void;
  onPersist: (patch: Record<string, unknown>) => Promise<void>;
};

export function useVersionPair({
  projectId,
  projectName,
  hasProject,
  onReset,
  onPersist,
}: UseVersionPairOptions) {
  const queryClient = useQueryClient();
  const [syncVersion, setSyncRaw] = useState("");
  const [targetVersion, setTargetRaw] = useState("");
  const lastPairRef = useRef("");

  // Auto-write warnings to DB when the version pair is set, then invalidate
  // the schema-warnings cache so useSchemaWarnings picks them up immediately.
  useEffect(() => {
    if (!hasProject || !projectName || !syncVersion || !targetVersion || syncVersion === targetVersion) return;
    const pair = `${projectName}|${syncVersion}|${targetVersion}`;
    if (lastPairRef.current === pair) return;
    lastPairRef.current = pair;
    const params = new URLSearchParams({ projectName, fromVersion: syncVersion, toVersion: targetVersion });
    fetch(`/api/version-diff?${params.toString()}`)
      .then((r) => {
        if (r.ok) return queryClient.invalidateQueries({ queryKey: ["schema-warnings", projectId, syncVersion, targetVersion] });
        lastPairRef.current = ""; // allow retry on next selection
      })
      .catch(() => { lastPairRef.current = ""; });
  }, [hasProject, projectName, projectId, syncVersion, targetVersion, queryClient]);

  const setSyncVersion = useCallback((v: string) => {
    setSyncRaw(v);
    setTargetRaw("");
    onReset();
    void onPersist({ syncVersion: v, targetVersion: null, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
  }, [onReset, onPersist]);

  const setTargetVersion = useCallback((v: string) => {
    setTargetRaw(v);
    onReset();
    void onPersist({ targetVersion: v, dataTimestamp: null, snapshotId: null, validationPassed: false, runLogPath: null });
  }, [onReset, onPersist]);

  // Imperative setters for restore (no side-effects — caller handles persist)
  const restoreSyncVersion  = setSyncRaw;
  const restoreTargetVersion = setTargetRaw;

  return { syncVersion, targetVersion, setSyncVersion, setTargetVersion, restoreSyncVersion, restoreTargetVersion };
}
