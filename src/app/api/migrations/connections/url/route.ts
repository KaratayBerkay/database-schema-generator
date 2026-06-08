import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db/migration-connections";

// POST (not GET): the response contains a plaintext connection string with the DB password. Keeping
// it out of the URL avoids leaking credentials into access logs, browser history, and Referer
// headers, and prevents a cross-origin page from triggering it via simple navigation.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { connectionId?: string };
  const connectionId = body.connectionId?.trim() ?? "";
  if (!connectionId) {
    return NextResponse.json({ success: false, error: "connectionId is required." }, { status: 400 });
  }

  const conn = getConnection(connectionId);
  if (!conn) {
    return NextResponse.json({ success: false, error: "Connection not found." }, { status: 404 });
  }

  const p = conn.provider.toLowerCase();
  const proto = p === "mysql" ? "mysql" : p === "sqlite" ? "file" : "postgresql";

  const url = p === "sqlite"
    ? conn.database
    : `${proto}://${encodeURIComponent(conn.user)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;

  return NextResponse.json({
    success: true,
    url,
    provider: conn.provider,
    name: conn.name,
  });
}
