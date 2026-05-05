# PRD — Libreria JavaScript Browser-side per Pub/Sub, Routing, Mapping Canonico, Multitasking e Gateway Unico verso il Server

## 1. Scopo del documento

Questo documento definisce in modo completo e non ambiguo i requisiti di prodotto, architettura, comportamento runtime, API attese, modelli dati, vincoli tecnici e criteri di accettazione per la realizzazione di una libreria JavaScript browser-side che funzioni come:

1. **broker pub/sub interno alla pagina**;
2. **router tra componenti locali, worker e server**;
3. **unico punto di contatto con il server** per fetch/AJAX, realtime inbound e sincronizzazione;
4. **runtime multitasking/concurrency-aware** tramite Web Worker;
5. **strato di normalizzazione semantica** tramite un **modello canonico di dati** e un **mapper** tra i nomi locali usati dai plugin/componenti e i nomi canonici del broker.

Il presente documento deve essere considerato **l’unica base informativa condivisa con il developer**. Deve quindi essere sufficiente a permettere la progettazione e l’implementazione della libreria senza necessità di assumere dettagli non espressi qui.

---

## 2. Visione del prodotto

La libreria deve permettere di costruire pagine web, applicazioni browser-based o interfacce modulari in cui i componenti non si parlano direttamente tra loro e non dialogano direttamente col server.

Ogni componente, widget, plugin o modulo UI deve poter dichiarare solo:

- i propri **input** logici, ovvero gli eventi/topic/dati che consuma;
- i propri **output** logici, ovvero gli eventi/topic/dati che emette.

La libreria deve farsi carico di:

- distribuire gli eventi ai sottoscrittori corretti;
- recuperare dal server i dati necessari quando il flusso logico lo richiede;
- ricevere dati dal server in modalità realtime o quasi realtime;
- gestire l’instradamento verso worker quando un task è oneroso o da eseguire in background;
- tradurre i nomi locali dei dati usati da ciascun plugin verso un **vocabolario canonico comune** interno al broker;
- trasformare eventuali formati incompatibili tra produttori e consumatori.

La libreria deve quindi comportarsi come un **middleware client-side orientato agli eventi**, con capacità di orchestrazione, routing e adattamento semantico.

---

## 3. Problema da risolvere

Nelle applicazioni browser complesse emergono tipicamente questi problemi:

1. **accoppiamento forte tra componenti**;
2. **fetch sparsi** nei singoli componenti, difficili da tracciare e governare;
3. **duplicazione di logica di integrazione** con il backend;
4. **difficoltà a sostituire un modulo con un altro equivalente**;
5. **eterogeneità dei nomi dei campi** usati da sviluppatori diversi per concetti uguali;
6. **assenza di parallelismo reale** per task pesanti sul main thread;
7. **assenza di osservabilità** dei flussi applicativi;
8. **gestione poco governata degli eventi realtime** in ingresso dal server.

La libreria deve risolvere questi problemi introducendo un modello uniforme, tracciabile, configurabile e ispezionabile.

---

## 4. Obiettivi

### 4.1 Obiettivi funzionali

La libreria deve:

- fornire un **event bus/pub-sub** locale affidabile;
- supportare **topic/eventi** con payload strutturati;
- permettere a componenti/plugin di dichiarare **subscribe** e **publish**;
- instradare eventi verso:
  - componenti locali;
  - servizi HTTP/fetch/AJAX;
  - canali realtime server → browser;
  - Web Worker;
  - cache locale;
- gestire un **gateway unico** verso il server;
- definire un **modello canonico interno dei dati**;
- permettere il **mapping tra nomi locali e nomi canonici**;
- supportare **trasformazioni dichiarative** dei payload;
- validare schemi evento e schemi dati;
- supportare **retry**, **timeout**, **throttling**, **debounce**, **deduplica** e **backpressure**;
- esporre strumenti di **debug e introspezione** dei flussi;
- gestire **unsubscribe automatico** e lifecycle dei componenti;
- essere estendibile con un modello plugin chiaro.

### 4.2 Obiettivi architetturali

La libreria deve:

- minimizzare l’accoppiamento tra moduli;
- centralizzare la logica di comunicazione col backend;
- rendere i flussi dichiarativi;
- ridurre la necessità di codice personalizzato per connettere componenti diversi;
- isolare il main thread da task pesanti;
- permettere evoluzione progressiva senza rompere compatibilità.

### 4.3 Obiettivi non funzionali

La libreria deve essere:

- prevedibile;
- debuggabile;
- testabile;
- estendibile;
- performante;
- documentabile;
- abbastanza generica da funzionare in molte UI diverse;
- compatibile almeno con browser moderni evergreen.

---

## 5. Non-obiettivi

La prima versione della libreria **non deve** essere un framework UI completo. Non deve:

- sostituire React/Vue/Svelte/Angular o altri framework di rendering;
- imporre uno state manager globale stile Redux come unica via di gestione stato;
- eseguire logica arbitraria lato server;
- essere un motore BPMN/browser workflow visual designer;
- risolvere in automatico il mapping semantico ambiguo senza configurazione esplicita;
- richiedere accesso diretto al DOM dai worker.

La libreria può integrarsi con framework UI, ma deve restare concettualmente indipendente da essi.

---

## 6. Terminologia ufficiale

Per evitare ambiguità, i seguenti termini vanno usati con il significato indicato.

### 6.1 Broker
Il runtime centrale che riceve, valida, arricchisce, mappa e distribuisce eventi.

### 6.2 Topic
Canale logico a cui un evento appartiene, es. `weather.requested`, `forecast.loaded`, `form.submitted`.

### 6.3 Event
Messaggio atomico circolante nel broker, composto da metadata + payload.

### 6.4 Publisher
Qualsiasi attore che emette un evento sul broker.

### 6.5 Subscriber
Qualsiasi attore che si sottoscrive a uno o più topic per ricevere eventi.

### 6.6 Plugin
Modulo riusabile che si integra con la libreria dichiarando input, output, mapping e comportamento.

### 6.7 Route
Regola dichiarativa che definisce come il broker gestisce un evento/topic. Può instradare verso locale, HTTP, realtime, worker, cache o combinazioni.

### 6.8 Canonical Model / Modello Canonico
Vocabolario interno ufficiale del broker per rappresentare concetti e campi dati in forma uniforme, indipendentemente dai nomi locali usati dai plugin.

### 6.9 Mapper
Motore che converte payload da nomenclatura/formato locale a nomenclatura/formato canonico e viceversa.

### 6.10 Gateway Server
Sottosistema della libreria che gestisce tutte le comunicazioni browser ↔ server.

### 6.11 Worker Runtime
Sottosistema che usa Web Worker per task concorrenti o pesanti.

### 6.12 Adapter
Componente di integrazione che collega un plugin o una route a un tipo di backend o trasporto specifico.

---

## 7. Casi d’uso principali

### 7.1 Collegamento tra componenti locali
Un form emette un evento con dati. Un widget locale si sottoscrive e si aggiorna senza sapere chi ha prodotto i dati.

### 7.2 Collegamento tra componente locale e server
Un componente pubblica un evento di richiesta. Il broker lo instrada verso una chiamata HTTP. Al risultato pubblica l’evento di successo o errore.

### 7.3 Collegamento tra server e componenti locali
Il server invia un evento via WebSocket/SSE. La libreria lo riceve, lo normalizza e lo inoltra ai subscriber locali.

### 7.4 Delega di elaborazione a worker
Un evento scatena un task pesante. Il broker instrada il task a un worker. Al completamento il risultato rientra come evento.

### 7.5 Integrazione tra plugin con vocabolari diversi
Plugin A emette `città` e `data`; Plugin B si aspetta `location` e `day-prevision`; il broker usa il modello canonico e i mapping per consentire l’interoperabilità.

---

## 8. Principi architetturali

La progettazione deve seguire i seguenti principi.

### 8.1 Disaccoppiamento
I componenti non devono conoscersi tra loro.

### 8.2 Dichiaratività
Le connessioni tra attori devono essere configurabili con definizioni di route, schema e mapping, evitando logica hardcoded dispersa.

### 8.3 Centralizzazione delle integrazioni
Tutta la comunicazione col server passa dal gateway della libreria.

### 8.4 Canonicalizzazione
I dati devono poter transitare in un formato concettualmente unificato.

### 8.5 Osservabilità
Ogni evento deve poter essere ispezionato nel suo ciclo di vita.

### 8.6 Robustezza
Il sistema deve gestire errori di rete, ritardi, duplicati, plugin non disponibili e load elevato.

### 8.7 Progressive enhancement
La libreria deve poter essere introdotta gradualmente, anche in pagine semplici, e crescere in complessità senza redesign radicale.

---

## 9. Requisiti di alto livello

### 9.1 Broker locale
Deve esporre un bus pub/sub in-page.

### 9.2 Routing intelligente
Deve decidere se un evento va:

- consegnato localmente;
- trasformato in richiesta server;
- inviato a worker;
- servito da cache;
- pubblicato come risposta a eventi di backend.

### 9.3 Gateway unico verso il backend
Le richieste fetch/AJAX devono essere centralizzate. Deve essere sempre disponibile un canale per ricevere input dal server.

### 9.4 Supporto multitasking
I task CPU-intensive o potenzialmente bloccanti devono essere delegabili a worker.

### 9.5 Mapping semantico
La libreria deve definire un vocabolario canonico e meccanismi di mapping tra i nomi dei plugin e i nomi canonici.

---

## 10. Architettura logica complessiva

La libreria dovrà essere organizzata in moduli concettuali distinti.

```text
Browser Runtime
│
├── Core Broker
│   ├── Event Bus
│   ├── Topic Registry
│   ├── Subscriber Registry
│   ├── Publisher Metadata
│   └── Event Lifecycle Manager
│
├── Routing Engine
│   ├── Local Route Handler
│   ├── HTTP Route Handler
│   ├── Realtime Inbound Handler
│   ├── Worker Route Handler
│   ├── Cache Route Handler
│   └── Composite Route Handler
│
├── Canonical Model & Mapping Engine
│   ├── Canonical Vocabulary Registry
│   ├── Alias Registry
│   ├── Plugin Field Maps
│   ├── Transformation Pipeline
│   └── Validation Layer
│
├── Server Gateway
│   ├── Fetch/AJAX Client
│   ├── WebSocket Client
│   ├── SSE Client
│   ├── Optional Push/ServiceWorker Bridge
│   └── Auth / Retry / Timeout / Circuit Policies
│
├── Worker Runtime
│   ├── Worker Registry
│   ├── Worker Pool
│   ├── Message Bridge
│   └── Worker Task Tracking
│
├── State/Cache Layer
│   ├── In-memory Cache
│   ├── Optional IndexedDB Adapter
│   ├── Cache Policies
│   └── Invalidation / Revalidation
│
└── Developer Tooling
    ├── Event Inspector
    ├── Mapping Inspector
    ├── Route Inspector
    ├── Metrics / Logs
    └── Error Diagnostics
```

---

## 11. Modello evento ufficiale

Ogni evento che circola nel broker deve rispettare una struttura interna uniforme.

### 11.1 Struttura dell’evento

```ts
interface BrokerEvent<TPayload = unknown> {
  id: string;
  topic: string;
  timestamp: number;
  source: EventSourceDescriptor;
  payload: TPayload;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  traceId?: string;
  schemaVersion?: string;
  deliveryMode?: 'sync' | 'async' | 'worker' | 'remote';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  ttlMs?: number;
  dedupeKey?: string;
}
```

### 11.2 Source descriptor

```ts
interface EventSourceDescriptor {
  type: 'plugin' | 'component' | 'worker' | 'server' | 'system' | 'cache';
  id: string;
  name?: string;
  instanceId?: string;
}
```

### 11.3 Regole obbligatorie

- `id` deve essere univoco;
- `topic` è obbligatorio;
- `timestamp` è valorizzato dal broker se assente;
- `source` è obbligatorio e deve essere noto al runtime;
- `payload` può essere vuoto solo se lo schema del topic lo consente;
- `correlationId` e `traceId` vanno propagati quando possibile;
- `dedupeKey`, se presente, abilita deduplica.

---

## 12. Convenzioni sui topic

### 12.1 Naming convention
I topic devono usare un formato dot-separated, minuscolo, semanticamente esplicito:

- `weather.requested`
- `weather.loaded`
- `weather.failed`
- `form.customer.submitted`
- `report.generation.requested`
- `report.generation.completed`

### 12.2 Pattern consigliato
Per operazioni asincrone o server-bound si raccomanda il trittico:

- `<entity>.<action>.requested`
- `<entity>.<action>.succeeded` oppure `<entity>.<action>.completed`
- `<entity>.<action>.failed`

Quando utile, anche:

- `<entity>.<action>.started`
- `<entity>.<action>.progress`
- `<entity>.<action>.cancelled`

### 12.3 Wildcard
Il broker può supportare wildcard di subscribe, ad esempio:

- `weather.*`
- `*.failed`
- `form.customer.*`

La wildcard è opzionale ma fortemente consigliata perché utile per logging, debug e subscriber generici.

---

## 13. Canonical Model — requisito centrale

Questo è un punto fondamentale del prodotto.

### 13.1 Motivazione
I plugin/componenti saranno sviluppati da autori diversi e potranno usare nomi differenti per concetti identici.

Esempi:

- `città`, `city`, `location`, `place`
- `data`, `date`, `forecastDate`, `day-prevision`
- `cliente`, `customer`, `client`

Senza un vocabolario comune del broker, i componenti diventano interoperabili solo se gli autori si mettono d’accordo preventivamente sui nomi. Questo è un vincolo da eliminare.

### 13.2 Soluzione richiesta
Il broker deve definire un **vocabolario canonico interno**, indipendente dai nomi locali usati dai plugin. Ogni plugin deve dichiarare come i propri campi locali si mappano sui campi canonici.

### 13.3 Ambito del modello canonico
Il modello canonico deve coprire almeno:

- topic canonici;
- campi canonici dei payload;
- tipi canonici;
- alias eventualmente riconosciuti;
- regole di validazione;
- eventuali trasformazioni standard.

### 13.4 Esempio concettuale

Plugin A emette:

```json
{
  "città": "Roma",
  "data": "2026-05-01"
}
```

Il broker traduce verso il payload canonico:

```json
{
  "location": "Roma",
  "forecast_date": "2026-05-01"
}
```

Plugin B consuma con nomenclatura propria:

```json
{
  "location": "Roma",
  "day-prevision": "2026-05-01"
}
```

### 13.5 Regola operativa
I dati devono transitare internamente in almeno una di queste forme, a seconda della configurazione:

1. **sempre canonicalizzati internamente**;
2. **canonicalizzati solo ai confini del broker**.

Per la V1 si richiede come comportamento di default la **canonicalizzazione interna completa**. Questo semplifica debug, route, logging e interoperabilità.

---

## 14. Mapper — specifica dettagliata

### 14.1 Funzione del mapper
Il mapper converte:

- da payload locale plugin → payload canonico;
- da payload canonico → payload locale plugin;
- da payload server → payload canonico;
- da payload canonico → payload server, quando necessario.

### 14.2 Tipi di mapping richiesti
Il mapper deve supportare almeno:

1. **rename semplice**;
2. **mapping nested**;
3. **default value**;
4. **trasformazione di formato**;
5. **normalizzazione di unità di misura**;
6. **derivazione di campo**;
7. **mapping parziale**;
8. **validazione post-mapping**.

### 14.3 Esempi di mapping semplice

```json
{
  "città": "location",
  "data": "forecast_date"
}
```

### 14.4 Esempi di mapping con trasformazione

```json
{
  "data": {
    "to": "forecast_date",
    "transform": "parseItalianDate"
  }
}
```

### 14.5 Esempi di derivazione

```json
{
  "firstName": {
    "to": "customer_first_name"
  },
  "lastName": {
    "to": "customer_last_name"
  },
  "$derive": [
    {
      "to": "customer_full_name",
      "from": ["firstName", "lastName"],
      "transform": "concatWithSpace"
    }
  ]
}
```

### 14.6 Requisiti del transformation engine
Il transformation engine deve consentire:

- funzioni built-in;
- funzioni custom registrabili;
- pipeline di trasformazioni;
- gestione errori di trasformazione;
- fallback e default.

### 14.7 Ambiguità semantica
Il sistema **non deve assumere** che alias equivalenti siano sempre semanticamente equivalenti. Esempio: `data` in italiano può significare `date`, ma in altri contesti può significare genericamente `data` come “dati”.

Per questo motivo:

- gli alias servono come aiuto, non come unica fonte di verità;
- il mapping esplicito dichiarato dal plugin prevale sempre;
- il runtime deve segnalare warning quando un alias potrebbe essere ambiguo.

### 14.8 Mapping inspector
Deve esistere uno strumento di debug che mostri:

- payload originale;
- payload canonicalizzato;
- payload finale consegnato al consumer;
- trasformazioni applicate;
- errori o warning generati.

---

## 15. Modello plugin

### 15.1 Obiettivo
Fornire un contratto standard per moduli sviluppati da terzi.

### 15.2 Descriptor minimo di un plugin

```ts
interface BrokerPluginDescriptor {
  id: string;
  name: string;
  version: string;
  subscribes?: PluginSubscriptionDescriptor[];
  publishes?: PluginPublicationDescriptor[];
  inputMap?: FieldMapDefinition;
  outputMap?: FieldMapDefinition;
  handlers?: Record<string, PluginEventHandler>;
  lifecycle?: PluginLifecycleHooks;
  capabilities?: PluginCapabilities;
}
```

### 15.3 Subscription descriptor

```ts
interface PluginSubscriptionDescriptor {
  topic: string;
  schema?: string;
  mode?: 'sync' | 'async';
  required?: boolean;
}
```

### 15.4 Publication descriptor

```ts
interface PluginPublicationDescriptor {
  topic: string;
  schema?: string;
}
```

### 15.5 Lifecycle hooks

```ts
interface PluginLifecycleHooks {
  onRegister?: () => void | Promise<void>;
  onMount?: () => void | Promise<void>;
  onUnmount?: () => void | Promise<void>;
  onDestroy?: () => void | Promise<void>;
}
```

### 15.6 Regole importanti

- il plugin **non deve** contattare il server direttamente per le funzionalità coperte dalla libreria;
- i dati emessi dal plugin devono poter essere output-mappati verso il modello canonico;
- i dati ricevuti devono poter essere input-mappati dal canonico verso il locale;
- il plugin deve poter essere smontato senza memory leak;
- il plugin non deve assumere che il publisher originario sia noto.

---

## 16. API pubblica minima della libreria

La libreria deve esporre almeno un’API pubblica coerente con le capacità richieste.

### 16.1 Creazione runtime

```ts
const broker = createBroker(config)
```

### 16.2 API minime richieste

```ts
broker.publish(topic, payload, options?)
broker.subscribe(topic, handler, options?)
broker.unsubscribe(subscriptionId)
broker.registerPlugin(pluginDescriptor)
broker.unregisterPlugin(pluginId)
broker.registerRoute(routeDefinition)
broker.unregisterRoute(routeId)
broker.registerCanonicalSchema(schemaDefinition)
broker.registerTransform(name, fn)
broker.connectRealtime()
broker.disconnectRealtime()
broker.getDebugSnapshot()
```

### 16.3 Funzioni accessorie consigliate

```ts
broker.pauseTopic(topic)
broker.resumeTopic(topic)
broker.flushQueue(topic?)
broker.enableDebug()
broker.disableDebug()
broker.getMetrics()
broker.getTopicRegistry()
broker.getPluginRegistry()
broker.getRouteRegistry()
```

---

## 17. Routing engine

### 17.1 Scopo
Il routing engine determina cosa fare con un evento in base a regole dichiarative.

### 17.2 Tipi di route richiesti

- `local`
- `http`
- `realtime-inbound`
- `worker`
- `cache`
- `composite`

### 17.3 Route locale
Consegna l’evento ai subscriber interni.

### 17.4 Route HTTP
Converte un topic in una richiesta di rete.

Esempio concettuale:

```json
{
  "id": "route.weather.request",
  "on": "weather.requested",
  "type": "http",
  "request": {
    "method": "GET",
    "url": "/api/weather",
    "queryMap": {
      "location": "location",
      "forecast_date": "date"
    }
  },
  "publishes": {
    "success": "weather.loaded",
    "error": "weather.failed"
  }
}
```

### 17.5 Route worker
Converte un topic in un task worker.

```json
{
  "id": "route.report.generate",
  "on": "report.generation.requested",
  "type": "worker",
  "worker": "report-worker",
  "task": "generateReport",
  "publishes": {
    "success": "report.generation.completed",
    "error": "report.generation.failed"
  }
}
```

### 17.6 Route cache
Serve risposte da cache locale o decide cache-then-network.

### 17.7 Route composite
Consente workflow del tipo:

- check cache;
- se cache miss, chiama server;
- al risultato aggiorna cache;
- pubblica evento finale.

### 17.8 Policy di route
Ogni route dovrebbe poter definire:

- timeout;
- retry;
- backoff;
- dedupe;
- cache policy;
- concurrency policy;
- error policy;
- mapping policy;
- auth policy.

---

## 18. Gateway server — requisito centrale

La libreria deve essere l’unico legame strutturale con il server per tutte le interazioni coperte dal runtime.

### 18.1 Responsabilità del gateway

- gestire fetch/AJAX;
- gestire canali realtime inbound;
- gestire autenticazione e token nelle richieste;
- centralizzare retry, timeout, error handling e logging;
- trasformare le risposte in eventi brokerizzati;
- normalizzare i payload inbound dal server;
- offrire un punto unico di configurazione della connettività.

### 18.2 Tecnologie supportate
Per la V1 il gateway deve supportare almeno:

- `fetch` per HTTP request/response;
- `WebSocket` e/o `Server-Sent Events` per input realtime dal server.

### 18.3 Priorità di implementazione consigliata
Ordine suggerito:

1. fetch;
2. SSE;
3. WebSocket;
4. eventuale bridge con Service Worker/Push.

### 18.4 Motivazione SSE vs WebSocket
SSE è spesso più semplice e robusto quando serve solo server → browser. WebSocket è necessario quando si desidera bidirezionalità piena e persistente. La libreria deve però astrare questi dettagli e trattare il canale inbound come una sorgente di eventi.

### 18.5 Realtime inbound contract
I messaggi ricevuti dal server devono essere convertiti in eventi interni, arricchiti con metadata di origine:

```ts
source: {
  type: 'server',
  id: 'realtime-channel',
  name: 'sse' | 'websocket'
}
```

### 18.6 Reconnection policy
Per canali realtime devono essere configurabili:

- retry interval;
- exponential backoff opzionale;
- max retry opzionale;
- heartbeats;
- stale connection detection;
- reconnect jitter.

### 18.7 Server push notification
Il requisito “sempre disponibile a ricevere chiamate dal server” va interpretato come:

- finché la pagina è attiva, il gateway deve poter mantenere un canale inbound persistente o quasi persistente;
- opzionalmente in release successive si potrà integrare un bridge con Service Worker per supportare use case di push oltre la vita della singola pagina.

---

## 19. Multitasking / concurrency / worker runtime

### 19.1 Chiarimento terminologico
Nel browser il main thread non esegue più script CPU-bound realmente in parallelo. Il parallelismo reale si ottiene con i **Web Worker**. La libreria deve supportarli.

### 19.2 Obiettivi del worker runtime

- evitare blocchi del main thread;
- delegare parsing, aggregazione, trasformazioni pesanti, calcoli o sincronizzazioni complesse;
- integrare i risultati worker nel flusso eventi del broker.

### 19.3 Requisiti minimi

- registro dei worker disponibili;
- creazione/riuso worker;
- possibilità di usare worker dedicati o pool;
- task correlation;
- propagazione errori;
- pubblicazione di eventi risultato;
- timeout task;
- eventuale cancellazione task.

### 19.4 Flusso richiesto

1. publisher emette topic;
2. route worker lo intercetta;
3. payload viene canonicalizzato;
4. task viene inviato al worker;
5. worker restituisce `success`, `progress` o `error`;
6. broker pubblica l’evento risultante.

### 19.5 Limitazioni note da gestire

- i worker non possono accedere direttamente al DOM;
- i dati trasferiti devono essere serializzabili o transferable;
- il design non deve dare per scontato che tutte le funzioni siano eseguibili in worker.

### 19.6 Casi d’uso worker consigliati

- parsing JSON/XML/CSV grande;
- trasformazioni dataset;
- deduplica massiva;
- aggregazioni;
- normalizzazioni pesanti;
- funzioni di mappatura particolarmente onerose;
- pre-processing dati server.

---

## 20. Stato e cache

### 20.1 Motivazione
Alcuni flussi devono poter usare dati già presenti localmente per ridurre chiamate server o migliorare UX.

### 20.2 Requisiti minimi

- cache in-memory;
- chiave di cache definibile per route/topic;
- TTL configurabile;
- invalidazione manuale e automatica;
- supporto `cache-first`, `network-first`, `cache-then-network`;
- pubblicazione esplicita dell’origine del dato (`cache` vs `remote`).

### 20.3 Opzionale ma consigliato
Supporto a IndexedDB tramite adapter per persistenza browser-side.

### 20.4 Tracciabilità
I consumer devono poter sapere se il dato è arrivato da cache o dal server, almeno tramite metadata.

---

## 21. Validazione e schema management

### 21.1 Perché è necessario
Senza validazione, in un sistema event-driven con mapping e plugin di terze parti gli errori diventano opachi.

### 21.2 Livelli di validazione richiesti

1. **validazione evento**;
2. **validazione payload topic**;
3. **validazione modello canonico**;
4. **validazione post-mapping**;
5. **validazione risposta server**.

### 21.3 Tecnologia consigliata
Il developer può scegliere la libreria di validazione preferita, ma il sistema deve supportare definizioni schema chiare, preferibilmente JSON Schema o equivalente tipizzato.

### 21.4 Gestione errori di validazione
Quando una validazione fallisce, il runtime deve:

- registrare l’errore nel debug/logging;
- pubblicare un evento di errore di sistema opzionale;
- evitare, salvo configurazione esplicita, che payload invalidi vengano consegnati ai consumer.

---

## 22. Gestione errori

### 22.1 Categorie di errore da gestire

- errore di mapping;
- errore di validazione;
- errore di rete;
- timeout;
- errore realtime connection;
- errore worker;
- errore plugin handler;
- errore route configuration;
- errore di dedupe/backpressure.

### 22.2 Politica generale
Gli errori non devono far collassare il runtime globale, salvo guasti critici non recuperabili. Il broker deve isolare l’errore quanto più possibile.

### 22.3 Eventi standard di errore
È raccomandata la pubblicazione di eventi standardizzati, almeno per route applicative:

- `<topic>.failed`
- `system.error`
- `mapping.error`
- `worker.error`
- `network.error`

### 22.4 Error object minimo

```ts
interface BrokerError {
  code: string;
  message: string;
  category: string;
  details?: unknown;
  originalError?: unknown;
  routeId?: string;
  topic?: string;
  eventId?: string;
}
```

---

## 23. Retry, timeout, backpressure, deduplica

### 23.1 Retry
Le route remote e realtime devono poter definire retry policy.

### 23.2 Timeout
Ogni route che coinvolge I/O o worker deve poter definire timeout.

### 23.3 Backpressure
Il broker deve poter limitare o governare picchi di eventi, ad esempio con:

- queue bounded;
- drop policy;
- throttle;
- debounce;
- latest-only policy;
- merge/coalesce policy.

### 23.4 Deduplica
Eventi o richieste equivalenti devono poter essere deduplicati via `dedupeKey` o logica route-specific.

### 23.5 Cancellazione
Per task lunghi o richieste obsolete, il sistema dovrebbe prevedere un meccanismo di cancellazione o invalidazione semantica.

---

## 24. Lifecycle e memory safety

### 24.1 Requisito
La libreria deve prevenire memory leak da subscribe persistenti o riferimenti a componenti distrutti.

### 24.2 Requisiti minimi

- ogni subscribe deve restituire un handle/unsubscribe;
- i plugin registrati devono poter essere smontati e distrutti;
- l’unregister di un plugin deve rimuovere subscription, handler e risorse collegate;
- i listener realtime e worker associati devono poter essere chiusi.

### 24.3 Integrazione con framework UI
Sebbene il framework specifico non sia imposto, il design deve consentire facilmente l’uso in mount/unmount lifecycle.

---

## 25. Osservabilità e developer tooling

Questo punto è obbligatorio. Senza strumenti di introspezione la libreria non sarebbe manutenibile.

### 25.1 Event Inspector
Deve permettere di vedere:

- topic pubblicato;
- publisher;
- timestamp;
- payload originario;
- payload canonico;
- subscriber raggiunti;
- route attivate;
- stato finale;
- errori;
- tempi di elaborazione.

### 25.2 Mapping Inspector
Deve mostrare:

- input locale;
- regole di mapping applicate;
- risultato canonico;
- eventuale output remapped verso il consumer;
- warning di ambiguità;
- errori di trasformazione.

### 25.3 Route Inspector
Deve mostrare:

- quale route ha intercettato l’evento;
- policy applicate;
- esito della chiamata remota o task worker;
- retry effettuati;
- cache hit/miss.

### 25.4 Log level
Serve almeno:

- `silent`
- `error`
- `warn`
- `info`
- `debug`
- `trace`

### 25.5 Metrics consigliate

- eventi pubblicati/secondo;
- eventi scartati;
- errori per categoria;
- tempi medi route HTTP;
- tempi medi route worker;
- cache hit ratio;
- subscriber per topic;
- backlog per topic/queue.

---

## 26. Sicurezza

### 26.1 Obiettivo
Centralizzare la comunicazione col server permette di centralizzare anche il comportamento di sicurezza.

### 26.2 Requisiti minimi

- gestione centralizzata header auth;
- supporto token refresh tramite hook o adapter configurabile;
- protezione da duplicazioni accidentali di chiamate;
- gestione uniforme di status HTTP non validi;
- controllo sugli endpoint consentiti;
- separazione tra config pubblica e segreti lato server.

### 26.3 Nota importante
La libreria browser-side non deve fingere di proteggere dati che il browser non può proteggere per definizione. Va usata come strato di governance client, non come sostituto di sicurezza server-side.

---

## 27. Configurazione globale

### 27.1 Struttura di configurazione attesa
La libreria deve poter essere inizializzata con una configurazione globale che includa almeno:

- runtime options;
- topic schemas;
- canonical schemas;
- alias registry;
- transforms;
- routes;
- transport config;
- worker config;
- debug config;
- cache config.

### 27.2 Esempio concettuale

```ts
const broker = createBroker({
  debug: true,
  realtime: {
    mode: 'sse',
    url: '/events'
  },
  canonicalModel: {
    fields: {
      location: { type: 'string', aliases: ['city', 'città', 'place'] },
      forecast_date: { type: 'date', aliases: ['date', 'data', 'day-prevision'] }
    }
  },
  transforms: {
    parseItalianDate,
    normalizeLocationName
  },
  routes: [/* ... */],
  workers: [/* ... */]
})
```

---

## 28. Flusso ufficiale di elaborazione di un evento

Quando un publisher invia un evento, il runtime deve seguire un ciclo di vita chiaro.

### 28.1 Pipeline standard

1. ricezione evento;
2. arricchimento metadata mancanti;
3. validazione sintattica evento;
4. identificazione publisher/source;
5. mapping output locale → canonico;
6. validazione payload canonico;
7. dedupe / backpressure policy;
8. risoluzione route applicabili;
9. eventuale passaggio verso cache / http / worker / realtime / local;
10. raccolta esiti;
11. per ciascun subscriber, mapping canonico → input locale consumer;
12. validazione finale opzionale;
13. consegna al consumer;
14. logging / metrics / debug snapshot.

### 28.2 Osservazione importante
L’ordine esatto deve essere coerente e documentato nel codice. Non sono ammesse trasformazioni implicite invisibili al debug layer.

---

## 29. Esempio end-to-end: previsione meteo

### 29.1 Contesto
Un plugin form emette due campi locali: `città` e `data`. Un plugin forecast consumer si aspetta `location` e `day-prevision`. Il backend espone `/api/weather?location=...&date=...`.

### 29.2 Plugin form

Output locale:

```json
{
  "città": "Roma",
  "data": "30/04/2026"
}
```

Output map:

```json
{
  "città": {
    "to": "location",
    "transform": "normalizeLocationName"
  },
  "data": {
    "to": "forecast_date",
    "transform": "parseItalianDate"
  }
}
```

### 29.3 Evento canonico risultante

```json
{
  "location": "Roma",
  "forecast_date": "2026-04-30"
}
```

### 29.4 Route HTTP

```json
{
  "id": "weather-route",
  "on": "weather.requested",
  "type": "http",
  "request": {
    "method": "GET",
    "url": "/api/weather",
    "queryMap": {
      "location": "location",
      "forecast_date": "date"
    }
  },
  "publishes": {
    "success": "weather.loaded",
    "error": "weather.failed"
  }
}
```

### 29.5 Server response

```json
{
  "temp": 21,
  "condition": "Sunny",
  "city": "Rome",
  "date": "2026-04-30"
}
```

Server → canonical map:

```json
{
  "temp": "temperature_celsius",
  "condition": "weather_condition",
  "city": "location",
  "date": "forecast_date"
}
```

### 29.6 Consumer plugin input map

Plugin consumer si aspetta:

```json
{
  "location": "location",
  "day-prevision": "forecast_date",
  "temperature": "temperature_celsius",
  "status": "weather_condition"
}
```

Consegna finale al plugin:

```json
{
  "location": "Rome",
  "day-prevision": "2026-04-30",
  "temperature": 21,
  "status": "Sunny"
}
```

---

## 30. Requisiti per interoperabilità tra plugin di terze parti

### 30.1 Contratto minimo
Ogni plugin di terze parti deve poter fornire:

- identificativo univoco;
- topic sottoscritti;
- topic pubblicati;
- mapping input;
- mapping output;
- eventuali trasformazioni custom richieste;
- eventuali schemi.

### 30.2 Contratto semantico
Il broker non deve richiedere che i plugin condividano la stessa nomenclatura locale, purché il mapping sia espresso correttamente.

### 30.3 Errori da gestire

- plugin senza mapping sufficiente;
- plugin che dichiara campi non presenti;
- plugin che richiede canonical fields inesistenti;
- collisioni di plugin id;
- versioni incompatibili.

---

## 31. Compatibilità e packaging

### 31.1 Packaging desiderato
La libreria dovrebbe essere distribuibile almeno come modulo moderno ES Module. Idealmente anche build UMD/IIFE opzionale per integrazione semplice in pagine legacy.

### 31.2 Linguaggio consigliato
Si raccomanda fortemente **TypeScript** per garantire solidità del contratto interno, anche se il runtime finale può essere distribuito in JavaScript compilato.

### 31.3 Browser target
Supporto a browser moderni evergreen. Eventuali polyfill devono essere separati dal core.

---

## 32. Strategia di implementazione suggerita

### 32.1 Fase 1 — Core essenziale
Implementare:

- event bus;
- publish/subscribe/unsubscribe;
- topic registry;
- basic schemas;
- plugin registry;
- logging base.

### 32.2 Fase 2 — Canonical model e mapper
Implementare:

- canonical vocabulary registry;
- input/output map plugin;
- rename + transform + default;
- mapping inspector.

### 32.3 Fase 3 — Routing e server gateway
Implementare:

- route engine;
- fetch route;
- error route;
- success/error event publication;
- retry/timeout.

### 32.4 Fase 4 — Realtime inbound
Implementare:

- SSE adapter;
- opzionale WebSocket adapter;
- reconnect policy;
- server message normalization.

### 32.5 Fase 5 — Worker runtime
Implementare:

- worker registry;
- worker routing;
- task tracking;
- worker error propagation.

### 32.6 Fase 6 — Cache e tooling avanzato
Implementare:

- cache layer;
- route inspector;
- metrics;
- advanced debug UI/API.

---

## 33. Decisioni tecniche richieste al developer

Il developer dovrà prendere alcune decisioni implementative, ma entro confini precisi.

### 33.1 Da decidere liberamente, purché rispettino il PRD

- libreria di validazione schema;
- sistema di ID generation;
- struttura interna delle queue;
- modalità precisa di logging;
- worker pooling strategy;
- dettagli di serialization;
- build system.

### 33.2 Non lasciate alla discrezione del developer
Questi punti sono vincolanti e non opzionali:

- esistenza del canonical model;
- esistenza del mapper bidirezionale;
- broker come unico gateway verso il server per i flussi coperti;
- supporto a fetch + almeno un canale realtime inbound;
- supporto a Web Worker;
- debug e introspection;
- gestione lifecycle per evitare leak;
- route dichiarative;
- validazione minima dei payload.

---

## 34. Requisiti di performance

### 34.1 Obiettivi qualitativi

- il publish locale di eventi semplici deve essere leggero;
- il mapping non deve introdurre overhead eccessivo per casi banali;
- il debug mode deve poter essere disattivato in produzione;
- i task pesanti devono essere delegabili a worker;
- il gateway deve evitare richieste duplicate non necessarie.

### 34.2 Nota
Non vengono imposti benchmark numerici rigidi in questo documento, ma l’architettura deve essere costruita per non degradare rapidamente con l’aumento del numero di topic, subscriber e plugin.

---

## 35. Requisiti di test

### 35.1 Unit test obbligatori
Devono coprire almeno:

- publish/subscribe;
- unsubscribe;
- wildcard topic matching, se supportato;
- canonical mapping;
- reverse mapping;
- trasformazioni;
- validazione errori;
- dedupe;
- retry/timeout;
- route HTTP;
- route worker;
- realtime inbound normalization;
- lifecycle cleanup.

### 35.2 Integration test obbligatori
Devono coprire almeno:

- plugin A → broker → plugin B con mapping differente;
- plugin → broker → server → broker → plugin;
- plugin → broker → worker → broker → plugin;
- cache hit/miss flows;
- reconnect realtime;
- error propagation completa.

### 35.3 Test di robustezza consigliati

- storm di eventi;
- plugin mal configurato;
- server che risponde con schema inatteso;
- worker timeout;
- riconnessione ripetuta realtime;
- topic with many subscribers.

---

## 36. Criteri di accettazione funzionale

La libreria sarà considerata conforme se soddisfa almeno i seguenti criteri.

### 36.1 Core pub/sub
- è possibile pubblicare un evento e riceverlo tramite subscribe;
- è possibile disiscriversi senza effetti residui;
- un plugin può dichiarare input/output senza riferimenti diretti ad altri plugin.

### 36.2 Mapping canonico
- due plugin con nomi locali differenti per lo stesso concetto possono interoperare correttamente;
- il broker mantiene un vocabolario canonico esplicito;
- il debug mostra il passaggio locale → canonico → locale.

### 36.3 Gateway server
- un topic può generare una richiesta HTTP gestita dal broker;
- la risposta del server viene convertita in evento interno;
- esiste almeno un canale inbound realtime attivabile.

### 36.4 Worker
- un topic può attivare un worker;
- il risultato del worker rientra nel broker come evento;
- gli errori worker sono gestiti e visibili.

### 36.5 Tooling
- l’ispezione degli eventi permette di capire origine, mapping, route ed esito;
- gli errori non restano invisibili.

---

## 37. Criteri di accettazione qualitativa

La libreria deve risultare:

- comprensibile per uno sviluppatore che la adotta;
- estendibile con nuovi plugin e route;
- debuggabile senza reverse engineering del codice interno;
- coerente nell’uso dei nomi e dei concetti;
- sufficientemente astratta da non dipendere dal naming arbitrario dei plugin di terze parti.

---

## 38. Esempio di pseudocodice di utilizzo

```ts
const broker = createBroker({
  debug: true,
  canonicalModel: {
    fields: {
      location: { type: 'string', aliases: ['city', 'città', 'place'] },
      forecast_date: { type: 'date', aliases: ['date', 'data', 'day-prevision'] },
      temperature_celsius: { type: 'number', aliases: ['temp', 'temperature'] },
      weather_condition: { type: 'string', aliases: ['condition', 'status'] }
    }
  },
  transforms: {
    parseItalianDate,
    normalizeLocationName
  },
  routes: [
    {
      id: 'weather-http',
      on: 'weather.requested',
      type: 'http',
      request: {
        method: 'GET',
        url: '/api/weather',
        queryMap: {
          location: 'location',
          forecast_date: 'date'
        }
      },
      publishes: {
        success: 'weather.loaded',
        error: 'weather.failed'
      }
    }
  ]
})

broker.registerPlugin({
  id: 'weather-form',
  name: 'Weather Form',
  version: '1.0.0',
  publishes: [{ topic: 'weather.requested' }],
  outputMap: {
    città: { to: 'location', transform: 'normalizeLocationName' },
    data: { to: 'forecast_date', transform: 'parseItalianDate' }
  }
})

broker.registerPlugin({
  id: 'weather-widget',
  name: 'Weather Widget',
  version: '1.0.0',
  subscribes: [{ topic: 'weather.loaded' }],
  inputMap: {
    location: 'location',
    'day-prevision': 'forecast_date',
    temperature: 'temperature_celsius',
    status: 'weather_condition'
  },
  handlers: {
    'weather.loaded': (payload) => renderWeather(payload)
  }
})
```

---

## 39. Open issues da NON lasciare aperte in implementazione

I seguenti punti non devono restare impliciti o non documentati nel codice finale:

- precedenza tra alias automatici e mapping esplicito;
- ordine della pipeline di mapping e validazione;
- comportamento in caso di field mancante;
- comportamento in caso di transform failure;
- comportamento con topic senza route;
- comportamento con più route applicabili allo stesso topic;
- regole di unsubscribe automatico in unregister plugin;
- comportamento dei retry su errori 4xx vs 5xx;
- regole di riconnessione realtime;
- formato delle metriche;
- serializzazione dei messaggi worker.

Il developer deve quindi produrre una documentazione tecnica di implementazione che chiuda esplicitamente questi aspetti.

---

## 40. Conclusione progettuale

Questa libreria non è un semplice event emitter. È un **runtime browser-side di orchestrazione a eventi** che unisce:

- broker pub/sub locale;
- routing dichiarativo;
- gateway unico verso il server;
- supporto al multitasking tramite worker;
- modello dati canonico;
- mapping semantico tra plugin eterogenei;
- strumenti di validazione, introspezione e robustezza.

Il valore distintivo centrale del sistema è che i componenti possono essere sviluppati indipendentemente, usando la propria nomenclatura locale, purché dichiarino come i propri dati si collegano al vocabolario canonico del broker. Questo permette di costruire un ecosistema modulare, estendibile e governabile senza imporre un accoppiamento diretto tra i componenti.

Il developer dovrà realizzare la libreria rispettando integralmente questi principi e questi requisiti, privilegiando chiarezza architetturale, debuggabilità, estendibilità e affidabilità runtime.

---

## 41. Deliverable attesi dal developer

Oltre alla libreria funzionante, sono attesi i seguenti deliverable:

1. codice sorgente della libreria;
2. build distribuibile;
3. documentazione API pubblica;
4. guida di integrazione plugin;
5. documentazione del canonical model e del mapper;
6. documentazione route e gateway server;
7. suite test automatizzati;
8. esempi end-to-end;
9. documentazione del debug tooling.

Tali deliverable sono parte integrante del risultato richiesto.

---

## 42. Checklist finale di conformità

La seguente checklist deve risultare interamente positiva.

- [ ] Esiste un broker pub/sub interno alla pagina.
- [ ] I componenti possono dichiarare subscribe e publish.
- [ ] Il broker è il punto unico di contatto col server per i flussi coperti.
- [ ] Le richieste HTTP sono route-driven.
- [ ] Esiste almeno un canale realtime inbound dal server.
- [ ] Esiste supporto ai Web Worker.
- [ ] Esiste un canonical model interno.
- [ ] Esiste un mapper locale ↔ canonico ↔ locale.
- [ ] Le trasformazioni sono supportate e registrabili.
- [ ] Gli eventi possono essere validati.
- [ ] Gli errori sono gestiti e tracciabili.
- [ ] Esistono strumenti di debug per eventi, mapping e route.
- [ ] Esiste gestione lifecycle e cleanup.
- [ ] Esistono test sufficienti.
- [ ] Il sistema consente interoperabilità tra plugin con nomenclature diverse.

Se uno di questi punti manca, l’implementazione non è conforme a questo PRD.

