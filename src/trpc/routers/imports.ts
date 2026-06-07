import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  parsePickle,
  summarizePickle,
  importVersionPickle,
  importProjectPickle,
  importDatabaseSchema,
} from "@/lib/schema-imports-store";
import { analyzeImportSchema } from "@/lib/schema-store";
import { introspectFromUrl, databaseNameFromUrl } from "@/lib/db/introspect";
import { baseProcedure, createTRPCRouter } from "../init";

/** Suggest a project name from the source database/connection (the UI enforces the ≥8 rule). */
function suggestProjectName(base: string): string {
  const cleaned = base.trim().replace(/\.(db|sqlite3?|sql)$/i, "");
  return cleaned ? `${cleaned} import` : "";
}

function trpcError(err: unknown, fallback = "Operation failed."): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: err instanceof Error ? err.message : fallback,
  });
}

export const importsRouter = createTRPCRouter({
  parse: baseProcedure
    .input(z.object({ content: z.string() }))
    .mutation(({ input }) => {
      try {
        const pickle = parsePickle(input.content);
        return summarizePickle(pickle);
      } catch (err) {
        trpcError(err, "Could not parse pickle file.");
      }
    }),

  importVersion: baseProcedure
    .input(
      z.object({
        content: z.string(),
        projectId: z.string().optional(),
        projectName: z.string().optional(),
        versionName: z.string().optional(),
        replace: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await importVersionPickle(input);
      } catch (err) {
        trpcError(err, "Version import failed.");
      }
    }),

  importProject: baseProcedure
    .input(
      z.object({
        content: z.string(),
        projectName: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await importProjectPickle(input);
      } catch (err) {
        trpcError(err, "Project import failed.");
      }
    }),

  // Introspect a database straight from a connection URL and return the fidelity report.
  // No project, no saved connection, no provider-match — the import creates a fresh project after.
  analyzeDatabaseImportFromUrl: baseProcedure
    .input(z.object({ url: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const { schema } = await introspectFromUrl(input.url);
        const analysis = analyzeImportSchema(schema);
        return { ...analysis, schema, suggestedName: suggestProjectName(databaseNameFromUrl(input.url)) };
      } catch (err) {
        trpcError(err, "Could not introspect the database.");
      }
    }),

  // Commit the import: create a new project from the (re-validated) introspected schema.
  importFromDatabase: baseProcedure
    .input(z.object({ projectName: z.string(), content: z.string() }))
    .mutation(async ({ input }) => {
      try {
        return await importDatabaseSchema(input);
      } catch (err) {
        trpcError(err, "Database import failed.");
      }
    }),
});
