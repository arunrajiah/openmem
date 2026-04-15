/**
 * Minimal SSE parser for ReadableStream<Uint8Array>.
 * Yields parsed JSON data objects; skips non-data lines, [DONE], and malformed JSON.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Split on double-newline event boundaries
      const parts = buffer.split("\n\n");
      // Last element may be an incomplete event — keep it in the buffer
      buffer = parts.pop() ?? "";

      for (const eventBlock of parts) {
        for (const line of eventBlock.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            yield JSON.parse(raw);
          } catch {
            // malformed JSON — skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a raw SSE string (for testing without a ReadableStream).
 */
export function* parseSSEString(text: string): Generator<unknown> {
  const events = text.split("\n\n");
  for (const eventBlock of events) {
    for (const line of eventBlock.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        yield JSON.parse(raw);
      } catch {
        // skip
      }
    }
  }
}
