import "server-only";
import { db } from "./client";
import {
  decrypt,
  encrypt,
  generateSecret,
  isWrappedKey,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/migrations/migration-crypto";
import type { ConnectionRecord, StoredConnection } from "@/types/migrations";

type ConnectionRow = {
  id: string;
  project_id: string;
  name_enc: string;
  provider_enc: string;
  host_enc: string;
  port_enc: string;
  database_enc: string;
  user_enc: string;
  password_enc: string;
  secret: string;
  created_at: string;
  last_used_at: string;
};

/**
 * Recover a row's data key. The `secret` column holds the data key *wrapped* by the master key
 * (which lives outside app.db). Rows written before envelope encryption stored the data key as bare
 * hex; those are unwrapped transparently and re-wrapped in place on first read, so the on-disk DB
 * stops containing a usable decryption key.
 */
function dataKeyForRow(row: ConnectionRow): string {
  if (isWrappedKey(row.secret)) return unwrapDataKey(row.secret);
  const dataKey = row.secret;
  db.prepare("UPDATE migration_connections SET secret = ? WHERE id = ?").run(
    wrapDataKey(dataKey),
    row.id,
  );
  return dataKey;
}

function rowToRecord(row: ConnectionRow): ConnectionRecord {
  const key = dataKeyForRow(row);
  return {
    uuid: row.id,
    name: decrypt(row.name_enc, key),
    provider: decrypt(row.provider_enc, key),
    host: decrypt(row.host_enc, key),
    port: decrypt(row.port_enc, key),
    database: decrypt(row.database_enc, key),
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function rowToStored(row: ConnectionRow): StoredConnection {
  const key = dataKeyForRow(row);
  return {
    ...rowToRecord(row),
    user: decrypt(row.user_enc, key),
    password: decrypt(row.password_enc, key),
  };
}

export function listConnections(projectId: string): ConnectionRecord[] {
  const rows = db
    .prepare("SELECT * FROM migration_connections WHERE project_id = ? ORDER BY last_used_at DESC")
    .all(projectId) as ConnectionRow[];
  return rows.map(rowToRecord);
}

export function getConnection(id: string): StoredConnection | null {
  const row = db
    .prepare("SELECT * FROM migration_connections WHERE id = ?")
    .get(id) as ConnectionRow | undefined;
  if (!row) return null;
  try {
    return rowToStored(row);
  } catch {
    return null;
  }
}

/** Candidate connection being added, compared against the project's existing connections. */
export type NewConnectionInput = {
  name: string;
  provider: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

/** Why a candidate connection is a duplicate, plus the name of the connection it collides with. */
export type ConnectionConflict = { reason: "name" | "credentials"; existingName: string };

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

function normaliseProvider(provider: string): string {
  const lc = provider.trim().toLowerCase();
  return lc === "postgres" ? "postgresql" : lc;
}

function sameCredentials(a: NewConnectionInput, b: StoredConnection): boolean {
  return (
    normaliseProvider(a.provider) === normaliseProvider(b.provider) &&
    a.host === b.host &&
    a.port === b.port &&
    a.user === b.user &&
    a.password === b.password &&
    a.database === b.database
  );
}

/**
 * Find an existing connection in the same project that collides with the candidate — either by name
 * (case-insensitive) or by an identical credential set (provider/host/port/user/password/database).
 * Names and credentials are encrypted per-row with a unique secret, so duplicates can't be found with
 * a SQL constraint; we decrypt and compare. Returns null when the candidate is unique.
 */
export function findConnectionConflict(
  projectId: string,
  candidate: NewConnectionInput,
): ConnectionConflict | null {
  const rows = db
    .prepare("SELECT * FROM migration_connections WHERE project_id = ?")
    .all(projectId) as ConnectionRow[];

  const existing = rows
    .map((row) => {
      try {
        return rowToStored(row);
      } catch {
        return null;
      }
    })
    .filter((conn): conn is StoredConnection => conn !== null);

  const byName = existing.find((conn) => normaliseName(conn.name) === normaliseName(candidate.name));
  if (byName) return { reason: "name", existingName: byName.name };

  const byCreds = existing.find((conn) => sameCredentials(candidate, conn));
  if (byCreds) return { reason: "credentials", existingName: byCreds.name };

  return null;
}

export function saveConnection(
  projectId: string,
  conn: {
    id: string;
    name: string;
    provider: string;
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  },
): void {
  // Encrypt the fields with a fresh per-row data key, then store only the master-key-wrapped data
  // key — never the data key itself — so the app.db file alone can't decrypt the credentials.
  const dataKey = generateSecret();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO migration_connections
      (id, project_id, name_enc, provider_enc, host_enc, port_enc, database_enc,
       user_enc, password_enc, secret, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    conn.id,
    projectId,
    encrypt(conn.name, dataKey),
    encrypt(conn.provider, dataKey),
    encrypt(conn.host, dataKey),
    encrypt(conn.port, dataKey),
    encrypt(conn.database, dataKey),
    encrypt(conn.user, dataKey),
    encrypt(conn.password, dataKey),
    wrapDataKey(dataKey),
    now,
    now,
  );
}

export function deleteConnection(id: string): void {
  db.prepare("DELETE FROM migration_connections WHERE id = ?").run(id);
}

export function touchLastUsedAt(id: string): void {
  db.prepare("UPDATE migration_connections SET last_used_at = ? WHERE id = ?")
    .run(new Date().toISOString(), id);
}
