import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repo } from "../db/repo.js";

const SearchQuery = z.object({
  q: z.string().min(1),
  provider: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function registerSearchRoutes(app: FastifyInstance, repo: Repo): void {
  app.get("/search", async (req, reply) => {
    const q = SearchQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query" });

    const { q: query, provider, from, to, limit, offset } = q.data;
    const result = repo.search({ query, provider, from, to, limit, offset });
    return reply.send({ query, ...result });
  });
}
