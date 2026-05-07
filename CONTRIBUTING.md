# Contributing to GlueZero

Thanks for your interest in contributing. This document is the operational reference for working on GlueZero — for the *why* behind decisions, see [`DECISIONS.md`](./DECISIONS.md).

## Before opening a PR

1. **Read [`DECISIONS.md`](./DECISIONS.md)** — index of 170 architectural decisions. Pick an existing decision before introducing a competing pattern. Most "obvious" extensions have already been considered and rationalized; if you want to override one, the PR should explicitly cite which D-XX is being revisited and why.
2. **Operational conventions:**
   - Italian for docs / commit messages / JSDoc descriptions
   - English for code, identifiers, shell commands, library names, error keywords
   - The 6-phase composition wrapper boundary (D-83 strict carryover): F3+ packages do **not** modify `packages/{core,mapper}/src/`
3. **Run the full local gate** before opening the PR:
   ```bash
   pnpm install
   pnpm typecheck   # 8/8 must pass
   pnpm test        # 1165/1168 (+ 3 skip MSW V1.x atteso)
   pnpm build       # 8/8 must pass
   pnpm lint
   ```

## Repository layout

GlueZero is a `pnpm` monorepo with 8 packages:

```
packages/
├── core       — pub/sub broker, plugin registry, EventTap (Phase 1)
├── mapper     — canonical model + bidirectional mapper (Phase 2)
├── routing    — declarative routing engine (Phase 3)
├── gateway    — HTTP gateway + SSE/WS realtime (Phase 3 + 4)
├── worker     — Worker registry + pool + bridge (Phase 5)
├── cache      — LRU adapter + 3 strategies (Phase 6)
├── devtools   — Inspector + MetricsCollector + PauseController (Phase 6)
└── gluezero   — aggregate `createGlueZero()` factory
```

Each package is independently publishable on npm under `@gluezero/*`. Inter-package deps use `workspace:*` and are resolved at publish time by Changesets.

## Architectural rules (non-negotiable)

These derive from decisions D-26 / D-49 / D-83 (see `DECISIONS.md`):

1. **Composition over inheritance.** `MapperBroker` wraps `Broker`, `RouterBroker` wraps `MapperBroker`, etc. Never subclass.
2. **`createXBroker(config)` is a pure function (no singleton, D-30).** Factories return fresh instances; tests rely on this.
3. **`unregisterPlugin` cascade is mandatory (LIFE-02, D-26).** Every package that adds plugin-scoped state must clean up on cascade. Test `cascade-cleanup.test.ts` patterns exist in every package as reference.
4. **No retroactive modification of earlier-phase packages (D-83 strict carryover).** F3 cannot edit `packages/{core,mapper}/src/`. F4+ cannot edit F1-F3 src. Verified at every final gate via `git diff <base>..HEAD -- packages/{core,mapper,routing,gateway,worker}/src/`.
5. **No new direct dependency without explicit decision.** The dependency surface is intentionally small: `nanoid`, `valibot`, `comlink` (worker only). Adding a new runtime dep requires a D-XX entry.

## Commit conventions

Follow Conventional Commits with a phase or area scope:

- `feat(scope):` — new feature
- `fix(scope):` — bug fix
- `chore(scope):` — tooling, scripts, config
- `docs(scope):` — documentation only
- `refactor(scope):` — refactor without behavior change
- `test(scope):` — tests only
- `style(scope):` — formatting (Biome auto-format counts here)

Common scopes: `core`, `mapper`, `routing`, `gateway`, `worker`, `cache`, `devtools`, `gluezero`, `release`, `meta`, `verify`, `<phase>-<plan>` (e.g. `06-09b`).

Italian body / description; English title is fine when consistent with the file context.

## Adding a Changeset

For any user-visible change, add a Changeset:

```bash
pnpm changeset
```

Pick the affected packages and the bump type (major / minor / patch). The CLI generates a markdown file in `.changeset/`; commit it with your code change. The release workflow consumes it to bump versions and generate per-package `CHANGELOG.md`.

## Testing tiers

| Tier | Environment | When |
|------|-------------|------|
| 1 | jsdom (default) | Unit + integration. Always required. |
| 2 | MSW | HTTP / SSE round-trip. Required for `@gluezero/gateway`. |
| 3 | Playwright + Chromium | Real browser smoke. Required for Worker (real `Worker`), SSE/WS (real `EventSource`/`WebSocket`). |

Coverage targets: `≥ 90% statements / 80% branches / 90% functions / 90% lines` per file. Calibrated per phase in `vitest.config.ts`.

## Areas where help is especially welcome

- Additional **`CacheAdapter`** implementations (IndexedDB persistence, sessionStorage)
- Additional **`ValidatorAdapter`** implementations (Zod, Ajv) — contract is no-throw discriminated-union
- Alternative **`WorkerBridge`** implementations (RPC custom for niche use-cases)
- Framework integrations: React hooks, Vue composables, Svelte stores, Solid signals
- Examples and tutorials covering specific verticals (CRM, low-code, micro-frontend platforms)
- TypeDoc → docs site automation refinements (`.github/workflows/docs.yml` is wired but the deploy needs manual first activation)

## Getting help

- **Architectural questions** → check [`DECISIONS.md`](./DECISIONS.md) first; it has 170 entries indexed by decision ID
- **Bug reports** → use the GitHub issue templates
- **Security disclosures** → see [`SECURITY.md`](./SECURITY.md)
- **Code of conduct** → [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
