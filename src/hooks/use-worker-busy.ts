"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

const QUERY_KEY = ["worker-busy"] as const;

async function fetchBusy(): Promise<boolean> {
  const r = await fetch("/api/worker/busy");
  const d = (await r.json()) as { busy: boolean };
  return d.busy;
}

export function useWorkerBusy() {
  const queryClient = useQueryClient();

  const { data: busy = false } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchBusy,
    // Poll every 250ms while busy so buttons re-enable the moment work finishes.
    // When idle the query is not polled — no background traffic.
    refetchInterval: (query) => (query.state.data ? 250 : false),
    staleTime: 0,
  });

  async function acquire() {
    await fetch("/api/worker/busy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ busy: true }),
    });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  async function release() {
    await fetch("/api/worker/busy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ busy: false }),
    });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  return { busy, acquire, release };
}
