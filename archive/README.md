# Archived dead code — 2026-06-02

Removed from the live tree during the `src/app/views` review (branch
`fix/migration-logic-fixes`). Everything here was **unreferenced** dead code; this
is a safety copy (git history also preserves it). Files use a `.txt` suffix so the
TypeScript compiler — whose `tsconfig` `include` is `**/*.ts` / `**/*.tsx` — does
not type-check them.

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

## Restore

Copy the relevant block back into its original file and drop the `.txt` suffix, or
`git revert` the removal commit(s).
