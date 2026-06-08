# Schema Studio — Database Schema Generator

A visual, workflow-driven tool for designing and evolving database schemas — without hand-editing `.prisma` files. Lay out your tables, fields, relations, and constraints through a UI, keep a full version history, generate validators and ORM code, and push the result to a real database when you're ready.

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](./LICENSE)
[![Open Collective](https://img.shields.io/opencollective/all/database-schema-generator?label=sponsors)](https://opencollective.com/database-schema-generator)

---

## What is it?

Designing a database by typing schema files is fiddly and error-prone: it's easy to mistype a relation, forget an index, or break older data when you change a column. Schema Studio turns that work into a set of guided **workflows**. You describe your data model visually, the app keeps everything in sync, and it warns you before a change would break existing rows.

Each workflow is a focused page that does one job — create tables, wire up relations, add constraints, validate, export, migrate, and so on. You move through them at your own pace, and your work is saved as a versioned history you can roll back to or branch from.

You don't need to know Prisma to use it, but everything it produces is standard, exportable Prisma (and Drizzle) — so you're never locked in.

### Key ideas

- **Projects & versions** — each project is one schema, with its own timeline of saved versions. You design the next version while the live one stays untouched.
- **The active project lives in the sidebar, not the URL** — switch projects from the dashboard; every workflow follows along.
- **Nothing is auto-populated** — empty schemas stay empty. No sample tables, no mock rows.
- **Change-aware** — when you edit a version, the app diffs it against the previous one and flags anything risky (dropped columns, removed relations, type changes) before you migrate.

---

## The Workflows

The sidebar is the map of the app. Here's what each stop does and when you'd use it.

### Designing your data model

#### 🗂 Projects
Your starting point. Create a new schema project, pick the database it targets (PostgreSQL, MySQL, or SQLite), and choose generator options. Switch between projects, rename them, or delete them here. Each project keeps an independent version history. Project names must be at least 8 characters and unique — they're used to derive file names and version labels.

#### 📋 Tables
Create and edit your tables (in Prisma terms, *models*). Every table gets a primary key, and you choose the key's style to match your database — auto-incrementing integer, UUID, CUID, and so on. This is usually the first thing you build after creating a project. Tables that changed since the previous version are badged so you can see what's new at a glance.

#### 🔢 Enums
Define enumerated types — a fixed set of allowed values, like `Role = ADMIN | EDITOR | VIEWER`. Once defined, an enum can be used as the type of any field. SQLite has no native enum support, so the app handles that case for you. Enum changes are tracked across versions like everything else.

#### 🧱 Schema (Fields & Templates)
The core of the tool: add and edit the **columns** on each table. For every field you set its type, default value, and whether it's optional (nullable) or unique. To avoid repeating yourself — `createdAt`, `updatedAt`, `id`, audit columns — you can save any field as a reusable **template** and drop it into other tables in one click. Fields removed since the last version are kept visible in a separate section so you can review what you took out.

#### 🔗 Relations
Wire your tables together. Schema Studio creates the foreign-key column for you, automatically derives the back-reference on the other table, and detects conflicts (like a foreign key whose type doesn't match the key it points to). Health indicators flag relations that aren't quite right, and a detail view explains type mismatches. Supports one-to-one, one-to-many, and many-to-many links.

#### 🚫 Restrictions
Add multi-column constraints visually — `@@unique` (a *combination* of columns must be unique, e.g. one membership per user per team) and `@@index` (speed up lookups on a set of columns). The page includes an inline guide explaining when to reach for each, and suggests a sensible constraint name based on the columns you pick.

#### 💬 Commentary
Attach documentation to your fields using `/// docstring` comments. These travel with the schema and feed downstream tooling (for example, GraphQL schema generation), so your data model stays self-describing without a separate wiki.

### Reviewing & checking

#### 🧬 Hierarchy
A dependency view of your schema. It topologically orders your tables by how they depend on one another (which table must exist before which), and lists the relation edges between them. Handy for understanding insert order, spotting overly tangled models, and planning seed data.

#### 📌 Tracking
Your change-control center. Whenever you edit a version, Tracking diffs it against the previous one and lists everything that changed — added, removed, renamed, or retyped tables, enums, fields, relations, and restrictions. Risky changes are graded by severity (**breaking**, **warning**, **info**), and you resolve each one by choosing a strategy (e.g. backfill with a static default, generate unique values, set null, or simply acknowledge it). Resolving here is what clears the path to a safe migration.

#### ✅ Validation
Generate typed [Zod](https://zod.dev) validators from your tables and fields. Pick a table, choose which fields to include, and the app produces ready-to-use validation schemas you can copy into your app — keeping your runtime input checks in lockstep with your database shape.

#### 🧮 SQL Query
A built-in SQL workspace. Spin up a real SQLite database from your schema, then write and run queries against it with a full editor (syntax highlighting, formatting, `⌘/Ctrl+Enter` to run). Helper buttons generate boilerplate `SELECT` / `INSERT` / `UPDATE` / `DELETE` statements from your tables, so you can prototype and sanity-check your design with real data.

### Shipping & moving data

#### 🚀 Migrations
Take your design to a real database. The workflow walks you through it: **collect** a snapshot of the live database, **compare** it against your target version, **validate** existing rows against the new shape (first structurally, then with the generated Zod schema), and **run** the migration to push the new schema and move the data across. Database credentials are encrypted at rest (AES-256-GCM), every run is logged, and the app blocks the migration until tracked breaking changes are resolved — so you don't lose data by surprise.

#### 📤 Exports
Generate code and backups from any version:
- **Prisma Schema** (`.prisma`) — the full schema: datasource, generator, models, relations, and constraints.
- **Drizzle TypeScript** (`.ts`) — a Drizzle ORM schema with table definitions, column types, FK references, and index helpers.
- **Version Pickle** (`.json`) — a complete backup of one version's schema graph.
- **Project Pickle** (`.json`) — a complete backup of every version in the project, in one file.

#### 📥 Imports
Bring schemas in. Upload an external `.prisma` file and sync it into a project, restore a **Version** or **Project Pickle** you exported earlier, or import a schema directly from a live database connection. The app previews what it found before you commit the import.

#### 🕘 History
The timeline for a project. Browse every saved version, see per-version stats (tables, fields, relations…), and switch the active version. Pairs naturally with Tracking — History tells you *which* versions exist; Tracking tells you *what changed* between them.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 19 |
| Styling | Tailwind CSS v4, shadcn/ui |
| API | tRPC v11 + TanStack Query v5 |
| Storage | SQLite via `better-sqlite3` + Drizzle ORM |
| Schema | `@mrleebo/prisma-ast`, Prisma CLI (dev) |
| Validation | Zod v4 |
| Icons | Tabler Icons |
| Package manager | pnpm |

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9
- Prisma CLI (`pnpm add -g prisma`)

## Setup

```bash
# 1. Clone
git clone https://github.com/karatay-lab/database-schema-generator.git
cd database-schema-generator

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — only needed if you use the Migrations workflow

# 4. Push the SQLite schema
pnpm db:push

# 5. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects you to **Tables** once you've created your first project.

## Environment Variables

See [`.env.example`](./.env.example) for all available variables.

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | No | PostgreSQL connection string for the Migrations workflow |
| `MYSQL_URL` | No | MySQL connection string for the Migrations workflow |

## How data is stored

Everything you create — projects, versions, models, fields, relations, restrictions, enums, field templates, generated validators, and the entire migrations history — lives in a single SQLite file, `src/database/app.db`. Prisma schema files are **not** kept on disk; they're rendered to a temporary location only when the Prisma CLI needs them, then deleted. The only other on-disk data is the real `.db` files created by the SQL Query workflow.

## Project Structure

```
src/
  app/
    (workflows)/      # Route pages — one import + one render each
    views/            # All page UI and logic, one folder per workflow
      shared/         # Dashboard shell, context, sidebar nav config
  trpc/               # tRPC routers and client setup
  lib/
    stores/           # Core schema engine (models, fields, relations, restrictions)
    schema-db/        # Normalized graph types
    schema-renderers/ # Prisma & Drizzle renderers
    migrations/       # Migration rules engine
    db/               # SQLite client + Drizzle table definitions
  database/
    app.db            # SQLite — the single source of truth for all app data
    databases/        # Real SQLite files created by the SQL Query workflow
```

## Scripts

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm lint         # ESLint check
pnpm db:push      # Push Drizzle schema to SQLite
pnpm db:studio    # Open Drizzle Studio
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for commit conventions, branch strategy, and PR guidelines.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Sponsorship

Schema Studio is sponsored via [Open Collective](https://opencollective.com/database-schema-generator). If this project saves you time, consider supporting its development.

## License

[MIT](./LICENSE) © 2026 Berkay Karatay / karatay-lab
