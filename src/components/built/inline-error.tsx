"use client";

import { cn } from "@/lib/utils";

/**
 * Renders a rose-tinted error message paragraph.
 * Returns null when message is falsy — safe to render unconditionally.
 *
 * For pre-formatted/monospace errors (e.g. CLI output) use `mono`.
 */
export function InlineError({
  message,
  mono,
  className,
}: {
  message?: string | null;
  mono?: boolean;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      className={cn(
        "rounded-md border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-300",
        mono && "whitespace-pre-wrap font-mono text-xs",
        className,
      )}
    >
      {message}
    </p>
  );
}
