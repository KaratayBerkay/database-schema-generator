/**
 * Generate and insert random v1 data into a PostgreSQL database that already has
 * the v1 perfect-migration schema deployed.
 *
 * Usage:
 *   pnpm seed:db perfect-migration <postgres-url> [count]
 *
 *   count = number of Task rows to generate (default 500).
 *   All other tables scale proportionally from this number.
 *
 * Prerequisites:
 *   1. pnpm seed:workflows perfect-migration
 *   2. Open Migrations → connect to PostgreSQL → Destroy & Deploy Schema → v1.0111
 *   3. Run this seeder
 */

import { Client } from "pg";
import * as g from "../../../lib/scenarios/generators.js";

const dataset = process.argv[2];
const urlArg  = process.argv[3];
const count   = parseInt(process.argv[4] ?? "500", 10);

if (!dataset || !urlArg) {
  console.error("Usage: pnpm seed:db perfect-migration <postgres-url> [count]");
  process.exit(1);
}
if (dataset !== "perfect-migration") {
  console.error(`This file handles: perfect-migration (got "${dataset}")`);
  process.exit(1);
}
if (isNaN(count) || count < 1) {
  console.error("count must be a positive integer, e.g. 1000");
  process.exit(1);
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function insertAll(client: Client, table: string, rows: g.Row[]): Promise<void> {
  if (rows.length === 0) {
    console.log(`  - ${"  " + table}   0 rows`);
    return;
  }
  for (const row of rows) {
    const cols   = Object.keys(row);
    const vals   = Object.values(row);
    const colSql = cols.map((c) => `"${c}"`).join(", ");
    const phSql  = cols.map((_, idx) => `$${idx + 1}`).join(", ");
    await client.query(
      `INSERT INTO "${table}" (${colSql}) VALUES (${phSql}) ON CONFLICT DO NOTHING`,
      vals,
    );
  }
  console.log(`  ✓ ${table.padEnd(14)}  ${rows.length} rows`);
}

async function resetSeq(client: Client, table: string, col = "id"): Promise<void> {
  await client.query(
    `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'),
      COALESCE((SELECT MAX("${col}") FROM "${table}"), 0) + 1, false)`,
  );
}

async function schemaExists(client: Client): Promise<boolean> {
  const r = await client.query<{ count: string }>(
    `SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'Account'`,
  );
  return parseInt(r.rows[0]?.count ?? "0") > 0;
}

// ── scale ─────────────────────────────────────────────────────────────────────
// All sizes derived from `count` (= number of Tasks to generate).

function scale(n: number, min: number) { return Math.max(min, Math.floor(n)); }

async function main() {
  console.log(`\nConnecting to ${urlArg} …`);
  const client = new Client({ connectionString: urlArg });
  await client.connect();

  try {
    if (!(await schemaExists(client))) {
      console.error(`
  ✗ Schema not found in the database.

  Deploy the v1 schema first:
    1. Open the app → Migrations
    2. Connect to this PostgreSQL database
    3. Select "Destroy and Deploy Schema" → v1.0111 → confirm
    4. Re-run: pnpm seed:db perfect-migration <url> ${count}
`);
      process.exit(1);
    }

    const n = {
      accounts:     scale(count / 50,   5),
      teams:        scale(count / 100,  3),
      projects:     scale(count / 30,   3),
      sprints:      scale(count / 8,    4),
      teamMembers:  scale(count / 20,   5),
      comments:     scale(count * 0.40, 0),
      attachments:  scale(count * 0.08, 0),
      labels:       scale(count / 40,   3),
      taskLabels:   scale(count * 0.25, 0),
      notifications: scale(count * 0.30, 0),
      auditLogs:    scale(count * 0.60, 0),
      subscriptions: scale(count / 40,  4),
      invoices:     scale(count / 30,   4),
      invoiceItems: scale(count / 25,   5),
      products:     scale(count / 50,   4),
      articles:     scale(count / 40,   4),
      mediaAssets:  scale(count / 50,   3),
    };

    console.log(`\nGenerating ${count} tasks + proportional rows for all 22 tables…\n`);

    // Generate parent tables first, then children using their ID pools
    const accounts     = g.makeAccounts(n.accounts);
    const teams        = g.makeTeams(n.teams);
    const projects     = g.makeProjects(n.projects,     accounts.map((r) => r.id as number));
    const sprints      = g.makeSprints(n.sprints,       projects.map((r) => r.id as number));
    const profiles     = g.makeProfiles(               accounts.map((r) => r.id as number));
    const teamMembers  = g.makeTeamMembers(n.teamMembers, accounts.map((r) => r.id as number), teams.map((r) => r.id as number));
    const tasks        = g.makeTasks(count,             projects.map((r) => r.id as number), sprints.map((r) => r.id as number), accounts.map((r) => r.id as number));
    const comments     = g.makeComments(n.comments,    accounts.map((r) => r.id as number), tasks.map((r) => r.id as number));
    const attachments  = g.makeAttachments(n.attachments, tasks.map((r) => r.id as number), accounts.map((r) => r.id as number));
    const labels       = g.makeLabels(n.labels,         projects.map((r) => r.id as number));
    const taskLabels   = g.makeTaskLabels(n.taskLabels, tasks.map((r) => r.id as number), labels.map((r) => r.id as number));
    const notifications = g.makeNotifications(n.notifications, accounts.map((r) => r.id as number));
    const auditLogs    = g.makeAuditLogs(n.auditLogs,  accounts.map((r) => r.id as number));
    const subscriptions = g.makeSubscriptions(n.subscriptions, accounts.map((r) => r.id as number));
    const invoices     = g.makeInvoices(n.invoices,    accounts.map((r) => r.id as number), subscriptions.map((r) => r.id as number));
    const invoiceItems = g.makeInvoiceItems(n.invoiceItems, invoices.map((r) => r.id as number));
    const products     = g.makeProducts(n.products,    g.CATEGORIES.map((r) => r.id as number));
    const articles     = g.makeArticles(n.articles,    accounts.map((r) => r.id as number));
    const articleTags  = g.makeArticleTags(Math.floor(n.articles * 1.5), articles.map((r) => r.id as number), g.TAGS.map((r) => r.id as number));
    const mediaAssets  = g.makeMediaAssets(n.mediaAssets, accounts.map((r) => r.id as number));

    console.log("Inserting in FK-safe order…\n");

    // FK-safe insertion order — parents before children
    await insertAll(client, "Account",     accounts);
    await insertAll(client, "Team",        teams);
    await insertAll(client, "Category",    g.CATEGORIES);
    await insertAll(client, "Tag",         g.TAGS);
    await insertAll(client, "Profile",     profiles);
    await insertAll(client, "TeamMember",  teamMembers);
    await insertAll(client, "Project",     projects);
    await insertAll(client, "Sprint",      sprints);
    await insertAll(client, "Task",        tasks);
    await insertAll(client, "Comment",     comments);
    await insertAll(client, "Attachment",  attachments);
    await insertAll(client, "Label",       labels);
    await insertAll(client, "TaskLabel",   taskLabels);
    await insertAll(client, "Notification", notifications);
    await insertAll(client, "AuditLog",    auditLogs);
    await insertAll(client, "Subscription", subscriptions);
    await insertAll(client, "Invoice",     invoices);
    await insertAll(client, "InvoiceItem", invoiceItems);
    await insertAll(client, "Product",     products);
    await insertAll(client, "Article",     articles);
    await insertAll(client, "ArticleTag",  articleTags);
    await insertAll(client, "MediaAsset",  mediaAssets);

    console.log("\nResetting sequences…");
    for (const table of ["Account", "Team", "Category", "Tag", "Profile", "TeamMember", "Project", "Sprint", "Task", "Comment", "Attachment", "Label", "TaskLabel", "Notification", "AuditLog", "Subscription", "Invoice", "InvoiceItem", "Product", "Article", "ArticleTag", "MediaAsset"]) {
      await resetSeq(client, table);
    }

    const all = [accounts, teams, g.CATEGORIES, g.TAGS, profiles, teamMembers, projects, sprints, tasks, comments, attachments, labels, taskLabels, notifications, auditLogs, subscriptions, invoices, invoiceItems, products, articles, articleTags, mediaAssets];
    const total = all.reduce((sum, arr) => sum + arr.length, 0);

    console.log(`\n✓ Done — ${total.toLocaleString()} rows across 22 tables (${count} tasks).\n`);
    console.log("Next steps:");
    console.log("  Open Migrations → Sync & Migrate → From v1 → To v2 → Generate Diff\n");
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
