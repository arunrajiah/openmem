import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import AdmZip from "adm-zip";

/**
 * Resolve a user-supplied path to a map of filename → string content.
 * Handles:
 *  - A ZIP file    → all entries in the archive
 *  - A directory   → files one level deep
 *  - A plain file  → single entry keyed by basename
 */
export function readInputFiles(inputPath: string): Map<string, string> {
  if (!existsSync(inputPath)) {
    throw new Error(`Input path not found: ${inputPath}`);
  }

  const stat = statSync(inputPath);

  if (stat.isFile() && extname(inputPath).toLowerCase() === ".zip") {
    const zip = new AdmZip(inputPath);
    const map = new Map<string, string>();
    for (const entry of zip.getEntries()) {
      if (!entry.isDirectory) {
        map.set(entry.entryName, entry.getData().toString("utf-8"));
      }
    }
    return map;
  }

  if (stat.isFile()) {
    const name = inputPath.split("/").at(-1) ?? inputPath;
    return new Map([[name, readFileSync(inputPath, "utf-8")]]);
  }

  if (stat.isDirectory()) {
    const map = new Map<string, string>();
    for (const f of readdirSync(inputPath)) {
      const full = join(inputPath, f);
      if (statSync(full).isFile()) {
        map.set(f, readFileSync(full, "utf-8"));
      }
    }
    return map;
  }

  throw new Error(`Cannot read input: ${inputPath}`);
}

/** Safe JSON.parse — throws with a helpful message. */
export function parseJSON<T>(text: string, label: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${label}: ${String(err)}`);
  }
}
