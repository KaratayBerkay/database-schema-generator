import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const ALGORITHM = "aes-256-gcm" as const;
const HEX_32_BYTES = /^[0-9a-f]{64}$/;

export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

// ── Master key (key-encryption key) ────────────────────────────────────────────
// Each connection row gets its own random data key, but that data key must NOT be stored in
// plaintext beside the ciphertext it protects (a leaked/backed-up app.db would then be trivially
// decryptable). Instead the data key is encrypted ("wrapped") with a master key that lives OUTSIDE
// the database: from CONNECTION_ENCRYPTION_KEY, or an auto-generated owner-only key file under the
// user's home dir. Losing the master key makes stored credentials unrecoverable — re-enter them.

let cachedMasterKey: string | null = null;

function masterKeyPath(): string {
  return path.join(os.homedir(), ".database-schema-generator", "connection-master.key");
}

export function getMasterKey(): string {
  if (cachedMasterKey) return cachedMasterKey;

  const fromEnv = process.env.CONNECTION_ENCRYPTION_KEY?.trim().toLowerCase();
  if (fromEnv) {
    if (!HEX_32_BYTES.test(fromEnv)) {
      throw new Error("CONNECTION_ENCRYPTION_KEY must be 64 hex characters (a 32-byte key).");
    }
    cachedMasterKey = fromEnv;
    return cachedMasterKey;
  }

  const keyFile = masterKeyPath();
  if (existsSync(keyFile)) {
    const existing = readFileSync(keyFile, "utf8").trim().toLowerCase();
    if (HEX_32_BYTES.test(existing)) {
      cachedMasterKey = existing;
      return cachedMasterKey;
    }
  }

  // First run: generate a master key and persist it outside app.db, readable only by the owner.
  const generated = generateSecret();
  mkdirSync(path.dirname(keyFile), { recursive: true, mode: 0o700 });
  writeFileSync(keyFile, generated, { encoding: "utf8", mode: 0o600 });
  cachedMasterKey = generated;
  return cachedMasterKey;
}

/** A wrapped key is an `encrypt()` payload (iv:tag:cipher); a legacy raw data key is bare hex. */
export function isWrappedKey(secret: string): boolean {
  return secret.split(":").length === 3;
}

/** Encrypt a per-row data key with the master key for storage. */
export function wrapDataKey(dataKeyHex: string): string {
  return encrypt(dataKeyHex, getMasterKey());
}

/** Recover a per-row data key: unwrap with the master key, or pass through a legacy bare-hex key. */
export function unwrapDataKey(secret: string): string {
  return isWrappedKey(secret) ? decrypt(secret, getMasterKey()) : secret;
}

export function encrypt(text: string, hexKey: string): string {
  const key = Buffer.from(hexKey, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encryptedText: string, hexKey: string): string {
  const parts = encryptedText.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted field format.");
  const [ivHex, authTagHex, cipherHex] = parts as [string, string, string];
  const key = Buffer.from(hexKey, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}
