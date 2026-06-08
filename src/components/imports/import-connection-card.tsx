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
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Database Import</p>
        <h3 className="mt-1 text-base font-semibold text-foreground">Import a schema from a database URL</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste a database connection URL. We pull its current schema and create a fresh project from it — no need to create a project first.
        </p>
      </div>

      <div className="space-y-3 p-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Connection URL</span>
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canAnalyze) onAnalyze(); }}
            placeholder="postgresql://user:pass@host:5432/db"
            className="h-10 w-full rounded-md border border-border bg-card px-3 font-mono text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-sky-500"
          />
        </label>

        {analyzeError && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-300">{analyzeError}</div>
        )}

        <button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-muted"
        >
          {isAnalyzing ? "Reading schema…" : "Connect & analyze"}
        </button>
      </div>
    </section>
  );
}
