import { z } from "zod";

import { db as appDb } from "@/lib/db/client";
import { deleteConnection, listConnections } from "@/lib/db/migration-connections";
import { baseProcedure, createTRPCRouter } from "../init";

export const migrationsRouter = createTRPCRouter({
  listConnections: baseProcedure
    .input(z.object({ projectName: z.string() }))
    .query(({ input }) => {
      const projectRow = appDb
        .prepare("SELECT id FROM projects WHERE name = ?")
        .get(input.projectName) as { id: string } | undefined;

      if (!projectRow) return { connections: [] };

      try {
        const connections = listConnections(projectRow.id);
        return { connections };
      } catch {
        return { connections: [] };
      }
    }),

  deleteConnection: baseProcedure
    .input(z.object({ projectName: z.string(), uuid: z.string() }))
    .mutation(({ input }) => {
      deleteConnection(input.uuid);

      const projectRow = appDb
        .prepare("SELECT id FROM projects WHERE name = ?")
        .get(input.projectName) as { id: string } | undefined;

      const connections = projectRow ? listConnections(projectRow.id) : [];
      return { connections };
    }),

  // collect, compare, validate, run remain as REST endpoints for now.
  // They involve heavy file-system and native DB driver work that will be
  // migrated together with the database unification in Phase 5.
});
