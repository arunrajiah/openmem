# Contributing

Thanks for your interest. OpenMem is early — the surface is small on purpose.

## Dev setup

```
pnpm install
pnpm --filter @openmem/shared build
pnpm --filter @openmem/companion dev
pnpm test
```

Node 20+ required.

## Conventions

- **Conventional commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Keep dependencies minimal. Prefer a 200-line library over a framework.
- Every capture adapter lives in its own module and has its own tests.
- Migrations are append-only. Never edit a shipped migration — add a new one.
- Don't log message content at info level.

## Legal / scope

We only capture data the authenticated user is already viewing on pages they
have legitimate access to. We don't circumvent auth, scrape other users' data,
or transmit captured data off-device. See `docs/legal.md`.
