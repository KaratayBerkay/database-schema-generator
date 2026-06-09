# Changelog

All notable changes to Schema Studio are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [0.4.0] — 2026-06-09

A large release: since 0.3.0 the app grew into a complete, self-contained schema studio — the full workflow set, a SQLite-backed data layer, a data-safe migration pipeline, multi-target exports, and a Docker setup.

### Added
- **Scenarios** workflow — load ready-made demo projects (basic / advanced blueprints) with load-once + reload and a "Manage in Projects" shortcut
- **Tracking** workflow — change-control center with tabbed warning management (Tables, Enums, Schema, Relations, Restrictions), severity grading, per-change resolution strategies, and approve-all / unapprove-all; migrations are gated until breaking changes are resolved
- **Enums** workflow — enum types across the schema, enum-value diffs in Tracking, and a replacement-value picker for removed values
- **Hierarchy** workflow — dependency ordering of tables plus the relation edges between them
- **Commentary** workflow — `///` field docstrings that travel with the schema
- **Validation** — generate typed Zod validators per table/field
- **SQL Query** — in-app SQLite workspace with a CodeMirror editor and statement helpers
- **Migrations** — full collect → compare → validate → run pipeline with DB-backed run logs and History accordions, per-connection migration lock, connection-first layout, schema import from a live database URL, enum-value remapping during collection, and AES-256-GCM-encrypted credentials
- **Exports** — added SQLAlchemy, Django, and plain SQL DDL targets alongside Prisma, Drizzle, and version/project pickles
- **Docker** — containerized app (Node 24) with an app-only compose, a separate database compose (PostgreSQL + MySQL with persistence + healthchecks), and bind-mounted data kept in sync with local development
- Dark-purple theme pass across all workflows; modals close on Escape; landing goes straight to the dashboard
- Vitest test suite covering the diff / migration scenarios

### Changed
- Storage moved fully to SQLite via `better-sqlite3` with a normalized schema graph — canonical models, schema entities, generated validators, and the entire migrations workflow live in `app.db`; Prisma schema files are rendered on demand only
- Centralized all client data access in `src/queries/` (tRPC + TanStack Query); extracted shared UI primitives to `src/components/built/`; decomposed large views into hooks + sub-components per project conventions
- Standardized the toolchain on **Node 24** (LTS) across local dev, the Dockerfile, `.nvmrc`, and `engines`

### Fixed
- Closed a class of migration data-loss bugs: enum `@map` handling, SAVEPOINT usage, relation reconstruction, insert ordering, Decimal validation, and JSON/JSONB + bytea value escaping in the run / restore paths
- Eliminated a fresh-database `next build` race ("duplicate column name") by completing the single-pass schema bootstrap (`schema_warnings.replacement_value`, `zod_schemas.field_hash`)

---

## [0.3.0] — 2026-05-19

### Added
- **Field templates modal** — converted from full-screen takeover to a proper `96vh` modal with dimmed backdrop and click-outside-to-close
- **Provider column on field templates** — templates are tagged by database provider (`Postgres`, `MySQL`, `SQLite`, `All`); modal filter defaults to "Relevant" (current project provider + universal)
- **Inline add / edit rows in templates table** — replaced the separate Add Template side panel with an inline row at the top of the table; editing a template transforms that row in-place
- **Type → default value mapping** — selecting a field type auto-fills the Default input: `Int`/`BigInt`/`Float`/`Decimal` → `0`, `Boolean` → `false`, `DateTime` → `now()`, `Timestamp` → `dbgenerated("now()")` (provider-aware); `String`/`Json`/`Bytes` clears the input
- **Quick-apply template dropdown** — `+ New Field` is now a split button; the `▼` half opens a searchable dropdown showing only unused, provider-relevant templates for one-click apply
- **Color-coded type dropdowns** — field type selects are tinted by type (green for String, blue for Int, amber for Boolean, orange for DateTime, etc.) across field cards and template rows
- **Field legend panel** — collapsible `?` panel below the field filter row explains every input and button (Name, Type, Default, Comment, Nullable, Required, Unique, Multiple, Save, Delete); open by default
- **Pagination icons** — replaced `<` / `>` text arrows with `IconChevronLeft` / `IconChevronRight` throughout

### Changed
- "Dupes" label renamed to "Multiple" on the unique constraint toggle
- Default value input placeholder changed from `now()` to `Default value`
- Templates table add row moved to top (above data rows) for faster access

### Fixed
- Nullable / Unique toggle buttons in add and edit rows now align with column headers

---

## [0.2.0] — 2026-05-19

### Added
- **Relations workflow overhaul** — Create Relation modal redesigned with inline FK column creation; no more round-trip to the Schema page
- Back-reference name auto-derived as `{sourceModel}{RelationPascal}` (e.g. `usersPerson` on `people`)
- Target table replaced with searchable, paginated card grid in the modal
- FK conflict detection against all scalar fields and existing relation FKs with distinct error messages
- Back-reference name conflict detection across relations to the same target
- Relation card health indicator: amber border + `FK missing` badge when a FK column no longer exists on the table
- `SetNull` cascade option disabled when FK is Required; cleared automatically on switch to Required
- On Delete / On Update redesigned as 4-option card rows; `No Action` pre-selected as explicit default
- `?table=` URL param persistence on relations, schema, restrictions, and commentary pages
- `WorkflowSkeleton` Suspense fallback (shadcn Skeleton + animate-pulse) on all four pages
- Scroll-to-card when closing the edit modal

### Changed
- Relation field name normalised to camelCase on blur; back-reference derived silently (no manual input)
- `safeRelationPage` computed inline to eliminate one-render flash on tab switch

### Removed
- Redundant relation count badge in the card list header (counts already shown in tabs)
- Ambiguous `Default` option from On Delete / On Update — replaced by explicit `No Action`

---

## [0.1.0] — 2026-05-18

### Added
- Initial release
- Projects, Tables, Schema (field templates + Zod generation), Relations, Restrictions, Validation, Imports, Migrations workflows
- REST API migrated to tRPC v11 + TanStack Query v5
- shadcn/ui component library integrated (Sidebar, Button, Badge, Dialog, Form, Table, Skeleton, Sonner, and more)
- Hierarchy workflow with dependency graph and model ordering rules
- SQLite storage via `better-sqlite3` + Drizzle ORM
- Prisma schema AST generation via `@mrleebo/prisma-ast`
- AES-256-GCM encryption for stored database connection credentials
- Multi-provider support: PostgreSQL, MySQL, SQLite

[Unreleased]: https://github.com/karatay-lab/database-schema-generator/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/karatay-lab/database-schema-generator/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/karatay-lab/database-schema-generator/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/karatay-lab/database-schema-generator/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/karatay-lab/database-schema-generator/releases/tag/v0.1.0
