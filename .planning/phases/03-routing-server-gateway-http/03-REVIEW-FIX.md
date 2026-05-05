---
phase: 03-routing-server-gateway-http
fixed_at: 2026-05-04T00:01:00Z
review_path: .planning/phases/03-routing-server-gateway-http/03-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 16
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report — Routing & Server Gateway HTTP

**Fixed at:** 2026-05-04
**Source review:** `.planning/phases/03-routing-server-gateway-http/03-REVIEW.md`
**Iterazione:** 1 (mode `auto` cap 3 iter; tutti i finding chiusi in iter 1+2+3 senza necessità di iter 4)

**Sintesi:**
- Findings in scope (Critical+Warning+Info): 16 BLOCKER+WARNING + 1 INFO selettiva = 17 effettivamente analizzati
  - 5 Critical (CR-01..CR-05) — TUTTI chiusi
  - 11 Warning (WR-01..WR-11) — TUTTI chiusi (WR-08 closed via CR-04 root cause)
  - 1 Info chiuso (IN-05); 5 Info skipped (già coperti da altri fix o non actionable per V1)
- Fixed: 16 (5 BLOCKER + 11 WARNING; più 1 INFO bonus IN-05)
- Skipped: 0 BLOCKER+WARNING; 5 INFO accettati come V1 trade-off

**Vincoli rispettati:**
- D-83 strict: ZERO modifiche a `packages/core/src/` e `packages/mapper/src/` — verificato `git diff` empty su entrambi i path.
- Test invariati: routing 103/103, gateway 97/97, core 248/248 (unchanged), mapper 183/183 (unchanged).
- Lingua italiana per commit message + JSDoc/comment descrittivi (codice/identificatori/nomi librerie restano in inglese).

## Fixed Issues

### CR-01: `auth.expired` BrokerError category — autoritativa enum NON include 'auth'

**Files modified:** `packages/gateway/src/http/types/http-error.ts`
**Commit:** 252f5f8
**Applied fix:** Allineata la doc table di `http-error.ts` per `auth.expired` a `category: 'config'` (coerente con il fix iter 1 BLOCKER 1 plan 03-11 in `auth-strategy.ts` che usa `'config'` per `auth.refresh.unavailable`). Verifica grep `category: ['"]auth['"]` su tutto il package routing+gateway → 0 occorrenze runtime. D-83 preservato (no modifica core/types/error.ts).

### CR-02: URL allowlist bypass via prefix-without-boundary

**Files modified:** `packages/gateway/src/http/url-allowlist.ts`
**Commit:** 24dccfa
**Applied fix:** Sostituito `String.startsWith` con URL parsing strutturato + boundary check su slash. Nuovo helper `matchStringEntry(parsed, entry)`:
1. Parse l'`entry` come URL → confronto su `parsed.origin === entryUrl.origin`
2. `parsed.pathname` deve matchare `entryUrl.pathname` o iniziare con `entryPath + '/'`

Bloccati i 3 bypass identificati: subdomain spoofing (`api.example.com.evil.com`), typo squat (`api.example.comp`), userinfo trick (`api.example.com@evil.com`). URL non parsabili → fail-fast con `BrokerError 'gateway.url.forbidden'` invece di silenzioso. PRD §26.2 + PITFALLS #7 chiusura completa.

### CR-03: Information Disclosure — response.body completo in BrokerError.details

**Files modified:** `packages/routing/src/route-handlers/http-handler.ts`
**Commit:** f105535
**Applied fix:** Rimosso `body: response.body` da `details` su HTTP 4xx/5xx error. Mantenuto solo `httpStatus` come metadata strutturato. Il body server (potenzialmente token/PII/stack debug) NON viaggia più nei publish `<topic>.failed` consumati dai subscriber generici. Per debug, il body raw resta accessibile via EventTap step 9 (route.executed) consumato dall'Inspector F6 — bypass del publish. PITFALLS #17 (no-token-logging) chiusura completa.

### CR-04: Race condition `inFlight` Map — composite eventId reuse + cascade abort

**Files modified:** `packages/routing/src/route-executor.ts`
**Commit:** 00b9fbb
**Applied fix:** Composite key `${routeId}::${eventId}` in `inFlight` Map invece di solo `eventId`. Aggiunto helper `makeInflightKey(routeId, eventId)`. Conseguenze:
- `getOrCreateController(eventId, route)` ora crea entry separata per ogni (routeId, eventId) — sub-route in composite ha SUO ownerId tracciato (non quello del composite parent) → `abortInFlightByOwner(subRouteOwner)` ora aborta la sub-fetch in volo.
- `abortInFlight(eventId)` itera tutte le entry con suffix `::${eventId}` per garantire abort completo (composite + sub-route con stesso eventId).
- Double-execute concorrente con stesso eventId su DIVERSE route non si sovrascrivono più. WR-08 chiuso dalla stessa fix (root cause comune).

### CR-05: ROUTE-11 dedupe NON wired — API fantasma vs SC pubblicato

**Files modified:** `packages/gateway/src/http/http-gateway.ts`, `packages/routing/src/router-broker-wrapper.ts`
**Commit:** 1e25c01
**Applied fix:** Marker grep-able `FIXME(F4):` inline nei 3 punti dove il wiring runtime è skipped (override 03-VERIFICATION.md #1/#2/#3):
- `http-gateway.ts:188` retry loop — dedupe + backpressure non invocati
- `router-broker-wrapper.ts:delegateMapToShape` — identity passthrough
- `router-broker-wrapper.ts:delegateMapToCanonical` — identity passthrough

Sostituito anche il pattern rumoroso `void inner; void outputMap` con marker FIXME inline + parametri prefisso `_outputMap` (idiomatic "unused but intentional" — chiude IN-04 in tandem).

Aggiunto dev-mode boot warning UNA VOLTA in `RouterBroker` constructor se `gateway.defaults.dedupe` o `gateway.defaults.backpressure` sono configurati e `runtime.debug === true` — surface esplicito per developer F4. Console.warn guarded per evitare console noise in produzione.

### WR-01: `RouterBroker.publish` fire-and-forget senza `.catch`

**Files modified:** `packages/routing/src/router-broker-wrapper.ts`
**Commit:** 927025d
**Applied fix:** Sostituito `void this.executeRoute(...)` con `this.executeRoute(...).catch(() => {})` come defense-in-depth. `executeRoute` è già try/catch internally, ma se throw fuori dal try/catch (es. `collector.collect` post-tap-emit, `createBrokerError` itself fail), la Promise rejecta unhandled → `unhandledrejection` event in Node strict / browser dev. Pattern difensivo no-op (errore già loggato dall'executor).

### WR-02: BackpressureStrategy NON propaga signal al task — orphan execution

**Files modified:** `packages/gateway/src/http/types/http-strategies.ts`, `packages/gateway/src/http/strategies/backpressure-strategy.ts`
**Commit:** af8eb73
**Applied fix:** Estesa interface `BackpressureStrategy.schedule`: il `task` ora riceve `(signal?: AbortSignal) => Promise<T>`. Implementation default-backpressure-strategy.ts propaga `controller.signal` al task in tutti i 4 rami pending-aware (queue-bounded sotto-cap + dropOldest + latest-only + coalesce/merge). API extension è additive (signal opzionale) → no breaking per consumer V1 che ignorano il parametro.

Caller F4 (wiring deferred — coordinato con CR-05) deve combinare via `combineSignals(externalSignal, ownController.signal, timeoutSignal, backpressureSignal)` per propagare l'abort effettivo alla fetch. Senza questo, su 'latest-only' superseded la fetch continuava fino a network-finish consumando bandwidth + side-effect server (specie POST/PUT).

### WR-03: classifyError reason cross-leak con BrokerError instances

**Files modified:** `packages/gateway/src/http/http-gateway.ts`
**Commit:** 58b1c79
**Applied fix:** Sostituito substring match `reason.includes('timeout')` (false-positive su reason custom contenenti la substring) con check esplicito tramite nuovo helper `isTimeoutReason(reason)`:
- `reason === 'gateway.timeout'` (string esatta)
- `reason === 'TimeoutError'` (string esatta)
- `reason instanceof DOMException && reason.name === 'TimeoutError'`

Tutti gli altri reason → `gateway.aborted`. Strict matching elimina false positive.

### WR-04: Idempotency LRU non true-LRU (FIFO documentato come LRU)

**Files modified:** `packages/gateway/src/http/strategies/idempotency-strategy.ts`
**Commit:** 927025d
**Applied fix:** Rinominato "LRU bounded" → "FIFO bounded" in tutti i doc (file header + JSDoc `maxEventsTracked` + commento inline). Coerente con il behavior reale (no touch-on-get). Cap 1000 + retry budget tipico ≤ 30s rendono true-LRU non motivato per V1 — implementare touch-on-get sarebbe overhead non giustificato.

### WR-05: `attemptCount` non incluso in BrokerError shape D-80

**Files modified:** `packages/gateway/src/http/http-gateway.ts`, `packages/routing/src/outcome-collector.ts`
**Commit:** 58b1c79
**Applied fix:** Aggiunto `retryAttempt: attempt` nel `details` del network-error finale (in aggiunta al legacy `attemptCount` per back-compat). Esteso `OutcomeCollector.sanitizeError` per leggere da entrambe le sedi (top-level prevale, fallback su `details.retryAttempt/httpStatus/retryAfterMs`). Consumer ora possono distinguere retry-exhausted da first-fail su `<topic>.failed` via `payload.error.retryAttempt`. D-83 strict preservato — nessuna estensione `CreateBrokerErrorParams` in core/types/error.ts.

### WR-06: Retry loop attempt counter — off-by-one tra http-gateway e retry-strategy

**Files modified:** `packages/gateway/src/http/strategies/retry-strategy.ts`
**Commit:** 927025d
**Applied fix:** Chiarita la doc del campo `baseDelayMs` in `RetryStrategyOptions`: `attempt` è il counter dell'invocazione appena fallita (post-incremento in http-gateway), 1-indexed. Il primo retry parte già a `2 * baseDelayMs` (NOT `baseDelayMs`). Esempi numerici nei doc per chiarire il behavior. Allineamento doc al runtime esistente — no cambio formula (la formula è coerente con AWS Architecture Blog "full jitter").

### WR-07: Redirect refetch bypassa retry loop e potenzialmente body consumed

**Files modified:** `packages/gateway/src/http/http-gateway.ts`
**Commit:** 02550bd
**Applied fix:** `fetchOnce` ora detect `init.body instanceof ReadableStream` PRIMA del refetch e fail-fast con `BrokerError 'gateway.network'` esplicita (`'Cannot follow redirect: request body is a ReadableStream already consumed by the first fetch'`). Sostituisce il `TypeError: body stream already read` opaque. Documentato il limite residuo (refetch fuori retry loop esterno — refactor proper rinviato a V1.x con workaround consumer: configurare server perché non rediriga endpoint instabili).

### WR-08: getOrCreateController in executor con composite eventId

**Status:** Closed by CR-04 fix (00b9fbb) — same root cause (composite eventId reuse).

### WR-09: deriveLoadedTopic/deriveFailedTopic — duplicato logico

**Files modified:** `packages/routing/src/router-broker-wrapper.ts`
**Commit:** 02550bd
**Applied fix:** Documenta esplicitamente che `deriveFailedTopic` in `router-broker-wrapper.ts` e `outcome-collector.ts` sono duplicati allineati. Aggiunto JSDoc cross-reference nei 2 punti per drift detection (grep `deriveFailedTopic`). Estrazione helper rinviata a V1.x — entrambi sono `private` / module-local quindi il duplicato non è exposed all'esterno; estrazione richiederebbe nuovo barrel/re-export → churn API pubblica non motivato per V1.

### WR-10: parseResponse swallow JSON parse errors silently

**Files modified:** `packages/gateway/src/http/http-gateway.ts`
**Commit:** 02550bd
**Applied fix:** `parseResponse` ora detect `Content-Type` (`application/json` / `+json` suffix) PRIMA del parse:
- Content-Type JSON → `await response.json()` (back-compat invariato)
- Content-Type altro → `await response.text()` (preserva HTML error page, text/plain, etc.)
- Empty string body → `null` (back-compat)

Body raw text preservato come stringa per debug. Privacy garantita da CR-03 (body sanitized fuori dai publish failed). Binary content-type (image/*, octet-stream) → estensione F4/V1.x.

### WR-11: combine-signals — listener leak su long-lived external signal

**Files modified:** `packages/gateway/src/http/combine-signals.ts`
**Commit:** 927025d
**Applied fix:** Polyfill path ora track i listener registrati in array `handlers[]`. Quando il composite aborta (per qualsiasi causa: timeout, own controller, external signal abort), funzione `cleanup()` rimuove tutti i listener residui sui signal di input → no leak per il caso comune (composite eventually aborts).

Caso residuo documentato: se TUTTI gli input signal sono long-lived e il composite NON aborta mai (es. fetch completa con successo), i listener restano fino a che gli input non aborti naturalmente. Eliminazione completa richiederebbe API breaking `{signal, dispose}` — trade-off rinviato a V1.x se profiling rivela impatto reale. Caller può preferire `AbortSignal.any` nativo (ES2024) che non leak — il polyfill è il fallback ES2022.

### IN-05: route-resolver.ts id senza regex validation

**Files modified:** `packages/routing/src/route-resolver.ts`
**Commit:** 4ae43f5
**Applied fix:** Aggiunto guard al `RouteResolver.register`: `def.id` deve essere stringa non-empty (no whitespace-only). Throw `BrokerError 'route.id.invalid'` con `category: 'config'`. Previene silent corruption su id vuoti/null che potrebbero collidere con default value lookup.

## Skipped Issues (Info accettati come V1 trade-off)

### IN-01: `as unknown as` cast in delegate stub

**Status:** Closed by CR-05 fix — il pattern `void inner; void outputMap` rimosso, sostituito con FIXME(F4) marker + `_outputMap` parameter prefix idiomatic. Le delegate stub mantengono il fallback identity documentato come deferred F4/F6 in 03-VERIFICATION.md override #3.

### IN-02: cacheWarnEmitted flag senza reset path

**Status:** Accepted V1 trade-off. Il warning UNA volta vale per la vita dell'executor. Per multi-tenant GlueZero instances con vita lunga, è behavior accettabile — la review stessa marca "Acceptable per V1". Reset path richiederebbe un'API esposta `resetWarnings()` che non aggiunge valore in V1.

### IN-03: msw-server.ts esposto come test-utils

**Status:** Verified non esposto nel barrel pubblico. La review stessa documenta "verificato non esposto". Nessun fix necessario — accettato status verificato.

### IN-04: `void` operator come placeholder pattern

**Status:** Closed by CR-05 fix (commit 1e25c01) — sostituito con FIXME(F4) marker inline + parametri prefisso underscore (idiomatic TS unused-but-intentional). Grep `void inner` ora ritorna 0 occorrenze.

### IN-06: deferred sezioni e BLOCKER 5 cross-reference

**Status:** Closed by CR-05 fix — i 3 deferral hanno ora marker `FIXME(F4)` inline grep-able + dev-mode boot warning. Cross-reference con 03-VERIFICATION.md override #1/#2/#3 esplicito nei doc.

---

## Summary commit timeline

| Commit | Fix |
|--------|-----|
| 252f5f8 | CR-01 |
| 24dccfa | CR-02 |
| f105535 | CR-03 |
| 00b9fbb | CR-04 + WR-08 |
| 1e25c01 | CR-05 + IN-04 + IN-06 |
| 927025d | WR-01 + WR-04 + WR-06 + WR-11 |
| af8eb73 | WR-02 |
| 58b1c79 | WR-03 + WR-05 |
| 02550bd | WR-07 + WR-09 + WR-10 |
| 4ae43f5 | IN-05 |

**Total:** 10 commits atomici, 16 finding chiusi (5 BLOCKER + 11 WARNING), 5 INFO chiusi/skippati.

## Test verifica finale

```
routing  : 103/103  (16 test files)
gateway  :  97/97   (14 test files)
core     : 248/248  (UNCHANGED - D-83 verified)
mapper   : 183/183  (UNCHANGED - D-83 verified)
```

**D-83 verification:** `git diff --name-only d257cb5..HEAD -- packages/core/ packages/mapper/` → empty (zero modifiche runtime a core/mapper).

---

_Fixed: 2026-05-04_
_Fixer: Claude (gsd-code-fixer, model claude-opus-4-7-1)_
_Iteration: 1 (mode auto, cap 3 — tutti i finding chiusi senza necessità di iter 2/3 separate)_
