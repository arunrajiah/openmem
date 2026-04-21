# OpenMem

**Local-first, cross-provider AI conversation memory.**

Capture your chats from Claude, ChatGPT, and Gemini into one unified,
searchable memory that lives entirely on your machine. No account. No cloud.
No subscription.

[![CI](https://github.com/arunrajiah/openmem/actions/workflows/ci.yml/badge.svg)](https://github.com/arunrajiah/openmem/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Sponsor](https://img.shields.io/github/sponsors/arunrajiah?label=Sponsor&logo=GitHub)](https://github.com/sponsors/arunrajiah)

---

## Why

Every AI provider silos your conversation history. After a year of switching
between Claude, ChatGPT, and Gemini you have thousands of conversations you can
never search across. OpenMem fixes that — one local database, one search bar,
every conversation.

---

## Quickstart

### 1. Start the companion app

```bash
# Requires Node.js 20+
npx openmem
# → OpenMem companion listening on http://127.0.0.1:7410
# → Data: ~/.openmem/openmem.db
```

Open **http://127.0.0.1:7410** in your browser to see the search UI.

> Override the data directory: `OPENMEM_DATA_DIR=/path/to/dir npx openmem`  
> Override the port: `OPENMEM_PORT=7411 npx openmem`

### 2. Install the browser extension

**Option A — Chrome Web Store** *(recommended — auto-updates)*

> 🏪 [Install from Chrome Web Store](https://chrome.google.com/webstore/detail/openmem/TODO_EXTENSION_ID)

**Option B — Load unpacked** *(developer / latest build)*

```bash
git clone https://github.com/openmem/openmem
cd openmem
pnpm install
pnpm --filter @openmem/shared build
pnpm --filter @openmem/extension build
```

Then in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select `packages/extension/dist/`

### 3. Chat — conversations appear automatically

Go to [claude.ai](https://claude.ai), [chatgpt.com](https://chatgpt.com), or
[gemini.google.com](https://gemini.google.com) and have a conversation.
Come back to **http://127.0.0.1:7410** — it should appear within seconds.

### 4. Import existing history (optional)

```bash
# OpenAI: ChatGPT → Settings → Data controls → Export data
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
│                        Browser                              │
│                                                             │
│  claude.ai  ──┐                                             │
│  chatgpt.com ─┤  Extension (MV3)                            │
│  gemini.com ──┘  • Page-world fetch hook (MAIN world)       │
│                  • Content script relay (ISOLATED world)    │
│                  • Background service worker          POST  │
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

**Data flow:**
1. Page-world script patches `window.fetch` before any page code runs
2. On a completion request it tees the response stream
3. Accumulates SSE events; fires a `CustomEvent` when the turn is complete
4. Content script relays to background service worker via `chrome.runtime.sendMessage`
5. Background SW POSTs to companion `/ingest`
6. Companion upserts conversation + message with dedup

**Dedup** is idempotent by `provider_message_id` or `(conversation_id, role, content_hash)` — re-importing the same export is safe.

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
  bump-version.mjs   Stamp a version across all packages + manifest
docs/
  quickstart.md
  architecture.md
  legal.md
  privacy-policy.md
  store-listing.md
  release-process.md
```

---

## Principles

- **Local-first.** Nothing leaves your machine unless you export it.
- **Privacy by default.** No telemetry. No analytics. Data at `~/.openmem/`.
- **Provider-neutral.** Claude, ChatGPT, Gemini — all equal citizens.
- **Small surface.** SQLite + REST, no heavy framework.
- **Legal stance.** We capture only data the authenticated user is already
  viewing. See [docs/legal.md](docs/legal.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All PRs welcome — especially:
- Firefox extension support
- Additional provider adapters (Perplexity, Mistral, …)
- Anthropic / Gemini export format updates (they change occasionally)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## Sponsorship

OpenMem is free, open-source, and built entirely in spare time.
If it saves you time or you just want to see it keep going, a sponsorship goes a long way.

**[❤️ Sponsor on GitHub](https://github.com/sponsors/arunrajiah)**

What sponsorships help fund:

- Chrome Web Store developer fees
- Time to build Firefox support, encryption, and the Tauri desktop app
- Keeping the project dependency-free and well-maintained

Every amount helps — thank you!

---

## License

MIT © OpenMem contributors
