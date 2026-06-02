"use client";

import { useReducer, useCallback } from "react";
import type {
  CollectResponse,
  InvalidRow,
  MigrateProgressEvent,
  MigrationOrderItem,
  PhaseState,
  RunResponse,
  ValidateResponse,
  ValidationIssue,
} from "@/types/migrations";

// ─── state ───────────────────────────────────────────────────────────────────

type RestoreTable = { name: string; created: number; updated: number; errors: number };

type WorkflowState = {
  // preflight modal
  showPreflightModal: boolean;
  preflightTab: "crucial" | "warning";
  preflightPage: number;
  // collect
  collectState: PhaseState;
  collectError: string;
  collectTimestamp: string;
  collectSnapshotId: string | null;
  collectTables: { name: string; count: number }[];
  collectTotal: number;
  collectQueryError: string;
  collectMismatches: { schemaTable: string; resolvedTable: string | null }[];
  migrationOrder: MigrationOrderItem[];
  showEmptyModal: boolean;
  collectModalPage: number;
  // validate + migrate
  validateState: PhaseState;
  validateError: string;
  stage1Issues: ValidationIssue[];
  stage2Issues: ValidationIssue[];
  migrateState: PhaseState;
  migrateError: string;
  migrateTables: RunResponse["tables"];
  migrateVersion: string;
  // restore
  restoreState: "idle" | "loading" | "success" | "error";
  restoreError: string;
  restoreTables: RestoreTable[];
  // SSE progress
  migratePhase: "idle" | "schema_push" | "inserting";
  migrateProgressTotal: number;
  migrateProgressTotalRows: number;
  migrateProgressTables: MigrateProgressEvent[];
  // fix-rows modal
  showFixModal: boolean;
  invalidRows: InvalidRow[];
  rowPatches: Record<string, Record<string, string>>;
  fixModalLoading: boolean;
  fixModalError: string;
};

const initialState: WorkflowState = {
  showPreflightModal: false, preflightTab: "crucial", preflightPage: 0,
  collectState: "idle", collectError: "", collectTimestamp: "",
  collectSnapshotId: null, collectTables: [], collectTotal: 0,
  collectQueryError: "", collectMismatches: [], migrationOrder: [],
  showEmptyModal: false, collectModalPage: 0,
  validateState: "idle", validateError: "", stage1Issues: [], stage2Issues: [],
  migrateState: "idle", migrateError: "", migrateTables: [], migrateVersion: "",
  restoreState: "idle", restoreError: "", restoreTables: [],
  migratePhase: "idle", migrateProgressTotal: 0, migrateProgressTotalRows: 0, migrateProgressTables: [],
  showFixModal: false, invalidRows: [], rowPatches: {}, fixModalLoading: false, fixModalError: "",
};

// ─── actions ─────────────────────────────────────────────────────────────────

type WorkflowAction =
  | { type: "RESET_COLLECT" }
  | { type: "RESET_FROM_VALIDATE" }
  | { type: "COLLECT_LOADING" }
  | { type: "COLLECT_SUCCESS"; payload: {
      timestamp: string; snapshotId: string | null; tables: { name: string; count: number }[];
      total: number; queryError: string; mismatches: { schemaTable: string; resolvedTable: string | null }[];
      migrationOrder: MigrationOrderItem[];
    } }
  | { type: "COLLECT_ERROR"; payload: string }
  | { type: "SET_COLLECT_MODAL_PAGE"; payload: number }
  | { type: "SET_SHOW_EMPTY_MODAL"; payload: boolean }
  | { type: "COLLECT_CONFIRMED" }
  | { type: "VALIDATE_LOADING" }
  | { type: "VALIDATE_SUCCESS"; payload: { stage1: ValidationIssue[]; stage2: ValidationIssue[] } }
  | { type: "VALIDATE_ERROR"; payload: string }
  | { type: "MIGRATE_LOADING" }
  | { type: "MIGRATE_SUCCESS"; payload: { tables: RunResponse["tables"]; migrationOrder?: MigrationOrderItem[]; newVersion: string; stage1Issues?: ValidationIssue[] } }
  | { type: "MIGRATE_ERROR"; payload: string }
  | { type: "NEEDS_FIX"; payload: { invalidRows: InvalidRow[]; stage1: ValidationIssue[]; stage2: ValidationIssue[] } }
  | { type: "SET_ROW_PATCHES"; payload: Record<string, Record<string, string>> }
  | { type: "SET_FIX_MODAL_ERROR"; payload: string }
  | { type: "SET_SHOW_FIX_MODAL"; payload: boolean }
  | { type: "FIX_MODAL_LOADING"; payload: boolean }
  | { type: "RESTORE_LOADING" }
  | { type: "RESTORE_SUCCESS"; payload: RestoreTable[] }
  | { type: "RESTORE_ERROR"; payload: string }
  | { type: "SET_MIGRATE_PHASE"; payload: { phase: "idle" | "schema_push" | "inserting"; total?: number; totalRows?: number } }
  | { type: "ADD_PROGRESS_EVENT"; payload: MigrateProgressEvent }
  | { type: "RESET_PROGRESS" }
  | { type: "SHOW_PREFLIGHT"; payload: boolean }
  | { type: "SET_PREFLIGHT_TAB"; payload: "crucial" | "warning" }
  | { type: "SET_PREFLIGHT_PAGE"; payload: number }
  | { type: "RESTORE_COLLECT_STATE"; payload: { snapshotId: string; timestamp: string; tables: { name: string; count: number }[]; total: number } }
  | { type: "RESTORE_TIMESTAMP_ONLY"; payload: string }
  | { type: "RESTORE_PHASE_STATES"; payload: { validate?: boolean; migrate?: boolean } };

// ─── reducer ─────────────────────────────────────────────────────────────────

const resetFromValidateSlice: Partial<WorkflowState> = {
  validateState: "idle", validateError: "", stage1Issues: [], stage2Issues: [],
  migrateState: "idle", migrateError: "", migrateTables: [], migrateVersion: "",
  showFixModal: false, invalidRows: [], rowPatches: {}, fixModalError: "",
  restoreState: "idle", restoreError: "", restoreTables: [],
};

function reducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case "RESET_FROM_VALIDATE":
      return { ...state, ...resetFromValidateSlice };
    case "RESET_COLLECT":
      return {
        ...state,
        collectState: "idle", collectError: "", collectTimestamp: "",
        collectSnapshotId: null, collectTables: [], collectTotal: 0,
        collectQueryError: "", collectMismatches: [], migrationOrder: [],
        showEmptyModal: false,
        ...resetFromValidateSlice,
      };
    case "COLLECT_LOADING":
      return {
        ...state,
        collectState: "loading", collectError: "", collectTimestamp: "",
        collectSnapshotId: null, collectTables: [], collectTotal: 0,
        collectQueryError: "",
        ...resetFromValidateSlice,
      };
    case "COLLECT_SUCCESS":
      return {
        ...state,
        collectTimestamp: action.payload.timestamp,
        collectSnapshotId: action.payload.snapshotId,
        collectTables: action.payload.tables,
        collectTotal: action.payload.total,
        collectQueryError: action.payload.queryError,
        collectMismatches: action.payload.mismatches,
        migrationOrder: action.payload.migrationOrder,
        collectModalPage: 0,
        showEmptyModal: true,
        collectState: "idle",
      };
    case "COLLECT_ERROR":
      return { ...state, collectError: action.payload, collectState: "error" };
    case "SET_COLLECT_MODAL_PAGE":
      return { ...state, collectModalPage: action.payload };
    case "SET_SHOW_EMPTY_MODAL":
      return { ...state, showEmptyModal: action.payload };
    case "COLLECT_CONFIRMED":
      return { ...state, showEmptyModal: false, collectState: "success" };
    case "VALIDATE_LOADING":
      return { ...state, validateState: "loading", validateError: "", stage1Issues: [], stage2Issues: [] };
    case "VALIDATE_SUCCESS":
      return { ...state, validateState: "success", stage1Issues: action.payload.stage1, stage2Issues: action.payload.stage2 };
    case "VALIDATE_ERROR":
      return { ...state, validateState: "error", validateError: action.payload };
    case "MIGRATE_LOADING":
      return {
        ...state,
        migrateState: "loading", migrateError: "", migrateTables: [], migrateVersion: "",
        migratePhase: "idle", migrateProgressTables: [],
        showFixModal: false, invalidRows: [], rowPatches: {}, fixModalError: "",
      };
    case "MIGRATE_SUCCESS":
      return {
        ...state,
        migrateTables: action.payload.tables ?? [],
        migrationOrder: action.payload.migrationOrder ?? state.migrationOrder,
        migrateVersion: action.payload.newVersion,
        migrateState: "success",
        stage1Issues: action.payload.stage1Issues ?? state.stage1Issues,
      };
    case "MIGRATE_ERROR":
      return { ...state, migrateState: "error", migrateError: action.payload, migratePhase: "idle" };
    case "NEEDS_FIX":
      return {
        ...state,
        invalidRows: action.payload.invalidRows,
        stage1Issues: action.payload.stage1,
        stage2Issues: action.payload.stage2,
        showFixModal: true,
        migrateState: "idle", migratePhase: "idle",
      };
    case "SET_ROW_PATCHES":
      return { ...state, rowPatches: action.payload };
    case "SET_FIX_MODAL_ERROR":
      return { ...state, fixModalError: action.payload };
    case "SET_SHOW_FIX_MODAL":
      return { ...state, showFixModal: action.payload };
    case "FIX_MODAL_LOADING":
      return { ...state, fixModalLoading: action.payload };
    case "RESTORE_LOADING":
      return {
        ...state,
        restoreState: "loading", restoreError: "", restoreTables: [],
        migratePhase: "idle", migrateProgressTables: [],
      };
    case "RESTORE_SUCCESS":
      return { ...state, restoreTables: action.payload, restoreState: "success", migratePhase: "idle" };
    case "RESTORE_ERROR":
      return { ...state, restoreError: action.payload, restoreState: "error", migratePhase: "idle" };
    case "SET_MIGRATE_PHASE":
      return {
        ...state,
        migratePhase: action.payload.phase,
        migrateProgressTotal: action.payload.total ?? state.migrateProgressTotal,
        migrateProgressTotalRows: action.payload.totalRows ?? state.migrateProgressTotalRows,
      };
    case "ADD_PROGRESS_EVENT":
      return { ...state, migrateProgressTables: [...state.migrateProgressTables, action.payload] };
    case "RESET_PROGRESS":
      return { ...state, migratePhase: "idle", migrateProgressTables: [] };
    case "SHOW_PREFLIGHT":
      return { ...state, showPreflightModal: action.payload };
    case "SET_PREFLIGHT_TAB":
      return { ...state, preflightTab: action.payload, preflightPage: 0 };
    case "SET_PREFLIGHT_PAGE":
      return { ...state, preflightPage: action.payload };
    case "RESTORE_COLLECT_STATE":
      return {
        ...state,
        collectSnapshotId: action.payload.snapshotId,
        collectTimestamp: action.payload.timestamp,
        collectTables: action.payload.tables,
        collectTotal: action.payload.total,
        collectState: "success",
      };
    case "RESTORE_TIMESTAMP_ONLY":
      return { ...state, collectTimestamp: action.payload, collectState: "success" };
    case "RESTORE_PHASE_STATES":
      return {
        ...state,
        validateState: action.payload.validate ? "success" : state.validateState,
        migrateState: action.payload.migrate ? "success" : state.migrateState,
      };
    default:
      return state;
  }
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useMigrationWorkflow({
  projectName,
  projectId,
  activeConnectionId,
  syncVersion,
  targetVersion,
  breakingPendingCount,
  defaultsRequiredCount,
  persistMigrationState,
  onSessionsRefresh,
}: {
  projectName: string;
  projectId: string;
  activeConnectionId: string;
  syncVersion: string;
  targetVersion: string;
  breakingPendingCount: number;
  defaultsRequiredCount: number;
  persistMigrationState: (patch: Record<string, unknown>) => Promise<void>;
  onSessionsRefresh: () => void;
}) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const resetCollect       = useCallback(() => dispatch({ type: "RESET_COLLECT" }), []);
  const resetFromValidate  = useCallback(() => dispatch({ type: "RESET_FROM_VALIDATE" }), []);

  // ─── SSE reader ────────────────────────────────────────────────────────────

  const readSSE = useCallback(async (
    response: Response,
    handlers: {
      onPhase?: (phase: "schema_push" | "inserting", total?: number, totalRows?: number) => void;
      onProgress?: (event: MigrateProgressEvent) => void;
      onNeedsFix?: (data: RunResponse) => void;
      onDone: (data: RunResponse) => void;
      onError: (msg: string) => void;
    },
  ) => {
    if (!response.body) throw new Error("No response body.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let terminated = false;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;

    const clearStall = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };
    const resetStall = () => {
      clearStall();
      stallTimer = setTimeout(() => {
        terminated = true;
        void reader.cancel().catch(() => {});
        handlers.onError("Migration stalled — no data received for 90 seconds. The server may have crashed.");
      }, 90_000);
    };

    try {
      resetStall();
      outer: while (!terminated) {
        const { done, value } = await reader.read();
        if (terminated) break;
        resetStall();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; [k: string]: unknown };
            if (event.type === "phase" && handlers.onPhase) {
              handlers.onPhase(event.phase as "schema_push" | "inserting", typeof event.total === "number" ? event.total : undefined, typeof event.totalRows === "number" ? event.totalRows : undefined);
            } else if (event.type === "progress" && handlers.onProgress) {
              handlers.onProgress(event as unknown as MigrateProgressEvent);
            } else if (event.type === "needsFix" && handlers.onNeedsFix) {
              terminated = true; handlers.onNeedsFix(event as unknown as RunResponse); break outer;
            } else if (event.type === "done") {
              terminated = true; handlers.onDone(event as unknown as RunResponse); break outer;
            } else if (event.type === "error") {
              terminated = true; handlers.onError((event.error as string) ?? "Migration failed."); break outer;
            }
          } catch { /* malformed line */ }
        }
      }
      if (!terminated) handlers.onError("Stream closed without a completion event — the server may have restarted.");
    } catch (err) {
      if (!terminated) {
        const msg = err instanceof Error ? err.message : "SSE stream error.";
        handlers.onError(msg);
      }
    } finally {
      clearStall();
      void reader.cancel().catch(() => {});
    }
  }, []);

  // ─── shared SSE progress handlers ─────────────────────────────────────────

  const sseProgressHandlers = {
    onPhase: (phase: "schema_push" | "inserting", total?: number, totalRows?: number) =>
      dispatch({ type: "SET_MIGRATE_PHASE", payload: { phase, total, totalRows } }),
    onProgress: (event: MigrateProgressEvent) =>
      dispatch({ type: "ADD_PROGRESS_EVENT", payload: event }),
  };

  // ─── shared migrate result handler ────────────────────────────────────────

  const applyMigrateSuccess = useCallback((data: RunResponse) => {
    dispatch({
      type: "MIGRATE_SUCCESS",
      payload: {
        tables: data.tables,
        migrationOrder: data.migrationOrder,
        newVersion: data.newVersion ?? targetVersion,
        stage1Issues: data.stage1Issues,
      },
    });
    void persistMigrationState({ runLogPath: data.logPath ?? null });
    onSessionsRefresh();
  }, [targetVersion, persistMigrationState, onSessionsRefresh]);

  // ─── collect ───────────────────────────────────────────────────────────────

  const handleCollect = useCallback(async () => {
    if (state.collectState === "loading") return;
    dispatch({ type: "COLLECT_LOADING" });
    try {
      const res = await fetch("/api/migrations/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion, targetVersion }),
      });
      const data: CollectResponse = await res.json();
      if (!data.success) throw new Error(data.error ?? "Collect failed.");
      dispatch({
        type: "COLLECT_SUCCESS",
        payload: {
          timestamp: data.timestamp ?? "",
          snapshotId: data.snapshotId ?? null,
          tables: data.tables ?? [],
          total: data.totalRecords ?? 0,
          queryError: data.collectError ?? "",
          mismatches: data.tableMismatches ?? [],
          migrationOrder: data.migrationOrder ?? [],
        },
      });
      if (data.snapshotId) void persistMigrationState({ snapshotId: data.snapshotId, dataTimestamp: data.timestamp ?? null });
      else if (data.timestamp) void persistMigrationState({ dataTimestamp: data.timestamp });
    } catch (err) {
      dispatch({ type: "COLLECT_ERROR", payload: err instanceof Error ? err.message : "Collect failed." });
    }
  }, [projectName, activeConnectionId, syncVersion, targetVersion, persistMigrationState]);

  // ─── validate ──────────────────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    if (state.validateState === "loading") return;
    dispatch({ type: "VALIDATE_LOADING" });
    try {
      const res = await fetch("/api/migrations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion, targetVersion, snapshotId: state.collectSnapshotId }),
      });
      const data: ValidateResponse = await res.json();
      if (!data.success) throw new Error(data.error ?? "Validation failed.");
      dispatch({ type: "VALIDATE_SUCCESS", payload: { stage1: data.stage1Issues ?? [], stage2: data.stage2Issues ?? [] } });
      void persistMigrationState({
        validationPassed: !(data.stage1Issues ?? []).concat(data.stage2Issues ?? []).some((i) => i.severity === "error"),
      });
    } catch (err) {
      dispatch({ type: "VALIDATE_ERROR", payload: err instanceof Error ? err.message : "Validation failed." });
    }
  }, [projectName, activeConnectionId, syncVersion, targetVersion, state.collectSnapshotId, persistMigrationState]);

  // ─── migrate ───────────────────────────────────────────────────────────────

  const consumeMigrateStream = useCallback(async (
    body: RequestInit["body"],
    onNeedsFix: (data: RunResponse) => void,
    onError: (msg: string) => void,
    onDone: (data: RunResponse) => void,
  ) => {
    const res = await fetch("/api/migrations/run", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    await readSSE(res, { ...sseProgressHandlers, onNeedsFix, onDone, onError });
  }, [readSSE]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMigrate = useCallback(async () => {
    if (state.migrateState === "loading") return;
    dispatch({ type: "MIGRATE_LOADING" });
    dispatch({ type: "SET_MIGRATE_PHASE", payload: { phase: "schema_push" } });
    try {
      await consumeMigrateStream(
        JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion, targetVersion, snapshotId: state.collectSnapshotId }),
        (data) => dispatch({ type: "NEEDS_FIX", payload: { invalidRows: data.invalidRows ?? [], stage1: data.stage1Issues ?? [], stage2: data.stage2Issues ?? [] } }),
        (msg) => dispatch({ type: "MIGRATE_ERROR", payload: msg }),
        (data) => { applyMigrateSuccess(data); dispatch({ type: "SET_MIGRATE_PHASE", payload: { phase: "idle" } }); },
      );
    } catch (err) {
      dispatch({ type: "MIGRATE_ERROR", payload: err instanceof Error ? err.message : "Migration failed." });
    }
  }, [projectName, activeConnectionId, syncVersion, targetVersion, state.collectSnapshotId, consumeMigrateStream, applyMigrateSuccess]);

  const handleFixAndMigrate = useCallback(async () => {
    dispatch({ type: "FIX_MODAL_LOADING", payload: true });
    dispatch({ type: "SET_FIX_MODAL_ERROR", payload: "" });
    dispatch({ type: "RESET_PROGRESS" });
    dispatch({ type: "SET_MIGRATE_PHASE", payload: { phase: "schema_push" } });
    try {
      await consumeMigrateStream(
        JSON.stringify({ projectName, connectionId: activeConnectionId, syncVersion, targetVersion, snapshotId: state.collectSnapshotId, rowPatches: state.rowPatches }),
        (data) => { dispatch({ type: "NEEDS_FIX", payload: { invalidRows: data.invalidRows ?? [], stage1: data.stage1Issues ?? [], stage2: data.stage2Issues ?? [] } }); },
        (msg) => dispatch({ type: "SET_FIX_MODAL_ERROR", payload: msg }),
        (data) => {
          dispatch({ type: "SET_SHOW_FIX_MODAL", payload: false });
          dispatch({ type: "SET_ROW_PATCHES", payload: {} });
          applyMigrateSuccess(data);
          dispatch({ type: "SET_MIGRATE_PHASE", payload: { phase: "idle" } });
        },
      );
    } catch (err) {
      dispatch({ type: "SET_FIX_MODAL_ERROR", payload: err instanceof Error ? err.message : "Migration failed." });
    } finally {
      dispatch({ type: "FIX_MODAL_LOADING", payload: false });
    }
  }, [projectName, activeConnectionId, syncVersion, targetVersion, state.collectSnapshotId, state.rowPatches, consumeMigrateStream, applyMigrateSuccess]);

  // ─── restore ───────────────────────────────────────────────────────────────

  const handleRestore = useCallback(async () => {
    dispatch({ type: "RESTORE_LOADING" });
    try {
      const res = await fetch("/api/migrations/restore-snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, connectionId: activeConnectionId, snapshotId: state.collectSnapshotId, syncVersion }),
      });
      await readSSE(res, {
        ...sseProgressHandlers,
        onDone: (data) => dispatch({ type: "RESTORE_SUCCESS", payload: (data.tables as RestoreTable[]) ?? [] }),
        onError: (msg) => dispatch({ type: "RESTORE_ERROR", payload: msg }),
      });
    } catch (err) {
      dispatch({ type: "RESTORE_ERROR", payload: err instanceof Error ? err.message : "Restore failed." });
    }
  }, [projectName, activeConnectionId, state.collectSnapshotId, syncVersion, readSSE]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── derived gating ────────────────────────────────────────────────────────

  const allIssues = [...state.stage1Issues, ...state.stage2Issues];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;

  const canMigrate = state.collectState === "success";

  const missingContext = !activeConnectionId || !syncVersion || !targetVersion;

  const collectBtnDisabled  = state.collectState === "loading" || undefined;
  const validateBtnDisabled = state.validateState === "loading" || missingContext || !state.collectSnapshotId || undefined;

  const migrateDisabledReason =
    state.migrateState === "loading"         ? null
    : missingContext                          ? "Connection or version pair is missing."
    : breakingPendingCount > 0               ? `${breakingPendingCount} warning${breakingPendingCount !== 1 ? "s" : ""} must be approved in Tracking before migrating.`
    : defaultsRequiredCount > 0              ? `${defaultsRequiredCount} field${defaultsRequiredCount !== 1 ? "s" : ""} need a replacement value set in Tracking.`
    : state.validateState === "success" && errorCount > 0 ? `${errorCount} validation error${errorCount !== 1 ? "s" : ""} must be resolved before migrating.`
    : null;

  const migrateBtnDisabled  =
    state.migrateState === "loading" ||
    missingContext ||
    (state.validateState === "success" && errorCount > 0) ||
    breakingPendingCount > 0 ||
    defaultsRequiredCount > 0 ||
    undefined;

  const rowsInserted = state.migrateProgressTables.reduce((s, t) => s + t.created + t.updated, 0);
  const progressPct = state.migratePhase === "schema_push"
    ? 5
    : state.migratePhase === "inserting" && state.migrateProgressTotalRows > 0
      ? Math.round(5 + (rowsInserted / state.migrateProgressTotalRows) * 90)
      : 0;

  return {
    // state (spread for ergonomic access in page)
    ...state,
    allIssues, errorCount,
    canMigrate,
    collectBtnDisabled, validateBtnDisabled, migrateBtnDisabled, migrateDisabledReason,
    progressPct,
    // actions
    dispatch,
    resetCollect,
    resetFromValidate,
    // handlers
    handleCollect,
    handleValidate,
    handleMigrate,
    handleFixAndMigrate,
    handleRestore,
  };
}
