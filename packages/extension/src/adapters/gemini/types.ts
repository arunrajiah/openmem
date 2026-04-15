/**
 * Types for gemini.google.com's internal API.
 *
 * Gemini's web app uses a non-standard streaming format. The adapter
 * tries fetch interception first; if the response can't be parsed it
 * falls back to the DOM observer (see dom-observer.ts).
 *
 * Endpoint patterns (may change with Gemini updates):
 *   POST https://gemini.google.com/api/generate
 *
 * The response body is a JSON array delimited by XSSI prefix: )]}'\n
 * then a series of JSON arrays, each line being one streamed chunk.
 *
 * Each chunk looks like:
 *   [[[candidatesJson, null, null, null, null, modelVersionArray]]]
 *
 * NOTE: These types are reverse-engineered from public network traces and
 * may require updates when Gemini updates its internal API.
 */

export interface GeminiChunk {
  /** First element is the candidates array */
  candidates?: GeminiCandidate[];
  /** Sometimes a flat candidates array */
  [0]?: unknown[];
}

export interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
    role?: string;
  };
  finishReason?: string;
}

/**
 * Parsed from a Gemini response — the accumulated text from all chunks.
 */
export interface GeminiParsedResponse {
  text: string;
  model?: string;
  conversationId?: string;
  responseId?: string;
}

/**
 * DOM observer event emitted when a complete Gemini turn is captured.
 */
export interface GeminiDOMTurn {
  role: "user" | "model";
  text: string;
  index: number; // turn index within the conversation
}
