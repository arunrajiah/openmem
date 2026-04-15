# Quickstart

Get OpenMem running in under 5 minutes.

## Prerequisites

- **Node.js 20+** — `node --version`
- **pnpm 9+** — `npm i -g pnpm`
- **Chrome 120+** (for the extension)

---

## Step 1 — Start the companion app

The companion app is the local server that stores and indexes your conversations.

```bash
npx openmem
```

You should see:
```
OpenMem companion listening on http://127.0.0.1:7410  data: /Users/you/.openmem
```

Open **http://127.0.0.1:7410** in your browser. You'll see the empty search UI.

> **Data location:** `~/.openmem/openmem.db` (SQLite, WAL mode).  
> Override with `OPENMEM_DATA_DIR=/path/to/dir npx openmem`.

---

## Step 2 — Install the browser extension

Until OpenMem is published to the Chrome Web Store, load it manually:

```bash
git clone https://github.com/openmem/openmem
cd openmem
pnpm install
pnpm --filter @openmem/shared build
pnpm --filter @openmem/extension build
```

Then in Chrome:
1. Go to `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `packages/extension/dist/`

The OpenMem icon will appear in your toolbar.

---

## Step 3 — Capture your first conversation

1. Go to [claude.ai](https://claude.ai) (or chatgpt.com / gemini.google.com)
2. Have a conversation
3. Come back to **http://127.0.0.1:7410**
4. Your conversation should appear automatically

> If nothing appears, check:
> - The companion is running on port 7410
> - The extension is enabled for the site in `chrome://extensions`
> - Open the extension's service worker console (chrome://extensions → OpenMem → Service Worker) for errors

---

## Step 4 — Import existing history (optional)

### OpenAI
1. Go to ChatGPT → Settings → **Data controls** → **Export data**
2. Wait for the email with your download link
3. Run:
```bash
npx openmem import openai ~/Downloads/openai-export.zip
```

### Anthropic
1. Go to [privacy.anthropic.com](https://privacy.anthropic.com) → **Export Data**
2. Download the ZIP when ready
3. Run:
```bash
npx openmem import anthropic ~/Downloads/anthropic-export.zip
```

### Google Gemini (Takeout)
1. Go to [Google Takeout](https://takeout.google.com)
2. Deselect all, then select **Gemini Apps Activity**
3. Export and download the ZIP
4. Run:
```bash
npx openmem import gemini ~/Downloads/takeout.zip
```

> **Note:** Google Takeout for Gemini may only export prompt activity (user
> messages), not full conversation transcripts. What's available will be imported.

---

## Step 5 — Search and explore

- **Search bar** — full-text search across all providers (BM25 ranking)
- **Provider filter** — show only Claude, ChatGPT, or Gemini conversations
- **Tag filter** — click any tag pill to filter by tag
- **Export** — open a conversation, click **Export** for a Markdown download
- **Tags** — open a conversation, type in the tag input and press Enter

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Conversations not appearing | Make sure companion is on port 7410; check extension SW console |
| Extension not loading | Check `chrome://extensions` — any errors shown? |
| Import fails | Try passing the extracted JSON file directly instead of the ZIP |
| Port 7410 in use | `OPENMEM_PORT=7411 npx openmem` |

---

## What's next

- [Architecture overview](architecture.md)
- [Legal stance](legal.md)
- [Contributing](../CONTRIBUTING.md)
