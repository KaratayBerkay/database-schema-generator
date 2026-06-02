"use client";

import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

export function useImportMutations() {
  const trpc = useTRPC();
  return {
    importVersion: useMutation(trpc.imports.importVersion.mutationOptions()),
    importProject: useMutation(trpc.imports.importProject.mutationOptions()),
  };
}
