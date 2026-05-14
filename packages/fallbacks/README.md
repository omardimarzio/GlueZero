# `@gluezero/fallbacks`

Layer di fallback & error boundary opt-in per micro-frontend gestiti da
`@gluezero/microfrontends`. Subscribe esterna ai 7 `MF_ERROR_TOPICS` di F8 e
applica catena `circuit → retry → fallback render` per ciascun MF, **senza
modificare alcun package upstream** (D-83 strict septuple esteso F14).

> **Status:** v2.0.0-alpha.0 — experimental tag. GA target F17 (D-V2-F8-10).

## 1. Quick start

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { fallbacksModule } from '@gluezero/fallbacks'
import '@gluezero/fallbacks/augment'

const broker = createBroker({
  modules: [microfrontendModule(), fallbacksModule()],
})
```

Per ulteriori esempi vedi sezione [§7 Examples](#7-examples).

## 2. Install

```sh
pnpm add @gluezero/core @gluezero/microfrontends @gluezero/fallbacks
```

Peer dependencies opzionali:
- `@gluezero/context` — `MicroFrontendRuntimeContext` per custom handler ctx.
- `@gluezero/permissions` — type compat only (no permission check runtime, OQ-2).
- `@gluezero/isolation` — `SERVICE_ISOLATION` per shadow-dom target html-renderer.

## 3. FallbackPolicy 6 scope

> TODO W3 P05 — sezione completa in closure (6 onXError + retry + circuitBreaker).

## 4. 4 rendering modes

> TODO W3 P05 — sezione completa in closure (html / component / event / custom + none).

## 5. RetryPolicy backoff + jitter

> TODO W3 P05 — sezione completa in closure (3-mode backoff + ±20% jitter).

## 6. CircuitBreakerPolicy state machine

> TODO W3 P05 — sezione completa in closure (3-state FSM + topics emit).

## 7. Examples

> TODO W3 P05 — sezione completa in closure (4 MF scenari demo HTML).

## 8. Errors

> TODO W3 P05 — sezione completa in closure (`MicroFrontendError` class + 5 codici `MfFallbackErrorCode`).

## 9. Q&A

> TODO W3 P05 — sezione completa in closure.

## 10. Migration v1.x → v2.0

> TODO W3 P05 — sezione completa in closure.

## 11. Limitations (PRD §29.6)

> TODO W3 P05 — sezione completa in closure (runtime error boundary shared-window).

## 12. Performance

> TODO W3 P05 — sezione completa in closure (bundle ≤ 6 KB + zero overhead se non installato).

## 13. Bundle

> TODO W3 P05 — sezione completa in closure (size-limit gate + tree-shake friendly).
