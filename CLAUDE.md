# SemBridge — Project Guide for Claude Code

Questo file fornisce contesto operativo a future istanze di Claude Code che lavorano su questo progetto.

## Cos'è SemBridge

Libreria JavaScript browser-side (TypeScript-first, ESM) che combina sei capability in un singolo runtime:
1. Broker pub/sub interno alla pagina
2. Routing dichiarativo (`local`, `http`, `realtime-inbound`, `worker`, `cache`, `composite`)
3. Gateway server unico (fetch + SSE/WebSocket inbound, auth/retry/timeout/circuit policies)
4. Worker runtime (registry + pool, task tracking, propagazione errori)
5. Canonical Model + Mapper bidirezionale (locale ↔ canonico ↔ locale)
6. Developer tooling (Event/Mapping/Route Inspector, metrics, log levels)

**Fonte autoritativa unica:** `prd.md` nella root. Il PRD è esplicitamente "l'unica base informativa condivisa con il developer" (§1) e deve bastare a progettare/implementare senza assumere dettagli non espressi.

## Vincoli operativi (non negoziabili)

### Modello AI per agenti GSD
**Tutti i sotto-agenti GSD devono usare `claude-opus-4-7-1`** (alias `opus` per il tool Agent di Claude Code, profilo GSD `quality`).
- Mai usare `sonnet` o `haiku` per spawn agenti, anche per task brevi.
- Override esplicito `model: "opus"` in ogni `Agent` call (non fidarsi dei default GSD: `synthesizer_model` di default è `sonnet` anche con profilo quality).

### Lingua
**Tutto in italiano** salvo richiesta esplicita diversa: risposte utente, prompt agenti, REQ-ID descrittivi, success criteria. Restano in inglese: codice, identificatori, comandi shell, nomi librerie/file/package, error messages letterali, log keywords.

### Domande
**Minimizzare le interazioni utente.** Il PRD copre quasi tutto. Procedere su default ragionevoli quando il PRD risolve. Chiedere solo per ambiguità reali, scelte irreversibili, valori che solo l'utente può fornire.

### Agent-swarm
Quando si lavora con GSD, **preferire parallelizzazione**: spawnare più agenti in un singolo messaggio con tool calls multipli, sempre con override `model: "opus"`.

## Vincoli architetturali (dal PRD §33.2 — non negoziabili)

- Esistenza del canonical model
- Esistenza del mapper bidirezionale
- Broker come unico gateway verso il server per i flussi coperti
- Supporto a `fetch` + almeno un canale realtime inbound (SSE prioritario)
- Supporto Web Worker
- Debug e introspection (Event/Mapping/Route Inspector)
- Lifecycle che previene memory leak
- Route dichiarative (configuration-driven)
- Validazione minima dei payload

## Vincolo architetturale critico (da research)

**`EventTap` interface deve essere instrumentata già in Fase 1**, anche con implementazione no-op. Le fasi 2-5 estendono la pipeline §28 aggiungendo step. La Fase 6 sostituisce il no-op con Inspector reali. Aggiungere il Tap retroattivamente in F6 significherebbe retrofit invasivo di tutti i filtri.

Riferimento: `.planning/research/ARCHITECTURE.md` §3.2 e `.planning/research/SUMMARY.md`.

## Stack raccomandato (da `.planning/research/STACK.md`)

| Area | Scelta | Rationale |
|------|--------|-----------|
| Build | `tsup` 8.x | Zero-config esbuild + dts integrato |
| Test | `Vitest` 2.x + `msw` 2.x + `@vitest/browser`+Playwright | 3-livelli (Node→jsdom→browser reale per Worker/SSE/WS) |
| Validation | `Valibot` 1.x | Tree-shakable ~1-3 KB per schema |
| HTTP | `fetch` nativo + Gateway custom | Wrapper esistenti coprono solo 70-80% delle policy PRD |
| EventBus | In-house | Mitt/eventemitter3 troppo magri; RxJS troppo pesante |
| Worker | `Comlink` 4.4.x con astrazione `WorkerBridge` | Switch a RPC custom in V1.x se serve |
| Realtime | `EventSource` + `WebSocket` nativi + adapter custom | Niente polyfill (PRD §31.3) |
| Serialization | `structuredClone` nativo | SCA usato da postMessage |
| ID | `nanoid` 5.x | ~130 B per `BrokerEvent.id` |
| TypeScript | 5.5+, target ES2022, module ESNext, moduleResolution Bundler, strict | + `isolatedDeclarations` |
| Lint/Format | `Biome` 1.9+ | One-tool, Rust-based |
| Versioning | `Changesets` 2.x | |
| Docs | `TypeDoc` + `typedoc-plugin-markdown` | |
| Repo | **Monorepo `pnpm` workspaces** con 7 sub-package | `@sembridge/{core, mapper, gateway, routing, worker, cache, devtools}` + `@sembridge/sembridge` aggregato pubblico |

**Cosa NON usare:** `ky`/`wretch`/`ofetch` (insufficienti per le policy richieste), `reconnecting-websocket` (vincolo PRD §31.3), polyfill SSE, RxJS come base, `eventemitter3` come base.

## Roadmap (6 fasi PRD §32)

| Phase | Goal | Pacchetto principale | Research extra |
|-------|------|----------------------|----------------|
| 1 — Core essenziale | Broker pub/sub + plugin registry + EventTap pre-instrumentato | `@sembridge/core` | no |
| 2 — Canonical Model & Mapper | Vocabolario canonico + mapper bidirezionale + Mapping Inspector | `@sembridge/mapper` | no |
| 3 — Routing & Server Gateway HTTP | Routing engine dichiarativo + HTTP gateway centralizzato | `@sembridge/routing` + `@sembridge/gateway` | yes |
| 4 — Realtime inbound | Adapter SSE+WS con reconnection policy | `@sembridge/gateway` (sse/ws adapter) | yes |
| 5 — Worker Runtime | Worker registry + route worker + task tracking | `@sembridge/worker` | yes |
| 6 — Cache & Tooling avanzato | In-memory cache + Inspector + Metrics + debug API | `@sembridge/cache` + `@sembridge/devtools` | no |

Dipendenze: F1 → F2 → F3 → (F4 ∥ F5) → F6 (F4 e F5 parallelizzabili).

## Open issues PRD §39 — chiusura per fase

Il PRD §39 elenca 11 punti che NON devono restare impliciti. Mappatura risoluzione:

| Open issue | Fase di chiusura | REQ-ID |
|------------|------------------|--------|
| Precedenza alias automatici vs mapping esplicito | F2 | MAP-17 |
| Field mancante: errore o default | F2 | VAL-08 |
| Transform failure: skip o block | F2 | VAL-09 |
| Topic senza route | F3 | ROUTE-16 |
| Più route applicabili allo stesso topic | F3 | ROUTE-15 |
| Retry 4xx vs 5xx | F3 | ROUTE-09 |
| Unsubscribe automatico in unregister plugin | F3 | LIFE-02 |
| Reconnection rules realtime | F4 | RT-07 |
| Serializzazione messaggi worker | F5 | WK-07 |
| Format metriche | F6 | TOOL-05 |
| Ordine pipeline mapping/validation | Cross-fase | PIPE-01 |

## Workflow GSD

- `/gsd-discuss-phase 1` (raccomandato): discuti la fase prima di pianificare
- `/gsd-plan-phase 1`: salta discuss, vai direttamente al plan
- `/gsd-execute-phase 1`: esegui i plan generati

Per future fasi: ricorda flag research per F3, F4, F5 (`--research` o aspettati che il workflow lo faccia automaticamente).

## File di progetto

```
.planning/
├── PROJECT.md          # Contesto progetto, requisiti high-level, vincoli, decisioni
├── REQUIREMENTS.md     # 91 REQ-ID v1 mappati a fasi
├── ROADMAP.md          # 6 fasi con success criteria
├── STATE.md            # Stato corrente (current_phase, completed phases)
├── config.json         # GSD config (profilo quality, granularity coarse, parallelization on)
└── research/
    ├── STACK.md        # Stack tecnologico dettagliato
    ├── FEATURES.md     # Table stakes / differenziatori / anti-feature
    ├── ARCHITECTURE.md # Pattern, boundaries, data flow, build order
    ├── PITFALLS.md     # 17 tranelli con strategie di prevenzione
    └── SUMMARY.md      # Sintesi orientata a roadmap/planning
```

## Pipeline ufficiale §28 (cross-fase)

Ogni evento attraversa 14 step. La pipeline si costruisce incrementalmente:
- F1 implementa skeleton (step 1, 2, 3, 7-base, 13)
- F2 estende (step 4, 5, 6, 11, 12)
- F3 estende (step 7-full, 8, 9, 10)
- F6 attiva il step 14 reale (logging/metrics/debug snapshot)

L'ordine deve essere coerente e documentato. Niente trasformazioni implicite invisibili al debug layer (PRD §28.2).

---
*Last updated: 2026-04-28 after project initialization*
