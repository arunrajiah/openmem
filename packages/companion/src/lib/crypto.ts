import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ENC_PREFIX = "enc:";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type EncryptionKey = Buffer;

/**
 * Load the encryption key from OPENMEM_ENCRYPTION_KEY env var or ~/.openmem/key.
 * Returns null if neither source is present (encryption disabled).
 */
export function loadKey(dataDir: string): EncryptionKey | null {
  const envKey = process.env.OPENMEM_ENCRYPTION_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, "hex");
    if (buf.length !== KEY_BYTES) {
      throw new Error(
        `OPENMEM_ENCRYPTION_KEY must be ${KEY_BYTES * 2} hex chars (${KEY_BYTES} bytes)`,
      );
    }
    return buf;
  }
  const keyPath = join(dataDir, "key");
  if (!existsSync(keyPath)) return null;
  return Buffer.from(readFileSync(keyPath, "utf8").trim(), "hex");
}

/**
 * Generate a new random key, write it to <dataDir>/key (mode 0600), and return it.
 * Throws if a key file already exists.
 */
export function generateKey(dataDir: string): EncryptionKey {
  const keyPath = join(dataDir, "key");
  if (existsSync(keyPath)) {
    throw new Error(`Key file already exists at ${keyPath}`);
  }
  const key = randomBytes(KEY_BYTES);
  writeFileSync(keyPath, key.toString("hex") + "\n", { mode: 0o600 });
  return key;
}

/** Encrypt a UTF-8 string with AES-256-GCM. Returns "enc:<base64(iv+tag+ciphertext)>". */
export function encrypt(key: EncryptionKey, plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]);
  return `${ENC_PREFIX}${payload.toString("base64")}`;
}

/**
 * Decrypt a value produced by encrypt().
 * If the value does not start with "enc:" it is returned as-is (plaintext passthrough —
 * allows reading rows that were stored before encryption was enabled).
 */
export function decrypt(key: EncryptionKey, value: string): string {
  if (!value.startsWith(ENC_PREFIX)) return value;
  const buf = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
