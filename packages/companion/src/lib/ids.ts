import { randomUUID, createHash } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export function contentHash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}
