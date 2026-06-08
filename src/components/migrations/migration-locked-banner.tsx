"use client";

import Link from "next/link";

/**
 * Shown above the version-migration steps when the selected from→to pair has already
 * been migrated (or a run is in progress). A transition can only be migrated once.
 */
export function MigrationLockedBanner({
  fromVersion,
  toVersion,
}: {
  fromVersion: string;
  toVersion: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 1a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4Zm2 6V5a2 2 0 1 0-4 0v2h4Z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-200">
            <span className="font-mono">{fromVersion}</span> → <span className="font-mono">{toVersion}</span> is locked
          </p>
          <p className="mt-0.5 text-xs font-medium text-amber-300">
            This migration has already been run on this connection (or is in progress). Each database can migrate a transition only once.
          </p>
        </div>
      </div>
      <Link
        href="/history"
        className="shrink-0 self-start rounded-md border border-amber-500/40 bg-card px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:border-amber-400 hover:bg-amber-500/20 sm:self-center"
      >
        View in History
      </Link>
    </div>
  );
}
