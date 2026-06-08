"use client";

// ErrorBox is the monospace-CLI variant of InlineError.
// Kept here for backward compatibility with existing imports.
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-500/30 bg-rose-500/15 px-4 py-3">
      <p className="whitespace-pre-wrap font-mono text-xs text-rose-300">{message}</p>
    </div>
  );
}
