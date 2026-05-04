---
phase: 04-realtime-inbound-sse-prioritario-ws-opzionale
researched: 2026-05-04
domain: Realtime inbound (SSE + WebSocket) con reconnection policy, visibility-aware behavior, normalizzazione canonical
researcher: gsd-researcher (claude-opus-4-7-1)
confidence_overall: HIGH (decisioni utente lockate D-101..D-120; pattern F3 consolidati; API browser native ben documentate)
sources_scanned:
  - prd.md §11, §16.2, §17.5, §18.1-18.7, §22.3, §23.3-23.5, §24, §28, §31.3, §35, §39 #9
  - .planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-CONTEXT.md (D-101..D-120)
  - .planning/phases/03-routing-server-gateway-http/03-CONTEXT.md (D-72/75/78/83/86/97/100)
  - .planning/phases/02-canonical-model-mapper/02-CONTEXT.md (D-44/49)
  - .planning/phases/01-core-essenziale/01-CONTEXT.md (D-26/27)
  - .planning/research/STACK.md (EventSource+WebSocket nativi, MSW, @vitest/browser+Playwright)
  - .planning/research/ARCHITECTURE.md §3.2 (EventTap), §4 (data flow canonicalizzazione)
  - .planning/research/PITFALLS.md #4 (backpressure priority bypass), #6 (realtime reconnect)
  - .planning/REQUIREMENTS.md (RT-01..RT-07, ERR-02 ext, TEST-01/02/03 subset, LIFE-01/02 ext)
  - packages/gateway/src/index.ts (subpath ./sse-ws anticipato)
  - packages/gateway/src/augment.ts + http/types/* (pattern declaration merging F3)
  - packages/gateway/src/http/strategies/backpressure-strategy.ts (priority bypass riusabile)
  - packages/routing/src/router-broker-wrapper.ts (composition wrapper pattern F3 — base per F4)
  - packages/core/src/types/{plugin.ts,broker-event.ts} (placeholder F4 + EventSource.type='server')
  - npm registry (versioni live verificate 2026-05-04)
versions_verified:
  - nanoid@5.1.11 (registry, 2026-05-04)
  - valibot@1.3.1 (registry)
  - msw@2.14.2 (registry)
  - vitest@4.1.5 (registry)
  - "@vitest/browser"@4.1.5 (registry)
  - playwright@1.59.1 (registry)
---

# Phase 4: Realtime inbound (SSE prioritario, WS opzionale) — Research

**Researched:** 2026-05-04
**Domain:** Adapter SSE+WebSocket inbound con reconnection policy unificata, visibility-aware behavior, normalizzazione canonical via mapper F2/F3
**Confidence overall:** HIGH

> Lingua: italiano per testo descrittivo; inglese per identificatori, codice, nomi librerie/file/comandi/tipi (vincolo CLAUDE.md).

---

## 1. Executive Summary

La Fase 4 introduce un singolo nuovo subpath `@sembridge/gateway/sse-ws` che ospita **8 moduli runtime + 1 augment** seguendo il pattern di composizione consolidato in F3 (D-83). Il `RealtimeBroker` compone `RouterBroker` di F3 estendendo l'API pubblica con `connectRealtime(config)` / `disconnectRealtime(name?)` (PRD §16.2) e gestendo internamente un `RealtimeChannelManager` che indicizza N canali per `name`. La pipeline §28 step 1 (ingress) accoglie i messaggi server come pubblicazioni esterne — gli step 4-12 (canonicalizzazione, validazione, routing) si applicano automaticamente attraverso il `RouterBroker` sottostante.

**Stack lockato (no choice — già fissato in STACK.md + D-105):**
- `EventSource` nativo per SSE
- `WebSocket` nativo per WS
- `nanoid@5.1.11` per `BrokerEvent.id` (riuso F1)
- `valibot@1.3.1` per envelope WS schema (riuso F2)
- `msw@2.14.2` per mock SSE/WS in integration test
- `vitest@4.1.5` + `@vitest/browser@4.1.5` + `playwright@1.59.1` per browser-real test (TEST-02/03)

**Quattro decisioni implementative non-banali (D-107, D-110, D-111, D-115) hanno conseguenze concrete che devono guidare la decomposition in plan:**

1. **D-107 auto-fallback SSE→WS** richiede una **state machine globale per channel-name** che traccia (modeAttivo, fallbackAttempt, cycleCount) — NON una semplice strategy retry. Questa diventa la responsabilità del `reconnect-strategy.ts` modulo.
2. **D-110 visibility integration** introduce una dipendenza opzionale su `document` API — serve guard per environment iframe/worker e fallback per piattaforme dove `visibilityState` non esiste. Il `visibility-detector.ts` deve essere SOSTITUIBILE (DI) per testabilità.
3. **D-111 ping/pong applicativo** introduce due topic interni riservati (`__ping__`/`__pong__`) che attraversano lo stesso layer di `broker.publish` ma DEVONO essere intercettati prima della pipeline §28 → richiede un pre-filter al livello adapter, NON al livello broker (mantiene D-83 strict — niente modifiche al core).
4. **D-115 backpressure adapter-level** significa che la `BackpressureStrategy` esistente di F3 viene applicata PRIMA della `broker.publish` — quindi il `RealtimeChannel` invoca direttamente `strategy.schedule(...)` come decoration. Pattern: `strategy.schedule(channelId, event.priority, () => broker.publish(event))`.

**Primary recommendation:** decomporre in **9 plan** wave-based (analogo F3 14 plan / F2 12 plan), file ownership disgiunta entro ogni wave per parallelizzazione. Un final-gate plan dedicato (04-09) chiude la fase con coverage v8 ≥90%, REQ matrix verifica, DOC-04 update sezione Realtime.

**Vincolo D-83 strict (carryover F3):** ZERO modifiche runtime a `packages/core/`, `packages/mapper/`, `packages/routing/`, `packages/gateway/src/http/`. Tutto F4 vive in `packages/gateway/src/sse-ws/`. Il `packages/gateway/src/sse-ws/augment.ts` chiude il placeholder `// F4 will add: realtimeChannels` di `core/src/types/plugin.ts` via TypeScript declaration merging (pattern F2 D-57, F3 D-93/D-94 — già consolidato e testato).

---

## 2. Stack & Library landscape

### 2.1 Stack lockato (riuso F1-F3)

| Capability | Library | Version | Status | Note |
|------------|---------|---------|--------|------|
| SSE transport | `EventSource` (browser nativo) | spec WHATWG HTML | LOCKED (PRD §31.3) | NO `eventsource-polyfill` |
| WS transport | `WebSocket` (browser nativo) | spec RFC 6455 + WHATWG | LOCKED (PRD §31.3) | NO `reconnecting-websocket` |
| ID generation | `nanoid` | 5.1.11 | LOCKED (riuso F1) | Verificato registry 2026-05-04 |
| Schema validation | `valibot` | 1.3.1 | LOCKED (riuso F2 D-31) | Per envelope WS `{topic, data, id?}` |
| Mock SSE/WS | `msw` | 2.14.2 | LOCKED (riuso F3 D-89) | MSW 2.x supporta SSE + WS handler |
| Browser-real test | `@vitest/browser` + `playwright` | 4.1.5 + 1.59.1 | LOCKED (STACK.md) | Per TEST-02/03 reconnect reali |
| Unit + jsdom | `vitest` + `jsdom` | 4.1.5 + 29.1.0 | LOCKED | Per logica deterministica (math reconnect, frame parser, state machine) |
| Composition base | `RouterBroker` di `@sembridge/routing` | workspace:* | LOCKED (D-101) | F4 estende, NON modifica |

### 2.2 Alternative valutate e RIGETTATE

| Alternativa | Perché rigettata | Riferimento |
|-------------|------------------|-------------|
| `reconnecting-websocket` (npm) | Vincolo PRD §31.3 polyfill separati; copre ~30% delle policy PRD §18.6 (RT-05); manca full jitter, manca ping/pong app-level, manca visibility-aware | STACK.md §7, PITFALLS.md #6 |
| `eventsource-polyfill` (npm) | Browser evergreen target (PRD §31.3); EventSource ha supporto > 95% (caniuse 2025); polyfill aggiunge ~10 KB inutili | STACK.md §7 |
| `partysocket` (PartyKit) | Orientato a PartyKit ecosystem, opinionato | STACK.md §7 |
| `socket.io-client` | Soluzione full-stack server-incluso, NO solo per SSE/WS | STACK.md "What NOT to Use" |
| `fetch` + `ReadableStream` per SSE custom | Workaround per custom headers (D-105 deferred V2 caveat) — V1 usa `EventSource` nativo + auth via query string (D-104) | STACK.md §7 caveat |
| `superjson` per envelope serialization | Default JSON `{topic, data, id?}` (D-106) sufficiente; superjson ~5 KB inutili | STACK.md §8 |

### 2.3 Cosa va INSTALLATO in F4

**Niente.** Tutto lo stack è già nei `package.json` di F1/F2/F3. Il `packages/gateway/package.json` ha già `nanoid`, `valibot`, `vitest`, `jsdom`. Per browser-real test sarà necessario installare al level workspace:

```bash
# Verificare che siano già a workspace root (devDependencies):
pnpm ls --depth -1 -w @vitest/browser playwright
# Se mancano (probabile per F3):
pnpm add -Dw @vitest/browser@4.1.5 playwright@1.59.1
```

> **Verification step (per il planner):** prima di scrivere il primo plan, un task setup deve eseguire `pnpm ls @vitest/browser playwright` e installare se mancanti. Costo ~5 min, riduce surprise nei plan downstream.

---

## 3. EventSource (SSE) — protocol semantics & pitfalls

### 3.1 API surface essenziale

```ts
const es = new EventSource(url, { withCredentials: true })
es.readyState  // 0=CONNECTING, 1=OPEN, 2=CLOSED
es.onopen = (ev) => { /* connesso */ }
es.onmessage = (ev) => { /* default 'message' event */ }
es.onerror = (ev) => { /* errore generico, NESSUN dettaglio */ }
es.addEventListener('weather.update', (ev) => { /* event:weather.update lato server */ })
es.close()  // → readyState = 2
```

> **Spec reference** (WHATWG HTML §9.2 Server-sent events): https://html.spec.whatwg.org/multipage/server-sent-events.html

### 3.2 Last-Event-ID semantics — il dettaglio critico per RT-07

**Comportamento browser nativo (verificato cross-browser, MDN):**

1. Server invia messaggio con campo `id: <token>\n` (oltre a `data:`).
2. Il browser memorizza internamente l'ultimo `id` ricevuto in `EventSource.lastEventId` (proprietà spec).
3. Su reconnect AUTOMATICO (vedi §3.3), il browser invia automaticamente l'header `Last-Event-ID: <token>` nel GET di reconnect.

**Implicazione per F4 (D-109 — chiusura RT-07):**

- Se F4 sceglie di **gestire reconnect manualmente** (D-109 full jitter — vedi §3.3) chiamando `es.close()` + `new EventSource(url)`, **il browser NON inietta `Last-Event-ID`** sulla nuova istanza (è una nuova connessione fresh).
- **Soluzione obbligata:** l'adapter SSE deve **memorizzare manualmente** `lastEventId` (leggendo `event.lastEventId` su ogni `onmessage`/listener), e **iniettarlo come query string** nell'URL di reconnect, perché `EventSource` non accetta header custom (D-105 vincolo PRD §31.3).

```ts
// Pseudocodice adapter SSE
class SseAdapter {
  private lastEventId: string | undefined = undefined

  private async connect(): Promise<void> {
    const baseUrl = await this.def.buildUrl()
    const url = this.lastEventId
      ? appendQuery(baseUrl, 'lastEventId', this.lastEventId)
      : baseUrl
    this.es = new EventSource(url, { withCredentials: true })
    this.es.addEventListener('message', (ev) => {
      if (ev.lastEventId) this.lastEventId = ev.lastEventId
      this.dispatchInbound(ev)
    })
    // ... custom event listeners
  }
}
```

> **Server contract DOC-04:** documentare che il server deve riconoscere `?lastEventId=` query param come fallback al header `Last-Event-ID` nativo. Best practice: middleware Express/Fastify che legge entrambi.

**Confidence: HIGH** — comportamento standard, verificato su Chromium/Firefox/Safari (MDN `EventSource.lastEventId`).

### 3.3 Native reconnect vs custom reconnect — perché chiudere e ricreare

EventSource ha un meccanismo di reconnect built-in:
- Su `error` (network drop) il browser entra in `readyState=CONNECTING` e tenta automaticamente reconnect dopo `retry: <ms>` (default ~3s, configurabile dal server inviando `retry: <number>\n` in un evento).
- **Problema #1:** il delay è fisso (no exponential backoff), no jitter — viola PRD §18.6 RT-05 (full jitter cap 30s).
- **Problema #2:** il browser non rispetta `maxAttempts`. Reconnect è infinito.
- **Problema #3:** non c'è hook per pubblicare `system.realtime.reconnecting` durante il backoff (PRD §22.3 ext F4, ERR-02 ext).

**Soluzione D-109 — disable native reconnect, gestire manualmente:**

```ts
es.onerror = () => {
  // readyState passa a CONNECTING o CLOSED a seconda dello stato
  if (es.readyState === EventSource.CLOSED || es.readyState === EventSource.CONNECTING) {
    es.close()  // FORZA stato CLOSED
    publish('system.realtime.disconnected', { name, reason })
    scheduleReconnect()  // applica D-109 full jitter
  }
}
```

**Conseguenza pratica:** il `readyState` di `EventSource` durante `onerror` può essere ambiguo. Il browser potrebbe averlo già messo in `CONNECTING` (= sta già provando il reconnect nativo). Chiamare `es.close()` lo forza in `CLOSED` e blocca il reconnect built-in. Solo dopo, l'adapter applica la propria policy.

**Edge case scoperto durante la ricerca:** `onerror` viene invocato anche durante la prima connessione fallita (DNS error, 404, CORS reject). In questi casi `readyState` è già `CLOSED` e il browser NON ritenta. Quindi `onerror` ha **due significati distinti**: (a) network drop dopo connessione attiva → tentare reconnect; (b) connessione iniziale fallita → log + publish disconnected, ma rispettare comunque maxAttempts. L'adapter deve distinguerli tramite un flag `hasEverBeenOpen`.

**Confidence: HIGH** — comportamento documentato MDN + verificato dal pattern di librerie come `partysocket`.

### 3.4 readyState semantics e detection disconnessione

| readyState | Costante | Significato | Trigger eventi |
|------------|----------|-------------|----------------|
| 0 | `CONNECTING` | Tenta connessione iniziale o reconnect | `onerror` durante connect, eventualmente `onopen` |
| 1 | `OPEN` | Connesso, riceve eventi | `onmessage`, custom event listeners |
| 2 | `CLOSED` | Chiuso definitivamente (manualmente o errore terminale) | NESSUN evento ulteriore |

**Detection rule per F4 SSE adapter:**

```ts
function shouldReconnect(): boolean {
  // SSE adapter NON usa readyState come fonte di verità — usa explicit flags
  return this.intentionallyOpened && !this.intentionallyClosed && this.attempt < this.maxAttempts
}
```

**Why not readyState:** durante `onerror`, lo state è transitorio e race-prone. L'approach robusto è "intent-based": l'adapter tiene il proprio stato (`intentionallyOpened: boolean`, `intentionallyClosed: boolean`) e usa `readyState` solo per debug snapshot.

### 3.5 CORS e auth — implicazioni D-104/D-105

**`EventSource(url, { withCredentials: true })`:**
- Cookie inviati cross-origin (richiede server `Access-Control-Allow-Credentials: true` + `Access-Control-Allow-Origin: <exact-origin>`, NO wildcard)
- **NESSUN supporto custom headers** — limitazione spec, NON aggirabile senza `fetch + ReadableStream`
- D-104 `buildUrl()` permette query string come escape hatch: `https://api.example.com/events?token=<jwt>` (caveat security: token in URL appare in proxy log → mitigation tipica: short-lived token o cookie-bound)

**Compatibility table CORS+credentials:**

| Server config | Browser behavior | F4 SSE viable? |
|---------------|-----------------|----------------|
| Same-origin, cookie auth | Cookie auto-inviati | ✅ |
| Cross-origin + `Access-Control-Allow-Credentials: true` | Cookie auto-inviati con `withCredentials` | ✅ |
| Cross-origin + token in URL | Server legge query param | ✅ (D-104 pattern) |
| Cross-origin + custom `Authorization` header | NON supportato da EventSource | ❌ V1 (V2 via fetch+ReadableStream) |

**Confidence: HIGH** — limitazione well-known. Documentata in DOC-04 sezione "Realtime Auth Patterns" (D-105).

### 3.6 Heartbeat side-channel SSE — comment lines per stale detection

**Pattern server consolidato (industry):**

I server SSE inviano periodicamente:

```
: keep-alive

```

Una linea che inizia con `:` è un **comment** secondo lo spec EventSource — non genera evento JavaScript ma riavvia i timer dei proxy/CDN intermedi (impedisce HTTP 504 timeout).

**Implicazioni per F4 D-110 stale detection:**

- L'adapter SSE NON riceve eventi JavaScript per i comment lines.
- Per stimare "freshness", deve tracciare il timestamp dell'ULTIMO byte ricevuto dal server. Browser non espone questo direttamente (non c'è `onbyte` event).
- **Workaround:** `onmessage`/listener custom registrano `lastEventReceivedAt = Date.now()`. Se il server non manda eventi reali per > N secondi (config), l'adapter assume stale → reconnect.
- **Limite:** se il server invia SOLO comment + nessun evento reale per ore (canale legitimately quiet), l'adapter potrebbe falsi-positivi. Mitigazione: il server invia un `event: __heartbeat__\ndata: {}\n\n` periodico (alcuni minuti) come "tu sei vivo" applicativo. Filtrato dall'adapter prima della pipeline §28.

**Decisione raccomandata per F4 (Claude's discretion D-118 caveat):**
- Default `staleTimeoutMs: 60_000` (1 min) per SSE come per WS (D-111 default).
- Documentare in DOC-04 server-side che heartbeat application-level è raccomandato (esempio `event: __heartbeat__`).
- Topic prefix `__` riservato (D-111 ha già locked `__ping__`/`__pong__` per WS — per coerenza F4 usa `__heartbeat__` per SSE-side, filtrato adapter-level).

**Confidence: MEDIUM-HIGH** — la pratica di comment heartbeat è standard de facto (HTML5 spec `9.2.6 The data-only message`), ma le esatte conventions naming sono libere; D-111 ha già locked `__` prefix.

### 3.7 Multi-line `data:` field e custom `event:` field

**Multi-line data:** server può inviare:

```
event: weather.update
data: {"city":"Roma",
data: "temp":22}
id: evt-123

```

Il browser unisce le multi-line `data:` con `\n`. Il payload finale `event.data` è la stringa completa. **Implicazione F4:** il `frame-parser.ts` (vedi §10 plan decomposition) NON deve preoccuparsi del multi-line — è gestito dal browser.

**Custom `event:` field → `BrokerEvent.topic`:**

```
event: weather.update     ← diventa BrokerEvent.topic
data: <payload>            ← diventa BrokerEvent.payload
```

Se il server omette `event:`, il default è `'message'`. **Decisione raccomandata F4 (Claude's discretion):**

- Topic `'message'` (default fallback) viene **passato through** alla pipeline §28 senza alcun trattamento speciale. Se non c'è canonical schema per `'message'`, l'evento viene pubblicato raw (D-114 default `requiresRoute: false` ereditato F3 D-67/D-100).
- Documentare in DOC-04: "convenzione: il server SSE deve setteare `event:` esplicito con topic dot-separated (PRD §12.1). Eventi senza `event:` arrivano con topic `'message'` e potrebbero non essere routabili".

**Validation contract:** il tema `topic` deve passare la regex F1 `/^[a-z0-9]+(\.[a-z0-9]+)*$/` (D-24 di F1). Se il server invia `event: Weather.Update` (case mixed) → `broker.publish` throw `topic.invalid` (F1 BrokerError). **Mitigation F4:** il `sse-adapter.ts` invoca `validateTopic(eventName)` PRIMA di publish; on fail, publish `network.error` con `category: 'protocol'` + descarta il messaggio (NON crash).

**Confidence: HIGH** — comportamento browser standard.

---

## 4. WebSocket — protocol semantics & pitfalls (D-106, D-111)

### 4.1 API surface essenziale

```ts
const ws = new WebSocket(url, protocols?)  // protocols = string | string[]
ws.readyState  // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
ws.onopen = () => { /* connesso */ }
ws.onmessage = (ev) => { /* ev.data: string | ArrayBuffer | Blob */ }
ws.onerror = () => { /* opaque, NO info utili */ }
ws.onclose = (ev) => { /* ev.code: number, ev.reason: string, ev.wasClean: boolean */ }
ws.send(data)  // string | ArrayBuffer | Blob
ws.close(code?, reason?)
ws.bufferedAmount  // bytes pending in buffer outbound
```

> **Spec reference** (WHATWG HTML §9.7 Web sockets + RFC 6455): https://html.spec.whatwg.org/multipage/web-sockets.html

### 4.2 Close codes — quali richiedono reconnect

**Tabella RFC 6455 §7.4 + WHATWG HTML:**

| Code | Nome | Significato | Reconnect F4? |
|------|------|-------------|----------------|
| 1000 | Normal Closure | Chiusura volontaria/cooperativa | ❌ NO (intenzionale) |
| 1001 | Going Away | Server shutdown / browser navigation | ✅ SÌ |
| 1002 | Protocol Error | Errore protocollo WS (tipicamente bug) | ❌ NO (bug) |
| 1003 | Unsupported Data | Tipo dati non gestito (binary su text-only) | ❌ NO (bug) |
| 1005 | No Status Received | Synthetic, mai inviato in wire | ✅ SÌ (assume disconnect) |
| 1006 | Abnormal Closure | TCP drop senza close frame, NAT timeout | ✅ SÌ (caso più comune) |
| 1007 | Invalid Frame Payload Data | Dati non UTF-8 in text frame | ❌ NO (bug) |
| 1008 | Policy Violation | Server reject per policy | ⚠️ DEPENDE (policy, no retry) |
| 1009 | Message Too Big | Payload eccede max | ❌ NO |
| 1010 | Mandatory Extension | Client missing extension | ❌ NO |
| 1011 | Internal Server Error | Server crash | ✅ SÌ |
| 1012 | Service Restart | Server restart soft | ✅ SÌ |
| 1013 | Try Again Later | Server overloaded, hint retry | ✅ SÌ (rispettare backoff) |
| 1014 | Bad Gateway | Proxy error | ✅ SÌ |
| 1015 | TLS Handshake | TLS fail | ❌ NO (cert problem) |
| 4000-4999 | Application | App-level | Per-app decision |

**Decisione raccomandata F4 (Claude's discretion — la D-109 non lo specifica):**

```ts
function shouldReconnectOnClose(code: number): boolean {
  // Reconnect su: 1001, 1005, 1006, 1011, 1012, 1013, 1014 + 4xxx app-level NON in deny-list
  if (code === 1000) return false  // intenzionale
  if (code === 1002 || code === 1003 || code === 1007 || code === 1009 || code === 1010 || code === 1015) return false
  if (code >= 4000 && code < 5000) {
    // App-level: default reconnect, ma il consumer può override via config.reconnectOnAppCodes
    return !appCodeDenyList.has(code)
  }
  return true  // 1001, 1005, 1006, 1008, 1011, 1012, 1013, 1014
}
```

**Test obbligatorio (per planner):** un unit test deterministico in `websocket-adapter.test.ts` che enumera i codici e verifica behavior. Il pattern aiuta debug operations team.

> **Caveat 1008 Policy Violation:** alcuni server lo usano per "auth fail" (es. token expired). Reconnect immediato fallisce di nuovo loop infinito. **Mitigation D-104:** `buildUrl()` async permette token refresh tra un tentativo e l'altro — fa parte del contract. Il fallback consigliato in DOC-04: catturare 1008 + `BrokerError` `realtime.policy.rejected` + tentare 1 reconnect dopo `auth.refresh` (riuso F3 D-72 `gateway.auth.refresh`).

**Confidence: HIGH** — RFC 6455 documentato + pratica industry.

### 4.3 Native ping/pong frames — perché D-111 è obbligatoria (NON opzionale)

**Fatto critico:**

WebSocket protocol definisce due frame opcode dedicati al keepalive:
- `0x9` PING — il peer deve rispondere con PONG
- `0xA` PONG — risposta a PING

**MA:** il browser **NON espone** ping/pong frames al JavaScript. Questa è una scelta deliberata della specifica WHATWG/W3C ("the Web Sockets API doesn't expose ping/pong to scripts; the user agent handles them transparently").

**Conseguenza:**
- Il browser PUÒ inviare ping/pong autonomamente (alcuni browser lo fanno per NAT keepalive), ma è opaco al JS.
- Non c'è API per dire "il pong è arrivato entro X ms".
- Stale detection a livello protocol-level NON è osservabile lato client.

**D-111 quindi NON è una scelta ma una necessità:** ping/pong applicativo sopra l'envelope JSON `{topic: '__ping__', data: { ts }}` è l'unico modo per F4 di rilevare connessione morta lato client. Il server deve cooperare implementando il contract `__ping__` → `__pong__` (documentato DOC-04).

**Edge case scoperto:** alcuni server WebSocket (Node `ws`, Cloudflare Workers) hanno timer interni che chiudono la connessione per inattività anche se il client invia ping app-level. Il client deve quindi inviare app-level ping a interval inferiore al server timeout (default raccomandato D-111: 30s, server timeout tipico 60-120s).

**Confidence: HIGH** — limitazione spec, well-documented.

### 4.4 `bufferedAmount` per outbound backpressure

`ws.bufferedAmount` ritorna i byte pendenti nel buffer outbound del browser. F4 è inbound-only (D-114 — `out of scope: realtime outbound publish`), MA invia comunque `__ping__` outbound (D-111). Considerazioni:

- Se `bufferedAmount > threshold` (es. 1 MB), inviare un nuovo `__ping__` rischia di accumulare ulteriormente → client process crash sotto load.
- **Decisione raccomandata F4:** prima di `ws.send(JSON.stringify({topic: '__ping__', ...}))`, check `bufferedAmount < 64_000` (64 KB cap conservative per ping da ~50 byte). Se exceeded, skip ping (la prossima opportunità ne invierà uno fresh).
- Documentare in `websocket-adapter.ts` JSDoc.

**Confidence: MEDIUM** — pattern documentato MDN ma uncommon in librerie WS minori.

### 4.5 `onerror` opaque — solo `onclose.code` è informativo

Caratteristica critica del browser WebSocket API: `onerror` event **non porta info utili**. Per privacy + sicurezza, il browser non rivela "connection refused" vs "DNS error" vs "TLS error". Il JS riceve un `Event` opaco.

**Implicazione F4:**
- `onerror` viene loggato come "errore generico" (BrokerError `category: 'network'`) ma il `code` reale arriva DOPO via `onclose`.
- Sequenza tipica: `onerror` → `onclose(code: 1006)`. F4 deve accumulare info da `onclose` per decidere reconnect, ignorando `onerror` (o usandolo solo come "early signal").

**Pattern consigliato:**

```ts
ws.onerror = () => {
  this.lastErrorAt = Date.now()  // signal, NO publish ancora
}

ws.onclose = (ev) => {
  // QUI decidiamo cosa pubblicare e se reconnect
  if (ev.code !== 1000) {
    publish('system.realtime.disconnected', { reason: `code:${ev.code}` })
    if (shouldReconnectOnClose(ev.code)) {
      scheduleReconnect()
    }
  }
}
```

**Confidence: HIGH** — comportamento standard.

### 4.6 Edge case `OPEN` non garantisce health (TCP zombie)

Il classic problem documentato in PITFALLS.md #6.B: `readyState === OPEN` ma TCP è morta dietro NAT/firewall. Senza ping app-level, nessun nuovo messaggio arriva, ma il client crede di essere connesso.

**Resolution F4:** D-111 ping/pong applicativo + `staleTimeoutMs: 60_000` default. Se non arriva pong in 60s dopo aver inviato ping, assumere zombie → `ws.close(1000, 'stale')` + reconnect.

**Confidence: HIGH** — chiusura diretta di Pitfall #6.B.

### 4.7 Subprotocols come discriminator (Claude's discretion)

`new WebSocket(url, ['sembridge-v1'])` invia `Sec-WebSocket-Protocol: sembridge-v1` header. Il server può accettare/rejectare. **Use case F4 potenziale:**

- Versioning del contract envelope (D-106 `{topic, data, id?}`). Se in V1.x si aggiunge `parseFrame` custom (deferred D-CONTEXT), subprotocol può negoziare la versione.
- **V1 decision (Claude's discretion):** non usare subprotocols. Documentare come extension point in DOC-04 per V1.x. Aggiungere `RealtimeChannelDef.wsSubprotocols?: string | string[]` come opt-in passthrough.

### 4.8 Binary frames handling (V1 lock = solo testo JSON)

`ws.onmessage` può ricevere `string`, `ArrayBuffer`, o `Blob` a seconda di `ws.binaryType` (default `'blob'`). D-106 lock V1 a testo JSON envelope. **Strategia F4:**

```ts
ws.onmessage = (ev) => {
  if (typeof ev.data !== 'string') {
    publish('network.error', {
      category: 'protocol',
      code: 'realtime.frame.binary-unsupported',
      details: { name, dataType: typeof ev.data }
    })
    return  // discard
  }
  // ... parse JSON envelope
}
```

Settare `ws.binaryType = 'blob'` (default) implicito; non serve override.

**Confidence: HIGH** — comportamento documentato.

---

## 5. Visibility API integration deep-dive (D-110)

### 5.1 API surface

```ts
document.visibilityState  // 'visible' | 'hidden' | 'prerender' (raro)
document.hidden  // boolean (alias deprecato)
document.addEventListener('visibilitychange', (ev) => { ... })

// Eventi correlati:
window.addEventListener('pagehide', (ev) => { ... })  // tab chiusa o BFCache
window.addEventListener('pageshow', (ev) => { ... })  // tab restored from BFCache
window.addEventListener('beforeunload', (ev) => { ... })  // cleanup pre-unload
```

> **Spec reference** (W3C Page Visibility API L2): https://www.w3.org/TR/page-visibility/

### 5.2 Browser timer throttling — il problema sotto D-110

**Comportamento documentato (Chrome/Firefox/Safari, 2024+):**

| Tab state | `setTimeout`/`setInterval` throttle | Source |
|-----------|-------------------------------------|--------|
| `visible` | No throttle (1ms minimum) | — |
| `hidden` < 5 min | 1s minimum | Chrome 88+ |
| `hidden` > 5 min | 1 minute minimum (aggressive) | Chrome 88+ "intensive throttling" |
| `hidden` battery saver | Even more aggressive | Mobile-specific |

**Implicazione D-110 ("heartbeat continua ma con tolleranza ×3"):**

- Heartbeat 30s default + tolleranza ×3 = 90s before stale.
- Tab hidden > 5 min: timer scatta ogni 60s (intensive throttling) → primo ping 60s post-hidden, secondo 120s post-hidden.
- Server timeout tipico 60-120s → la connessione muore PRIMA che il client mandi il secondo ping.
- **Quindi la tolleranza ×3 è una mitigazione ma NON elimina il problema.**

**Soluzione D-110 effettiva:**

1. **Su `visibilitychange → hidden`:** non spegnere il timer, ma estendere `staleTimeoutMs * 3`. Accept che il client potrebbe credere "connesso" per 3 min mentre il server l'ha già scollegato.
2. **Su `visibilitychange → visible`:** invocare immediatamente un check di freschezza:
   - SSE: confronta `Date.now() - lastEventReceivedAt > staleTimeoutMs` → se sì, force disconnect + reconnect.
   - WS: invia `__ping__` immediato + attendi `__pong__` entro `staleTimeoutMs` ridotto (es. 5s aggressivo). Se timeout → reconnect.
3. **Pubblicare `system.realtime.connected` solo dopo health-check passato** (NON solo perché `readyState === OPEN`).

**Pattern consigliato F4:**

```ts
class VisibilityDetector {
  private listener: (() => void) | null = null
  private callbacks = new Set<(state: 'visible' | 'hidden') => void>()

  attach(): void {
    if (typeof document === 'undefined') return  // SSR/worker guard
    this.listener = () => {
      const state = document.visibilityState
      if (state === 'visible' || state === 'hidden') {
        this.callbacks.forEach(cb => cb(state))
      }
    }
    document.addEventListener('visibilitychange', this.listener)
  }

  detach(): void {
    if (this.listener) {
      document.removeEventListener('visibilitychange', this.listener)
      this.listener = null
    }
  }

  onChange(cb: (state: 'visible' | 'hidden') => void): () => void {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }
}
```

**Lifecycle:** `RealtimeChannelManager` chiama `visibilityDetector.attach()` al primo `connectRealtime`, `detach()` quando l'ULTIMO canale chiude (counter atomico). Cleanup deterministico — chiusura LIFE-02 ext F4 (D-112).

### 5.3 iframe / web worker — guards necessari

**iframe nascosto:** `document.visibilityState` segue il top-level frame. Un iframe nascosto in una tab visible vede comunque `visibilityState === 'visible'`. **Implicazione:** se SemBridge gira in un iframe sandbox, la stale detection visibility-aware non funziona come atteso. Documentare DOC-04 limitazione.

**Web Worker:** non c'è `document` nel worker context. F4 vive nel main thread (V1 lock — il worker runtime è F5), ma per robustezza il `VisibilityDetector` deve guard:

```ts
if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
  // No-op detector — usato in worker context o test environment
  return createNoopDetector()
}
```

**Testabilità:** per unit test (jsdom) e browser-real test (Playwright), il `VisibilityDetector` accetta un'istanza `Document`-like via DI:

```ts
interface VisibilityDetector {
  attach(target?: Document): void
  detach(): void
  onChange(cb): () => void
  // Test helper:
  __forceState?(state: 'visible' | 'hidden'): void  // dev-mode only
}
```

### 5.4 `pagehide` vs `beforeunload` — cleanup pre-chiusura

- `beforeunload`: invocato prima della chiusura tab/navigation. **Deprecato** per evitare prompt; supporto ridotto in mobile.
- `pagehide`: invocato prima del passaggio in BFCache (back-forward cache) o chiusura. Più reliable.
- `unload`: deprecato, fragile.

**Decisione F4 (Claude's discretion):**

- Il `RealtimeChannelManager` registra `pagehide` listener → chiude tutti i canali con `code: 1000` "Normal Closure" + `reason: 'pagehide'`. Garantisce server-side cleanup pulito.
- NO `beforeunload` (mobile inaffidabile).
- Su `pageshow.persisted === true` (BFCache restore): forza reconnect di tutti i canali (la connessione precedente è morta server-side).

```ts
window.addEventListener('pagehide', () => this.disconnectAll())
window.addEventListener('pageshow', (ev) => {
  if (ev.persisted) this.reconnectAll()
})
```

**Confidence: MEDIUM-HIGH** — pattern documentato, ma adoption uneven nei browser. Test browser-real obbligatorio.

### 5.5 Mobile browsers — comportamento divergente

- **Safari iOS:** tab in background freeze AGGRESSIVO dopo ~30s. Timer non scatta proprio (non solo throttle). Ping/pong morto, server timeout, reconnect su `pageshow`.
- **Android Chrome:** simile ma più permissivo (segue `intensive throttling` standard).
- **Implicazione F4:** documentare in DOC-04 caveat "su mobile background, le connessioni realtime sono soggette a freeze. Reconnect on resume".

---

## 6. Reconnection policy — algoritmica (D-107, D-109)

### 6.1 Full jitter formula — confermata da AWS Architecture Blog

**Formula D-109 (locked):**

```ts
delay = Math.random() * Math.min(30_000, 1_000 * 2 ** attempt)
```

**Reference:** "Exponential Backoff and Jitter" (AWS Architecture Blog, Marc Brooker 2015): https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

Il post identifica 3 varianti di jitter:
1. **Full jitter:** `random(0, min(cap, base * 2^attempt))` ← **D-109 SCELTA**
2. **Equal jitter:** `min/2 + random(0, min/2)`
3. **Decorrelated jitter:** `random(base, prev_delay * 3)`

**Perché full jitter:**
- Riduce il "thundering herd" massimo (Pitfall PITFALLS.md #5.C, #6.C).
- Più semplice da implementare e ragionare.
- Documentato come default raccomandato per server reboot scenarios.

**Pattern F4 reconnect-strategy.ts:**

```ts
export function computeReconnectDelay(
  attempt: number,
  baseMs = 1_000,
  capMs = 30_000,
): number {
  const exponential = Math.min(capMs, baseMs * 2 ** attempt)
  return Math.floor(Math.random() * exponential)
}
```

**Test deterministico:** mock `Math.random` per behavior verifiabile.

**Confidence: HIGH** — formula consolidata.

### 6.2 Reset criteria — quando azzerare `attempt`

**Open question critica (Claude's discretion D-CONTEXT):** D-109 lock formula ma non specifica QUANDO resettare `attempt` a 0. Tre opzioni:

| Opzione | Reset trigger | Pro | Contro |
|---------|--------------|-----|--------|
| **A. After first message received** | Primo `onmessage`/event ricevuto post-reconnect | Conservative, "veramente connesso" | Se server è quiet, `attempt` non resetta mai → backoff cresce |
| **B. After OPEN state for N seconds** | `readyState===OPEN` per ≥ 5s | Bilanciato, robusto a flap | Ritardo nel reset post-success |
| **C. After OPEN immediate** | Subito su `onopen` | Semplice | Falsi positivi: server accetta connessione poi droppa subito |

**Decisione raccomandata F4 (Claude's discretion):** **opzione B con default 5s**.

```ts
ws.onopen = () => {
  publish('system.realtime.connected', { name })
  // NON resettare ancora — aspetta consolidation
  this.consolidationTimer = setTimeout(() => {
    this.attempt = 0
    this.fallbackAttempt = 0  // anche per D-107 cycle counter
  }, 5_000)
}

ws.onclose = () => {
  if (this.consolidationTimer) {
    clearTimeout(this.consolidationTimer)  // chiusura prima di consolidation
    // attempt NON viene resettato → backoff cresce → flap detection
  }
}
```

**Override-abile via config:** `RealtimeChannelDef.reconnect.consolidationMs?: number` (default 5_000).

**Confidence: MEDIUM** — non c'è "best practice" universale; il default 5s è inspired da `socket.io-client` e simili.

### 6.3 maxAttempts default — Infinity vs finito

**D-109 lock:** `maxAttempts?: number` opzionale, default `Infinity` per persistenza.

**Caveat documentati (DOC-04):**
- Tab in background per giorni → reconnect attempts cresce, batteria mobile drenata. Mitigazione: backoff cap a 30s (D-109) limita a 1 attempt/30s, ~ 2880 attempts/giorno → tollerabile.
- **Use case finite maxAttempts:** server known down per maintenance window. Consumer può settare `maxAttempts: 10` per fail-fast in dev.
- Su `maxAttempts` reached: publish `system.realtime.failed` con `permanent: true`. Operatore deve `disconnectRealtime(name) + connectRealtime(name)` per ricominciare.

### 6.4 Auto-fallback SSE↔WS scheme switch (D-107) — regole URL transformation

**Spec D-107 lock:** scheme switch `http://` → `ws://`, `https://` → `wss://`.

**Edge case da chiarire (Claude's discretion):**

| Input URL | Mode `'auto'` switch | Output WS URL |
|-----------|---------------------|---------------|
| `https://api.example.com/events` | sse → ws | `wss://api.example.com/events` |
| `http://localhost:8080/events` | sse → ws | `ws://localhost:8080/events` |
| `https://api.example.com/events?token=X` | sse → ws | `wss://api.example.com/events?token=X` |
| `https://api.example.com:443/path?a=1&b=2` | sse → ws | `wss://api.example.com:443/path?a=1&b=2` |
| `wss://api.example.com/ws` (già ws) | ws → sse | `https://api.example.com/ws` |

**Algoritmo:**

```ts
function switchScheme(url: string, target: 'sse' | 'ws'): string {
  const u = new URL(url)
  if (target === 'ws') {
    if (u.protocol === 'https:') u.protocol = 'wss:'
    else if (u.protocol === 'http:') u.protocol = 'ws:'
    // wss:/ws: → already WS, no-op
  } else {
    if (u.protocol === 'wss:') u.protocol = 'https:'
    else if (u.protocol === 'ws:') u.protocol = 'http:'
  }
  return u.toString()
}
```

**Caveat (D-108 lock):** assume server espone stesso path per entrambi protocols. Se non è il caso, fallback fallisce → cycle cap 5 si attiva (D-107).

**Path-only override (Claude's discretion suggestion):** alcuni server espongono `/sse` per SSE e `/ws` per WS. F4 V1.x potrebbe aggiungere `RealtimeChannelDef.fallbackPathMap?: { sse: string; ws: string }`. Per V1, documentare come limitazione (DOC-04 D-108 caveat).

**Confidence: HIGH** — standard URL parsing nativo (`URL` API).

### 6.5 Cycle cap 5 (D-107) — implementation detail

**D-107 lock:** dopo 5 cicli totali SSE→WS→SSE→WS→SSE senza success, publish `system.realtime.failed` permanente.

**State machine pattern:**

```ts
type ChannelMode = 'sse' | 'ws'
type ChannelState = {
  currentMode: ChannelMode
  modeFailCount: number   // fail in current mode (3 = trigger fallback)
  cycleCount: number       // cicli totali (5 = trigger permanent fail)
  lastSuccessAt: number | null
}

function onReconnectFail(state: ChannelState): 'retry-same' | 'switch-mode' | 'permanent-fail' {
  state.modeFailCount += 1
  if (state.modeFailCount < 3) return 'retry-same'
  // Threshold reached
  if (state.cycleCount >= 5) return 'permanent-fail'
  state.currentMode = state.currentMode === 'sse' ? 'ws' : 'sse'
  state.modeFailCount = 0
  state.cycleCount += 1
  return 'switch-mode'
}

function onConnectSuccess(state: ChannelState): void {
  state.modeFailCount = 0
  // cycleCount NON resetta (preserva il giudizio "questo channel è instabile")
  // Reset criteria: dopo `consolidationMs` (vedi §6.2), cycleCount → 0
}
```

**Test deterministico:** `reconnect-strategy.test.ts` enumera 5 cicli + verifica `system.realtime.failed` su sesto.

**Confidence: HIGH** — state machine deterministica.

---

## 7. Mapping & pipeline §28 integration (D-113, D-114, D-116)

### 7.1 Topic mapping per messaggi inbound

**SSE (D-114 + §3.7):**

```
event: weather.update     → BrokerEvent.topic = 'weather.update'
data: {"city":"Roma"}      → BrokerEvent.payload = JSON.parse(data)
id: evt-123                → BrokerEvent.id = 'evt-123' (override D-106 id)
```

**WebSocket envelope (D-106 lock):**

```json
{
  "topic": "weather.update",
  "data": {"city": "Roma"},
  "id": "evt-123"
}
```

→ `BrokerEvent { topic: 'weather.update', payload: data, id: 'evt-123' }`.

**Validation envelope WS via Valibot (riuso F2 stack):**

```ts
import * as v from 'valibot'

const EnvelopeSchema = v.object({
  topic: v.pipe(v.string(), v.regex(/^[a-z0-9]+(\.[a-z0-9]+)*$/)),
  data: v.unknown(),
  id: v.optional(v.string()),
})

function parseFrame(raw: string): EnvelopeOk | EnvelopeError {
  let parsed: unknown
  try { parsed = JSON.parse(raw) }
  catch (e) { return { ok: false, code: 'realtime.frame.json-parse-failed', cause: e } }
  const result = v.safeParse(EnvelopeSchema, parsed)
  if (!result.success) return { ok: false, code: 'realtime.frame.envelope-invalid', issues: result.issues }
  return { ok: true, envelope: result.output }
}
```

**Confidence: HIGH** — pattern Valibot già consolidato F2/F3.

### 7.2 BrokerEvent.id override — gestione conflict nanoid vs envelope.id

**Conflict potenziale:** F1 D-21 dice `id` generato dal broker via `nanoid` se assente. D-106 dice `envelope.id?` opzionale dal server, se presente diventa `BrokerEvent.id`.

**Decisione raccomandata F4 (Claude's discretion):**

```ts
const event: BrokerEvent = {
  id: envelope.id ?? nanoid(),  // server id wins, fallback nanoid
  topic: envelope.topic,
  source: { type: 'server', id: 'realtime-channel', name: 'sse' | 'websocket' },
  payload: envelope.data,
  timestamp: Date.now(),  // F1 D-22 fallback
}
broker.publish(event)
```

**Caveat:** se due envelope hanno `id` identico, F1 dedupe (D-37 cf. CORE-06) può collassare. Documentare in DOC-04 server contract: "id deve essere unique per channel".

**Confidence: HIGH** — semantica chiara.

### 7.3 Topic→canonicalSchemaId resolution (D-114, riuso F3 D-100)

**F3 D-100 pattern (già implementato):** primo segmento topic = `entity` = `canonicalSchemaId`.

```ts
// 'weather.update' → schemaId = 'weather'
function resolveCanonicalSchemaId(topic: string): string {
  return topic.split('.')[0]
}
```

**F4 reuses identico via composition:**

Il `RealtimeBroker.publish(event)` delega a `RouterBroker.publish(event)` (composition D-101). `RouterBroker` già gestisce topic→schemaId resolution + mapper invocation + validation (F3 D-114). Quindi F4 NON deve replicare la logica — semplicemente accodare `event.publish` al `RouterBroker` come fosse esterno.

**Edge case namespaced topic:** `tenant.weather.update` → schemaId = `tenant`? Probabilmente NON è quello che vuole il consumer. F3 ha già documentato che la convenzione è opt-in via `canonicalSchema.id` esplicito. F4 non aggiunge logica nuova.

**Confidence: HIGH** — riuso F3 pattern, nessuna nuova logica.

### 7.4 Validation step §28 4/5/6 invariata (D-116)

VAL-03 (canonical) e VAL-04 (post-mapping) si applicano automaticamente attraverso il `RouterBroker` sottostante. F4 non aggiunge validation logic — solo usa il pipeline esistente.

**On validation fail:** `<topic>.failed` viene pubblicato (riuso F3 D-78), evento NON consegnato (F2 D-44 default `'block'`). Documentato in DOC-04.

**Edge case:** schema canonical NON registrato. F3 D-67/D-100 ha lock `requiresRoute: false` default → evento pubblicato come raw payload, NESSUN validation forzata. F4 eredita questo behavior senza modifiche.

---

## 8. Cascade cleanup F4 ext (D-112)

### 8.1 Owner-based registry pattern (estensione D-26 di F1, D-86 di F3)

**State F4:**

```ts
interface PluginRegistration {
  // ... F1 fields (subscriptions, abortController)
  // F3 added: routes
  // F4 adds:
  realtimeChannels: Set<RealtimeChannelHandle>  // <-- NEW
}

interface RealtimeChannelHandle {
  readonly name: string
  readonly mode: 'sse' | 'ws'
  readonly abort: () => void  // close + cleanup
}
```

**`unregisterPlugin(pluginId)` cascade:**

1. F1: `bus.unsubscribeByOwner(pluginId)` — rimuove subscriptions.
2. F1: `abortController.abort()` — fires `ctx.signal`, plugin handlers reagiscono.
3. F3: per ogni `route in registration.routes`: `routeResolver.unregister(routeId)`.
4. **F4 NEW:** per ogni `channel in registration.realtimeChannels`: `channel.abort()` chiude EventSource/WebSocket + ferma reconnect timer + publish `system.realtime.disconnected`.
5. F1: `onUnmount` async hook.
6. F1: `onDestroy` sync hook.

**Visibility listener cleanup:**

```ts
class RealtimeChannelManager {
  private channelCount = 0
  private visibilityDetector: VisibilityDetector | null = null

  connect(channel: RealtimeChannel): void {
    if (this.channelCount === 0) {
      this.visibilityDetector = createVisibilityDetector()
      this.visibilityDetector.attach()
    }
    this.channelCount += 1
    // ...
  }

  disconnect(name: string): void {
    // ... close channel
    this.channelCount -= 1
    if (this.channelCount === 0 && this.visibilityDetector) {
      this.visibilityDetector.detach()
      this.visibilityDetector = null
    }
  }
}
```

**Test deterministico cascade (TEST-01 ext F4):**

```ts
test('cascade cleanup: 5 plugin con realtimeChannels, unregisterPlugin di 1 → solo i suoi canali chiusi', () => {
  // Setup 5 plugin, ognuno con 1 realtimeChannel
  // unregisterPlugin('plugin-3')
  // assert: channels di plugin-1/2/4/5 ancora connessi
  // assert: channel di plugin-3 chiuso, system.realtime.disconnected pubblicato
})
```

### 8.2 AbortSignal propagation — workaround per API native

**Problema:** `EventSource` e `WebSocket` constructor NON accettano `AbortSignal`. **Workaround:** listener su `signal.abort` chiude la connessione.

```ts
function createSseChannel(def: RealtimeChannelDef, ctx: { signal: AbortSignal }): RealtimeChannelHandle {
  const adapter = new SseAdapter(def)
  ctx.signal.addEventListener('abort', () => {
    adapter.close()
  }, { once: true })  // important: { once: true } evita memory leak

  return {
    name: def.name,
    mode: 'sse',
    abort: () => adapter.close(),
  }
}
```

**Pattern consolidato (riuso F3 D-76):** identico a quanto fatto per HTTP routes.

**Confidence: HIGH** — pattern già testato in F3.

---

## 9. Test strategy 3-tier (D-117, D-118, D-119)

### 9.1 Tier 1: Vitest + jsdom (unit, deterministico)

**Cosa testa:**
- Frame parser (`frame-parser.ts`): JSON parse, envelope validation, error cases.
- Reconnect math (`reconnect-strategy.ts`): full jitter formula, cycle cap state machine, scheme switch.
- Topic resolution: `event:` field SSE → BrokerEvent.topic.
- Cascade cleanup logic (con mock channels).
- Visibility state machine (con DI mock detector).

**Stack:** Vitest 4.1.5 + jsdom 29.1.0 (già installato in `@sembridge/gateway`).

**Mocking strategy per EventSource/WebSocket in unit:**

```ts
// test-utils/mock-event-source.ts
class MockEventSource extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSED = 2
  readyState = 0; url: string; withCredentials: boolean
  constructor(url: string, init?: { withCredentials?: boolean }) {
    super()
    this.url = url
    this.withCredentials = init?.withCredentials ?? false
  }
  close() { this.readyState = 2 }
  // Test helpers:
  __open() { this.readyState = 1; this.dispatchEvent(new Event('open')) }
  __message(eventType: string, data: string, id?: string) {
    const ev = new MessageEvent(eventType, { data, lastEventId: id ?? '' })
    this.dispatchEvent(ev)
  }
  __error() { this.readyState = 2; this.dispatchEvent(new Event('error')) }
}
```

**Time control:** `vi.useFakeTimers()` per testare backoff senza waiting reali.

**Coverage target:** ≥90% statements, ≥80% branches sui file `packages/gateway/src/sse-ws/` (riuso F3 D-92 setup).

### 9.2 Tier 2: MSW 2.14.2 (integration, semi-real)

**Cosa testa:**
- SSE end-to-end: connessione → ricezione N messaggi → server reboot simulato → reconnect con `lastEventId` query → ricezione M messaggi mancati.
- WS handshake + envelope JSON parsing → publish broker.

**MSW 2.x SSE support:**

Dal 2024 MSW supporta nativamente SSE handler:

```ts
import { http, HttpResponse } from 'msw'

http.get('/events', () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode('event: weather.update\ndata: {"city":"Roma"}\nid: evt-1\n\n'))
      // server reboot scenario: close stream after delay
      setTimeout(() => controller.close(), 100)
    }
  })
  return new HttpResponse(stream, {
    headers: { 'Content-Type': 'text/event-stream' }
  })
})
```

**MSW 2.x WebSocket support (`http.ws` API):**

```ts
import { ws } from 'msw'

const realtime = ws.link('wss://api.example.com/events')

realtime.addEventListener('connection', ({ client }) => {
  client.send(JSON.stringify({ topic: 'weather.update', data: {city: 'Roma'} }))
  // Force disconnect:
  setTimeout(() => client.close(1006, 'simulated abnormal'), 100)
})
```

**Verification step:** prima di scrivere il primo plan integration, planner deve verificare `msw` 2.14.2 supporta `ws.link()`. Documentation https://mswjs.io/docs/api/ws confirma `ws` API stable da MSW 2.5+.

**Confidence: HIGH** — verified via MSW changelog + npm registry version.

### 9.3 Tier 3: `@vitest/browser` + Playwright (browser-real)

**Cosa testa (D-119 6 scenari obbligatori):**

1. **SSE reconnect con Last-Event-ID** — server stop, restart, replay verificato. Server test: Express + EventEmitter, run su porta dedicata in test.
2. **WS ping/pong stale detection** — server smette di rispondere a `__pong__`, client rileva → reconnect.
3. **Auto-fallback SSE→WS** — server SSE 503 ripetuto, client switcha a WS, success.
4. **Visibility hidden→visible** — Playwright `page.bringToFront()` / `setVisibility('hidden')` per simulare; verificare freshness check + reconnect immediato.
5. **Cascade cleanup** — 5 plugin, unregister di 1, verificare `getDebugSnapshot().realtimeChannels.length` decremento corretto.
6. **Backpressure storm** — 10K eventi/sec via test server, verificare `'queue-bounded'` drop applicata + `priority: 'critical'` passa sempre (pitfall #4).

**Stack setup browser test:**

```ts
// vitest.workspace.ts (già esiste — F3 ha browser config?)
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // ... existing configs
  {
    test: {
      name: 'sembridge-gateway-browser',
      include: ['packages/gateway/src/sse-ws/**/*.browser.test.ts'],
      browser: {
        enabled: true,
        provider: 'playwright',
        instances: [{ browser: 'chromium' }],
        headless: true,
      },
    },
  },
])
```

**Cross-browser testing:** PRD §31.3 dice "browser evergreen". F4 V1 raccomanda Chromium-only per CI (cost vs benefit). Firefox/WebKit testati manualmente prima del release. Documentare in DOC-04 + commit message.

**Confidence: MEDIUM-HIGH** — `@vitest/browser` ha avuto stabilization in 2.x; 4.x molto solid ma alcuni edge case (WebSocket via Playwright) richiedono setup attento.

### 9.4 Test infrastructure required (Wave 0 setup)

**Files per planner (Wave 0 plan):**

1. `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts` — MockEventSource class.
2. `packages/gateway/src/sse-ws/test-utils/mock-websocket.ts` — MockWebSocket class.
3. `packages/gateway/src/sse-ws/test-utils/sse-server.ts` — Express test server SSE per browser test.
4. `packages/gateway/src/sse-ws/test-utils/ws-server.ts` — `ws` (npm `ws` package) test server WS.
5. `packages/gateway/src/sse-ws/test-utils/realtime-harness.ts` — fixture `createRealtimeHarness()` analogo a `createRouterHarness` di F3.

**Test framework dependencies:**

| Pacchetto | Required by | Already installed? |
|-----------|------------|--------------------|
| `vitest` 4.1.5 | unit + jsdom | ✅ in `@sembridge/gateway` devDeps |
| `jsdom` 29.1.0 | unit dom | ✅ in `@sembridge/gateway` devDeps |
| `msw` 2.14.2 | integration SSE/WS mock | ⚠️ workspace devDep (verificare) |
| `@vitest/browser` 4.1.5 | browser-real | ⚠️ workspace devDep (verificare) |
| `playwright` 1.59.1 | browser provider | ⚠️ workspace devDep (verificare) |
| `ws` (npm) | test server WS | ❌ NEW devDep da aggiungere |
| `express` (npm) | test server SSE | ❌ NEW devDep da aggiungere (oppure http nativo Node) |

> **Setup task obbligatorio (Wave 0):** verificare/installare i pacchetti, aggiornare `pnpm-workspace.yaml` se serve, aggiornare `vitest.workspace.ts` con browser config.

---

## 10. Plan decomposition proposta (9 plan, 5-6 wave)

### 10.1 Decomposition raccomandata

| Plan | Nome | File ownership | Wave | Depends |
|------|------|---------------|------|---------|
| **04-01** | Bootstrap `@sembridge/gateway/sse-ws/` + types + augment | `sse-ws/index.ts`, `sse-ws/augment.ts`, `sse-ws/types/realtime-config.ts`, `sse-ws/types/realtime-channel-def.ts`, `sse-ws/types/index.ts`, package.json updates (subpath export `./sse-ws`), tsup.config.ts updates | W1 | F3 complete |
| **04-02** | `frame-parser.ts` + envelope Valibot schema (puro) | `sse-ws/frame-parser.ts` + `.test.ts` | W2 | 04-01 |
| **04-03** | `reconnect-strategy.ts` (full jitter math + state machine D-107) | `sse-ws/reconnect-strategy.ts` + `.test.ts` | W2 (parallel a 04-02) | 04-01 |
| **04-04** | `visibility-detector.ts` + DI guard | `sse-ws/visibility-detector.ts` + `.test.ts` | W2 (parallel) | 04-01 |
| **04-05** | `sse-adapter.ts` (uses 04-02 + 04-03 + 04-04) | `sse-ws/sse-adapter.ts` + `.test.ts`, `sse-ws/test-utils/mock-event-source.ts`, `sse-ws/test-utils/sse-server.ts` | W3 | 04-02, 04-03, 04-04 |
| **04-06** | `websocket-adapter.ts` (uses 04-02 + 04-03 + 04-04) + ping/pong | `sse-ws/websocket-adapter.ts` + `.test.ts`, `sse-ws/test-utils/mock-websocket.ts`, `sse-ws/test-utils/ws-server.ts` | W3 (parallel a 04-05) | 04-02, 04-03, 04-04 |
| **04-07** | `realtime-channel-manager.ts` + cascade cleanup D-112 | `sse-ws/realtime-channel-manager.ts` + `.test.ts` | W4 | 04-05, 04-06 |
| **04-08** | `realtime-broker.ts` composition wrapper + `createRealtimeBroker(config)` factory | `sse-ws/realtime-broker.ts` + `.test.ts`, `sse-ws/public-factory.ts` + `.test.ts`, `sse-ws/test-utils/realtime-harness.ts`, integration test 6 scenari D-119 in `sse-ws/__integration__/` | W5 | 04-07 |
| **04-09** | Final gate F4: lint + typecheck + build + test + coverage v8 ≥90% + REQ matrix + DOC-04 ext + smoke cross-package + ROADMAP/STATE update | README updates `@sembridge/gateway/sse-ws/README.md` (italiano), JSDoc public API, CI gates ext, ROADMAP.md, STATE.md, REQUIREMENTS.md flip | W6 | 04-08 |

**Wave-based parallelization (D-117 carryover F3 pattern):**

- W1: 04-01 standalone (bootstrap).
- W2: 04-02 ∥ 04-03 ∥ 04-04 (3 plan paralleli, file ownership disgiunta).
- W3: 04-05 ∥ 04-06 (2 plan paralleli).
- W4: 04-07 standalone.
- W5: 04-08 standalone.
- W6: 04-09 standalone (final gate).

**Stima:** 6 wave, ~3 day di execution con parallelization piena (analogo F3 9 wave / 14 plan = ~5 day).

### 10.2 Alternative considerate

**Option B (più granulare, 11 plan):** separare `realtime-channel-manager.ts` in (a) base manager (b) cascade cleanup integration. RIGETTATA: la cascade cleanup è inerente al manager, separarla crea coupling test artificiale.

**Option C (più aggregato, 6 plan):** unire 04-02+04-03+04-04 in un singolo plan "primitives". RIGETTATA: file ownership conflitto, blocca parallelization.

**Decisione finale:** 9 plan in 6 wave (Option A — raccomandata).

### 10.3 File ownership matrix (per plan-checker validation)

```
sse-ws/
├── index.ts                         # 04-01 (create) → 04-08 (extend re-exports)
├── augment.ts                       # 04-01 (create, frozen)
├── types/
│   ├── index.ts                     # 04-01 (create) → 04-08 (re-exports)
│   ├── realtime-config.ts           # 04-01
│   ├── realtime-channel-def.ts      # 04-01
│   └── frame-envelope.ts            # 04-02
├── frame-parser.ts                  # 04-02
├── frame-parser.test.ts             # 04-02
├── reconnect-strategy.ts            # 04-03
├── reconnect-strategy.test.ts       # 04-03
├── visibility-detector.ts           # 04-04
├── visibility-detector.test.ts      # 04-04
├── sse-adapter.ts                   # 04-05
├── sse-adapter.test.ts              # 04-05
├── websocket-adapter.ts             # 04-06
├── websocket-adapter.test.ts        # 04-06
├── realtime-channel-manager.ts      # 04-07
├── realtime-channel-manager.test.ts # 04-07
├── realtime-broker.ts               # 04-08
├── realtime-broker.test.ts          # 04-08
├── public-factory.ts                # 04-08
├── public-factory.test.ts           # 04-08
├── test-utils/
│   ├── mock-event-source.ts         # 04-05
│   ├── mock-websocket.ts            # 04-06
│   ├── sse-server.ts                # 04-05
│   ├── ws-server.ts                 # 04-06
│   └── realtime-harness.ts          # 04-08
├── __integration__/
│   ├── sse-reconnect.test.ts        # 04-08
│   ├── ws-stale-detection.test.ts   # 04-08
│   ├── auto-fallback.test.ts        # 04-08
│   ├── visibility-aware.test.ts     # 04-08
│   ├── cascade-cleanup.test.ts      # 04-08
│   └── backpressure-storm.test.ts   # 04-08
└── README.md                        # 04-09 (italiano)
```

**Cross-file edits (per planner attenzione):**

- `packages/gateway/package.json` (subpath export `./sse-ws`, sideEffects ext): 04-01 only.
- `packages/gateway/tsup.config.ts` (entry sse-ws): 04-01 only.
- `packages/gateway/src/index.ts` (umbrella re-export ext): 04-01 (placeholder) → 04-08 (final).
- `.planning/REQUIREMENTS.md` (RT-01..RT-07 status flip): 04-09 only.
- `.planning/ROADMAP.md` Phase 4 progress: 04-09 only.
- `.planning/STATE.md`: 04-09 only.

### 10.4 Threshold defaults locked (from D-CONTEXT — Claude's discretion ratificato)

| Default | Value | Override | REQ |
|---------|-------|----------|-----|
| `reconnect.baseMs` | 1_000 | RT-05 | RT-05 |
| `reconnect.capMs` | 30_000 | RT-05 | RT-05 |
| `reconnect.consolidationMs` | 5_000 | RT-05 | new (Claude's discretion §6.2) |
| `reconnect.maxAttempts` | Infinity | RT-05 | RT-05 |
| `reconnect.fallbackThreshold` | 3 | D-107 | D-107 |
| `reconnect.globalCycleCap` | 5 | D-107 | D-107 |
| `heartbeat.intervalMs` (WS) | 30_000 | D-111 | D-111 |
| `heartbeat.staleTimeoutMs` (WS) | 60_000 | D-111 | D-111 |
| `heartbeat.staleTimeoutMs` (SSE) | 60_000 | new (Claude's discretion §3.6) | RT-05 |
| `visibility.toleranceMultiplier` | 3 | D-110 | D-110 |
| `backpressure.policy` | `'queue-bounded'` maxSize 1000 | D-115 | RT-05 |

---

## 11. Pitfalls & landmines (caveat documentati per DOC-04)

### 11.1 Pitfall A: server endpoint diverso SSE vs WS (D-108 confermato)

**Scenario:** server backend espone `/api/sse-events` per SSE e `/api/ws-events` per WS (path differenti). D-107 scheme switch cambia solo `http→ws`, il path resta uguale → fallback fallisce.

**Mitigation:** documentare in DOC-04 + raccomandare consumer `mode: 'sse'` esplicito se sicuri di solo-SSE.

**Future improvement (V1.x):** `RealtimeChannelDef.fallbackUrlMap?: { sse: string; ws: string }` per override path-aware.

### 11.2 Pitfall B: EventSource no custom headers — auth via query string (D-105)

**Scenario:** consumer vuole inviare `Authorization: Bearer <token>` su SSE. **Impossibile in V1** (PRD §31.3 vincolo). **Mitigation:** `buildUrl()` async (D-104) costruisce `https://api.example.com/events?token=<jwt>`. Caveat security: token in URL appare in proxy log, history.

**Best practice DOC-04:**
- Usare short-lived token (≤ 5 min TTL).
- Server deve invalidare token al disconnect (single-use).
- Cookie auth è preferibile dove possibile (same-origin).

### 11.3 Pitfall C: WS subprotocol vs `buildUrl()` per token

**Scenario:** server usa `Sec-WebSocket-Protocol: bearer.<jwt>` per auth. `buildUrl()` modifica solo URL — non protocols.

**Mitigation V1:** `RealtimeChannelDef.wsSubprotocols?: string | string[]` opt-in (Claude's discretion §4.7), passato a `new WebSocket(url, subprotocols)`. **NOT** lockato in D-CONTEXT — planner deve aggiungerlo.

### 11.4 Pitfall D: TLS termination + sticky sessions

**Scenario:** load balancer con sticky session muore, reconnect cade su pod diverso → sessione persa, auth potrebbe fallire.

**Mitigation:** `buildUrl()` async invocato a OGNI reconnect (D-104) permette token refresh tra tentativi (riuso F3 D-72 `gateway.auth.refresh`).

### 11.5 Pitfall E: Replay storm — 10K eventi su reconnect

**Scenario:** server tiene buffer eventi enorme; su reconnect SSE con `lastEventId`, manda 10K eventi → broker overload.

**Mitigation D-115:** BackpressureStrategy applicata adapter-level (PRIMA di publish).

```ts
// Pseudocodice realtime-channel.ts
async function onMessage(rawEvent) {
  const parsed = parseFrame(rawEvent)
  if (!parsed.ok) return  // discard
  await this.backpressure.schedule(this.name, parsed.event.priority, () => {
    return this.broker.publish(parsed.event)
  })
}
```

**Rate limit raccomandato:** `'queue-bounded'` maxSize 1000 (D-115 default) + `priority: 'critical'` bypass garantito.

### 11.6 Pitfall F: Browser tab freeze mobile

**Scenario:** Safari iOS background freeze, timer non scatta proprio. Client crede connesso, server timeout → drop server-side. Tab visible → freshness check → reconnect (D-110).

**Mitigation:** D-110 + documentare DOC-04 limitazione mobile.

### 11.7 Pitfall G: Topic prefix collision `__ping__`/`__pong__`

**Scenario:** consumer ha topic legittimo `weather.__ping__` (creativo).

**Mitigation:** D-111 lock `__` prefix riservato. F4 filtro adapter-level matcha SOLO `__ping__` e `__pong__` esatti (NON wildcard `__.*`). Topic `weather.__ping__` passa attraverso normalmente.

**Documentazione DOC-04:** "il prefix `__` è riservato per messaggi di sistema realtime adapter (ping/pong, heartbeat). Consumer dovrebbero evitare topic con questo prefix per chiarezza."

### 11.8 Pitfall H: WS close 1006 ambiguità

**Scenario:** code 1006 può significare (a) NAT timeout naturale, (b) firewall block, (c) server crash. Reconnect strategia uguale ma diagnosis diverso.

**Mitigation:** publish `system.realtime.disconnected` con `details: { code: 1006, reason: ev.reason ?? 'abnormal' }` per debug. Inspector F6 mostrerà aggregati.

### 11.9 Pitfall I: SSE retry-after server hint ignorato

**Scenario:** server invia `retry: 60000\n\n` (60s consigliato). D-109 full jitter ignora questa direttiva → inefficienza.

**Mitigation V1:** documentare come limitazione. F4 V1.x può aggiungere `respectServerRetryHint: boolean` opt-in (Claude's discretion deferred).

---

## 12. Risk register

| # | Risk | Probability | Impact | Mitigation | Owner |
|---|------|-------------|--------|------------|-------|
| R1 | MSW 2.14.2 SSE/WS support quirks su Node 20 | LOW | MEDIUM | Verifica empirica in 04-08 setup; fallback a custom HTTP test server | planner |
| R2 | `@vitest/browser` + Playwright Chromium 1.59.1 instabilità WebSocket | LOW-MEDIUM | MEDIUM | Browser-real test smoke prima di W3; fallback test in jsdom + MSW puro | planner |
| R3 | Visibility API throttling Chrome > 5min `intensive throttling` rompe scenarios test | LOW | LOW | Test scenari con `vi.useFakeTimers()` skip-time; documentare limitazione real-world | 04-04 |
| R4 | Auto-fallback D-107 cycle cap 5 troppo stretto in production (legitimate flap) | MEDIUM | MEDIUM | Default lock; consumer override via `RealtimeChannelDef.reconnect.globalCycleCap` | 04-09 |
| R5 | `EventSource.lastEventId` non univocamente affidabile cross-browser (edge case Firefox vecchio) | LOW | LOW | Memorizzazione manuale (§3.2 pattern); test browser-real | 04-05 |
| R6 | WS `__ping__`/`__pong__` topic collide con consumer | LOW | LOW | D-111 prefix `__` riservato + DOC-04 doc | 04-09 |
| R7 | bufferedAmount monitor manca → ping flood durante disconnect transient | LOW | LOW | §4.4 cap bufferedAmount < 64KB | 04-06 |
| R8 | D-112 cascade cleanup dimentica edge case (es. plugin unregister durante reconnect attempt) | MEDIUM | HIGH | Test deterministico TEST-01 ext F4 con timing artificiale; review checker plan 04-07 | 04-07 |
| R9 | Coverage v8 ≥90% non raggiungibile su `websocket-adapter.ts` (close codes branch) | LOW | LOW | Test enumera tutti i codici critici; accept 87-90% se branches edge non testabili | 04-09 |
| R10 | Topic resolution `event:` field SSE manca → topic 'message' non routabile | LOW | LOW | §3.7 default behavior + DOC-04 server contract | 04-05 |

**Highest priority:** R8 (cascade cleanup edge case) — necessità di test deterministico con timing artificiale. Plan 04-07 deve dedicare almeno 3 test scenari TEST-01 ext.

---

## 13. Open questions per il planner

### 13.1 Aperte (richiedono decisione planner)

**Q1.** Topic prefix riservato F4: confermare `__` prefix (D-111) o esplorare namespace alternativo `$$realtime.ping`?
- **Decisione raccomandata:** mantenere `__` per coerenza F4 (D-111 lockato). Se collision rilevata in production V1.x, refactor con migration helper.

**Q2.** Frame parsing error: `network.error` (riuso F3) vs nuovo `realtime.protocol.error`?
- **Decisione raccomandata:** **`network.error` con `category: 'protocol'`** (Claude's discretion D-CONTEXT). Riuso F3 evita proliferation di error categories. Documentare DOC-04.
- Alternative: `realtime.protocol.error` standalone per granularità Inspector F6 più fine. NOT lockato — planner può scegliere.

**Q3.** Reset `attempt` post-reconnect: opzione A (after first message) vs B (after 5s OPEN) vs C (immediate)?
- **Decisione raccomandata:** **B con default 5_000ms** (§6.2). Configurabile via `reconnect.consolidationMs`.

**Q4.** WS subprotocol opt-in per auth handshake (Pitfall C §11.3)?
- **Decisione raccomandata:** aggiungere `RealtimeChannelDef.wsSubprotocols?: string | string[]` come passthrough opt-in. NOT lockato — planner può escluderlo da V1 e deferred a V1.x.

**Q5.** SSE staleTimeoutMs default = 60s (uguale WS) o più alto (es. 90s — comment lines + tolerance)?
- **Decisione raccomandata:** 60_000 ms uniforme con WS (semplicità + coerenza). Documentare DOC-04 server contract: server invia `event: __heartbeat__` periodico (es. 25s) per refresh `lastEventReceivedAt`.

**Q6.** Test browser provider: Chromium-only o Chromium+Firefox+WebKit?
- **Decisione raccomandata:** Chromium-only per CI (cost vs benefit). Manual smoke test Firefox+WebKit prima del release. Documentare in DOC-04.

### 13.2 Chiuse (lockate da CONTEXT.md o ricerca)

- ✅ Composition wrapper pattern (D-101)
- ✅ Multi-channel topology (D-102)
- ✅ PluginDescriptor.realtimeChannels via declaration merging (D-103)
- ✅ buildUrl async hook auth-agnostic (D-104)
- ✅ NO custom headers SSE V1 (D-105)
- ✅ Envelope JSON `{topic, data, id?}` WS (D-106)
- ✅ Auto-fallback default abilitato (D-107) + 3 fail threshold + 5 cycle cap
- ✅ Reconnect full jitter cap 30s (D-109)
- ✅ Visibility integration tolerance ×3 (D-110)
- ✅ WS ping/pong app-level `__ping__`/`__pong__` (D-111)
- ✅ Cascade cleanup F4 ext (D-112)
- ✅ Pipeline §28 step 1 ingress (D-113)
- ✅ Mapper server→canonical riusato (D-114, F3 D-97)
- ✅ BackpressureStrategy riusata adapter-level (D-115, F3 D-75)
- ✅ Validation post-mapping invariata (D-116, F2 D-44)
- ✅ TDD RED→GREEN + coverage v8 ≥90% (D-117, F3 D-92)
- ✅ Test 3-tier (D-118)
- ✅ 6 scenari obbligatori (D-119)
- ✅ Final gate F4 plan dedicato (D-120, analogo 03-14/02-12/01-11)

---

## 14. Verification checklist (pre-planning)

Prima che il planner inizi a scrivere PLAN.md per 04-01, eseguire:

- [ ] Verificare versioni live: `npm view msw version`, `npm view @vitest/browser version`, `npm view playwright version`
- [ ] Verificare `pnpm ls @vitest/browser playwright -w` — se mancano, install richiesto in 04-01
- [ ] Verificare `packages/gateway/src/index.ts` linea 5: subpath `./sse-ws` placeholder presente ✓ (verified)
- [ ] Verificare `packages/core/src/types/plugin.ts` linea 50, 82 placeholder ✓ (verified)
- [ ] Verificare `packages/core/src/types/broker-event.ts` linea 22-26 `EventSource.type` accetta `'server'` ✓ (verified)
- [ ] Verificare F3 export pubblici disponibili: `BackpressureStrategy`, `gateway.auth`, `BrokerError`, `RouterBroker`, mapper composition ✓ (verified per BackpressureStrategy in `packages/gateway/src/http/strategies/backpressure-strategy.ts`)
- [ ] Verificare `vitest.workspace.ts` esiste e ha browser config (necessario per browser-real test)
- [ ] Confermare con utente: Q1-Q6 in §13.1 (oppure planner decide su raccomandazioni come Claude's discretion)

---

## 15. Sources

### Primary (HIGH confidence)
- **WHATWG HTML Living Standard §9.2 Server-Sent Events** — https://html.spec.whatwg.org/multipage/server-sent-events.html (EventSource API, Last-Event-ID, retry semantics)
- **WHATWG HTML Living Standard §9.7 Web Sockets** — https://html.spec.whatwg.org/multipage/web-sockets.html (WebSocket API, close codes references)
- **RFC 6455 The WebSocket Protocol** — https://datatracker.ietf.org/doc/html/rfc6455 (close codes 1000-1015 §7.4)
- **W3C Page Visibility API L2** — https://www.w3.org/TR/page-visibility/ (visibilityState, visibilitychange event)
- **MDN: EventSource** — https://developer.mozilla.org/en-US/docs/Web/API/EventSource (lastEventId property, withCredentials, readyState)
- **MDN: WebSocket** — https://developer.mozilla.org/en-US/docs/Web/API/WebSocket (bufferedAmount, close codes, binaryType)
- **MDN: Page Visibility API** — https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- **AWS Architecture Blog "Exponential Backoff and Jitter" (Marc Brooker, 2015)** — https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/ (full jitter formula)
- **prd.md** §11 (BrokerEvent), §16.2 (API connectRealtime/disconnectRealtime), §18 (Gateway server), §22.3 (Eventi standard errore), §28 (Pipeline 14 step), §31.3 (no polyfill), §35 (Test), §39 #9 (RT-07 closure)
- **04-CONTEXT.md** D-101..D-120 lockate
- **03-CONTEXT.md** D-72/75/78/83/86/97/100 carryover
- Verifica live npm registry 2026-05-04: nanoid 5.1.11, valibot 1.3.1, msw 2.14.2, vitest 4.1.5, @vitest/browser 4.1.5, playwright 1.59.1

### Secondary (MEDIUM confidence)
- **MSW 2.x SSE/WS handler docs** — https://mswjs.io/docs/api/ws (verificato API stable da MSW 2.5+)
- **Chrome Platform Status: Intensive Throttling** — Chrome 88+ background tab timer throttling
- **`partysocket` source code** (PartyKit) — pattern di reference per WS reconnection e ping/pong applicativo, NON usato come dependency

### Tertiary (LOW confidence — non usate per claim load-bearing)
- Industry blog posts su EventSource quirks (MDN content cross-verified)
- Mobile browser visibility behavior — empirical, varies device-per-device

### Codebase scaffolding (verified via Read tool)
- `packages/gateway/src/index.ts` — subpath `./sse-ws` placeholder
- `packages/gateway/src/augment.ts` — pattern declaration merging F3 (replicato in 04-01 per F4)
- `packages/gateway/src/http/strategies/backpressure-strategy.ts` — `BackpressureStrategy` interface + `createBackpressureStrategy` factory + priority-aware bypass
- `packages/routing/src/router-broker-wrapper.ts` — composition wrapper RouterBroker (base per RealtimeBroker D-101)
- `packages/core/src/types/plugin.ts` — `PluginDescriptor` interface + `// F4 will add: realtimeChannels` placeholder linea 50
- `packages/core/src/types/broker-event.ts` — `EventSource.type` union già include `'server'` linea 22
- `packages/gateway/package.json` — pattern `sideEffects` array per augment file preservation (replicato in 04-01)

---

## 16. Metadata

**Confidence breakdown:**
- Stack & versions: **HIGH** — verificato live npm registry 2026-05-04
- EventSource semantics: **HIGH** — WHATWG spec + MDN + cross-verified
- WebSocket semantics: **HIGH** — RFC 6455 + WHATWG + MDN
- Visibility API integration: **MEDIUM-HIGH** — spec stabile, ma mobile behavior empirically varied
- Reconnection algoritmica: **HIGH** — formula AWS reference + state machine deterministica
- Mapping/pipeline integration: **HIGH** — riuso F3 pattern testato (RouterBroker working)
- Cascade cleanup: **HIGH** — pattern F1 D-26 + F3 D-86 esteso
- Test strategy 3-tier: **MEDIUM-HIGH** — MSW SSE/WS support stable da MSW 2.5+, browser-real instabilità minima Chromium
- Plan decomposition: **HIGH** — analogo F3 14 plan / F2 12 plan, file ownership disgiunta verificata

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (30 giorni — dominio stabile, browser API non cambiano frequently). Re-verificare versioni live (`npm view`) prima di execution se trascorrono > 7 giorni.

**Effort stimato execution F4:** ~3 giorni (6 wave, 9 plan) con parallelization piena (analogo F3 ~5 giorni / 14 plan).

**Aspetto cross-cutting da NON dimenticare nel planning:**
- Step §28 ingress (D-113) — il `RealtimeChannel` invoca `broker.publish(event)` che attraversa pipeline esistente. NESSUNA logica nuova nel pipeline core. F4 è pura ingress estension.
- LIFE-02 ext F4 (D-112) — cascade cleanup verificato deterministico via `getDebugSnapshot()` post-unregister.
- ERR-02 ext F4 (D-109) — 3 nuovi eventi standard `system.realtime.disconnected/reconnecting/connected`. Documentare in DOC-04.

---

## RESEARCH COMPLETE
