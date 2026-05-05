# Phase 6 — Deferred Items

> Items discovered durante l'esecuzione di plan F6 ma fuori scope del singolo plan.
> Da risolvere in 06-09a (final gate CI).

## 06-06 (2026-05-05)

- **Pre-existing typecheck failure** in `@gluezero/gateway` + `@gluezero/routing build`:
  - `@gluezero/routing` non builda (out-of-scope F6 — pre-existing F3).
  - Cascade: `@gluezero/gateway` typecheck fails per missing `@gluezero/routing/dist`.
  - **NOT caused by 06-06 changes**. Verificato `git diff packages/{core,mapper,routing,gateway,worker}/` empty.
  - Da risolvere in 06-09a CI gates calibration o pre-existing F3 fix.
