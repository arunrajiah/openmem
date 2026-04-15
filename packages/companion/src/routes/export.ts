import type { FastifyInstance } from "fastify";
import type { Repo } from "../db/repo.js";
import { conversationToMarkdown } from "../lib/markdown.js";

export function registerExportRoutes(app: FastifyInstance, repo: Repo): void {
  app.get("/conversations/:id/export.md", async (req, reply) => {
    const { id } = req.params as { id: string };
    const conv = repo.getConversation(id);
    if (!conv) return reply.code(404).send({ error: "not_found" });

    const messages = repo.listMessages(id);
    const md = conversationToMarkdown(conv, messages);
    const filename = `${(conv.title ?? "conversation")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()
      .slice(0, 80)}.md`;

    return reply
      .header("content-type", "text/markdown; charset=utf-8")
      .header("content-disposition", `attachment; filename="${filename}"`)
      .send(md);
  });
}
