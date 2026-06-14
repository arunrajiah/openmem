# Icons

This directory holds the app icons referenced by `tauri.conf.json`. They are
**not committed** — generate them from a single source PNG:

```bash
pnpm --filter @openmem/desktop icon path/to/source-1024.png
```

This produces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`
(macOS), and `icon.ico` (Windows).
