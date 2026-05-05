---
phase: 03-routing-server-gateway-http
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - packages/routing/src/augment.ts
  - packages/routing/src/index.ts
  - packages/routing/src/internal/topic-trie.ts
  - packages/routing/src/outcome-collector.ts
  - packages/routing/src/public-factory.ts
  - packages/routing/src/route-executor.ts
  - packages/routing/src/route-handlers/cache-handler.ts
  - packages/routing/src/route-handlers/composite-handler.ts
  - packages/routing/src/route-handlers/http-handler.ts
  - packages/routing/src/route-handlers/local-handler.ts
  - packages/routing/src/route-handlers/index.ts
  - packages/routing/src/route-resolver.ts
  - packages/routing/src/router-broker-wrapper.ts
  - packages/routing/src/router-engine.ts
  - packages/routing/src/strategies/all-broadcast.ts
  - packages/routing/src/strategies/first-match.ts
  - packages/routing/src/strategies/priority-ordered.ts
  - packages/routing/src/strategies/index.ts
  - packages/routing/src/test-utils/msw-server.ts
  - packages/routing/src/types/route-definition.ts
  - packages/routing/src/types/route-policies.ts
  - packages/routing/src/types/route-outcome.ts
  - packages/routing/src/types/routing-config.ts
  - packages/routing/src/types/index.ts
  - packages/gateway/src/augment.ts
  - packages/gateway/src/index.ts
  - packages/gateway/src/http/index.ts
  - packages/gateway/src/http/combine-signals.ts
  - packages/gateway/src/http/http-gateway.ts
  - packages/gateway/src/http/policy-chain.ts
  - packages/gateway/src/http/public-factory.ts
  - packages/gateway/src/http/retry-after-parser.ts
  - packages/gateway/src/http/url-allowlist.ts
  - packages/gateway/src/http/strategies/auth-strategy.ts
  - packages/gateway/src/http/strategies/backpressure-strategy.ts
  - packages/gateway/src/http/strategies/circuit-breaker.ts
  - packages/gateway/src/http/strategies/dedupe-strategy.ts
  - packages/gateway/src/http/strategies/idempotency-strategy.ts
  - packages/gateway/src/http/strategies/retry-strategy.ts
  - packages/gateway/src/http/strategies/timeout-strategy.ts
  - packages/gateway/src/http/strategies/index.ts
  - packages/gateway/src/http/types/gateway-config.ts
  - packages/gateway/src/http/types/http-error.ts
  - packages/gateway/src/http/types/http-strategies.ts
  - packages/gateway/src/http/types/index.ts
findings:
  blocker: 5
  warning: 11
  info: 6
  total: 22
status: issues_found
---

# Phase 3: Code Review Report — Routing & Server Gateway HTTP

**Reviewed:** 2026-04-30
**Depth:** standard (per-file analysis con language-specific checks TS/Valibot/fetch)
**Files Reviewed:** 47 (24 routing + 23 gateway, esclusi `.test.ts`)
**Status:** issues_found

## Summary

Review adversarial della Phase 3 (Routing engine + Server Gateway HTTP centralizzato). Sono stati analizzati 47 file source nei package `@gluezero/routing` e `@gluezero/gateway/http`, con focus sui 10 punti elencati nel mandato (security, concurrency safety, resource leaks, error handling, type safety, D-83 strict, performance, API coherence, pipeline §28, code quality).

**Sintesi:**
- **5 BLOCKER** — security/correctness critical: auth.expired category mismatch (rompe `category: 'auth'` documentato in D-80 vs `ErrorCategory` enum strict autoritativa che NON include 'auth'), URL allowlist bypass via prefix-without-boundary (path traversal/subdomain spoofing), Information Disclosure di response body in BrokerError details, race condition inFlight Map con composite/abort cascade, dedupe end-to-end NON wired contraddice ROUTE-11 SC pubblicata.
- **11 WARNING** — robustezza/maintainability: fire-and-forget Promise senza catch in `RouterBroker.publish`, BackpressureStrategy NON propaga signal al task (orphan execution + memory leak), reason cross-leak in classifyError con BrokerError stringification, Idempotency LRU non true-LRU (FIFO documentato come LRU), retry attempt counter inconsistency tra http-gateway e retry-strategy, redirect refetch bypassa retry loop, redirect refetch riusa init.body potenzialmente già consumato, attemptCount non incluso in BrokerError shape D-80, getOrCreateController in executor con composite eventId non robusto.
- **6 INFO** — code quality: tipo `as unknown as` casts in delegate stub (V1 fallback identity documentato in deferred), `void` operator come placeholder, `cacheWarnEmitted` flag senza reset path, msw-server.ts esposto come test-utils, parseResponse swallow errors silently.

**Vincolo D-83:** verificato — zero modifiche runtime a `packages/core/src/` e `packages/mapper/src/`.

**Pipeline §28 step 7-full + 8/9/10:** instrumentazione presente (tap emessi correttamente in `route-executor`, `outcome-collector`, `router-broker-wrapper`).

**Decisione di Roadmap:** i 3 override (`latest-only` end-to-end, `dedupe` middleware automatico, `mapToShape` selective) sono già documentati come deferred F4/F6 in 03-VERIFICATION.md — i finding qui sopra in sezione BLOCKER 5 non sono "nuovi" ma vengono comunque marcati BLOCKER perché contraddicono SC pubblicato e nuovi consumer F4 dovranno chiuderli prima di shippare i wiring runtime.

## Critical (BLOCKER)

### CR-01: `auth.expired` BrokerError category — autoritativa enum NON include 'auth'

**File:** `packages/gateway/src/http/types/http-error.ts:32`
**Issue:** Il commento JSDoc tabella documenta `auth.expired` con `category: 'auth'`. La decisione D-80 in `03-CONTEXT.md:128-140` contiene esplicitamente `'auth'` nell'union: `category: 'network' | 'validation' | 'auth' | 'config'`. Però `ErrorCategory` autoritativa in `packages/core/src/types/error.ts:19-29` è:
```ts
export type ErrorCategory =
  | 'validation' | 'plugin' | 'mapping' | 'route' | 'network'
  | 'worker' | 'system' | 'config' | 'topic'
```
**'auth' NON è presente.** Risultato: emettere un `BrokerError` con `category: 'auth'` causerebbe TS compile error e/o runtime mismatch con consumer che branchano su `error.category`. Il workaround attuale in `auth-strategy.ts:108-110` per `auth.refresh.unavailable` usa `category: 'config'`, ma la documentazione `http-error.ts` continua a dichiarare 'auth' creando confusione e contraddizione tra D-80, D-83 strict (no modifica core), e tabella http-error.ts. Inoltre, **NESSUN BrokerError con `code: 'auth.expired'` è effettivamente emesso nel codebase F3** — la grep nei 47 file mostra che il code è solo dichiarato nella literal union ma mai usato in `createBrokerError({ code: 'auth.expired', ... })`. Ciò significa che la chiusura SEC-02 (token refresh exhausted → publish `auth.expired`) NON è implementata: `auth-strategy.ts` non distingue mai "refresh ritorna stesso token" da success, e non emette mai `auth.expired`.

**Fix:** Una di queste tre vie:
1. Aggiungere `'auth'` a `ErrorCategory` in `packages/core/src/types/error.ts:19-29` (richiede modifica core — VIOLA D-83). 
2. Aggiornare `http-error.ts` tabella + D-80 per usare `category: 'config'` per `auth.expired` (coerente con il fix iter 1 BLOCKER 1 già applicato per `auth.refresh.unavailable`).
3. Implementare effettivamente l'emissione di `auth.expired` con `category: 'config'` quando refresh fallisce/ritorna stesso token (oggi MAI emesso).

```ts
// http-error.ts:32 fix:
// | `auth.expired` | `config` | Token refresh fallito o ritorna stesso token | NO RETRY |
//                       ^^^^^^^ era 'auth' — corretto in 'config' coerente con BLOCKER 1 fix
```

Va aggiunta anche la logica runtime in `auth-strategy.ts` per emettere `auth.expired` quando `refresh()` ritorna `===` al token precedente (chiusura SEC-02 ROUTE-07).

### CR-02: URL allowlist bypass via prefix-without-boundary (CRITICAL security)

**File:** `packages/gateway/src/http/url-allowlist.ts:69-71`
**Issue:** La validazione string allowlist usa `url === entry || url.startsWith(entry)` SENZA controllare un separatore al confine. Un entry come `'https://api.example.com'` matcha:
- `'https://api.example.com.evil.com/steal'` ✗ (subdomain spoofing — bypass)
- `'https://api.example.comp/x'` ✗ (typo squat — bypass)
- `'https://api.example.com@evil.com/x'` ✗ (URL parsing trick userinfo — bypass)

Questo è un **classico path-traversal/subdomain-bypass pattern**. Il PRD §26.2 e PITFALLS #7 richiedono allowlist robusta. La doc del file dichiara "URL injection bypass mitigate" ma il match non lo previene. Inoltre la post-redirect re-validation in `http-gateway.ts:309-310` riusa la stessa funzione, propagando il bug.

**Fix:** Usare URL parsing strutturato — confronto su origine + path prefix:
```ts
export function validateAgainstAllowlist(
  url: string,
  allowlist: readonly AllowlistEntry[] | undefined,
  context: AllowlistValidationContext = {},
): void {
  if (!allowlist) return
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw createBrokerError({
      code: 'gateway.url.forbidden',
      category: 'config',
      message: `URL "${url}" is not a valid URL`,
      // ... context
    })
  }
  const ok = allowlist.some((entry) => {
    if (entry instanceof RegExp) return entry.test(url)
    // Parse entry come URL e confronta origine + pathname prefix
    let entryUrl: URL
    try { entryUrl = new URL(entry) } catch { return false }
    if (parsed.origin !== entryUrl.origin) return false
    // Path prefix con boundary su '/' — evita 'foo' che matcha 'foobar'
    const entryPath = entryUrl.pathname
    const urlPath = parsed.pathname
    if (entryPath === '/' || entryPath === '') return true
    return urlPath === entryPath ||
           urlPath.startsWith(entryPath.endsWith('/') ? entryPath : entryPath + '/')
  })
  if (!ok) { /* throw as before */ }
}
```

### CR-03: Information Disclosure — response.body completo in BrokerError.details

**File:** `packages/routing/src/route-handlers/http-handler.ts:242`
**Issue:** Su HTTP error (4xx/5xx) il handler costruisce un BrokerError con `details: { httpStatus: response.status, body: response.body }`. Il `body` può contenere payload sensibili dal server (token, PII, stack trace, dati utenti altrui). L'`OutcomeCollector.sanitizeError` (outcome-collector.ts:159-171) **preserva** il campo `details` nella publish a `<topic>.failed`, quindi il body server viaggia nell'evento finale. La doc del file (linea 26-27) dichiara "originalError preservato; OutcomeCollector sanitizza prima del publish" — sbagliato: solo `originalError`/`cause`/`stack` sono rimossi, NON `details.body`.

Threat coverage T-03-08-05 nel file menziona "accept" ma il commento è disallineato con la severity reale: server response 401 potrebbe contenere `{token: '...'}` o stack trace di un endpoint debug, espone consumer legati a `<topic>.failed`. PITFALLS #17 richiede no-token-logging — viola.

**Fix:** Rimuovere `body` da details (o limitare a metadati strutturati `{httpStatus}`):
```ts
// http-handler.ts:242
const error = createBrokerError({
  code,
  category: 'network',
  message: `HTTP ${response.status}`,
  routeId: route.id,
  topic: event.topic,
  eventId: event.id,
  details: { httpStatus: response.status }, // ← rimosso body
})
```

In alternativa, sanitizzare in `OutcomeCollector.sanitizeError` (outcome-collector.ts:159-171) escludendo `details.body` esplicitamente:
```ts
const safeDetails: Record<string, unknown> | undefined = err.details ? { ...err.details } : undefined
if (safeDetails && 'body' in safeDetails) delete safeDetails['body']
return { /* ... */, ...(safeDetails && { details: safeDetails }) }
```

### CR-04: Race condition `inFlight` Map — composite eventId reuse + cascade abort

**File:** `packages/routing/src/route-executor.ts:160-162, 217-227`
**Issue:** `RouteExecutor.execute()` registra l'entry in `inFlight.set(event.id, ...)` via `getOrCreateController` (riga 217-227). Il `finally { this.inFlight.delete(event.id) }` (riga 161) rimuove l'entry alla fine. PROBLEMA: per route `'composite'`, il `compositeHandler` (creato in constructor riga 105-112) chiama `httpHandler(e, subRoute)` con **lo stesso eventId** del composite. Il sub-handler viene executato **dentro** `execute()` — la sequenza è:

1. `execute(compositeRoute, event)` → set inFlight[event.id] = compositeController
2. composite handler → invoca httpHandler(event, subRoute) inline
3. httpHandler (closure su `getOrCreateController`) → trova entry esistente → riusa il controller
4. fetch fa abort logic referenziando il signal del composite controller
5. composite handler completes
6. `finally { delete inFlight[event.id] }` (riga 161)

OK in happy-path. Ma in scenario cascade:
- Plugin A registra route composite (ownerId=A); composite step 'http' punta a route 'r-http' (ownerId=B).
- abortInFlightByOwner('B') chiamato durante composite in volo: `inFlight[event.id]` ha ownerId='A' (route composite), NON 'B'. Il signal della sub-fetch NON viene abortito. Bypass del cascade.

Inoltre `abortInFlight(eventId)` rimuove logicamente il controller ma **non l'entry dal Map** (riga 175-180): aborta solo il signal. Successivo `finally { delete }` riga 161 elimina entry corretto, ma se `execute()` viene chiamato due volte concorrentemente con stesso eventId (raro ma possibile su retry esterni), la prima `finally` rimuove l'entry della seconda invocazione.

**Fix:**
1. Per cascade ownership composite: il `getOrCreateController` deve registrare l'ownerId della **sub-route** quando invocato inline, oppure mantenere una mappa `Set<ownerId>` per entry. Alternativa: passare il signal del composite alla sub-fetch ma tracciare separatamente nel `HttpGateway.inFlight` (che ha `routeId/ownerId` corretti del sub-handler — verificato in `http-gateway.ts:162-166`). 
2. Per double-execute: usare composite key `${routeId}::${eventId}` invece di solo `eventId`.

```ts
// route-executor.ts:217 fix
private getOrCreateController(eventId: string, route: CompiledRoute): AbortController {
  const key = `${route.id}::${eventId}`
  const existing = this.inFlight.get(key)
  if (existing) return existing.controller
  const controller = new AbortController()
  this.inFlight.set(key, { controller, ownerId: route.ownerId, routeId: route.id })
  return controller
}
// e propagare la chiave a finally + abortInFlight*
```

### CR-05: ROUTE-11 dedupe NON wired — SC #4 pubblicato come PARTIAL ma claim "primitives complete e testate"

**File:** `packages/gateway/src/http/http-gateway.ts:128-250`, `packages/routing/src/router-engine.ts:144`
**Issue:** Il `RouterEngine` instanzia `dedupeStrategy` (router-engine.ts:144) ma `HttpGateway.execute()` **NON la invoca mai**. Grep `strategies.dedupe` in `http-gateway.ts` → ZERO occorrenze. La SC #4 in 03-VERIFICATION.md dice "PARTIAL (override) — Primitives complete e testate in isolation" e l'override è marcato come deferred F4. Il problema è duplice:

1. **Verifica scorretta**: il commento "primitives complete e testate" è vero per `dedupe-strategy.ts` ma il **wiring runtime è completamente assente** — non c'è nemmeno una "TODO" o un commento esplicito in `HttpGateway.execute()` che il dedupe è skippato. Un consumer che legge il codice gateway può ragionevolmente assumere che `strategies.dedupe` sia chiamato.

2. **API surface coherence**: il bundle `HttpGatewayStrategies` (http-gateway.ts:55-63) accetta `dedupe?: DedupeStrategy` ma `execute()` lo ignora. Questo è un'API "fantasma": rompe il contratto Strategy Pattern dichiarato in D-68 e produce silenziosamente comportamento diverso da quello atteso.

**Fix:** Una delle seguenti:
1. Wiring effettivo di `strategies.dedupe.execute(key, () => fetch())` attorno al retry loop.
2. Rimuovere `dedupe` da `HttpGatewayStrategies` e `RouterEngine.strategies` finché non è wired (no API fantasma).
3. Aggiungere un commento esplicito `// TODO F4: wiring dedupe-strategy DEFERRED` sopra il retry loop di `execute()` con riferimento a 03-VERIFICATION.md override #2.

Stesso ragionamento per `backpressure` e `latest-only` (override #1) e per `delegateMapToShape`/`delegateMapToCanonical` V1 fallback identity (override #3 in router-broker-wrapper.ts:575-607). Il claim "wiring deferred" è documentato in SUMMARY ma **manca la marcatura inline nel codice** che renderebbe ovvio al developer F4 dove inserire il fix.

```ts
// http-gateway.ts:188 — aggiungere sopra il retry loop:
// FIXME F4 wiring deferred (override 03-VERIFICATION.md #2):
// strategies.dedupe NON è invocato qui. Per chiudere ROUTE-11 end-to-end,
// wrappare il retry loop in: return strategies.dedupe.execute(dedupeKey, () => { /* retry loop */ })
// con dedupeKey derivato da routeId + sortedQueryParams (D-74 fallback).
```

## Warnings

### WR-01: `RouterBroker.publish` fire-and-forget senza `.catch` — unhandled rejection

**File:** `packages/routing/src/router-broker-wrapper.ts:296-298`
**Issue:** `for (const route of matches) { void this.executeRoute(...) }` — il `void` opera sull'expression ma NON aggiunge un `.catch` handler. `executeRoute` ha try/catch interno (riga 333-355) e dovrebbe non throw, ma se per qualunque ragione (es. `collector.collect` throw post-tap-emit, oppure `createBrokerError` itself fail), la Promise rejecta unhandled. In Node strict mode + browser dev mode, questo emette `unhandledrejection` event. Pattern difensivo richiesto.

**Fix:**
```ts
for (const route of matches) {
  this.executeRoute(route, topic, payload, safeOptions, eventId).catch(() => {
    // executeRoute è già try/catch internally; questo .catch è defense-in-depth
    // contro throw fuori dal try/catch (es. collector.collect post-tap)
  })
}
```

### WR-02: BackpressureStrategy NON propaga signal al task — orphan execution

**File:** `packages/gateway/src/http/strategies/backpressure-strategy.ts:108-115, 154-169, 247-277`
**Issue:** `executeTracked(state, task)` chiama `await task()` SENZA passare un AbortSignal. La policy `'latest-only'` aborta l'AbortController della entry pending (riga 250) ma il task in volo (un closure su `() => httpGateway.execute(...)`) non ha modo di ricevere quell'abort: continua l'esecuzione fino al completamento. Il `entry.reject(...)` (riga 251-258) fa sì che il **caller** riceva una rejection, ma la fetch interna gira fino a network-finish, consumando bandwidth e potenzialmente registrando side-effect server (per POST/PUT). Memory leak: il task continua a tenere risorse (response body parse, etc.) anche se nessuno aspetta il risultato.

Stesso problema in `'merge'`/`'coalesce'` (riga 283-309) e in `'queue-bounded'` con `dropOldest: true` (riga 138-169).

**Fix:** Il `BackpressureStrategy.schedule` deve esporre un AbortSignal al task:
```ts
// http-strategies.ts:131-138 update interface:
export interface BackpressureStrategy {
  schedule<T>(
    routeId: string,
    priority: 'critical' | 'high' | 'normal' | 'low',
    task: (signal: AbortSignal) => Promise<T>, // ← signal propagato
  ): Promise<T>
  queueLength(routeId: string): number
}
// backpressure-strategy.ts: nei rami latest-only/coalesce/dropOldest:
const taskSignal = controller.signal
executeTracked(state, () => task(taskSignal))
```

E il caller (http-handler.ts/http-gateway.ts una volta wired) deve combinare quel signal nel `combineSignals(externalSignal, ownController, timeoutSignal, backpressureSignal)`.

### WR-03: classifyError reason cross-leak con BrokerError instances

**File:** `packages/gateway/src/http/http-gateway.ts:359-368`
**Issue:** `String(externalSignal.reason ?? '')` e `String(ownSignal.reason ?? '')` — se reason è un BrokerError o un oggetto, `String(obj)` produce `'[object Object]'` (a meno di custom toString). La condizione `reason.includes('timeout') || reason === 'gateway.timeout'` su `'[object Object]'` ritorna sempre false → cade in `gateway.aborted`. Esempio: `route-executor.ts:178` chiama `entry.controller.abort('gateway.aborted')` (string OK), ma `route-executor.ts:197` chiama `entry.controller.abort('plugin.unregistered')` (string OK), MENTRE `backpressure-strategy.ts:144-150` chiama `oldest.controller.abort('backpressure.dropped-oldest')` poi `oldest.reject(createBrokerError(...))` — ma sull'AbortController.abort passa la STRING reason. OK in questi casi.

Tuttavia, l'utente del package può chiamare `broker.unregisterPlugin('x')` che cascade abort con reason string, ma se un consumer custom chiama `controller.abort(brokerErrorInstance)`, classifyError fallisce silenziosamente. Inoltre il rilevamento di timeout dipende dalla string contenente `'timeout'`: se un consumer abort con reason `'user.canceled'`, classify ritorna `gateway.aborted` (corretto), ma se la reason è `'request.took.too.long.timeout-ish'`, classify ritorna `gateway.timeout` (false positive da substring match).

**Fix:** Verifica primaria su `timeoutSignal.aborted` (già presente, OK). Sostituire substring match con check esplicito:
```ts
const isTimeoutReason = (sig: AbortSignal): boolean => {
  if (!sig.aborted) return false
  const r = sig.reason
  return r === 'gateway.timeout' ||
         (typeof r === 'string' && r === 'TimeoutError') ||
         (r instanceof DOMException && r.name === 'TimeoutError')
}
```

### WR-04: Idempotency LRU non true-LRU (FIFO documentato come LRU)

**File:** `packages/gateway/src/http/strategies/idempotency-strategy.ts:91-110`
**Issue:** Il commento riga 24 e 56-65 dichiara "LRU bounded", ma l'implementazione (riga 99-110) è **FIFO**: `Map.keys().next().value` ritorna sempre la **prima** chiave inserita, mai la "least recently used". Un eventId vecchio ma usato di recente (retry attempt 2) viene comunque dropped al overflow, mentre un eventId nuovo ma mai più usato resta. Per V1 con `maxEventsTracked: 1000` e short retry budget (≤30s) il problema è marginale, ma il naming è misleading.

**Fix:** Una di:
1. Rinominare ovunque "LRU" → "FIFO" o "insertion-order eviction". Aggiornare doc.
2. Implementare LRU vero: su `get(eventId) → existing`, fare `tokenByEventId.delete(eventId); tokenByEventId.set(eventId, existing)` per spostare l'entry in fondo (most recently used). Costo: una delete+set per get esistente.
```ts
generate(eventId: string): string {
  const existing = tokenByEventId.get(eventId)
  if (existing !== undefined) {
    // Touch: move to end (LRU update)
    tokenByEventId.delete(eventId)
    tokenByEventId.set(eventId, existing)
    return existing
  }
  // ... rest unchanged
}
```

### WR-05: `attemptCount` non incluso in BrokerError shape D-80

**File:** `packages/gateway/src/http/http-gateway.ts:237-246`
**Issue:** Il throw del network-error finale non popola `retryAttempt` — un campo D-80 documentato (outcome-collector.ts:151-158 dichiara `httpStatus`/`retryAttempt`/`retryAfterMs` come parte dello shape esteso F3). `details: { attemptCount: attempt }` lo mette in `details` invece che in field strutturato. `sanitizeError` legge `ext.retryAttempt` (outcome-collector.ts:166) ma quel field non è popolato → publish `<topic>.failed` ha sempre `retryAttempt: undefined`. Consumer non può distinguere retry-exhausted da first-fail.

**Fix:** Set `retryAttempt` al BrokerError invece di nei details:
```ts
throw createBrokerError({
  code: this.classifyError(...),
  category: 'network',
  message: lastError?.message ?? 'Network error',
  routeId: route.id, topic: event.topic, eventId: event.id,
  ...(lastError && { originalError: lastError }),
}) as BrokerError & { retryAttempt: number }
// e setting `retryAttempt: attempt` come field strutturato (richiede estensione di CreateBrokerErrorParams)
```
Idealmente, estendere `CreateBrokerErrorParams` in `@gluezero/core/types/error.ts` con `retryAttempt?` / `httpStatus?` / `retryAfterMs?` — MA viola D-83. Workaround: usa `details` consistentemente e modifica `sanitizeError` per leggere da details.

### WR-06: Retry loop attempt counter — off-by-one tra http-gateway e retry-strategy

**File:** `packages/gateway/src/http/http-gateway.ts:189-227`, `packages/gateway/src/http/strategies/retry-strategy.ts:113-148`
**Issue:** http-gateway.ts usa `let attempt = 0` poi incrementa PRIMA del fetch (`attempt++; await this.fetchOnce(...)`). Quindi attempt assume valori `1, 2, 3, ...`. retry-strategy.ts calcola `delayMs` con `baseDelayMs * 2 ** attempt` — al primo retry (attempt=1) il delay è `300 * 2 = 600ms`, NON `300ms` come ci si aspetterebbe. La PITFALLS #5 formula esatta è `baseDelay * 2^attempt` ma con `attempt` che parte da 0 (cioè post-1°-fail, attempt=1 → `300 * 2^1 = 600ms`). OK semanticamente ma il commento doc retry-strategy.ts:78 dice `baseDelayMs * 2^attempt` senza chiarire il valore iniziale.

Inoltre `shouldRetry(... attempt: number)`: la guard `if (attempt >= maxAttempts) return false` (retry-strategy.ts:126). Ma in http-gateway.ts il `shouldRetry` viene chiamato con `attempt` POST-incremento. Sequenza con maxAttempts=3:
- attempt=1, fetch → response 500 → shouldRetry(response, undefined, 1) → 1<3 → true → delay (using attempt=1)
- attempt=2, fetch → response 500 → shouldRetry(..., 2) → 2<3 → true → delay (using attempt=2)
- attempt=3, fetch → response 500 → shouldRetry(..., 3) → 3>=3 → false → break, return parseResponse(500)

Risultato: 3 attempts totali (1 first + 2 retries), corretto rispetto a "maxAttempts: 3 default; retry totali = 3". MA la doc retry-strategy.ts:67 dice "maxAttempts: 1 → solo first attempt; n → first + (n-1) retry max" e D-69 dice "maxAttempts: 3 default" — coerente. **Il problema è solo doc**: il delay del primo retry è `600ms` non `300ms` (fattore 2x), che può sorprendere consumer che leggono `baseDelayMs: 300`.

**Fix:** Allineare la doc — chiarire che `baseDelayMs * 2^attempt` con `attempt=1` per il primo retry produce `600ms`, oppure modificare la formula a `baseDelayMs * 2^(attempt-1)`:
```ts
// retry-strategy.ts:145 — sottrarre 1 per allineare semantica:
const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1))
// → primo retry attempt=1 → baseDelayMs * 2^0 = baseDelayMs (300ms come documentato)
```

### WR-07: Redirect refetch bypassa retry loop e potenzialmente body consumed

**File:** `packages/gateway/src/http/http-gateway.ts:296-316`
**Issue:** `fetchOnce` su 3xx fa refetch manuale: `return await fetch(resolvedUrl, init)`. Problemi:
1. Il refetch usa lo stesso `init` con stesso `init.body`. Se body è `ReadableStream` (BodyInit accetta ReadableStream), è già **consumed** dalla prima fetch — refetch fail con `TypeError: body stream already read`. Per body string/Blob/FormData OK ma per stream KO.
2. Il refetch è OUT OF retry loop: se refetch ritorna 503 (server in difficoltà sul nuovo URL), nessun retry viene applicato. Il consumer riceve direttamente 503 senza i 3 attempts default. Per redirect verso un endpoint che si ripiega, retry policy è completamente saltata.
3. Il `Idempotency-Key` header (già injectato) viene riusato sul refetch — corretto solo se il server consider lo stesso key per il nuovo URL. Standard Stripe-style assume unique key per resource path; ambiguo qui.

**Fix:** Trattare il redirect come "first attempt" del retry loop:
```ts
private async fetchOnce(req: HttpRequestSpec, signal: AbortSignal): Promise<Response> {
  const init: RequestInit = { /* ... */ redirect: 'manual', /* ... */ }
  const response = await fetch(req.url, init)
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location')
    if (location !== null) {
      const resolvedUrl = new URL(location, req.url).href
      validateAgainstAllowlist(resolvedUrl, this.config.allowlist)
      // Detect non-replayable body
      if (init.body instanceof ReadableStream) {
        throw createBrokerError({
          code: 'gateway.network',
          category: 'network',
          message: 'Cannot follow redirect: request body is a stream and was already consumed',
        })
      }
      // Riavvia il retry loop con il nuovo URL
      return await fetch(resolvedUrl, init)
    }
  }
  return response
}
```

E preferibilmente delegare il follow al retry loop esterno: `fetchOnce` ritorna il response 3xx, `execute()` rileva il redirect, riallinea l'URL nel retry loop. Più pulito ma più refactor.

### WR-08: getOrCreateController in executor con composite eventId

**File:** `packages/routing/src/route-executor.ts:217-227, 105-112`
**Issue:** Vedi anche CR-04. Inoltre, il `compositeHandler` (riga 105-112) inietta un wrapper httpHandler che invoca `getOrCreateController(e.id, subRoute)` — passa la **subRoute** come secondo argomento, ma se l'entry esiste già (creata dal composite chiamando `execute()` riga 127), `getOrCreateController` ritorna il controller **senza aggiornare** `entry.ownerId`/`entry.routeId`. Quindi `inFlight[event.id]` continua a riferire la **composite** route, non la sub-route. `abortInFlightByOwner('subRouteOwner')` non aborta la sub-fetch in volo del composite. Stessa root cause di CR-04 ma con questa angolazione: il composite handler ha un design conceptual issue di shared inFlight key.

**Fix:** Vedi CR-04 — usare composite key `${routeId}::${eventId}` o lista di owners per entry.

### WR-09: deriveLoadedTopic/deriveFailedTopic — duplicato logico tra outcome-collector e router-broker-wrapper

**File:** `packages/routing/src/outcome-collector.ts:113-142`, `packages/routing/src/router-broker-wrapper.ts:504-510`
**Issue:** `outcome-collector.ts` definisce `deriveLoadedTopic` e `deriveFailedTopic`. `router-broker-wrapper.ts` definisce un'altra `deriveFailedTopic` come metodo privato. Due definizioni sostanzialmente identiche per la stessa convention. Drift potenziale: se F4 cambia la convention in un file ma non nell'altro, comportamento divergente sui topic `.failed` emessi pre-route-resolved (line 273) vs post-outcome (line 297).

Inoltre `router-broker-wrapper.ts:507-509` fa il check `if (suffix === 'requested')` MA fall-through ritorna `${topic}.failed` per topic come `'auth.login.success'` — produrrebbe `'auth.login.success.failed'` che è un topic con 4 segmenti, sintatticamente valido (TOPIC_REGEX accetta) ma semanticamente ambiguo.

**Fix:** Spostare le 2 helper in un file utility dedicato e re-usarle in entrambi i siti. Aggiungere test per topic non `*.requested`:
```ts
// packages/routing/src/internal/topic-derive.ts
export function deriveLoadedTopic(originalTopic: string): string { /* unica */ }
export function deriveFailedTopic(originalTopic: string): string { /* unica */ }
```

### WR-10: parseResponse swallow JSON parse errors silently

**File:** `packages/gateway/src/http/http-gateway.ts:326-339`
**Issue:** `try { body = await response.json() } catch { body = null }`. Se la response è `text/html` (es. server 500 pagina HTML), `body = null` silenzioso. Il caller `http-handler.ts:232` controlla `response.ok` — se `false` con HTML body, `details.body` è `null` (privo di info diagnostico). Se `response.ok && body=null`, il mapper.mapToCanonical riceve null → output potrebbe essere `{ value: null }` (vedi `outcome-collector.ts:266-272` basePayload fallback).

Inoltre la doc (riga 322) dice "il caller decide la severity" — ma l'errore originale (es. SyntaxError, network EOF) viene silenziosamente nascosto. Difficoltà debug.

**Fix:** Conservare l'errore in details opzionale + log via tap:
```ts
private async parseResponse(response: Response): Promise<HttpResponseSpec> {
  let body: unknown
  let parseError: string | undefined
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('json')) {
      body = await response.json()
    } else {
      body = await response.text() // preserva il body anche per HTML
    }
  } catch (err) {
    body = null
    parseError = (err as Error).message
  }
  return {
    ok: response.ok, status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
    ...(parseError !== undefined && { parseError }),
  }
}
```

### WR-11: combine-signals — listener leak su long-lived external signal

**File:** `packages/gateway/src/http/combine-signals.ts:46-54`
**Issue:** Il polyfill aggiunge `sig.addEventListener('abort', () => composite.abort(sig.reason), { once: true })` per ogni input signal. `{ once: true }` rimuove il listener al primo abort sull'input — buono. Ma se l'input signal NON aborta mai (es. external AbortController creato dal subscriber owner che vive a lungo), il listener resta indefinitamente sul signal **anche quando il composite signal è già garbage-collected**. Il closure contiene reference a `composite.abort.bind(composite)` → tiene vivo il `composite` AbortController e tutti i suoi listeners → memory growth lineare con N fetch su lo stesso external signal.

Esempio: subscriber `subscribe(handler, { signal: longLivedSignal })` poi 1000 fetch route per quel subscriber → 1000 listener residui su longLivedSignal anche dopo che le 1000 fetch completano.

**Fix:** Quando il composite signal aborta o quando la fetch completa, rimuovere esplicitamente i listener. Richiede un cleanup function ritornata da `combineSignals`:
```ts
export function combineSignals(...signals: ReadonlyArray<AbortSignal | undefined>): {
  signal: AbortSignal
  dispose: () => void
} {
  const real = signals.filter((s): s is AbortSignal => s !== undefined)
  const Native = (AbortSignal as unknown as { any?: (s: readonly AbortSignal[]) => AbortSignal }).any
  if (typeof Native === 'function') return { signal: Native.call(AbortSignal, real), dispose: () => {} }
  const composite = new AbortController()
  const handlers: Array<{ sig: AbortSignal; fn: () => void }> = []
  for (const sig of real) {
    if (sig.aborted) { composite.abort(sig.reason); break }
    const fn = (): void => composite.abort(sig.reason)
    sig.addEventListener('abort', fn, { once: true })
    handlers.push({ sig, fn })
  }
  return {
    signal: composite.signal,
    dispose: () => { for (const h of handlers) h.sig.removeEventListener('abort', h.fn) },
  }
}
```
Il caller (`http-gateway.ts:171`) chiama `dispose()` nel `finally` (riga 247-249).

## Info

### IN-01: `as unknown as` cast in delegate stub (V1 fallback identity)

**File:** `packages/routing/src/router-broker-wrapper.ts:148-150, 575-588, 597-607`
**Issue:** 3 punti usano `as unknown as` per accedere a campi privati di `MapperBroker` (`canonicalRegistry`, `mapper.applyOutputMap`, `mapper.applyInputMap`). Documentati in JSDoc come V1 fallback, ma fragili: refactor F2 può rompere senza errori TS. Specificamente, righe 575-588 e 597-607 fanno `void inner; void outputMap; return canonical` — letteralmente identity passthrough. Override #3 in 03-VERIFICATION.md documenta deferred F4/F6.

**Fix:** Inserire un assertion runtime "loud" più visibile:
```ts
private delegateMapToShape(canonical: unknown, outputMap: unknown): unknown {
  // V1 IDENTITY PASSTHROUGH — wiring deferred F4/F6 (03-VERIFICATION.md override #3)
  // QUANDO F2 espone `MapperEngine.mapToShape(canonical, inlineMap)`, sostituire con
  // `return this.inner.mapper.mapToShape(canonical, outputMap)`
  return canonical
}
```
e rimuovere il `void inner; void outputMap` rumoroso (no-op). Aggiungere un dev-mode warning UNA volta all'invocazione per surface al developer.

### IN-02: cacheWarnEmitted flag senza reset

**File:** `packages/routing/src/route-handlers/composite-handler.ts:70`
**Issue:** Il `cacheWarnEmitted` è chiuso nella closure dell'handler factory, no reset. Per multi-tenant GlueZero instances con vita lunga, il warning UNA volta vale per la vita del executor. Se il consumer registra/unregistra plugin dinamicamente, il warning non si ri-emette per nuove route composite con cache step. Acceptable per V1.

### IN-03: msw-server.ts esposto come test-utils ma senza marker test-only

**File:** `packages/routing/src/test-utils/msw-server.ts`
**Issue:** Il file è in `test-utils/` ma viene incluso nel barrel se ri-esportato. Verificare che non sia in `index.ts` pubblico (verifica: `routing/src/index.ts` non importa da `test-utils/`, OK). Il package deve dichiarare `test-utils` come subpath separato (vedi 03-CONTEXT.md D-89 + msw 2.13.6 setup) — verificato non esposto.

### IN-04: `void` operator come placeholder pattern

**File:** `packages/routing/src/router-broker-wrapper.ts:585-586, 604-605`, `packages/routing/src/router-engine.ts:196`
**Issue:** `void inner; void outputMap;` e `void deps.routingConfig` sono placeholder per "uso futuro / silenziare lint". Pattern accettato ma rumoroso. In F4 questi `void` vanno rimossi — l'audit richiede grep facile su `void inner` per identificare i punti da implementare.

**Fix:** Sostituire con `// FIXME F4: ...` comment e ritornare immediatamente, evitando l'expression `void`:
```ts
// router-engine.ts:196
// FIXME F4: routingConfig è attualmente unused (consumed dal RouterBroker wrapper).
// Quando F4 estende il RouterEngine con multipleRoutesPolicy lookup interno, leggere qui.
```

### IN-05: route-resolver.ts — id `string` plain senza regex validation

**File:** `packages/routing/src/route-resolver.ts:133-156`
**Issue:** `def.id` è validato solo per duplicate ma non per shape (es. `''`, `' '`, special chars). Un `id: ''` registrato + `unregister('')` funziona, ma collision potenziale con default values. La doc 03-CONTEXT.md non specifica un branded type.

**Fix:** Aggiungere check minimal:
```ts
if (!def.id || typeof def.id !== 'string' || def.id.trim() === '') {
  throw createBrokerError({
    code: 'route.id.invalid',
    category: 'config',
    message: 'RouteDefinition.id must be a non-empty string',
  })
}
```

### IN-06: deferred sezioni e BLOCKER 5 cross-reference

**File:** `packages/routing/src/router-broker-wrapper.ts:575-607`, `packages/gateway/src/http/http-gateway.ts:128-250`
**Issue:** I 3 deferral (mapToShape identity, dedupe wiring, latest-only wiring) sono già marcati nei VERIFICATION override. Cross-reference con BLOCKER 5: il rischio di review non è il deferral in sé (decisione architetturale documentata), ma la mancanza di marker `// FIXME F4` inline che renderebbero ovvio al developer F4 dove inserire il fix. Vedi CR-05 per la fix.

---

## Allegato — Cross-Cutting Observations

**D-83 strict (zero modifiche core/mapper):** verificato manualmente.
- Nessun import da `packages/core/src/` o `packages/mapper/src/` con path relativi che bypassano il barrel pubblico.
- Composition wrapper pattern preservato (RouterBroker = wrap(MapperBroker)).
- Cast isolati `as unknown as` documentati con loud throw o rationale.

**Pipeline §28 step 7-full + 8/9/10:** instrumentazione presente.
- Step 8 emesso in `router-broker-wrapper.ts:244-254` (route.resolved).
- Step 9 emesso in `route-executor.ts:236-260` (route.executed).
- Step 10 emesso in `outcome-collector.ts:344-372` (outcome.collected).
- Tap try/catch swallow inline (replica F2 emitF2Tap pattern). OK.

**Performance:**
- Dispatch table pre-compilata O(segments) — verificato in route-resolver.ts (TopicTrie + Map<id, CompiledRoute>).
- Strategy registry: factory invocate UNA volta in `RouterEngine` constructor — no recompilation hot-path.
- Backpressure pending array `Array.indexOf` → O(n) ricerca. Per N piccoli (max 100 default queue-bounded) accettabile; per `latest-only` pending è tipicamente 1 → trivial. INFO non blocker.

**Type safety:**
- `as unknown as` cast localizzati e documentati.
- Nessun `any` non motivato (verificato grep `: any` → solo type guards in test files).
- `exactOptionalPropertyTypes: true` rispettato via conditional spread.

**API surface coherence:**
- `registerRoute`/`unregisterRoute`/`registerPlugin` coerente con F1/F2 patterns.
- Naming JSDoc italiano consistente.
- Export type via barrel + runtime exports.

**Concurrency safety (PITFALLS #2):**
- AbortController cascade: implementato ma con CR-04 race su composite eventId reuse.
- Dedupe Promise singleton: implementato in `dedupe-strategy.ts` MA non wired (CR-05).
- Latest-only abort timing: implementato in `backpressure-strategy.ts` MA non wired e con WR-02 orphan execution.

**Resource leaks (PITFALLS #1):**
- `Map<eventId, ...>` in `route-executor.inFlight`, `http-gateway.inFlight`: cleanup via `finally` — OK ma con CR-04 race.
- `tokenByEventId` LRU bounded `1000` — OK con WR-04 naming nit.
- `inflight Map` in dedupe-strategy: cleanup via `finally` + maxInflight cap.
- combine-signals listener leak — WR-11.

**Error handling:**
- BrokerError shape D-80: `category` field setting con WR-01 mancanza 'auth' enum.
- `originalError` preservato — OK.
- Double publish (D-82): recursion guard `inFlightPublishes` Set in outcome-collector — verificato OK.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer, model claude-opus-4-7-1)_
_Depth: standard_
