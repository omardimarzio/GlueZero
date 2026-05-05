# Phase 4: Realtime inbound (SSE prioritario, WS opzionale) - Context

**Gathered:** 2026-05-04
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Esiste almeno un canale realtime inbound dal server attivabile via `connectRealtime()`/`disconnectRealtime()`; SSE è l'adapter prioritario V1 (PRD §18.3-18.4), WebSocket è disponibile come adapter alternativo e fallback automatico per SSE; i messaggi server vengono normalizzati in `BrokerEvent` canonici con `source: { type: 'server', id: 'realtime-channel', name: 'sse' | 'websocket' }`; la reconnection policy gestisce backoff con jitter, heartbeat applicativo, stale detection e visibility-aware behavior.

**In scope:**
- Adapter SSE (`@gluezero/gateway/sse-ws`) con `EventSource` nativo
- Adapter WebSocket con ping/pong applicativo + stale detection
- `RealtimeChannelManager` con N canali per `name` (multi-channel topology)
- `connectRealtime(config) / disconnectRealtime(name?)` API pubbliche
- Reconnection policy: exponential backoff full-jitter cap 30s, Last-Event-ID per SSE, heartbeat ping/pong per WS, Visibility API integration
- Auto-fallback SSE → WebSocket attivo di default (V1)
- Auth-agnostic via `buildUrl?: () => Promise<string>` hook custom per ogni canale
- Envelope JSON `{topic, data, id?}` come default frame format per WebSocket
- Eventi standard `system.realtime.disconnected/reconnecting/connected`
- PluginDescriptor extension `realtimeChannels?: RealtimeChannelDef[]` via declaration merging (pattern F2/F3)
- Cascade cleanup su `unregisterPlugin` per realtime channel + adapter (D-86 ext F4)
- Mapper server→canonical riusato (D-97 di F3)
- Pipeline §28 step 1 ingress per messaggi realtime
- Test TDD RED→GREEN (D-88) + coverage v8 ≥90% (D-92)

**Out of scope (deferred):**
- Service Worker / Push notification bridge (PRD §18.7, RT2-01 V2)
- WebSocket gap recovery con sequence number app-level (V1 = best effort, replay solo via Last-Event-ID per SSE)
- Custom binary frame parser per WS (V1 = solo testo JSON envelope)
- Realtime outbound publish (V1 = solo inbound, PRD §18 server → browser only)
- Multiplexing automatico per URL identico (decisione: ogni canale ha la propria connessione)

</domain>

<decisions>
## Implementation Decisions

### A. Architettura adapter & topology

- **D-101:** **Composition wrapper pattern (estensione D-83 di F3)** — F4 introduce `RealtimeBroker` che compone `RouterBroker` di F3 (composition wrapper, NON modifiche runtime a F1/F2/F3). Il `RealtimeBroker` gestisce un `RealtimeChannelManager` interno indicizzato per `name`. Pattern declaration merging via `@gluezero/gateway/src/sse-ws/augment.ts` analogo a `augment.ts` di routing/gateway-http (F3 D-93). Il package `@gluezero/gateway` aggiunge subpath export `./sse-ws` (già anticipato in `packages/gateway/src/index.ts`).

- **D-102:** **Multi-channel topology con `RealtimeChannelManager`** — `connectRealtime({ name, mode, url, ... })` accetta `name: string` come chiave indice. Il Manager mantiene `Map<name, RealtimeChannel>`. Ogni canale ha proprio reconnect state, proprio adapter (SSE o WS), proprio `buildUrl()` hook. `disconnectRealtime(name?)` chiude singolo canale o tutti se `name` omesso. Coerente con il pattern multi-policy di `gateway.allowlist` (F3 D-71).

- **D-103:** **`PluginDescriptor.realtimeChannels?: RealtimeChannelDef[]`** — estensione via declaration merging in `@gluezero/gateway/src/sse-ws/augment.ts` (pattern F2 D-57, F3 D-94). I canali dichiarati a livello plugin sono auto-registrati al `registerPlugin` con `ownerId = pluginId` per cascade D-26 ext F4. API top-level `connectRealtime` registra canali con `ownerId = 'system'`.

### B. Auth strategy — auth-agnostic hook

- **D-104:** **`RealtimeChannelDef.buildUrl?: () => Promise<string>` hook custom** — il consumer fornisce una funzione async chiamata prima di OGNI connect/reconnect. Il return value è l'URL completo (incluso eventuale token in query string, scheme, path). Questo permette: cookie auth (URL fisso), token in query (URL costruito on-demand), refresh token (chiamata async a `gateway.auth.getToken/refresh` di F3 D-72), custom protocols. **Default fallback** se `buildUrl` non fornito: `url` statico passato in config. **Scheme switch automatico** per fallback SSE→WS (`http://` → `ws://`, `https://` → `wss://`, vedi D-107).

- **D-105:** **NO header custom in V1** — `EventSource` standard non supporta headers (vincolo PRD §31.3 vieta polyfill). Quindi l'auth deve passare per cookie HttpOnly (default browser, same-origin o CORS+credentials) o per query string costruita via `buildUrl`. Documentato esplicitamente in DOC-04 (sezione Realtime Auth Patterns).

### C. WebSocket frame format — envelope JSON

- **D-106:** **Default envelope JSON `{ topic, data, id? }`** — il server WebSocket invia frames JSON con shape `{ topic: string; data: unknown; id?: string }`. L'adapter WS parse il frame, estrae `topic` come `BrokerEvent.topic`, `data` come `payload` raw (poi normalizzato dal mapper canonical step 4 §28), `id` come `BrokerEvent.id` opzionale (se assente, generato via nanoid). Frame non-conformi (parse fail o missing `topic`) → publish `network.error` con `category: 'protocol'` + descarta. Documentato in DOC-04 + esempio server-side. **NO custom parser in V1**: `parseFrame` opt-in deferred a V1.x.

### D. Auto-fallback SSE → WebSocket

- **D-107:** **Auto-fallback default abilitato V1** — `RealtimeChannelDef.mode` accetta `'sse' | 'websocket' | 'auto'`. Default `mode: 'auto'` significa: prova prima SSE, su 3 reconnect failures consecutivi switcha automaticamente a WebSocket riusando lo stesso `buildUrl()` (con scheme switch http→ws / https→wss). Counter reset al primo successo. Se WS fallisce a sua volta (3 reconnect failures), torna a SSE. **Cap globale**: dopo 5 cicli SSE↔WS senza successo, publish `system.realtime.failed` permanente + stop reconnect (operatore deve riconnettere manualmente). Mode esplicito (`'sse'` o `'websocket'`) disabilita il fallback.

- **D-108:** **Caveat documentati** — il fallback assume che il server espone lo stesso endpoint logico per entrambi i protocolli (es. `/events` SSE + `/events` WS). Mismatch CORS, auth-handshake o path → fallback fallisce silenziosamente fino al cap. Best practice in DOC-04: usare `mode: 'sse'` esplicito se il server supporta solo SSE, `mode: 'websocket'` se solo WS.

### E. Reconnection & lifecycle

- **D-109:** **Reconnect policy unificata SSE/WS** — exponential backoff full-jitter `delay = random(0, min(30_000, base * 2^attempt))` con `base = 1_000ms`, cap a 30s (PRD §18.6). `maxAttempts?` opzionale (default `Infinity` per persistenza). `Last-Event-ID` header inviato solo per SSE su reconnect (lib invia automaticamente da `EventSource`); per WS, `id` dell'ultimo envelope ricevuto NON è propagato al server in V1 (best effort, gap recovery deferred). Ogni transition di stato pubblica eventi standard ERR-02 ext: `system.realtime.disconnected` (su loss), `system.realtime.reconnecting` (durante backoff), `system.realtime.connected` (su success).

- **D-110:** **Visibility API integration** — al `visibilitychange → hidden`: il timer heartbeat WS continua ma con tolleranza estesa (×3 stale timeout) per non spammare reconnect quando il browser throttle i timer. Al `visibilitychange → visible`: forza un check di freschezza immediato (per WS = invia ping atteso pong; per SSE = controlla last-event-received timestamp); se stale → disconnect + reconnect immediato senza backoff. Implementato in `RealtimeChannelManager` con `addEventListener('visibilitychange')` registrato al primo `connectRealtime` e cleaned-up al `disconnectRealtime` di tutti i canali.

- **D-111:** **Stale detection WS** — ping/pong applicativo via envelope JSON: il client invia `{ topic: '__ping__', data: { ts } }` ogni `heartbeatIntervalMs` (default 30s); il server risponde con `{ topic: '__pong__', data: { ts: <echo> } }`. Se non riceve pong entro `staleTimeoutMs` (default 60s), considera la connessione morta e riconnette. **Topics `__ping__`/`__pong__` sono filtrati**: non vengono pubblicati come `BrokerEvent` (consumed internamente dall'adapter). Documentato in DOC-04 con server contract.

- **D-112:** **Cascade cleanup F4 (estensione D-86)** — `unregisterPlugin(pluginId)` chiude tutti i `realtimeChannels` registrati dal plugin: abort delle reconnect pendenti via `AbortController` (riuso pattern D-76), close di `EventSource`/`WebSocket`, rimozione visibility listener se ultimo canale, publish `system.realtime.disconnected` per ogni canale chiuso. Coerente con cleanup route F3.

### F. Pipeline §28 e mapping

- **D-113:** **Messaggi realtime entrano alla pipeline §28 step 1** — il `RealtimeChannel` invoca `broker.publish(event)` come fossero pubblicazioni esterne. Il `BrokerEvent` ha `source: { type: 'server', id: 'realtime-channel', name: 'sse' | 'websocket' }` (PRD §18.5). Gli step §28 successivi (4 canonical normalization, 5 canonical validation, 6 post-mapping validation) si applicano normalmente. NO bypass, NO short-circuit. Coerente con D-78/D-97 di F3.

- **D-114:** **Mapper server→canonical riusato da F3** — il payload `data` dell'envelope (o `event.data` di SSE) viene normalizzato via `mapper.mapToCanonical(rawData, canonicalSchemaId)`. La risoluzione `topic → canonicalSchemaId` segue la convenzione PRD §11 (primo segmento = entity = schemaId), come F3 D-100. Per topic non corrispondenti a uno schema canonical: l'evento viene comunque pubblicato con `payload` raw (no validation forzata) — equivalente a F3 default `requiresRoute: false` (D-67).

### G. Backpressure & validation

- **D-115:** **BackpressureStrategy riusata da F3 D-75** — i canali realtime accettano `RealtimeChannelDef.backpressure?: BackpressureStrategy` (stesso union: `'queue-bounded' | 'drop' | 'throttle' | 'debounce' | 'latest-only' | 'merge'`). Topic con storm rate sono rate-limited a livello adapter (prima di `broker.publish`). Eventi con `priority: 'critical'` (definito sul canonical schema F2) bypassano backpressure (PITFALLS #4 chiusura, identico a F3 D-75). Default: `'queue-bounded'` con `maxSize: 1000`.

- **D-116:** **Validation post-mapping invariata** — VAL-04 (post-mapping) e VAL-03 (canonical) di F2 si applicano automaticamente al payload normalizzato in step §28 5/6. NO logica di validazione nuova in F4. Su validation fail: `<topic>.failed` viene pubblicato con `code: 'response.validation.failed'` (riuso F3 D-78), e l'evento originale NON viene consegnato ai subscriber locali (coerente con `onFailure: 'block'` default di F2 D-44).

### H. Test strategy F4

- **D-117:** **Pattern TDD RED→GREEN** (analogo D-88 F3) — ogni modulo (`sse-adapter.ts`, `websocket-adapter.ts`, `realtime-channel-manager.ts`, `reconnect-strategy.ts`, `visibility-detector.ts`, `frame-parser.ts`, `realtime-broker.ts`) ha unit test co-locato. Plan paralleli con file ownership disgiunta (analogo F3 wave-based). Coverage v8 ≥ 90% sui file `@gluezero/gateway/src/sse-ws/` (riuso D-92 F3 setup).

- **D-118:** **Tre livelli di test** — STACK.md specifica:
  - **Node + Vitest jsdom**: unit logic (frame parser, reconnect math, visibility state machine)
  - **MSW 2.x**: mock SSE endpoint per integration test (`new EventSource('http://msw/events')` con `mock.sse(...)`)
  - **`@vitest/browser` + Playwright**: browser reale per `EventSource`/`WebSocket` reali (TEST-02 reconnect realtime, TEST-03 riconnessione ripetuta)

- **D-119:** **Test scenari obbligatori (TEST-01/TEST-02/TEST-03 subset F4):**
  - SSE connect → ricevuti N eventi → server reboot simulato → reconnect con Last-Event-ID → ricevuti M eventi mancati
  - WS connect → ping/pong applicativo → server smette di rispondere a pong → stale detection → reconnect
  - Auto-fallback: SSE 3 fail consecutivi → WS attivo → success → counter reset
  - Visibility hidden → timer throttle riconosciuto → visible → freshness check → stale detected → reconnect immediato
  - Cascade cleanup: 5 plugin con realtimeChannels → unregisterPlugin di 1 → solo i suoi canali chiusi
  - Backpressure storm: 10K eventi/sec → `queue-bounded` drop strategy applicata → `priority: 'critical'` passa sempre

### I. Final gate F4

- **D-120:** **Final gate F4 simile a 01-11 / 02-12 / 03-14** — un plan dedicato chiude la fase con: lint, typecheck, build, test, coverage ≥90%, REQ matrix verifica, smoke-test cross-package (RealtimeBroker + RouterBroker + MapperBroker compongono), DOC-04 esteso con sezione Realtime + auth patterns + frame envelope + reconnect contract. Update REQUIREMENTS.md flippa RT-01..RT-07 → Complete.

### Claude's Discretion

- Naming interno dei file (`sse-adapter.ts` vs `sse.ts` ecc.) lasciato al planner — convenzione coerente con F3 (`http-gateway.ts`, `retry-strategy.ts`, ecc.)
- Threshold default di reconnect (`base: 1000ms`, `cap: 30_000ms`, `heartbeat: 30s`, `staleTimeout: 60s`, `fallbackThreshold: 3`, `globalCycleCap: 5`): lockati come default ragionevoli; tutti override-abili via config (RT-05). Researcher può proporre tweak basati su benchmark.
- Internal topics `__ping__` / `__pong__` filtrati (D-111): se collisione con topic utente reale, il planner può proporre namespace alternativo (es. `$$realtime.ping`) — attualmente inscaped tramite `__` prefix.
- Errori frame parsing: scelta tra `network.error` vs nuovo `realtime.protocol.error` lasciata al planner (preferenza per riuso `network.error` esistente, salvo evidenze contrarie).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRD (fonte autoritativa)
- `prd.md` §11.1 — `correlationId` first-class del BrokerEvent (per envelope `id` field di D-106)
- `prd.md` §16.2 — API pubblica `connectRealtime`/`disconnectRealtime` (D-102)
- `prd.md` §17.5 — Route `realtime-inbound` policy (per integrazione PluginDescriptor D-103)
- `prd.md` §18.1-18.7 — Gateway server requisito centrale + Realtime contract (D-104, D-106, D-107, D-109)
- `prd.md` §21.2.4 — Validazione post-mapping (D-116)
- `prd.md` §22.3 — Eventi standard di errore inclusi `network.error` (D-106)
- `prd.md` §23.5 — Backpressure policy (D-115)
- `prd.md` §24.2 — Lifecycle anti-leak (D-112 cascade cleanup)
- `prd.md` §28 — Pipeline 14 step (D-113 ingress step 1)
- `prd.md` §31.3 — Vincolo no-polyfill (D-105 no header custom)
- `prd.md` §35.1-35.3 — Test unit/integration/robustness (D-117, D-118, D-119)
- `prd.md` §39 #9 — Open issue Last-Event-ID + ping app-level (D-109, D-111 → RT-07 closure)
- `prd.md` §42 — Checklist finale (success criteria fase)

### Roadmap & requirements
- `.planning/ROADMAP.md` — Phase 4 success criteria 1-5 (definitive lock per goal)
- `.planning/REQUIREMENTS.md` — RT-01..RT-07 (sezione Realtime Inbound Fase 4) + ERR-02 ext + TEST-01/02/03 subset

### Decisioni fasi precedenti (riusate)
- `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md`:
  - **D-83** — Composition wrapper pattern (esteso a F4 → D-101)
  - **D-86** — Cascade cleanup `unregisterPlugin` (esteso a realtimeChannels → D-112)
  - **D-93/D-94** — Type augmentation pattern declaration merging (riusato → D-103)
  - **D-72** — `gateway.auth.getToken/refresh` (integrazione opzionale via `buildUrl` → D-104)
  - **D-75** — `BackpressureStrategy` (riusata → D-115)
  - **D-78/D-97** — Mapper server→canonical + validation post-mapping (riusato → D-114, D-116)
  - **D-88** — TDD RED→GREEN pattern (riusato → D-117)
  - **D-92** — Coverage v8 ≥ 90% (riusato → D-117)
  - **D-100** — Topic→schemaId convenzione PRD §11 (riusato → D-114)
- `.planning/phases/02-canonical-model-mapper/02-CONTEXT.md`:
  - **D-44** — `onFailure: 'block' | 'skip' | 'fallback'` (riusato per validation fail → D-116)
  - **D-49** — Composition wrapper Mapper (precedente di D-83/D-101)
- `.planning/phases/01-core-essenziale/01-CONTEXT.md`:
  - **D-26** — Cascade cleanup base (esteso → D-112)
  - **D-27** — Subscription handle (no impatto diretto)

### Stack & research già consolidati
- `.planning/research/STACK.md` — `EventSource` + `WebSocket` nativi, no polyfill, MSW 2.x per mocking, `@vitest/browser` + Playwright per browser reale
- `.planning/research/ARCHITECTURE.md` §3 — EventTap pre-instrumentation (F4 estende §28 step 1 ingress, già coperto da F1 skeleton)
- `.planning/research/PITFALLS.md` #4 — Critical priority bypass backpressure (D-115)

### Plan precedenti (codebase scaffolding già in place)
- `packages/gateway/src/index.ts` — Subpath `./sse-ws` annotato come "Phase 4"
- `packages/core/src/types/plugin.ts` line 50, 82 — `// F4 will add: realtimeChannels` placeholder
- `packages/core/src/types/broker-event.ts` line 22-26 — `EventSource.type` accetta già `'server'`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AbortController` cascade pattern** (`packages/core/src/types/plugin.ts` line 65-73, `PluginContext.signal`): F4 propaga `signal` agli adapter SSE/WS per cascade cleanup
- **`BrokerError` con `category`** (`packages/core/src/types/error.ts`): F4 riusa con `category: 'network'` per errori realtime; eventuale `category: 'protocol'` per frame parsing fail
- **`BackpressureStrategy` union type** (definita in F3): F4 lo riusa identico per `RealtimeChannelDef.backpressure`
- **`MapperEngine.mapToCanonical(raw, schemaId)`** (F2 broker-mapper-wrapper.ts): chiamato da `RealtimeChannel` su payload normalization step §28 4
- **`createRouterBroker(config)`** (F3 packages/routing/src/router-broker.ts): F4 base per `createRealtimeBroker(config)` composition wrapper
- **`CanonicalRegistry` bind via cast** (F3 D-100): F4 riusa identico per topic→schemaId resolution

### Established Patterns
- **Declaration merging via `augment.ts`** (`packages/routing/src/augment.ts`, `packages/gateway/src/augment.ts`): F4 crea `packages/gateway/src/sse-ws/augment.ts` per estendere `BrokerConfig`, `PluginDescriptor`, `RouteDefinition` (placeholder F1)
- **Composition wrapper factory** (`createMapperBroker` → `createRouterBroker` → `createRealtimeBroker`): F4 segue catena
- **Subpath exports** (`@gluezero/gateway/http`, `@gluezero/gateway/sse-ws`): F4 popola subpath già anticipato
- **TDD RED→GREEN co-located test** (`*.test.ts` accanto a `*.ts`): F4 mantiene
- **Wave-based plan parallelization con file ownership disgiunta** (F3 9 wave): F4 simile (5-7 plan stimati)

### Integration Points
- **`Broker.publish(event)` API**: punto di ingresso per messaggi realtime (D-113), unchanged dal contratto F1
- **`PluginRegistration.realtimeChannels` field**: nuovo membro nella struttura interna del plugin registry (extension D-103)
- **`createRealtimeBroker(config)`**: nuovo factory pubblico in `@gluezero/gateway/sse-ws` che compone `createRouterBroker` (D-101)
- **`RealtimeChannelManager` lifecycle**: registra `visibilitychange` listener al primo connect, deregistra al disconnect dell'ultimo canale (D-110)
- **`BrokerEvent.source` con `type: 'server'`**: già supportato da F1 type, popolato da F4 adapter

</code_context>

<specifics>
## Specific Ideas

- **Auto-fallback default abilitato** (D-107): l'utente ha esplicitamente scelto modalità auto come default V1, contro il caveat "raro in pratica" sollevato durante la discussione. Researcher dovrà validare il design del scheme switch (`http://` → `ws://`) e identificare server con endpoint sdoppiati `/events` SSE + `/events` WS come reference pattern.
- **Auth-agnostic via `buildUrl`** (D-104): nessun assunto su cookie vs token. Il consumer pluga la propria auth strategy. Researcher può proporre helper opzionale `buildUrlFromAuthStrategy(authStrategy)` che integra `gateway.auth.getToken/refresh` di F3 per use case "voglio riutilizzare la mia auth HTTP per realtime".
- **Envelope JSON `{topic, data, id?}`** (D-106): documentazione DOC-04 deve includere esempio server-side concreto (Express/Fastify+EventEmitter) per mostrare come emettere envelope corretti.

</specifics>

<deferred>
## Deferred Ideas

- **Custom `parseFrame` per WS**: deferred a V1.x per supportare protocolli legacy o JSON-RPC. API surface: `RealtimeChannelDef.parseFrame?: (raw) => { topic, payload, id? }`.
- **WebSocket gap recovery con sequence number**: V1 = best effort, no replay. V1.x può aggiungere `sequenceField: 'id'` config per inviare last-seen-id su reconnect via primo frame.
- **Service Worker / Push notification bridge** (RT2-01): V2 per use case oltre la vita della pagina (PRD §18.7).
- **Custom binary frame parser** (WS binary frames): V1.x se richiesto da consumer con protocolli binary.
- **Multiplexing automatico per URL identico**: deferred — ogni canale ha la propria connessione fisica. Da rivalutare in V1.x se profiling mostra overhead significativo (es. >10 canali stesso URL).
- **Realtime outbound publish** (browser → server WS bidirezionale): V2. PRD §18 limita F4 a inbound.

</deferred>

---

*Phase: 04-realtime-inbound-sse-prioritario-ws-opzionale*
*Context gathered: 2026-05-04*
