-- ─────────────────────────────────────────────────────────────────────────────
-- rule-torture seed data (PostgreSQL)
--
-- Populates ALL 8 tables of the rule-torture schema so the version-0 → rules-version
-- data migration has something real to carry — and something to LOSE. Row counts are
-- deliberately distinct per table (2,3,4,…,9) so the post-migration count check is
-- unambiguous: each surviving table's source count is unique.
--
-- What this seed proves once migrated 0 → rules version:
--   • SKIPPED tables (events_log=4 no-PK, order_item=8 composite-PK) → carry 0 (the
--     tables don't exist in the rules version).
--   • shipment → order_item relation is PRUNED, but the scalar order_id/product_id
--     columns survive, so shipment data still round-trips (user_id → app_user kept too).
--   • geo_marker rows round-trip; its unsupported columns (point/circle/tsvector/cidr)
--     become String in the rules version (resolution: data_deleted) — left NULL here so
--     the count-focused run stays clean (same choice as the more_torture `point`).
--   • feature_flag rows round-trip; the Boolean unique on is_global is dropped by the
--     rules but the rows are untouched. is_global must satisfy the v0 UNIQUE: at most one
--     TRUE, one FALSE, the rest NULL.
--   • customer_order-style @map enum members are exercised on shipment.status
--     (in_progress @map("in progress"), cancelled_late @map("cancelled-late")).
--
-- Apply (source DB only — never the migration target):
--   psql postgresql://dev:dev@localhost:54321/torture_test -f src/test/scenarios/rule-torture/seed.sql
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

TRUNCATE app_user, coupon, events_log, feature_flag, geo_marker,
         product, order_item, shipment RESTART IDENTITY CASCADE;

-- app_user: 2   (email_address varchar(255) UNIQUE; is_active boolean; created_at default)
INSERT INTO app_user (full_name, email_address, is_active)
SELECT 'User ' || i, 'user' || i || '@example.com', (i % 2 = 1)
FROM generate_series(1, 2) AS i;

-- coupon: 3   (code UNIQUE + duplicate UNIQUE(code) deduped on pull; UNIQUE(code, region); region INDEX)
INSERT INTO coupon (code, region)
SELECT 'SAVE' || i, (ARRAY['US', 'EU', 'APAC'])[((i - 1) % 3) + 1]
FROM generate_series(1, 3) AS i;

-- events_log: 4   [SKIPPED by rules — no PK → expect 0 in rules version]
INSERT INTO events_log (action, payload)
SELECT 'event-' || i, ('{"i":' || i || '}')::jsonb
FROM generate_series(1, 4) AS i;

-- feature_flag: 5   (flag_key UNIQUE; is_global boolean UNIQUE → dropped in rules; one TRUE, one FALSE, rest NULL)
INSERT INTO feature_flag (flag_key, is_global)
SELECT 'flag-' || i,
       CASE i WHEN 1 THEN TRUE WHEN 2 THEN FALSE ELSE NULL END
FROM generate_series(1, 5) AS i;

-- geo_marker: 6   (unsupported point/circle/tsvector/cidr left NULL → coerced to String in rules; label survives)
INSERT INTO geo_marker (label, location, coverage, search, ip_block)
SELECT 'marker-' || i, NULL, NULL, NULL, NULL
FROM generate_series(1, 6) AS i;

-- product: 7   (sku UNIQUE; price NOT NULL; public_id uuid default; metadata jsonb; legacy_code char(10) native dropped)
INSERT INTO product (sku, price, metadata, legacy_code)
SELECT 'SKU-' || i, (i * 9.99)::numeric(10, 2), ('{"sku":' || i || '}')::jsonb, 'L' || lpad(i::text, 4, '0')
FROM generate_series(1, 7) AS i;

-- order_item: 8   [SKIPPED by rules — composite PK → expect 0]   (product_id → product 1..7; order_id free int; pairs distinct)
INSERT INTO order_item (order_id, product_id, quantity)
SELECT i, ((i - 1) % 7) + 1, i FROM generate_series(1, 8) AS i;

-- shipment: 9   [KEPT — user_id → app_user kept; order_item relation PRUNED but order_id/product_id columns survive]
--   rows 1..8 reference real order_item composite keys (pruned relation WITH data);
--   row 9 carries only a user (order_id/product_id NULL). status cycles all 4 enum members incl. @map-ed ones.
INSERT INTO shipment (user_id, order_id, product_id, status)
SELECT ((i - 1) % 2) + 1,
       CASE WHEN i <= 8 THEN i ELSE NULL END,
       CASE WHEN i <= 8 THEN ((i - 1) % 7) + 1 ELSE NULL END,
       (ARRAY['pending', 'in progress', 'cancelled-late', 'done']::order_status[])[((i - 1) % 4) + 1]
FROM generate_series(1, 9) AS i;

COMMIT;
