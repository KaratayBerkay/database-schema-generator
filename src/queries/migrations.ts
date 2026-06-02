"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MigrationSession, SavedMigrationState } from "@/types/migrations";

export const migrationSessionsKey = (projectId: string) =>
  ["migration-sessions", projectId] as const;

export const migrationSavedStateKey = (projectId: string) =>
  ["migration-saved-state", projectId] as const;

export function useMigrationSessionsQuery(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: migrationSessionsKey(projectId),
    queryFn: (): Promise<MigrationSession[]> =>
      fetch(`/api/migration-state?list=true&projectId=${projectId}`).then(r => r.json()),
    enabled,
    staleTime: 30_000,
  });
}

export function useMigrationSavedStateQuery(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: migrationSavedStateKey(projectId),
    queryFn: (): Promise<SavedMigrationState | undefined> =>
      fetch(`/api/migration-state?projectId=${projectId}`).then(r => r.ok ? r.json() : undefined),
    enabled,
    staleTime: Infinity,
    gcTime: 0,
  });
}

export function usePersistMigrationState(projectId: string) {
  const { mutateAsync } = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      fetch("/api/migration-state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...patch }),
      }),
  });
  return (patch: Record<string, unknown>): Promise<void> =>
    mutateAsync(patch).then(() => {}).catch(() => {});
}

export function useInvalidateMigrationSessions(projectId: string) {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: migrationSessionsKey(projectId) });
}
