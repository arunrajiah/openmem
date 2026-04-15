# Contributing

Thanks for your interest in OpenMem. Contributions of all kinds are welcome:
bug fixes, new provider adapters, Firefox support, UI improvements, and docs.

---

## Dev setup

### Prerequisites

- **Node.js 20+** — `node --version`
- **pnpm 9+** — `npm i -g pnpm`
- **Chrome 120+** — for loading the extension unpacked

### First run

```bash
git clone https://github.com/openmem/openmem
cd openmem
pnpm install

# Build shared types (required once; other packages depend on it)
pnpm --filter @openmem/shared build

# Terminal 1 — companion with hot reload
pnpm --filter @openmem/companion dev

# Terminal 2 — web UI with HMR (proxies API to :7410)
pnpm --filter @openmem/web dev         # → http://localhost:5173

# Terminal 3 — extension in watch mode
pnpm --filter @openmem/extension build:watch
```

Then load the extension:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `packages/extension/dist/`

### Running tests

```bash
pnpm test                              # all packages
pnpm --filter @openmem/companion test  # companion + DB + import
pnpm --filter @openmem/extension test  # adapter unit tests
```

### Linting

```bash
pnpm lint     # ESLint across all packages
pnpm format   # Prettier write
```

---

## Project layout

```
packages/
  companion/     Node.js server, SQLite, REST API, import CLI
  extension/     Browser extension (Manifest V3, esbuild)
  web/           React search UI (Vite + Tailwind)
  shared/        Zod schemas + TypeScript types
scripts/
  bump-version.mjs   Version stamping script (used by CI)
docs/
  architecture.md
  quickstart.md
  legal.md
  privacy-policy.md
  store-listing.md
  release-process.md
.github/
  workflows/
    ci.yml       Tests + builds on every push/PR
    publish.yml  Chrome Web Store auto-publish on version tags
```

---

## Conventions

- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- **Keep dependencies minimal.** Prefer a 200-line utility over a framework.
- **Every capture adapter lives in its own module** and has its own unit tests.
- **Migrations are append-only.** Never edit a shipped migration — add a new one.
- **Don't log message content** at info level (privacy).
- **`exactOptionalPropertyTypes` is enabled.** Optional fields need `T | undefined` on the type; don't use `?:` to paper over missing values.

---

## Adding a new provider adapter

1. Create `packages/extension/src/adapters/<provider>/` with:
   - `parser.ts` — URL matching, request body parsing, SSE/response parsing
   - `parser.test.ts` — unit tests with mock request/response data
2. Create page-hook and content scripts (see existing adapters for the pattern)
3. Add content script entries to `packages/extension/manifest.json`
4. Add build entries to `packages/extension/esbuild.config.mjs`
5. Update the feature table in `README.md`

---

## Legal / scope

We only capture data the authenticated user is already viewing on pages they
have legitimate access to. We don't circumvent authentication, scrape other
users' data, or transmit captured data off-device. See `docs/legal.md`.

---

## Release process (maintainers)

See [docs/release-process.md](docs/release-process.md) for the full
step-by-step. Short version:

```bash
node scripts/bump-version.mjs 1.2.3
# edit CHANGELOG.md
git add -A && git commit -m "chore: release v1.2.3"
git tag v1.2.3 && git push --follow-tags
```

The `publish.yml` GitHub Actions workflow builds everything, zips the
extension, uploads it to the Chrome Web Store, and creates a GitHub Release.
