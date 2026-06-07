-- ─────────────────────────────────────────────────────────────────────────────
-- more-rule-torture schema (PostgreSQL) — relation-heavy
--
-- 15 tables exercising deep relation chains, self-relations, circular relations, two kinds of
-- many-to-many join tables, and the relation rules: a relation whose target table is SKIPPED by
-- the rules (composite-PK / no-PK tables) must be PRUNED in the rules version but kept in version-0.
--
-- Push it (no app involved):
--   psql postgresql://dev:dev@localhost:54321/dev -c "DROP DATABASE IF EXISTS more_torture;" -c "CREATE DATABASE more_torture;"
--   psql postgresql://dev:dev@localhost:54321/more_torture -f src/test/scenarios/more-rule-torture/schema.sql
--
-- Then import:  Imports → postgresql://dev:dev@localhost:54321/more_torture
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE order_status AS ENUM ('pending', 'in transit', 'delivered', 'returned-late');

-- ── Depth chain:  country → city → address → app_user → organization → team  (5 hops) ──────────
CREATE TABLE country (
  id   serial PRIMARY KEY,
  code varchar(2) UNIQUE,
  name text NOT NULL
);

CREATE TABLE city (
  id         serial PRIMARY KEY,
  country_id int NOT NULL REFERENCES country(id),
  name       text NOT NULL
);

CREATE TABLE address (
  id         serial PRIMARY KEY,
  city_id    int NOT NULL REFERENCES city(id),
  street     text NOT NULL,
  geo        point,                       -- unsupported type → coerced in rules version
  created_by int                          -- circular FK → app_user, added via ALTER below
);

CREATE TABLE app_role (
  id   serial PRIMARY KEY,
  name text UNIQUE
);

CREATE TABLE app_user (
  id                 serial PRIMARY KEY,
  email              varchar(255) UNIQUE,            -- snake-ish unique (must survive in v0)
  full_name          text NOT NULL,
  primary_address_id int REFERENCES address(id),     -- app_user → address  (circular with address.created_by)
  manager_id         int REFERENCES app_user(id)     -- self-relation
);

-- circular: address.created_by → app_user  (added now that app_user exists)
ALTER TABLE address ADD CONSTRAINT address_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_user(id);

CREATE TABLE organization (
  id       serial PRIMARY KEY,
  owner_id int NOT NULL REFERENCES app_user(id),
  name     text NOT NULL
);

CREATE TABLE team (
  id              serial PRIMARY KEY,
  organization_id int NOT NULL REFERENCES organization(id),
  lead_id         int REFERENCES app_user(id),
  is_default      boolean UNIQUE,                     -- boolean unique → dropped in rules version
  name            text NOT NULL
);

-- ── m2m #1 — COMPOSITE-PK join table → SKIPPED by rules; its relations vanish with it ─────────
CREATE TABLE team_member (
  team_id int NOT NULL REFERENCES team(id),
  user_id int NOT NULL REFERENCES app_user(id),
  role    text,
  PRIMARY KEY (team_id, user_id)
);

-- ── m2m #2 — SURROGATE-PK join table → KEPT (single-column PK + composite unique) ─────────────
CREATE TABLE user_role (
  id      serial PRIMARY KEY,
  user_id int NOT NULL REFERENCES app_user(id),
  role_id int NOT NULL REFERENCES app_role(id),
  UNIQUE (user_id, role_id)
);

CREATE TABLE product (
  id    serial PRIMARY KEY,
  sku   varchar(50) UNIQUE,
  price numeric(10,2) NOT NULL
);

CREATE TABLE customer_order (
  id      serial PRIMARY KEY,
  user_id int NOT NULL REFERENCES app_user(id),
  status  order_status DEFAULT 'pending'
);

-- ── COMPOSITE-PK line table → SKIPPED; relations FROM it (to order/product) vanish ────────────
CREATE TABLE order_line (
  order_id   int NOT NULL REFERENCES customer_order(id),
  product_id int NOT NULL REFERENCES product(id),
  quantity   int NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE carrier (
  id   serial PRIMARY KEY,
  name text NOT NULL
);

-- ── shipment: a VALID relation (→ carrier) AND a relation TO a SKIPPED table (→ order_line) ───
--    Rules version keeps the carrier relation, PRUNES the order_line relation.
CREATE TABLE shipment (
  id         serial PRIMARY KEY,
  carrier_id int REFERENCES carrier(id),
  order_id   int,
  product_id int,
  FOREIGN KEY (order_id, product_id) REFERENCES order_line(order_id, product_id)
);

-- ── NO-PK table → SKIPPED entirely ───────────────────────────────────────────────────────────
CREATE TABLE audit_entry (
  action text,
  at     timestamptz DEFAULT now()
);
