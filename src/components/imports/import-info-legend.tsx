"use client";

import { classNames } from "@/lib/utils";

// Legend-style info card for the database import (mirrors the Schema field legend). Shows the
// accepted connection-URL formats and what an import produces, so the input only needs one example.
const items: { label: string; desc: string; mono?: boolean }[] = [
  { label: "PostgreSQL", desc: "postgresql://user:pass@host:5432/db", mono: true },
  { label: "MySQL", desc: "mysql://user:pass@host:3306/db", mono: true },
  { label: "SQLite", desc: "file:/path/to/app.db", mono: true },
  { label: "Version-0", desc: "The schema exactly as imported — no rules, every table kept. Your fallback." },
  { label: "Rules version", desc: "Our rules applied (types coerced, unsupported dropped). The working schema." },
  { label: "Read-only", desc: "Only the schema is read — no rows touched; the URL is used once, never stored." },
];

export function ImportInfoLegend() {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-cyan-100 bg-cyan-50/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(({ label, desc, mono }) => (
        <div key={label}>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-700">{label}</p>
          <p className={classNames("mt-0.5 text-[11px] leading-relaxed text-slate-600", mono && "font-mono")}>{desc}</p>
        </div>
      ))}
    </div>
  );
}
