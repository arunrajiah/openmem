import type { Conversation, Message } from "@openmem/shared";

export function conversationToMarkdown(
  conv: Conversation,
  messages: Message[],
): string {
  const title = conv.title ?? "Untitled conversation";
  const lines: string[] = [
    `# ${title}`,
    "",
    `**Provider:** ${conv.provider}`,
    `**Model:** ${conv.model ?? "unknown"}`,
    `**Date:** ${new Date(conv.createdAt).toISOString()}`,
    conv.tags.length ? `**Tags:** ${conv.tags.join(", ")}` : null,
    "",
    "---",
    "",
  ].filter((l): l is string => l !== null);

  for (const msg of messages) {
    const label =
      msg.role === "user"
        ? "**You**"
        : `**${conv.model ?? "Assistant"}**`;
    lines.push(`### ${label}`);
    lines.push(`*${new Date(msg.createdAt).toISOString()}*`);
    lines.push("");
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}
