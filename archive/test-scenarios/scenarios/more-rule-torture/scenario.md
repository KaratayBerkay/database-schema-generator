# more-rule-torture scenario (relation-heavy)

15 tables that exercise **relations** hard: a 5-hop chain, a self-relation, a circular relation, two
kinds of many-to-many join tables, and the key relation rule — **a relation whose target table the
rules skip must be pruned** in the rules version but kept in version-0.

## Run it

```bash
export PGPASSWORD=dev
psql postgresql://dev:dev@localhost:54321/dev -c "DROP DATABASE IF EXISTS more_torture;" -c "CREATE DATABASE more_torture;"
psql postgresql://dev:dev@localhost:54321/more_torture -f src/test/scenarios/more-rule-torture/schema.sql
```

Then in the app: **Imports → `postgresql://dev:dev@localhost:54321/more_torture`**.

## Relations exercised

- **Depth chain (5 hops):** `country → city → address → app_user → organization → team`.
- **Self-relation:** `app_user.manager_id → app_user`.
- **Circular:** `app_user.primary_address_id → address` and `address.created_by → app_user`.
- **m2m (composite PK)** `team_member(team_id, user_id)` → **skipped** by rules; its relations vanish.
- **m2m (surrogate PK)** `user_role(id, …, UNIQUE(user_id, role_id))` → **kept**.
- **Relation to a skipped table:** `shipment → order_line` (composite-PK, skipped) is **pruned**, while
  `shipment → carrier` (valid) is **kept** — so a surviving table loses only the dangling relation.
- **No-PK** `audit_entry` → skipped.

## Expected result (the gate — verified)

- **version-0:** 15 models, **20 owning relations**; includes `team_member`, `order_line`,
  `audit_entry`; `shipment` relates to both `carrier` and `order_line`; self-relation present.
- **rules version:** 12 models (drops `team_member`, `order_line`, `audit_entry`), **15 owning
  relations** (5 pruned: `shipment.orderLine`, `team.teamMember`, `app_user.teamMember`,
  `customer_order.orderLine`, `product.orderLine`); `shipment` relates to `carrier` only.

## Note on relation rules that a real DB can't violate

The database itself enforces FK type compatibility and that targets are unique/PK, so the app's
"FK type must match" / "target must exist" rules can't be broken by an introspected schema — the only
relation rule reachable from a real DB is **relation-to-a-skipped-table → pruned**, which this
scenario covers thoroughly (composite-PK join tables, composite-PK line tables, no-PK tables).
