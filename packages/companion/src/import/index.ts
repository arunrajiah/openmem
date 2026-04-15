import type { Repo } from "../db/repo.js";
import { readInputFiles } from "./utils.js";
import { parseOpenAIExport } from "./openai.js";
import { parseAnthropicExport } from "./anthropic.js";
import { parseGeminiTakeout } from "./gemini.js";
import type { ImportResult } from "./types.js";

export type ImportProvider = "openai" | "anthropic" | "gemini";

const PROVIDER_FILES: Record<ImportProvider, string[]> = {
  openai: ["conversations.json"],
  anthropic: ["conversations.json"],
  gemini: [
    "Gemini Apps Activity.json",
    "Gemini Apps Activity/Gemini Apps Activity.json",
    "Takeout/Gemini Apps Activity/Gemini Apps Activity.json",
    "My Activity.json",
    "Bard Activity/My Activity.json",
    "Takeout/Bard Activity/My Activity.json",
  ],
};

type ParserFn = (json: string) => Generator<import("@openmem/shared").IngestTurn>;

const PARSERS: Record<ImportProvider, ParserFn> = {
  openai: parseOpenAIExport,
  anthropic: parseAnthropicExport,
  gemini: parseGeminiTakeout,
};

/**
 * Run an import for a given provider. Reads from `inputPath` (ZIP, directory
 * or plain JSON file), parses, and ingests into the repo.
 */
export async function runImport(
  provider: ImportProvider,
  inputPath: string,
  repo: Repo,
  onProgress?: (msg: string) => void,
): Promise<ImportResult> {
  const log = onProgress ?? (() => undefined);
  const result: ImportResult = {
    conversations: 0,
    messages: 0,
    deduplicated: 0,
    errors: [],
  };

  log(`Reading ${provider} export from ${inputPath} …`);

  let files: Map<string, string>;
  try {
    files = readInputFiles(inputPath);
  } catch (err) {
    result.errors.push(String(err));
    return result;
  }

  log(`Found ${files.size} file(s) in archive.`);

  // Find the correct file for this provider
  const candidates = PROVIDER_FILES[provider];
  let json: string | null = null;
  let foundName: string | null = null;

  for (const candidate of candidates) {
    // Try exact match first, then suffix match (handles nested paths)
    for (const [name, content] of files) {
      if (name === candidate || name.endsWith("/" + candidate)) {
        json = content;
        foundName = name;
        break;
      }
    }
    if (json) break;
  }

  if (!json) {
    const msg =
      `Could not find expected export file for ${provider}. ` +
      `Looked for: ${candidates.join(", ")}. ` +
      `Files present: ${[...files.keys()].join(", ")}`;
    result.errors.push(msg);
    return result;
  }

  log(`Parsing ${foundName} …`);

  const parser = PARSERS[provider];
  let gen: Generator<import("@openmem/shared").IngestTurn>;
  try {
    gen = parser(json);
  } catch (err) {
    result.errors.push(`Parse error: ${String(err)}`);
    return result;
  }

  const seenConvIds = new Set<string>();
  let msgCount = 0;

  for (const turn of gen) {
    try {
      const r = repo.ingestTurn(turn);
      if (!seenConvIds.has(r.conversationId)) {
        seenConvIds.add(r.conversationId);
        result.conversations++;
      }
      if (r.deduplicated) {
        result.deduplicated++;
      } else {
        result.messages++;
        msgCount++;
      }
      if (msgCount % 500 === 0) {
        log(`  … ${msgCount} messages imported`);
      }
    } catch (err) {
      result.errors.push(`Ingest error on turn: ${String(err)}`);
    }
  }

  return result;
}

export { ImportResult };
