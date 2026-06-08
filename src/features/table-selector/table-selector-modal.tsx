"use client";

import { classNames } from "@/lib/utils";
import type { PrismaModel } from "@/lib/stores/schema-store";
import { useEscapeKey } from "@/hooks/use-escape-key";

type SelectorTone = "cyan" | "violet" | "amber" | "orange" | "fuchsia";

type TableSelectorModalProps = {
  isOpen: boolean;
  models: PrismaModel[];
  selectedModelName: string;
  search: string;
  isLoading: boolean;
  tone: SelectorTone;
  page?: number;
  pageSize?: number;
  onSearch: (value: string) => void;
  onSelect: (modelName: string) => void;
  onClose: () => void;
  onPageChange?: (page: number) => void;
  typeBadgeClass: (type: string) => string;
};

const toneClasses: Record<SelectorTone, {
  count: string;
  focus: string;
  selected: string;
  hover: string;
}> = {
  amber: {
    count: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    focus: "focus:border-amber-600",
    selected: "border-amber-400 bg-amber-500/15 shadow-sm",
    hover: "border-border bg-card hover:border-amber-500/40",
  },
  cyan: {
    count: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
    focus: "focus:border-cyan-600",
    selected: "border-cyan-400 bg-cyan-500/15 shadow-sm",
    hover: "border-border bg-card hover:border-cyan-500/40",
  },
  fuchsia: {
    count: "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-300",
    focus: "focus:border-fuchsia-500",
    selected: "border-fuchsia-400 bg-fuchsia-500/15 shadow-sm",
    hover: "border-border bg-card hover:border-fuchsia-500/40",
  },
  orange: {
    count: "border-orange-500/30 bg-orange-500/15 text-orange-300",
    focus: "focus:border-orange-500",
    selected: "border-orange-400 bg-orange-500/15 shadow-sm",
    hover: "border-border bg-card hover:border-orange-500/40",
  },
  violet: {
    count: "border-violet-500/30 bg-violet-500/15 text-violet-300",
    focus: "focus:border-violet-600",
    selected: "border-violet-400 bg-violet-500/15 shadow-sm",
    hover: "border-border bg-card hover:border-violet-500/40",
  },
};

export function TableSelectorModal({
  isOpen,
  models,
  selectedModelName,
  search,
  isLoading,
  tone,
  page = 1,
  pageSize,
  onSearch,
  onSelect,
  onClose,
  onPageChange,
  typeBadgeClass,
}: TableSelectorModalProps) {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;

  const styles = toneClasses[tone];
  const filteredModels = models.filter((model) =>
    model.name.toLowerCase().includes(search.toLowerCase()),
  );
  const totalPages = pageSize
    ? Math.max(1, Math.ceil(filteredModels.length / pageSize))
    : 1;
  const safePage = Math.min(page, totalPages);
  const visibleModels = pageSize
    ? filteredModels.slice((safePage - 1) * pageSize, safePage * pageSize)
    : filteredModels;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <div className="max-h-[94vh] w-[96vw] max-w-[1500px] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Table Selector
              </p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">Tables</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={classNames("rounded-md border px-3 py-1.5 text-xs font-semibold", styles.count)}>
                {models.length} tables
              </span>
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-background"
              >
                Close
              </button>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(event) => {
                onSearch(event.target.value);
                onPageChange?.(1);
              }}
              placeholder="Search tables..."
              autoFocus
              className={classNames(
                "h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground",
                styles.focus,
              )}
            />
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-sm font-medium text-muted-foreground">
                Loading...
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm font-medium text-muted-foreground">
                No tables found.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {visibleModels.map((model) => {
                    const isSelected = model.name === selectedModelName;

                    return (
                      <button
                        key={model.key}
                        type="button"
                        onClick={() => onSelect(model.name)}
                        className={classNames(
                          "flex min-h-16 items-center justify-between rounded-lg border p-4 text-left transition",
                          isSelected ? styles.selected : styles.hover,
                        )}
                      >
                        <span className="min-w-0 truncate font-semibold text-foreground">
                          {model.name}
                        </span>
                        <span
                          className={classNames(
                            "ml-3 inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium",
                            typeBadgeClass(model.pkType || "String"),
                          )}
                        >
                          {model.pkType || "String"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {pageSize && totalPages > 1 ? (
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => onPageChange?.(Math.max(1, safePage - 1))}
                      disabled={safePage === 1}
                      className="h-9 rounded-md border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-muted-foreground">
                      Page {safePage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => onPageChange?.(Math.min(totalPages, safePage + 1))}
                      disabled={safePage === totalPages}
                      className="h-9 rounded-md border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-background disabled:cursor-not-allowed disabled:bg-muted"
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
