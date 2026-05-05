# GlueZero — Project Guide for Claude Code

Questo file fornisce contesto operativo a future istanze di Claude Code che lavorano su questo progetto.

## Cos'è GlueZero

Libreria JavaScript browser-side (TypeScript-first, ESM) che combina sei capability in un singolo runtime:
1. Broker pub/sub interno alla pagina
2. Routing dichiarativo (`local`, `http`, `realtime-inbound`, `worker`, `cache`, `composite`)
3. Gateway server unico (fetch + SSE/WebSocket inbound, auth/retry/timeout/circuit policies)
4. Worker runtime (registry + pool, task tracking, propagazione errori)
5. Canonical Model + Mapper bidirezionale (locale ↔ canonico ↔ locale)
6. Developer tooling (Event/Mapping/Route Inspector, metrics, log levels)

**Fonte autoritativa unica:** `prd.md` nella root. Il PRD è esplicitamente "l'unica base informativa condivisa con il developer" (§1) e deve bastare a progettare/implementare senza assumere dettagli non espressi.

## Vincoli operativi (non negoziabili)

### Boot protocol (PRIMA AZIONE di ogni nuova sessione)
1. **Leggi `.planning/TRACKER.md`** se esiste — contiene stato corrente (fase/wave/plan), ultimo step completato, prossimo comando GSD da lanciare, agenti in background da riprendere via `SendMessage`.
2. **Leggi `.planning/STATE.md`** per cross-check.
3. Se TRACKER.md mostra agente in background con `id` ancora attivo → riprendi via `SendMessage` invece di spawn nuovo.

### Modello AI per agenti GSD
**Tutti i sotto-agenti GSD devono usare `claude-opus-4-7-1`** (alias `opus` per il tool Agent di Claude Code, profilo GSD `quality`).
- Mai usare `sonnet` o `haiku` per spawn agenti, anche per task brevi/sintesi/verifier/checker.
- Override esplicito `model: "opus"` in ogni `Agent` call (non fidarsi dei default GSD: `verifier_model`/`checker_model`/`synthesizer_model` di default sono `sonnet` anche con profilo `quality`).
- Config GSD `.planning/config.json` deve avere `model_profile: "quality"` ma NON è sufficiente da solo: i sub-agent vanno comunque spawnati con `model: "opus"` esplicito.

### Lingua
**Tutto in italiano** salvo richiesta esplicita diversa: risposte utente, prompt agenti, commit message, descrizioni REQ-ID, success criteria, JSDoc descrittivi. Restano in inglese: codice, identificatori, comandi shell, nomi librerie/file/package, error messages letterali, log keywords.

### Boundary di sicurezza
**Area di lavoro libera:** `/Users/omarmarzio/programming/prova AI/` e tutte le sottocartelle (incluso GlueZero, API-Integrator, fasttrack3, ecc.) — crei, modifichi, sposti, cancelli, esegui senza chiedere conferma.

**Fuori da quella directory:** solo lettura e creazione di NUOVI file/directory. **MAI** cancellare/sovrascrivere/spostare/modificare file esistenti, eseguire `rm`/`mv`/`git reset --hard` su path esterni, modificare config globali (`~/.claude/settings.json`, `~/.gitconfig`, `~/.zshrc`, settings di sistema). Eccezione: aggiornamenti alle memorie GSD-Claude in `~/.claude/projects/<projectDir>/memory/` sono OK (create/update), ma DELETE/MOVE richiedono conferma.

Se un'operazione richiede di toccare qualcosa fuori boundary, fermarsi e chiedere.

### Logica decisionale (alta autonomia)
**NON chiedere — procedi su default ragionevoli per:**
- Default tecnici già coperti da PRD, CONTEXT.md, ROADMAP.md, REQUIREMENTS.md, research/.
- Override `human_needed` del verifier quando il caveat è esplicitamente un deferral pianificato e documentato.
- Scelte tra varianti equivalenti dove la documentazione raccomanda chiaramente una.
- Cleanup/refactor minor (typo, formatter, checkbox stale, JSDoc).
- Spawn sotto-agenti, parallelizzazione, retry, fix di code review.
- Auto-advance a fine fase: transition automatico discuss → plan → execute.
- Code review post-execution con BLOCKER: applica `/gsd-code-review-fix --auto` (cap 3 iter) prima del verifier.

**CHIEDI solo per:**
- Scope irreversibili (rinomina API pubblica, breaking change, deferimento REQ-ID locked, cambio stack/dipendenza maggiore).
- Valori che solo l'utente conosce (chiavi API, branding, priorità tra feature equivalenti senza raccomandazione).
- BLOCKER architetturale che viola un vincolo CLAUDE.md esplicito + fix richiede tradeoff decision.

Format domande: max 4 opzioni con default raccomandato in prima posizione. Mai chiedere conferma di azioni già autorizzate.

### Agent-swarm
Quando si lavora con GSD, **preferire parallelizzazione**: spawnare più agenti in un singolo messaggio con tool calls multipli, sempre con override `model: "opus"`. Vincolo: file ownership disgiunta entro la stessa wave per evitare conflitti git index.

### Tracking di progetto (TRACKER.md)
**File:** `.planning/TRACKER.md` (commitato in repo).

**Quando aggiornarlo:**
- Dopo ogni plan completato (post-SUMMARY.md commit).
- Dopo ogni wave completata.
- Dopo ogni decisione architetturale nuova (D-XX).
- Prima di sospendere lavoro per interruzione utente esplicita.
- All'avvio di una nuova fase.
- Quando aggiungi/recuperi agent in background (`agentId`).

**Contenuto minimo:**
1. Fase corrente, wave corrente, plan in esecuzione, agent attivi (id + status)
2. Ultimo step completato (commit hash + path SUMMARY.md di riferimento)
3. Prossimo step (comando GSD da lanciare per riprendere)
4. Vincoli attivi (modello, lingua, boundary, decisioni recenti)
5. Decisioni recenti non ancora committate
6. Note libere

**Protocollo update:** modifica via `Edit` (preserva struttura), commit insieme a SUMMARY.md/STATE.md per consistency con `gsd-sdk query commit`.

### Knowledge graph (Graphify)

Il progetto usa **graphify** per mantenere un knowledge graph del codebase + docs in `graphify-out/`. CLI `graphify` installato globalmente via `uv tool` (`/Users/omarmarzio/.local/bin/graphify`); skill `/graphify` registrata; hook globale `PreToolUse` in `~/.claude/settings.json` suggerisce il grafo prima di grep/find/rg/fd.

**Bootstrap a inizio sessione (e dopo ogni `/clear`):**
- Se `graphify-out/graph.json` NON esiste → lancia `/graphify .` PRIMA di affrontare qualunque richiesta su architettura/codebase.
- Se esiste → salta direttamente al watcher.

**Watch mode persistente per-progetto (NON globale):**
A inizio sessione, avvia il watcher se non è già attivo per QUESTO progetto. Check via PID file locale (`graphify-out/.watch.pid`), MAI via `pgrep` globale.

```bash
mkdir -p graphify-out
if [ -f graphify-out/.watch.pid ] && kill -0 "$(cat graphify-out/.watch.pid)" 2>/dev/null; then
  echo "graphify watch already running (PID $(cat graphify-out/.watch.pid))"
else
  nohup graphify watch . --debounce 3 > graphify-out/.watch.log 2>&1 &
  echo $! > graphify-out/.watch.pid
fi
```

Il watcher è persistente per tutta la sessione: NON rilanciarlo, NON killarlo a fine task. Kill manuale: `kill "$(cat graphify-out/.watch.pid)" && rm graphify-out/.watch.pid`.

**Uso del grafo PRIMA di grep:**
- Domande "come X si relaziona a Y", "qual è l'architettura", "dove vive Z" → `graphify query "<domanda>"` / `graphify path "<A>" "<B>"` / `graphify explain "<concetto>"`.
- Overview → leggi `graphify-out/GRAPH_REPORT.md` (god nodes, community structure, surprising connections).

**Aggiornamento file non-code (markdown, PDF, immagini, video):**
Il watcher copre solo codice (AST, zero LLM). Per file non-code lancia `graphify update .` manualmente (estrazione semantica, costa token). Se il watcher rileva non-code crea il flag `graphify-out/needs_update`: controllalo prima di chiudere fasi importanti.

**Stato watcher in TRACKER.md:**
Includi PID watcher (`cat graphify-out/.watch.pid`) + timestamp ultimo `graphify update .` non-code.

**Niente check-in di `graphify-out/`:** artefatto rigenerabile, aggiungilo a `.gitignore` quando esisterà.

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
| Repo | **Monorepo `pnpm` workspaces** con 7 sub-package | `@gluezero/{core, mapper, gateway, routing, worker, cache, devtools}` + `@gluezero/gluezero` aggregato pubblico |

**Cosa NON usare:** `ky`/`wretch`/`ofetch` (insufficienti per le policy richieste), `reconnecting-websocket` (vincolo PRD §31.3), polyfill SSE, RxJS come base, `eventemitter3` come base.

## Roadmap (6 fasi PRD §32)

| Phase | Goal | Pacchetto principale | Research extra |
|-------|------|----------------------|----------------|
| 1 — Core essenziale | Broker pub/sub + plugin registry + EventTap pre-instrumentato | `@gluezero/core` | no |
| 2 — Canonical Model & Mapper | Vocabolario canonico + mapper bidirezionale + Mapping Inspector | `@gluezero/mapper` | no |
| 3 — Routing & Server Gateway HTTP | Routing engine dichiarativo + HTTP gateway centralizzato | `@gluezero/routing` + `@gluezero/gateway` | yes |
| 4 — Realtime inbound | Adapter SSE+WS con reconnection policy | `@gluezero/gateway` (sse/ws adapter) | yes |
| 5 — Worker Runtime | Worker registry + route worker + task tracking | `@gluezero/worker` | yes |
| 6 — Cache & Tooling avanzato | In-memory cache + Inspector + Metrics + debug API | `@gluezero/cache` + `@gluezero/devtools` | no |

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
