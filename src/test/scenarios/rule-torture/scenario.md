# Rule-torture scenario

A PostgreSQL schema (`schema.sql`) where every construct deliberately violates one of the app's
import rules. Push it to a real database **without this application**, then import it to prove:

- **version-0** captures the schema *exactly* (every table, original types, all constraints) — the
  frozen migration source.
- **the rules version** (e.g. `1.0603`) applies the rules (skips unrepresentable tables, coerces
  unsupported types, drops Boolean uniques, prunes dangling relations).

## Run it

```bash
export PGPASSWORD=dev
psql postgresql://dev:dev@localhost:54321/dev -c "DROP DATABASE IF EXISTS torture_test;" -c "CREATE DATABASE torture_test;"
psql postgresql://dev:dev@localhost:54321/torture_test -f src/test/scenarios/rule-torture/schema.sql
```

Then in the app: **Imports → `postgresql://dev:dev@localhost:54321/torture_test`** → Connect & analyze → Import.

## What each construct tests

| Table / construct | Rule violated | version-0 | rules version |
|---|---|---|---|
| `events_log` (no PK) | single-column PK required | kept | **skipped** |
| `order_item` (composite PK) | single-column PK required | kept | **skipped** |
| `geo_marker` (`point`/`circle`/`tsvector`/`cidr`) | supported scalar/enum type | raw `Unsupported(...)` | **coerced → String** |
| `feature_flag.is_global` (`boolean UNIQUE`) | Boolean can't be unique | unique kept | **unique dropped** |
| `shipment` → `order_item` (composite FK) | relation target must exist | relation kept | **relation pruned** (target skipped) |
| `product.legacy_code` (`char(10)`) | native type allowlist | native dropped (both — canonical limit) | native dropped |
| `coupon` (duplicate UNIQUE) | no duplicate restriction | Prisma dedupes on pull | (deduped) |
| `app_user`, `product`, snake_case columns + enum `order_status` | naming / enum value identifiers | kept; physical `dbName` preserved | naming normalized (logical camelCase), `dbName` preserved |

## Expected result (the gate)

- version-0: **8 models** — `app_user, coupon, events_log, feature_flag, geo_marker, order_item, product, shipment`; `geo_marker.location` type = `Unsupported`; `feature_flag.is_global` and `app_user.email_address` uniques present.
- rules version: **6 models** (drops `events_log`, `order_item`); `geo_marker.location` = `String`; `feature_flag.is_global` unique dropped.

> This scenario surfaced a real bug: `storeFromPrisma` resolved `@unique` / `@@unique` / `@relation`
> field references against camelCased canonical names instead of the original Prisma names, so on a
> snake_case schema every field-level unique and relation field-mapping was silently dropped (even
> from version-0). Fixed by keying resolution off the Prisma field names. See `imports.test.ts`.
