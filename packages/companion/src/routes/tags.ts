import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repo } from "../db/repo.js";

const SetTagsBody = z.object({
  tags: z.array(z.string().max(64)).max(50),
});

export function registerTagRoutes(app: FastifyInstance, repo: Repo): void {
  // List all tags in use with counts
  app.get("/tags", async (_req, reply) => {
    return reply.send({ tags: repo.listAllTags() });
  });

  // Replace the tag list for a conversation
  app.put("/conversations/:id/tags", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = SetTagsBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const conv = repo.getConversation(id);
    if (!conv) return reply.code(404).send({ error: "not_found" });

    repo.setTags(id, body.data.tags);
    return reply.send({ ok: true, tags: body.data.tags });
  });
}
