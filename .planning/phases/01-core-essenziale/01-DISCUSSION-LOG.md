# Phase 1: Core essenziale - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 01-core-essenziale
**Areas discussed:** Delivery mode, Payload safety, Wildcard impl, Log adapter

---

## Delivery mode

**Question:** Default `deliveryMode` per gli eventi locali in F1 (PRD §11.1 lo dichiara come campo ma non specifica il default)?

| Option | Description | Selected |
|--------|-------------|----------|
| async (Recommended) | Microtask queue (`queueMicrotask`). Pro: no re-entrancy hazard, ordering FIFO garantito, handler che pubblicano eventi non causano stack overflow. Contro: latenza minima rispetto a sync. Allineato a Pitfall #2 (race condition handler che ri-pubblica). | ✓ |
| sync | Consegna immediata ai subscriber nello stesso microtask. Pro: massima latenza zero, debug stack-trace lineare. Contro: re-entrancy se handler ri-pubblica stesso topic, possibile stack overflow su catene profonde. | |
| Configurabile per topic | Default async ma override per-topic (es. `system.error` sync per fail-fast). Più flessibile ma aumenta complessità API in F1. | |

**User's choice:** async (Recommended)
**Notes:** Si adotta `async` come default per garantire ordering FIFO e prevenire re-entrancy. Override `sync` resta disponibile per opt-in esplicito (es. `system.error`).

---

## Payload safety

**Question:** Strategia di safety del payload tra publisher e subscriber (Pitfall #11 lo flagga come blocking)?

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-freeze runtime (Recommended) | `Object.freeze` ricorsivo del payload prima della consegna in dev mode; in production opzionalmente skippato per performance. Pro: garanzia immutabilità senza copia. Contro: freeze ricorsivo costa ~O(n) campi una volta; mutazioni profonde silently ignorate (in dev throw). | ✓ |
| Branded immutable types (TS only) | Solo type-level `Readonly<T>` deep, no runtime check. Zero overhead ma subscribers che usano `as any` possono mutare comunque (typescript-only contract). | |
| structuredClone all'ingresso | Clone del payload per ogni publish. Pro: isolamento totale tra publisher e subscriber. Contro: O(n) per ogni evento, può essere proibitivo per payload grandi (Worker già paga questo costo, qui è in-page). | |

**User's choice:** Deep-freeze runtime (Recommended)
**Notes:** Si adotta deep-freeze runtime in dev mode + tipi `Readonly<T>` deep. In production il freeze è skippato per performance. `structuredClone` riservato al confine worker (F5).

---

## Wildcard impl

**Question:** Implementazione del wildcard subscribe (`weather.*`, `*.failed`)?

| Option | Description | Selected |
|--------|-------------|----------|
| Trie segmentato (Recommended) | Struttura ad albero per segmento dot-separated, lookup `O(segments)` indipendente dal numero di pattern. Match wildcard `*` come ramificazione. Pro: scala fino a migliaia di subscriber. Contro: ~150 LOC in più rispetto a linear scan. Allineato a Pitfall #16. | ✓ |
| Linear scan in V1, ottimizza dopo | Lista piatta di pattern, scan O(n) per ogni publish. Pro: implementazione triviale (~30 LOC). Contro: degrada con n>100 subscriber wildcard. Ottimizzare quando i bench lo richiedono. | |
| RegExp pre-compilato | Conversione pattern → RegExp al subscribe, match per ogni publish. Pro: usa engine browser ottimizzato. Contro: overhead per regex con tante alternative; `*` deve essere escapato correttamente. | |

**User's choice:** Trie segmentato (Recommended)
**Notes:** Si adotta trie segmentato per scalabilità. Solo `*` single-segment in F1; `**` multi-segment deferred a V2.

---

## Log adapter

**Question:** Implementazione del logger nei 6 livelli `silent..trace`?

| Option | Description | Selected |
|--------|-------------|----------|
| Console-based + adapter slot (Recommended) | Default `console.{error,warn,info,debug,trace}` con namespace `[sembridge]`. API `setLogger(customLogger)` per swap (pino, winston, custom). Pro: zero dipendenze in core, swap facile. Contro: nessuno significativo per V1. | ✓ |
| Solo console, no adapter | Solo `console.*` hardcoded. Più semplice ma blocca integrazione con backend telemetry future. | |
| Structured JSON di default | Output sempre JSON (`{level, ts, namespace, msg, ...meta}`) verso console. Più leggibile da log aggregator (DataDog, New Relic) ma meno DX in browser devtools. | |

**User's choice:** Console-based + adapter slot (Recommended)
**Notes:** Default console-based con namespace. `setLogger(customLogger)` come slot per swap futuro a pino/winston/custom backend.

---

## Claude's Discretion

Le seguenti aree sono state risolte autonomamente da Claude basandosi su PRD + research, senza richiesta esplicita all'utente, in coerenza con la regola "minimizzare le interazioni":

- Sub-package layout monorepo (D-15) — confermati 7 package da `STACK.md`
- Plugin handler error isolation (D-16) — try/catch sync + Promise.catch async, no timeout default
- Plugin id collision (D-17) — throw su duplicate, da PRD §30.3
- Config validation timing (D-18) — fail-fast all'init di `createBroker`
- API surface (D-19) — factory imperativa + dichiarativa
- EventTap surface in F1 (D-20) — tap su step 1, 2, 3, 7-base, 13
- ID generation (D-21) — `nanoid()` 21 char URL-safe
- Timestamp generation (D-22) — `Date.now()`
- Source enforcement (D-23) — obbligatorio al publish
- Topic naming validation (D-24) — regex strict
- Lifecycle execution order (D-25) — register/mount/unmount/destroy
- Cascade cleanup ordering (D-26) — subscription → route → transform → AbortController
- Subscription handle shape (D-27) — oggetto idempotente
- DebugSnapshot shape per F1 (D-28)
- Debug toggle behavior (D-29)
- No singleton globale (D-30) — multi-istanza isolate

## Deferred Ideas

- Wildcard `**` multi-segment (deferred V1.x/V2)
- Service Worker registration helper (deferred post-V1, PRD §18.7)
- Topic schema validation (mappata a F2)
- Subscription `{ once: true }` (decisione rimandata al planning di F1)
- Backpressure (mappata a F3)
- Persistent log adapter (post-V1, estensione via `setLogger`)
