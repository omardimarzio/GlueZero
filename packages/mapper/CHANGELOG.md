# @gluezero/mapper

## 1.0.0

### Major Changes

- 058b2dc: # GlueZero v1.0.0 — Milestone Release

  Prima release pubblica major v1.0.0 di GlueZero: libreria browser-side TypeScript-first per pub/sub, routing, canonical model, server gateway, worker runtime, cache + developer tooling.

  ## Highlights

  - **6 fasi PRD complete**: Core + Mapper + Routing + Realtime + Worker + Cache/Tooling
  - **10/11 open issues PRD §39 closed** (#2 cross-fase pipeline ordering deferred V1.x)
  - **91/91 REQ-IDs Complete**
  - **8 pacchetti pubblicati**: `@gluezero/{core, mapper, routing, gateway, worker, cache, devtools, gluezero}`
  - **Zero deps esterne core** — solo `nanoid` + `valibot` + `comlink` (worker)
  - **ESM-only** + TypeScript declarations
  - **Coverage v8 ≥90/80/90/90** su tutti i package F2-F6 (target floor sopra-rispettato con margini ampi)
  - **3-tier test**: Tier-1 jsdom + Tier-2 MSW + Tier-3 Playwright Chromium reale

  ## Breaking Changes

  Nessuna — prima release pubblica major. V0.x era pre-release alpha (zero consumer pubblici).

  ## What's New (vs Pre-1.0)

  - **Phase 6 Cache & Tooling**: `MemoryCacheAdapter` LRU bounded `maxEntries=1000` (D-158) + scope hybrid D-156/D-157 + cache-then-network ordering microtask (RESEARCH §15.6) + Event Inspector + Route Inspector ring buffer 500 (D-167) + MetricsCollector simil-OpenMetrics + naming `gluezero.<package>.<metric>{<labels>}` Prometheus + reservoir Algorithm R Vitter 1985 (D-165) + cardinality cap 100 (D-166) + PauseController pauseTopic/resumeTopic/flushQueue + critical bypass (D-170) + getDebugSnapshot deep-clone via `structuredClone` (D-162) + tap registry chain MultiplexTap (D-159) + step 14 reale attivato `event.observed` (D-161).
  - **`createGlueZero` aggregato**: chain composition F1+F2+F3+F4+F5+F6 con features opt-out (cache/devtools/worker/realtime).
  - **Phase 5 Worker Runtime**: WorkerRegistry + WorkerPool bounded `min(hwc, 4)` cap 8 + WorkerBridge Comlink + state machine atomico Pitfall 2C closure (D-133) + cancellation hybrid + serialization WK-07.
  - **Phase 4 Realtime SSE/WS**: adapter SSE+WS + reconnection unificata + auto-fallback SSE→WS (D-107) + ping/pong applicativo (D-111) + visibility-aware (D-110).
  - **Phase 3 Routing & Gateway HTTP**: routing engine dichiarativo + gateway HTTP unico + retry/timeout/dedupe/auth/circuit-breaker.
  - **Phase 2 Canonical Mapper**: vocabolario canonico + mapper bidirezionale + Mapping Inspector + transform pipeline.
  - **Phase 1 Core**: broker pub/sub in-page + plugin registry + lifecycle anti-leak + EventTap pre-instrumentato.

  ## Open Issues PRD §39 Closed

  1. **MAP-17** — Precedenza alias automatici vs mapping esplicito → F2 (mapping esplicito vince sempre)
  2. **VAL-08** — Field mancante (errore vs default) → F2
  3. **VAL-09** — Transform failure (skip vs block) → F2
  4. **ROUTE-09** — Retry 4xx vs 5xx → F3 (no retry 4xx eccetto 408/429)
  5. **ROUTE-15** — Più route applicabili → F3 (first-match default + priority-ordered + all)
  6. **ROUTE-16** — Topic senza route → F3 (default consegna locale, opt-in `requiresRoute`)
  7. **LIFE-02** — Unsubscribe automatico in `unregisterPlugin` → F1 (cascade obbligatoria)
  8. **RT-07** — Reconnection rules realtime → F4 (full jitter + Last-Event-ID SSE + ping/pong WS)
  9. **WK-07** — Serializzazione messaggi worker → F5 (`structuredClone` default + `assertSerializable` dev + transferable opt-in)
  10. **TOOL-05** — Format metriche → **F6 (this release)** ✅ — schema simil-OpenMetrics + naming Prometheus + reservoir + cardinality cap

  **Open V1.x roadmap:**

  - #2 — Cross-fase pipeline ordering — deferred V1.x (opt-in quando emergeranno consumer cross-fase reali)

  ## Bundle Size (gz, with all deps)

  | Package              | Size                             |
  | -------------------- | -------------------------------- |
  | `@gluezero/core`     | ~6 KB                            |
  | `@gluezero/mapper`   | ~12 KB                           |
  | `@gluezero/routing`  | ~19 KB                           |
  | `@gluezero/gateway`  | ~6 KB (HTTP) + sse-ws sub-modulo |
  | `@gluezero/worker`   | ~26 KB                           |
  | `@gluezero/cache`    | ~22 KB                           |
  | `@gluezero/devtools` | ~22 KB                           |
  | `@gluezero/gluezero` | ~35 KB                           |

  ## V1.x Roadmap (deferred)

  - `@gluezero/cache-idb` (IndexedDB persistence)
  - `@gluezero/metrics-prometheus` (Prometheus textfile exporter)
  - `@gluezero/metrics-otel` (OpenTelemetry SDK adapter)
  - `superjson` adapter pluggable per worker serialization
  - Custom histogram bucketing per route
  - Anti-flap pause/resume (debounce N ms)
  - Worker retry policy idempotent opt-in
  - Auto-detect transferable heuristic
  - Cross-fase pipeline ordering canonical doc

  ## Co-Authored-By

  Claude Opus 4.7 <noreply@anthropic.com>

### Patch Changes

- Updated dependencies [058b2dc]
  - @gluezero/core@1.0.0
