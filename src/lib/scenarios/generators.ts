// Row generators for the perfect-migration scenario.
// All keys use exact lowercase column names — Prisma creates unquoted columns
// in PostgreSQL so everything folds to lowercase.
//
// Usage: import * as g from "@/lib/scenarios/generators"
//        const tasks = g.makeTasks(1000, projectIds, sprintIds, accountIds)

import { SCENARIO_CATEGORIES, SCENARIO_TAGS } from "@/constants/scenarios";

export type Row = Record<string, unknown>;

// Re-export the fixed lookup tables so callers only need one import
export const CATEGORIES: Row[] = SCENARIO_CATEGORIES;
export const TAGS:       Row[] = SCENARIO_TAGS;

// ── random helpers ────────────────────────────────────────────────────────────

export function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number, dec = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

export function randomDate(from: Date, to: Date): Date {
  return new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));
}

// Returns null with nullProb probability; otherwise returns value.
export function maybe<T>(value: T, nullProb = 0.4): T | null {
  return Math.random() < nullProb ? null : value;
}

// ── shared constants ──────────────────────────────────────────────────────────

const RANGE_START = new Date("2023-06-01");
const RANGE_END   = new Date("2025-03-01");

const FIRST_NAMES = ["Alice", "Bob", "Carol", "Dan", "Eve", "Frank", "Grace", "Hiro", "Ivan", "Julia", "Karl", "Luna", "Max", "Nina", "Oscar", "Petra", "Quinn", "Rosa", "Sam", "Tara"] as const;
const DOMAINS     = ["acme.io", "corp.dev", "techco.com", "venture.io", "startup.run"] as const;
const TECH_WORDS  = ["api", "sdk", "ui", "web", "app", "dev", "ops", "sys", "db", "net"] as const;
const TECH_AREAS  = ["full-stack", "backend", "frontend", "data", "cloud", "mobile", "infra", "platform"] as const;

// ── account ───────────────────────────────────────────────────────────────────

export function makeAccounts(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id   = i + 1;
    const name = randomFrom(FIRST_NAMES).toLowerCase();
    return {
      id,
      email: `${name}${id}@${randomFrom(DOMAINS)}`,
      username:     `${name}_${randomFrom(TECH_WORDS)}_${id}`, // String — lossy_convert to Int in v2
      role:         randomFrom(["VIEWER", "VIEWER", "EDITOR", "EDITOR", "MANAGER", "ADMIN", "OWNER"] as const),
      passwordhash: `$2b$12$placeholder_${id}`,
      isverified:   Math.random() < 0.65,                       // mix → backfill_required when default removed in v2
      plan:         randomFrom(["free", "pro", "pro", "enterprise"] as const), // deleted in v2 → data_deleted
      credits:      randomFloat(0.01, 9999.99, 2),              // Float w/ decimals → precision_loss when cast Int in v2
      createdat:    randomDate(RANGE_START, RANGE_END),
    };
  });
}

// ── team ──────────────────────────────────────────────────────────────────────

const TEAM_ADJS  = ["Alpha", "Beta", "Core", "Delta", "Edge", "Forge", "Grid", "Hub", "Iron", "Jet", "Kilo", "Lima", "Meta", "Nova", "Omega", "Peak", "Quantum", "Rapid", "Sigma", "Titan"] as const;
const TEAM_NOUNS = ["Squad", "Guild", "Crew", "Team", "Force", "Unit", "Group", "Circle", "Cluster", "Division"] as const;

export function makeTeams(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id   = i + 1;
    const adj  = TEAM_ADJS[i % TEAM_ADJS.length]!;
    const noun = TEAM_NOUNS[i % TEAM_NOUNS.length]!;
    return {
      id,
      name: `${adj} ${noun}`,
      slug: `${adj.toLowerCase()}-${noun.toLowerCase()}-${id}`,
      description: maybe(`Handles ${randomFrom(["frontend", "backend", "infra", "data", "security", "mobile"] as const)} work`),
      maxmembers:  randomBetween(3, 20),
      createdat:   randomDate(RANGE_START, RANGE_END),
    };
  });
}

// ── profile (1-per-account; Profile.accountid carries a unique index) ─────────

const BIO_TEMPLATES = [
  "Software engineer specialising in %s development",
  "Building %s systems at scale",
  "Passionate about %s and clean architecture",
  "Open-source contributor, %s enthusiast",
  "%s lead with 5+ years of experience",
  null, null, null, // ~37% null — backfill_required in v2 when bio made required
] as const;

const LOCATIONS = ["Berlin", "London", "New York", "Tokyo", "Singapore", "Sydney", "Toronto", "Paris", "Amsterdam", null, null] as const;

export function makeProfiles(accountIds: number[]): Row[] {
  return accountIds.map((accountid, i) => {
    const tmpl = randomFrom(BIO_TEMPLATES);
    return {
      id:          i + 1,
      displayname: `${randomFrom(FIRST_NAMES)} ${String.fromCharCode(65 + (i % 26))}.`,
      bio:         tmpl ? tmpl.replace("%s", randomFrom(TECH_AREAS)) : null,
      avatarurl:   maybe(`https://cdn.acme.io/avatars/${accountid}.webp`, 0.5),
      location:    randomFrom(LOCATIONS),
      score:       randomBetween(0, 9999),
      birthdate:   maybe(randomDate(new Date("1970-01-01"), new Date("2000-01-01")), 0.6),
      accountid,
    };
  });
}

// ── teammember (unique accountid+teamid) ──────────────────────────────────────

export function makeTeamMembers(count: number, accountIds: number[], teamIds: number[]): Row[] {
  const seen  = new Set<string>();
  const rows: Row[] = [];
  let id = 1;
  const limit = Math.min(count, accountIds.length * teamIds.length);
  let attempts = 0;
  while (rows.length < limit && attempts < limit * 10) {
    attempts++;
    const accountid = randomFrom(accountIds);
    const teamid    = randomFrom(teamIds);
    const key = `${accountid}-${teamid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: id++,
      role:     randomFrom(["VIEWER", "VIEWER", "EDITOR", "EDITOR", "MANAGER", "ADMIN"] as const),
      joinedat: randomDate(RANGE_START, RANGE_END),
      accountid,
      teamid,
    });
  }
  return rows;
}

// ── project ───────────────────────────────────────────────────────────────────

const PROJECT_VERBS    = ["Rebuild", "Migrate", "Launch", "Upgrade", "Redesign", "Optimize", "Automate", "Scale", "Secure", "Deploy"] as const;
const PROJECT_SUBJECTS = ["API", "Dashboard", "Auth Service", "Payment Flow", "CMS", "Analytics", "Notification System", "Search Engine", "Storage Layer", "CI Pipeline"] as const;

export function makeProjects(count: number, ownerIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    return {
      id,
      name:        `${randomFrom(PROJECT_VERBS)} ${randomFrom(PROJECT_SUBJECTS)} ${id}`,
      status:      randomFrom(["ACTIVE", "ACTIVE", "ACTIVE", "PLANNING", "ON_HOLD", "ARCHIVED"] as const),
      priority:    randomFrom(["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL"] as const), // LOW+MEDIUM removed in v2
      description: maybe(`Project ${id}: scope definition here`),
      createdat:   randomDate(RANGE_START, RANGE_END),
      ownerid:     randomFrom(ownerIds),
    };
  });
}

// ── sprint ────────────────────────────────────────────────────────────────────

const SPRINT_GOAL_TMPLS = [
  "Ship MVP features for %s",
  "Fix all critical bugs in %s",
  "Complete performance audit of %s",
  "Launch v2 of %s",
  "Migrate %s to new infra",
  null, null, // ~29% null — backfill_required in v3 when goal made required
] as const;
const SPRINT_AREAS = ["auth", "payments", "dashboard", "API", "storage", "search", "notifications"] as const;

export function makeSprints(count: number, projectIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id        = i + 1;
    const tmpl      = randomFrom(SPRINT_GOAL_TMPLS);
    const startdate = randomDate(RANGE_START, new Date("2024-12-01"));
    const enddate   = new Date(startdate.getTime() + randomBetween(7, 21) * 86_400_000);
    return {
      id,
      name:      `Sprint ${id}`,
      goal:      tmpl ? tmpl.replace("%s", randomFrom(SPRINT_AREAS)) : null,
      startdate,
      enddate,
      projectid: randomFrom(projectIds),
    };
  });
}

// ── task ──────────────────────────────────────────────────────────────────────

const TASK_VERBS    = ["Implement", "Fix", "Refactor", "Add", "Remove", "Update", "Test", "Document", "Review", "Deploy", "Migrate", "Optimize", "Debug", "Create", "Investigate"] as const;
const TASK_SUBJECTS = ["login flow", "API endpoint", "database schema", "UI component", "test suite", "deployment script", "cache layer", "error handler", "webhook", "auth middleware", "rate limiter", "notification service", "search index", "export function", "import parser"] as const;

// Weighted — CANCELLED (~9%) retained; removed in v2 → data_deleted warning
const TASK_STATUSES   = ["BACKLOG", "BACKLOG", "TODO", "TODO", "IN_PROGRESS", "IN_PROGRESS", "IN_REVIEW", "DONE", "DONE", "DONE", "CANCELLED"] as const;
// Weighted — LOW + MEDIUM included; both removed in v2 → data_deleted warnings
const TASK_PRIORITIES = ["LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "HIGH", "CRITICAL"] as const;

export function makeTasks(
  count: number,
  projectIds: number[],
  sprintIds: number[],
  accountIds: number[],
): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    return {
      id,
      title:       `${randomFrom(TASK_VERBS)} ${randomFrom(TASK_SUBJECTS)}`,
      description: maybe(`Task ${id}: detailed requirements`, 0.45),
      status:      randomFrom(TASK_STATUSES),
      priority:    randomFrom(TASK_PRIORITIES),
      duedate:     maybe(randomDate(new Date("2024-01-01"), new Date("2025-12-01")), 0.45),
      storypoints: maybe(randomBetween(1, 21), 0.45),            // ~45% null → backfill_required in v2
      threadref:   maybe(`T-${String(id).padStart(5, "0")}`, 0.5), // String → lossy_convert to Int in v2
      projectid:   randomFrom(projectIds),
      sprintid:    maybe(randomFrom(sprintIds), 0.3),
      assigneeid:  maybe(randomFrom(accountIds), 0.35),
    };
  });
}

// ── comment ───────────────────────────────────────────────────────────────────

const COMMENT_BODIES = [
  "LGTM, approving this.", "Needs more unit tests before merging.",
  "Can we simplify this implementation?", "Good work! A few nits below.",
  "This might break the existing integration.", "Blocked on the downstream API team.",
  "Fixed in follow-up PR.", "Duplicate — closing.", "Ship it!",
  "Performance numbers look good.", "Not sure about this approach — let's discuss.",
  "Ready for review.",
] as const;

export function makeComments(count: number, accountIds: number[], taskIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id:        i + 1,
    body:      randomFrom(COMMENT_BODIES),
    createdat: randomDate(RANGE_START, RANGE_END),
    authorid:  randomFrom(accountIds),
    taskid:    maybe(randomFrom(taskIds), 0.1), // mostly linked; relation deleted in v2
  }));
}

// ── attachment ────────────────────────────────────────────────────────────────

const ATTACH_FILES: [string, string][] = [
  ["design.figma", "application/figma"], ["spec.yaml", "application/yaml"],
  ["report.pdf",   "application/pdf"],   ["shot.png",  "image/png"],
  ["data.csv",     "text/csv"],          ["archive.zip", "application/zip"],
];

export function makeAttachments(count: number, taskIds: number[], uploaderIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    const [ext, mime] = randomFrom(ATTACH_FILES)!;
    return {
      id,
      filename:   `file-${id}.${ext}`,
      url:        `https://cdn.acme.io/files/${id}.${ext}`,
      size:       randomBetween(1_024, 52_428_800),
      mimetype:   mime,
      uploadedat: randomDate(RANGE_START, RANGE_END),
      taskid:     randomFrom(taskIds),
      uploaderid: randomFrom(uploaderIds),
    };
  });
}

// ── label ─────────────────────────────────────────────────────────────────────

const LABEL_BASES  = ["bug", "feature", "chore", "blocked", "needs-design", "needs-review", "infra", "security", "performance", "refactor", "breaking", "wontfix"] as const;
const LABEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#0ea5e9"] as const;

export function makeLabels(count: number, projectIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id:        i + 1,
    name:      `${LABEL_BASES[i % LABEL_BASES.length]}-${Math.floor(i / LABEL_BASES.length) + 1}`,
    color:     randomFrom(LABEL_COLORS),
    projectid: randomFrom(projectIds),
  }));
}

// ── tasklabel (unique taskid+labelid) ─────────────────────────────────────────

export function makeTaskLabels(count: number, taskIds: number[], labelIds: number[]): Row[] {
  const seen = new Set<string>();
  const rows: Row[] = [];
  let id = 1;
  const limit = Math.min(count, taskIds.length * labelIds.length);
  let attempts = 0;
  while (rows.length < limit && attempts < limit * 10) {
    attempts++;
    const taskid  = randomFrom(taskIds);
    const labelid = randomFrom(labelIds);
    const key = `${taskid}-${labelid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: id++, taskid, labelid });
  }
  return rows;
}

// ── notification ──────────────────────────────────────────────────────────────

const NOTIF_TYPES = ["task_assigned", "comment_added", "task_completed", "sprint_started", "deadline_approaching", "mention", "pr_reviewed"] as const;
const NOTIF_MSGS: Record<string, string> = {
  task_assigned:        "You were assigned a new task",
  comment_added:        "Someone commented on your task",
  task_completed:       "A task you follow was completed",
  sprint_started:       "A sprint you are part of has started",
  deadline_approaching: "A deadline is approaching",
  mention:              "You were mentioned in a comment",
  pr_reviewed:          "Your pull request was reviewed",
};

export function makeNotifications(count: number, recipientIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const type = randomFrom(NOTIF_TYPES);
    return {
      id:          i + 1,
      type,
      message:     NOTIF_MSGS[type]!,
      isread:      Math.random() < 0.4,
      createdat:   randomDate(RANGE_START, RANGE_END),
      recipientid: randomFrom(recipientIds),
    };
  });
}

// ── auditlog (entire table deleted in v2 → data_deleted warning) ─────────────

const AUDIT_ACTIONS      = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "IMPORT"] as const;
const AUDIT_ENTITY_TYPES = ["Task", "Project", "Sprint", "User", "Comment", "Invoice", "Product"] as const;

export function makeAuditLogs(count: number, actorIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id         = i + 1;
    const action     = randomFrom(AUDIT_ACTIONS);
    const entitytype = randomFrom(AUDIT_ENTITY_TYPES);
    return {
      id,
      action,
      entitytype,
      entityid:    String(randomBetween(1, 9999)),
      metadata:    maybe(`{"op":"${action}","entity":"${entitytype}","ref":${randomBetween(1, 9999)}}`),
      performedat: randomDate(RANGE_START, RANGE_END),
      actorid:     randomFrom(actorIds),
    };
  });
}

// ── subscription ──────────────────────────────────────────────────────────────

// All three BillingCycle values; enum deleted in v2, field retyped to String first
const BILLING_CYCLES = ["MONTHLY", "MONTHLY", "QUARTERLY", "ANNUALLY"] as const;

export function makeSubscriptions(count: number, accountIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id        = i + 1;
    const startedat = randomDate(RANGE_START, new Date("2024-06-01"));
    return {
      id,
      plan:      randomFrom(["free", "pro", "pro", "enterprise"] as const),
      cycle:     randomFrom(BILLING_CYCLES),
      startedat,
      expiresat: maybe(new Date(startedat.getTime() + randomBetween(30, 365) * 86_400_000)),
      isactive:  Math.random() < 0.75,
      accountid: randomFrom(accountIds),
    };
  });
}

// ── invoice ───────────────────────────────────────────────────────────────────

export function makeInvoices(count: number, accountIds: number[], subscriptionIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id       = i + 1;
    const paid     = Math.random() < 0.7;
    const issuedat = randomDate(RANGE_START, RANGE_END);
    return {
      id,
      amount:         randomFloat(5, 9999, 2),
      status:         paid ? "PAID" : randomFrom(["PENDING", "OVERDUE", "CANCELLED"] as const),
      issuedat,
      paidat:         paid ? new Date(issuedat.getTime() + randomBetween(0, 7) * 86_400_000) : null,
      accountid:      randomFrom(accountIds),
      subscriptionid: maybe(randomFrom(subscriptionIds), 0.3), // nullable; relation deleted in v3
    };
  });
}

// ── invoiceitem ───────────────────────────────────────────────────────────────

const LINE_ITEMS = ["Monthly subscription", "Annual license", "Professional services", "Support tier", "Add-on feature", "Setup fee", "Training session", "Overage charge", "Usage-based fee", "Early renewal"] as const;

export function makeInvoiceItems(count: number, invoiceIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id:          i + 1,
    description: randomFrom(LINE_ITEMS),
    quantity:    randomBetween(1, 12),
    unitprice:   randomFloat(9.99, 999.99, 2),
    invoiceid:   randomFrom(invoiceIds),
  }));
}

// ── product ───────────────────────────────────────────────────────────────────

const PRODUCT_NAMES = ["Pro License", "Starter Pack", "Enterprise Suite", "Dev Toolkit", "Cloud Bundle", "Security Add-on", "Analytics Module", "Export Pack", "API Credits", "Support Plan"] as const;
// All 5 ContentType values; enum deleted in v3, field retyped to String first
const CONTENT_TYPES = ["ARTICLE", "VIDEO", "PODCAST", "GUIDE", "TUTORIAL"] as const;

export function makeProducts(count: number, categoryIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id   = i + 1;
    const name = `${randomFrom(PRODUCT_NAMES)} ${id}`;
    return {
      id,
      name,
      slug:        `${name.toLowerCase().replace(/\s+/g, "-")}-${id}`,
      price:       randomFloat(4.99, 999.99, 2),
      stock:       randomBetween(0, 10_000), // default 0 removed in v3 → backfill_required
      contenttype: randomFrom(CONTENT_TYPES),
      categoryid:  maybe(randomFrom(categoryIds), 0.2),
    };
  });
}

// ── article ───────────────────────────────────────────────────────────────────

const ARTICLE_TITLE_TMPLS = [
  "Getting Started with %s", "Advanced %s Patterns", "The Complete Guide to %s",
  "%s Best Practices", "Why We Chose %s for Production",
  "Migrating to %s: A Practical Guide", "Understanding %s Internals",
  "5 Things You Didn't Know About %s",
] as const;
const ARTICLE_TECHS = ["TypeScript", "Prisma", "PostgreSQL", "React", "Node.js", "Redis", "Docker", "Kubernetes", "GraphQL", "tRPC", "Next.js", "Drizzle ORM", "SQLite", "CI/CD"] as const;

export function makeArticles(count: number, authorIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id    = i + 1;
    const tech  = randomFrom(ARTICLE_TECHS);
    const title = randomFrom(ARTICLE_TITLE_TMPLS).replace("%s", tech);
    return {
      id,
      title,
      slug:        `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}-${id}`,
      body:        maybe(`# ${title}\n\nThis article covers ${tech} in depth.`, 0.25), // ~25% null; deleted in v2
      contenttype: randomFrom(CONTENT_TYPES),
      publishedat: maybe(randomDate(RANGE_START, RANGE_END), 0.3),
      viewcount:   randomBetween(0, 50_000),
      authorid:    randomFrom(authorIds),
    };
  });
}

// ── articletag (unique articleid+tagid) ───────────────────────────────────────

export function makeArticleTags(count: number, articleIds: number[], tagIds: number[]): Row[] {
  const seen = new Set<string>();
  const rows: Row[] = [];
  let id = 1;
  const limit = Math.min(count, articleIds.length * tagIds.length);
  let attempts = 0;
  while (rows.length < limit && attempts < limit * 10) {
    attempts++;
    const articleid = randomFrom(articleIds);
    const tagid     = randomFrom(tagIds);
    const key = `${articleid}-${tagid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: id++, articleid, tagid });
  }
  return rows;
}

// ── mediaasset (table renamed to Asset in v2) ─────────────────────────────────

const ASSET_TYPES: [string, string][] = [
  ["webp", "image"], ["mp4", "video"], ["mp3", "audio"], ["pdf", "document"], ["zip", "archive"],
];

export function makeMediaAssets(count: number, ownerIds: number[]): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    const [ext, type] = randomFrom(ASSET_TYPES)!;
    return {
      id,
      filename:   `asset-${id}.${ext}`,
      url:        `https://cdn.acme.io/assets/${id}.${ext}`,
      type,
      size:       randomBetween(1_024, 104_857_600),
      uploadedat: randomDate(RANGE_START, RANGE_END),
      ownerid:    randomFrom(ownerIds),
    };
  });
}
