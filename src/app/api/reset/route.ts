import { NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db/client";

const databaseDir = () => path.join(process.cwd(), "src/database");

export async function POST() {
  try {
    // Delete all projects — cascades to all schema tables, model_stores,
    // project_versions, migration_connections, migration_workflow_state, etc.
    db.prepare("DELETE FROM projects").run();

    // Also clear ui_state so the app doesn't try to restore a deleted project
    db.prepare("DELETE FROM ui_state").run();

    // SQL-Query creates real SQLite .db files on disk; clear that workspace.
    // Schemas, Zod validators, and migration logs all live in the DB now —
    // nothing else under src/database/ is written to clean up.
    await rm(path.join(databaseDir(), "databases"), { recursive: true, force: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
