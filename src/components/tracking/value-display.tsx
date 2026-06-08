"use client";

export function ValueDisplay({ text }: { text: string }) {
  if (text === "—") return <span className="text-muted-foreground">—</span>;
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {text}
    </code>
  );
}
