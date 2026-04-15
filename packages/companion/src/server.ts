import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import type { Config } from "./config.js";
import { openDb } from "./db/index.js";
import { Repo } from "./db/repo.js";
import { registerIngestRoutes } from "./routes/ingest.js";
import { registerConversationRoutes } from "./routes/conversations.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerTagRoutes } from "./routes/tags.js";
import { registerExportRoutes } from "./routes/export.js";
import { registerStatsRoutes } from "./routes/stats.js";

// Resolve the `public/` dir relative to this package, not cwd.
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

export async function buildServer(config: Config) {
  const db = openDb(config.dbPath);
  const repo = new Repo(db);

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

  // Browser extensions run from chrome-extension:// origins — allow any
  // localhost / extension origin to talk to us. We're bound to 127.0.0.1 anyway.
  await app.register(cors, { origin: true });

  // ── API routes ────────────────────────────────────────────────────────────
  app.get("/health", async () => ({ ok: true, version: "0.0.0" }));
  registerIngestRoutes(app, repo);
  registerConversationRoutes(app, repo);
  registerSearchRoutes(app, repo);
  registerTagRoutes(app, repo);
  registerExportRoutes(app, repo);
  registerStatsRoutes(app, repo);

  // ── Static web UI ─────────────────────────────────────────────────────────
  // Only mount if the build output directory exists (i.e. web package was built).
  if (existsSync(PUBLIC_DIR)) {
    await app.register(staticFiles, {
      root: PUBLIC_DIR,
      prefix: "/",
      // Don't throw on missing files — we handle them with the wildcard below.
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-cache");
      },
    });

    // SPA fallback: any unmatched GET that isn't an API path serves index.html
    app.setNotFoundHandler(async (req, reply) => {
      if (req.method !== "GET") {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html");
    });
  }

  app.addHook("onClose", async () => {
    db.close();
  });

  return app;
}
