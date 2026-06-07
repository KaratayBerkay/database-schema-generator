"use client";

import { classNames } from "@/lib/utils";
import type { ImportReport } from "@/types/imports";

type ImportCompatibilityReportProps = {
  report: ImportReport;
  provider: string;
  projectName: string;
  onProjectNameChange: (v: string) => void;
  isImporting: boolean;
  onImport: () => void;
  resultMessage: string;
  errorMessage: string;
};

/**
 * Shown before the user commits the import. The new project gets two versions: version-0 (the
 * schema exactly as imported — every table kept, no rules) and a rules-applied version. This lists
 * what the rules change between them, plus the new-project name input and the Create action.
 */
export function ImportCompatibilityReport({
  report, provider, projectName, onProjectNameChange, isImporting, onImport, resultMessage, errorMessage,
}: ImportCompatibilityReportProps) {
  const coerced = report.entries.filter((e) => e.level === "coerced");
  const skipped = report.entries.filter((e) => e.level === "skipped");
  const nameTooShort = projectName.trim().length > 0 && projectName.trim().length < 8;
  const canImport = projectName.trim().length >= 8 && report.modelsIncluded.length > 0 && !isImporting && !resultMessage;

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Database import</p>
        <h3 className="mt-1 text-base font-semibold text-slate-950">Two versions: original + rules applied</h3>
        <p className="mt-1 text-sm text-slate-600">
          The new project gets a version-0 holding the schema exactly as imported (every table kept, no rules), plus a rules-applied version. The changes our rules make between them are listed below — version-0 stays untouched as the fallback you can migrate data from.
        </p>
      </div>

      <div className="space-y-5 p-5">
        {/* Summary pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">{report.modelsIncluded.length} tables in rules version</span>
          {coerced.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{coerced.length} changed by rules</span>}
          {skipped.length > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-700">{skipped.length} dropped by rules</span>}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-slate-500">{provider}</span>
        </div>

        {report.modelsIncluded.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Tables in the rules-applied version</p>
            <div className="flex flex-wrap gap-1.5">
              {report.modelsIncluded.map((m) => (
                <span key={m} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600">{m}</span>
              ))}
            </div>
          </div>
        )}

        {coerced.length > 0 && (
          <EntryList title="Changed by our rules (in the rules-applied version)" tone="amber" entries={coerced} />
        )}
        {skipped.length > 0 && (
          <EntryList title="Dropped by our rules (still present in version-0)" tone="rose" entries={skipped} />
        )}

        {report.modelsIncluded.length === 0 ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
            Nothing importable — every table was skipped. Check the report above.
          </p>
        ) : (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">New project name</span>
              <input
                type="text"
                value={projectName}
                onChange={(e) => onProjectNameChange(e.target.value)}
                placeholder="At least 8 characters"
                className="h-10 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500"
              />
            </label>
            {nameTooShort && <p className="text-xs font-semibold text-amber-600">Project name must be at least 8 characters.</p>}
            {errorMessage && <p className="text-sm font-semibold text-rose-600">{errorMessage}</p>}
            {resultMessage && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{resultMessage}</p>
            )}
            <button
              type="button"
              onClick={onImport}
              disabled={!canImport}
              className={classNames(
                "rounded-md px-4 py-2 text-sm font-semibold text-white transition",
                canImport ? "bg-sky-600 hover:bg-sky-700" : "cursor-not-allowed bg-slate-300",
              )}
            >
              {isImporting ? "Importing…" : "Import as new project"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function EntryList({
  title, tone, entries,
}: {
  title: string;
  tone: "amber" | "rose";
  entries: ImportReport["entries"];
}) {
  const toneClass = tone === "amber"
    ? "border-amber-100 bg-amber-50/50"
    : "border-rose-100 bg-rose-50/50";
  const dot = tone === "amber" ? "bg-amber-400" : "bg-rose-400";

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <ul className={classNames("space-y-1 rounded-lg border p-3", toneClass)}>
        {entries.map((e, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-slate-700">
            <span className={classNames("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
            <span>
              <span className="font-mono text-xs font-semibold text-slate-900">
                {e.model}{e.field ? `.${e.field}` : ""}
              </span>{" "}
              — {e.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
