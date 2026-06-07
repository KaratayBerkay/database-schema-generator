# Torture test guide — version-0 → rules version

A single, deterministic procedure for testing the two **rule-torture** fixtures end to end. It is
written to be followed by a human or an agent ("test bot"): every step has an exact command and an
exact expected result. The fixtures themselves live next to this file:

- `rule-torture/` — `schema.sql` + `seed.sql` + `scenario.md` (schema **and** data)
- `more-rule-torture/` — `schema.sql` + `seed.sql` + `scenario.md` (schema **and** data)

> Note on location: these scenarios live under `src/test/scenarios/`, not `src/lib/scenarios/`
> (`src/lib/scenarios/generators.ts` holds the *perfect-migration* row generators only). This guide
> sits with the fixtures it drives.

---

## 0. What "version-0 → rules version" means

The database-import flow (Imports → connection URL) introspects a live DB and creates **one new
project with two versions**:

| Version | What it is | Editable? |
|---|---|---|
| **version-0** (`"0"`) | The schema *exactly* as pulled — every table, original types, every constraint. The frozen migration **source**. | **No** — read-only everywhere (`writeModelStore` rejects edits; it is never the default/working version). |
| **rules version** (e.g. `1.0603`) | The same schema with the app's import rules applied. Shares stable IDs with version-0 so data collected against v0 can be pushed into it. | Yes |

The rules applied when generating the rules version from version-0:

1. **Skip** any table without a single-column primary key (no PK, or composite PK).
2. **Coerce** unsupported column types (`Unsupported(...)`) → `String`.
3. **Drop** a `UNIQUE` on a Boolean column.
4. **Prune** any relation whose target table was skipped (the scalar FK columns still survive).
5. Normalize naming (snake_case → camelCase logical names) while **preserving** the physical
   `dbName` / enum-value `@map`.

This guide verifies both versions of both fixtures against their gates, and (for more-rule-torture)
verifies that seeded rows round-trip on a 0 → rules data migration.

---

## 1. Prerequisites (once per session)

```bash
# 1. Bring up the dev Postgres (compose maps it to localhost:54321, user/pass/db = dev)
docker compose up -d postgres

# 2. Start the app
pnpm dev          # http://localhost:3000

export PGPASSWORD=dev
```

The dev connection base URL is `postgresql://dev:dev@localhost:54321/<database>`. Each fixture is
pushed into its **own** database (`torture_test`, `more_torture`) so it can never touch the
migration target.

---

## 2. Scenarios at a glance (the gates)

| | rule-torture | more-rule-torture |
|---|---|---|
| Database | `torture_test` | `more_torture` |
| version-0 models | **8** | **15** |
| rules-version models | **6** | **12** |
| Skipped (no/composite PK) | `events_log`, `order_item` | `team_member`, `order_line`, `audit_entry` |
| version-0 owning relations | — | **20** |
| rules-version owning relations | — | **15** (5 pruned) |
| Has seed data | yes (`seed.sql`) | yes (`seed.sql`) |

---

## 3. Procedure A — rule-torture (schema fidelity + data round-trip)

### A.1 Push schema, then seed (no app involved)

```bash
psql postgresql://dev:dev@localhost:54321/dev \
  -c "DROP DATABASE IF EXISTS torture_test;" -c "CREATE DATABASE torture_test;"
psql postgresql://dev:dev@localhost:54321/torture_test \
  -f src/test/scenarios/rule-torture/schema.sql
psql postgresql://dev:dev@localhost:54321/torture_test \
  -f src/test/scenarios/rule-torture/seed.sql
```

The seed puts a **distinct** row count in every table (2,3,…,9) so the post-migration count check
is unambiguous. (If `DROP DATABASE` reports the DB is in use, close any app connection to it first,
or just re-run the `seed.sql` — it `TRUNCATE … RESTART IDENTITY`s before inserting.)

### A.2 Import in the app

Imports → paste `postgresql://dev:dev@localhost:54321/torture_test` → **Connect & analyze** →
review the fidelity report → **Import**.

**Expected fidelity report** (shown before commit):
- `modelsSkipped`: `events_log`, `order_item`
- `modelsIncluded`: `app_user, coupon, feature_flag, geo_marker, product, shipment`
- coerced field: `geo_marker.location` (unsupported `point` → String) — plus `coverage`, `search`, `ip_block`
- coerced restriction: `feature_flag.is_global` (Boolean unique dropped)

### A.3 Verify version-0 gate (raw fidelity)

Open the project, select **version `0`**. It must capture the schema *exactly*:

- [ ] **8 models**: `app_user, coupon, events_log, feature_flag, geo_marker, order_item, product, shipment`
- [ ] `geo_marker.location` type = **`Unsupported`** (raw, not coerced)
- [ ] `feature_flag.is_global` **unique present**
- [ ] `app_user.email_address` **unique present** (snake_case unique must survive — see the regression note in `rule-torture/scenario.md`)
- [ ] version-0 is **read-only**: adding a field to version `0` is rejected; adding it to the rules version succeeds.

### A.4 Verify rules version gate (rules applied)

Select the **rules version** (e.g. `1.0603`):

- [ ] **6 models** — `events_log` and `order_item` dropped
- [ ] `geo_marker.location` type = **`String`**
- [ ] `feature_flag.is_global` **unique dropped**; `feature_flag.flag_key` (text) unique **kept**
- [ ] `shipment` → `app_user` relation **kept**; `shipment` → `order_item` relation **pruned** (target skipped); `order_id`/`product_id` scalar columns still present
- [ ] `coupon`: duplicate UNIQUE deduped; composite UNIQUE(code, region) + region INDEX kept
- [ ] enum `order_status` kept; physical `@map` values (`'in progress'`, `'cancelled-late'`) preserved

### A.5 Verify the 0 → rules data migration

Run the migration workflow: **collect** from `torture_test` against **version-0**, then **run** into
the rules version. Expected surviving row counts (each source count is unique):

| Table | Seeded | After 0 → rules | Why |
|---|---|---|---|
| `app_user` | 2 | **2** | kept (`email_address` unique kept) |
| `coupon` | 3 | **3** | kept |
| `events_log` | 4 | **0** | SKIPPED — no PK |
| `feature_flag` | 5 | **5** | kept (rows untouched; Boolean `is_global` unique dropped) |
| `geo_marker` | 6 | **6** | kept; unsupported cols coerced to String (values were NULL) |
| `product` | 7 | **7** | kept |
| `order_item` | 8 | **0** | SKIPPED — composite PK |
| `shipment` | 9 | **9** | KEPT — `user_id` relation kept; `order_item` relation pruned but `order_id`/`product_id` survive |

- [ ] `events_log` and `order_item` carry **0** rows (don't exist in the rules version).
- [ ] Every kept table round-trips its full seeded count.
- [ ] `shipment` round-trips 9 rows with `user_id` kept and `order_id`/`product_id` preserved as scalars (row 9 carries NULL for those by design).

---

## 4. Procedure B — more-rule-torture (schema + data round-trip)

### B.1 Push schema, then seed

```bash
psql postgresql://dev:dev@localhost:54321/dev \
  -c "DROP DATABASE IF EXISTS more_torture;" -c "CREATE DATABASE more_torture;"
psql postgresql://dev:dev@localhost:54321/more_torture \
  -f src/test/scenarios/more-rule-torture/schema.sql
psql postgresql://dev:dev@localhost:54321/more_torture \
  -f src/test/scenarios/more-rule-torture/seed.sql
```

The seed puts a **distinct** row count in every table (2,3,4,…,16) so the post-migration count
check is unambiguous.

### B.2 Import in the app

Imports → `postgresql://dev:dev@localhost:54321/more_torture` → Connect & analyze → Import.

### B.3 Verify version-0 gate

Select **version `0`**:

- [ ] **15 models** (incl. `team_member`, `order_line`, `audit_entry`)
- [ ] **20 owning relations**
- [ ] `shipment` relates to **both** `carrier` and `order_line`
- [ ] self-relation `app_user.manager_id → app_user` present
- [ ] circular pair present: `app_user.primary_address_id → address` **and** `address.created_by → app_user`
- [ ] version-0 is read-only

### B.4 Verify rules version gate

Select the **rules version**:

- [ ] **12 models** — drops `team_member`, `order_line`, `audit_entry`
- [ ] **15 owning relations** — 5 pruned: `shipment.orderLine`, `team.teamMember`, `app_user.teamMember`, `customer_order.orderLine`, `product.orderLine`
- [ ] `shipment` relates to `carrier` **only**
- [ ] `team.is_default` Boolean unique **dropped**
- [ ] enum `order_status` `@map` members survive (`in_transit @map("in transit")`, `returned_late @map("returned-late")`)

### B.5 Verify the 0 → rules data migration (the point of the seed)

Run the migration workflow: **collect** rows from `more_torture` against **version-0**, then **run**
into the rules version target. Expected surviving row counts (each source count is unique, so the
table is unambiguous):

| Table | Seeded | After 0 → rules | Why |
|---|---|---|---|
| `country` | 2 | **2** | kept |
| `city` | 3 | **3** | kept |
| `app_role` | 4 | **4** | kept |
| `address` | 5 | **5** | kept (geo/created_by NULL by design) |
| `app_user` | 6 | **6** | kept (manager_id self-ref → user #1; primary_address_id NULL) |
| `organization` | 7 | **7** | kept |
| `team` | 8 | **8** | kept (is_default unique dropped) |
| `team_member` | 9 | **0** | SKIPPED — composite PK, table absent in rules version |
| `user_role` | 10 | **10** | KEPT — surrogate PK + composite UNIQUE |
| `product` | 11 | **11** | kept |
| `customer_order` | 12 | **12** | kept; `@map`-ed enum members round-trip |
| `order_line` | 13 | **0** | SKIPPED — composite PK |
| `carrier` | 14 | **14** | kept |
| `shipment` | 15 | **15** | KEPT — carrier relation kept; order_line relation pruned but `order_id`/`product_id` survive |
| `audit_entry` | 16 | **0** | SKIPPED — no PK |

- [ ] The three skipped tables carry **0** rows (don't exist in the rules version).
- [ ] Every kept table round-trips its **full** seeded count.
- [ ] `shipment` data round-trips with `carrier_id` kept and `order_id`/`product_id` preserved as scalars (rows 14–15 carry NULL for those by design).

---

## 5. Automated path (no live DB) — `analyzeImportSchema`

The pure-analysis gate runs in vitest without Docker. It feeds an introspected `.prisma` to
`analyzeImportSchema` and the two-version creation to `imports.importFromDatabase`:

```bash
pnpm test src/test/vitest/imports.test.ts
```

Covered there: two-version creation, version-0 keeps the PK-less table + raw unsupported type, the
rules version drops the table / coerces the type / drops the Boolean unique, the snake_case-unique
regression, and the version-0 read-only guard. To assert against the torture schemas directly,
pass `rule-torture/schema.sql` through `prisma db pull` (or the `.prisma` it yields) into
`analyzeImportSchema` and check `report.modelsSkipped`, `report.modelsIncluded`, and the
`coerced`/`skipped` entries against §3–§4.

---

## 6. Pass/fail checklist

The run **passes** when, for both fixtures:

1. The fidelity report lists exactly the skipped models and coercions above.
2. version-0 matches its gate (raw types, all tables, all uniques/relations) and is **read-only**.
3. The rules version matches its gate (skipped tables gone, types coerced, Boolean uniques dropped, dangling relations pruned, `dbName`/`@map` preserved).
4. the 0 → rules migration produces the exact per-table row counts (rule-torture §A.5, more-rule-torture §B.5).

Any deviation is a regression — note which gate row failed and in which version.
