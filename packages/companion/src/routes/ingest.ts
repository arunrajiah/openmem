import type { FastifyInstance } from "fastify";
import { IngestBatch, IngestTurn } from "@openmem/shared";
import type { Repo } from "../db/repo.js";

export function registerIngestRoutes(app: FastifyInstance, repo: Repo): void {
  app.post("/ingest", async (req, reply) => {
    // Accept either a single turn or a batch
    const body = req.body as unknown;
    const asBatch = IngestBatch.safeParse(body);
    const asSingle = IngestTurn.safeParse(body);

    let turns;
    if (asBatch.success) {
      turns = asBatch.data.turns;
    } else if (asSingle.success) {
      turns = [asSingle.data];
    } else {
      return reply.code(400).send({
        error: "invalid_body",
        details: asBatch.error.issues,
      });
    }

    const results = turns.map((t) => repo.ingestTurn(t));
    return reply.send({
      ingested: results.filter((r: { deduplicated: boolean }) => !r.deduplicated).length,
      deduplicated: results.filter((r: { deduplicated: boolean }) => r.deduplicated).length,
      results,
    });
  });
}
