/**
 * Build the `openmem-companion` sidecar binary that the Tauri app spawns in
 * production.
 *
 * Tauri's `externalBin` mechanism requires the binary to be named with the
 * Rust target triple suffix, e.g.:
 *   binaries/openmem-companion-aarch64-apple-darwin
 *   binaries/openmem-companion-x86_64-pc-windows-msvc.exe
 *
 * ── IMPORTANT CAVEAT ─────────────────────────────────────────────────────────
 * The companion depends on `better-sqlite3`, a NATIVE Node addon (.node file).
 * Node's Single Executable Application (SEA) format bundles only JS, not native
 * addons — the prebuilt `better_sqlite3.node` must ship ALONGSIDE the binary
 * and be resolved at runtime. This script produces the SEA binary and copies
 * the native addon next to it; the companion must be able to require the addon
 * from a path relative to the executable.
 *
 * This packaging path is UNVERIFIED in CI yet (cross-platform release bundling
 * is a deferred follow-up — see packages/desktop/README.md). For local
 * development you do NOT need this script: `tauri dev` starts the companion via
 * the `predev` script instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(__dir, "..");
const repoRoot = resolve(desktopRoot, "..", "..");
const companionRoot = resolve(repoRoot, "packages", "companion");

const binDir = resolve(desktopRoot, "src-tauri", "binaries");
mkdirSync(binDir, { recursive: true });

// ── Resolve the Rust target triple so the binary is named as Tauri expects ────
function targetTriple() {
  if (process.env.TAURI_TARGET_TRIPLE) return process.env.TAURI_TARGET_TRIPLE;
  try {
    const out = execFileSync("rustc", ["-Vv"], { encoding: "utf8" });
    const line = out.split("\n").find((l) => l.startsWith("host:"));
    if (line) return line.replace("host:", "").trim();
  } catch {
    // rustc not available
  }
  throw new Error(
    "Could not determine the Rust target triple. Install Rust, or set " +
      "TAURI_TARGET_TRIPLE (e.g. aarch64-apple-darwin).",
  );
}

const triple = targetTriple();
const exeSuffix = triple.includes("windows") ? ".exe" : "";
const outName = `openmem-companion-${triple}${exeSuffix}`;
const outPath = resolve(binDir, outName);

console.log(`Building sidecar: ${outName}`);

// The companion must already be built (prebuild runs `companion build` first).
const companionEntry = resolve(companionRoot, "dist", "cli.js");
if (!existsSync(companionEntry)) {
  throw new Error(
    `Companion build output not found at ${companionEntry}. ` +
      `Run \`pnpm --filter @openmem/companion build\` first.`,
  );
}

// ── Node SEA flow ─────────────────────────────────────────────────────────────
// 1. Write a SEA config pointing at the companion's bundled entrypoint.
// 2. Generate the blob, copy the node binary, and inject the blob.
const seaConfigPath = resolve(desktopRoot, "sea-config.json");
const blobPath = resolve(desktopRoot, "sea-prep.blob");

writeFileSync(
  seaConfigPath,
  JSON.stringify(
    {
      main: companionEntry,
      output: blobPath,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
    },
    null,
    2,
  ),
);

execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], {
  stdio: "inherit",
});

// Copy the current node binary as the base executable.
copyFileSync(process.execPath, outPath);
chmodSync(outPath, 0o755);

// Inject the blob using postject (resolved via npx).
execFileSync(
  "npx",
  [
    "--yes",
    "postject",
    outPath,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
    ...(triple.includes("apple")
      ? ["--macho-segment-name", "NODE_SEA"]
      : []),
  ],
  { stdio: "inherit" },
);

// ── Ship the native better-sqlite3 addon next to the binary ───────────────────
// (Node SEA does not bundle .node files.)
const addon = resolve(
  companionRoot,
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
);
if (existsSync(addon)) {
  copyFileSync(addon, resolve(binDir, "better_sqlite3.node"));
  console.log("  ✓ copied better_sqlite3.node");
} else {
  console.warn(
    "  ⚠ better_sqlite3.node not found — the sidecar will fail to open the DB. " +
      "Ensure better-sqlite3 is installed/built for this platform.",
  );
}

console.log(`\nSidecar written to ${outPath}`);
console.log(
  "NOTE: native-addon resolution at runtime is unverified — see " +
    "packages/desktop/README.md before relying on a production bundle.",
);
