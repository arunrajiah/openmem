# Architecture

## Overview

OpenMem has three components:

```
┌──────────────────────┐     CustomEvent      ┌────────────────────────┐
│   Page world (MAIN)  │ ─────────────────►   │  Content script        │
│                      │                      │  (ISOLATED)            │
│  • Patches fetch()   │                      │  • Listens for events  │
│  • Tees SSE stream   │                      │  • Relays to SW        │
│  • Parses responses  │                      └─────────┬──────────────┘
│  • Fires CustomEvent │                                │ sendMessage
└──────────────────────┘                      ┌─────────▼──────────────┐
                                              │  Background SW         │
                                              │  • Queues turns        │
                                              │  • POST /ingest        │
                                              └─────────┬──────────────┘
                                                        │ HTTP
                                              ┌─────────▼──────────────┐
                                              │  Companion app :7410   │
                                              │  • Fastify             │
                                              │  • better-sqlite3      │
                                              │  • FTS5 index          │
                                              └────────────────────────┘
```

## Packages

### `@openmem/shared`

TypeScript types and Zod schemas shared between the companion and the
extension. A single source of truth for `IngestTurn`, `Conversation`,
`Message`, etc.

No runtime dependencies beyond `zod`.

### `@openmem/companion`

Node.js 20 HTTP server (Fastify). Responsibilities:

- Accept `POST /ingest` turns from the extension
- Persist to SQLite with FTS5 full-text search
- Serve the React web UI statically
- Provide REST endpoints for the UI
- Run `openmem import` CLI subcommand

**Database schema** (see `packages/companion/src/db/migrations.ts`):

```sql
conversation   — one row per conversation; tags stored as JSON array
message        — one row per turn; FTS5 trigger-synced; deduped by hash
message_fts    — FTS5 virtual table (BM25 ranking, snippet())
provider_account — multi-account support (future)
raw_payload    — stores original captured JSON for re-parsing
schema_migrations — applied migration tracking
```

WAL mode + `synchronous = NORMAL` for fast concurrent reads.

### `@openmem/extension`

Manifest V3 browser extension. Three execution contexts:

| Context | World | File | Purpose |
|---|---|---|---|
| Page hook | MAIN | `page-hook/*.js` | Patches `window.fetch`; reads response streams |
| Content script | ISOLATED | `content/*.js` | Bridges page ↔ background via CustomEvent / sendMessage |
| Background | Service Worker | `background.js` | Receives turns, POSTs to companion |

**Per-provider adapters** (`src/adapters/{claude,chatgpt,gemini}/`):
- URL pattern matching
- Request body parsing (user turn extraction)
- SSE stream parsing (assistant turn extraction)
- Independently unit-tested with mock data

**Gemini** uses two parallel strategies: fetch interception (metadata-rich)
and DOM observation via `MutationObserver` on `<user-query>` / `<model-response>`
custom elements (resilient to API changes).

### `@openmem/web`

React 18 + Vite + Tailwind CSS SPA. Built into `packages/companion/public/`
so the companion serves it at its root URL.

Components:
```
App             — layout, routing state, data fetching
SearchBar       — debounced search input
FilterBar       — provider + tag pills
ConversationList / SearchResultList — left panel content
ConversationViewer — right panel: header, tags, messages, export
MessageBubble   — single turn rendering
TagEditor       — add/remove tags with auto-save
SettingsPanel   — modal: DB stats, data path, capture info
ProviderBadge   — colour-coded provider chip
```

## Data flow

### Live capture

```
User sends message on claude.ai
  │
  ▼
fetch() intercepted by page-world hook
  │ tees response stream (page gets one copy, hook gets the other)
  │
  ├─► Parse request body → CapturedTurnEvent (user role)
  │
  └─► Accumulate SSE chunks → parseAssistantSSE() → CapturedTurnEvent (assistant role)
                                          │
                                          ▼
                           window.dispatchEvent(CustomEvent)
                                          │
                               content script listens
                                          │
                           chrome.runtime.sendMessage(INGEST_TURN)
                                          │
                              background SW receives
                                          │
                          POST /ingest → Fastify → Repo.ingestTurn()
                                          │
                              SQLite upsert + FTS5 trigger
```

### Import

```
openmem import openai ~/export.zip
  │
  ▼
readInputFiles() — ZIP or directory → Map<filename, string>
  │
  ├─► Find conversations.json
  │
  └─► parseOpenAIExport() → Generator<IngestTurn>
                   │
                   ▼ (each turn)
             Repo.ingestTurn()    ← idempotent (dedup by providerMessageId or hash)
```

## Deduplication

Two layers:
1. `provider_message_id` — if the provider gives us a stable message ID, we
   use it as a unique key. Re-importing or re-capturing the same message is a no-op.
2. `(conversation_id, role, SHA-256(content)[0:32])` — content hash fallback for
   messages without a provider ID (DOM-captured Gemini turns, legacy prompt formats).

## Extension security model

- Bound to `127.0.0.1` only — not accessible from the internet
- CORS allows `chrome-extension://` origins (required for extension POSTs)
- Page hook: only intercepts requests matching known provider URL patterns
- No data is transmitted off-device
- See `docs/legal.md` for the full legal stance
