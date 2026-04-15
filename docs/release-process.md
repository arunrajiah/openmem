# Release Process

This document describes how to cut a new OpenMem release. The process is
intentionally simple: tag → push → automation takes over.

---

## Overview

```
developer                    GitHub Actions
─────────────────────────────────────────────────────────────
1. bump-version.mjs       →
2. commit + tag            →
3. git push --follow-tags  →  publish.yml triggers
                           →  build all packages
                           →  stamp version in manifest
                           →  zip extension dist/
                           →  upload ZIP to Chrome Web Store
                           →  submit for review
                           →  create GitHub Release with ZIP attached
```

---

## Step-by-step

### 1. Decide the new version

Follow [semantic versioning](https://semver.org/):

| Change | Bump |
|---|---|
| New provider adapter, new major feature | `minor` (1.x.0) |
| Bug fix, small improvement | `patch` (1.0.x) |
| Breaking change in companion API or import format | `major` (x.0.0) |

### 2. Stamp the version locally

```bash
node scripts/bump-version.mjs 1.2.3
```

This updates `packages/extension/manifest.json` and all `package.json` files.

### 3. Update CHANGELOG.md

Add a new section at the top of `CHANGELOG.md`:

```markdown
## [1.2.3] — 2024-07-15

### Added
- …

### Fixed
- …
```

### 4. Commit and tag

```bash
git add -A
git commit -m "chore: release v1.2.3"
git tag v1.2.3
git push --follow-tags
```

The `publish.yml` workflow triggers on the `v1.2.3` tag.

### 5. Monitor the workflow

Go to **Actions → Publish** on GitHub. The workflow will:

1. Re-stamp the version (idempotent — same value you set locally)
2. Build all packages
3. Create `openmem-extension-1.2.3.zip`
4. Upload + publish to Chrome Web Store
5. Create a GitHub Release with the ZIP

The Chrome Web Store review typically takes **1–3 business days**. The GitHub
Release and ZIP are available immediately.

---

## First-time setup: Chrome Web Store secrets

The `publish.yml` workflow needs four secrets set in **GitHub → Settings →
Secrets and variables → Actions**:

| Secret name | Where to get it |
|---|---|
| `CHROME_EXTENSION_ID` | Chrome Web Store Developer Dashboard → your extension's ID |
| `CHROME_CLIENT_ID` | Google Cloud Console → OAuth 2.0 client (see below) |
| `CHROME_CLIENT_SECRET` | Same OAuth 2.0 client |
| `CHROME_REFRESH_TOKEN` | Run the token-fetch script (see below) |

### Getting OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Enable **Chrome Web Store API** (`APIs & Services → Library`)
4. Create an **OAuth 2.0 client ID** (`APIs & Services → Credentials`):
   - Application type: **Desktop app**
   - Copy the Client ID and Client Secret
5. Get a refresh token — the easiest way is the
   [chrome-webstore-upload](https://github.com/fregante/chrome-webstore-upload)
   README interactive flow:

   ```bash
   npx chrome-webstore-upload-cli@3 get-refresh-token \
     --client-id YOUR_CLIENT_ID \
     --client-secret YOUR_CLIENT_SECRET
   ```

   Follow the browser prompt, paste the auth code back, copy the refresh token.

6. Add all four values as GitHub secrets.

### First publication

The very first time you publish an extension you must submit it **manually**
through the Chrome Web Store Developer Dashboard — the API only handles
updates. After the first manual submission is approved, all subsequent
releases are handled automatically by `publish.yml`.

---

## Hotfix process

For urgent fixes on a released version:

```bash
git checkout -b hotfix/1.2.4 v1.2.3
# make the fix
node scripts/bump-version.mjs 1.2.4
git add -A && git commit -m "fix: <description>"
git tag v1.2.4
git push origin hotfix/1.2.4 --follow-tags
# open a PR back to main
```

The tag push triggers `publish.yml` automatically.

---

## What the ZIP contains

```
openmem-extension-X.Y.Z.zip
├── manifest.json         (version stamped)
├── background.js
├── content/
│   ├── claude.js
│   ├── chatgpt.js
│   └── gemini.js
├── page-hook/
│   ├── claude-hook.js
│   ├── chatgpt-hook.js
│   └── gemini-hook.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

The companion app and web UI are **not** included in the extension ZIP —
they are published separately as the `openmem` npm package.
