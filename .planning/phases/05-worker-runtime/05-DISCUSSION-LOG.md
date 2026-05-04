# Phase 5: Worker Runtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 05-worker-runtime
**Areas discussed:** Worker source contract, Pool strategy default, Cancellation semantics, Progress events API, assertSerializable gating, Route worker policy inheritance, Worker module loading

---

## Worker source contract

### Q1.1 — Come deve fornire il consumer i worker al `WorkerRegistry`?

| Option | Description | Selected |
|--------|-------------|----------|
| Factory `() => Worker` (Recommended) | Controllo totale lato consumer su URL/ESM/import.meta.url; pattern Comlink-friendly; nessun assunto su bundler; lazy-construction. | ✓ |
| Worker instance pre-costruita | Più semplice ma perde lazy-init; non riusabile per pool. | |
| Mix factory + URL helper | Bundler-agnostic + DX migliore per consumer semplici. Più codice da mantenere. | |

**User's choice:** Factory `() => Worker`
**Notes:** Anti-singleton coerente con D-30 (F1). Lazy-construction al primo dispatch eviterà footprint inutile per route mai attivate.

### Q1.2 — Tasks dichiarate esplicite o trasparenti via Comlink wrap?

| Option | Description | Selected |
|--------|-------------|----------|
| Tasks dichiarate esplicite (Recommended) | `tasks: ['generateReport', 'parseCSV']` validato al `registerRoute`; throw `worker.task.unknown` al register, NON a runtime. Fail-fast. | ✓ |
| Trasparente via Comlink | Comlink ricava le tasks tramite proxy; errori solo a runtime. | |
| Optional dichiarazione | Se fornito → fail-fast, se omesso → trust runtime. Pattern non uniforme. | |

**User's choice:** Tasks dichiarate esplicite
**Notes:** DX migliore (typo tracciati al register). Coerente con cycle-detection F2 D-3 e validation F3 D-78.

### Q1.3 — Signature task lato worker?

| Option | Description | Selected |
|--------|-------------|----------|
| Comlink expose `{ taskName: async (args) => result }` (Recommended) | Standard Comlink 4.4.x; tipato via TS interface; auto-proxy su `wrap`. STACK.md già lockato. | |
| Single dispatcher `(taskName, args) => result` | Indipendente da Comlink (utile per swap a custom RPC futuro). Più manuale. | |
| Hybrid: Comlink + dispatcher fallback | Comlink primario + utility `createTaskDispatcher({ tasks })` opzionale. Più codice da mantenere ma flessibile. | ✓ |

**User's choice:** Hybrid: Comlink + dispatcher fallback
**Notes:** Offre due pattern paralleli — Comlink idiomatico (canale primario) + helper `createTaskDispatcher` per consumer che preferiscono uniformità. DOC-05 mostrerà entrambi nello scenario meteo F5.

### Q1.4 — API top-level + PluginDescriptor.workers o solo top-level?

| Option | Description | Selected |
|--------|-------------|----------|
| Entrambi: top-level + PluginDescriptor.workers (Recommended) | `broker.registerWorker` + `PluginDescriptor.workers` via declaration merging. Auto-register al `registerPlugin` con `ownerId=pluginId` per cascade. Coerente con `routes` F3 e `realtimeChannels` F4. | ✓ |
| Solo top-level | Più boilerplate per il consumer; cascade gestito a mano. | |
| Solo PluginDescriptor | Forza ownership esplicita ma rompe use case "global utility worker" + `system`. | |

**User's choice:** Entrambi
**Notes:** Pattern uniforme con D-94 (F3) / D-103 (F4) — declaration merging già consolidato.

---

## Pool strategy default

### Q2.1 — Strategia di pool default per ogni `WorkerDescriptor`?

| Option | Description | Selected |
|--------|-------------|----------|
| Pool bounded di default `min(hwc, 4)` (Recommended) | Throughput migliore out-of-the-box, allineato STACK.md. Opt-out via `mode: 'dedicated'` per worker stateful. | ✓ |
| Dedicated singleton di default | Più semplice/deterministico ma richiede opt-in pool per parallelismo. | |
| Auto: dedicated single + queue | Backpressure interno F3 D-75. Rinuncia al parallelismo finché non chiesto. | |

**User's choice:** Pool bounded `min(hardwareConcurrency, 4)` di default
**Notes:** PRD §19.3 supporta entrambi. Pool è "safer" in produzione per throughput.

### Q2.2 — Limite hard del pool size?

| Option | Description | Selected |
|--------|-------------|----------|
| Cap hard 8 + warning oltre default (Recommended) | Default `min(hwc, 4)`, hard cap 8. Oltre 8 richiede `allowUnboundedPool: true`. Pitfall 7.D protection. | ✓ |
| Configurabile senza cap hard | Più flessibile ma meno safe-by-default. | |
| Nessun cap, opt-in `unlimited` | Rischio Pitfall 7.D massimo. | |

**User's choice:** Cap hard 8 + warning
**Notes:** Anche `hardwareConcurrency=16` è cappato a 8 di default. `allowUnboundedPool: true` opt-in esplicito per chi sa cosa sta facendo.

### Q2.3 — Quando il pool è pieno, cosa succede al task in arrivo?

| Option | Description | Selected |
|--------|-------------|----------|
| Riuso F3 BackpressureStrategy (Recommended) | Riusa union F3 D-75 con `priority: 'critical'` bypass. Default `queue-bounded` con `maxSize: 1000`. | ✓ |
| Solo `queue-bounded` + drop oldest | V1 minimo, 1 sola policy da documentare. Meno flessibile. | |
| `latest-only` di default per worker UI-driven | Coerente con F3 ma sorprendente per worker batch. | |

**User's choice:** Riuso F3 BackpressureStrategy
**Notes:** Consistency cross-fase con F4 D-115. Critical bypass per `system.error`/`<topic>.failed` mantenuto.

### Q2.4 — Worker Pool lifecycle?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy first dispatch (Recommended) | Spawn on-demand; footprint zero se la route non viene mai attivata. Coerente con D-30. | ✓ |
| Eager all `size` al register | Latenza zero al primo task ma footprint immediato. | |
| Auto-scaling | Sofisticato, deferred V1.x (WK2-01 V2). | |

**User's choice:** Lazy first dispatch
**Notes:** Coerente con anti-singleton D-30 e con il principio "paghi solo quello che usi".

---

## Cancellation semantics

### Q3.1 — Su timeout/abort: terminate vs cooperative?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid per mode: dedicated→terminate, pool→cooperative (Recommended) | Dedicated → `worker.terminate()` immediato. Pool → `__cancel__` message + `cancelGraceMs=2000ms` + terminate fallback. | ✓ |
| Sempre cooperative + grace + terminate fallback | Sempre coerente, più lento. | |
| Sempre `terminate()` | Semplice ma rompe pool reuse. | |

**User's choice:** Hybrid per mode
**Notes:** Pool usa cooperation per mantenere reuse; dedicated può terminare senza impatto su altri task.

### Q3.2 — Come il worker riceve cancel signal in pool?

| Option | Description | Selected |
|--------|-------------|----------|
| AbortSignal proxied via Comlink (Recommended) | Task signature `async (input, signal, onProgress) => result`; `signal.aborted` letto via async getter. Coerente con AbortSignal-first F1. | ✓ |
| Reserved message + manual handler | Pattern manuale, esplicito; più boilerplate. | |
| Comlink AbortController shared scope | Idiomatico ma soggetto a future Comlink API changes. | |

**User's choice:** AbortSignal proxied via Comlink
**Notes:** Pattern noto, allineato a F1 AbortSignal-first.

### Q3.3 — State machine atomico (Pitfall 2C): response post-timeout?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo `<topic>.failed (timeout)`, ignora response (Recommended) | Map<taskId, TaskState>; transizioni esclusive; late response scartato silenziosamente. PRD §19.3 + Pitfall 2C strict. | ✓ |
| Pubblica entrambi con metadata | Più informativo ma rompe contratto "transizioni esclusive". | |
| Pubblica `system.warn` se response post-timeout | Più osservabilità senza rompere contratto. | |

**User's choice:** Solo `<topic>.failed`, ignora response
**Notes:** Contratto strict. Logging in debug snapshot per audit retroattivo (Claude's Discretion in CONTEXT.md).

### Q3.4 — `correlationId` end-to-end?

| Option | Description | Selected |
|--------|-------------|----------|
| Sì, sempre (Recommended) | Tutti gli eventi worker propagano `correlationId`. Subscriber filtra latest-only (Pitfall 2A). | ✓ |
| Solo se config esplicita | Rompe Pitfall 2A invariante. | |

**User's choice:** Sì, sempre
**Notes:** Coerente con F1 CORE-05 + F3 contract.

---

## Progress events API

### Q4.1 — Come il worker emette `<topic>.progress`?

| Option | Description | Selected |
|--------|-------------|----------|
| Comlink callback proxy `task(args, signal, onProgress)` (Recommended) | Idiomatico Comlink; tipato; il worker non sa dell'envelope. | ✓ |
| Reserved message via MessageChannel | Niente Comlink overhead; più manuale. | |
| Deferred a V1.x | V1 = solo `.completed/.failed`. Più conservativo. | |

**User's choice:** Comlink callback proxy
**Notes:** Pattern Comlink idiomatico. Il main thread riceve la chiamata e pubblica `<topic>.progress` con `correlationId` propagato.

### Q4.2 — Schema del payload progress?

| Option | Description | Selected |
|--------|-------------|----------|
| Ricca: `{ value, message?, partialResult? }` (Recommended) | Validato Valibot; UI può mostrare progress bar + label + partial preview. | ✓ |
| Solo `value: 0..1` | Più disciplinato; consumer aggiunge metadata via correlationId lookup. | |
| Schema custom per topic | Massima flessibilità ma più complesso. | |

**User's choice:** Schema canonical `{ value, message?, partialResult? }`
**Notes:** Schema canonico V1 — registrato in `CanonicalRegistry` F2 (analogo F4 D-106 envelope).

### Q4.3 — Throttling progress?

| Option | Description | Selected |
|--------|-------------|----------|
| Adapter-level con `throttleMs` config (Recommended) | Default 100ms, latest-only su `__progress__`. Worker può chiamare quanto vuole. | ✓ |
| Nessun throttle, trust del worker dev | Rischia storm. | |
| Riusa F3 BackpressureStrategy | Più verboso da configurare per il caso comune. | |

**User's choice:** Adapter-level con `progressThrottleMs=100` default
**Notes:** Niente impatto su `.completed/.failed` che passano sempre.

### Q4.4 — Progress passa per mapper canonical o bypassa?

| Option | Description | Selected |
|--------|-------------|----------|
| Passano per mapper, schema canonical (Recommended) | Coerente con D-113/D-114 F4 e PRD §28. Niente bypass, niente eccezioni. | ✓ |
| Bypass: progress ha schema fisso, no canonical | Più semplice ma rompe principio "tutto canonico interno" (PRD §13.5). | |

**User's choice:** Passano per mapper
**Notes:** Coerente con D-114 F4 carryover.

---

## assertSerializable gating

### Q5.1 — Quando attivare `assertSerializable`?

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-mode auto + opt-out (Recommended) | NODE_ENV !== 'production' → on. Override via `BrokerConfig.workers.assertSerializable: 'always' \| 'dev' \| 'off'`. | ✓ |
| Sempre attivo V1 + opt-out config | Zero rischio prod ma 5-15% overhead. | |
| Off di default + opt-in | Conservativo ma rinuncia DX out-of-the-box. | |

**User's choice:** Dev-mode auto + opt-out
**Notes:** Coerente con PRD §34.1 "debug mode disattivabile in produzione".

### Q5.2 — Cosa fa `assertSerializable` su violation?

| Option | Description | Selected |
|--------|-------------|----------|
| Throw `BrokerError` PRE-postMessage (Recommended) | Throw sincrono con `fieldPath` puntando al colpevole. Task NON dispatched. Coerente con F1 ERR-01. | ✓ |
| Publish `worker.error` + skip dispatch | Più graceful ma nasconde l'errore al chiamante. | |
| Throw + capture in route executor (no separate `worker.error`) | Più stringato ma rompe simmetria con `network.error` F3. | |

**User's choice:** Throw `BrokerError` PRE-postMessage
**Notes:** Il route executor cattura, publica `<topic>.failed` + `worker.error`. Bug killer DX.

### Q5.3 — Transferable opt-in?

| Option | Description | Selected |
|--------|-------------|----------|
| Path JSONPath-like nel WorkerRouteDescriptor (Recommended) | `transferable: ['payload.audioBuffer', 'payload.images[*].buffer']`. Il bridge estrae e passa al postMessage. | ✓ |
| Function picker `transferable: (payload) => Transferable[]` | Più flessibile ma richiede logica + path knowledge. | |
| Auto-detect heuristic + opt-in flag | Più magic ma soggetto a sorprese (Pitfall 7.E). | |

**User's choice:** Path JSONPath-like
**Notes:** Documenta esplicitamente "i campi transferred non sono più accessibili dal main thread" (Pitfall 7.E warning).

---

## Route worker policy inheritance

### Q6.1 — Le RoutePolicies F3 si applicano a route `worker`?

| Option | Description | Selected |
|--------|-------------|----------|
| Subset rilevante: timeout + concurrency + backpressure + dedupe (Recommended) | Niente retry/auth/circuitBreaker. Semantica adatta. | ✓ |
| Tutte le RoutePolicies F3 ereditate identiche | Massima simmetria ma alcuni casi (auth) non sensati per worker locale. | |
| Solo timeout + cancellation | Più minimal ma rinuncia al value DIFF-02 "unified routing". | |

**User's choice:** Subset rilevante
**Notes:** Worker error spesso deterministico → retry inutile salvo idempotency esplicita (deferred V1.x).

### Q6.2 — Default `concurrency` per route worker UI-driven?

| Option | Description | Selected |
|--------|-------------|----------|
| `latest-only` (Recommended) | Allineato a F3 default UI-driven. Pitfall 2.A consistency. | ✓ |
| `parallel` | Più throughput ma rischia Pitfall 2.A. | |
| `serial` | Più sicuro ma rinuncia parallelismo. | |

**User's choice:** `latest-only`
**Notes:** Override esplicito per task batch (`'serial'`) o idempotent paralleli (`'parallel'`).

### Q6.3 — Default `timeout`?

| Option | Description | Selected |
|--------|-------------|----------|
| 30_000ms (Recommended) | Allineato F4 D-109 (30s cap reconnection) e F3 D-69 ("non infinite by default"). | ✓ |
| 60_000ms | Più generoso, rischia spinner UI lungo. | |
| Niente default — obbligatorio dichiarare | Forza disciplina ma rompe il caso 80%. | |

**User's choice:** 30_000ms
**Notes:** Override per route via `timeout: N`. `Infinity` opt-in con warning.

### Q6.4 — Topic naming worker?

| Option | Description | Selected |
|--------|-------------|----------|
| Esplicito: consumer dichiara `publishes.success/error/progress` | Coerente con F3 route HTTP. Massima flessibilità. | |
| Auto-derivazione `<topic>.completed/.progress/.failed` | Niente boilerplate caso 95%. PRD §12.2. | |
| Hybrid: auto-derivazione + override esplicito (Recommended) | Default auto-derive; consumer può override singoli campi. | ✓ |

**User's choice:** Hybrid
**Notes:** Default = auto-derive; override granulare via `publishes: { error: 'custom.error' }`.

---

## Worker module loading

### Q7.1 — Quale tipo di Worker SemBridge supporta in V1?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo ESM `{ type: 'module' }` (Recommended) | PRD §31.3 evergreen + STACK.md ESM-only. Default raccomandato. | |
| Entrambi via opt-in `{ workerType: 'classic' }` | Default ESM; classic come opt-in per bundler vintage. | ✓ |
| Solo classic | Rinuncia a ESM imports nel worker; contraddice PRD §31.3. | |

**User's choice:** Entrambi via opt-in
**Notes:** Default `workerType: 'module'`. Opt-in `'classic'` per legacy webpack 4 senza module-worker plugin. Documentazione DOC-05 esplicita le limitazioni (no `import` ESM nel worker classic). Lieve estensione rispetto a PRD §31.3 strict — ma è opt-in, non polyfill.

### Q7.2 — Pattern bundler-friendly per costruire la factory?

| Option | Description | Selected |
|--------|-------------|----------|
| Documenta `new URL('./x.worker.ts', import.meta.url)` (Recommended) | Pattern Vite/esbuild/tsup standard. Niente helper custom. | ✓ |
| Helper SemBridge `workerFromUrl(url, opts)` | Più DX ma meno trasparente. | |
| Documenta entrambi | DX e flessibilità ma più codice da mantenere. | |

**User's choice:** Documenta `new URL(..., import.meta.url)` only
**Notes:** Pattern minimale, ecosystem-aligned, zero magia. DOC-05 esempi end-to-end.

---

## Wrap-up

### Final question: gray area residue?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready per CONTEXT.md (Recommended) | Decisioni implementative lockate; aree non discusse coperte da carry-forward. | ✓ |
| Esplora altre gray area | Aree aggiuntive (telemetry hooks, scenario meteo F5, ecc.). | |

**User's choice:** Ready per CONTEXT.md
**Notes:** Procedi con write_context + auto-advance plan-phase via `--chain`.

---

## Claude's Discretion

Aree dove Claude ha flessibilità implementativa (CONTEXT.md "Claude's Discretion"):
- Naming interno dei file (`worker-pool.ts` vs `pool.ts`, `task-tracker.ts` vs `state-machine.ts`)
- Default thresholds (`pool.size`, `pool.cap`, `cancelGraceMs`, `progressThrottleMs`, `timeout`, `dedupeWindow`) — researcher può proporre tweak basati su benchmark in F5 RESEARCH.md
- Internal topics namespace (`__cancel__`/`__progress__` vs alternative tipo `$$worker.cancel`)
- Sub-codes BrokerError per categorie serializzazione (`worker.serialization.failed.function`, `.dom-node`, `.custom-class`)
- Error categorization mapping
- Comlink version exact (4.4.x baseline; ricerca verifica `npm view comlink version` e propone tweak se 4.5+ ha breaking minor)

## Deferred Ideas

Idee emerse durante la discussione, riportate in CONTEXT.md `<deferred>` per future fasi:
- Worker pool autoscaling con strategia configurabile (REQUIREMENTS.md WK2-01, V2)
- Custom RPC alternative to Comlink (V1.x se Comlink mostra friction)
- `superjson` adapter pluggable (V1.x quando emerge caso d'uso fuori SCA)
- `SharedWorker` cross-tab support (V2)
- Worker retry policy idempotent (V1.x come opt-in)
- Auto-detect transferable heuristic (V1.x — V1 = JSONPath dichiarato esplicito)
- Worker module HMR per dev mode (bundler-specific)
- Service Worker / Push notification bridge (RT2-01, V2)
- Worker telemetry hooks per F6 (pre-instrumented in F5 come EventTap pattern, implementazione reale F6 — analogo CORE-13)
