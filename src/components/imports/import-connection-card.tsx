"use client";

type ImportConnectionCardProps = {
  url: string;
  onUrlChange: (v: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  analyzeError: string;
};

/**
 * Standalone entry point for importing a schema from a database. Takes a connection URL directly —
 * no active project and no saved connection required — because the import creates a *fresh* project
 * from whatever it pulls. The provider is detected from the URL scheme.
 */
export function ImportConnectionCard({ url, onUrlChange, onAnalyze, isAnalyzing, analyzeError }: ImportConnectionCardProps) {
  const canAnalyze = url.trim().length > 0 && !isAnalyzing;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Database Import</p>
        <h3 className="mt-1 text-base font-semibold text-slate-950">Import a schema from a database URL</h3>
        <p className="mt-1 text-sm text-slate-600">
          Paste a database connection URL. We pull its current schema and create a fresh project from it — no need to create a project first.
        </p>
      </div>

      <div className="space-y-3 p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">Connection URL</span>
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canAnalyze) onAnalyze(); }}
            placeholder="postgresql://user:pass@host:5432/db"
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500"
          />
        </label>

        {analyzeError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{analyzeError}</div>
        )}

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isAnalyzing ? "Reading schema…" : "Connect & analyze"}
        </button>
      </div>
    </section>
  );
}
