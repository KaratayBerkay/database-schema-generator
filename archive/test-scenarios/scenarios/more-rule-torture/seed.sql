-- ─────────────────────────────────────────────────────────────────────────────
-- more-rule-torture seed data (PostgreSQL)
--
-- Populates ALL 15 tables of the `more_torture` schema so the version-0 → 1.0603
-- data migration has something real to carry — and something to LOSE. Row counts are
-- deliberately distinct per table (2,3,4,…,16) so the post-migration count check is
-- unambiguous: each surviving table's source count is unique.
--
-- What this seed proves once migrated 0 → 1.0603:
--   • SKIPPED tables (team_member=9, order_line=13, audit_entry=16) → carry 0 (the
--     tables don't exist in 1.0603).
--   • shipment → order_line relation is PRUNED, but the scalar order_id/product_id
--     columns survive in 1.0603, so shipment data still round-trips (carrier kept too).
--   • Every other table round-trips its full row count.
--
-- Seeding choices (deliberate, documented):
--   • address.created_by and app_user.primary_address_id are left NULL. These form a
--     mutually-circular FK (address ↔ app_user). The migration run upserts table-by-table
--     with immediate (non-deferred) FK checks and does not break cycles, so populating
--     BOTH directions cannot insert in one pass. The circular relation still exists in
--     the schema and the columns round-trip (as NULL); only the data cycle is avoided.
--   • app_user.manager_id (self-relation) points every user at user #1, which is inserted
--     first within the same table — a safe, real self-referential value that round-trips.
--   • geo (point, an unsupported type coerced to String in 1.0603) is left NULL to keep
--     the relation-focused run clean.
--
-- Apply (source DB only — never the migration target):
--   psql postgresql://dev:dev@localhost:54321/more_torture -f src/test/scenarios/more-rule-torture/seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

TRUNCATE country, city, address, app_role, app_user, organization, team,
         team_member, user_role, product, customer_order, order_line,
         carrier, shipment, audit_entry RESTART IDENTITY CASCADE;

-- country: 2   (code is varchar(2) UNIQUE)
INSERT INTO country (code, name)
SELECT 'C' || i, 'Country ' || i FROM generate_series(1, 2) AS i;

-- city: 3   (country_id → country, cycles 1..2)
INSERT INTO city (country_id, name)
SELECT ((i - 1) % 2) + 1, 'City ' || i FROM generate_series(1, 3) AS i;

-- app_role: 4   (name UNIQUE)
INSERT INTO app_role (name)
SELECT 'role-' || i FROM generate_series(1, 4) AS i;

-- address: 5   (city_id → city; geo NULL; created_by NULL → breaks the address↔app_user cycle)
INSERT INTO address (city_id, street, geo, created_by)
SELECT ((i - 1) % 3) + 1, i || ' Main St', NULL, NULL FROM generate_series(1, 5) AS i;

-- app_user: 6   (email UNIQUE; primary_address_id NULL → breaks cycle; manager_id=1 self-ref for users 2..6)
INSERT INTO app_user (email, full_name, primary_address_id, manager_id)
SELECT 'user' || i || '@example.com', 'User ' || i, NULL,
       CASE WHEN i = 1 THEN NULL ELSE 1 END
FROM generate_series(1, 6) AS i;

-- organization: 7   (owner_id → app_user, cycles 1..6)
INSERT INTO organization (owner_id, name)
SELECT ((i - 1) % 6) + 1, 'Org ' || i FROM generate_series(1, 7) AS i;

-- team: 8   (organization_id → organization; lead_id → app_user; is_default UNIQUE → one TRUE, one FALSE, rest NULL)
INSERT INTO team (organization_id, lead_id, is_default, name)
SELECT ((i - 1) % 7) + 1, ((i - 1) % 6) + 1,
       CASE i WHEN 1 THEN TRUE WHEN 2 THEN FALSE ELSE NULL END,
       'Team ' || i
FROM generate_series(1, 8) AS i;

-- team_member: 9   [SKIPPED by rules → expect 0 in 1.0603]   (composite PK team_id,user_id — pairs distinct)
INSERT INTO team_member (team_id, user_id, role)
SELECT ((i - 1) % 8) + 1, ((i - 1) % 6) + 1, 'member-' || i FROM generate_series(1, 9) AS i;

-- user_role: 10   [KEPT — surrogate PK + composite UNIQUE]   (UNIQUE user_id,role_id — pairs distinct)
INSERT INTO user_role (user_id, role_id)
SELECT ((i - 1) % 6) + 1, ((i - 1) % 4) + 1 FROM generate_series(1, 10) AS i;

-- product: 11   (sku UNIQUE)
INSERT INTO product (sku, price)
SELECT 'SKU-' || i, (i * 10.5)::numeric(10, 2) FROM generate_series(1, 11) AS i;

-- customer_order: 12   (user_id → app_user; status order_status enum, all 4 members cycled)
--   Exercises the @map-ed enum members (in_transit @map("in transit"), returned_late @map("returned-late")).
--   The import now preserves enum-value @map, so these DB values round-trip through 0 → rules migration.
INSERT INTO customer_order (user_id, status)
SELECT ((i - 1) % 6) + 1,
       (ARRAY['pending', 'in transit', 'delivered', 'returned-late']::order_status[])[((i - 1) % 4) + 1]
FROM generate_series(1, 12) AS i;

-- order_line: 13   [SKIPPED by rules → expect 0]   (composite PK order_id,product_id — pairs distinct)
INSERT INTO order_line (order_id, product_id, quantity)
SELECT ((i - 1) % 12) + 1, ((i - 1) % 11) + 1, i FROM generate_series(1, 13) AS i;

-- carrier: 14
INSERT INTO carrier (name)
SELECT 'Carrier ' || i FROM generate_series(1, 14) AS i;

-- shipment: 15   [KEPT — carrier relation kept; order_line relation PRUNED but order_id/product_id columns survive]
--   rows 1..13 reference real order_line composite keys (pruned relation WITH data);
--   rows 14,15 carry only a carrier (order_id/product_id NULL).
INSERT INTO shipment (carrier_id, order_id, product_id)
SELECT ((i - 1) % 14) + 1,
       CASE WHEN i <= 13 THEN ((i - 1) % 12) + 1 ELSE NULL END,
       CASE WHEN i <= 13 THEN ((i - 1) % 11) + 1 ELSE NULL END
FROM generate_series(1, 15) AS i;

-- audit_entry: 16   [SKIPPED by rules — no PK → expect 0]
INSERT INTO audit_entry (action, at)
SELECT 'action-' || i, now() FROM generate_series(1, 16) AS i;

COMMIT;
