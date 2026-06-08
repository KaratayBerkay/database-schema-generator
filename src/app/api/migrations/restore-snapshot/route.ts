import { execFile, spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import type { StoredConnection } from "@/types/migrations";
import { getConnection, touchLastUsedAt } from "@/lib/db/migration-connections";
import { db as appDb } from "@/lib/db/client";
import { getSnapshotData, insertMigrationLog, upsertMigrationSession } from "@/lib/db/migration-state";
import { prepareMigrationPrismaSchema } from "@/lib/migrations/migration-schema-artifacts";
import { MIGRATION_REFERENCE_FIELD } from "@/lib/domain/schema-naming";

const execFileAsync = promisify(execFile);

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}


function buildConnectionUrl(conn: StoredConnection): string {
  const p = conn.provider.toLowerCase();
  if (p === "sqlite") return `file:${conn.database}`;
  const proto = p === "mysql" ? "mysql" : "postgresql";
  return `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
}

function buildRestoreScript(): string {
  return `
'use strict';

const readStdin = () => new Promise((resolve, reject) => {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => resolve(raw));
  process.stdin.on('error', reject);
});
const SKIP_FIELD = '${MIGRATION_REFERENCE_FIELD}';

// A single backslash, built without a backslash literal so the wrapping template-literal can't mangle it.
const BACKSLASH = String.fromCharCode(92);
// Escape an arbitrary string into a single-quoted SQL literal. Single quotes are doubled for every
// provider; MySQL/MariaDB also treat backslash as a string-escape char, so double backslashes there
// to stop a lone backslash from escaping the closing quote and injecting SQL.
const escStr = (s, provider) => {
  const p = (provider ?? '').toLowerCase();
  const quoted = p === 'mysql'
    ? s.split(BACKSLASH).join(BACKSLASH + BACKSLASH).replace(/'/g, "''")
    : s.replace(/'/g, "''");
  return "'" + quoted + "'";
};

const escVal = (v, provider) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') {
    const p = (provider ?? '').toLowerCase();
    return (p === 'postgresql' || p === 'postgres') ? (v ? 'TRUE' : 'FALSE') : (v ? '1' : '0');
  }
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (v instanceof Date) return "'" + v.toISOString() + "'";
  // Buffer / bytea: survives the stdin JSON round-trip as { type:'Buffer', data:[...] }. Emit a
  // backslash-free hex literal per provider (the wrapping template-literal strips lone backslashes).
  if (Buffer.isBuffer(v) || (v && typeof v === 'object' && v.type === 'Buffer' && Array.isArray(v.data))) {
    const hex = (Buffer.isBuffer(v) ? v : Buffer.from(v.data)).toString('hex');
    const p = (provider ?? '').toLowerCase();
    if (p === 'postgresql' || p === 'postgres') return "decode('" + hex + "', 'hex')";
    return "X'" + hex + "'";
  }
  // JSON / jsonb (plain objects + arrays): serialise to a quoted JSON literal instead of '[object Object]'.
  if (typeof v === 'object') return escStr(JSON.stringify(v), provider);
  return escStr(String(v), provider);
};

// Quote SQL identifiers, doubling embedded quote chars. Names are validated upstream to
// /^[A-Za-z][A-Za-z0-9_]*$/ — this is defense-in-depth for the restore path, which never re-checks.
const escId = (name) => '"' + String(name).split('"').join('""') + '"';
const escIdMy = (name) => '\`' + String(name).split('\`').join('\`\`') + '\`';

const main = async () => {
  const { tables, provider, connectionUrl } = JSON.parse(await readStdin());
  const p = provider.toLowerCase();
  const summaries = [];

  if (p === 'sqlite') {
    const Database = require('better-sqlite3');
    const db = new Database(connectionUrl.replace(/^file:/, ''));
    db.pragma('journal_mode = WAL');
    for (const { tableName, idField, records } of tables) {
      let created = 0; const errorDetails = [];
      const run = db.transaction((recs) => {
        for (const rec of recs) {
          const entries = Object.entries(rec).filter(([k, v]) => k !== SKIP_FIELD && v !== undefined);
          const cols = entries.map(([k]) => escId(k)).join(', ');
          const vals = entries.map(([, v]) => escVal(v, provider)).join(', ');
          const sql = 'INSERT OR REPLACE INTO ' + escId(tableName) + ' (' + cols + ') VALUES (' + vals + ')';
          try { db.prepare(sql).run(); created++; }
          catch (e) { errorDetails.push({ error: e?.message ?? String(e) }); }
        }
      });
      run(records);
      summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length });
      process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
    }
    db.close();
  } else if (p === 'postgresql' || p === 'postgres') {
    const { Client } = require('pg');
    const client = new Client({ connectionString: connectionUrl });
    await client.connect();
    try {
      for (const { tableName, idField, records } of tables) {
        let created = 0; const errorDetails = [];
        await client.query('BEGIN');
        try {
          for (const rec of records) {
            const entries = Object.entries(rec).filter(([k, v]) => k !== SKIP_FIELD && v !== undefined);
            const cols = entries.map(([k]) => escId(k)).join(', ');
            const vals = entries.map(([, v]) => escVal(v, provider)).join(', ');
            const up = entries.filter(([k]) => k !== idField).map(([k]) => escId(k) + ' = EXCLUDED.' + escId(k)).join(', ');
            const sql = 'INSERT INTO ' + escId(tableName) + ' (' + cols + ') VALUES (' + vals + ')' +
              (up.length ? ' ON CONFLICT (' + escId(idField) + ') DO UPDATE SET ' + up : ' ON CONFLICT DO NOTHING');
            try { await client.query(sql); created++; }
            catch (e) { errorDetails.push({ error: e?.message ?? String(e) }); }
          }
          await client.query('COMMIT');
        } catch (e) { await client.query('ROLLBACK'); errorDetails.push({ error: e?.message ?? String(e) }); }
        summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length });
        process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
      }
    } finally { await client.end(); }
  } else if (p === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection(connectionUrl);
    try {
      for (const { tableName, idField, records } of tables) {
        let created = 0; const errorDetails = [];
        for (const rec of records) {
          const entries = Object.entries(rec).filter(([k, v]) => k !== SKIP_FIELD && v !== undefined);
          const cols = entries.map(([k]) => escIdMy(k)).join(', ');
          const vals = entries.map(([, v]) => escVal(v, provider)).join(', ');
          const updates = entries.filter(([k]) => k !== idField).map(([k]) => escIdMy(k) + ' = VALUES(' + escIdMy(k) + ')').join(', ');
          const sql = 'INSERT INTO ' + escIdMy(tableName) + ' (' + cols + ') VALUES (' + vals + ')' +
            (updates.length ? ' ON DUPLICATE KEY UPDATE ' + updates : '');
          try { await conn.execute(sql); created++; }
          catch (e) { errorDetails.push({ error: e?.message ?? String(e) }); }
        }
        summaries.push({ name: tableName, created, updated: 0, errors: errorDetails.length });
        process.stdout.write(JSON.stringify({ type: 'progress', name: tableName, created, updated: 0, errors: errorDetails.length }) + '\\n');
      }
    } finally { await conn.end(); }
  } else {
    throw new Error('Unsupported provider: ' + provider);
  }

  process.stdout.write(JSON.stringify({ type: 'done', summaries }) + '\\n');
};

main().catch((e) => { process.stderr.write(String(e?.message ?? e)); process.exit(1); });
`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const projectName = getString(body.projectName);
  const connectionId = getString(body.connectionId);
  const snapshotId = getString(body.snapshotId);
  const syncVersion = getString(body.syncVersion);

  if (!projectName || !connectionId || !snapshotId || !syncVersion) {
    return Response.json({ success: false, error: "projectName, connectionId, snapshotId, and syncVersion are required." }, { status: 400 });
  }

  let stored: StoredConnection | null;
  try { stored = getConnection(connectionId); } catch {
    return Response.json({ success: false, error: "Could not read connection data." }, { status: 500 });
  }
  if (!stored) return Response.json({ success: false, error: "Connection not found." }, { status: 404 });

  // Load sync schema for FK-ordered insert
  let schemaPath: string;
  let schemaCleanupPath = "";
  let connectionUrl: string;
  try {
    const prepared = await prepareMigrationPrismaSchema(projectName, syncVersion);
    schemaPath = prepared.schemaPath;
    schemaCleanupPath = prepared.cleanupPath;
    connectionUrl = buildConnectionUrl(stored);
  } catch (err) {
    return Response.json({ success: false, error: err instanceof Error ? err.message : "Schema could not be prepared." }, { status: 404 });
  }

  // Load snapshot records from SQLite
  const snapshotRows = getSnapshotData(snapshotId);
  if (snapshotRows.length === 0) {
    return Response.json({ success: false, error: "Snapshot not found. Run Collect first." }, { status: 404 });
  }

  const snapshotsByTable = new Map<string, { tableName: string; idField: string; records: Record<string, unknown>[] }>();
  for (const row of snapshotRows) {
    const tableName = row.schemaTable ?? row.tableName;
    snapshotsByTable.set(tableName, { tableName, idField: "id", records: row.records });
  }

  const tables = [...snapshotsByTable.values()];
  const startedAt = new Date().toISOString();
  const ts = startedAt.replace(/[:.]/g, "-").slice(0, 19);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "phase", phase: "schema_push" });
        await execFileAsync(
          "pnpm",
          ["prisma", "db", "push", "--force-reset", "--schema", schemaPath, `--url=${connectionUrl}`],
          { cwd: path.join(/*turbopackIgnore: true*/ process.cwd()), env: { ...process.env, PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1" }, timeout: 120_000 },
        );

        send({ type: "phase", phase: "inserting", total: tables.length });

        const child = spawn(process.execPath, ["-e", buildRestoreScript()], {
          cwd: path.join(/*turbopackIgnore: true*/ process.cwd()),
          env: { ...process.env, DATABASE_URL: connectionUrl },
        });
        // Feed the payload over stdin (a pipe) instead of a temp file — no FS writes.
        child.stdin?.on("error", () => { /* ignore EPIPE if the child exits early */ });
        child.stdin?.write(JSON.stringify({ tables, provider: stored!.provider, connectionUrl }));
        child.stdin?.end();

        let stderrBuf = "";
        child.stderr?.on("data", (chunk: Buffer) => { stderrBuf += chunk.toString(); });
        const rl = createInterface({ input: child.stdout! });
        let tableSummaries: { name: string; created: number; updated: number; errors: number }[] = [];

        for await (const line of rl) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as { type: string; [k: string]: unknown };
            if (event.type === "progress") send(event);
            else if (event.type === "done") tableSummaries = event.summaries as typeof tableSummaries;
          } catch { /* non-JSON */ }
        }

        await new Promise<void>((resolve, reject) => {
          child.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error(stderrBuf.trim() || `Exit code ${code}`)),
          );
        });

        const totalErrors = tableSummaries.reduce((s, t) => s + t.errors, 0);
        const status = totalErrors === 0 ? "success" : "partial";
        const logContent = { status, type: "restore", startedAt, completedAt: new Date().toISOString(), project: projectName, connectionId, syncVersion, snapshotId, tables: tableSummaries };

        touchLastUsedAt(connectionId);

        const pidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
        if (pidRow) {
          // runLogPath now holds the migration_logs row id (DB), not a filesystem path.
          upsertMigrationSession({ projectId: pidRow.id, connectionId, fromVersion: syncVersion, toVersion: syncVersion, runStatus: status, runLogPath: ts, runTables: tableSummaries });
          insertMigrationLog({ id: ts, projectId: pidRow.id, connectionId, fromVersion: syncVersion, toVersion: syncVersion, status, content: logContent });
        }

        send({ type: "done", tables: tableSummaries, restoredVersion: syncVersion });

      } catch (err) {
        const msg = err instanceof Error ? err.message : "Restore failed.";
        const errContent = { status: "error", type: "restore", startedAt, failedAt: new Date().toISOString(), project: projectName, connectionId, syncVersion, snapshotId, error: msg };
        const errPidRow = appDb.prepare("SELECT id FROM projects WHERE name = ?").get(projectName) as { id: string } | undefined;
        if (errPidRow) {
          upsertMigrationSession({ projectId: errPidRow.id, connectionId, fromVersion: syncVersion, toVersion: syncVersion, runStatus: "failed", runError: msg });
          insertMigrationLog({ id: ts, projectId: errPidRow.id, connectionId, fromVersion: syncVersion, toVersion: syncVersion, status: "error", content: errContent });
        }
        send({ type: "error", error: msg });
      } finally {
        controller.close();
        await Promise.allSettled([
          schemaCleanupPath ? rm(schemaCleanupPath, { force: true, recursive: true }) : Promise.resolve(),
        ]);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}
