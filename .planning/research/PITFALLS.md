# Pitfalls Research — GlueZero

**Domain:** Libreria browser-side di middleware event-driven con canonical model, gateway server unico, worker runtime e cache (TypeScript-first, ESM)
**Researched:** 2026-04-28
**Confidence:** HIGH (la maggior parte dei tranelli è documentata in PRD §22-§26 e §39, oppure è folklore consolidato del dominio event-driven middleware browser-side; sintesi basata su PRD + esperienza di dominio)

---

## Indice rapido

1. [Memory leak da subscribe persistenti](#pitfall-1-memory-leak-da-subscribe-persistenti)
2. [Race condition nel ciclo request/response](#pitfall-2-race-condition-nel-ciclo-requestresponse)
3. [Canonical model drift e ambiguità di alias](#pitfall-3-canonical-model-drift-e-ambiguità-di-alias)
4. [Dedupe scorretta e backpressure cieca](#pitfall-4-dedupe-scorretta-e-backpressure-cieca)
5. [Retry policy tossica](#pitfall-5-retry-policy-tossica)
6. [Realtime reconnect senza disciplina](#pitfall-6-realtime-reconnect-senza-disciplina)
7. [Worker pitfalls (serializzazione e ownership)](#pitfall-7-worker-pitfalls-serializzazione-e-ownership)
8. [Cache invalidation e cache-then-network](#pitfall-8-cache-invalidation-e-cache-then-network)
9. [Plugin isolation insufficiente](#pitfall-9-plugin-isolation-insufficiente)
10. [Validation noise e silenzi](#pitfall-10-validation-noise-e-silenzi)
11. [API design tranelli (handle, naming, mutazione condivisa)](#pitfall-11-api-design-tranelli)
12. [TypeScript pitfalls (literal types, any propagato)](#pitfall-12-typescript-pitfalls)
13. [Build / distribution (dual package, side-effects)](#pitfall-13-build--distribution)
14. [Open issues PRD §39 lasciate implicite](#pitfall-14-open-issues-prd-39-lasciate-implicite)
15. [SemVer e plugin versioning](#pitfall-15-semver-e-plugin-versioning)
16. [Performance pitfalls (wildcard scan, mapping ricompilato)](#pitfall-16-performance-pitfalls)
17. [Sicurezza (token, CORS, allowlist)](#pitfall-17-sicurezza)

Legenda severità: **BLOCKING** = se non risolto, V1 non rilasciabile · **HIGH** = rilasciabile ma con gravi rischi operativi · **MEDIUM** = qualità/manutenibilità · **NICE-TO-HAVE** = miglioria.

---

## Critical Pitfalls

### Pitfall 1: Memory leak da subscribe persistenti

**Severità:** BLOCKING — PRD §24 lo richiede esplicitamente.

**Cosa va storto:**
Subscribe creati durante il mount di un componente UI non vengono rilasciati al suo unmount. L'handler chiude su `this`/closure del componente, mantiene vivi nodi DOM, store, store grafici, immagini. La pagina lavora bene per 30 secondi e degrada dopo 10 minuti di navigazione interna. I plugin smontati continuano a "esistere" dentro Subscriber Registry e Worker MessageChannel.

**Sintomo / segnale d'allarme:**
- Heap snapshot mostra istanze di componenti già "distrutti" trattenute dal Subscriber Registry.
- Performance degrada dopo navigazioni ripetute (SPA route changes).
- `getMetrics().subscribersByTopic` cresce monotonicamente.
- `unregisterPlugin` ritorna ma `getDebugSnapshot()` mostra ancora subscription appartenenti al pluginId.

**Causa root:**
1. `subscribe` ritorna `void` (vedi Pitfall 11.A) — impossibile fare unsubscribe.
2. Subscriber Registry usa strong references → il broker tiene in vita l'handler, l'handler tiene in vita il componente.
3. `unregisterPlugin` non cascata: dimentica di chiudere worker MessageChannel, listener SSE/WS bound al plugin, timer pendenti, AbortController di route HTTP in volo.
4. Lifecycle hook `onDestroy` non chiamato, oppure chiamato ma fa solo log.

**Strategia di prevenzione (azionabile):**
- **API contract:** `subscribe()` DEVE ritornare un `Subscription` con `.unsubscribe()`. Documentato come breaking se cambia. Test che fallisce se la firma cambia (CORE-02).
- **AbortSignal-first:** ogni metodo che genera lavoro asincrono accetta `{ signal?: AbortSignal }`. `subscribe`, `publish` (per route remote), `connectRealtime`, route HTTP/worker. Quando il signal aborta, tutto il lavoro associato si chiude in cascata.
- **Owner-based registry:** ogni subscription è registrata con un `ownerId` (= pluginId o componentId). `unregisterPlugin(pluginId)` enumera tutto ciò che ha quell'`ownerId` e lo cancella in cascata: subscription, route che il plugin aveva registrato, AbortController in volo, MessageChannel worker, listener realtime configurati dal plugin.
- **Test deterministici:** un test obbligatorio (TEST-01 lifecycle cleanup) crea N plugin, registra subscription, route e worker task, fa `unregisterPlugin`, e verifica con `getDebugSnapshot()` che `subscribers/routes/workerTasks` siano tornati ai valori pre-registrazione. Tolleranza zero.
- **WeakRef opzionale ma pericoloso:** evitare `WeakRef` per gli handler del Subscriber Registry. La GC è non deterministica e renderebbe i test flaky. Meglio strong ref + cleanup esplicito disciplinato.
- **Devtool warning:** in `enableDebug()`, se un subscription resta attiva > N ms senza eventi e il plugin owner non è più registrato, log di warning con stack della creazione (catturato in dev mode).

**Phase to address:**
- **Fase 1 (Core):** API `subscribe → handle`, `unregisterPlugin → cascata`, AbortSignal nel core, test cleanup obbligatori. Fissato qui = niente debito tecnico ereditato.
- **Fase 4 (Realtime), Fase 5 (Worker):** ciascuna estende la cascata di cleanup ai propri handle (channel, MessageChannel).

**Riferimento PRD:** §24.1, §24.2, §15.6 ("il plugin deve poter essere smontato senza memory leak"), CORE-02, CORE-11, TEST-01.

---

### Pitfall 2: Race condition nel ciclo request/response

**Severità:** HIGH — esperienza utente compromessa, side effect duplicati.

**Cosa va storto:**
Tre scenari distinti, tutti tipici:

**2.A — Doppia richiesta in volo (`<topic>.requested` mentre la precedente è ancora pending).**
L'utente clicca "cerca" due volte. Risultato: due fetch in volo, e l'ordine di arrivo NON è garantito. La risposta della prima query (più lenta, più "vecchia" semanticamente) può sovrascrivere quella della seconda. Il widget mostra dati sbagliati.

**2.B — Risposta server arriva dopo cambio vista.**
L'utente apre weather per Roma, poi naviga via. La risposta `/api/weather?location=Roma` arriva 3 secondi dopo. Il route pubblica `weather.loaded`, il subscriber ha già fatto unmount → o crash su `setState` su componente smontato (in framework UI), oppure mutazione di stato globale che non interessa più nessuno (event spam).

**2.C — Worker timeout vs risultato.**
Worker task ha timeout 5s. A 5.001s pubblica `<topic>.failed (timeout)`. A 5.050s arriva il messaggio `success` dal worker. Doppia pubblicazione contraddittoria: il consumer riceve prima failed, poi loaded → UI flash inconsistente.

**Sintomo / segnale d'allarme:**
- 2.A: utente segnala "ho cercato X ma vedo i risultati di Y".
- 2.B: warning `setState on unmounted component`, errori `cannot read of null` nei log.
- 2.C: doppio re-render rapido in sequenza success-after-failure.

**Causa root:**
Manca un'identità di correlazione + politica esplicita. Il broker tratta ogni evento come indipendente, ignora che B "supera" A semanticamente.

**Strategia di prevenzione:**
- **`correlationId` propagato end-to-end:** ogni `<topic>.requested` genera un `correlationId`. Il route lo propaga in `<topic>.loaded` / `<topic>.failed`. Il subscriber può filtrare: "scarto risposte con correlationId che non è il mio ultimo".
- **Latest-only policy come opzione di route:** route HTTP/worker espongono `concurrency: 'latest-only' | 'serial' | 'parallel'`. Default consigliato per topic UI-driven: `latest-only`. Quando una nuova request arriva, l'AbortController della precedente viene chiamato; il `<topic>.loaded` per la richiesta abortita NON viene pubblicato.
- **Dedupe via `dedupeKey`:** se due richieste hanno lo stesso `dedupeKey` (es. `weather:Roma:2026-04-30`), il broker collassa: una sola fetch in volo, entrambi i caller ricevono la stessa risposta. PRD §11.1, §23.4, ROUTE-11.
- **AbortSignal su `subscribe`:** il subscriber può passare un signal collegato al lifecycle del componente. Quando il signal aborta, la consegna salta — niente più "loaded dopo unmount".
- **Mutua esclusione timeout/success per route worker:** lo state machine del task è {pending → done | timeout | error}, transizioni atomiche. Se il timeout scatta → setto `state=timeout` e ignoro tutti i message successivi del worker task con quello `taskId`. WK-03 (task correlation) lo supporta.
- **Documentazione esplicita** della scelta nel readme: "in caso di doppia request, default è latest-only".

**Phase to address:**
- **Fase 1:** introdurre `correlationId` come campo first-class del `BrokerEvent` (CORE-05 lo prevede già) + `AbortSignal` API.
- **Fase 3 (Routing/HTTP):** `concurrency` policy per route HTTP, `dedupeKey` lookup.
- **Fase 5 (Worker):** state machine atomico timeout vs success per WK.

**Riferimento PRD:** §11.1 (correlationId, dedupeKey), §23.3 (latest-only), §23.4 (deduplica), §23.5 (cancellazione), CORE-05, ROUTE-08, ROUTE-11, WK-03, WK-06.

---

### Pitfall 3: Canonical model drift e ambiguità di alias

**Severità:** BLOCKING — è il valore distintivo del prodotto (PROJECT.md "Core Value").

**Cosa va storto:**
Tre sottocasi concreti:

**3.A — Alias semanticamente ambigui:**
`data` (italiano) può essere "date" oppure "data generica" (=dataset, payload). Plugin A scrive `data: "2026-04-30"`. Plugin B scrive `data: { rows: [...] }`. Entrambi usano lo stesso alias `data`. Il broker, con alias automatici, "indovina" e in realtà sbaglia metà delle volte.

**3.B — Shadowing tra plugin:**
Plugin A dichiara alias `temp → temperature_celsius`. Plugin B dichiara alias `temp → temperature_fahrenheit`. Quale vince a livello globale? Se gli alias sono globali, il secondo che si registra "ruba" l'alias al primo, silenziosamente, e il plugin A inizia a ricevere fahrenheit interpretato come celsius.

**3.C — Schema canonico evolve:**
V1.0 ha `forecast_date: string`. V1.1 cambia in `forecast_date: { iso: string, tz: string }` per gestire timezone. Tutti i plugin esistenti che usano la forma stringa rompono silenziosamente — il loro mapping passa la stringa, validazione canonica fallisce, evento droppato senza che nessuno se ne accorga.

**3.D — Mapping circolare:**
Plugin A ha `outputMap: { local_x → canonical_y }`. Plugin B (consumer) ha `inputMap: { canonical_y → local_x }`. Se il broker fa "auto-mapping" basato su nomi simili, può creare cicli: locale → canonico → locale → canonico, e in mappature complesse il fixpoint non converge.

**Sintomo / segnale d'allarme:**
- 3.A: warning di ambiguità in console (se MAP-16 è implementato), oppure dati visibilmente sbagliati nel widget.
- 3.B: due plugin funzionano isolati, falliscono insieme.
- 3.C: in deploy V1.1 i widget basati su V1.0 smettono di renderizzare; mapping inspector mostra `weather.loaded` arrivato ma `validation.failed` su forecast_date.
- 3.D: stack overflow su mapping, oppure warning "mapping pipeline depth exceeded".

**Causa root:**
- Il mapping automatico via alias viene trattato come fonte di verità (PRD §14.7 lo proibisce esplicitamente, ma il developer può essere tentato).
- Manca un namespace per gli alias plugin-scoped vs globali.
- Schema canonico non versionato.
- Mapping pipeline non ha depth-limit né cycle detection.

**Strategia di prevenzione:**
- **Regola sacra (MAP-17):** il mapping esplicito dichiarato dal plugin (`inputMap`/`outputMap`) ha **sempre** precedenza sugli alias automatici. Gli alias sono "suggerimenti" usati solo in assenza di mapping esplicito. Chiusura esplicita di Open Issue PRD §39 punto 1.
- **Alias plugin-scoped:** ogni plugin descrittore dichiara alias che valgono *solo nel proprio mapping*. Alias globali sono nel `canonicalModel.fields[X].aliases` del config root e sono autoritativi.
- **Warning runtime obbligatorio (MAP-16):** quando il broker risolve un alias automatico, deve loggare un `warn` nel mapping inspector. In produzione il warn può essere silenziato, in dev è on by default. Permette di "cacciare" gli alias ambigui prima che producano bug.
- **Schema canonico versionato:**
  - `registerCanonicalSchema({ id, version, fields })` (MAP-02 + estensione).
  - Cambi di tipo richiedono nuovo `id` o nuovo `version`. PluginDescriptor dichiara `requires: { canonicalSchema: 'weather@1.0' }`. Mismatch = errore al `registerPlugin`, non a runtime.
  - Migration helpers: trasformazioni built-in per portare dati da v1 a v2 senza rompere i plugin vecchi.
- **Cycle detection:** la pipeline di mapping ha un `visited: Set<string>` che traccia (pluginId, fieldName). Se un campo è visitato due volte nella stessa pipeline → errore esplicito "circular mapping detected: A → B → A".
- **Mapping inspector come strumento di review (MAP-15):** durante onboarding di un nuovo plugin, il dev deve vederne almeno un round di mapping con inspector e validare visualmente.
- **Lint rule per descrittori plugin:** in dev mode, `registerPlugin` esegue una validazione del descriptor che include "alias ambiguity check" rispetto al canonical model registrato.

**Phase to address:**
- **Fase 2 (Canonical & Mapper):** è il cuore del problema. Tutto il design del mapper deve essere fatto qui con MAP-15, MAP-16, MAP-17.
- **Fase 6 (Tooling):** mapping inspector visuale per debug runtime.

**Riferimento PRD:** §13, §14.7, §14.8, §39 punto 1, MAP-15, MAP-16, MAP-17.

---

### Pitfall 4: Dedupe scorretta e backpressure cieca

**Severità:** HIGH — bug subdoli, difficili da rilevare in test ma frequenti in produzione.

**Cosa va storto:**

**4.A — DedupeKey troppo aggressivo:**
DedupeKey computato come `topic + plainStringify(payload)`. Due eventi `cart.item.added` con payload identico (stesso prodotto due volte) vengono dedupli in uno → l'utente clicca "+1" due volte e il carrello sale di 1 invece che di 2.

**4.B — DedupeKey troppo lasco:**
DedupeKey = solo `topic`. Tutto si dedupli, niente passa.

**4.C — Queue bounded che droppa eventi critici:**
Drop policy "drop-oldest" su queue di topic mista. Un `system.error` viene droppato perché nella queue ci sono 100 `mouse.move`. L'errore critico non raggiunge mai l'observability layer.

**4.D — Throttle/debounce mascherano errori:**
Subscribe a `weather.loaded` con debounce 300ms. Server risponde con error → `weather.failed`. Subscriber ha solo subscribe a `weather.loaded`. Il flusso debounce sul `loaded` non vede mai il `failed`. L'utente vede uno spinner per sempre. Variante: debounce su un flusso che produce sequenza success-success-error-success → l'error viene "saltato" perché il debounce prende l'ultimo, che è success.

**Sintomo / segnale d'allarme:**
- 4.A: utenti segnalano "ho cliccato due volte ma ne è stato preso uno solo".
- 4.B: nessun evento arriva al subscriber dopo il primo.
- 4.C: errori critici "dimenticati", `getMetrics().eventsDropped` cresce ma nessuno guarda.
- 4.D: spinner senza fine, log mostra `failed` pubblicato ma mai consegnato.

**Causa root:**
- Dedupe è una decisione semantica (cosa è "uguale"?) ma il framework la fa sintattica.
- Backpressure manca di concetto di priorità.
- Throttle/debounce è applicato per topic/handler senza considerare la categoria semantica dell'evento (success vs error).

**Strategia di prevenzione:**
- **`dedupeKey` esplicito, mai automatico:** il publisher dichiara il dedupeKey. Default = no dedupe. Il framework non indovina. PRD §11.1 lo prevede già come campo opzionale.
- **DedupeKey deve includere fattori distintivi:** documentato pattern raccomandato `topic + ":" + entityId + ":" + intent`. Esempio: `cart.item.added:product-123:click-abc-456`. Helper `broker.makeDedupeKey({ scope, parts })` per evitare errori manuali.
- **Backpressure priority-aware:**
  - Eventi con `priority: 'critical'` non vengono mai droppati. PRD §11.1 prevede già `priority`.
  - `system.error`, `<topic>.failed` hanno priority `critical` di default.
  - Drop policy applicata solo a eventi `low`/`normal`.
- **Backpressure visibile:** `getMetrics()` espone `eventsDropped` per topic con motivazione (dedupe / overflow / throttle / debounce). Inspector mostra quale evento è stato droppato e perché — non si può "perdere" un evento senza tracciarlo (TOOL-03).
- **Throttle/debounce con error escape:** policy "throttle except errors" — gli eventi di categoria `*.failed`, `*.error` non vengono mai throttle/debouncati. Documentato come default.
- **Test obbligatorio:** "storm test" (TEST-03) verifica che `system.error` sia sempre consegnato anche sotto carico massimo.

**Phase to address:**
- **Fase 1:** definire `priority` sul `BrokerEvent` (CORE-05) e drop policy che la rispetta.
- **Fase 3:** dedupe + throttle/debounce/coalesce nel routing engine (ROUTE-10, ROUTE-11).
- **Fase 6:** metrics + inspector visualizzano eventi droppati (TOOL-03).

**Riferimento PRD:** §11.1, §23.3, §23.4, §25.5, ROUTE-10, ROUTE-11, TOOL-03.

---

### Pitfall 5: Retry policy tossica

**Severità:** HIGH — può causare side effect duplicati lato server e DOS auto-inflitto.

**Cosa va storto:**

**5.A — Retry su 4xx:**
Server risponde 400 (bad request) o 401 (unauthorized) o 422 (validation). Il client retraita 3 volte con backoff. Nessuna delle 3 funzionerà — il client manda payload sbagliato — ma ognuna costa CPU server e log spam.

**5.B — Retry senza idempotency token:**
POST `/api/orders` riceve 502 dal load balancer mentre l'ordine è già stato creato sul backend. Il client retraita → secondo ordine creato. L'utente paga due volte.

**5.C — Backoff senza jitter (thundering herd):**
1000 client perdono connessione SSE simultaneamente (server reboot). Tutti retry a 1s, 2s, 4s, 8s. Il server viene martellato a ondate sincrone.

**5.D — Retry infinito:**
`maxAttempts: undefined` → retry per sempre. Memory leak di pending state, log noise infinito, batteria mobile drenata.

**Sintomo / segnale d'allarme:**
- 5.A: spike di 4xx in server log con `User-Agent` GlueZero, esattamente in tripletta con backoff esatto.
- 5.B: utenti segnalano "mi sono arrivate due email di conferma ordine".
- 5.C: server load picco a intervalli regolari (ondate da backoff sincrono).
- 5.D: tab del browser mangia 100% CPU su un singolo flusso.

**Causa root:**
- Default retry policy non differenzia codici di errore.
- Manca opt-in idempotency.
- Algoritmo backoff senza componente random.
- Default unbounded.

**Strategia di prevenzione:**
- **Default policy retry:** retry SOLO su:
  - errori di rete (no response, timeout)
  - 5xx con `Retry-After` o senza
  - 408 (request timeout), 429 (too many requests, rispettando `Retry-After`)
  - NON retry su 4xx (eccetto 408/429): è bug del client, retry non aiuta.
  - Documentato come default e configurabile per route. PRD §39 punto 8 chiede chiusura esplicita di questo punto.
- **Idempotency token:**
  - Per metodi non-idempotenti (POST), il route può dichiarare `idempotency: { mode: 'auto', headerName: 'Idempotency-Key' }`.
  - Auto-genera UUID v4 per ogni first attempt; lo stesso valore viene riusato sui retry.
  - Server-side è responsabilità del backend deduplicare per quella chiave (documentato come precondizione).
- **Jitter obbligatorio:** backoff esponenziale è `min(maxDelay, base * 2^attempt) * (0.5 + Math.random() * 0.5)` (full jitter). Mai backoff puro deterministico.
- **MaxAttempts obbligatorio:** default `maxAttempts: 3`. Configurazione `maxAttempts: 0` per nessun retry. `maxAttempts: Infinity` consentito ma con warning in dev mode.
- **Retry budget (avanzato):** opzionalmente, un retry budget globale per route (max retry/min) per prevenire DOS auto-inflitto.

**Phase to address:**
- **Fase 3 (Routing/HTTP):** policy retry + idempotency, ROUTE-08, ROUTE-09.
- **Fase 4 (Realtime):** reconnect policy con jitter (RT-05). Scenario 5.C.

**Riferimento PRD:** §23.1, §39 punto 8 ("retry su errori 4xx vs 5xx"), §18.6 (reconnect jitter), ROUTE-08, ROUTE-09, RT-05.

---

### Pitfall 6: Realtime reconnect senza disciplina

**Severità:** HIGH — degrada esperienza realtime e può causare reconnect storm.

**Cosa va storto:**

**6.A — SSE senza `Last-Event-ID` replay:**
Client perde connessione 5s, riconnette. Eventi pubblicati durante i 5s sono persi. SSE fornisce nativamente `Last-Event-ID` per replay, ma il client deve includerlo nell'header `Last-Event-ID` o nel campo `id` ricevuto. Se il client non lo gestisce, il replay non avviene anche se il server lo supporta.

**6.B — WebSocket senza ping/pong + stale detection:**
WebSocket mostra `readyState=OPEN` ma in realtà la TCP è morta dietro un NAT. Nessun nuovo messaggio arriva. Il client crede di essere connesso. L'utente vede dati vecchi senza loading state.

**6.C — Reconnect storm dopo blackout:**
Già coperto in 5.C (jitter), qui col taglio realtime: tutti i client di una pagina pubblica si riconnettono insieme dopo un server reboot. Senza jitter, il server si riprende e cade subito.

**6.D — Tab in background, timer throttled:**
Il browser throttla `setTimeout` < 1s nei tab in background. Heartbeat ping configurato a 30s diventa molto irregolare. Il client crede di essere connesso, in realtà il server l'ha già scollegato per inattività. Quando l'utente torna sul tab, vede dati stantii.

**Sintomo / segnale d'allarme:**
- 6.A: gap nei dati realtime dopo riconnessione, eventi noti al server mai consegnati.
- 6.B: dati ferri ad un certo timestamp, nessun errore in console.
- 6.C: server log mostra spike di nuove connessioni a intervalli regolari.
- 6.D: utente switcha al tab e dopo qualche secondo vede tutti i dati arrivare insieme.

**Causa root:**
- Implementazione SSE/WS naïve, senza considerare lo stato reale della connessione.
- Browser-specific: timer throttling nei tab inattivi è documentato ma non ovvio.
- Server-side keep-alive vs client-side ping non sincronizzati.

**Strategia di prevenzione:**
- **SSE adapter robusto (RT-01):**
  - Memorizza `lastEventId` ogni volta che un evento ha `id`.
  - Su reconnect, EventSource lo invia automaticamente nell'header `Last-Event-ID`. Verificare che il polyfill (se usato) lo faccia.
  - Esporre `lastEventId` in `getDebugSnapshot()` per inspection.
- **WebSocket stale detection (RT-02):**
  - Ping applicativo (non solo TCP keepalive): client invia `{type:'ping'}` ogni N secondi, attende `{type:'pong'}` entro M secondi. Se non arriva, considera la connessione morta e riconnette.
  - Documentare il contratto col server (server deve rispondere al ping).
  - Alternativa: server invia ping periodicamente, client risponde — comunque il client deve detector stale.
- **Reconnect policy (RT-05):**
  - Exponential backoff con full jitter (vedi 5.C).
  - `maxAttempts` configurabile (default `Infinity` per realtime, ma con backoff cap a 30s — meglio reconnect lento che drop totale).
  - Pubblicazione di `system.realtime.disconnected`, `system.realtime.reconnecting`, `system.realtime.connected` come eventi interni → il consumer può mostrare UI di stato.
- **Visibility-aware behavior:**
  - Listener `document.visibilitychange`: quando il tab torna visibile dopo essere stato hidden, forza un round di health-check (ping immediato).
  - Documentare che heartbeat sub-secondo è inaffidabile in background. Default heartbeat ≥ 15s.
- **Test di robustezza (TEST-03):** "riconnessione ripetuta realtime" obbligatorio.

**Phase to address:**
- **Fase 4 (Realtime inbound):** RT-01, RT-02, RT-05, RT-06. Sede naturale.

**Riferimento PRD:** §18.4, §18.6, §39 punto 9 ("regole di riconnessione realtime"), RT-01, RT-02, RT-05, TEST-03.

---

### Pitfall 7: Worker pitfalls (serializzazione e ownership)

**Severità:** HIGH — problemi runtime difficili da diagnosticare.

**Cosa va storto:**

**7.A — Funzioni / classi non serializzabili:**
Plugin invia al worker un oggetto `{ data, transform: (x) => x*2 }`. Structured clone fallisce: `DataCloneError: function () could not be cloned`. Errore generico, nessun hint su quale campo è il colpevole. Sviluppatore disorientato.

**7.B — Date / Map / Set / TypedArray particolari:**
Date funzionano con structured clone, ma se passi attraverso `JSON.stringify` (alcuni adapter lo fanno per "sicurezza") → diventa stringa, perde il tipo. Map/Set funzionano con structured clone, ma molti dev assumono che no. RegExp idem.

**7.C — Memory leak da MessageChannel non chiusi:**
Worker pool crea un `MessageChannel` per task, lo dimentica aperto dopo che il task è completato. Tab "leakka" 4 KB per task. 1000 task → 4 MB persi. Non drammatico, ma cumulativo su sessione lunga.

**7.D — Worker pool senza limite:**
Config `workers: { pool: 'auto' }` interpretato come `unlimited`. Storm di eventi → 200 worker spawnati → memoria browser crash, CPU al 100%.

**7.E — Transferable detached:**
`postMessage(buffer, [buffer])` trasferisce ownership. Il main thread dopo il transfer non può più leggere `buffer`. Se il caller assume ownership condivisa → `byteLength === 0`, comportamento misterioso.

**Sintomo / segnale d'allarme:**
- 7.A: `DataCloneError` in console, payload non arriva mai al worker.
- 7.B: `instanceof Date` ritorna false dopo round-trip.
- 7.C: memory growth lento, devtool memory mostra MessageChannel/MessagePort vivi.
- 7.D: tab freezato, "page unresponsive" del browser.
- 7.E: `buffer.byteLength === 0` post-transfer, error misterioso "input vuoto".

**Causa root:**
- Documentazione structured clone non è scolpita nei dev, il browser non aiuta con messaggi chiari.
- Worker lifecycle non gestito centralmente.
- Pool senza policy di concorrenza.

**Strategia di prevenzione:**
- **Validatore pre-postMessage:**
  - In dev mode, prima di `worker.postMessage(payload)`, una funzione `assertSerializable(payload)` ispeziona ricorsivamente e lancia un `BrokerError` con `code: 'WORKER_SERIALIZATION_FAILED'` puntando al campo specifico (`payload.transform: function — non serializzabile`). Bug killer.
  - In production il check è opzionale (overhead) ma consigliato.
- **Contratto serializzazione documentato (WK-07, PRD §39 punto 11):**
  - "Il broker usa structured clone. Sono supportati: Object, Array, Date, Map, Set, ArrayBuffer, TypedArray, RegExp, Blob. NON supportati: function, DOM nodes, classi con prototype custom."
  - Pattern raccomandato: passare al worker dati puri, e nominare `transformId: 'parseItalianDate'` invece di passare la funzione.
- **Worker pool bounded:**
  - Default `pool: 'auto'` = `min(navigator.hardwareConcurrency, 4)`.
  - `unlimited` richiede opt-in esplicito + warning in dev.
  - Queue oltre il pool size = task in attesa, non spawn nuovo worker. ROUTE-10 backpressure si applica.
- **MessageChannel lifecycle:**
  - Ogni task ha un `taskId` (WK-03). Quando il task completa (success/error/timeout/cancel), il MessageChannel associato viene `port.close()` esplicitamente.
  - Test: `getDebugSnapshot()` espone `activeMessageChannels`. Test asserisce che dopo run completo torni a 0.
- **Transferable opt-in:**
  - Default = clone (sicuro). Per usare transfer, route dichiara `transferable: ['fieldA', 'fieldB']`.
  - Documentazione esplicita: "dopo il transfer, il main thread NON può più accedere a quei campi".
- **Timeout + cancellazione (WK-06):** ogni task ha timeout. Su timeout, `worker.terminate()` se è dedicato, oppure invio messaggio `cancel` al worker se è in pool (con cooperazione del worker).

**Phase to address:**
- **Fase 5 (Worker runtime):** sede naturale. WK-01, WK-03, WK-04, WK-06, WK-07.

**Riferimento PRD:** §19.5 ("dati trasferiti devono essere serializzabili o transferable"), §39 punto 11 ("serializzazione dei messaggi worker"), WK-01, WK-06, WK-07.

---

### Pitfall 8: Cache invalidation e cache-then-network

**Severità:** HIGH — "two hard things in computer science...".

**Cosa va storto:**

**8.A — `cache-then-network` confonde il consumer:**
Route policy `cache-then-network`: pubblica `weather.loaded` da cache (se hit) E POI un secondo `weather.loaded` da rete. Subscriber semplice riceve due eventi consecutivi, mostra dato cache, poi flash → dato rete. Senza segnali, l'utente vede flicker.

**8.B — TTL fisso senza freshness server-side:**
Cache ha TTL 60s. Server cambia la risorsa al secondo 30. Nessun ETag/Last-Modified consultato → il client mostra dato vecchio per altri 30s. In sistemi con dati che cambiano (es. prezzi, disponibilità) è inaccettabile.

**8.C — Cache key collisions:**
Cache key = solo URL. Ma due query diverse hanno la stessa URL canonica con query string diversa, e il key normalization non normalizza l'ordine: `?a=1&b=2` vs `?b=2&a=1` → entrate cache distinte (waste). Oppure peggio, `/api/orders` con auth user A salva cache che serve a user B.

**8.D — Mutazione di valore cache:**
Cache restituisce un riferimento condiviso. Il consumer modifica il payload (mutation accidentale) → la prossima cache hit serve dati corrotti.

**Sintomo / segnale d'allarme:**
- 8.A: utente vede flash di dati vecchi → nuovi.
- 8.B: utente segnala "vedo prezzi vecchi finché non ricarico".
- 8.C: utente A logout → utente B vede dati di A. **Critico per sicurezza.**
- 8.D: comportamento bizzarro che dipende dall'ordine in cui i widget si renderizzano.

**Causa root:**
- API cache che pubblica due eventi senza distinzione.
- TTL come unica policy, ignorando ETag.
- Cache key naïve.
- Cache come riferimento, non come copia immutabile.

**Strategia di prevenzione:**
- **`cache-then-network` con metadata di origine (CACHE-03, PRD §20.4):**
  - L'evento pubblicato dalla cache ha `source.type: 'cache'` e `metadata.origin: 'cache'`.
  - L'evento successivo dalla rete ha `source.type: 'server'`, `metadata.origin: 'remote'`, `metadata.replaces: <eventId>` se sostituisce uno precedente.
  - Subscriber può scegliere: ignora `cache`-origin, o renderizza con un indicator "stale".
  - Documentato chiaramente: il consumer può vedere due eventi.
- **Conditional requests via ETag/Last-Modified:**
  - Cache record include `etag`, `lastModified`.
  - Su revalidation, request include `If-None-Match` / `If-Modified-Since`. 304 = cache record valido, refresh TTL. 200 = nuovo dato.
  - Opzionale per V1 ma raccomandato. CACHE-02 (TTL configurabile) come default; ETag come estensione configurabile.
- **Cache key canonicalization:**
  - Helper built-in: `canonicalKey({ url, query, scope: { userId } })`.
  - `query` viene ordinato lessicograficamente prima di hash.
  - **`scope` obbligatorio per cache di dati user-specific:** se un route serve dati associati a un utente loggato, la cache key deve includere lo `userId` o un `scopeId`. Documentato come precondizione di sicurezza. Default V1: cache key sempre scope-aware quando il route ha auth policy.
  - Cache deve invalidarsi automaticamente al logout (publish `system.auth.logout` → flush cache user-scoped).
- **Immutabilità del valore cache:**
  - Cache restituisce un deep clone (o usa `structuredClone`) del valore. Mai un riferimento al record interno.
  - Costo perf accettabile per la safety; documentato per chi vuole opt-out.
  - Alternativa: deep freeze + Object.freeze (ma non funziona con tipi custom in tutti i casi).

**Phase to address:**
- **Fase 6 (Cache + tooling):** sede naturale. CACHE-01, CACHE-02, CACHE-03.
- **Fase 3 (Routing):** route HTTP deve passare ETag/Last-Modified al cache layer (anche se cache è Fase 6, il contratto va previsto).

**Riferimento PRD:** §20, §20.4, CACHE-01, CACHE-02, CACHE-03.

---

### Pitfall 9: Plugin isolation insufficiente

**Severità:** HIGH — un plugin malformato non deve poter abbattere il broker.

**Cosa va storto:**

**9.A — Eccezione sincrona in handler crasha il broker:**
Plugin handler fa `throw new Error('boom')` in un callback sincrono. Se il broker fa `subscribers.forEach(h => h(event))` senza try/catch, l'eccezione propaga e gli altri subscriber non ricevono l'evento.

**9.B — Promise rejected non gestita:**
Handler async ritorna Promise rejected. Il broker fa `await h(event)` senza try/catch → unhandled rejection. Se è dentro un `Promise.all`, fa fallire tutti i subscriber.

**9.C — Handler bloccante (busy loop):**
Plugin handler fa `while(true) { computeStuff() }`. Il main thread si blocca. Tutti i subscriber successivi non eseguono.

**9.D — Plugin che mantiene riferimento a payload:**
Plugin handler salva il payload ricevuto in una variabile globale e lo modifica. Altri subscriber che ricevono lo stesso payload vedono i dati modificati (se il broker passa per riferimento, vedi 11.C).

**Sintomo / segnale d'allarme:**
- 9.A/9.B: alcuni subscriber non reagiscono dopo che un altro ha lanciato eccezione.
- 9.C: tab freezato dopo specifico evento.
- 9.D: comportamento dipendente dall'ordine di registrazione subscriber.

**Causa root:**
- Mancanza di sandbox (impossibile in JS senza Worker, ma try/catch è il minimo).
- Mancanza di immutabilità del payload.

**Strategia di prevenzione:**
- **Try/catch obbligatorio attorno ad ogni handler invocation:**
  ```ts
  for (const h of subscribers) {
    try {
      const result = h(event);
      if (result instanceof Promise) {
        result.catch(err => publishSystemError({ pluginId: h.ownerId, err, eventId: event.id }));
      }
    } catch (err) {
      publishSystemError({ pluginId: h.ownerId, err, eventId: event.id });
      // continue con i prossimi subscriber
    }
  }
  ```
- **Pubblicazione automatica di `plugin.handler.error`:** ogni eccezione/rejection genera un evento standardizzato (PRD §22.3 prevede `mapping.error`, `worker.error`, ecc.; aggiungere `plugin.handler.error`).
- **Circuit breaker sui plugin "tossici":** se lo stesso pluginId genera N errori in M secondi, il broker disabilita temporaneamente le sue subscription e pubblica `plugin.disabled` con motivazione. Avanzato ma protegge da plugin malevoli o broken.
- **Watchdog timer (busy loop detection):** in dev mode, ogni handler invocation è racchiuso in un timeout (`setTimeout` "watchdog" che si aspetta che la chiamata sia stata invocata ma non garantisce che il sync code abbia ritornato). Difficile in JS sync, ma possibile log se il publish completo richiede > N ms ("subscriber slow"). Per task lunghi, raccomandare worker (route worker).
- **Payload immutabile per default (vedi Pitfall 11.C):** deep freeze del payload prima di consegnare ai subscriber, oppure deep clone. Documentato come default V1.
- **Promise handler pattern:** lasciare il return type di handler come `void | Promise<void>`. Promise pending non sono attese (fire-and-forget) ma le rejection vengono catturate.

**Phase to address:**
- **Fase 1 (Core):** try/catch + payload freeze. Fondamentale.
- **Fase 6 (Tooling):** circuit breaker + plugin disable visualizzato in inspector.

**Riferimento PRD:** §22.2 ("non collassare il runtime globale"), §22.3 (eventi standard di errore), ERR-03, CORE-07.

---

### Pitfall 10: Validation noise e silenzi

**Severità:** MEDIUM — qualità del developer experience.

**Cosa va storto:**

**10.A — Schema troppo strict:**
Schema canonico ha `additionalProperties: false`. Plugin invia campo `_debug` extra. Validazione fallisce. Plugin perfettamente funzionale viene bloccato.

**10.B — Schema troppo lax:**
Nessuna validazione, oppure schema vuoto. Server invia `{ temp: "ventuno" }` invece di `{ temp: 21 }`. Tutto passa, widget mostra `NaN`.

**10.C — Validation overhead:**
JSON Schema con AJV, validazione su ogni evento, ogni mapping. 5000 eventi/sec → 30% CPU su validazione. Ottimizzazione prematura senza misurare.

**10.D — Errori validation muti:**
Validazione fallisce, evento droppato, nessun errore visibile. Sviluppatore in dev mode passa ore a chiedersi perché il widget non si aggiorna.

**Sintomo / segnale d'allarme:**
- 10.A: plugin che funzionavano in test smettono in produzione perché un campo extra appare.
- 10.B: NaN, undefined, dati visivamente sbagliati senza error in console.
- 10.C: profiler mostra `validateEvent` come hot path.
- 10.D: dev legge codice del broker per capire perché evento non arriva.

**Causa root:**
- Default schema policy non consapevole.
- Mancanza di event log degli errori validation.
- Validazione su ogni evento, sempre, anche dove non serve.

**Strategia di prevenzione:**
- **Default schema: tollerante in input, strict in output:**
  - Input plugin: `additionalProperties: true` di default (no breaking se il plugin invia campi extra; ignorati nel mapping). Robustness principle.
  - Output canonico: `additionalProperties: false` di default (il modello canonico è autoritativo). Configurabile.
- **Validazione visibile sempre (VAL-01..05 + ERR-01):**
  - Ogni fallimento di validazione pubblica un `validation.error` (categoria specifica: `schema.event`, `schema.canonical`, `schema.post-mapping`, `schema.server-response`).
  - In dev mode, console.warn dell'errore con struttura completa: schema, payload, path, expected vs received.
  - In production, evento `validation.error` con `level: 'warn'` nel logging layer; non bloccante salvo configurazione esplicita "strict mode".
  - Mai silenzioso. Mai. PRD §21.4: "registrare l'errore nel debug/logging".
- **Validazione opt-out per topic ad alto volume:**
  - Schema definitions includono `validation: 'always' | 'dev-only' | 'never'`.
  - Default `dev-only` per topic con `priority: 'low'` (es. `mouse.move`).
- **Compilazione schema una volta sola:**
  - Schema viene compilato (es. AJV `compile`) al `registerCanonicalSchema` / `registerPlugin`. Il validator function compilato è usato runtime. No re-parsing per evento.
- **Bench obbligatorio prima di ottimizzare:** nessuna ottimizzazione di validazione senza profilo che mostri >5% CPU sul path. Documentato.

**Phase to address:**
- **Fase 1 (Core):** validazione evento (sintattica) + logging visibile (VAL-01).
- **Fase 2 (Mapper):** validazione canonica + post-mapping (VAL-03, VAL-04).
- **Fase 3 (Routing):** validazione risposta server (VAL-05).

**Riferimento PRD:** §21, §21.4, VAL-01..06, ERR-01, ERR-02.

---

### Pitfall 11: API design tranelli

**Severità:** BLOCKING — API rotta = riscrittura.

**11.A — `subscribe` ritorna `void`:**
Tipica DX-killer. Senza handle, impossibile fare `unsubscribe`. Vedi Pitfall 1.

**Prevenzione:** firma obbligatoria `subscribe(topic, handler, opts?): Subscription` con `Subscription.unsubscribe()` e `Subscription.id`.

**11.B — Topic naming inconsistente:**
A volte `weather.requested`, a volte `weather:requested`, a volte `weather/loaded`. Plugin di terze parti seguono convenzioni diverse → nessuno match.

**Prevenzione:**
- **Naming convention scolpita (CORE-08, PRD §12):** dot-separated, lowercase, segments alfanumerici. Documentata e validata al `registerCanonicalSchema` / `registerPlugin`.
- Validator runtime: `registerPlugin` rifiuta topic con caratteri proibiti (`:`, `/`, spazi) con errore esplicito.
- Eventuale helper `topic('weather', 'requested') === 'weather.requested'` per evitare typo.

**11.C — Mutazione condivisa del payload:**
Broker passa lo stesso oggetto payload a 5 subscriber. Subscriber A fa `payload.temp = celsiusToFahrenheit(payload.temp)`. Subscriber B (chiamato dopo) riceve payload modificato. Subscriber B mostra valori sbagliati. Bug fra i più subdoli del paradigma.

**Prevenzione (decisione critica V1, va documentata):**
- **Default V1: deep freeze del payload prima della consegna (immutability contract).** Evita la maggior parte dei bug. Consumer che vuole "mutare" deve clonare manualmente.
- Alternativa scartata: deep clone per ogni subscriber (overhead alto su molti subscriber).
- Alternativa scartata: trust contract documentato (impossibile far rispettare).
- Deep freeze in dev mode (errore se mutazione tentata: `TypeError: Cannot assign to read only property`). In production, il freeze ha overhead minimo.
- Documentato esplicitamente: "il payload consegnato ai subscriber è immutabile. Per mutare, clonare prima."

**11.D — Opzioni publish/subscribe non discoverable:**
Opzioni come `priority`, `dedupeKey`, `ttlMs`, `correlationId` esistono ma sono nel campo metadata, sparse, non documentate.

**Prevenzione:** Tipi TypeScript espliciti per `PublishOptions`, `SubscribeOptions`. Ogni opzione ha JSDoc inline. Esempi nel readme.

**Sintomo / segnale d'allarme:**
- 11.A: nessun unsubscribe possibile, segnalazione esplicita.
- 11.B: plugin third-party "non vede" eventi che dovrebbe vedere — naming mismatch.
- 11.C: bug intermittenti dipendenti dall'ordine di subscription.
- 11.D: dev legge il codice sorgente per scoprire un'opzione.

**Phase to address:**
- **Fase 1:** TUTTE le decisioni API critiche. Cambiarle dopo è breaking.

**Riferimento PRD:** §11, §12, §15.6, §16, CORE-02, CORE-08.

---

### Pitfall 12: TypeScript pitfalls

**Severità:** MEDIUM (BLOCKING per DX).

**Cosa va storto:**

**12.A — Topic name come `string`:**
`subscribe(topic: string, ...)`. Tipo del payload è `unknown`. Nessuna inferenza, nessun autocomplete, nessun typo-check. DX scarsa.

**12.B — `any` propagato:**
Mapper engine ritorna `any` perché payload è "generico". `any` invade il codice client.

**12.C — Estendibilità dei canonical fields da utente:**
Utente aggiunge un campo canonico custom. Senza declaration merging, deve casttarlo come `any`.

**Strategia di prevenzione:**
- **Topic registry tipizzato (template literal types):**
  ```ts
  // Utente o plugin estendono via declaration merging:
  declare module 'sembridge' {
    interface TopicMap {
      'weather.requested': { city: string; date: string };
      'weather.loaded': { temperature: number; condition: string };
    }
  }
  // API:
  broker.subscribe<'weather.loaded'>('weather.loaded', (event) => {
    event.payload.temperature  // ← number, inferito
  });
  ```
  - Wildcard subscribe: `broker.subscribe('weather.*', ...)` ritorna union di payload. Difficile ma fattibile con template literal types.
  - Topic naming convention forzato a livello di tipo: `T extends \`${string}.${string}\` ? T : never`.
- **Mai `any` nel core public API:**
  - `unknown` è accettabile (forza il consumer a narrow).
  - `any` è proibito da lint rule (`@typescript-eslint/no-explicit-any`).
- **Declaration merging documentato per estensioni utente:**
  - `CanonicalFieldMap`, `TransformRegistry`, `TopicMap` sono tutte interface estendibili.
  - Esempi nella documentazione.
- **Brand types per ID:**
  - `type SubscriptionId = string & { __brand: 'SubscriptionId' }` previene confusione tra `pluginId`, `eventId`, `subscriptionId`, `correlationId`.

**Phase to address:**
- **Fase 1:** stabilire le primitive di tipo (TopicMap, SubscriptionId branded). Difficile riprendere dopo.

**Riferimento PRD:** §31.2 (TypeScript per solidità contratto), PKG-02.

---

### Pitfall 13: Build / distribution

**Severità:** MEDIUM.

**Cosa va storto:**

**13.A — ESM-only blocca utenti CommonJS:**
Distribuzione solo ESM. Un team usa ancora CommonJS in Node test runner. Importare la libreria fallisce con `ERR_REQUIRE_ESM`.

**13.B — Dual-package hazard:**
Pubblichi dual ESM + CJS via `exports` field. Risolutori diversi caricano "due copie" della libreria → due `BrokerRegistry`, due `WeakMap` separate, plugin registrati nell'uno non visti dall'altro. Bug fantasma.

**13.C — Side effects in import:**
Top-level di un modulo registra qualcosa in un singleton globale. Tree-shaker non può rimuoverlo perché ha side effect → bundle gonfiato anche se l'utente non usa la feature.

**13.D — Sourcemap troppo verbose in produzione:**
Sourcemap con sources inline. Bundle production +200%. Esposizione codice sorgente ai client.

**Strategia di prevenzione:**
- **Distribuzione primaria ESM (PRD §31.1, PKG-01).** Documentato come precondizione.
- **CJS come opt-in via dual export `package.json#exports`** SOLO se richiesto da utenti reali. Iniziare ESM-only, aggiungere CJS in V1.x se serve.
- **No singleton globale:** il broker è creato esplicitamente da `createBroker(config)`. Nessun stato globale modulo-livello. Ogni `createBroker` è isolato. Risolve dual-package hazard alla radice.
- **`"sideEffects": false`** in package.json. Tree-shaking aggressivo. Verificare con bundle analyzer.
- **Sourcemap separati:** file `.map` esterni, NON inline. `sources: false` o sourceContent escluso.
- **Polyfill separati (PRD §31.3, PKG-03):** core targeta evergreen browsers. Polyfill in entry point dedicato `sembridge/polyfills`.
- **Build pipeline:**
  - tsup o rollup per bundle.
  - Output: `dist/index.js` (ESM), `dist/index.d.ts` (types). UMD opzionale `dist/gluezero.umd.js`.
  - Type-check separato dal bundle (`tsc --emitDeclarationOnly`).

**Phase to address:**
- **Fase 1:** scegliere build system, no-singleton, sideEffects:false. Difficile cambiare dopo.
- **Fase 6 / pre-release:** verifica bundle size, sourcemap config.

**Riferimento PRD:** §31, PKG-01, PKG-02, PKG-03.

---

### Pitfall 14: Open issues PRD §39 lasciate implicite

**Severità:** BLOCKING — il PRD lo proibisce esplicitamente.

Il PRD §39 elenca 11 punti che "non devono restare impliciti o non documentati nel codice finale". Ognuno è un pitfall potenziale se non chiuso. Per ciascuno: **decisione raccomandata + dove documentarla nel codice + fase**.

| # | Open Issue | Decisione raccomandata | Phase |
|---|------------|------------------------|-------|
| 1 | Precedenza alias automatici vs mapping esplicito | **Mapping esplicito vince sempre.** Alias usati solo se nessun mapping esplicito. Warning runtime quando alias risolto (MAP-16). | Fase 2 |
| 2 | Ordine pipeline mapping/validazione | **Pipeline ufficiale PRD §28.1**, già definito: ricezione → metadata → validazione sintattica → source → mapping output→canonico → validazione canonico → dedupe/backpressure → resolve route → cache/http/worker/realtime/local → mapping canonico→input consumer → validazione finale → consegna → logging. Implementato come funzione single-pass `processEvent()` testabile, ogni step isolato. | Fase 1 (skeleton) + Fase 2/3/4/5/6 (riempimento step). |
| 3 | Field mancante: errore o default? | **Configurabile per campo nel canonical schema:** `required: true` (errore), `required: false` (default value se dichiarato, `undefined` altrimenti). Documentato. Il mapping pipeline rispetta la dichiarazione. | Fase 2 |
| 4 | Transform failure: skip o block? | **Configurabile per transform:** `onFailure: 'block' | 'skip' | 'fallback'`. Default `'block'` (l'evento è dropped, error pubblicato). `'skip'` ignora la transform, prosegue con valore raw. `'fallback'` usa un valore di default. Documentato. | Fase 2 |
| 5 | Topic senza route | **Comportamento default: solo locale.** Il topic viene consegnato ai subscriber locali. NON è un errore. Se l'autore vuole forzare "deve esserci una route", lo dichiara nel topic schema con `requiresRoute: true`. | Fase 3 |
| 6 | Più route applicabili allo stesso topic | **Tre policy supportate, dichiarate per topic o globalmente:** `'first-match'` (prima route registrata vince), `'priority-ordered'` (route hanno campo `priority`, eseguite in ordine), `'all'` (eseguite tutte, eventi multipli pubblicati). Default `'first-match'` con warning in dev mode se altre route matchano. | Fase 3 |
| 7 | Unsubscribe automatico in unregister plugin | **Cascade obbligatoria.** Vedi Pitfall 1. `unregisterPlugin` rimuove tutte le subscription, route, worker task pending, listener realtime, AbortController in volo del plugin. Verificato da test deterministico. | Fase 1 |
| 8 | Retry 4xx vs 5xx | Vedi Pitfall 5: **retry NON su 4xx (eccetto 408, 429); retry su 5xx, network errors, timeout. Configurabile per route.** | Fase 3 |
| 9 | Reconnection rules | Vedi Pitfall 6: **exponential backoff + full jitter, maxAttempts default Infinity con cap a 30s, eventi `system.realtime.*` per stato.** Heartbeat applicativo per WS. `Last-Event-ID` per SSE. | Fase 4 |
| 10 | Formato metriche | **Decisione:** struttura JSON-serializable, semantica simil-OpenMetrics ma senza dipendenze esterne. Esposta da `getMetrics()`. Schema documentato: `{ counters: Record<string, number>, gauges: Record<string, number>, histograms: Record<string, { count, sum, buckets }> }`. Plugin opzionale per export Prometheus. | Fase 6 |
| 11 | Serializzazione messaggi worker | Vedi Pitfall 7: **structured clone come standard, supporto transferable opt-in. Funzioni NON consentite — usare `transformId` registrato.** Validatore pre-postMessage in dev mode. | Fase 5 |

**Strategia generale:** ogni decisione è documentata in:
1. Codice come constant + JSDoc esplicativo (es. `const DEFAULT_RETRY_POLICY = ...`).
2. Documentazione `DOC-04` (route engine) e `DOC-03` (canonical model).
3. Test che verifica il comportamento (test-as-spec).

**Phase to address:** distribuita su tutte le fasi, vedi tabella sopra.

**Riferimento PRD:** §39 (tutti gli 11 punti).

---

### Pitfall 15: SemVer e plugin versioning

**Severità:** MEDIUM (HIGH per ecosistema plugin di terze parti).

**Cosa va storto:**

**15.A — Modifica al canonical model = breaking?**
Aggiungere un alias a un campo canonico esistente: minor (additive). Cambiare il tipo: major (breaking). Aggiungere un campo canonico nuovo: minor. Rimuovere un campo: major. Senza policy esplicita, ogni release rischia di rompere plugin.

**15.B — Plugin descriptor `version: string`: usarlo come?**
Il descriptor ha `version`. È usato per cosa? Logging? Compatibility check con GlueZero core? Nessuno lo sa.

**Strategia di prevenzione:**
- **SemVer policy esplicita per il core:**
  - MAJOR: cambio firma API pubblica, rimozione campo canonico, cambio tipo canonico, cambio comportamento default.
  - MINOR: nuovo metodo API, nuovo campo canonico, nuovo alias, nuova feature opt-in.
  - PATCH: bugfix, performance, no contract change.
  - Documentato in `CONTRIBUTING.md` e `RELEASE.md`.
- **Plugin compatibility metadata:**
  - PluginDescriptor estende: `requires?: { sembridge: string; canonicalSchemas?: Record<string, string> }`.
  - Esempio: `requires: { sembridge: '^1.0.0', canonicalSchemas: { weather: '^1.0' } }`.
  - `registerPlugin` fa range check via semver. Mismatch = errore esplicito al register, non a runtime.
- **Plugin `version`:**
  - Usato per: deduplica registrazione (stesso pluginId con version diversa = warning), debug snapshot, metriche per-plugin, eventuale plugin marketplace.
  - Documentato cosa NON fa: non serve per migrations automatiche di dati.
- **Canonical schema versioning (vedi Pitfall 3.C):**
  - Schema canonico ha `version` field. Plugin può richiedere range. Migrations helpers built-in per cambi minor.

**Phase to address:**
- **Fase 1:** definire SemVer policy + plugin `requires` field.
- **Fase 2:** versioning del canonical schema.
- **Fase 6 / pre-release:** documentazione dettagliata.

**Riferimento PRD:** §15.2 (descriptor con `version`), §30.3 ("versioni incompatibili" come errore da gestire).

---

### Pitfall 16: Performance pitfalls

**Severità:** MEDIUM (HIGH se la libreria viene usata in pagine high-frequency).

**Cosa va storto:**

**16.A — Wildcard subscribe non ottimizzato:**
`subscribe('weather.*', handler)`. Su `publish('weather.loaded')`, il broker fa scan lineare di tutte le subscription per trovare quelle wildcard che matchano. 1000 subscription × 5000 eventi/sec = 5M op/sec di pattern match. CPU al 100%.

**16.B — Mapping engine ricompila la pipeline ogni evento:**
Per ogni `publish`, il mapper costruisce dinamicamente la pipeline (parse delle map, lookup delle transform, composition di funzioni). 99% del lavoro è ridondante.

**16.C — Debug mode lasciato on in produzione:**
`enableDebug()` chiamato in dev, dimenticato in production build. Snapshot ogni evento, log verbose, frame inspector. CPU + memoria dilapidati.

**Strategia di prevenzione:**
- **Trie / prefix tree per wildcard subscribe:**
  - Subscriber registry organizzato come trie sui segmenti del topic. `weather.loaded` → traversa `weather` → trova subscriber wildcard `weather.*` e specifici `weather.loaded` in O(segments) invece di O(N).
  - Implementabile pulitamente, ben testato (Mosca/Mqtt usano questa struttura).
- **Pipeline mapping pre-compilata:**
  - Al `registerPlugin`, il mapper compila `inputMap` e `outputMap` in funzioni JavaScript native (oppure in array di "step" già risolti). Salvati nel descriptor compilato.
  - Runtime: lookup O(1) della pipeline, esecuzione lineare degli step. Niente parsing.
  - Stesso pattern di JSON Schema validators (AJV compile vs validate).
- **Debug mode auto-off in production:**
  - `enableDebug()` in production fa warning console: "Debug mode is on in production build. This degrades performance."
  - Build flag `process.env.NODE_ENV === 'production'` può forzare debug off (configurabile).
  - Opzionale: `enableDebug({ confirm: true })` richiede flag esplicito in production.
- **Metriche light-weight di default:**
  - Counter increments sono cheap (atomic ops). Histograms hanno buckets pre-allocati.
  - Detailed event logging richiede `enableDebug()`. Default è solo counter/gauges.
- **Bench in CI:**
  - Suite di benchmark (es. publish/subscribe throughput, mapping throughput) eseguita in CI. Regressione > 10% = warning.
  - Non bloccante (variance hardware), ma visibilità.

**Phase to address:**
- **Fase 1:** trie per subscriber registry, decisione architetturale che impatta tutte le fasi.
- **Fase 2:** mapping compile.
- **Fase 6:** debug mode protection, metrics tuning.

**Riferimento PRD:** §34 (performance qualitative goals), §34.2.

---

### Pitfall 17: Sicurezza

**Severità:** HIGH.

**Cosa va storto:**

**17.A — Token in localStorage:**
Auth adapter dell'utente legge token da `localStorage` e lo include nei route HTTP. Vulnerabile a XSS — qualsiasi script injected può rubare il token. PRD §26.3 avverte chiaramente che la lib è governance, non sostituto di sicurezza.

**17.B — CORS configurato lato client:**
Sviluppatore inesperto pensa di poter "configurare CORS" via la libreria. CORS è server-side. La libreria può solo includere/escludere `credentials: 'include'` nei fetch.

**17.C — URL allowlist bypass via redirect:**
Allowlist `[/api/*]`. Server risponde con 302 verso `evil.com`. fetch segue il redirect (default `redirect: 'follow'`). Token allegato per il primo request finisce su evil.com nel secondo (in alcuni browser/configurazioni).

**17.D — Auth header su tutti i route, anche cross-origin:**
Un route HTTP punta a un endpoint third-party (es. CDN pubblico). Auth adapter aggiunge il token a tutti i request → token leakato a third party.

**Strategia di prevenzione:**
- **Documentazione esplicita su token storage:**
  - "La libreria non gestisce dove memorizzi il token. Raccomandazioni:
    - Per token long-lived: cookie httpOnly + secure + sameSite (NON accessibile dalla libreria, browser lo invia automaticamente).
    - Per access token short-lived: in-memory (variabile JS), refreshato via cookie httpOnly.
    - localStorage è sconsigliato (XSS exposure)."
  - Esempio di auth adapter "good practice" nel readme.
- **Auth scope per route:**
  - `auth: { mode: 'bearer' | 'cookie' | 'none', endpoints: 'all' | string[] }`.
  - Default `endpoints: 'allowlist'` — auth applicato solo agli endpoint dichiarati. Cross-origin opt-in esplicito.
  - Token non viene mai allegato a redirect cross-origin.
- **URL allowlist con redirect handling:**
  - Route HTTP ha `redirect: 'follow' | 'manual' | 'error'`. Default `'follow'` ma con re-validation della URL finale contro l'allowlist.
  - Helper di validazione documentato.
- **CSP / SRI guidance:**
  - Documentazione raccomanda Content-Security-Policy strict per la pagina che usa GlueZero.
  - Subresource Integrity per CDN-loaded plugin (raccomandato).
- **Realtime authentication:**
  - SSE/WS auth: token in query string è leakato in log → preferire header (per WS, subprotocol o auth message dopo connect).
  - Documentato nel routing della Fase 4.
- **No segreti hardcoded:**
  - Documentazione "config pubblica vs segreti server-side" (PRD §26.2).
  - Lint rule opzionale per detecting common patterns (key = "...").

**Phase to address:**
- **Fase 3 (HTTP gateway):** auth scoping, allowlist con redirect, ROUTE-07.
- **Fase 4 (Realtime):** auth realtime.
- **Pre-release:** doc di sicurezza completa.

**Riferimento PRD:** §26, §26.3, ROUTE-07.

---

## Technical Debt Patterns

Shortcut che sembrano ragionevoli ma creano problemi a lungo termine.

| Shortcut | Beneficio immediato | Costo a lungo termine | Quando accettabile |
|----------|---------------------|----------------------|---------------------|
| `subscribe` ritorna void invece di handle | API "minimal", meno tipi | Memory leak garantiti, breaking se cambia firma | **Mai** — è il tranello primario |
| Strong refs everywhere senza cleanup esplicito | Implementazione semplice | Memory leak nelle SPA | Solo in PoC pre-Fase-1 |
| Validazione opt-in (default off) | Performance "out of the box" | Errori muti, debug impossibile | Mai per V1; opt-out per topic high-frequency dopo profiling |
| Mapping ricompilato per evento | Codice mapper più semplice | CPU 30%+ su pagine attive | Solo in early prototype, da rifattorizzare in Fase 2 |
| ESM-only + nessun CJS | Minor build complexity | Esclude utenti Node CJS / legacy bundler | OK per V1 se utenti target sono moderni; aggiungere CJS in V1.x se richiesto |
| Singleton globale `defaultBroker` | API semplice (`import { broker } from 'sembridge'`) | Test isolation impossibile, dual-package hazard, multi-broker per micro-frontend impossibile | **Mai** — `createBroker(config)` esplicito sempre |
| Topic come string raw senza tipi | Setup TypeScript più semplice | Typo silenziosi, refactor terrificante | Mai per V1 — usare TopicMap declarable |
| Payload mutabile (no freeze) | Performance marginalmente meglio | Bug ordine-dipendenti subdoli | Mai di default; opt-out con flag `unsafe-mutable-payloads` |
| Retry default `Infinity` | Nessun timeout artificiale | DOS auto-inflitto, batteria | Solo per realtime reconnect (con backoff cap) |
| Cache key = solo URL | Implementazione semplice | Cache leak cross-user, security breach | Mai per route auth'd |
| Debug mode default on | DX migliore | Performance disastrosa in production | Solo se c'è un guard `NODE_ENV === 'development'` |
| Stack trace in error events sempre | Debug facile | Bundle size + leak di paths | OK in dev, off in production tramite build flag |

---

## Integration Gotchas

Errori comuni quando si collega GlueZero a servizi esterni.

| Integration | Errore comune | Approccio corretto |
|-------------|---------------|---------------------|
| Framework UI (React/Vue) | `subscribe` in render senza cleanup | `useEffect(() => { const sub = broker.subscribe(...); return () => sub.unsubscribe(); }, [])` o equivalent. Documentato negli esempi. |
| Auth provider (es. Auth0, Cognito) | Token storage in localStorage | Cookie httpOnly o in-memory; auth adapter passa per `getToken()` callback async |
| Realtime backend (es. Pusher, Ably, custom SSE) | Reconnect manuale + state custom | Usare gateway GlueZero (RT-01), reconnect policy unificata |
| Worker bundler (esbuild/Vite) | `new Worker(new URL(...))` rotto post-build | Usare worker registry centrale + bundle-aware factory (WK-01) |
| State manager (Redux, Zustand) | Subscribe diretto in store reducer | Subscriber separato che dispatch action; mai mutare store dentro handler |
| Service Worker (push notifications) | Tentativo di registrare subscribe SW dentro page broker | V1 esclude SW bridge (PRD §18.7); documentare workaround per V1.x |
| Test runner (vitest/jest) | Broker globale condiviso tra test | `createBroker()` per ogni test; cleanup in afterEach |
| Multi-tab (BroadcastChannel) | Assumere stato condiviso tra tab | Out of scope V1; documentare se richiesto |
| Server response non-JSON | Parser JSON forzato | Route HTTP dichiara `responseType: 'json' | 'text' | 'blob' | 'arraybuffer'` |
| Server response stream (NDJSON, chunked) | fetch().json() blocca fino al fine | Out of scope V1; usare SSE o WS per streaming |
| CORS preflight | Aggiunti header custom che triggerano preflight involontariamente | Documentare quali header GlueZero aggiunge by default; pattern minimale |
| Time-dependent transforms (`parseItalianDate`) | Timezone-dependent failures (test in CET passa, CI in UTC fallisce) | Trasformazioni date sempre con TZ esplicita; documentato nel transform contract |

---

## Performance Traps

Pattern che funzionano in piccolo ma falliscono al crescere dell'uso.

| Trap | Sintomi | Prevenzione | Quando si rompe |
|------|---------|-------------|------------------|
| Wildcard scan lineare | CPU spike su `publish` ad alta freq, profiler mostra `matchTopic` hot | Trie per Subscriber Registry | > 100 subscription wildcard, > 1000 events/sec |
| Mapping non compilato | Mapper hot path nel profiler | Pre-compile pipeline al `registerPlugin` | > 500 events/sec attraverso mapping |
| Validazione AJV uncompiled | `validateEvent` hot path | Compile schema al register | > 1000 events/sec |
| Deep clone per ogni subscriber | Memory churn, GC frequente | Deep freeze (no clone) come default | > 10 subscriber su topic high-freq |
| Debug snapshot per ogni evento | Memory growth, log spam | Snapshot solo on-demand (`getDebugSnapshot()`) | Sempre attivo in production |
| Worker spawn senza pool | Spike di worker al primo storm di eventi | Pool bounded `min(hardwareConcurrency, 4)` | > 100 task quasi-concorrenti |
| Cache senza eviction | Memory growth indefinita | LRU con maxSize, TTL | > 10k entry distinte |
| Realtime senza heartbeat | Connection stale non rilevate | Ping/pong + visibility API | NAT lunghi, mobile, tab in background > 30s |
| Sourcemap inline in production | Bundle 2-3x più grande | Sourcemap esterni | Sempre |
| `JSON.stringify` per dedupeKey su payload grande | Hash slow su payload da MB | DedupeKey deve essere shallow / esplicito | Payload > 100KB |
| Subscriber list mutata durante iterazione | Bug intermittente "alcuni handler skipped" | Snapshot della lista prima di iterare | Race tra subscribe e publish concorrenti (in JS è meno comune ma può accadere con microtask) |
| Logging sincrono blocking | Main thread frame jitter | Log batch async (microtask coalescing) | > 100 log/sec |

---

## Security Mistakes

Sicurezza domain-specific, oltre alle basics OWASP.

| Errore | Rischio | Prevenzione |
|--------|---------|-------------|
| Token in localStorage | XSS ruba sessione | Cookie httpOnly + secure + sameSite; raccomandato in doc |
| Auth header su redirect cross-origin | Token leakato a third-party | URL re-validation post-redirect contro allowlist |
| Eventi `system.error` con stack trace completo serializzato | Leak di paths/segreti in error reporting | Sanitize stack in production, full stack solo in dev |
| Plugin di terze parti che pubblica eventi `system.*` | Plugin malevolo si maschera da broker | Topic prefix `system.*`, `internal.*` riservati al core; `registerPlugin` rifiuta plugin che dichiarano `publishes` su questi topic |
| Worker che riceve credenziali nel payload | Worker context "trusted" ma debug-friendly = leak | Token MAI nel payload event; auth adapter applica header al fetch boundary, non nel payload |
| Realtime SSE/WS senza auth | Chiunque con CSRF può aprire stream e ricevere dati altri utenti | Auth obbligatorio sui canali realtime; documentato |
| Cache key senza scope user | User A logout → User B vede dati A | Cache key sempre scope-aware quando route ha auth |
| Eventi cross-origin via window.postMessage | Plugin in iframe può iniettare eventi falsi | V1 non supporta cross-origin event injection; documentare come escluso |
| `eval` o `Function()` per trasformazioni dichiarative | Code injection da config server-driven | Solo trasformazioni registrate via `registerTransform(name, fn)`; mai `eval` |
| Timing attack via metrics | Metrics espose tempi che leakano info | Metrics aggregati (avg, p95), mai per-event in production endpoint |
| Plugin descriptor caricato da URL remota | Supply chain compromise | Plugin caricati staticamente o tramite SRI; docs forte raccomandazione |

---

## UX Pitfalls

Errori UX comuni nel dominio "client-side middleware". Per "UX" qui intendiamo developer experience della libreria + UX dell'app finale derivata da decisioni del broker.

| Pitfall | User Impact | Approccio migliore |
|---------|-------------|---------------------|
| Errori silenziosi (validazione, mapping, route mancante) | Dev passa ore a capire perché eventi non arrivano | Tutti gli errori pubblicati come `*.error` events + console.warn in dev |
| `cache-then-network` flicker visibile | Utente finale vede flash dati vecchi → nuovi | Metadata `origin: 'cache' | 'remote'`, consumer decide |
| Loading state non comunicato dal broker | UI mostra spinner per sempre o mai | Eventi `<topic>.requested` / `.started` / `.completed` / `.failed` standardizzati, subscriber può tracciare |
| Race condition mostra dati sbagliati (Pitfall 2) | Utente segnala "ho cercato X, vedo Y" | `correlationId` + `latest-only` policy |
| Realtime disconnect non visibile | Utente vede dati stantii senza saperlo | Eventi `system.realtime.disconnected/reconnecting/connected` con UI dedicata |
| Plugin mismatch silente | Plugin caricato non funziona, nessun errore | `registerPlugin` valida descriptor + range check, errore esplicito |
| Topic typo silente (string-based topic) | Subscribe a `weather.requeted` (typo) non riceve mai eventi | Tipi TS literal types, lint rule per topic string |
| Mapping `data` ambiguo (Pitfall 3.A) | Plugin riceve dato sbagliato senza error | Warning runtime su alias ambiguo (MAP-16) |
| Worker timeout senza feedback | UI mostra spinner all'infinito | `<topic>.failed` con `code: 'WORKER_TIMEOUT'` standardizzato |
| Errore mapping in production senza dettaglio | Bug report inservibile | `BrokerError.details` include path nel payload, schema, valore offending |

---

## "Looks Done But Isn't" Checklist

Cose che sembrano complete ma mancano pezzi critici. Da verificare durante esecuzione e in pre-release.

- [ ] **Pub/sub:** spesso manca `unsubscribe()` che ritorna effettivamente dalla registry — verificare con test che dopo unsubscribe NON arrivino eventi (CORE-02).
- [ ] **`unregisterPlugin`:** spesso lascia subscription orfane, worker channel, realtime listener — verificare con `getDebugSnapshot()` che counters tornino a zero (CORE-11, TEST-01).
- [ ] **Wildcard subscribe:** spesso implementato ma O(N) — verificare scaling con 1000 subscription (TEST-03 storm test).
- [ ] **Mapping `outputMap → inputMap`:** spesso solo unidirezionale — verificare scenario meteo PRD §29 con plugin A `città` → canonico → plugin B `location` (TEST-02).
- [ ] **Validation:** spesso opt-out, finisce dimenticata — verificare che ogni payload canonico passi per validazione di default (VAL-03).
- [ ] **Retry policy:** spesso retry su tutto incluso 4xx — verificare con server mock che 400 non scateni retry (Pitfall 5, ROUTE-09).
- [ ] **Idempotency token:** spesso assente per POST — verificare che route con `idempotency: true` includa `Idempotency-Key` header.
- [ ] **Realtime reconnect jitter:** spesso backoff puro — verificare con 100 client simulati che il reconnect sia distribuito (RT-05).
- [ ] **SSE Last-Event-ID:** spesso non gestito — verificare replay funzionante dopo disconnect simulato (RT-01).
- [ ] **Worker serializzazione:** spesso `DataCloneError` non gestito — verificare con payload contenente function (Pitfall 7.A, WK-07).
- [ ] **Worker timeout vs success race:** spesso doppia pubblicazione — verificare state machine atomico (Pitfall 2.C, WK-03).
- [ ] **Cache scope (auth-aware):** spesso cache key = solo URL — verificare logout flusso, cache deve invalidarsi (Pitfall 8.C, CACHE-02).
- [ ] **Cache immutability:** spesso payload restituito è riferimento — verificare che mutazione dal consumer non corrompa cache.
- [ ] **Plugin error isolation:** spesso un throw abbatte gli altri subscriber — verificare con plugin che `throw new Error('boom')` (Pitfall 9, ERR-03).
- [ ] **Payload immutability:** spesso payload mutabile fra subscriber — verificare con subscriber che modifica payload, altri subscriber non lo vedono modificato (Pitfall 11.C).
- [ ] **Topic naming convention:** spesso non validata — verificare che `registerPlugin` rifiuti topic con `:` o `/` (CORE-08).
- [ ] **Open issues §39:** spesso lasciate "ovvie" non documentate — verificare che ogni decisione abbia una const/test/doc associata (Pitfall 14).
- [ ] **Debug mode in production:** spesso accidentalmente attivo — verificare bundle production con `enableDebug` no-op o con guard.
- [ ] **Bundle tree-shaking:** spesso side-effect import gonfiano bundle — verificare bundle analyzer su esempio "core only".
- [ ] **TypeScript strict mode:** spesso `any` propagato — verificare `tsc --noImplicitAny` pulito su esempio plugin third-party.
- [ ] **Lifecycle hooks plugin:** spesso `onDestroy` non chiamato — verificare con plugin che logga in `onDestroy`, deve loggare al `unregisterPlugin`.
- [ ] **Security URL allowlist:** spesso bypassata da redirect — verificare con server mock che redirige a `evil.com`, request deve essere bloccato.
- [ ] **Event Inspector / Mapping Inspector:** spesso "available but not useful" — verificare che mostri payload originale → canonico → finale per scenario meteo end-to-end (TOOL-01, MAP-15).

---

## Recovery Strategies

Quando i pitfall accadono nonostante la prevenzione, come recuperare.

| Pitfall | Costo recovery | Steps |
|---------|----------------|-------|
| Memory leak in produzione | MEDIUM | 1. Heap snapshot per identificare leak source. 2. Verificare `getDebugSnapshot()` per subscription orfane per pluginId. 3. Patch: forzare cleanup con `unregisterPlugin` o flush registry. 4. Hotfix con migliore cleanup nel descriptor. |
| Race condition con dati sbagliati nel widget | MEDIUM | 1. Aggiungere correlationId al flusso. 2. Aggiornare route con `concurrency: 'latest-only'`. 3. Test di regressione con scenario doppio click. |
| Canonical schema breaking change deployed | HIGH | 1. Rollback se possibile. 2. Se non possibile: pubblicare patch con migration helper + alias temporaneo per backward compat. 3. Comunicare a plugin authors. 4. Versionamento schema più rigoroso. |
| Cache leak cross-user (security incident) | HIGH | 1. Invalidare tutta la cache immediatamente (`flushQueue` + cache flush). 2. Invalidare le sessioni server-side. 3. Audit log per identificare exposure. 4. Hotfix con scope-aware cache keys. 5. Disclosure se richiesto. |
| Retry storm verso server (DOS auto-inflitto) | LOW (se rilevato presto) | 1. Disabilitare retry temporaneamente via config feature flag. 2. Aggiungere jitter. 3. Aggiungere retry budget. |
| Reconnect storm dopo blackout | LOW | 1. Aggiungere jitter alla policy. 2. Estendere maxDelay cap. 3. Comunicare ai client di update. |
| Worker leak (MessageChannel) | MEDIUM | 1. Heap profile per identificare. 2. Audit ogni `WorkerTask` per close esplicito. 3. Test di regressione che asserisce zero channel attivi post-cleanup. |
| Eventi droppati silenti | LOW | 1. Abilitare metrics `eventsDropped`. 2. Identificare topic colpevole. 3. Aumentare bound queue, o escludere quel topic da policy drop. |
| Plugin malformato in production | LOW | 1. Identificare via metrics `plugin.handler.error` per pluginId. 2. `unregisterPlugin` runtime se la lib espone hot-unregister. 3. Patch del plugin. |
| Cache flicker visibile a utenti | LOW | 1. Cambiare policy a `network-only` o `cache-only` per quel topic. 2. UX: aggiungere "stale indicator" per cache hit. |
| Validation rejecting payload validi | LOW | 1. Loggare lo schema mismatch. 2. Aggiornare schema (additive, non breaking). 3. Patch. |
| Topic naming inconsistente fra plugin di terze parti | MEDIUM | 1. Documentare convention. 2. Lint rule per descriptor. 3. Helper `topic(...)` per costruire topic. 4. Eventuali alias temporanei (`weather:requested` → `weather.requested`). |

---

## Pitfall-to-Phase Mapping

Mapping puntuale tra pitfall e fase del PRD §32 che li deve indirizzare.

| Pitfall | Severità | Fase principale | Fasi secondarie | Verifica |
|---------|----------|------------------|------------------|----------|
| 1. Memory leak da subscribe persistenti | BLOCKING | Fase 1 | Fase 4, Fase 5 | TEST-01 lifecycle cleanup; `getDebugSnapshot` zero post-unregister |
| 2. Race condition request/response | HIGH | Fase 1, Fase 3 | Fase 5 | Test scenario doppio click + cambio vista; correlationId end-to-end |
| 3. Canonical model drift / alias | BLOCKING | Fase 2 | Fase 6 | Mapping inspector mostra warning; test ambiguità alias |
| 4. Dedupe / backpressure | HIGH | Fase 1, Fase 3 | Fase 6 | Storm test; metrics eventsDropped per category |
| 5. Retry policy tossica | HIGH | Fase 3 | Fase 4 | Mock server 4xx/5xx; verifica no-retry su 4xx; jitter test |
| 6. Realtime reconnect | HIGH | Fase 4 | — | Test reconnect ripetuto, stale detection, Last-Event-ID replay |
| 7. Worker pitfalls | HIGH | Fase 5 | — | Test serializzazione fallita con messaggio chiaro; pool bounded; channel close |
| 8. Cache invalidation | HIGH | Fase 6 | Fase 3 (contract) | Test cache scope auth; ETag flow; immutability |
| 9. Plugin isolation | HIGH | Fase 1 | Fase 6 | Test plugin throw + altri subscriber ricevono evento |
| 10. Validation noise/silenzi | MEDIUM | Fase 1, Fase 2 | Fase 3 | Test errori validazione visibili in inspector |
| 11. API design (handle, naming, mutazione) | BLOCKING | Fase 1 | — | Type tests + contract tests; deep freeze test |
| 12. TypeScript pitfalls | MEDIUM | Fase 1 | Fase 2 | Type tests con `expectType`; no `any` lint |
| 13. Build / distribution | MEDIUM | Fase 1, Fase 6 | — | Bundle size test; tree-shaking analyzer; no singleton test |
| 14. Open issues §39 | BLOCKING | Tutte (vedi tabella nel pitfall 14) | — | Ogni open issue ha const + doc + test |
| 15. SemVer / plugin versioning | MEDIUM | Fase 1, Fase 2 | — | Plugin con `requires` mismatch fallisce al register |
| 16. Performance | MEDIUM | Fase 1, Fase 2 | Fase 6 | Bench in CI, regression detection |
| 17. Sicurezza | HIGH | Fase 3, Fase 4 | Pre-release docs | URL allowlist redirect test; auth scope test |

---

## Confidence Assessment

| Pitfall | Confidence | Note |
|---------|------------|------|
| 1. Memory leak | HIGH | PRD §24 esplicito; pattern ben noto in pub/sub |
| 2. Race condition | HIGH | PRD §11.1 prevede correlationId; pattern noto |
| 3. Canonical drift | HIGH | PRD §13, §14.7 esplicito (più chiaro di così non si può) |
| 4. Dedupe/backpressure | HIGH | PRD §23.3-§23.4 esplicito |
| 5. Retry tossica | HIGH | Best practice consolidate (Polly, AWS SDK retry); PRD §39 punto 8 chiede chiusura |
| 6. Realtime reconnect | HIGH | PRD §18.6 + RFC SSE + WS best practices |
| 7. Worker | HIGH | structured clone è documentato; pattern noti |
| 8. Cache invalidation | HIGH | "two hard things" — folklore |
| 9. Plugin isolation | HIGH | PRD §22.2 esplicito |
| 10. Validation | MEDIUM-HIGH | Best practice generali, applicate al contesto |
| 11. API design | HIGH | Pattern di event emitter / pub-sub library design |
| 12. TypeScript | MEDIUM-HIGH | Pattern TS noti; alcune scelte (template literal types per topic) sono opinionate |
| 13. Build / dist | HIGH | Dual-package hazard ben documentato (Node.js docs) |
| 14. Open issues §39 | HIGH | Ogni decisione raccomandata è basata su PRD + best practice; alternative valutate |
| 15. SemVer / plugin versioning | MEDIUM-HIGH | SemVer è standard; plugin compatibility è opinionato |
| 16. Performance | MEDIUM | Pattern noti (trie); soglie esatte da bench reali |
| 17. Sicurezza | HIGH | Best practice OWASP + browser security model |

**Pitfall blocking (devono essere risolti per V1):** 1, 3, 11, 14.
**Pitfall high (rilascio sconsigliato senza):** 2, 4, 5, 6, 7, 8, 9, 17.
**Pitfall medium (qualità/manutenibilità):** 10, 12, 13, 15, 16.

---

## Sources

- **PRD interno:** `/Users/omarmarzio/programming/prova AI/GlueZero/prd.md` (sezioni §3, §11, §13, §14, §17, §18, §19, §20, §21, §22, §23, §24, §25, §26, §28, §31, §34, §39, §42).
- **PROJECT.md:** `/Users/omarmarzio/programming/prova AI/GlueZero/.planning/PROJECT.md` (Active requirements CORE-*, MAP-*, ROUTE-*, RT-*, WK-*, CACHE-*, TOOL-*, VAL-*, ERR-*, TEST-*, PKG-*).
- Best practice consolidate del dominio:
  - Pub/sub & event emitter library design (mitt, eventemitter3, RxJS Subject patterns).
  - HTTP retry policies (Polly .NET, AWS SDK retry, Stripe idempotency, Google API client design).
  - WebSocket / SSE reconnect patterns (Socket.IO, Server-Sent Events spec WHATWG, Reconnecting EventSource).
  - Web Worker structured clone (MDN, Chrome platform docs).
  - TypeScript template literal types per topic typing (pattern usato in tRPC, Zod, Fastify).
  - Node.js dual-package hazard (Node.js docs official).
  - Cache key design (HTTP cache RFC 9111, SWR libraries patterns).
  - Browser background tab throttling (Chrome platform docs, MDN visibility API).
- Sintesi e raccomandazioni: judgment basato su PRD + best practice di dominio, validati incrociando più fonti dove non specificato dal PRD.

---
*Pitfalls research for: GlueZero — libreria browser-side di middleware event-driven con canonical model, gateway server, worker runtime, cache (TypeScript-first, ESM)*
*Researched: 2026-04-28*
