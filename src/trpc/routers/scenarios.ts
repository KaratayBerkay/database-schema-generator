import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { listScenarios, loadScenario } from "@/lib/stores/scenarios-store";
import { baseProcedure, createTRPCRouter } from "../init";

export const scenariosRouter = createTRPCRouter({
  list: baseProcedure.query(() => listScenarios()),

  load: baseProcedure
    .input(z.object({ scenarioId: z.string(), projectName: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await loadScenario(input.scenarioId, input.projectName);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Could not load scenario.",
        });
      }
    }),
});
