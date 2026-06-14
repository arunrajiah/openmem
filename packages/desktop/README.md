# @openmem/desktop

A [Tauri 2](https://v2.tauri.app/) desktop shell around the OpenMem companion
server. The app spawns the companion (SQLite + REST API + web UI) locally and
displays the UI in a native window — no browser, no extension required for
viewing your memory.

> **Status: scaffold (v2, in progress).** The dev workflow runs end-to-end once
> the Rust toolchain is installed. Production single-binary packaging and
> cross-platform release CI are **deferred follow-ups** — see
> [Known gaps](#known-gaps).

---

## How it works

```
┌──────────────────────────── Tauri window ────────────────────────────┐
│  WebView → http://127.0.0.1:7410  (companion-served React UI)         │
└───────────────────────────────────────────────────────────────────────┘
                    ▲ loads after /health is ready
┌───────────────────────────────────────────────────────────────────────┐
│  Companion process                                                      │
│   • dev:    started by `beforeDevCommand` (predev script)               │
│   • prod:   spawned as a Tauri sidecar binary (externalBin)             │
└───────────────────────────────────────────────────────────────────────┘
```

- **Dev:** `beforeDevCommand` builds the web UI into `companion/public`, builds
  and starts the companion on `:7410`, and Tauri loads `devUrl` directly.
- **Prod:** the bundled `openmem-companion` sidecar is spawned on launch; the
  window first shows `dist-placeholder/index.html`, which polls `/health` and
  then navigates to the companion-served UI. The sidecar is killed on exit.

---

## Prerequisites

- **Rust** (stable) + Cargo — https://www.rust-lang.org/tools/install
- Platform Tauri deps — https://v2.tauri.app/start/prerequisites/
- Node 20+ and pnpm 9+ (repo root)

---

## Develop

```bash
# from the repo root
pnpm install
pnpm --filter @openmem/shared build

# run the desktop app in dev (starts the companion automatically)
pnpm --filter @openmem/desktop dev
```

The first `tauri dev` will compile the Rust crate (slow once, cached after).

---

## Icons

Tauri needs platform icon formats (`.icns`, `.ico`, sized PNGs). Generate them
from a single source PNG:

```bash
pnpm --filter @openmem/desktop icon path/to/source-1024.png
# writes into src-tauri/icons/
```

Until icons are generated, `tauri build` will fail on the icon step. `tauri dev`
works without them on some platforms.

---

## Build (production)

```bash
pnpm --filter @openmem/desktop build
```

This runs `prebuild` (web build → companion build → sidecar build) then
`tauri build`, producing a `.dmg` (macOS), `.msi`/`.exe` (Windows), or
`.AppImage`/`.deb` (Linux) under `src-tauri/target/release/bundle/`.

---

## Known gaps

These are intentionally deferred (this iteration is scaffold + dev-runnable):

1. **Sidecar native-addon packaging is unverified.** `better-sqlite3` is a
   native Node addon. `scripts/build-sidecar.mjs` produces a Node SEA binary and
   copies `better_sqlite3.node` beside it, but runtime resolution of the addon
   from the SEA executable has **not** been tested on any platform. May require
   an alternative (e.g. `@yao-pkg/pkg`, or a Rust-native companion rewrite).
2. **No release CI.** Cross-platform build/sign/notarize (DMG/MSI/AppImage) via
   GitHub Actions is not wired up yet.
3. **Icons not committed.** Run `pnpm --filter @openmem/desktop icon <png>`.
4. **Data directory.** The sidecar uses the companion's default `~/.openmem`.
   A desktop-specific data dir / first-run onboarding is not implemented.
