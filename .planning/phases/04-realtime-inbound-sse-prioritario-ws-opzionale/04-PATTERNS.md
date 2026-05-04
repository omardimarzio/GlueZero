---
phase: 04
date: 2026-05-04
files_count: 22
analogs_found: 22
analog_coverage: full
---

# Phase 04 — Pattern Map (Realtime inbound SSE/WS)

> Mappa per `gsd-planner`: per ogni file da creare/modificare in F4, indica l'analogo più vicino già presente nel codebase F1/F2/F3, con excerpt concreti da copiare/adattare e integration points. Tutti i path sono assoluti.
>
> Convenzione: lingua italiana per descrizione, inglese per identifier/path/code.

---

## 1. Summary table

| # | New / Modified File | Role | Data Flow | Closest Analog | Match Quality | Plan |
|---|---------------------|------|-----------|----------------|---------------|------|
| 1 | `packages/gateway/src/sse-ws/augment.ts` | type-augment | config | `packages/gateway/src/augment.ts` | exact (sibling subpath) | 04-01 |
| 2 | `packages/gateway/src/sse-ws/types/realtime-config.ts` | type | config | `packages/gateway/src/http/types/gateway-config.ts` | exact | 04-01 |
| 3 | `packages/gateway/src/sse-ws/types/realtime-channel-def.ts` | type | config | `packages/routing/src/types/route-definition.ts` | exact (discriminated def) | 04-01 |
| 4 | `packages/gateway/src/sse-ws/types/frame-envelope.ts` | type | parser | `packages/gateway/src/http/types/http-strategies.ts` (HttpRequestSpec/Response) | role-match | 04-02 |
| 5 | `packages/gateway/src/sse-ws/types/index.ts` | barrel | — | `packages/gateway/src/http/types/index.ts` | exact | 04-01/08 |
| 6 | `packages/gateway/src/sse-ws/frame-parser.ts` + `.test.ts` | utility (parser) | parser | `packages/gateway/src/http/retry-after-parser.ts` (+ `.test.ts`) | exact (pure parser pattern) | 04-02 |
| 7 | `packages/gateway/src/sse-ws/reconnect-strategy.ts` + `.test.ts` | state-machine | lifecycle | `packages/gateway/src/http/strategies/circuit-breaker.ts` (+ `.test.ts`) | exact (state machine + factory) | 04-03 |
| 8 | `packages/gateway/src/sse-ws/visibility-detector.ts` + `.test.ts` | state-machine | lifecycle (event-driven) | `packages/gateway/src/http/strategies/circuit-breaker.ts` + `combine-signals.ts` (DOM event listener) | role-match | 04-04 |
| 9 | `packages/gateway/src/sse-ws/sse-adapter.ts` + `.test.ts` | adapter | ingress (streaming) | `packages/gateway/src/http/http-gateway.ts` (fetch lifecycle + abort cascade) | role-match (network primitive wrapper) | 04-05 |
| 10 | `packages/gateway/src/sse-ws/websocket-adapter.ts` + `.test.ts` | adapter | ingress (streaming) | `packages/gateway/src/http/http-gateway.ts` + `frame-parser.ts` (proprio dell'adapter) | role-match | 04-06 |
| 11 | `packages/gateway/src/sse-ws/realtime-channel-manager.ts` + `.test.ts` | manager (registry) | lifecycle / cleanup | `packages/routing/src/route-resolver.ts` (per-owner registry) + `packages/gateway/src/http/http-gateway.ts` (`abortInFlightByOwner`) | role-match | 04-07 |
| 12 | `packages/gateway/src/sse-ws/realtime-broker.ts` + `.test.ts` | composition wrapper (broker) | facade | `packages/routing/src/router-broker-wrapper.ts` (RouterBroker compone MapperBroker) | exact (catena composition) | 04-08 |
| 13 | `packages/gateway/src/sse-ws/public-factory.ts` + `.test.ts` | factory (config validation) | config | `packages/gateway/src/http/public-factory.ts` (createHttpGateway) + `packages/routing/src/public-factory.ts` (createRouterBroker) | exact | 04-08 |
| 14 | `packages/gateway/src/sse-ws/index.ts` | barrel (subpath) | — | `packages/gateway/src/http/index.ts` | exact | 04-01 → 04-08 |
| 15 | `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts` | test util | test | `packages/routing/src/test-utils/msw-server.ts` + ad-hoc minimal mock | role-match | 04-05 |
| 16 | `packages/gateway/src/sse-ws/test-utils/mock-websocket.ts` | test util | test | come sopra | role-match | 04-06 |
| 17 | `packages/gateway/src/sse-ws/test-utils/sse-server.ts` | test util | test | `packages/routing/src/test-utils/msw-server.ts` (msw setup) | role-match | 04-05 |
| 18 | `packages/gateway/src/sse-ws/test-utils/ws-server.ts` | test util | test | come sopra | role-match | 04-06 |
| 19 | `packages/gateway/src/sse-ws/test-utils/realtime-harness.ts` | test util (harness) | test | `packages/routing/src/test-utils/router-harness.ts` | exact (harness factory) | 04-08 |
| 20 | `packages/gateway/src/sse-ws/__integration__/*.test.ts` (6 file) | integration test | test | `packages/routing/src/__integration__/route-cascade-cleanup.test.ts` | exact | 04-08 |
| 21 | `packages/gateway/package.json` (UPDATE: subpath export `./sse-ws` + sideEffects ext) | config | build | `packages/gateway/package.json` (sezione `exports."./http"`) | exact | 04-01 |
| 22 | `packages/gateway/tsup.config.ts` (UPDATE: entry `'sse-ws/index'`) | config | build | `packages/gateway/tsup.config.ts` (commento "Phase 4 aggiungerà...") | exact | 04-01 |
| 23 | `packages/gateway/vitest.config.ts` (NO-OP confirm) | config | test | corrente | unchanged | 04-01 |
| 24 | `packages/gateway/src/index.ts` (UPDATE: re-export `./sse-ws`) | barrel | — | corrente (già `export * from './http'`) | exact | 04-01 → 04-08 |

**Coverage:** 100% (22/22 file con analog match esatto o role-match dimostrato). Nessun "no analog found".

---

## 2. Per-File Patterns

### 2.1 `packages/gateway/src/sse-ws/augment.ts`

- **Role:** Type augmentation (TS declaration merging)
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/augment.ts` (intero file, 92 LOC) e `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/augment.ts` (lines 59-119 + marker pattern lines 152-171).
- **Key pattern:** declaration merging additivo del tipo `BrokerConfig` per aggiungere `realtime?: RealtimeConfig` E del tipo `PluginDescriptor` per aggiungere `realtimeChannels?: readonly RealtimeChannelDef[]`. Marker `__augmentSseWsLoaded` ri-esportato dal barrel per anti tree-shaking.

**Excerpt da copiare/adattare** (basato su `gateway/src/augment.ts:53-92`):

```ts
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import type { RealtimeConfig } from './types/realtime-config'

declare module '@sembridge/core' {
  /**
   * F4 augmentation (D-103): aggiunge `realtime?: RealtimeConfig` a BrokerConfig.
   * Sezione complementare a `gateway` (F3) e `routes`/`routing` (F3 routing augment).
   */
  interface BrokerConfig {
    /** Sezione `realtime` (D-102, PRD §18.3-18.4): config canali SSE/WS multi-channel. */
    realtime?: RealtimeConfig
  }

  /**
   * F4 augmentation (D-103, RT-01): aggiunge il campo opzionale `realtimeChannels`
   * al PluginDescriptor pubblico — chiude il placeholder F1 in
   * `packages/core/src/types/plugin.ts:50` ("F4 will add: realtimeChannels").
   *
   * I canali sono auto-registrati al `registerPlugin` con `ownerId = pluginId`
   * (cascade D-26 ext F4 / D-112). Cf. routing/src/augment.ts:75-78 pattern routes.
   */
  interface PluginDescriptor {
    /** Canali realtime auto-registrati al `registerPlugin` con `ownerId = pluginId` (D-103). */
    readonly realtimeChannels?: readonly RealtimeChannelDef[]
  }
}

/** F4 PipelineStep — eventi step §28 emessi dagli adapter SSE/WS. */
export type F4PipelineStep =
  | 'event.realtime.received' // step 1 ingress da adapter (D-113)
  | 'event.realtime.frame-parsed' // step 1.b parser (D-106)
  | 'event.realtime.reconnecting' // diagnostic (D-109)

/** Marker anti tree-shaking — Pattern S1 replica `__augmentLoaded` di routing. */
export const __augmentSseWsLoaded: true = true
```

**Integration points:**
- `packages/gateway/src/index.ts` (umbrella) DEVE ri-esportare `__augmentSseWsLoaded` PRIMA di `export * from './sse-ws'` per side-effect import.
- `packages/gateway/package.json` `sideEffects` array già copre `**/augment.ts` — nessuna modifica.
- `packages/gateway/tsup.config.ts` aggiunge entry `'sse-ws/augment': 'src/sse-ws/augment.ts'` se F4 vuole dist file separato (opzionale: il sideEffects glob `**/augment.ts` matcha già `dist/sse-ws/augment.js` se prodotto da multi-entry tsup).

**Anti-pattern da evitare** (PITFALL §11.7):
- NON augmentare `RouteDefinition` con `type: 'realtime-inbound'` qui (PRD §17.5 lo prevede ma è scope F3 placeholder, non F4 V1). F4 usa il MANAGER, non un route handler.

---

### 2.2 `packages/gateway/src/sse-ws/types/realtime-config.ts`

- **Role:** Configuration type
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/types/gateway-config.ts` (struttura nested config con sezioni opzionali)
- **Key pattern:** `RealtimeConfig` con sub-sezioni `defaults?: { reconnect?, heartbeat?, visibility? }` + `channels?: readonly RealtimeChannelDef[]` (pre-registrate al boot, pattern F3 `routes`).

**Excerpt da copiare/adattare** (struttura analoga a `GatewayConfig`):

```ts
import type { RealtimeChannelDef } from './realtime-channel-def'

/** Default reconnect policy (D-109 — RT-05 override-abile). */
export interface ReconnectDefaults {
  readonly baseMs?: number          // default 1_000 (D-109)
  readonly capMs?: number           // default 30_000 (D-109)
  readonly consolidationMs?: number // default 5_000 (Claude's discretion §6.2)
  readonly maxAttempts?: number     // default Infinity (RT-05)
  readonly fallbackThreshold?: number // default 3 (D-107)
  readonly globalCycleCap?: number    // default 5 (D-107)
}

/** Default heartbeat policy (D-111 — WS ping/pong + SSE freshness). */
export interface HeartbeatDefaults {
  readonly intervalMs?: number     // default 30_000 (D-111)
  readonly staleTimeoutMs?: number // default 60_000 (D-111)
}

/** Default visibility policy (D-110 — Visibility API integration). */
export interface VisibilityDefaults {
  readonly toleranceMultiplier?: number // default 3 (D-110)
}

/**
 * Configurazione realtime (root config dichiarata in BrokerConfig.realtime).
 * Pattern identico a `GatewayConfig` di F3 (sub-sezioni opzionali).
 */
export interface RealtimeConfig {
  /** Default applicati a tutti i canali che non li overridano (RT-05). */
  readonly defaults?: {
    readonly reconnect?: ReconnectDefaults
    readonly heartbeat?: HeartbeatDefaults
    readonly visibility?: VisibilityDefaults
  }
  /** Canali pre-registrati al boot (D-102 — analogo a `routes` di F3). */
  readonly channels?: readonly RealtimeChannelDef[]
}
```

**Integration points:**
- Letto da `RealtimeBroker` constructor (analogo `RouterBroker` plan 03-12).
- Validato in `public-factory.ts` via Valibot `looseObject` (pattern createHttpGateway).

---

### 2.3 `packages/gateway/src/sse-ws/types/realtime-channel-def.ts`

- **Role:** Discriminated channel definition + factory type
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/types/route-definition.ts` (lines 38-70 — `RouteDefinitionBase` + `RouteHttpDefinition` pattern)
- **Key pattern:** `RealtimeChannelDef` con `mode: 'sse' | 'websocket' | 'auto'` discriminator (D-107), `name: string` come chiave indice manager (D-102), `buildUrl?: () => Promise<string>` hook auth-agnostic (D-104), `backpressure?: BackpressureStrategy` riuso F3 (D-115).

**Excerpt da copiare/adattare** (struttura simil-`RouteDefinitionBase` di routing/src/types/route-definition.ts:38-43):

```ts
import type { BackpressurePolicyConfig } from '@sembridge/routing'

/** Modalità di connessione realtime (D-107 — auto = SSE-first con fallback). */
export type RealtimeMode = 'sse' | 'websocket' | 'auto'

/**
 * Per-channel reconnect override (D-109). Tutti override-abili da `RealtimeConfig.defaults`.
 */
export interface RealtimeReconnectConfig {
  readonly baseMs?: number
  readonly capMs?: number
  readonly maxAttempts?: number
  readonly fallbackThreshold?: number
  readonly globalCycleCap?: number
}

/**
 * Definizione di un canale realtime (D-102 — multi-channel topology).
 *
 * Indicizzato per `name` univoco nel `RealtimeChannelManager`. Ogni canale ha proprio
 * adapter (SSE o WS), proprio reconnect state, proprio `buildUrl()` hook.
 *
 * Coerente con `RouteDefinitionBase` di F3 (id+topic+priority): `name` qui ha lo
 * stesso ruolo di `id` per un route, ma a livello di canale.
 */
export interface RealtimeChannelDef {
  /** Chiave univoca del canale nel Manager (D-102). */
  readonly name: string
  /** Modalità connessione (D-107). Default `'auto'` se omesso. */
  readonly mode?: RealtimeMode
  /**
   * Hook auth-agnostic invocato PRIMA di OGNI connect/reconnect (D-104).
   * Return value = URL completo (incluso eventuale token in query string).
   * Default fallback: `url` statico se omesso.
   */
  readonly buildUrl?: () => Promise<string>
  /** URL fallback se `buildUrl` non fornito (D-104). */
  readonly url?: string
  /** Subprotocols WS opzionali (PITFALL §11.3 / Claude's discretion §4.7). */
  readonly wsSubprotocols?: string | readonly string[]
  /** Override reconnect per-canale (D-109). */
  readonly reconnect?: RealtimeReconnectConfig
  /** Override heartbeat per-canale WS (D-111). */
  readonly heartbeat?: { readonly intervalMs?: number; readonly staleTimeoutMs?: number }
  /** Backpressure strategy adapter-level (D-115 — riuso F3). */
  readonly backpressure?: BackpressurePolicyConfig
}
```

**Integration points:**
- `BackpressurePolicyConfig` importato da `@sembridge/routing` (riuso D-115). Verificare che il barrel di `@sembridge/routing` esporti `BackpressurePolicyConfig` — già confermato in `packages/routing/src/index.ts:83-93` (export type block).
- Type usato dal Manager (`registerChannel`), dall'augment (`PluginDescriptor.realtimeChannels`), dalla public-factory (validation).

---

### 2.4 `packages/gateway/src/sse-ws/types/frame-envelope.ts`

- **Role:** Type del WS envelope
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/types/http-strategies.ts` (HttpRequestSpec/HttpResponseSpec)
- **Key pattern:** Plain readonly interface con il contract envelope D-106.

**Excerpt da copiare/adattare:**

```ts
/**
 * Envelope JSON default per WebSocket frames (D-106).
 *
 * `topic` → BrokerEvent.topic. `data` → payload raw (poi normalizzato dal mapper
 * step 4 §28). `id` opzionale → BrokerEvent.id (se assente, generato via nanoid).
 *
 * Frame non-conformi (parse fail o missing topic) → publish `network.error` con
 * `category: 'protocol'` + descarta (D-106).
 */
export interface FrameEnvelope {
  readonly topic: string
  readonly data: unknown
  readonly id?: string
}

/** Result discriminato del parser (pattern simile a `RouteOutcome` F3). */
export type FrameParseResult =
  | { readonly ok: true; readonly envelope: FrameEnvelope }
  | { readonly ok: false; readonly reason: 'malformed-json' | 'missing-topic' | 'invalid-shape'; readonly raw: string }
```

**Integration points:**
- Letto dal `frame-parser.ts` (return type) e dal `websocket-adapter.ts` (input al `broker.publish`).

---

### 2.5 `packages/gateway/src/sse-ws/frame-parser.ts` (+ `.test.ts`)

- **Role:** Pure parser utility
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/retry-after-parser.ts` (intero file, 80 LOC + test deterministici a coppia)
- **Key pattern:** Pure function senza state, narrow input → narrow output, error path = ritorna `{ ok: false, reason }` invece di throw (graceful), test TDD RED→GREEN deterministici.

**Excerpt da copiare/adattare** (struttura identica a `parseRetryAfter` di retry-after-parser.ts:53-80):

```ts
import type { FrameEnvelope, FrameParseResult } from './types/frame-envelope'

/**
 * Parse un frame WebSocket testuale come `FrameEnvelope` JSON (D-106).
 *
 * Contract:
 * - `raw` deve essere stringa JSON con shape `{ topic: string, data: unknown, id?: string }`.
 * - Frame non-conformi → `{ ok: false, reason }` (caller publish `network.error`).
 * - NIENTE throw: il caller (websocket-adapter.ts) gestisce graceful.
 *
 * Pattern identico a `parseRetryAfter` (gateway/src/http/retry-after-parser.ts:53-80):
 * narrow input/output, no side-effect, no throw, test deterministici tier-1 jsdom.
 *
 * @param raw - Stringa raw del frame (da `MessageEvent.data` su `'message'` event).
 * @returns FrameParseResult discriminato — caller usa `.ok` per branching.
 */
export function parseFrame(raw: unknown): FrameParseResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'malformed-json', raw: String(raw) }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'malformed-json', raw }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, reason: 'invalid-shape', raw }
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.topic !== 'string' || obj.topic.length === 0) {
    return { ok: false, reason: 'missing-topic', raw }
  }
  return {
    ok: true,
    envelope: {
      topic: obj.topic,
      data: obj.data,
      ...(typeof obj.id === 'string' && { id: obj.id }),
    },
  }
}

/** Topic riservati internal (D-111 — filtrati dall'adapter, non emessi al broker). */
export const INTERNAL_TOPICS = Object.freeze({
  PING: '__ping__',
  PONG: '__pong__',
} as const)

/** Verifica se un topic è riservato internamente (PITFALL §11.7 — match strict). */
export function isInternalTopic(topic: string): boolean {
  return topic === INTERNAL_TOPICS.PING || topic === INTERNAL_TOPICS.PONG
}
```

**Test pattern (riprodurre da `retry-after-parser.test.ts` — Test 1..N deterministici):**

```ts
import { describe, expect, it } from 'vitest'
import { isInternalTopic, parseFrame } from './frame-parser'

describe('parseFrame (D-106)', () => {
  it('Test 1: envelope valido { topic, data } → { ok: true, envelope }', () => {
    const result = parseFrame('{"topic":"weather.update","data":{"city":"Roma"}}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.envelope.topic).toBe('weather.update')
      expect(result.envelope.data).toEqual({ city: 'Roma' })
    }
  })

  it('Test 2: missing topic → { ok: false, reason: "missing-topic" }', () => {
    const result = parseFrame('{"data":{"x":1}}')
    expect(result).toEqual({ ok: false, reason: 'missing-topic', raw: '{"data":{"x":1}}' })
  })

  it('Test 3: malformed JSON → { ok: false, reason: "malformed-json" }', () => {
    expect(parseFrame('not json').ok).toBe(false)
  })

  it('Test 4: PITFALL §11.7 isInternalTopic strict — "weather.__ping__" passa attraverso', () => {
    expect(isInternalTopic('weather.__ping__')).toBe(false)
    expect(isInternalTopic('__ping__')).toBe(true)
  })
})
```

**Integration points:**
- Importato dal `websocket-adapter.ts` per il `'message'` event handler.
- NON usato dal `sse-adapter.ts` (SSE ha già `event.data` parsed dal browser); `sse-adapter.ts` può comunque usare `parseFrame` se un `event:` field custom richiede envelope JSON.

---

### 2.6 `packages/gateway/src/sse-ws/reconnect-strategy.ts` (+ `.test.ts`)

- **Role:** State machine factory (full jitter + auto-fallback)
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/strategies/circuit-breaker.ts` (state machine 3-state + factory) + `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/strategies/retry-strategy.ts` (full jitter formula lines 144-156)
- **Key pattern:** Factory `createReconnectStrategy(options)` che ritorna interface con `nextDelayMs(attempt)`, `recordFailure()`, `recordSuccess()`, `shouldFallback()`, `getMode()`. State machine `sse → ws → sse → ws` con `globalCycleCap` (D-107) + reset criteria (D-109 §6.2 `consolidationMs`).

**Excerpt da copiare/adattare** (mash-up `circuit-breaker.ts:38-180` + `retry-strategy.ts:144-156`):

```ts
import type { RealtimeMode } from './types/realtime-channel-def'

/** Stato interno per-channel della reconnect state machine (D-107 + D-109). */
interface ReconnectState {
  /** Modalità correntemente attiva. */
  mode: 'sse' | 'websocket'
  /** Counter fail consecutivi nel mode corrente (reset a success). */
  consecutiveFailures: number
  /** Counter cycle SSE↔WS effettuati (cap globale D-107 = 5). */
  cycles: number
  /** Timestamp ultima connessione successful (per consolidationMs reset — §6.2). */
  lastSuccessAt: number
  /** Counter total reconnect attempts (per maxAttempts cap RT-05). */
  totalAttempts: number
}

export interface ReconnectStrategyOptions {
  readonly baseMs?: number          // default 1000 (D-109)
  readonly capMs?: number           // default 30_000 (D-109)
  readonly consolidationMs?: number // default 5_000 (§6.2)
  readonly maxAttempts?: number     // default Infinity (RT-05)
  readonly fallbackThreshold?: number // default 3 (D-107)
  readonly globalCycleCap?: number    // default 5 (D-107)
  readonly initialMode?: 'sse' | 'websocket' // default 'sse' (D-107 SSE-first)
  /** Override Math.random per test deterministici (pattern retry-strategy.ts §15). */
  readonly random?: () => number
}

export interface ReconnectStrategy {
  /** Next backoff delay con full jitter (D-109). */
  nextDelayMs(): number
  /** Registra fail dell'ultima connect attempt — incrementa counter + check fallback. */
  recordFailure(): void
  /** Registra success — reset counter (con consolidationMs guard). */
  recordSuccess(): void
  /** True se threshold raggiunto + cycle cap non exceeded (D-107). */
  shouldFallback(): boolean
  /** Switch SSE↔WS mode (caller decide quando dopo `shouldFallback() === true`). */
  fallback(): 'sse' | 'websocket'
  /** Mode corrente. */
  getMode(): 'sse' | 'websocket'
  /** True se cap globale raggiunto → permanent failure (D-107). */
  isPermanentlyFailed(): boolean
  /** Reset completo (per disconnect manuale + reconnect). */
  reset(): void
}

/**
 * Crea una `ReconnectStrategy` con full jitter + auto-fallback (D-107, D-109).
 *
 * Formula full jitter (RESEARCH §6.1, AWS Architecture Blog, identica a retry-strategy.ts):
 *   `delay = random(0, min(capMs, baseMs * 2^attempt))`
 *
 * State machine: `sse[0..N fail] → ws[0..N fail] → sse[0..N fail] → ... → permanent`.
 *
 * @example
 * ```ts
 * const r = createReconnectStrategy({ initialMode: 'auto' })
 * while (!connected && !r.isPermanentlyFailed()) {
 *   await sleep(r.nextDelayMs())
 *   try { await connect(r.getMode()) ; r.recordSuccess() ; connected = true }
 *   catch { r.recordFailure(); if (r.shouldFallback()) r.fallback() }
 * }
 * ```
 */
export function createReconnectStrategy(options: ReconnectStrategyOptions = {}): ReconnectStrategy {
  const baseMs = options.baseMs ?? 1_000
  const capMs = options.capMs ?? 30_000
  const consolidationMs = options.consolidationMs ?? 5_000
  const maxAttempts = options.maxAttempts ?? Infinity
  const fallbackThreshold = options.fallbackThreshold ?? 3
  const globalCycleCap = options.globalCycleCap ?? 5
  const random = options.random ?? Math.random

  const state: ReconnectState = {
    mode: options.initialMode === 'websocket' ? 'websocket' : 'sse',
    consecutiveFailures: 0,
    cycles: 0,
    lastSuccessAt: 0,
    totalAttempts: 0,
  }

  return {
    nextDelayMs(): number {
      // Full jitter formula identica a retry-strategy.ts:153-155 ma con `random(0, exp)`.
      const exponential = Math.min(capMs, baseMs * 2 ** state.consecutiveFailures)
      return Math.floor(random() * exponential)
    },
    recordFailure(): void {
      state.consecutiveFailures++
      state.totalAttempts++
    },
    recordSuccess(): void {
      // §6.2 consolidationMs guard: reset counter SOLO se la connessione è rimasta
      // up per almeno consolidationMs (evita reset prematuro su connect-then-instant-fail).
      const now = Date.now()
      if (state.lastSuccessAt === 0 || now - state.lastSuccessAt >= consolidationMs) {
        state.consecutiveFailures = 0
        state.cycles = 0
      }
      state.lastSuccessAt = now
    },
    shouldFallback(): boolean {
      // Mode esplicito ('sse' o 'websocket' iniziale forzato dal consumer) → niente fallback.
      // Per `mode: 'auto'` D-107: 3 fail consecutivi nel mode corrente → fallback.
      if (state.cycles >= globalCycleCap) return false // permanent
      return state.consecutiveFailures >= fallbackThreshold
    },
    fallback(): 'sse' | 'websocket' {
      state.mode = state.mode === 'sse' ? 'websocket' : 'sse'
      state.consecutiveFailures = 0 // counter reset al cambio mode (D-107)
      state.cycles++
      return state.mode
    },
    getMode(): 'sse' | 'websocket' {
      return state.mode
    },
    isPermanentlyFailed(): boolean {
      return state.cycles >= globalCycleCap || state.totalAttempts >= maxAttempts
    },
    reset(): void {
      state.mode = options.initialMode === 'websocket' ? 'websocket' : 'sse'
      state.consecutiveFailures = 0
      state.cycles = 0
      state.lastSuccessAt = 0
      state.totalAttempts = 0
    },
  }
}
```

**Test pattern** (riprodurre struttura da `circuit-breaker.test.ts:19-80` con `vi.useFakeTimers()` per `consolidationMs`):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReconnectStrategy } from './reconnect-strategy'

describe('createReconnectStrategy (D-107, D-109)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1: nextDelayMs full jitter formula con random=0.5 → 0.5 * exp', () => {
    const r = createReconnectStrategy({ baseMs: 1000, capMs: 30_000, random: () => 0.5 })
    expect(r.nextDelayMs()).toBe(500) // 0.5 * (1000 * 2^0) = 500
    r.recordFailure()
    expect(r.nextDelayMs()).toBe(1000) // 0.5 * (1000 * 2^1) = 1000
  })

  it('Test 2: 3 fail consecutivi in mode "sse" → shouldFallback() true', () => {
    const r = createReconnectStrategy({ fallbackThreshold: 3 })
    for (let i = 0; i < 3; i++) r.recordFailure()
    expect(r.shouldFallback()).toBe(true)
    expect(r.fallback()).toBe('websocket')
  })

  it('Test 3: 5 cycle SSE↔WS senza success → isPermanentlyFailed() true', () => {
    const r = createReconnectStrategy({ fallbackThreshold: 1, globalCycleCap: 5 })
    for (let i = 0; i < 5; i++) {
      r.recordFailure()
      r.fallback()
    }
    expect(r.isPermanentlyFailed()).toBe(true)
    expect(r.shouldFallback()).toBe(false) // cap reached
  })

  it('Test 4: success entro consolidationMs → counter NON resettato (§6.2 guard)', () => {
    const r = createReconnectStrategy({ consolidationMs: 5_000 })
    r.recordFailure() // 1 fail
    r.recordSuccess()
    vi.advanceTimersByTime(1_000) // 1s — sotto consolidationMs
    r.recordFailure() // 2 fail (counter NOT reset)
    expect(r.shouldFallback()).toBe(false) // 2 < default 3
  })
})
```

**Integration points:**
- Una istanza per canale, owned dal `RealtimeChannelManager` (analogo `Map<routeId, CircuitState>` di circuit-breaker).
- Il caller (sse-adapter / websocket-adapter) invoca `recordFailure/recordSuccess` su connect outcome.

---

### 2.7 `packages/gateway/src/sse-ws/visibility-detector.ts` (+ `.test.ts`)

- **Role:** State machine + DOM event listener wrapper
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/strategies/circuit-breaker.ts` (factory + state) + `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/combine-signals.ts` (DOM event listener registration + cleanup pattern lines 64-86)
- **Key pattern:** Factory che astrae `document.addEventListener('visibilitychange', ...)` con cleanup garantito + DI guard per environment senza `document` (Node/jsdom — RESEARCH §5.3).

**Excerpt da copiare/adattare** (composite di `combine-signals.ts:62-86` per cleanup + `circuit-breaker.ts:104-111` per state):

```ts
/** Stato osservato della Visibility API (D-110). */
export type VisibilityState = 'visible' | 'hidden'

export interface VisibilityDetectorOptions {
  /** Callback invocato a OGNI transition. */
  readonly onChange: (state: VisibilityState) => void
  /**
   * DI per environment senza Document (Node, Web Worker — RESEARCH §5.3).
   * Default: globalThis.document (browser/jsdom). Pass `null` per disabilitare.
   */
  readonly document?: Document | null
}

export interface VisibilityDetector {
  /** Inizia ad osservare visibilitychange. Idempotente (no-op se già attivo). */
  start(): void
  /** Stop osservazione + cleanup listener (D-112 cascade cleanup). */
  stop(): void
  /** Stato corrente snapshot. */
  getState(): VisibilityState
  /** True se start() invocato (per debug/test). */
  isActive(): boolean
}

/**
 * Crea un VisibilityDetector che astrae la Visibility API (D-110, RESEARCH §5).
 *
 * Pattern cleanup garantito (replica `combine-signals.ts:62-86` listener tracking):
 * - `start()` registra listener via `addEventListener('visibilitychange', fn)`.
 * - `stop()` chiama `removeEventListener` — cleanup garantito (no leak).
 * - Idempotente: `start()` chiamato 2x senza `stop()` registra UNA sola volta.
 *
 * DI guard (RESEARCH §5.3): se `document === null` (Node/Worker), `start()` è no-op
 * + `getState()` ritorna `'visible'` per default sicuro.
 *
 * @example
 * ```ts
 * const v = createVisibilityDetector({
 *   onChange: (s) => { if (s === 'visible') manager.checkFreshnessAll() }
 * })
 * v.start()
 * // ... later
 * v.stop()
 * ```
 */
export function createVisibilityDetector(opts: VisibilityDetectorOptions): VisibilityDetector {
  // RESEARCH §5.3 DI guard: undefined = use globalThis.document, null = explicitly disabled.
  const doc =
    opts.document !== undefined
      ? opts.document
      : typeof globalThis !== 'undefined' && 'document' in globalThis
        ? (globalThis as { document?: Document }).document ?? null
        : null

  let active = false
  let listener: (() => void) | null = null

  function read(): VisibilityState {
    if (!doc) return 'visible' // safe default (RESEARCH §5.3)
    return doc.visibilityState === 'hidden' ? 'hidden' : 'visible'
  }

  return {
    start(): void {
      if (active || !doc) return // idempotent + DI guard no-op
      listener = (): void => opts.onChange(read())
      doc.addEventListener('visibilitychange', listener)
      active = true
    },
    stop(): void {
      if (!active || !doc || listener === null) return
      doc.removeEventListener('visibilitychange', listener)
      listener = null
      active = false
    },
    getState(): VisibilityState {
      return read()
    },
    isActive(): boolean {
      return active
    },
  }
}
```

**Integration points:**
- Owned dal `RealtimeChannelManager` (singolo detector globale, registered al primo `connectRealtime` D-110, deregistered al `disconnectRealtime` ultimo canale).
- `onChange` callback invoca `manager.checkFreshnessAll()` → ogni adapter verifica `lastEventReceivedAt` + reconnect immediato se stale.

**Anti-pattern da evitare:**
- NON usare `setInterval` per polling — la Visibility API è event-driven, polling produrrebbe overhead inutile (RESEARCH §5).

---

### 2.8 `packages/gateway/src/sse-ws/sse-adapter.ts` (+ `.test.ts`)

- **Role:** Network adapter (EventSource wrapper)
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/http-gateway.ts` (lines 100-298 — fetch lifecycle + abort cascade + classifyError + inFlight registry + finally cleanup)
- **Key pattern:** Class che incapsula `EventSource`, gestisce lifecycle (connect/disconnect/reconnect), propaga AbortController, integra `ReconnectStrategy`, applica `BackpressureStrategy` PRIMA di `broker.publish`. Last-Event-ID auto-handled da EventSource (RESEARCH §3.2 — unique adv di SSE).

**Excerpt — pattern abort cascade da http-gateway.ts:160-171 + 263-265:**

```ts
import type { BrokerEvent } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { nanoid } from 'nanoid'
import type { BackpressureStrategy } from '@sembridge/gateway/http' // riuso F3 D-115
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import { createReconnectStrategy, type ReconnectStrategy } from './reconnect-strategy'

export interface SseAdapterDeps {
  readonly publishFn: (event: BrokerEvent) => void
  readonly backpressure?: BackpressureStrategy
  /** Optional injected EventSource constructor per test (default: globalThis.EventSource). */
  readonly EventSourceCtor?: typeof EventSource
}

export class SseAdapter {
  private es: EventSource | null = null
  private readonly controller = new AbortController()
  private readonly reconnect: ReconnectStrategy
  private lastEventReceivedAt = 0

  constructor(
    private readonly def: RealtimeChannelDef,
    private readonly deps: SseAdapterDeps,
  ) {
    this.reconnect = createReconnectStrategy({
      ...(def.reconnect?.baseMs !== undefined && { baseMs: def.reconnect.baseMs }),
      // ... altri override
      initialMode: 'sse',
    })
  }

  /**
   * Connette il canale. Pattern lifecycle identico a `http-gateway.execute`:
   *   try { setup → register inFlight → attendi outcome → cleanup in finally }
   *
   * Last-Event-ID: NESSUN setup manuale necessario — EventSource invia automaticamente
   * `Last-Event-ID` header al reconnect nativo (RESEARCH §3.2). Il custom reconnect F4
   * crea un NEW EventSource → necessario propagare `lastEventId` via `buildUrl()`
   * (es. query string `?lastEventId=xyz`) se il server expect su URL invece che header.
   */
  async connect(externalSignal?: AbortSignal): Promise<void> {
    if (this.controller.signal.aborted) return
    // Cascade cleanup: external signal aborts → close EventSource (D-112).
    externalSignal?.addEventListener('abort', () => this.disconnect(), { once: true })

    const url = this.def.buildUrl ? await this.def.buildUrl() : this.def.url
    if (!url) {
      throw createBrokerError({
        code: 'realtime.config.invalid',
        category: 'config',
        message: `Channel "${this.def.name}": neither buildUrl nor url provided`,
      })
    }

    const Ctor = this.deps.EventSourceCtor ?? EventSource
    this.es = new Ctor(url, { withCredentials: true })

    this.es.addEventListener('open', () => {
      this.reconnect.recordSuccess()
      this.deps.publishFn({
        id: nanoid(),
        topic: 'system.realtime.connected',
        timestamp: Date.now(),
        source: { type: 'server', id: 'realtime-channel', name: 'sse' },
        payload: { channel: this.def.name },
      } as BrokerEvent)
    })

    this.es.addEventListener('message', (ev) => {
      this.lastEventReceivedAt = Date.now()
      // D-115: backpressure adapter-level PRIMA del publish.
      const event: BrokerEvent = {
        id: ev.lastEventId || nanoid(),
        topic: this.def.name, // o derivato da event.type custom
        timestamp: Date.now(),
        source: { type: 'server', id: 'realtime-channel', name: 'sse' },
        payload: ev.data,
      } as BrokerEvent
      if (this.deps.backpressure) {
        this.deps.backpressure
          .schedule(this.def.name, 'normal', () => Promise.resolve(this.deps.publishFn(event)))
          .catch(() => {
            /* drop logged — pattern http-gateway error swallow */
          })
      } else {
        this.deps.publishFn(event)
      }
    })

    this.es.addEventListener('error', () => {
      // D-109 reconnect loop — D-107 fallback se shouldFallback().
      this.reconnect.recordFailure()
      this.disconnect()
      // Schedule reconnect via setTimeout(reconnect.nextDelayMs())
      // Caller (manager) decide il loop di reconnect.
    })
  }

  /** Disconnect + cleanup (riuso pattern http-gateway.ts:263-265 finally). */
  disconnect(reason: string = 'manual'): void {
    if (this.es) {
      this.es.close()
      this.es = null
    }
    this.controller.abort(reason)
    this.deps.publishFn({
      id: nanoid(),
      topic: 'system.realtime.disconnected',
      timestamp: Date.now(),
      source: { type: 'server', id: 'realtime-channel', name: 'sse' },
      payload: { channel: this.def.name, reason },
    } as BrokerEvent)
  }

  /** Freshness check invocato da Visibility API on-visible (D-110). */
  checkFreshness(staleTimeoutMs: number): boolean {
    if (this.lastEventReceivedAt === 0) return true // mai ricevuto, assume fresh
    return Date.now() - this.lastEventReceivedAt < staleTimeoutMs
  }
}
```

**Integration points:**
- `EventSourceCtor` DI per test (RESEARCH §9.1 jsdom non supporta EventSource nativo → mock).
- Backpressure passato dal manager via DI (riuso F3 `BackpressureStrategy` di gateway/http).
- `broker.publish` invocato via `publishFn` — niente import diretto del broker (loose coupling).

**Anti-pattern da evitare** (PITFALL §11.5 + RESEARCH §3.3):
- NON usare il native reconnect di EventSource: chiudere e ricreare al fail (RESEARCH §3.3) per controllo full jitter + fallback.
- NON chiamare `EventSource` con custom headers (PRD §31.3 + D-105) — auth via `buildUrl()` query string.

---

### 2.9 `packages/gateway/src/sse-ws/websocket-adapter.ts` (+ `.test.ts`)

- **Role:** Network adapter (WebSocket wrapper) + ping/pong stale detection
- **Closest analog:** `sse-adapter.ts` (sibling, stesso template) + `frame-parser.ts` (D-106) + `circuit-breaker.ts:118-127` (state machine timing pattern per stale detection)
- **Key pattern:** Class WebSocket-specific con timer `setInterval(ping, intervalMs)` + `staleTimeoutMs` watchdog. `__ping__/__pong__` filtrati via `isInternalTopic` di frame-parser.

**Excerpt** (incrementale rispetto a SSE — solo le parti specifiche WS):

```ts
import { isInternalTopic, parseFrame, INTERNAL_TOPICS } from './frame-parser'
// ... resto degli import identici a sse-adapter.ts

export class WebSocketAdapter {
  private ws: WebSocket | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastPongAt = 0
  private readonly heartbeatIntervalMs: number
  private readonly staleTimeoutMs: number

  // ... constructor analogo a SseAdapter

  async connect(externalSignal?: AbortSignal): Promise<void> {
    // ... setup analogo

    const url = this.def.buildUrl ? await this.def.buildUrl() : this.def.url
    // Scheme switch automatico se buildUrl ritorna http(s):// (D-107)
    const wsUrl = url!.replace(/^http/, 'ws')

    const subprotocols = this.def.wsSubprotocols
    this.ws = subprotocols
      ? new WebSocket(wsUrl, subprotocols as string | string[])
      : new WebSocket(wsUrl)

    this.ws.addEventListener('open', () => {
      this.startHeartbeat()
      // ... publish system.realtime.connected
    })

    this.ws.addEventListener('message', (ev) => {
      // D-106: parse envelope JSON.
      const result = parseFrame(ev.data)
      if (!result.ok) {
        this.deps.publishFn({
          id: nanoid(),
          topic: 'network.error',
          timestamp: Date.now(),
          source: { type: 'server', id: 'realtime-channel', name: 'websocket' },
          payload: { category: 'protocol', reason: result.reason, raw: result.raw },
        } as BrokerEvent)
        return
      }
      // PITFALL §11.7 — filter internal topics strict match (no wildcard).
      if (isInternalTopic(result.envelope.topic)) {
        if (result.envelope.topic === INTERNAL_TOPICS.PONG) {
          this.lastPongAt = Date.now()
        }
        return // consumed internamente
      }
      // ... publish con backpressure (identico a SSE)
    })

    this.ws.addEventListener('close', (ev) => {
      // PITFALL §11.8 — close 1006 ambiguity: log code + reason.
      this.disconnect(`ws.closed.${ev.code}`)
    })
  }

  /** Ping/pong applicativo (D-111) — invia ping ogni intervalMs, controlla pong entro staleTimeoutMs. */
  private startHeartbeat(): void {
    this.lastPongAt = Date.now()
    this.heartbeatTimer = setInterval(() => {
      // Stale detection: se nessun pong entro staleTimeoutMs → reconnect.
      if (Date.now() - this.lastPongAt > this.staleTimeoutMs) {
        this.disconnect('stale.no-pong')
        return
      }
      // Send ping envelope.
      this.ws?.send(JSON.stringify({ topic: INTERNAL_TOPICS.PING, data: { ts: Date.now() } }))
    }, this.heartbeatIntervalMs)
  }

  disconnect(reason: string = 'manual'): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.ws) {
      this.ws.close(1000, reason)
      this.ws = null
    }
    // ... rest identico a SseAdapter.disconnect
  }
}
```

**Integration points:**
- Stesso `publishFn` + `backpressure` DI di SseAdapter.
- Test: jsdom non supporta WebSocket nativo → MockWebSocket DI come per SSE.

**Anti-pattern da evitare** (PITFALL §11.8):
- NON fidarsi di `readyState === OPEN` come proof of liveness (TCP zombie, RESEARCH §4.6) — affidarsi al ping/pong app-level.

---

### 2.10 `packages/gateway/src/sse-ws/realtime-channel-manager.ts` (+ `.test.ts`)

- **Role:** N-channel registry + cascade cleanup + visibility orchestration
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/route-resolver.ts` (per-owner registry pattern, `unregisterByOwner`) + `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/http-gateway.ts:283-298` (`abortInFlightByOwner` cascade D-86)
- **Key pattern:** `Map<channelName, ChannelEntry>` con `ownerId` per cascade D-112. Visibility detector singleton attivato al primo `connect`, deactivated all'ultimo `disconnect`.

**Excerpt — pattern abortInFlightByOwner di http-gateway.ts:283-298:**

```ts
import { createVisibilityDetector, type VisibilityDetector } from './visibility-detector'
import { SseAdapter } from './sse-adapter'
import { WebSocketAdapter } from './websocket-adapter'
import type { RealtimeChannelDef } from './types/realtime-channel-def'

interface ChannelEntry {
  readonly def: RealtimeChannelDef
  readonly ownerId: string
  adapter: SseAdapter | WebSocketAdapter
  readonly controller: AbortController
}

export class RealtimeChannelManager {
  private readonly channels = new Map<string, ChannelEntry>()
  private visibility: VisibilityDetector | null = null
  // ... deps in constructor (publishFn, backpressure, defaults)

  /**
   * Registra + connette un canale (D-102). `ownerId` per cascade D-112.
   *
   * Pattern: lazy visibility detector — registrato al PRIMO canale, deregistrato
   * all'ULTIMO (D-110). Mirror del `RouteResolver.register/unregister` di F3.
   */
  async connect(def: RealtimeChannelDef, ownerId: string = 'system'): Promise<void> {
    if (this.channels.has(def.name)) {
      throw createBrokerError({
        code: 'realtime.channel.duplicate',
        category: 'config',
        message: `Channel "${def.name}" already registered`,
      })
    }
    // Visibility detector lazy init (D-110 al primo canale).
    if (this.channels.size === 0 && this.visibility === null) {
      this.visibility = createVisibilityDetector({
        onChange: (state) => {
          if (state === 'visible') this.checkFreshnessAll()
        },
      })
      this.visibility.start()
    }

    const controller = new AbortController()
    const mode = def.mode ?? 'auto'
    const adapter =
      mode === 'websocket'
        ? new WebSocketAdapter(def, this.deps)
        : new SseAdapter(def, this.deps) // auto = SSE-first (D-107)

    this.channels.set(def.name, { def, ownerId, adapter, controller })
    await adapter.connect(controller.signal)
  }

  /** Disconnect singolo canale o tutti (D-102 — `name` omesso = tutti). */
  disconnect(name?: string): void {
    if (name === undefined) {
      // Disconnect ALL: cascade close.
      for (const entry of this.channels.values()) {
        entry.adapter.disconnect('manual.disconnect-all')
        entry.controller.abort('manual.disconnect-all')
      }
      this.channels.clear()
      this.teardownVisibility()
      return
    }
    const entry = this.channels.get(name)
    if (!entry) return
    entry.adapter.disconnect('manual')
    entry.controller.abort('manual')
    this.channels.delete(name)
    if (this.channels.size === 0) this.teardownVisibility()
  }

  /**
   * Cascade cleanup D-112 (chiusura LIFE-02 ext F4) — pattern identico a
   * `HttpGateway.abortInFlightByOwner` di gateway/src/http/http-gateway.ts:283-298.
   *
   * @returns Numero di canali chiusi (0 se nessuno).
   */
  disconnectByOwner(ownerId: string, reason: string = 'plugin.unregistered'): number {
    let count = 0
    for (const [name, entry] of this.channels.entries()) {
      if (entry.ownerId === ownerId) {
        entry.adapter.disconnect(reason)
        entry.controller.abort(reason)
        this.channels.delete(name)
        count++
      }
    }
    if (this.channels.size === 0) this.teardownVisibility()
    return count
  }

  /** Freshness check su tutti i canali (D-110 al visibility=visible). */
  checkFreshnessAll(): void {
    for (const entry of this.channels.values()) {
      const stale = !entry.adapter.checkFreshness(/* staleTimeoutMs */ 60_000)
      if (stale) {
        // Disconnect + reconnect immediato (D-110)
        entry.adapter.disconnect('stale.visibility-check')
      }
    }
  }

  private teardownVisibility(): void {
    if (this.visibility !== null) {
      this.visibility.stop()
      this.visibility = null
    }
  }
}
```

**Integration points:**
- Composed dal `RealtimeBroker` (analogo `RouterEngine` composed dal `RouterBroker`).
- `disconnectByOwner` invocato dal `RealtimeBroker.unregisterPlugin` cascade override.

---

### 2.11 `packages/gateway/src/sse-ws/realtime-broker.ts` (+ `.test.ts`)

- **Role:** Composition wrapper top-level (estende `RouterBroker`)
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/router-broker-wrapper.ts` (intero file, 629 LOC — composition, publish override, registerPlugin/unregisterPlugin override, cascade cleanup)
- **Key pattern:** `RealtimeBroker` compone `RouterBroker` (D-101 — chain F1 → F2 → F3 → F4). API publica: `connectRealtime(def)`, `disconnectRealtime(name?)`. Override `unregisterPlugin` per cascade D-112.

**Excerpt — pattern composition di router-broker-wrapper.ts:105-226 (constructor + composition):**

```ts
import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'
import type { Subscription, PluginDescriptor } from '@sembridge/core'
import { RealtimeChannelManager } from './realtime-channel-manager'
import type { RealtimeConfig } from './types/realtime-config'
import type { RealtimeChannelDef } from './types/realtime-channel-def'

/**
 * Configurazione RealtimeBroker — accetta tutto il RouterBrokerConfig di F3 + sezione F4.
 *
 * Pattern declaration merging: `realtime?: RealtimeConfig` aggiunto via augment.ts.
 */
export interface RealtimeBrokerConfig extends RouterBrokerConfig {
  readonly realtime?: RealtimeConfig
}

/**
 * RealtimeBroker — composition wrapper di RouterBroker per F4 SSE/WS (D-101).
 *
 * Pattern identico a RouterBroker (router-broker-wrapper.ts:105-226):
 *   - inner: RouterBroker (F3) — delegato per pub/sub/lifecycle base + routing
 *   - manager: RealtimeChannelManager — N canali SSE/WS indicizzati per name
 *   - publish/subscribe → delegate a inner
 *   - registerPlugin/unregisterPlugin → override per cascade auto-register channels
 *   - connectRealtime/disconnectRealtime → API surface F4 (PRD §16.2)
 *
 * Vincolo D-101: ZERO modifiche a F1/F2/F3 runtime — solo composition.
 *
 * @example
 * ```ts
 * const broker = createRealtimeBroker({
 *   realtime: {
 *     channels: [
 *       { name: 'orders', mode: 'auto', buildUrl: async () => `/events?token=${await getToken()}` }
 *     ]
 *   }
 * })
 * await broker.connectRealtime({ name: 'notifications', mode: 'sse', url: '/notifications' })
 * ```
 */
export class RealtimeBroker {
  private readonly inner: RouterBroker
  private readonly manager: RealtimeChannelManager

  constructor(config: RealtimeBrokerConfig = {}) {
    // 1. Compose RouterBroker (F3) — pattern identico a RouterBroker → MapperBroker (D-83).
    this.inner = new RouterBroker(config)

    // 2. Costruisci Manager con publishFn bound al inner (pipeline §28 step 1 ingress D-113).
    this.manager = new RealtimeChannelManager({
      publishFn: (event) =>
        this.inner.publish(event.topic, event.payload, {
          source: event.source,
          // ... altri field BrokerEvent passthrough
        } as Parameters<RouterBroker['publish']>[2]),
      // backpressure passthrough riuso F3
      ...(config.gateway?.defaults?.backpressure !== undefined && {
        backpressure: /* shared instance? o per-channel? V1 = per-channel locale */ undefined,
      }),
    })

    // 3. Bootstrap channels da config (D-102 analogo `routes` di F3).
    if (config.realtime?.channels) {
      for (const def of config.realtime.channels) {
        // Fire-and-forget connect — pattern Promise.catch difensivo come router-broker-wrapper.ts:316-320.
        this.manager.connect(def, 'system').catch(() => {
          // No-op: errore già pubblicato come system.realtime.disconnected dal manager.
        })
      }
    }
  }

  // ============================================================
  // Realtime API (D-102, PRD §16.2)
  // ============================================================

  /** Connetti un canale realtime (D-102 — registry indicizzato per name). */
  async connectRealtime(def: RealtimeChannelDef): Promise<void> {
    return this.manager.connect(def, 'system')
  }

  /** Disconnetti un canale (`name` omesso = tutti — D-102). */
  disconnectRealtime(name?: string): void {
    return this.manager.disconnect(name)
  }

  // ============================================================
  // Plugin management (override per cascade D-112)
  // ============================================================

  /**
   * Registra un plugin — delegate a RouterBroker.registerPlugin + auto-register
   * `descriptor.realtimeChannels` con `ownerId = descriptor.id` (D-103).
   *
   * Pattern try/catch isolato identico a RouterBroker.registerPlugin
   * (router-broker-wrapper.ts:437-449).
   */
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    await this.inner.registerPlugin(descriptor)
    if (descriptor.realtimeChannels) {
      for (const def of descriptor.realtimeChannels) {
        try {
          await this.manager.connect(def, descriptor.id)
        } catch {
          // pattern F3 — silent (degraded gracefully)
        }
      }
    }
  }

  /**
   * Unregister plugin — cascade D-112 (estende D-86 di F3).
   *
   * Sequenza con try/catch isolato per ogni step (pattern router-broker-wrapper.ts:463-485):
   *   1. inner.unregisterPlugin (F3 cascade routes + http abort + F2 + F1)
   *   2. manager.disconnectByOwner (chiude canali realtime registrati dal plugin)
   */
  async unregisterPlugin(id: string): Promise<void> {
    try {
      await this.inner.unregisterPlugin(id)
    } catch {
      /* pattern F3 silent */
    }
    try {
      this.manager.disconnectByOwner(id)
    } catch {
      /* pattern F3 silent */
    }
  }

  // ============================================================
  // Public API delegate (publish/subscribe/route — passthrough)
  // ============================================================

  /** Delegate a inner.publish — pattern router-broker-wrapper.ts:422-424. */
  publish(...args: Parameters<RouterBroker['publish']>): void {
    return this.inner.publish(...args)
  }

  /** Delegate a inner.subscribe — pattern router-broker-wrapper.ts:422-424. */
  subscribe(...args: Parameters<RouterBroker['subscribe']>): Subscription {
    return this.inner.subscribe(...args)
  }

  // ... altri delegate (registerRoute, unregisterRoute, registerCanonicalSchema, ...)
}
```

**Integration points:**
- `RouterBroker` import diretto da `@sembridge/routing` (workspace dep già in `packages/gateway/package.json:53`).
- Test: harness analogo a `router-harness.ts` con sezione `realtime` aggiunta.

---

### 2.12 `packages/gateway/src/sse-ws/public-factory.ts` (+ `.test.ts`)

- **Role:** Public factory + Valibot config validation
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/public-factory.ts` (intero file, 87 LOC) + `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/public-factory.ts` (lines 32-78 — looseObject pass-through preserve sezioni F4-F6)
- **Key pattern:** `createRealtimeBroker(config)` con safeParse Valibot + `Error('Invalid RealtimeBrokerConfig: ...')` su fail (D-30 no singleton).

**Excerpt — replica diretta di gateway/src/http/public-factory.ts:21-86:**

```ts
import * as v from 'valibot'
import { RealtimeBroker, type RealtimeBrokerConfig } from './realtime-broker'

// Schema RealtimeChannelDef (looseObject preserve forward-compat).
const RealtimeChannelDefSchema = v.looseObject({
  name: v.string(),
  mode: v.optional(v.union([v.literal('sse'), v.literal('websocket'), v.literal('auto')])),
  buildUrl: v.optional(v.function()),
  url: v.optional(v.string()),
  wsSubprotocols: v.optional(v.union([v.string(), v.array(v.string())])),
  reconnect: v.optional(v.unknown()),
  heartbeat: v.optional(v.unknown()),
  backpressure: v.optional(v.unknown()),
})

// Schema RealtimeConfig.
const RealtimeConfigSchema = v.looseObject({
  defaults: v.optional(v.unknown()),
  channels: v.optional(v.array(RealtimeChannelDefSchema)),
})

// Schema completo (preserve sezioni F1-F3 inherited via looseObject — pattern F3).
const RealtimeBrokerConfigSchema = v.looseObject({
  // Sezioni F3 RouterBrokerConfig (passthrough — già validate da createRouterBroker).
  runtime: v.optional(v.unknown()),
  canonicalModel: v.optional(v.unknown()),
  // ... altri F3 fields
  // Sezione F4 (D-102, D-103) — validate strutturalmente.
  realtime: v.optional(RealtimeConfigSchema),
})

/**
 * Crea una nuova istanza RealtimeBroker con la config data.
 *
 * Pattern identico a `createHttpGateway`/`createRouterBroker`: factory pure function
 * + Valibot validation al confine pubblico + Error con prefisso "Invalid ...".
 *
 * No singleton (D-30): ogni call ritorna istanza indipendente.
 *
 * @throws {Error} `Invalid RealtimeBrokerConfig: ...` se Valibot validation fallisce.
 */
export function createRealtimeBroker(config: RealtimeBrokerConfig = {}): RealtimeBroker {
  const parsed = v.safeParse(RealtimeBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid RealtimeBrokerConfig: ${messages}`)
  }
  return new RealtimeBroker(config)
}

export { RealtimeBroker }
```

**Integration points:**
- Esportato da `sse-ws/index.ts` come funzione pubblica top-level F4.
- Test pattern identico a `public-factory.test.ts` di F3 routing (5-8 test happy path + 3-5 invalid config).

---

### 2.13 `packages/gateway/src/sse-ws/index.ts`

- **Role:** Subpath barrel export
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/gateway/src/http/index.ts` (intero file, 148 LOC)
- **Key pattern:** Side-effect import augment PRIMA degli export, poi type re-exports raggruppati con JSDoc, poi runtime exports.

**Excerpt — replica struttura gateway/src/http/index.ts:1-148:**

```ts
/**
 * `@sembridge/gateway/sse-ws` — Subpath SSE/WebSocket realtime adapter.
 *
 * Phase 4 di SemBridge V1. Espone:
 * - **`RealtimeBroker`** — composition wrapper di RouterBroker (D-101)
 * - **`createRealtimeBroker`** — factory pubblica con Valibot validation
 * - **`RealtimeChannelManager`** — N-channel registry (D-102)
 * - **adapter primitives** — `SseAdapter`, `WebSocketAdapter` (per consumer avanzati)
 * - **state machines** — `createReconnectStrategy` (D-107/D-109), `createVisibilityDetector` (D-110)
 * - **utilities** — `parseFrame`, `isInternalTopic` (D-106, PITFALL §11.7)
 *
 * Bundle budget: TBD (4-6 KB gzip stimato — V1 PRD §32 budget realtime).
 *
 * Vincolo D-101: zero modifiche a F1-F3 runtime. Composition wrapper invocato dal
 * factory pubblico `createRealtimeBroker`.
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.realtime
// + PluginDescriptor.realtimeChannels (D-103). Pattern Pattern S1 anti tree-shaking.
export { __augmentSseWsLoaded, type F4PipelineStep } from './augment'

// ---------- Type re-export: types/* ----------
export type { RealtimeConfig, ReconnectDefaults, HeartbeatDefaults, VisibilityDefaults } from './types/realtime-config'
export type { RealtimeChannelDef, RealtimeMode, RealtimeReconnectConfig } from './types/realtime-channel-def'
export type { FrameEnvelope, FrameParseResult } from './types/frame-envelope'

// ---------- Runtime export: parser ----------
export { parseFrame, isInternalTopic, INTERNAL_TOPICS } from './frame-parser'

// ---------- Runtime export: state machines ----------
export { createReconnectStrategy, type ReconnectStrategy, type ReconnectStrategyOptions } from './reconnect-strategy'
export { createVisibilityDetector, type VisibilityDetector, type VisibilityDetectorOptions, type VisibilityState } from './visibility-detector'

// ---------- Runtime export: adapters (consumer avanzati) ----------
export { SseAdapter, type SseAdapterDeps } from './sse-adapter'
export { WebSocketAdapter } from './websocket-adapter'

// ---------- Runtime export: manager + broker + factory ----------
export { RealtimeChannelManager } from './realtime-channel-manager'
export { RealtimeBroker, type RealtimeBrokerConfig } from './realtime-broker'
export { createRealtimeBroker } from './public-factory'
```

**Integration points:**
- Subpath `@sembridge/gateway/sse-ws` configurato in `package.json` exports (vedi 2.21).
- Umbrella `packages/gateway/src/index.ts` ri-esporta `export * from './sse-ws'` (vedi 2.24).

---

### 2.14 `packages/gateway/src/sse-ws/test-utils/realtime-harness.ts`

- **Role:** Integration test harness factory
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/test-utils/router-harness.ts` (intero file 80+ LOC visualizzato)
- **Key pattern:** `createRealtimeHarness({ schemas?, channels?, ... })` ritorna `{ broker, mockServer, collect, expectConnected, expectReconnect, reset }` — pattern collect array + mock SSE/WS server.

**Excerpt — extension di `router-harness.ts:34-80`:**

```ts
import type { CanonicalSchema, TransformFn } from '@sembridge/mapper'
import type { GatewayConfig } from '@sembridge/gateway/http'
import type { RouteDefinition } from '@sembridge/routing'
import { vi } from 'vitest'
import { createRealtimeBroker, type RealtimeBroker } from '../public-factory'
import type { RealtimeChannelDef } from '../types/realtime-channel-def'
import { MockEventSource } from './mock-event-source'
import { MockWebSocket } from './mock-websocket'

export interface RealtimeHarnessOptions {
  // Sezioni F1-F3 ereditate (pattern router-harness.ts:49-67)
  readonly debug?: boolean
  readonly schemas?: readonly CanonicalSchema[]
  readonly transforms?: Readonly<Record<string, TransformFn>>
  readonly aliases?: Readonly<Record<string, string>>
  readonly routes?: readonly RouteDefinition[]
  readonly gateway?: GatewayConfig
  // Sezione F4 specific
  readonly channels?: readonly RealtimeChannelDef[]
  /** Topic da pre-collezionare automaticamente. Default: ['system.realtime.connected', 'system.realtime.disconnected', 'system.realtime.reconnecting']. */
  readonly collectTopics?: readonly string[]
}

export interface RealtimeHarness {
  readonly broker: RealtimeBroker
  readonly collectedEvents: Array<{ topic: string; payload: unknown }>
  /** Push frame su mock SSE per name di canale. */
  pushSseEvent(channelName: string, frame: { data: string; id?: string }): void
  /** Push frame su mock WS per name di canale. */
  pushWsFrame(channelName: string, frame: string): void
  /** Simula disconnect server-side (close event). */
  simulateDisconnect(channelName: string): void
  reset(): void
}

export function createRealtimeHarness(opts: RealtimeHarnessOptions = {}): RealtimeHarness {
  // ... implementation pattern router-harness.ts collect + reset
  // ... DI MockEventSource + MockWebSocket via createRealtimeBroker config (deps injection point)
}
```

**Integration points:**
- Usato dai 6 integration test del plan 04-08 (D-119 scenari).

---

### 2.15-2.18 `packages/gateway/src/sse-ws/test-utils/{mock-event-source,mock-websocket,sse-server,ws-server}.ts`

- **Role:** Test mock implementations
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/test-utils/msw-server.ts` (esiste — usato da `router-harness.ts:41`)
- **Key pattern:** Mock minimal con interface compatibile `EventSource`/`WebSocket` per dependency injection (RESEARCH §9.1 jsdom non supporta EventSource/WebSocket nativi).

**Pattern di base** (un solo excerpt, replica per `MockWebSocket`):

```ts
/** MockEventSource (RESEARCH §9.1 — jsdom non ha EventSource nativo). */
export class MockEventSource implements Pick<EventSource, 'addEventListener' | 'removeEventListener' | 'close' | 'readyState' | 'url'> {
  static OPEN = 1
  static CLOSED = 2

  url: string
  readyState = MockEventSource.OPEN
  withCredentials = false
  CONNECTING = 0
  OPEN = MockEventSource.OPEN
  CLOSED = MockEventSource.CLOSED

  private listeners = new Map<string, Set<EventListener>>()

  constructor(url: string | URL, _opts?: EventSourceInit) {
    this.url = url.toString()
    queueMicrotask(() => this.dispatch('open', new Event('open')))
  }

  addEventListener(type: string, fn: EventListener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }
  removeEventListener(type: string, fn: EventListener): void {
    this.listeners.get(type)?.delete(fn)
  }
  close(): void {
    this.readyState = MockEventSource.CLOSED
  }

  // Test helpers
  emit(data: string, id?: string): void {
    const ev = new MessageEvent('message', { data, lastEventId: id })
    this.dispatch('message', ev)
  }
  emitError(): void {
    this.dispatch('error', new Event('error'))
  }
  private dispatch(type: string, ev: Event): void {
    this.listeners.get(type)?.forEach((fn) => fn(ev))
  }
}
```

**Integration points:**
- Iniettato via `EventSourceCtor` / `WebSocketCtor` deps di adapter constructor (DI già presente in 2.8/2.9).

---

### 2.19 `packages/gateway/src/sse-ws/__integration__/*.test.ts` (6 file)

- **Role:** Integration test scenari D-119
- **Closest analog:** `/Users/omarmarzio/programming/prova AI/SemBridge/packages/routing/src/__integration__/route-cascade-cleanup.test.ts` (struttura test, 120 LOC visualizzati)
- **Key pattern:** `describe + beforeEach + afterEach` + `harness.reset()` + `await harness.flushAsync()` per async coordination.

**File breakdown:**

| File | Scenario D-119 |
|------|----------------|
| `sse-reconnect.test.ts` | SSE → server reboot → reconnect con Last-Event-ID → eventi mancati ricevuti |
| `ws-stale-detection.test.ts` | WS ping/pong → server smette di rispondere → stale → reconnect |
| `auto-fallback.test.ts` | SSE 3 fail → WS attivo → success → counter reset (D-107) |
| `visibility-aware.test.ts` | hidden timer throttle → visible freshness check → stale → reconnect immediato (D-110) |
| `cascade-cleanup.test.ts` | 5 plugin con channels → unregisterPlugin di 1 → solo i suoi chiusi (D-112) |
| `backpressure-storm.test.ts` | 10K eventi/sec → queue-bounded drop → critical bypass (D-115 + PITFALL §11.5) |

**Excerpt struttura — replica route-cascade-cleanup.test.ts:23-50:**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRealtimeHarness, type RealtimeHarness } from '../test-utils/realtime-harness'

describe('Cascade cleanup F4 (D-112, RT-04, F4 success criterion)', () => {
  let harness: RealtimeHarness

  beforeEach(() => {
    harness = createRealtimeHarness({ /* config */ })
  })

  afterEach(() => {
    harness.reset()
  })

  it('5 plugin con realtimeChannels → unregisterPlugin di 1 → solo i suoi canali chiusi', async () => {
    // ... setup 5 plugin (D-112 scenario)
    // ... harness.broker.unregisterPlugin('plugin-2')
    // ... expect 4 plugin still connected, 1 disconnected
  })
})
```

---

### 2.20 `packages/gateway/package.json` (UPDATE)

- **Role:** Build/dependency manifest config
- **Closest analog:** Sezione `exports."./http"` esistente (lines 16-19)
- **Key pattern:** Aggiungere subpath export `./sse-ws` parallelo a `./http`.

**Excerpt — diff incrementale al package.json esistente:**

```jsonc
{
  // ... identico fino a "exports"
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./http": {
      "types": "./dist/http/index.d.ts",
      "import": "./dist/http/index.js"
    },
    // PHASE 4 ADD:
    "./sse-ws": {
      "types": "./dist/sse-ws/index.d.ts",
      "import": "./dist/sse-ws/index.js"
    },
    "./package.json": "./package.json"
  },
  "sideEffects": [
    "./dist/augment.js",
    "./src/augment.ts",
    // PHASE 4: il glob `**/augment.ts` già copre `dist/sse-ws/augment.js` se prodotto
    // come entry separata da tsup (vedi tsup.config.ts:16). Mantenere il glob.
    "**/augment.js",
    "**/augment.ts"
  ]
  // ... resto identico (dependencies, devDependencies)
}
```

**Integration points:**
- `exports."./sse-ws"` consumed da consumer `import { createRealtimeBroker } from '@sembridge/gateway/sse-ws'`.
- `sideEffects` glob `**/augment.ts` già attivo — niente modifica.

---

### 2.21 `packages/gateway/tsup.config.ts` (UPDATE)

- **Role:** Build config
- **Closest analog:** Sezione `entry` esistente (lines 16-20) — il file ha GIÀ il commento "Phase 4 aggiungerà..."
- **Key pattern:** Aggiungere entry `'sse-ws/index': 'src/sse-ws/index.ts'` + opzionale `'sse-ws/augment': 'src/sse-ws/augment.ts'`.

**Excerpt — diff:**

```ts
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'http/index': 'src/http/index.ts',
    augment: 'src/augment.ts',
    // PHASE 4 ADD:
    'sse-ws/index': 'src/sse-ws/index.ts',
    'sse-ws/augment': 'src/sse-ws/augment.ts', // emette dist/sse-ws/augment.js per anti tree-shaking
  },
  // ... resto identico (target: 'es2022', platform: 'browser', external, banner)
})
```

---

### 2.22 `packages/gateway/vitest.config.ts` (NO-OP / minor update)

- **Role:** Test config
- **Closest analog:** corrente
- **Key pattern:** Probabilmente nessun cambio necessario — `include: ['src/**/*.test.ts']` matcha già `src/sse-ws/**`. Aggiornare `coverage.exclude` per includere `src/sse-ws/index.ts`, `src/sse-ws/types/**`, `src/sse-ws/augment.ts` (analogo a `src/http/index.ts`, `src/http/types/**`).

**Excerpt — diff minimale:**

```ts
coverage: {
  // ...
  exclude: [
    'src/**/*.test.ts',
    'src/index.ts',
    'src/http/index.ts',
    'src/http/types/**',
    'src/augment.ts',
    // PHASE 4 ADD:
    'src/sse-ws/index.ts',
    'src/sse-ws/types/**',
    'src/sse-ws/augment.ts',
    'src/sse-ws/test-utils/**', // non production code
  ],
  thresholds: {
    // D-92 di F3 + D-117 di F4: ≥90% sui file `@sembridge/gateway/src/sse-ws/`.
    // V1 calibration: probabilmente serve abbassare branches a 80% (defensive try/catch
    // in lifecycle adapter — pattern lesson learned F2/F3 budget calibration).
    statements: 85,
    branches: 75,
    functions: 88,
    lines: 87,
  },
},
```

**Note:** RESEARCH §9.3 raccomanda anche un secondo vitest config per browser-real (`@vitest/browser` + Playwright) per i test SSE/WS reali. F4 può aggiungere `vitest.browser.config.ts` separato (opt-in CI).

---

### 2.23 `packages/gateway/src/index.ts` (UPDATE)

- **Role:** Umbrella barrel
- **Closest analog:** corrente (già `export * from './http'` line 42)
- **Key pattern:** Aggiungere `export * from './sse-ws'` parallelo + side-effect import del nuovo augment.

**Excerpt — diff:**

```ts
// Side-effect import — abilita TS declaration merging per BrokerConfig.gateway.
export { __augmentGatewayLoaded } from './augment'

// PHASE 4 ADD: side-effect augment SSE/WS (D-103 BrokerConfig.realtime + PluginDescriptor.realtimeChannels)
export { __augmentSseWsLoaded } from './sse-ws/augment'

// Re-export sub-modulo HTTP per consumer che importano dall'umbrella.
export * from './http'

// PHASE 4 ADD: re-export sub-modulo SSE/WS dall'umbrella.
export * from './sse-ws'
```

---

## 3. Cross-cutting patterns

### 3.1 Composition wrapper chain (D-101)

**Pattern:** F4 estende la catena `Broker (F1) → MapperBroker (F2) → RouterBroker (F3) → RealtimeBroker (F4)`. Ogni livello compone (NON estende via subclass) il livello inferiore.

**Riferimento canonico:** `packages/routing/src/router-broker-wrapper.ts:127-226` (constructor che istanzia `inner = new MapperBroker(...)` + bootstrap routes).

**Da replicare in 04-08:** `RealtimeBroker.constructor` istanzia `inner = new RouterBroker(config)` + bootstrap channels da `config.realtime.channels`.

**Anti-pattern:** NON modificare `RouterBroker`/`MapperBroker`/`Broker` (vincolo D-83 ext F4 / D-101).

---

### 3.2 Side-effect import + Pattern S1 (anti tree-shaking)

**Pattern:** `augment.ts` ri-esportato dal barrel come `export { __augmentXxxLoaded } from './augment'` PRIMA degli altri export. Combinato con `package.json:sideEffects: ["**/augment.ts", "**/augment.js"]`.

**Riferimento canonico:**
- `packages/gateway/src/augment.ts:92` (`export const __augmentGatewayLoaded: true = true`)
- `packages/gateway/src/index.ts:37` (`export { __augmentGatewayLoaded } from './augment'`)
- `packages/routing/src/augment.ts:171` (stesso pattern con `__augmentLoaded`)

**Da replicare in 04-01:** `__augmentSseWsLoaded` in `packages/gateway/src/sse-ws/augment.ts` + ri-export in `packages/gateway/src/sse-ws/index.ts` E in `packages/gateway/src/index.ts`.

---

### 3.3 AbortController cascade lifecycle

**Pattern:** Ogni adapter/manager owns un `AbortController` proprio + accetta `externalSignal?` da caller. Cleanup garantito via `try { ... } finally { this.controller.abort() ; this.inFlight.delete(...) }`.

**Riferimento canonico:**
- `packages/gateway/src/http/http-gateway.ts:160-171` (setup ownController + register inFlight Map)
- `packages/gateway/src/http/http-gateway.ts:263-265` (`finally { this.inFlight.delete(event.id) }`)
- `packages/gateway/src/http/http-gateway.ts:289-298` (`abortInFlightByOwner`)
- `packages/gateway/src/http/combine-signals.ts:51-86` (compose N signal con cleanup garantito Pattern S1)

**Da replicare in 04-05/04-06/04-07:**
- `SseAdapter.connect(externalSignal?)` → `externalSignal?.addEventListener('abort', () => this.disconnect(), { once: true })`.
- `RealtimeChannelManager.disconnectByOwner(ownerId)` mirror di `HttpGateway.abortInFlightByOwner`.

**Anti-pattern (PITFALL §11.6):** NON usare `setTimeout` long-lived — Safari iOS background freeze produce timer non scattanti (RESEARCH §5.5).

---

### 3.4 BackpressureStrategy reuse (D-115)

**Pattern:** Riuso 1:1 di `BackpressureStrategy` di `@sembridge/gateway/http`. F4 applica al `'message'` event handler degli adapter PRIMA di `broker.publish`.

**Riferimento canonico:**
- `packages/gateway/src/http/strategies/backpressure-strategy.ts:121-323` (factory + 6 policy types + critical bypass)
- `packages/gateway/src/http/types/http-strategies.ts` (interface `BackpressureStrategy`)

**Da replicare in 04-05/04-06:** import `BackpressureStrategy` interface, invocare `strategy.schedule(channelName, priority, () => Promise.resolve(publishFn(event)))` nel handler.

**Critical bypass invariato (PITFALL #4):** eventi con `priority: 'critical'` saltano la backpressure (`backpressure-strategy.ts:131-133`).

---

### 3.5 Mapper canonicalization riuso (D-114)

**Pattern:** Topic `<entity>.<action>.<status>` (PRD §11) → schemaId = primo segmento. `mapper.mapToCanonical(rawData, schemaId)` invocato dalla pipeline §28 step 4 — già implementato dal `MapperBroker` inner. F4 NON deve fare nulla di nuovo: pubblica via `broker.publish(topic, payload, ...)` e la pipeline applica step 4-6 automaticamente.

**Riferimento canonico:**
- `packages/routing/src/router-broker-wrapper.ts:555-584` (`getCanonicalSchemaForTopic` — D-100 cast tipato + PRD §11 convention)
- `packages/mapper/src/broker-mapper-wrapper.ts` (intero — F2 publish applica outputMap + canonical validation)

**Da replicare in 04-05/04-06:** **niente di nuovo**. Adapter publish → inner.publish → pipeline F2/F3 applica step 4-6.

**Topic non corrispondenti a schema:** publish comunque con payload raw (D-114 = pattern F3 default `requiresRoute: false` D-67).

---

### 3.6 TDD RED→GREEN co-located test pattern (D-117)

**Pattern:** Ogni `*.ts` ha `*.test.ts` co-locato. Test deterministici tier-1 jsdom con `vi.useFakeTimers()` per timing-dependent logic.

**Riferimento canonico:**
- `packages/gateway/src/http/strategies/circuit-breaker.test.ts:1-80` (struttura describe + beforeEach `vi.useFakeTimers()` + Test 1..N numerati)
- `packages/gateway/src/http/retry-after-parser.ts` (parser puro deterministico — Test pattern senza timer)

**Da replicare in TUTTI i 04-02..04-08 plan:** ogni file production ha file test sibling con prefix identico.

---

### 3.7 Public factory + Valibot validation (D-30)

**Pattern:** Factory pure function al confine pubblico, validation via Valibot `safeParse` + `looseObject` per forward-compat. Su fail: `Error('Invalid <Name>Config: <messages>')`.

**Riferimento canonico:**
- `packages/gateway/src/http/public-factory.ts:79-86` (createHttpGateway happy path)
- `packages/routing/src/public-factory.ts:122-129` (createRouterBroker — pattern identico)

**Da replicare in 04-08 (`public-factory.ts`):** `createRealtimeBroker(config)` con stessa struttura.

---

## 4. Integration matrix

### 4.1 Module dependency graph (interno F4)

```
sse-ws/index.ts (barrel)
  ├── ./augment (side-effect)
  ├── ./types/* (re-export)
  ├── ./frame-parser
  ├── ./reconnect-strategy
  ├── ./visibility-detector
  ├── ./sse-adapter      (deps: frame-parser?, reconnect-strategy)
  ├── ./websocket-adapter (deps: frame-parser, reconnect-strategy)
  ├── ./realtime-channel-manager (deps: sse-adapter, websocket-adapter, visibility-detector)
  ├── ./realtime-broker        (deps: realtime-channel-manager, @sembridge/routing RouterBroker)
  └── ./public-factory          (deps: realtime-broker, valibot)
```

### 4.2 Cross-package dependencies (workspace)

| New module | Imports from | Notes |
|------------|--------------|-------|
| `sse-ws/augment.ts` | `@sembridge/core` (BrokerConfig, PluginDescriptor) | declaration merging targets |
| `sse-ws/types/realtime-channel-def.ts` | `@sembridge/routing` (BackpressurePolicyConfig) | riuso F3 D-115 |
| `sse-ws/sse-adapter.ts` | `@sembridge/core` (BrokerError, BrokerEvent), `nanoid`, `@sembridge/gateway/http` (BackpressureStrategy interface) | publish via DI publishFn |
| `sse-ws/realtime-broker.ts` | `@sembridge/routing` (RouterBroker, RouterBrokerConfig), `@sembridge/core` (PluginDescriptor, Subscription) | composition di RouterBroker |
| `sse-ws/public-factory.ts` | `valibot`, `./realtime-broker` | identico pattern F3 |

### 4.3 Where new modules are exported

| New module | Exported via |
|------------|--------------|
| `RealtimeBroker` class | `@sembridge/gateway/sse-ws` (subpath) + `@sembridge/gateway` (umbrella) |
| `createRealtimeBroker` factory | `@sembridge/gateway/sse-ws` (primary import path consigliato) |
| `RealtimeChannelDef`, `RealtimeConfig` | `@sembridge/gateway/sse-ws` |
| `parseFrame`, `isInternalTopic` | `@sembridge/gateway/sse-ws` (utility per consumer avanzati) |
| `createReconnectStrategy`, `createVisibilityDetector` | `@sembridge/gateway/sse-ws` (state machine primitives) |
| `SseAdapter`, `WebSocketAdapter` | `@sembridge/gateway/sse-ws` (consumer avanzati: test, custom integration) |
| `__augmentSseWsLoaded`, `F4PipelineStep` | `@sembridge/gateway/sse-ws` (anti tree-shaking + tap step type) |

### 4.4 PluginDescriptor.realtimeChannels integration (D-103)

```
Consumer code:
  broker.registerPlugin({
    id: 'orders-plugin',
    realtimeChannels: [{ name: 'orders.stream', mode: 'auto', buildUrl: ... }]
  })

  ↓ RealtimeBroker.registerPlugin (override)
  ↓ inner.registerPlugin (RouterBroker → MapperBroker → Broker — F1/F2/F3 cascade)
  ↓ for (def of descriptor.realtimeChannels) manager.connect(def, descriptor.id)
  ↓ Manager.connect → AdapterFactory(def.mode) → SseAdapter | WebSocketAdapter
  ↓ adapter.connect → EventSource | WebSocket → onMessage → backpressure.schedule → publishFn
  ↓ broker.publish(event.topic, event.payload) → pipeline §28 step 1-13

Cleanup:
  broker.unregisterPlugin('orders-plugin')
  ↓ inner.unregisterPlugin (F3 cascade routes + http abort + F2 cascade + F1 unsub)
  ↓ manager.disconnectByOwner('orders-plugin')
  ↓ for entry of channels: entry.adapter.disconnect() + entry.controller.abort()
  ↓ teardownVisibility() if last channel
```

---

## 5. Anti-patterns to avoid

Sintesi da PITFALLS RESEARCH §11 + lesson learned F2/F3:

| # | Anti-pattern | Why bad | Correct pattern |
|---|--------------|---------|-----------------|
| AP-1 | Modificare `core/types/plugin.ts` per aggiungere `realtimeChannels?` direttamente | Viola D-83/D-101 (zero modifiche F1/F2/F3 runtime) | Usare TS declaration merging in `sse-ws/augment.ts` (vedi §2.1). Il commento `F4 will add: realtimeChannels` in `plugin.ts:50` è placeholder, NON un reminder di edit |
| AP-2 | Polyfill EventSource per supportare custom headers Auth | Vincolo PRD §31.3 + D-105 | Usare `buildUrl()` async che ritorna URL con token query string (PITFALL §11.2) |
| AP-3 | Usare `reconnecting-websocket` library | Vincolo PRD §31.3 + STACK.md | Implementare reconnect custom con `createReconnectStrategy` (state machine isolata) |
| AP-4 | Trustare `WebSocket.readyState === OPEN` come liveness check | TCP zombie possibile (RESEARCH §4.6) | Ping/pong app-level via envelope `__ping__/__pong__` (D-111) |
| AP-5 | Usare `setInterval` long-lived senza Visibility API check | Mobile freeze background → timer non scattano (PITFALL §11.6) | Visibility API (D-110) + freshness check on-visible |
| AP-6 | Pattern wildcard `__.*` per filtrare ping/pong | Collide con topic legittimo `weather.__ping__` (PITFALL §11.7) | Match strict `topic === '__ping__'` (vedi `isInternalTopic` §2.5) |
| AP-7 | Re-read del corpo response Stream già consumed | TypeError redirect handling (vedi WR-07 fix in http-gateway.ts:333-344) | Per F4 non applica direttamente — adapter consumano `MessageEvent.data` (string, già consumed da browser) |
| AP-8 | Usare `cat << 'EOF'` per creare PATTERNS.md o altri file | Violazione policy CLAUDE.md | Usare Write tool sempre |
| AP-9 | Re-aggiungere il Tap retroattivamente in F6 | Retrofit invasivo di tutti i filtri (CLAUDE.md vincolo critico) | EventTap già pre-instrumentato in F1 — F4 estende solo `F4PipelineStep` literal union (vedi §2.1) |
| AP-10 | Ignore degli errori di parse frame (silent drop) | DOC-04 / RT-06 transparency | Publish `network.error` con `category: 'protocol'` + raw frame in details (D-106) |
| AP-11 | Singleton globale per `EventSource`/`WebSocket` (multiplex automatic) | Decisione D-102 esplicita: ogni canale ha sua connessione | Map `<name, ChannelEntry>` per-canale (deferred multiplexing a V1.x) |
| AP-12 | Modificare F3 `RouterBroker.publish` per intercettare eventi realtime | Viola D-101 composition | F4 invoca `inner.publish` come qualsiasi altro publisher (D-113 step 1 ingress) |

---

## 6. Plan ↔ Pattern cross-reference

| Plan | Files | Patterns referenziati |
|------|-------|----------------------|
| 04-01 | augment.ts, types/*, package.json, tsup.config.ts, vitest.config.ts, index.ts | §2.1, §2.2, §2.3, §2.4, §2.13, §2.20, §2.21, §2.22, §2.23, §3.2 |
| 04-02 | frame-parser.ts (+ test) | §2.5, §3.6 |
| 04-03 | reconnect-strategy.ts (+ test) | §2.6, §3.6 |
| 04-04 | visibility-detector.ts (+ test) | §2.7, §3.6 |
| 04-05 | sse-adapter.ts, mock-event-source.ts, sse-server.ts (+ test) | §2.8, §2.15, §2.17, §3.3, §3.4, §3.5, §3.6 |
| 04-06 | websocket-adapter.ts, mock-websocket.ts, ws-server.ts (+ test) | §2.9, §2.16, §2.18, §3.3, §3.4, §3.5, §3.6 |
| 04-07 | realtime-channel-manager.ts (+ test) | §2.10, §3.3, §3.6 |
| 04-08 | realtime-broker.ts, public-factory.ts, realtime-harness.ts, __integration__/* | §2.11, §2.12, §2.14, §2.19, §3.1, §3.7 |
| 04-09 | README, JSDoc, ROADMAP/STATE/REQUIREMENTS update | §3.6 (test gate), 5 (anti-patterns audit) |

---

## 7. Coverage verification (pre-planning gate)

Pre-condition per il planner: tutti i 22 file F4 hanno almeno UN analogo concreto (file path + line range) da copiare/adattare. Nessun "no analog found" residuo.

| Categoria | Coverage |
|-----------|----------|
| Composition wrapper | exact (router-broker-wrapper.ts) |
| Augment declaration merging | exact (gateway/augment.ts + routing/augment.ts) |
| State machine factory | exact (circuit-breaker.ts + retry-strategy.ts) |
| Pure parser utility | exact (retry-after-parser.ts) |
| Public factory + Valibot | exact (http/public-factory.ts + routing/public-factory.ts) |
| AbortController cascade | exact (http-gateway.ts) |
| BackpressureStrategy reuse | exact (backpressure-strategy.ts — riusato 1:1) |
| Network adapter (lifecycle) | role-match (http-gateway.ts) |
| N-channel manager registry | role-match (route-resolver.ts + http-gateway abortByOwner) |
| Visibility API integration | role-match (combine-signals.ts cleanup pattern) |
| Test harness factory | exact (router-harness.ts) |
| Mock primitives (test) | new (no analog — minimal classi DI, role-match con msw-server.ts setup) |
| Subpath export config | exact (gateway package.json + tsup config) |
| Integration test scenari | exact (route-cascade-cleanup.test.ts) |

**Tutto chiarito.** Il planner può procedere a generare i 9 PLAN.md di F4 con riferimenti cross-tabulati ai pattern §2/§3 di questo documento.

---

## PATTERN MAPPING COMPLETE
