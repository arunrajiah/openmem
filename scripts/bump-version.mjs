#!/usr/bin/env node
/**
 * Stamp a semver across all package.json files and the extension manifest.
 *
 * Usage:
 *   node scripts/bump-version.mjs 1.2.3
 *
 * Called automatically by the "publish" GitHub Actions workflow when a
 * version tag (v*) is pushed. Safe to run locally before tagging:
 *
 *   node scripts/bump-version.mjs 1.2.3
 *   git add -A && git commit -m "chore: release v1.2.3"
 *   git tag v1.2.3 && git push --follow-tags
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const [, , version] = process.argv;

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Error: version must be semver e.g. 1.2.3");
  console.error("Usage: node scripts/bump-version.mjs <version>");
  process.exit(1);
}

/** Read, patch with callback, write back with consistent 2-space formatting. */
function patchJSON(relPath, patcher) {
  const abs = resolve(root, relPath);
  const raw = readFileSync(abs, "utf8");
  const obj = JSON.parse(raw);
  patcher(obj);
  writeFileSync(abs, JSON.stringify(obj, null, 2) + "\n");
  console.log(`  ✓  ${relPath}`);
}

console.log(`Stamping version ${version} …\n`);

patchJSON("package.json", (o) => {
  o.version = version;
});
patchJSON("packages/shared/package.json", (o) => {
  o.version = version;
});
patchJSON("packages/companion/package.json", (o) => {
  o.version = version;
});
patchJSON("packages/extension/package.json", (o) => {
  o.version = version;
});
patchJSON("packages/web/package.json", (o) => {
  o.version = version;
});

// Extension manifest — Chrome Web Store requires X.Y.Z (or X.Y.Z.W) format,
// which semver satisfies as long as there are no pre-release suffixes.
patchJSON("packages/extension/manifest.json", (o) => {
  o.version = version;
});

console.log(`\nDone. All packages are now at v${version}.`);
console.log(`\nNext steps:`);
console.log(`  git add -A`);
console.log(`  git commit -m "chore: release v${version}"`);
console.log(`  git tag v${version}`);
console.log(`  git push --follow-tags`);
