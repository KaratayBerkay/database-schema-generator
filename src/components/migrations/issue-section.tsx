"use client";

import { cn } from "@/lib/utils";
import type { ValidationIssue } from "@/types/migrations";

export function IssueSection({ title, issues }: { title: string; issues: ValidationIssue[] }) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (issues.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
        {errors.length > 0 && (
          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            {errors.length} error{errors.length !== 1 ? "s" : ""}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
            {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-slate-100">
        {issues.map((issue, idx) => (
          <div key={idx} className="grid grid-cols-[160px_60px_1fr] items-start gap-3 px-4 py-2.5 text-xs hover:bg-background">
            <p className="truncate font-semibold text-foreground">
              {issue.model}.<span className="text-muted-foreground">{issue.field}</span>
            </p>
            <span className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
              issue.severity === "error" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300",
            )}>
              {issue.severity}
            </span>
            <div>
              <p className="text-foreground">{issue.issue}</p>
              {issue.suggestion && <p className="mt-0.5 italic text-muted-foreground">{issue.suggestion}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
