# Archived dead code — 2026-06-02

Removed from the live tree during the `src/app/views` review (branch
`fix/migration-logic-fixes`). Everything here was **unreferenced** dead code; this
is a safety copy (git history also preserves it). Older entries use a `.txt` suffix so they
aren't type-checked. **As of 2026-06-07, `archive` is in `tsconfig` `exclude`** (and `eslint`
only lints `src`), so whole `.ts`/`.tsx` trees can now be archived as-is — kept runnable and
restorable without renaming — while the compiler, `pnpm lint`, and `pnpm build` ignore them.

## Contents

- **`workflow-page.tsx.txt`** — the generic `WorkflowPage` placeholder, formerly
  `src/app/views/shared/workflow-page.tsx`. Zero importers (`grep -rn WorkflowPage src`
  matched only its own file): every workflow now has a real view. It rendered
  hardcoded fake content (a fake field table, a fake Account/Customer/Invoice/Payment
  relation map, a fake review queue).

- **`dashboard-data.removed-constants.ts.txt`** — mock/sample-data constants
  (`tableSummaries`, `fieldRows`, `workflowSummaries`, `initialProjects`, and the
  `TableSummary` type) removed from `src/app/views/shared/dashboard-data.ts`. Only the
  deleted `WorkflowPage` consumed them — the last mock data in the app, against the
  "No mock data" project rule. (`MenuItem` / `menuItemsBase` / `computeMenuItems` were
  kept — the sidebar uses them.)

- **`projects-page-scroll-feature.ts.txt`** — an orphaned "version list scroll"
  affordance, unused delete-confirm helpers, and an unused `Controller` import,
  removed from `src/app/views/projects/projects-page.tsx` and
  `src/hooks/use-projects-page-state.ts`. The scroll machinery (`versionScroll`,
  `versionListRef`, `setVersionListNode`, `updateVersionScrollControls`) was never
  wired to any DOM element.

## 2026-06-07 — scenario test harness (`test-scenarios/`)

The end-to-end **scenario** harness, retired after scenario testing wrapped. Moved verbatim
from `src/test/` with its internal layout preserved, so relative imports still resolve and it
stays runnable in place:

- **`test-scenarios/scenarios/`** — the 8 scenarios (`blog-platform`, `saas-platform`,
  `shop-mysql`, `diff-exhaustive`, `perfect-migration`, `rule-torture`, `more-rule-torture`)
  plus `torture-test-guide.md`.
- **`test-scenarios/mocks/`** — per-scenario mock row data consumed by each `seed-db.ts`.
- **`test-scenarios/run.ts`, `test-scenarios/seed-db.ts`** — the dispatchers formerly driven
  by the `pnpm seed:workflows` / `pnpm seed:db` scripts (both scripts removed from
  `package.json` since their targets are archived).

The Vitest **unit** suites stay live in `src/test/vitest/` (`pnpm test`). To run an archived
scenario again: `npx tsx archive/test-scenarios/run.ts <scenario>` (schema build) and
`npx tsx archive/test-scenarios/seed-db.ts <scenario> <url>` (data seed).

## Restore

Copy the relevant block back into its original file and drop the `.txt` suffix, or
`git revert` the removal commit(s). For directory moves (e.g. `test-scenarios/`),
`git mv` the tree back under `src/test/` and restore the `package.json` scripts.
