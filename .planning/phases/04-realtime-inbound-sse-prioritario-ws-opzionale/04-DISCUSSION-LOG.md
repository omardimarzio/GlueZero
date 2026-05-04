# Phase 4: Realtime inbound (SSE prioritario, WS opzionale) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 04-realtime-inbound-sse-prioritario-ws-opzionale
**Areas discussed:** Auth realtime, WS frame topic, Topology, SSE/WS fallback
**Mode:** discuss (default) + `--chain` (auto-advance to plan after)

---

## Auth realtime

| Option | Description | Selected |
|--------|-------------|----------|
| Cookie HttpOnly | Browser invia cookie automaticamente sia per SSE che WS. Default nativo, zero leak in log/Referer. Richiede same-origin o CORS con `credentials: 'include'`. Token refresh via endpoint server-side. | |
| Token in query string | URL = `${url}?token=${token}`. Lavora ovunque ma rischio leak (server logs, Referer, browser history). Refresh = disconnect + reconnect con nuovo token. | |
| Hybrid: query string + auth.refresh hook | Token in query string + integrazione con `gateway.auth.getToken/refresh` di F3 (D-72). Refresh trasparente: su 401/auth-fail event, chiama refresh hook e riconnette. | |
| Auth-agnostic: hook custom | `RealtimeChannelDef.buildUrl?: () => Promise<string>` chiamato prima di ogni connect/reconnect. Consumer decide auth (cookie, query, custom). Massima flessibilità, zero opinioni. | ✓ |

**User's choice:** Auth-agnostic: hook custom
**Notes:** Massima neutralità API. Documentation DOC-04 dovrà includere helper esempio per integrazione con `gateway.auth` di F3 (use case "voglio riutilizzare auth HTTP per realtime"). EventSource standard non supporta header custom (vincolo PRD §31.3) → cookie o query string sono le sole strategie possibili in V1, entrambe coperte dal `buildUrl` hook.

---

## WS frame topic

| Option | Description | Selected |
|--------|-------------|----------|
| Envelope JSON `{topic, data, id?}` | Convenzione: server invia `{ topic: 'weather.update', data: {...}, id?: 'seq-N' }`. Discriminator esplicito. Documentato in DOC-04. | ✓ |
| Custom parser per channel | `RealtimeChannelDef.parseFrame: (raw) => { topic, payload, id? }`. Consumer fornisce parser. Utile per protocolli legacy o JSON-RPC. | |
| Hybrid: envelope default + parser opt-in | Default = envelope; se `parseFrame` fornito, override. Best of both worlds, leggermente più API surface. | |

**User's choice:** Envelope JSON `{topic, data, id?}` (Recommended)
**Notes:** V1 lock su envelope standard. `parseFrame` opt-in deferred a V1.x (deferred ideas). Frame non-conformi → publish `network.error` + descarta. Topic interni `__ping__`/`__pong__` riservati per heartbeat WS (filtrati prima di publish).

---

## Topology

| Option | Description | Selected |
|--------|-------------|----------|
| RealtimeChannelManager con N canali per name | `connectRealtime({ name: 'main', mode: 'sse', url })` + `connectRealtime({ name: 'analytics', mode: 'ws', url })`. Manager indicizza per `name`. Ogni canale ha proprio reconnect state. | ✓ |
| Single-channel API (1 SSE + 1 WS max) | Una sola istanza SSE e una sola WS attive per Broker. Più semplice ma rigido per casi reali (multi-tenant). | |
| Multiplexing automatico per URL | Più chiamate stesso URL → condividono connessione fisica. Risparmia connessioni ma logica refcount + dedupe complessi. | |

**User's choice:** RealtimeChannelManager con N canali per name (Recommended)
**Notes:** Coerente con il pattern multi-policy di `gateway.allowlist[]` di F3 D-71. Multiplexing per URL identico deferred a V1.x se profiling mostra overhead.

---

## SSE/WS fallback

| Option | Description | Selected |
|--------|-------------|----------|
| No fallback automatico V1 | Consumer sceglie esplicitamente `mode`. Su fail ripetuto, pubblica `system.realtime.disconnected` ma NON cambia mode. Semplice, prevedibile. | |
| Auto-fallback opt-in via config | `connectRealtime({ mode: 'sse', fallback: 'websocket', fallbackAfter: 3 })`. Switch automatico opt-in. Più complesso. | |
| Auto-fallback default abilitato | Sempre attivo: SSE prova prima, WS fallback automatico. Massima resilienza ma assume server compatibile con entrambi protocolli. | ✓ |

**User's choice:** Auto-fallback default abilitato
**Notes:** Scelta esplicita contro caveat "raro in pratica". Mode esplicito (`'sse'` o `'websocket'`) disabilita il fallback per consumer che sanno di avere solo un protocollo. Cap globale 5 cicli SSE↔WS prima di stop permanente per evitare flapping infinito. Researcher dovrà validare reference pattern server con endpoint sdoppiati `/events` SSE+WS.

---

## Claude's Discretion

- Naming interno file (`sse-adapter.ts` vs `sse.ts` ecc.) — convenzione coerente con F3 (`http-gateway.ts`, `retry-strategy.ts`).
- Threshold default reconnect: `base: 1000ms`, `cap: 30_000ms`, `heartbeat: 30s`, `staleTimeout: 60s`, `fallbackThreshold: 3`, `globalCycleCap: 5`. Tutti override-abili (RT-05).
- Internal heartbeat topic namespace: `__ping__`/`__pong__` (escape via `__` prefix). Planner può proporre alternativa se collisione.
- Frame parsing error: `network.error` (riuso F3) preferito a nuovo `realtime.protocol.error`, salvo evidenze contrarie dal researcher.
- Test scenari TEST-01/02/03 obbligatori dettagliati in CONTEXT.md D-119 — il planner può aggiungerne, non rimuoverne.

## Deferred Ideas

- **Custom `parseFrame` per WS** → V1.x (protocolli legacy/JSON-RPC).
- **WebSocket gap recovery con sequence number app-level** → V1.x. V1 = best effort, replay solo via Last-Event-ID per SSE.
- **Service Worker / Push notification bridge** (RT2-01) → V2 (PRD §18.7).
- **Custom binary frame parser** WS → V1.x se richiesto.
- **Multiplexing automatico per URL identico** → V1.x se profiling lo giustifica.
- **Realtime outbound publish** (browser → server WS bidirezionale) → V2 (PRD §18 limita a inbound).
