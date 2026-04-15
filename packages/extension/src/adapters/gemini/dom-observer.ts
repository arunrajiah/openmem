/**
 * DOM-based observer for gemini.google.com.
 *
 * Used as a fallback when the fetch-based parser cannot decode the response
 * body, AND as the primary means of capturing user messages (which are not
 * always available in the request body intercepted by the hook).
 *
 * Gemini renders its conversation using custom HTML elements:
 *   <user-query>   — wraps a user message
 *   <model-response> — wraps a model response
 *
 * These are custom elements, making them more stable than class-based selectors.
 *
 * IMPORTANT: These selectors need periodic verification against the live
 * Gemini UI. If capture stops working, open DevTools on gemini.google.com
 * and run: document.querySelectorAll('user-query, model-response')
 *
 * Streaming detection: a response is "done" when the element loses its
 * data-is-streaming / data-is-placeholder attribute, or when it gains
 * data-complete. We also use a settle timer (1.5 s) as a last resort.
 */

import type { CapturedTurnEvent } from "../../lib/messaging.js";

// ── Selectors — update if Gemini changes its DOM structure ──────────────────
// Container selectors kept for reference; used to scope future queries.
// prettier-ignore
const _CONVERSATION_CONTAINER_SELECTORS = [ // eslint-disable-line @typescript-eslint/no-unused-vars
  "infinite-scroller",          // outer scroll container
  ".conversation-container",
  "[data-test-id='conversation-container']",
];

const USER_QUERY_SELECTORS = [
  "user-query",                  // custom element (most stable)
  ".user-query",
  "[data-turn-role='user']",
];

const MODEL_RESPONSE_SELECTORS = [
  "model-response",              // custom element (most stable)
  ".model-response",
  "[data-turn-role='model']",
];

// Text content lives inside these sub-elements
const USER_TEXT_SELECTORS = [
  ".query-text",
  "p",
  "[data-prompt-text]",
];

const RESPONSE_TEXT_SELECTORS = [
  "message-content",
  ".model-response-text",
  ".response-text",
  "p",
];

// Attribute/class that signals a response is still streaming
const STREAMING_INDICATORS = [
  "[data-is-streaming]",
  "[data-is-placeholder]",
  ".loading",
  ".streaming",
];

const SETTLE_MS = 1500; // time with no mutations before declaring "done"

export type OnTurnCaptured = (event: CapturedTurnEvent) => void;

interface ObservedTurn {
  element: Element;
  role: "user" | "model";
  settleTimer: ReturnType<typeof setTimeout> | null;
  emitted: boolean;
  index: number;
}

export class GeminiDOMObserver {
  private observer: MutationObserver | null = null;
  private turns: ObservedTurn[] = [];
  private conversationId: string;
  private onCapture: OnTurnCaptured;

  constructor(conversationId: string, onCapture: OnTurnCaptured) {
    this.conversationId = conversationId;
    this.onCapture = onCapture;
  }

  start(): void {
    const root = document.body;
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.observer.observe(root, { childList: true, subtree: true, characterData: true });
    // Capture any turns already present on page load
    this.scanForTurns();
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.turns.forEach((t) => { if (t.settleTimer) clearTimeout(t.settleTimer); });
  }

  private handleMutations(_mutations: MutationRecord[]): void {
    this.scanForTurns();
    // Re-evaluate pending model responses on every mutation
    for (const turn of this.turns) {
      if (turn.role === "model" && !turn.emitted) {
        this.scheduleSettle(turn);
      }
    }
  }

  private scanForTurns(): void {
    const userEls = query(document, USER_QUERY_SELECTORS);
    const modelEls = query(document, MODEL_RESPONSE_SELECTORS);

    // Merge by document order
    const allEls: Array<{ el: Element; role: "user" | "model" }> = [
      ...userEls.map((el) => ({ el, role: "user" as const })),
      ...modelEls.map((el) => ({ el, role: "model" as const })),
    ].sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );

    for (let i = 0; i < allEls.length; i++) {
      const { el, role } = allEls[i]!;
      const existing = this.turns.find((t) => t.element === el);
      if (!existing) {
        const turn: ObservedTurn = {
          element: el,
          role,
          settleTimer: null,
          emitted: false,
          index: i,
        };
        this.turns.push(turn);

        if (role === "user") {
          // User turns are complete immediately
          this.emitTurn(turn);
        } else {
          this.scheduleSettle(turn);
        }
      }
    }
  }

  private scheduleSettle(turn: ObservedTurn): void {
    if (turn.emitted) return;
    if (turn.settleTimer) clearTimeout(turn.settleTimer);

    // If the element is still visibly streaming, wait longer
    const isStreaming = STREAMING_INDICATORS.some((sel) => turn.element.querySelector(sel));
    const delay = isStreaming ? SETTLE_MS * 2 : SETTLE_MS;

    turn.settleTimer = setTimeout(() => {
      if (!turn.emitted) this.emitTurn(turn);
    }, delay);
  }

  private emitTurn(turn: ObservedTurn): void {
    if (turn.emitted) return;

    const selectors =
      turn.role === "user" ? USER_TEXT_SELECTORS : RESPONSE_TEXT_SELECTORS;
    const text = extractText(turn.element, selectors);
    if (!text) return; // empty — don't emit

    turn.emitted = true;
    this.onCapture({
      type: "OPENMEM_CAPTURED_TURN",
      provider: "gemini",
      providerConversationId: this.conversationId,
      role: turn.role === "model" ? "assistant" : "user",
      content: text,
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function query(root: Element | Document, selectors: string[]): Element[] {
  for (const sel of selectors) {
    try {
      const els = Array.from(root.querySelectorAll(sel));
      if (els.length) return els;
    } catch {
      // invalid selector — skip
    }
  }
  return [];
}

function extractText(el: Element, selectors: string[]): string {
  // Try sub-selectors first
  for (const sel of selectors) {
    try {
      const sub = el.querySelector(sel);
      if (sub?.textContent?.trim()) return sub.textContent.trim();
    } catch {
      // invalid selector
    }
  }
  // Fall back to element's own text
  return el.textContent?.trim() ?? "";
}
