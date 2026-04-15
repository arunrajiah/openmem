# OpenMem

**Local-first, cross-provider AI conversation memory.**

Capture your chats from Claude, ChatGPT, Gemini, and others into one unified,
searchable memory that lives entirely on your machine.

[![CI](https://github.com/openmem/openmem/actions/workflows/ci.yml/badge.svg)](https://github.com/openmem/openmem/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Why

Every AI provider silos your conversation history. After a year of switching
between Claude, ChatGPT, and Gemini you have thousands of conversations you can
never search across. OpenMem fixes that — one local database, one search bar,
every conversation.

---

## Quickstart

### 1. Install the companion app

```bash
# Requires Node.js 20+
npx openmem
# Starts on http://127.0.0.1:7410
# Data lives at ~/.openmem/openmem.db
```

Open **http://127.0.0.1:7410** in your browser to see the search UI.

### 2. Install the browser extension

1. Build the extension (one-time):

```bash
git clone https://github.com/openmem/openmem
cd openmem
pnpm install
pnpm --filter @openmem/extension build
```

2. Open Chrome → `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select `packages/extension/dist/`

The extension now captures conversations automatically from claude.ai,
chatgpt.com, and gemini.google.com whenever you chat.

### 3. Import existing history

Already have years of chat history? Import your provider exports:

```bash
# OpenAI: Settings → Data controls → Export data → download ZIP
npx openmem import openai ~/Downloads/openai-export.zip

# Anthropic: privacy.anthropic.com → Export Data
npx openmem import anthropic ~/Downloads/anthropic-export.zip

# Google Takeout: myaccount.google.com → Data & Privacy → Download data
# Select "Gemini Apps Activity"
npx openmem import gemini ~/Downloads/takeout.zip
```

---

## Features

| Feature | Status |
|---|---|
| Live capture: Claude (claude.ai) | ✅ |
| Live capture: ChatGPT (chatgpt.com) | ✅ |
| Live capture: Gemini (gemini.google.com) | ✅ |
| Import: OpenAI data export | ✅ |
| Import: Anthropic data export | ✅ |
| Import: Google Takeout (Gemini) | ✅ |
| Full-text search (FTS5 / BM25) | ✅ |
| Filter by provider, tag, date | ✅ |
| Conversation viewer | ✅ |
| Export conversation to Markdown | ✅ |
| Tags | ✅ |
| Encrypted database at rest | 🗓 v1.1 |
| Firefox extension support | 🗓 v1.1 |
| Tauri desktop app | 🗓 v2 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                │
│                                                             │
│  claude.ai ──┐                                              │
│  chatgpt.com ─┤  Extension (MV3)                            │
│  gemini.com ──┘  • Page-world fetch hook                    │
│                  • Content script relay              POST   │
│                  • Background service worker ──────────────►│
└──────────────────────────────────────────────────────────── │
                                                              │
┌──────────────────────────────────────────────────────────── ┘
│                  Companion app  :7410                        │
│                                                             │
│  Fastify ──► /ingest  ──► Repo ──► SQLite (WAL, FTS5)       │
│             /conversations                                  │
│             /search                                         │
│             /tags                                           │
│             /stats                                          │
│             /conversations/:id/export.md                    │
│             /* ──► React SPA (served statically)            │
└─────────────────────────────────────────────────────────────┘
```

**Data flow (live capture):**
1. Page-world script patches `window.fetch` before any page code runs
2. On a completion request, it tees the response stream
3. Accumulates SSE events; fires a `CustomEvent` when the turn is complete
4. Content script relays to background service worker via `chrome.runtime.sendMessage`
5. Background SW POSTs to companion `/ingest`
6. Companion upserts conversation + message with dedup

**Deduplication** is idempotent by `(provider_message_id)` or `(conversation_id, role, content_hash)` — re-importing the same export is safe.

---

## Development

```bash
git clone https://github.com/openmem/openmem
cd openmem
pnpm install

# Build shared types (required once)
pnpm --filter @openmem/shared build

# Terminal 1 — companion + hot reload
pnpm --filter @openmem/companion dev

# Terminal 2 — web UI with HMR (proxies API to :7410)
pnpm --filter @openmem/web dev         # http://localhost:5173

# Extension — watch mode
pnpm --filter @openmem/extension build:watch

# Tests
pnpm test
```

### Repository layout

```
packages/
  companion/     Node.js local server, SQLite, REST API, import CLI
  extension/     Browser extension (Manifest V3, esbuild)
  web/           React search UI (Vite + Tailwind)
  shared/        Zod schemas + TypeScript types shared across packages
scripts/
docs/
  quickstart.md
  architecture.md
  legal.md
```

---

## REST API

The companion exposes a simple REST API on `127.0.0.1:7410`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/stats` | DB statistics |
| `POST` | `/ingest` | Ingest a turn or batch |
| `GET` | `/conversations` | List conversations (`?provider=&tag=&limit=&offset=`) |
| `GET` | `/conversations/:id` | Get conversation + messages |
| `GET` | `/conversations/:id/export.md` | Export as Markdown |
| `PUT` | `/conversations/:id/tags` | Set tags `{ tags: string[] }` |
| `GET` | `/tags` | All tags with counts |
| `GET` | `/search` | FTS5 search (`?q=&provider=&from=&to=&limit=`) |

---

## Principles

- **Local-first.** Nothing leaves your machine unless you export it.
- **Privacy by default.** Data lives at `~/.openmem/`. No telemetry.
- **Provider-neutral.** Claude, ChatGPT, Gemini — all equal citizens.
- **Small surface.** SQLite + REST, no heavy framework.
- **Legal stance.** We capture only data the authenticated user is already
  viewing. See [docs/legal.md](docs/legal.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All PRs welcome — especially:
- Firefox extension support
- Additional provider adapters (Perplexity, Mistral, …)
- Anthropic data export format updates (they change occasionally)
- Gemini Takeout format verification (see `packages/extension/src/adapters/gemini/`)

---

## License

MIT © OpenMem contributors
