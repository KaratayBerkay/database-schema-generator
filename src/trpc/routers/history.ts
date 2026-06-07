import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { readProjects } from "@/lib/stores/projects-store";
import { getSchemaStats } from "@/lib/stores/schema-store";
import { listMigrationLogs } from "@/lib/db/migration-state";
import { listConnections } from "@/lib/db/migration-connections";
import type { VersionMigrationRun, VersionMigrationSummary } from "@/types/history";
import { baseProcedure, createTRPCRouter } from "../init";

// Shape of the JSON stored in migration_logs.content for a data-migration run.
// Restore / schema-push logs additionally carry a `type` field and are excluded.
type RunContent = {
  type?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  totalCreated?: number;
  totalErrors?: number;
  stage1IssueCount?: number;
  tables?: { name: string; created?: number; updated?: number; errors?: number }[];
  error?: string;
};

function summarize(runs: VersionMigrationRun[]): VersionMigrationSummary {
  return {
    count: runs.length,
    success: runs.filter((r) => r.status === "success").length,
    partial: runs.filter((r) => r.status === "partial").length,
    failed: runs.filter((r) => r.status !== "success" && r.status !== "partial").length,
    totalRowsCreated: runs.reduce((s, r) => s + r.rowsCreated, 0),
  };
}

export const historyRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      const projects = await readProjects();
      const project = projects.find((p) => p.id === input.projectId);
      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      }

      // Connection id → friendly name, for labelling each run.
      const connectionNames = new Map<string, string>();
      try {
        for (const c of listConnections(project.id)) connectionNames.set(c.uuid, c.name);
      } catch { /* connections optional */ }

      // Group data-migration runs by the version they targeted (to_version).
      // listMigrationLogs returns newest-first, so each bucket stays newest-first.
      const runsByVersion = new Map<string, VersionMigrationRun[]>();
      try {
        for (const log of listMigrationLogs(project.id)) {
          const content = log.content as RunContent;
          if (content.type) continue; // restore / schema-push — not a data-migration run
          const run: VersionMigrationRun = {
            id: log.id,
            fromVersion: log.fromVersion,
            toVersion: log.toVersion,
            status: log.status,
            startedAt: content.startedAt ?? null,
            completedAt: content.completedAt ?? content.failedAt ?? null,
            rowsCreated: content.totalCreated ?? 0,
            errors: content.totalErrors ?? 0,
            stage1IssueCount: content.stage1IssueCount ?? 0,
            tables: (content.tables ?? []).map((t) => ({
              name: t.name,
              created: t.created ?? 0,
              updated: t.updated ?? 0,
              errors: t.errors ?? 0,
            })),
            error: content.error ?? null,
            connectionId: log.connectionId,
            connectionLabel: connectionNames.get(log.connectionId) ?? null,
            createdAt: log.createdAt,
          };
          const bucket = runsByVersion.get(log.toVersion);
          if (bucket) bucket.push(run);
          else runsByVersion.set(log.toVersion, [run]);
        }
      } catch { /* logs optional */ }

      const versions = await Promise.all(
        project.versions.map(async (v) => {
          const stats = await getSchemaStats(project.name, v.name).catch(() => ({
            tableCount: 0, fieldCount: 0, relationCount: 0, restrictionCount: 0,
          }));
          const migrations = runsByVersion.get(v.name) ?? [];
          return {
            name: v.name,
            createdAt: v.createdAt,
            tables: stats.tableCount,
            fields: stats.fieldCount,
            relations: stats.relationCount,
            restrictions: stats.restrictionCount,
            migrations,
            migrationSummary: summarize(migrations),
          };
        }),
      );
      return { versions };
    }),
});
