import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listScenarios, loadScenario, reloadScenario } from "@/lib/stores/scenarios-store";
import { baseProcedure, createTRPCRouter } from "../init";

function trpcError(err: unknown, fallback: string): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const scenariosRouter = createTRPCRouter({
  list: baseProcedure.query(() => listScenarios()),

  load: baseProcedure
    .input(z.object({ scenarioId: z.string(), projectName: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await loadScenario(input.scenarioId, input.projectName);
      } catch (err) {
        trpcError(err, "Could not load scenario.");
      }
    }),

  reload: baseProcedure
    .input(z.object({ scenarioId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await reloadScenario(input.scenarioId);
      } catch (err) {
        trpcError(err, "Could not re-load scenario.");
      }
    }),
});
