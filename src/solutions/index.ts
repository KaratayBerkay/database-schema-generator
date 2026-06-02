import * as FromString   from "./from-string";
import * as FromNumber   from "./from-number";
import * as FromDateTime from "./from-datetime";
import { enumTypeDeleted } from "./from-enum";
import { backfillRequired, backfillNullRow } from "./backfill";
import type { FieldContext, FieldDecision, FieldResolution, EnumDecision } from "./types";

export type { FieldContext, FieldDecision, FieldResolution, EnumDecision };
export { enumValueRemoved, enumTypeDeleted, stringCastToEnum } from "./from-enum";
export { backfillRequired, backfillNullRow } from "./backfill";

// Canonical logical type names that are scalars.
// Anything NOT in this set is treated as an enum type name (e.g. "billingcycle", "taskstatus").
const KNOWN_SCALAR_TYPES = new Set([
  "string", "text", "integer", "int", "bigint", "float", "decimal",
  "boolean", "timestamp", "datetime", "json", "bytes", "uuid",
]);

// ─── main dispatcher ──────────────────────────────────────────────────────────
// Routes to the correct converter function based on the from→to type pair.
// fromType / toType are canonical logical type names (string, integer, float, etc.)
// matching schema_fields.logical_type — NOT Prisma scalar names.

export function resolveFieldMigration(
  fromType: string,
  toType: string,
  raw: unknown,
  field: FieldContext,
  decision: FieldDecision,
): FieldResolution {
  const from = fromType.toLowerCase();
  const to   = toType.toLowerCase();

  // Same type — pass through with coercion.
  // Exception: null raw with an explicit replacement value (backfill_required) — apply the replacement.
  if (from === to) {
    if ((raw === null || raw === undefined) && decision.type === "replacement_value") {
      return { ok: true, value: coerce(decision.value, toType) };
    }
    return { ok: true, value: coerce(raw, toType) };
  }

  const key = `${from}→${to}`;

  switch (key) {
    // ── String source ────────────────────────────────────────────────────────
    case "string→integer":  return FromString.stringToInt(raw, field, decision);
    case "string→bigint":   return FromString.stringToBigInt(raw, field, decision);
    case "string→float":    return FromString.stringToFloat(raw, field, decision);
    case "string→decimal":  return FromString.stringToDecimal(raw, field, decision);
    case "string→boolean":  return FromString.stringToBoolean(raw, field, decision);
    case "string→timestamp":
    case "string→datetime": return FromString.stringToDateTime(raw, field, decision);
    case "string→uuid":     return FromString.stringToUuid(raw, field, decision);
    case "string→json":     return FromString.stringToJson(raw, field, decision);
    case "string→bytes":    return FromString.stringToBytes(raw, field, decision);

    // ── Integer source ───────────────────────────────────────────────────────
    case "integer→string":  return FromNumber.intToString(raw, field, decision);
    case "integer→bigint":  return FromNumber.intToBigInt(raw, field, decision);
    case "integer→float":
    case "integer→decimal": return FromNumber.intToFloat(raw, field, decision);
    case "integer→boolean": return FromNumber.intToBoolean(raw, field, decision);
    case "integer→timestamp":
    case "integer→datetime":return FromNumber.intToDateTime(raw, field, decision);

    // ── Float / Decimal source ───────────────────────────────────────────────
    case "float→string":
    case "decimal→string":  return FromNumber.floatToString(raw, field, decision);
    case "float→integer":
    case "decimal→integer": return FromNumber.floatToInt(raw, field, decision);
    case "float→bigint":
    case "decimal→bigint":  return FromNumber.floatToBigInt(raw, field, decision);
    case "float→decimal":
    case "decimal→float":   return { ok: true, value: Number(raw) }; // precision_loss acknowledged

    // ── BigInt source ────────────────────────────────────────────────────────
    case "bigint→string":   return FromNumber.intToString(raw, field, decision); // same logic
    case "bigint→integer":  return FromNumber.bigIntToInt(raw, field, decision);
    case "bigint→float":
    case "bigint→decimal":  return { ok: true, value: Number(raw) }; // precision_loss acknowledged

    // ── Float / Decimal / BigInt → Boolean ──────────────────────────────────
    case "float→boolean":
    case "decimal→boolean":
    case "bigint→boolean":  return FromNumber.numericToBoolean(raw, field, decision);

    // ── Boolean source ───────────────────────────────────────────────────────
    case "boolean→integer":
    case "boolean→bigint":
    case "boolean→float":
    case "boolean→decimal": return FromNumber.booleanToInt(raw, field, decision);
    case "boolean→string":  return FromNumber.booleanToString(raw, field, decision);
    case "boolean→json":    return { ok: true, value: raw };

    // ── DateTime source ──────────────────────────────────────────────────────
    case "timestamp→string":
    case "datetime→string": return FromDateTime.dateTimeToString(raw, field, decision);
    case "timestamp→integer":
    case "datetime→integer":return FromDateTime.dateTimeToInt(raw, field, decision);
    case "timestamp→bigint":
    case "datetime→bigint": return FromDateTime.dateTimeToBigInt(raw, field, decision);
    case "timestamp→float":
    case "datetime→float":  return FromDateTime.dateTimeToFloat(raw, field, decision);
    case "timestamp→decimal":
    case "datetime→decimal":return FromDateTime.dateTimeToDecimal(raw, field, decision);

    // ── UUID source ──────────────────────────────────────────────────────────
    case "uuid→string":     return { ok: true, value: String(raw ?? "") }; // safe

    // ── JSON source ──────────────────────────────────────────────────────────
    case "json→string":     return { ok: true, value: typeof raw === "string" ? raw : JSON.stringify(raw) };

    // ── Bytes source ─────────────────────────────────────────────────────────
    case "bytes→string": {
      if (decision.type === "pending")           return { ok: false, error: `Field "${field.name}" change not yet approved` };
      if (decision.type === "drop" || decision.type === "db_generate") return { ok: true, skip: true };
      if (decision.type === "replacement_value") return { ok: true, value: decision.value };
      if (decision.type === "null_out")          return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required String field "${field.name}"` };
      // auto_cast: base64-encode the buffer
      if (raw instanceof Buffer || raw instanceof Uint8Array) return { ok: true, value: Buffer.from(raw).toString("base64") };
      if (typeof raw === "string") return { ok: true, value: raw };
      return { ok: true, value: String(raw ?? "") };
    }

    // ── Enum sources and String→Enum target ──────────────────────────────────
    default: {
      const fromIsEnum = !KNOWN_SCALAR_TYPES.has(from);
      const toIsEnum   = !KNOWN_SCALAR_TYPES.has(to);

      // Enum → String: enum values are stored as plain strings in the DB — pass through.
      // e.g. BillingCycle → String: "MONTHLY" stays "MONTHLY".
      if (fromIsEnum && to === "string") return enumTypeDeleted(raw);

      // Enum → Enum (different type): try to pass through the raw value so the DB validates
      // membership. With an explicit replacement_value it becomes a remap.
      if (fromIsEnum && toIsEnum) {
        if (decision.type === "pending")           return { ok: false, error: `Field "${field.name}" change not yet approved` };
        if (decision.type === "drop" || decision.type === "db_generate") return { ok: true, skip: true };
        if (decision.type === "replacement_value") return { ok: true, value: decision.value };
        if (decision.type === "null_out")          return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required enum field "${field.name}"` };
        return enumTypeDeleted(raw); // auto_cast — pass through, DB validates
      }

      // Enum → other scalar (e.g. BillingCycle → Int): cannot auto-convert — requires replacement.
      if (fromIsEnum) {
        if (decision.type === "pending")           return { ok: false, error: `Field "${field.name}" change not yet approved` };
        if (decision.type === "drop" || decision.type === "db_generate") return { ok: true, skip: true };
        if (decision.type === "replacement_value") return { ok: true, value: decision.value };
        if (decision.type === "null_out")          return field.nullable ? { ok: true, value: null } : { ok: false, error: `Required field "${field.name}" — enter a replacement value` };
        return { ok: false, error: `Cannot auto-convert enum value "${raw}" to ${toType} for field "${field.name}" — enter a replacement value in Tracking` };
      }

      // String → Enum: the string value is already a valid enum member in most cases.
      // The DB will reject it at INSERT time if it isn't — that surfaces as a migration error.
      if (from === "string") return { ok: true, value: raw };

      // Unknown pair — apply any explicit decision the client provided
      if (decision.type === "pending")           return { ok: false, error: `Field "${field.name}" change not yet approved` };
      if (decision.type === "drop" || decision.type === "db_generate") return { ok: true, skip: true };
      if (decision.type === "null_out" && field.nullable) return { ok: true, value: null };
      if (decision.type === "replacement_value") return { ok: true, value: decision.value };
      return {
        ok: false,
        error: `No migration handler for ${fromType} → ${toType} on field "${field.name}"`,
      };
    }
  }
}

// ─── decision derivation ──────────────────────────────────────────────────────
// Converts a SchemaWarning (DB row) into a typed FieldDecision.
// This is the single place where Tracking decisions map to migration actions.

type WarningLike = {
  changeKind: string;
  resolution: string;
  replacementValue: string | null;
  approvedAt: string | null;
  targetNullable: boolean | null;
};

export function warningToDecision(warning: WarningLike): FieldDecision {
  if (!warning.approvedAt) return { type: "pending" };

  // PK type changed — old PK value (e.g. Int) cannot become a UUID; let DB generate a new one
  if (warning.changeKind === "pk_type_changed") return { type: "db_generate" };

  // Field removed — omit column from INSERT entirely
  if (warning.changeKind === "removed") return { type: "drop" };

  // Client specified an explicit replacement/backfill/remap value — use it
  if (warning.replacementValue) return { type: "replacement_value", value: warning.replacementValue };

  // Safe or precision_loss — carry the value through as-is (coerce to target type)
  if (warning.resolution === "safe" || warning.resolution === "precision_loss") return { type: "auto_cast" };

  // lossy_convert or data_deleted — data cannot be automatically preserved
  // Client approved but provided no replacement value:
  //   nullable target → set NULL (accepted data loss)
  //   non-nullable target → auto_cast as best effort (gate should have blocked this case)
  if (warning.resolution === "lossy_convert" || warning.resolution === "data_deleted") {
    return warning.targetNullable === true ? { type: "null_out" } : { type: "auto_cast" };
  }

  // backfill_required with no value — auto_cast as last resort (gate should catch this)
  return { type: "auto_cast" };
}

// ─── EnumDecision derivation ──────────────────────────────────────────────────

export function warningToEnumDecision(warning: WarningLike): EnumDecision {
  if (warning.replacementValue) return { type: "remap", replacement: warning.replacementValue };
  return { type: "null_out" };
}

// ─── simple coercion (safe / same-type paths) ─────────────────────────────────

function coerce(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  const t = type.toLowerCase();
  if (t === "integer" || t === "int") {
    const n = parseInt(String(value), 10);
    return isNaN(n) ? value : n;
  }
  if (t === "float" || t === "decimal") {
    const f = parseFloat(String(value));
    return isNaN(f) ? value : f;
  }
  if (t === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
    return value;
  }
  if (t === "timestamp" || t === "datetime") {
    if (value instanceof Date) return value.toISOString();
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? value : d.toISOString();
  }
  return value;
}
