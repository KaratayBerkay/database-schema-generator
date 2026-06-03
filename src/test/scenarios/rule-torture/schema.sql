-- ─────────────────────────────────────────────────────────────────────────────
-- Rule-torture schema (PostgreSQL)
--
-- Every construct here intentionally violates one of the app's import rules, so we can
-- push it to a real database WITHOUT this application, then import it and verify:
--   • version-0  = the schema exactly as pulled (everything kept — the migration source)
--   • <date>     = rules applied (unrepresentable tables skipped, types coerced, etc.)
--
-- Push it (no app involved):
--   psql postgresql://dev:dev@localhost:54321/dev -c "DROP DATABASE IF EXISTS torture_test; CREATE DATABASE torture_test;"
--   psql postgresql://dev:dev@localhost:54321/torture_test -f src/test/scenarios/rule-torture/schema.sql
--
-- Then import in the app:  Imports → postgresql://dev:dev@localhost:54321/torture_test
-- ─────────────────────────────────────────────────────────────────────────────

-- ENUM — values that aren't valid identifiers (space, hyphen). Prisma @maps them; app keeps the enum.
CREATE TYPE order_status AS ENUM ('pending', 'in progress', 'cancelled-late', 'done');

-- ✅ VALID table — single-column PK, snake_case columns, a kept UNIQUE, FK target.
--    Tests: naming normalization (snake_case → camelCase logical, dbName preserved); kept unique.
CREATE TABLE app_user (
  id            serial PRIMARY KEY,
  full_name     text NOT NULL,
  email_address varchar(255) UNIQUE,
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- ✅ VALID table — rich but supported types (numeric→Decimal, jsonb→Json, bytea→Bytes, uuid→Uuid native).
CREATE TABLE product (
  id        serial PRIMARY KEY,
  public_id uuid DEFAULT gen_random_uuid(),
  sku       varchar(50) UNIQUE,
  price     numeric(10,2) NOT NULL,
  metadata  jsonb,
  thumbnail bytea,
  legacy_code char(10)          -- native @db.Char is OUTSIDE the allowlist → native dropped (both versions)
);

-- 🚫 UNSUPPORTED COLUMN TYPES → Prisma Unsupported(...). v0 keeps them raw; rules version coerces to String.
CREATE TABLE geo_marker (
  id       serial PRIMARY KEY,
  label    text,
  location point,
  coverage circle,
  search   tsvector,
  ip_block cidr
);

-- 🚫 BOOLEAN UNIQUE — a unique on a boolean column. Rules version drops that unique; text unique stays.
CREATE TABLE feature_flag (
  id        serial PRIMARY KEY,
  flag_key  text UNIQUE,
  is_global boolean UNIQUE
);

-- 🚫 NO PRIMARY KEY → Prisma @@ignore. v0 keeps the table; rules version skips it entirely.
CREATE TABLE events_log (
  action  text,
  payload jsonb,
  at      timestamptz DEFAULT now()
);

-- 🚫 COMPOSITE PRIMARY KEY (no single-column PK). v0 keeps it; rules version skips it entirely.
CREATE TABLE order_item (
  order_id   int NOT NULL,
  product_id int NOT NULL REFERENCES product(id),
  quantity   int NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id)
);

-- 🚫 RELATION TO A SKIPPED TABLE — composite FK to order_item (skipped). The user_id FK is valid.
--    v0 keeps both relations; rules version keeps app_user, prunes the order_item relation.
CREATE TABLE shipment (
  id         serial PRIMARY KEY,
  user_id    int REFERENCES app_user(id),
  order_id   int,
  product_id int,
  status     order_status DEFAULT 'pending',
  FOREIGN KEY (order_id, product_id) REFERENCES order_item(order_id, product_id)
);

-- 🚫 DUPLICATE UNIQUE — two unique constraints over the same column; plus a multi-col unique + an index.
--    Rules version drops the duplicate; keeps the composite unique and the index.
CREATE TABLE coupon (
  id     serial PRIMARY KEY,
  code   text,
  region text,
  CONSTRAINT coupon_code_key   UNIQUE (code),
  CONSTRAINT coupon_code_key2  UNIQUE (code),
  CONSTRAINT coupon_combo_key  UNIQUE (code, region)
);
CREATE INDEX coupon_region_idx ON coupon (region);
