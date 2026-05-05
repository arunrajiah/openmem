# Changelog

All notable changes to OpenMem are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

---

## [1.1.0] — Unreleased

### Added

**Firefox extension support**
- `manifest.firefox.json` — Firefox MV3 manifest with `browser_specific_settings.gecko` (`id`, `strict_min_version: 116.0`)
- `build:firefox` and `build:watch:firefox` scripts — output to `packages/extension/dist-firefox/` with `firefox116` esbuild target
- CI: Firefox build step + `extension-firefox-<sha>` artifact upload
- Publish: AMO (`web-ext sign`) job in `publish.yml` runs in parallel with Chrome Web Store publish
- GitHub Release now attaches both `openmem-chrome-X.Y.Z.zip` and `openmem-firefox-X.Y.Z.zip`
- `scripts/bump-version.mjs` now stamps `manifest.firefox.json` alongside `manifest.json`
- Firefox load-unpacked instructions added to README Quickstart

**Community & governance**
- `.github/CODEOWNERS` — all PRs require maintainer review
- `.github/pull_request_template.md` — contributor checklist (lint, tests, adapter rules, migration rules)
- Branch protection on `main`: CI must pass, 1 code-owner approval required, stale reviews dismissed on push

---

## [1.0.0] — 2024-04-15

Initial public release. All six planned v1 phases complete.

### Added

**Core companion app (`@openmem/companion`)**
- Fastify HTTP server on `127.0.0.1:7410`
- SQLite database with WAL mode and FTS5 full-text search
- `POST /ingest` — accepts turns from the browser extension (single and batch)
- `GET /conversations` — list with provider/tag/pagination filters
- `GET /conversations/:id` — conversation detail with messages
- `GET /conversations/:id/export.md` — server-side Markdown export
- `PUT /conversations/:id/tags` — set tags on a conversation
- `GET /tags` — all tags with usage counts
- `GET /search` — BM25 full-text search with snippet highlighting
- `GET /stats` — database statistics (counts, size, date range)
- `GET /health` — liveness check
- Append-only migration system tracked in `schema_migrations` table
- Idempotent deduplication by `provider_message_id`, falling back to `(conversation_id, role, content_hash)`
- `openmem import openai <path>` — import OpenAI data export ZIP
- `openmem import anthropic <path>` — import Anthropic data export ZIP
- `openmem import gemini <path>` — import Google Takeout ZIP
- Serves built React web UI statically; SPA fallback for client-side routing

**Browser extension (`@openmem/extension`)**
- Manifest V3 extension with page-world fetch interception
- Claude (claude.ai) adapter — parses Anthropic Messages API SSE (message_start / content_block_delta / message_delta)
- ChatGPT (chatgpt.com) adapter — handles accumulated-text SSE format and new-conversation ID resolution
- Gemini (gemini.google.com) adapter — dual strategy: fetch interception + MutationObserver DOM fallback
- CustomEvent bridge between page world (MAIN) and content script (ISOLATED)
- Background service worker with queuing and retry for `/ingest` POST

**Web search UI (`@openmem/web`)**
- React 18 + Vite + Tailwind CSS SPA
- Debounced full-text search with BM25 snippet highlighting
- Provider and tag filter pills
- Conversation list and message viewer panels
- Inline tag editor with auto-save
- Markdown export button
- Settings panel with DB statistics and data path

**Shared types (`@openmem/shared`)**
- Zod schemas and TypeScript types for `IngestTurn`, `Conversation`, `Message`, `Provider`, `Role`, `Source`

**Infrastructure**
- pnpm workspaces monorepo
- 78 tests (45 companion, 33 extension) — 0 failures
- GitHub Actions CI (`ci.yml`) — lint, test, build all packages
- GitHub Actions publish (`publish.yml`) — Chrome Web Store auto-publish on version tags
- Version bump script (`scripts/bump-version.mjs`)

[Unreleased]: https://github.com/openmem/openmem/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/openmem/openmem/releases/tag/v1.0.0
