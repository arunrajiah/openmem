/**
 * Types for claude.ai's internal streaming API.
 * These follow the Anthropic Messages API SSE event shapes used by the
 * claude.ai web client. Typed loosely so the adapter degrades gracefully
 * if Anthropic changes internal fields.
 */

export interface MessageStartEvent {
  type: "message_start";
  message: {
    id: string;
    role: "assistant";
    model: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
}

export interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block: { type: string; text?: string };
}

export interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: { type: string; text?: string };
}

export interface ContentBlockStopEvent {
  type: "content_block_stop";
  index: number;
}

export interface MessageDeltaEvent {
  type: "message_delta";
  delta: { stop_reason?: string };
  usage?: { output_tokens?: number };
}

export interface MessageStopEvent {
  type: "message_stop";
}

export type ClaudeSSEEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent;

/**
 * Parsed from the POST body of the completion request.
 * Claude.ai may use either a legacy prompt string or a messages array.
 */
export interface ClaudeCompletionRequest {
  /** Structured messages (newer format) */
  messages?: Array<{ role: string; content: string | unknown[] }>;
  /** Legacy prompt string (Human/Assistant) */
  prompt?: string;
  model?: string;
  /** Internal conversation parent UUID */
  parent_message_uuid?: string;
  timezone?: string;
}
