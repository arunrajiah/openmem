import type { FastifyInstance } from "fastify";
import type { Repo } from "../db/repo.js";

export function registerStatsRoutes(app: FastifyInstance, repo: Repo): void {
  app.get("/stats", async (_req, reply) => {
    return reply.send(repo.getStats());
  });
}
