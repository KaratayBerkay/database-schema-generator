"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useScenariosQuery() {
  const trpc = useTRPC();
  return useQuery(trpc.scenarios.list.queryOptions());
}

export function useScenarioMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.scenarios.list.queryOptions().queryKey,
    });

  return {
    invalidate,
    load: useMutation(trpc.scenarios.load.mutationOptions()),
    reload: useMutation(trpc.scenarios.reload.mutationOptions()),
  };
}
