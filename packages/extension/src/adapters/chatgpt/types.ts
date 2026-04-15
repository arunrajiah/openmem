/**
 * Types for chatgpt.com's internal conversation API.
 * Endpoint: POST https://chatgpt.com/backend-api/conversation
 * Response:  SSE stream; each event carries the full accumulated message so far.
 */

export interface ChatGPTContentPart {
  content_type: string;
  /** Present on text parts */
  asset_pointer?: string;
}

export interface ChatGPTContent {
  content_type: "text" | "multimodal_text" | "code" | "tether_browsing_display" | string;
  /** Text messages have an array of string parts */
  parts?: Array<string | ChatGPTContentPart>;
}

export interface ChatGPTAuthor {
  role: "user" | "assistant" | "system" | "tool";
}

export interface ChatGPTMessageMeta {
  model_slug?: string;
  finish_details?: { type: string };
  is_complete?: boolean;
}

export interface ChatGPTMessage {
  id: string;
  author: ChatGPTAuthor;
  content: ChatGPTContent;
  status: "in_progress" | "finished_successfully" | "finished_partial_completion" | string;
  metadata: ChatGPTMessageMeta;
  create_time?: number;
}

/** Shape of each non-[DONE] SSE data payload */
export interface ChatGPTSSEEvent {
  message: ChatGPTMessage;
  conversation_id: string;
  error: string | null;
}

/** Shape of the POST /backend-api/conversation request body */
export interface ChatGPTRequest {
  action: string;
  messages?: Array<{
    id: string;
    author: { role: string };
    content: {
      content_type: string;
      parts?: Array<string | Record<string, unknown>>;
    };
    metadata?: Record<string, unknown>;
  }>;
  conversation_id?: string;
  parent_message_id?: string;
  model?: string;
}
