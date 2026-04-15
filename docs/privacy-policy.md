# Privacy Policy

**Effective date:** 2024-01-01  
**Product:** OpenMem browser extension and companion app  
**Contact:** https://github.com/openmem/openmem/issues

---

## Summary

OpenMem is a **local-first** tool. All data it captures stays on your device.
Nothing is sent to any server operated by the OpenMem project.

---

## What data OpenMem accesses

When you have a conversation on **claude.ai**, **chatgpt.com**, or
**gemini.google.com**, the OpenMem browser extension reads:

| Data | Why |
|---|---|
| The text you typed (your messages) | To save your side of the conversation |
| The AI's reply text | To save the assistant side of the conversation |
| The conversation ID assigned by the provider | To deduplicate entries |
| The AI model name (e.g. `claude-3-5-sonnet`) | To display in the search UI |
| The page URL / conversation URL | To group messages into conversations |

OpenMem does **not** read:

- Your login credentials or session tokens
- Any other browser tabs or windows
- Anything outside the matched host permissions (`claude.ai`, `chatgpt.com`,
  `gemini.google.com`)
- Your browsing history
- Any personal information beyond the conversation text listed above

---

## How the data is captured

The extension injects a script into the page that intercepts the same API
responses the page itself receives — equivalent to the user copy-pasting text
from the screen into a local notepad. No additional network requests are made
to the AI providers. The extension never initiates any request to AI providers
on its own.

---

## Where data is stored

Captured conversations are sent via `HTTP POST` to a local server
(`127.0.0.1:7410`) running on **your own machine**. The server stores
everything in a SQLite database at `~/.openmem/openmem.db`.

**The data never leaves your machine.**

There is no OpenMem cloud service, no remote database, no analytics endpoint,
and no telemetry of any kind.

---

## Data sharing

OpenMem shares your data with **no one**. There are no third-party SDKs,
analytics libraries, or advertising networks in the companion app or the
extension.

---

## Data retention & deletion

You control all data. To delete everything:

```bash
rm -rf ~/.openmem
```

To delete a single conversation, use the OpenMem web UI at
`http://127.0.0.1:7410` (delete button in the conversation viewer).

---

## Permissions used by the extension

| Permission | Reason |
|---|---|
| `storage` | Saves per-device settings (companion URL, enable/disable per provider) in the browser's local storage — no data leaves the browser |
| `host_permissions` for `claude.ai`, `chatgpt.com`, `gemini.google.com` | Required to inject the fetch-interception script on those pages |

No other permissions are requested.

---

## Children's privacy

OpenMem is not directed at children under 13. We do not knowingly collect
information from children.

---

## Changes to this policy

Any material changes will be noted in
[CHANGELOG.md](https://github.com/openmem/openmem/blob/main/CHANGELOG.md)
and the effective date above will be updated. Continued use of OpenMem after
changes are posted constitutes acceptance.

---

## Contact

Open an issue at https://github.com/openmem/openmem/issues or email the
maintainer listed in the repository.
