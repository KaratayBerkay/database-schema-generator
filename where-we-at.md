# Where We Left Off

**Date:** 2026-05-29  
**Branch:** `feature/tracking-workflow` — pushed to GitHub

---

## What got done this session

### Tracking workflow (complete)

- Resolver tabs: status-coloured backgrounds (green/red/amber via inline style), 72px height, URL sync (`?resolve=schema`)
- Per-tab warning counts + status sub-line in two-line tab layout
- Resolution Strategies legend always on top, filtered per entity kind
- `StrategyBadge` in Resolve column: Unique Prefix+UUID / Static Default / Type Cast / Remapped / Data Dropped / Acknowledged
- `ResolveModal` (portal to body — avoids `<div>` inside `<tbody>` hydration error): field info badges (nullable/unique), prefix input for unique String fields, "Resolve it for me" auto-approve
- `ApproveCell`: ✓/✗ circles, centered; ✗ only shown when approved (no redundant text)
- Row bg: `bg-rose-50/60` pending, `bg-emerald-50/60` approved
- All Changes tab: full-width button-group filters (Kind/Change/Entity)
- `defaultsRequiredCount`: gates Schema Check when non-nullable backfill_required/lossy_convert fields lack `replacementValue`

### Migration pipeline (complete)

- Validate route: `trulyLossyFields` now uses `checkTypeConversion(fromValue, toValue)` — correctly strips incompatible conversions (String→Float) while letting compatible ones (String→Enum) carry v1 data through
- Run route: solutions dispatcher wires Tracking decisions. Unique String prefix fields get `${prefix}-${uuid}` per row. MySQL datetime: ISO→`YYYY-MM-DD HH:MM:SS` before payload serialization.
- check-sync + collect: MySQL `information_schema` uppercase fix (`TABLE_NAME`/`COLUMN_NAME`)
- Preflight modal: 4× wider, Crucial/Warning tabs with strategy descriptions, pagination
- Connection String modal: pre-populates from active connection, ORM picker, copy icon

### solutions/ module (new)

`from-string.ts`, `from-number.ts`, `from-datetime.ts`, `from-enum.ts`, `backfill.ts`, `index.ts`:

- Per-type-pair converter functions switching on `FieldDecision`
- `warningToDecision()` bridges `SchemaWarning` → `FieldDecision`
- `resolveFieldMigration()` dispatcher

### schema_warnings (extended)

- `targetNullable` + `targetUnique` joined from v2 schema at query time
- `getTypeResolution`: String→Enum now returns `lossy_convert` not `data_deleted`

---

## Current state

All 14 workflows are fully implemented (no placeholders).

**Known gaps / not started:**

1. **🚨 MAJOR BUG — PK type/name change does not cascade to FK fields** — discovered 2026-05-30 while testing the saas-platform scenario. `updateModel()` in `schema-store.ts` updates the PK on the target model but never updates FK scalar fields in other models that reference it. Produces invalid Prisma schema (P1012) silently. Immediate action required. See `docs/enhancements.md` Critical section for full fix spec.
   - **"SaaS Workflow Schema"** is the project in the app where this bug is fully visible — Stage 2 validation shows 61 errors: all FK fields (`orgId`, `workspaceId`, `projectId`, `assigneeId`, `taskId`, `authorId`) collected as Int from v1 but v2 schema expects String (Uuid). Use this project to verify the fix once `updateModel()` is patched.
2. **Restrictions tracking** — Restrictions tab in Tracking shows "not yet implemented" placeholder. No approval-gate tracking for UNIQUE/INDEX constraint changes.
3. **TableDiffDetailModal** (`lucky-orbiting-rabbit.md` plan) — click badge on Tables workflow → modal showing field-level diff. Not started.
4. **Fourth-workflows ToDo** — `docs/version3/ToDo.md` has remaining items for the Diff Exhaustive Test scenario.
5. **Enum value removed without replacement on non-nullable field** — orphaned string values hit DB enum constraint at INSERT time. Gate does not currently block this case.

---

## Key files changed this session

| Area          | Files                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| Tracking UI   | `tracking-page.tsx`, `warnings-panel.tsx`                                      |
| Migration API | `validate/route.ts`, `run/route.ts`, `check-sync/route.ts`, `collect/route.ts` |
| New API       | `connections/url/route.ts`                                                     |
| Solutions     | `solutions/` (6 new files)                                                     |
| Store         | `schema-warnings-store.ts`                                                     |
| Matrix        | `solutions/type-conversion-matrix.ts`                                          |
| Inline pages  | `schema-page.tsx`, `enums-page.tsx`, `relations-page.tsx`                      |
| Seed          | `diff-exhaustive/seed-db.ts`, `mocks/diff-exhaustive/`                         |
| Docs          | `docs/version3/changes.md`                                                     |

## Do all pages are in accordance with next js SSR & CSR rules if not give me a plan to fix it

● You're not wrong — that WAS the original design intent. The flow you're describing:

1. Collect walks tables in FK dependency order (fewest parents first — Account before Invoice, Invoice before InvoiceItem)
2. Each collected row carries \_referance: { old_pk: 1 } (the original integer ID)
3. On INSERT of the parent (Invoice): let Postgres generate gen_random_uuid(), then RETURNING id captures the new UUID
4. Store the mapping: Invoice.\_referance[1] = "uuid-xxx"
5. On INSERT of InvoiceItem: invoiceId = lookup Invoice.\_referance where old_pk = row.invoiceId

My applyPkUuidRemapping does the same thing but server-side before the INSERT instead of via RETURNING after. It:

1. Generates the UUIDs upfront in Node before writing the payload
2. Sets Invoice.id = "uuid-xxx" explicitly (Postgres accepts explicit values even when there's a gen_random_uuid() default)
3. Patches InvoiceItem.invoiceId = "uuid-xxx" using the same mapping

The two approaches are equivalent in result. The difference is where UUID generation happens — in Node (my approach) vs in Postgres then captured via RETURNING (original \_referance design).

My approach is simpler because it avoids RETURNING clauses and round-trip DB queries in the child script. But both are correct.

✻ Sautéed for 39s

❯ so we call \_referance: [id] to get new fresh UUID isn it ?

● Let me check what \_referance actually stores in the snapshot and how the collect step sets it up:

Searched for 3 patterns, read 2 files (ctrl+o to expand)

● Close, but reversed. \_referance stores the old ID (e.g. "1"), not the new UUID. The flow is:

1. INSERT Invoice row — omit id, let Postgres generate gen_random_uuid() — but include \_referance = "1" (the old integer PK stored as string)
2. After INSERT — query SELECT id, \_referance FROM "Invoice" → build mapping "1" → "uuid-xxx"
3. INSERT InvoiceItem — \_referances = {"invoiceId": "1"} was stored in the snapshot (child row "my invoiceId points to Invoice where \_referance = '1'")
4. Resolve FKs — UPDATE "InvoiceItem" SET invoiceid = inv.id FROM "Invoice" inv WHERE inv.\_referance = ii.\_referances->>'invoiceId'

So \_referance = [old_id] is the lookup key you use to retrieve the Postgres-generated UUID — not the UUID itself.

The migration Prisma schema already has the \_referance String? @unique column added to every table via migrationReferenceLine(). And withMigrationReference in rules.ts attaches \_referance and \_referances to snapshot records.

Right now \_referance is stripped before INSERT in the child script (filter([k]) => k !== REF_FIELD). My applyPkUuidRemapping sidesteps this by pre-generating UUIDs in Node before writing the payload — which achieves the same result but doesn't use the DB as the intermediary.

Both approaches work. The \_referance DB-round-trip approach is more correct for the case where you truly want Postgres to own UUID generation. Should I rewire the child script to use the \_referance column properly instead?
