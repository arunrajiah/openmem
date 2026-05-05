import esbuild from "esbuild";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const firefox = process.argv.includes("--firefox");

// ── Output directory & browser target ────────────────────────────────────────
const outDir = firefox ? "dist-firefox" : "dist";
const target = firefox ? ["firefox116"] : ["chrome120"];
const manifestSrc = firefox ? "manifest.firefox.json" : "manifest.json";

const sharedOpts = {
  bundle: true,
  platform: "browser",
  target,
  format: "esm",
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
};

// Page-world hooks are IIFE to avoid polluting page globals.
const iifeOpts = { ...sharedOpts, format: /** @type {"iife"} */ ("iife") };

const entries = [
  // Background service worker
  {
    entryPoints: [resolve(__dir, "src/background/service-worker.ts")],
    outfile: resolve(__dir, `${outDir}/background.js`),
  },
  // Content scripts (ISOLATED world — ESM is fine)
  {
    entryPoints: [resolve(__dir, "src/content/claude.ts")],
    outfile: resolve(__dir, `${outDir}/content/claude.js`),
  },
  {
    entryPoints: [resolve(__dir, "src/content/chatgpt.ts")],
    outfile: resolve(__dir, `${outDir}/content/chatgpt.js`),
  },
  {
    entryPoints: [resolve(__dir, "src/content/gemini.ts")],
    outfile: resolve(__dir, `${outDir}/content/gemini.js`),
  },
  // Page-world hooks (MAIN world — IIFE to stay self-contained)
  {
    ...iifeOpts,
    entryPoints: [resolve(__dir, "src/page-hook/claude-hook.ts")],
    outfile: resolve(__dir, `${outDir}/page-hook/claude-hook.js`),
  },
  {
    ...iifeOpts,
    entryPoints: [resolve(__dir, "src/page-hook/chatgpt-hook.ts")],
    outfile: resolve(__dir, `${outDir}/page-hook/chatgpt-hook.js`),
  },
  {
    ...iifeOpts,
    entryPoints: [resolve(__dir, "src/page-hook/gemini-hook.ts")],
    outfile: resolve(__dir, `${outDir}/page-hook/gemini-hook.js`),
  },
];

mkdirSync(resolve(__dir, `${outDir}/content`), { recursive: true });
mkdirSync(resolve(__dir, `${outDir}/page-hook`), { recursive: true });
mkdirSync(resolve(__dir, `${outDir}/icons`), { recursive: true });

copyFileSync(
  resolve(__dir, manifestSrc),
  resolve(__dir, `${outDir}/manifest.json`),
);

// Copy icon assets
for (const f of readdirSync(resolve(__dir, "icons"))) {
  copyFileSync(
    resolve(__dir, "icons", f),
    resolve(__dir, `${outDir}/icons/${f}`),
  );
}

if (watch) {
  const ctxs = await Promise.all(
    entries.map((e) => esbuild.context({ ...sharedOpts, ...e })),
  );
  await Promise.all(ctxs.map((c) => c.watch()));
} else {
  await Promise.all(entries.map((e) => esbuild.build({ ...sharedOpts, ...e })));
}
