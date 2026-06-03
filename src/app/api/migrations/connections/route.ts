import { NextResponse } from "next/server";
import { db as appDb } from "@/lib/db/client";
import { deleteConnection, listConnections } from "@/lib/db/migration-connections";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName")?.trim() ?? "";

  if (!projectName) {
    return NextResponse.json({ success: false, error: "Project name is required." }, { status: 400 });
  }

  const projectRow = appDb
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  if (!projectRow) {
    return NextResponse.json({ success: true, connections: [] });
  }

  try {
    const connections = listConnections(projectRow.id);
    return NextResponse.json({ success: true, connections });
  } catch {
    return NextResponse.json({ success: true, connections: [] });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectName = searchParams.get("projectName")?.trim() ?? "";
  const uuid = searchParams.get("uuid")?.trim() ?? "";

  if (!projectName || !uuid) {
    return NextResponse.json(
      { success: false, error: "Project name and connection UUID are required." },
      { status: 400 },
    );
  }

  deleteConnection(uuid);

  const projectRow = appDb
    .prepare("SELECT id FROM projects WHERE name = ?")
    .get(projectName) as { id: string } | undefined;
  const connections = projectRow ? listConnections(projectRow.id) : [];

  return NextResponse.json({ success: true, connections });
}
