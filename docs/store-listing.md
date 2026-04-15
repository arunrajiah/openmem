# Chrome Web Store Listing

This document contains the copy, metadata, and asset checklist for the
OpenMem Chrome Web Store listing. Update it whenever the listing changes.

---

## Metadata

| Field | Value |
|---|---|
| **Extension name** | OpenMem — AI Conversation Memory |
| **Summary** (132 chars max) | Capture your Claude, ChatGPT, and Gemini conversations into one local, searchable memory. Your data stays on your device. |
| **Category** | Productivity |
| **Language** | English |
| **Website URL** | https://github.com/openmem/openmem |
| **Privacy policy URL** | https://github.com/openmem/openmem/blob/main/docs/privacy-policy.md |

---

## Detailed description (≤ 16,000 characters)

```
OpenMem gives you a unified, searchable memory for all your AI conversations —
Claude, ChatGPT, and Gemini — stored entirely on your own machine.

────────────────────────────────────────
  YOUR DATA STAYS ON YOUR DEVICE
────────────────────────────────────────

There is no OpenMem cloud. No account. No subscription. Conversations are
stored in a local SQLite database at ~/.openmem/openmem.db. Nothing leaves
your machine unless you explicitly export it.

────────────────────────────────────────
  HOW IT WORKS
────────────────────────────────────────

1. Install the extension and start the companion app (npx openmem).
2. Chat normally on claude.ai, chatgpt.com, or gemini.google.com.
3. Every conversation is automatically captured and indexed.
4. Open http://127.0.0.1:7410 to search, filter, tag, and export.

The extension works by reading the same API responses the page already
receives — no extra network requests, no changes to how the AI services work.

────────────────────────────────────────
  FEATURES
────────────────────────────────────────

LIVE CAPTURE
• Automatically captures every conversation as you chat — no copy-pasting.
• Supports Claude (claude.ai), ChatGPT (chatgpt.com), and Gemini (gemini.google.com).
• Works with streaming responses — captures the complete reply, not fragments.

UNIFIED SEARCH
• Full-text search across all providers with BM25 ranking.
• Highlighted snippets show exactly where your search terms appear.
• Filter by provider, tag, or date range.

IMPORT EXISTING HISTORY
• OpenAI data export (ZIP) — import years of ChatGPT history in seconds.
• Anthropic data export (ZIP) — import your Claude conversation history.
• Google Takeout (Gemini Apps Activity) — import Gemini history.

ORGANISATION
• Tag any conversation with custom labels.
• Filter the sidebar by any tag.
• Export individual conversations to Markdown for notes, docs, or sharing.

PRIVACY BY DESIGN
• Zero telemetry. No analytics. No crash reporting. Nothing.
• All data in a single SQLite file you own and control.
• Delete everything with: rm -rf ~/.openmem

────────────────────────────────────────
  PERMISSIONS EXPLAINED
────────────────────────────────────────

• storage — saves your settings (enable/disable per provider, companion URL)
  in the browser's local storage. No conversation data is stored here.
• Host permissions for claude.ai, chatgpt.com, gemini.google.com — required
  to read API responses on those pages and forward them to the local companion.

OpenMem requests the minimum permissions needed to work.

────────────────────────────────────────
  REQUIREMENTS
────────────────────────────────────────

• Chrome 120 or later
• Node.js 20+ (for the companion app)
• macOS, Linux, or Windows

The companion app must be running for the extension to save conversations.
Start it with: npx openmem

────────────────────────────────────────
  OPEN SOURCE
────────────────────────────────────────

OpenMem is MIT-licensed and fully open source:
https://github.com/openmem/openmem

Contributions welcome — especially Firefox support, additional provider
adapters (Perplexity, Mistral, …), and UI improvements.
```

---

## Screenshots required

Chrome Web Store requires at least **1 screenshot** at 1280×800 or 640×400.
Recommended: 3–5 screenshots.

| # | Subject | Filename |
|---|---|---|
| 1 | Search UI — results from multiple providers | `screenshot-search.png` |
| 2 | Conversation viewer with tags and export button | `screenshot-viewer.png` |
| 3 | Settings panel showing DB stats | `screenshot-settings.png` |
| 4 | Live capture in action (split screen: ChatGPT + OpenMem) | `screenshot-capture.png` |
| 5 | Import flow — terminal + result in UI | `screenshot-import.png` |

Screenshots go in `store-assets/screenshots/`. They are **not** committed to
the git repo (too large) — store them in the shared design folder and upload
directly to the CWS dashboard.

---

## Promotional images (optional but strongly recommended)

| Size | Use | Filename |
|---|---|---|
| 440×280 | Small promo tile | `promo-small.png` |
| 920×680 | Large promo tile | `promo-large.png` |
| 1400×560 | Marquee banner | `promo-marquee.png` |

Brand colours:
- Background: `#0f172a` (slate-900)
- Accent: `#6366f1` (indigo-500)
- Text: `#f8fafc` (slate-50)

---

## Icon assets checklist

The extension manifest references icons at these paths inside `dist/`:

```
dist/icons/icon16.png   (16×16)
dist/icons/icon48.png   (48×48)
dist/icons/icon128.png  (128×128)
```

Source files live in `packages/extension/src/icons/`. The esbuild config
copies them to `dist/icons/` during every build.

The 128×128 icon is also used by the Chrome Web Store listing itself.

---

## Publishing checklist

Before each release, verify:

- [ ] `packages/extension/manifest.json` version matches the git tag
- [ ] All icons are present in `dist/icons/`
- [ ] Privacy policy URL is reachable (GitHub link resolves)
- [ ] Store description is up to date with new features
- [ ] Screenshots reflect current UI (retake if UI changed significantly)
- [ ] `CHANGELOG.md` entry exists for this version
- [ ] CI passes on the release tag commit
