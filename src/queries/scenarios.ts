"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useScenariosQuery() {
  const trpc = useTRPC();
  return useQuery(trpc.scenarios.list.queryOptions());
}

export function useLoadScenarioMutation() {
  const trpc = useTRPC();
  return useMutation(trpc.scenarios.load.mutationOptions());
}
