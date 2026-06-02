import { NextResponse } from "next/server";

// Module-level flag — persists across requests in the same Node.js process.
// Single-process dev server makes this safe; in production this would be Redis/DB.
let workerBusy = false;
let autoReset: ReturnType<typeof setTimeout> | null = null;

export async function GET() {
  return NextResponse.json({ busy: workerBusy });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { busy: boolean };

  if (autoReset) clearTimeout(autoReset);

  workerBusy = Boolean(body.busy);

  // Safety: auto-clear after 8s so a crashed client never permanently locks the UI
  if (workerBusy) {
    autoReset = setTimeout(() => { workerBusy = false; }, 8_000);
  }

  return NextResponse.json({ busy: workerBusy });
}
