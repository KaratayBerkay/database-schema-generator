# Perfect Migration Scenario

**Project:** `Perfect Migration Scenario`  
**Provider:** Postgres  
**Purpose:** Exercise every warning type, resolver type, diff badge, and approval path across two migration steps.

```bash
pnpm seed:workflows perfect-migration          # all three versions
pnpm seed:workflows perfect-migration v1       # v1 only
pnpm seed:workflows perfect-migration v2       # v2 only (idempotent)
pnpm seed:workflows perfect-migration v3       # v3 only (idempotent)
```

---

## V1 Baseline

### Enums (6)
| Enum | Values |
|------|--------|
| `AccountRole` | VIEWER, EDITOR, MANAGER, ADMIN, OWNER |
| `TaskStatus` | BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED |
| `Priority` | LOW, MEDIUM, HIGH, CRITICAL |
| `ContentType` | ARTICLE, VIDEO, PODCAST, GUIDE, TUTORIAL |
| `BillingCycle` | MONTHLY, QUARTERLY, ANNUALLY |
| `ShipmentStatus` | PENDING, PACKED, SHIPPED, DELIVERED, RETURNED |

### Tables (22, all Int PK)
`Account` `Profile` `Team` `TeamMember` `Project` `Sprint` `Task` `Comment` `Attachment` `Label` `TaskLabel` `Notification` `AuditLog` `Subscription` `Invoice` `InvoiceItem` `Product` `Category` `Tag` `Article` `ArticleTag` `MediaAsset`

### Relations (27)
Profile→Account, TeamMember→Account, TeamMember→Team, Project→Account(owner), Sprint→Project, Task→Project, Task→Sprint(nullable), Task→Account(assignee,nullable), Comment→Account(author), **Comment→Task(nullable)**, Attachment→Task, Attachment→Account(uploader), Label→Project, TaskLabel→Task, TaskLabel→Label, Notification→Account(recipient), **AuditLog→Account(actor)**, Subscription→Account, Invoice→Account, **Invoice→Subscription(nullable)**, InvoiceItem→Invoice, Product→Category(nullable), ArticleTag→Article, ArticleTag→Tag, Article→Account(author), MediaAsset→Account(owner)

Relations in **bold** are removed in v2/v3.

### Restrictions (15)
Account UNIQUE(email), Account UNIQUE(username), Team UNIQUE(slug), Product UNIQUE(slug), Tag UNIQUE(name), Article UNIQUE(slug), Task INDEX(status,priority,dueDate), Notification INDEX(recipientId), TeamMember INDEX(accountId,teamId), Subscription INDEX(accountId), Invoice INDEX(accountId), AuditLog INDEX(entityType,entityId)

---

## V2 Mutations (v1 → v2)

> Phase order: fields → enums → tables → relations → restrictions  
> Fields run first so `Subscription.cycle` is retyped before `BillingCycle` enum is deleted.

### Schema warnings produced (19 total)

| Entity | Change | changeKind | Resolution |
|--------|--------|-----------|-----------|
| `AuditLog` table | deleted | `table.removed` | `data_deleted` |
| `Account.plan` | deleted | `field.removed` | `data_deleted` |
| `Article.body` | deleted | `field.removed` | `data_deleted` |
| `Account.isVerified` | default `false` removed | `field.default_changed` | `backfill_required` |
| `Account.reputation` | Int required, no default added | `field.added` | `backfill_required` |
| `Article.wordCount` | Int required, no default added | `field.added` | `backfill_required` |
| `Profile.bio` | optional → required | `field.nullability_changed` | `backfill_required` |
| `Task.storyPoints` | optional → required | `field.nullability_changed` | `backfill_required` |
| `Account.credits` | Float → Int (default 0 kept) | `field.type_changed` | `precision_loss` |
| `Account.username→handle` | rename + String → Int | `field.multiple` | `lossy_convert` |
| `Task.threadRef→sequenceId` | rename + String → Int | `field.multiple` | `lossy_convert` |
| `Subscription.cycle` | BillingCycle → String | `field.type_changed` | `data_deleted` |
| `BillingCycle` | entire enum deleted | `enum.removed` | `data_deleted` |
| `TaskStatus.CANCELLED` | value removed | `enum.value_removed` | `data_deleted` |
| `Priority.LOW` | value removed | `enum.value_removed` | `data_deleted` |
| `Priority.MEDIUM` | value removed | `enum.value_removed` | `data_deleted` |
| `Comment.task → Task` | relation deleted | `relation.removed` | `data_deleted` |
| `AuditLog.actor → Account` | auto-removed with table | `relation.removed` | `data_deleted` |
| `TeamMember UNIQUE(accountId,teamId)` | added | `restriction.unique_added` | `lossy_convert` |

### Diff badges only (no schema warnings)

| Change | Badge |
|--------|-------|
| `TaskStatus` +ON_HOLD | amber "1 added" |
| `ShipmentStatus` +PROCESSING | amber "1 added" |
| `Visibility` new enum | sky "new" |
| `MediaAsset` → `Asset` | amber "renamed" |
| `ContentHub` added | sky "added" |
| `Article.title` → `headline` | amber border, renamed |
| Account UNIQUE(username) removed | info badge |
| Task INDEX(status) removed | info badge |
| Comment INDEX(createdAt) added | info badge |

---

## V3 Mutations (v2 → v3)

> Phase order: fields → enums → tables → relations → restrictions  
> Fields run first so `Product.contentType` and `Article.contentType` are retyped before `ContentType` enum is deleted.

### Schema warnings produced (10 total)

| Entity | Change | changeKind | Resolution |
|--------|--------|-----------|-----------|
| `Invoice.id` | Int → Uuid PK | `field.pk_type_changed` | `data_deleted` (breaking, cascade hint: InvoiceItem.invoiceId) |
| `Product.contentType` | ContentType → String | `field.type_changed` | `data_deleted` |
| `Article.contentType` | ContentType → String | `field.type_changed` | `data_deleted` |
| `Sprint.goal` | optional → required | `field.nullability_changed` | `backfill_required` |
| `Sprint.capacity` | Int required, no default added | `field.added` | `backfill_required` |
| `Product.stock` | default 0 removed | `field.default_changed` | `backfill_required` |
| `AccountRole.OWNER` | value removed | `enum.value_removed` | `data_deleted` |
| `ContentType` | entire enum deleted | `enum.removed` | `data_deleted` |
| `Invoice.subscription → Subscription` | relation deleted | `relation.removed` | `data_deleted` |
| `Sprint UNIQUE(name, projectId)` | added | `restriction.unique_added` | `lossy_convert` |

### Diff badges only (no schema warnings)

| Change | Badge |
|--------|-------|
| `TaskStatus` +ARCHIVED | amber "1 added" |
| `ExportFormat` new enum | sky "new" |
| `ContentHub` → `PublishingHub` | amber "renamed" |
| `ReportCache` added | sky "added" |
| `Comment.body` required → optional | sky border (info) |
| `Tag.colorHex` optional added | sky border (info) |
| `ReportCache.account → Account` added | sky border (info) |
| Task INDEX(priority) removed | info badge |
| Article INDEX(wordCount) added | info badge |
| Comment INDEX(createdAt) removed | info badge |

---

## Full Coverage Map

| Warning / Diff type | v1→v2 | v2→v3 |
|--------------------|-------|-------|
| `table.removed` (data_deleted) | ✓ AuditLog | |
| `table.renamed` (diff badge) | ✓ MediaAsset→Asset | ✓ ContentHub→PublishingHub |
| `table.added` (diff badge) | ✓ ContentHub | ✓ ReportCache |
| `field.removed` (data_deleted) | ✓ Account.plan, Article.body | |
| `field.added` required (backfill_required) | ✓ Account.reputation, Article.wordCount | ✓ Sprint.capacity |
| `field.added` optional (diff badge) | | ✓ Tag.colorHex |
| `field.renamed` (diff badge) | ✓ Article.title→headline | |
| `field.nullability_changed` opt→req (backfill) | ✓ Profile.bio, Task.storyPoints | ✓ Sprint.goal |
| `field.nullability_changed` req→opt (diff badge) | | ✓ Comment.body |
| `field.default_changed` (backfill_required) | ✓ Account.isVerified | ✓ Product.stock |
| `field.type_changed` precision_loss | ✓ Account.credits Float→Int | |
| `field.type_changed` lossy_convert | ✓ Subscription.cycle (enum→String=data_deleted) | |
| `field.type_changed` data_deleted | ✓ Subscription.cycle | ✓ Product/Article contentType |
| `field.multiple` rename+type (lossy_convert) | ✓ Account.username, Task.threadRef | |
| `field.pk_type_changed` (data_deleted+cascade) | | ✓ Invoice.id |
| `enum.added` (diff badge) | ✓ Visibility | ✓ ExportFormat |
| `enum.removed` (data_deleted) | ✓ BillingCycle | ✓ ContentType |
| `enum.value_removed` (data_deleted) | ✓ TaskStatus.CANCELLED, Priority.LOW/MEDIUM | ✓ AccountRole.OWNER |
| `enum.values_changed` add-only (diff badge) | ✓ TaskStatus+ON_HOLD, ShipmentStatus+PROCESSING | ✓ TaskStatus+ARCHIVED |
| `relation.removed` (data_deleted) | ✓ Comment→Task, AuditLog→Account | ✓ Invoice→Subscription |
| `relation.added` (diff badge) | | ✓ ReportCache→Account |
| `restriction.unique_added` (lossy_convert) | ✓ TeamMember UNIQUE | ✓ Sprint UNIQUE |
| `restriction.unique_removed` (diff badge) | ✓ Account UNIQUE(username) | |
| `restriction.index_added` (diff badge) | ✓ Comment INDEX(createdAt) | ✓ Article INDEX(wordCount) |
| `restriction.index_removed` (diff badge) | ✓ Task INDEX(status) | ✓ Task INDEX(priority), Comment INDEX(createdAt) |

**Total schema_warnings:** 29 (19 for v1→v2, 10 for v2→v3)  
**All 5 resolutions:** `data_deleted` · `backfill_required` · `precision_loss` · `lossy_convert` (×2 unique_added, ×2 multiple)  
**All 5 entity kinds:** `table` · `field` · `enum` · `relation` · `restriction`
