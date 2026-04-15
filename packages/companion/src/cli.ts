#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";
import { openDb } from "./db/index.js";
import { Repo } from "./db/repo.js";
import { runImport } from "./import/index.js";
import type { ImportProvider } from "./import/index.js";

const IMPORT_PROVIDERS: ImportProvider[] = ["openai", "anthropic", "gemini"];

const USAGE = `
Usage:
  openmem                              Start the companion server
  openmem import <provider> <path>     Import from a data export

Providers:
  openai      OpenAI data export ZIP or conversations.json
  anthropic   Anthropic data export ZIP or conversations.json
  gemini      Google Takeout ZIP or Gemini Apps Activity.json

Options:
  --help, -h  Show this help

Environment:
  OPENMEM_DATA_DIR   Data directory (default: ~/.openmem)
  OPENMEM_HOST       Listen host    (default: 127.0.0.1)
  OPENMEM_PORT       Listen port    (default: 7410)
`.trim();

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { help: { type: "boolean", short: "h" } },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const [command, ...rest] = positionals;

  // ── import subcommand ──────────────────────────────────────────────────────
  if (command === "import") {
    const [providerArg, inputPath] = rest;

    if (!providerArg || !inputPath) {
      console.error("Usage: openmem import <provider> <path>\n");
      console.error(`Providers: ${IMPORT_PROVIDERS.join(", ")}`);
      process.exit(1);
    }

    if (!IMPORT_PROVIDERS.includes(providerArg as ImportProvider)) {
      console.error(`Unknown provider "${providerArg}". Valid: ${IMPORT_PROVIDERS.join(", ")}`);
      process.exit(1);
    }

    const config = loadConfig();
    const db = openDb(config.dbPath);
    const repo = new Repo(db);

    const result = await runImport(
      providerArg as ImportProvider,
      inputPath,
      repo,
      (msg) => console.log(msg),
    );

    db.close();

    console.log("\n── Import complete ─────────────────────");
    console.log(`  Conversations : ${result.conversations}`);
    console.log(`  Messages      : ${result.messages}`);
    console.log(`  Deduplicated  : ${result.deduplicated}`);
    if (result.errors.length) {
      console.log(`  Errors        : ${result.errors.length}`);
      for (const e of result.errors) console.error(`    ✖ ${e}`);
    }
    process.exit(result.errors.length ? 1 : 0);
  }

  // ── server (default) ───────────────────────────────────────────────────────
  if (command !== undefined && command !== "serve") {
    console.error(`Unknown command "${command}". Run openmem --help for usage.`);
    process.exit(1);
  }

  const config = loadConfig();
  const app = await buildServer(config);
  await app.listen({ host: config.host, port: config.port });
  app.log.info(
    `OpenMem companion listening on http://${config.host}:${config.port}  data: ${config.dataDir}`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
