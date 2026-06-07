# Validate ↔ Run parity gaps (known issues)

The migration **gate** is `src/app/api/migrations/validate/route.ts`. The migration **executor** is
`src/app/api/migrations/run/route.ts` (it is what actually moves data). They should agree:
*validate passes ⟺ the run will execute the migration successfully*. Today validate **re-implements**
the run's type logic in parallel rather than reusing it, so the two drift and validate **over-reports**
(false-positive blocking errors). This file records the divergence and the recommended consolidation.

Surfaced 2026-06-07 by the `rule-torture` seed (8 errors on `product.price`, then 1 on
`geo_marker.ip_block`). Decision: **document now, refactor later** — the two narrow fixes below are
applied; the structural gaps remain open.

## Three parallel copies (the root cause)

| Concern | Run (source of truth) | Validate | Drift |
|---|---|---|---|
| Type → Zod builder | `prismaTypeToZodStrict` (run/route.ts ~634), coercing | `prismaTypeToZod` (validate/route.ts ~290) | Now identical after the fix below, but it is a **duplicated** function — nothing keeps them in sync. |
| "Is this conversion allowed?" | `resolveFieldMigration` + `src/solutions/type-conversion-matrix.ts` (run/route.ts ~609) | `checkTypeConversion` from `src/lib/migrations/rules.ts` — a **smaller, separate matrix** | If the two matrices disagree on any type pair, validate blocks what the run would migrate (or passes what it would fail). |
| Approved-warning → field match | resolver keyed by canonical field name | mixes **logical** name and physical **dbName** | Snake_case columns whose logical≠physical fail to match the approval. |

## Applied fixes (narrow)

1. **Numeric coercion** — `prismaTypeToZod`: `Decimal`/`Float` → `z.coerce.number()`, `BigInt` →
   `z.coerce.bigint()`, `Int` → `z.coerce.number().int()`. The pg/mysql drivers return
   `numeric`/`int8` as strings; strict `z.number()` rejected every Decimal value. Now matches the run.
2. **Approval lookup in `runUpgradeRules`** — match the approved-lossy entry by canonical
   `targetField.name` (lowercased), falling back to dbName. Fixed `geo_marker.ip_block` over-report.

## Open gaps (NOT fixed — documented per decision)

- **`runStage2` has the same snake_case key bug** as `runUpgradeRules` had. It strips approved-lossy
  fields via `trulyLossyFields.has(field.name.toLowerCase())` (validate/route.ts ~352), where
  `field.name` is the physical `dbName` but the set keys are logical names (from `entity_name`). It
  also filters the record with `skipSet` keyed on logical names (~364). `ip_block` slipped past only
  because its target was `String` and the value was `NULL`; **a snake_case `String→Int` (lossy_convert)
  field with a real value would still throw a false "expected number" here.** Same applies to
  `pkSkipFields` matching.
- **Compatibility source divergence.** Validate's `checkTypeConversion` (rules.ts) is a different
  matrix from the run's `solutions/type-conversion-matrix.ts`. Any pair they classify differently is a
  latent false positive/negative in the gate.

## Coverage matrix (validate vs run, current state)

`OK` = validate agrees with run. `GAP` = can diverge.

| changeKind / conversion | resolution | validate verdict | Notes |
|---|---|---|---|
| `table.removed` | data_deleted | OK | table dropped; rows not validated |
| `field.removed` | data_deleted | OK | field dropped before zod |
| `field.added` (required) | backfill_required | OK | made optional for zod (`isBackfill`) |
| `field.nullability` opt→req | backfill_required | OK | backfill marks optional |
| `field.default_changed` | backfill_required | OK | no per-row gate |
| `field.type_changed` numeric→numeric | precision_loss / compatible | OK (after fix) | coercing zod |
| `field.type_changed` Float/Decimal→Int | precision_loss | OK (camelCase) / **GAP** (snake_case) | stripped via `trulyLossyFields`, but key match is logical-only |
| `field.type_changed` String→Int/etc. (incompatible) | lossy_convert | OK (camelCase) / **GAP** (snake_case) | same key-match gap in `runStage2` |
| `field.type_changed` Unsupported→String | data_deleted | OK (after `runUpgradeRules` fix) | was the `ip_block` bug |
| `field.type_changed` String→Enum | (compatible, warning) | OK | kept in zod, value carries |
| `field.multiple` (rename+type) | lossy_convert | OK (camelCase) / **GAP** (snake_case) | rename map + strip; same key gap |
| `field.pk_type_changed` | data_deleted | OK | `pkSkip` strips PK field (key-match risk on snake_case) |
| relation FK cascade | (type_changed) | OK | `pkSkip` remap |
| `enum.removed` / `enum.value_removed` | data_deleted | partial | enum membership not re-checked per value here |
| `restriction.unique_added` | lossy_convert | OK | unique regenerated at run, not gated per-row |
| compatibility matrix mismatch | any | **GAP** | validate uses rules.ts, run uses solutions matrix |

## Recommended consolidation (for the later refactor)

Make validate a **dry-run of the run's resolver** instead of a parallel reimplementation:

1. Extract one shared `prismaTypeToZod` imported by both routes (delete the duplicate).
2. Drive validate's per-field verdict from the same `resolveFieldMigration` + `type-conversion-matrix`
   the run uses — block iff the run's resolver would hard-fail.
3. Key approved-warning lookups by **both** logical and physical names (joins against the version
   store), closing the snake_case class in `runStage2`, `runUpgradeRules`, and `pkSkip` at once.
4. Add a vitest iterating every `changeKind × resolution` and every matrix type-pair, asserting
   validate's verdict equals the run resolver's on a representative value — the guarantee for
   "a solution for every bit."
