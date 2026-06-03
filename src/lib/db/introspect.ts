import "server-only";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getSchema } from "@mrleebo/prisma-ast";
import type { Model } from "@mrleebo/prisma-ast";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";
import type { StoredConnection } from "@/types/migrations";

const execFileAsync = promisify(execFile);
const tmpDir = path.join(tmpdir(), "database-schema-generator", "introspect");

function stripAnsi(text: string) {
  return text.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r/g, "");
}

/** Infer the Prisma datasource provider from a connection URL's scheme. */
export function inferPrismaProviderFromUrl(url: string): "postgresql" | "mysql" | "sqlite" | null {
  const u = url.trim().toLowerCase();
  if (u.startsWith("postgres://") || u.startsWith("postgresql://")) return "postgresql";
  if (u.startsWith("mysql://")) return "mysql";
  if (u.startsWith("file:") || u.startsWith("sqlite:") || /\.(db|sqlite3?)$/.test(u)) return "sqlite";
  return null;
}

/** Best-effort source database name from a URL, for suggesting a project name. */
export function databaseNameFromUrl(url: string): string {
  const u = url.trim();
  if (inferPrismaProviderFromUrl(u) === "sqlite") {
    const file = u.replace(/^file:/i, "").split(/[\\/]/).pop() ?? "";
    return file.replace(/\.(db|sqlite3?)$/i, "");
  }
  try {
    const path = new URL(u).pathname.replace(/^\//, "");
    return path.split("?")[0] ?? "";
  } catch {
    return "";
  }
}

type DbPullResult = { schema: string; tables: string[] };

/**
 * Run `prisma db pull --print` for a provider + connection URL and return the introspected
 * `.prisma` (DDL only, no rows) plus model names. The temp datasource file is always deleted, and
 * error text is filtered so the credential-bearing `--url=` argument can never leak. P4001 (empty
 * database) is treated as a valid empty schema.
 */
async function runDbPull(prismaProvider: string, connectionUrl: string): Promise<DbPullResult> {
  const tmpSchemaPath = path.join(tmpDir, `import-introspect-${Date.now()}-${Math.random().toString(36).slice(2)}.prisma`);
  const datasourceSchema = `datasource db {\n  provider = "${prismaProvider}"\n}\n`;

  try {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpSchemaPath, datasourceSchema, "utf8");

    try {
      const result = await execFileAsync(
        "pnpm",
        ["prisma", "db", "pull", "--print", "--schema", tmpSchemaPath, `--url=${connectionUrl}`],
        { cwd: process.cwd(), timeout: 30_000 },
      );
      const schema = result.stdout;
      const tables = getSchema(schema).list
        .filter((b) => b.type === "model")
        .map((b) => (b as Model).name);
      return { schema, tables };
    } catch (pullErr) {
      const e = pullErr as { stdout?: string; stderr?: string; message?: string };
      // Use only stdout/stderr — e.message contains the full CLI invocation with credentials.
      const raw = stripAnsi(`${e.stdout ?? ""}\n${e.stderr ?? ""}`)
        .split("\n")
        .filter((line) => {
          const l = line.trim();
          return l.length > 0
            && !l.startsWith("Command failed:")
            && !l.includes("--url=")
            && !l.includes("--schema ");
        })
        .join("\n")
        .trim();
      if (raw.includes("P4001") || (e.stdout ?? "").includes("P4001")) {
        return { schema: datasourceSchema, tables: [] };
      }
      throw new Error(raw || "Could not connect to the database.");
    }
  } finally {
    await rm(tmpSchemaPath, { force: true });
  }
}

export type IntrospectResult = {
  /** Prisma provider name: "postgresql" | "mysql" | "sqlite". */
  provider: string;
  /** The introspected `.prisma` schema (datasource block + models). */
  schema: string;
  /** Model names found by introspection. */
  tables: string[];
};

/**
 * Introspect a database directly from a connection URL — no project, no saved connection. This is
 * the standalone import path: a fresh project is created from the result afterward. The provider is
 * inferred from the URL scheme (postgresql:// , mysql:// , file:/path.db for SQLite).
 */
export async function introspectFromUrl(rawUrl: string): Promise<IntrospectResult> {
  const url = rawUrl.trim();
  if (!url) throw new Error("Enter a database connection URL.");
  const provider = inferPrismaProviderFromUrl(url);
  if (!provider) {
    throw new Error("Unrecognized connection URL. Use postgresql://… , mysql://… , or file:/path.db (SQLite).");
  }
  const connectionUrl = provider === "sqlite" && !/^file:/i.test(url) ? `file:${url}` : url;
  const { schema, tables } = await runDbPull(provider, connectionUrl);
  return { provider, schema, tables };
}

function buildConnectionUrl(conn: StoredConnection): string {
  const p = conn.provider.toLowerCase();
  if (p === "sqlite") return `file:${conn.database}`;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
}

function toPrismaProvider(provider: string): string {
  const p = provider.toLowerCase();
  if (p === "mysql") return "mysql";
  if (p === "sqlite") return "sqlite";
  return "postgresql";
}

/** Introspect a saved (encrypted) connection — used where a connection already exists. */
export async function introspectSavedConnection(connectionId: string): Promise<IntrospectResult & { connectionName: string; database: string }> {
  const stored = getConnection(connectionId);
  if (!stored) throw new Error("Connection not found. Add or select a connection first.");
  const provider = toPrismaProvider(stored.provider);
  const { schema, tables } = await runDbPull(provider, buildConnectionUrl(stored));
  touchLastUsedAt(connectionId);
  return { provider, schema, tables, connectionName: stored.name, database: stored.database };
}
