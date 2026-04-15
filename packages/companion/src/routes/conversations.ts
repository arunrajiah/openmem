import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repo } from "../db/repo.js";

const ListQuery = z.object({
  provider: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function registerConversationRoutes(app: FastifyInstance, repo: Repo): void {
  app.get("/conversations", async (req, reply) => {
    const q = ListQuery.safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "invalid_query" });
    return reply.send({ conversations: repo.listConversations(q.data) });
  });

  app.get("/conversations/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv = repo.getConversation(id);
    if (!conv) return reply.code(404).send({ error: "not_found" });
    const messages = repo.listMessages(id);
    return reply.send({ conversation: conv, messages });
  });
}
