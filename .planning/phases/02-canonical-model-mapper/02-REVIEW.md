---
phase: 02-canonical-model-mapper
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - package.json
  - packages/core/src/public-factory.test.ts
  - packages/core/src/public-factory.ts
  - packages/core/src/types/config.ts
  - packages/mapper/README.md
  - packages/mapper/package.json
  - packages/mapper/src/__integration__/alias-ambiguity.test.ts
  - packages/mapper/src/__integration__/cycle-detection.integration.test.ts
  - packages/mapper/src/__integration__/inspector-snapshot.integration.test.ts
  - packages/mapper/src/__integration__/mapping-error-event.integration.test.ts
  - packages/mapper/src/__integration__/plugin-cleanup-mapper.integration.test.ts
  - packages/mapper/src/__integration__/transform-failure-modes.test.ts
  - packages/mapper/src/__integration__/weather-scenario.integration.test.ts
  - packages/mapper/src/alias-registry.test.ts
  - packages/mapper/src/alias-registry.ts
  - packages/mapper/src/augment.test.ts
  - packages/mapper/src/augment.ts
  - packages/mapper/src/broker-mapper-wrapper.test.ts
  - packages/mapper/src/broker-mapper-wrapper.ts
  - packages/mapper/src/canonical-registry.test.ts
  - packages/mapper/src/canonical-registry.ts
  - packages/mapper/src/index.ts
  - packages/mapper/src/inspector.test.ts
  - packages/mapper/src/inspector.ts
  - packages/mapper/src/mapper-engine.test.ts
  - packages/mapper/src/mapper-engine.ts
  - packages/mapper/src/public-factory.test.ts
  - packages/mapper/src/public-factory.ts
  - packages/mapper/src/test-utils/mapper-harness.ts
  - packages/mapper/src/transform-pipeline.test.ts
  - packages/mapper/src/transform-pipeline.ts
  - packages/mapper/src/types/canonical-schema.ts
  - packages/mapper/src/types/index.ts
  - packages/mapper/src/types/input-output-map.ts
  - packages/mapper/src/types/mapping-error.ts
  - packages/mapper/src/types/transform.ts
  - packages/mapper/src/types/validator-adapter.ts
  - packages/mapper/src/valibot-adapter.test.ts
  - packages/mapper/src/valibot-adapter.ts
  - packages/mapper/tsconfig.json
  - packages/mapper/tsup.config.ts
  - packages/mapper/vitest.config.ts
findings:
  blocker: 6
  warning: 9
  info: 5
  total: 20
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-29
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

Phase 2 introduce il package `@sembridge/mapper` con CanonicalRegistry, AliasRegistry, TransformPipeline, MapperEngine, MappingInspector, e il composition wrapper `MapperBroker`. La superficie pubblica è ben tipizzata (branded types, `exactOptionalPropertyTypes`-friendly) e la suite di test è ampia (unit + integration). Tuttavia, l'analisi adversariale ha individuato diverse **falle correttive** importanti che minano i success criteria dichiarati nel README e nei plan:

- **Pipeline §28 estesa F2 NON è instrumentata**: i 5 nuovi step (`event.source.resolved`, `event.mapped.canonical`, `event.canonical.validated`, `event.mapped.consumer`, `event.final.validated`) NON vengono mai invocati sul tap durante `publish`/`subscribe` del `MapperBroker`. Il README afferma il contrario (sezione "Pipeline §28 estesa F2"), e il test integrazione non lo verifica.
- **AliasRegistry NON è wired al MapperEngine**: la resolution order D-40 livelli 2-3 (alias scoped/global) non viene mai applicata a runtime nel MapperEngine; il livello 4 (name-match) di fatto funziona solo perché il `localField === canonicalField` capita per coincidenza. MAP-17 (chiusura PRD §39 #1) non è quindi pienamente coperto.
- **`mapping.error` può raggiungere consumer non desiderati**: il publish di `mapping.error` con `deliveryMode: 'async'` può collassare loop tra il proprio handler error e altri subscriber, e non è isolato per topic. Inoltre la pipeline non skippa la delivery del `mapping.error` stesso se contiene un transform error con riferimento ciclico.
- **Validazione canonical vuota**: `MapperEngine.validateCanonical` ritorna sempre `ok: true` se lo schema è registrato (structural pass V1), ignorando completamente i `FieldDescriptor` registrati. Il payload può violare `required: true` o `type` senza che venga rilevato in fase 6.
- **Cycle detection ha un falso negativo critico**: il DFS in `detectCyclesFrom` non visita un field che è source di derive ma non è declared come top-level chiave del map — un ciclo `A.derive=[B]; B.source=A` (mix derive+source) NON viene rilevato.
- **Bootstrap config non valida transform/alias errors**: bootstrap di `transforms` e `aliasRegistry.scoped` usa `register*` che possono throw — il `MapperBroker` constructor può crashare con una `BrokerError`/`Error` che il consumer non si aspetta dalla factory.

Il numero di test è alto, ma diversi test sono "documentary" (sezione 6 di transform-failure-modes) o validano solo il compile-time. Vedi sotto la classificazione per severità.

## Critical Issues

### CR-01: Pipeline §28 step F2 non sono invocati al runtime — la sezione "Pipeline §28 estesa F2" del README e D-50 sono violati [BLOCKER]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:236-292` (publish + subscribe)
**File:** `packages/mapper/src/inspector.ts:128-130` (recordSnapshot is no-op)
**Issue:** Il `MapperBroker.publish` esegue `applyOutputMap` (passo 5) e `validateCanonical` (passo 6) ma NON invoca mai `tap.onPipelineStep('event.mapped.canonical', ...)` né `tap.onPipelineStep('event.canonical.validated', ...)`. Stessa cosa per `subscribe` ai passi 11/12. Il `MappingInspector.recordSnapshot` è dichiaratamente no-op in V1 (commento riga 128), ma il problema è più profondo: il tap utente passato in `config.runtime.tap` NON viene MAI invocato per gli step F2. Il README dichiara che "I 5 nuovi step pipeline §28 invocano il tap esistente" e il `weather-scenario.integration.test.ts:102-103` controlla solo gli step F1 — gli step F2 non sono testati. Risultato: ARCHITECTURE §3.2 ("EventTap pre-instrumentato in F1, esteso in F2-F5") è violato; F6 dovrà retrofit invece di limitarsi a sostituire il no-op come dichiarato in CLAUDE.md "Vincolo architetturale critico".

**Fix:** Invocare `this.tap.onPipelineStep(...)` (con tap composto via `wrapTap` come previsto da `getMappingInspector`) ai 4 punti chiave del wrapper:
```ts
// In publish, dopo applyOutputMap:
this.tap?.onPipelineStep('event.mapped.canonical' as PipelineStep, makeSnapshot(...))
// Dopo validateCanonical:
this.tap?.onPipelineStep('event.canonical.validated' as PipelineStep, ...)

// In wrapConsumerHandler, dopo applyInputMap:
this.tap?.onPipelineStep('event.mapped.consumer' as PipelineStep, ...)
// Dopo final validation:
this.tap?.onPipelineStep('event.final.validated' as PipelineStep, ...)
```
Salvare il tap nel constructor: `this.tap = wrapTap(config.runtime?.tap ?? noopEventTap, this.inspector)`. Aggiornare anche il `Broker` interno con il tap composto se possibile, oppure invocarlo esplicitamente nel wrapper.

---

### CR-02: AliasRegistry non è mai consultato dal MapperEngine — MAP-17 non chiuso a runtime [BLOCKER]

**File:** `packages/mapper/src/mapper-engine.ts:443-490` (resolveValue), `packages/mapper/src/mapper-engine.ts:325-338` (compileRules)
**Issue:** Il `MapperEngine` accetta un `aliasRegistry` come dipendenza (`MapperEngineOptions`), lo memorizza in `this.aliasRegistry`, ma lo USA SOLO in `stats()` per contare gli alias registrati. La `resolveValue` non invoca mai `aliasRegistry.resolve(pluginId, localField)`. Conseguenza: alias globali e scoped registrati via `broker.registerAlias(...)` o `aliasRegistry.global` nel config NON applicano alcuna trasformazione locale → canonical. Il README afferma "Quando il mapper deve risolvere `localField → canonicalField`, applica l'ordine di precedenza" — ma il mapper non risolve mai gli alias. MAP-17 (chiusura PRD §39 #1) viene chiusa solo per il livello 1 (mapping esplicito) e il livello 4 (name-match per coincidenza, perché il `MappingRule.source` è hardcoded). I livelli 2-3 sono funzionalmente morti in F2.

Il test `mapper-engine.test.ts:197 (Test 9)` afferma che "explicit mapping wins over auto-alias" — ma il test stesso non fa fallire un'alternativa: l'alias è registrato ma il mapper non lo consulta, quindi il test "passa" senza dimostrare nulla.

**Fix:** Estendere `compileRules` (o creare un nuovo fase di compilation) per consultare `aliasRegistry.resolve(pluginId, localField)` quando un campo locale del payload non è coperto da un mapping esplicito. In alternativa, documentare nel README che gli alias sono "registry only" in V1 e non hanno effetto runtime, e cambiare il README per non promettere l'ordine di risoluzione 2-3. Un test di regressione concreto:
```ts
it('global alias is applied when no explicit mapping exists', async () => {
  const harness = createMapperHarness({
    schemas: [{ id: 'sch' as CanonicalSchemaId, fields: { location: { type: 'string' } } }],
    aliases: { city: 'location' },  // city → location global alias
  })
  await harness.broker.registerPlugin({
    id: 'p',
    canonicalSchemaId: 'sch' as CanonicalSchemaId,
    // NO outputMap esplicito su 'location' — l'alias dovrebbe applicarsi
  })
  // ...publish con payload { city: 'Roma' } → consumer riceve { location: 'Roma' }
})
// Questo test attualmente FAIL (riceve {} o passthrough invariato).
```

---

### CR-03: Cycle detection ha falso negativo per cicli misti derive↔source [BLOCKER]

**File:** `packages/mapper/src/mapper-engine.ts:352-386` (detectCycles + detectCyclesFrom)
**Issue:** Il DFS in `detectCyclesFrom` segue solo i `rule.derive.sources`, ignorando `rule.source`. Considera questo descriptor:
```ts
outputMap: {
  a: { derive: { sources: ['b'], transform: 'tx' } },
  b: { source: 'a' },  // 'b' legge 'a' tramite source semplice (NON derive)
}
```
Per il mapper-engine, `b` è una rule senza `derive` — `detectCyclesFrom` ritorna `if (!rule?.derive) return` senza esplorare il `source`. Risultato: il ciclo `a → b → a` NON viene rilevato. A runtime, `applyOutputMap` legge `source[a]` (undefined) → `b` undefined → `a.derive.sources=[b]` riceve `[undefined]` → il transform `tx` ottiene un argomento undefined. Comportamento silenzioso, payload corrotto, no error. Inoltre, anche se i source NON sono normalmente trattati come edge per dependency analysis, il fatto che il README e D-35 promettano "cycle detection register-time" significa che il consumer si aspetta protezione completa. **Mitigation parziale**: questo non è un infinite loop runtime perché `applyMapping` itera linearmente sui `compiledFieldMapping`, ma è un bug di correttezza.

Inoltre: il cycle detection esegue DFS partendo da OGNI top-level field (riga 355), il che ha complessità O(N * D) dove D è la profondità del grafo. Per descriptor con derive deeply nested e molti field, è quadratico. Non blocking ma worth nota.

**Fix:** Estendere `detectCyclesFrom` per seguire anche `rule.source` (se è il nome di un altro field nel map), oppure documentare esplicitamente che `source` non partecipa al graph e che cycle detection è limitata ai derive. Implementazione:
```ts
private detectCyclesFrom(pluginId, map, field, path): void {
  if (path.includes(field)) { /* throw existing */ }
  const rule = (map as Record<string, MappingRule>)[field]
  if (!rule) return
  const newPath = [...path, field]
  // Segui derive sources (esistente)
  if (rule.derive) {
    for (const src of rule.derive.sources) this.detectCyclesFrom(pluginId, map, src, newPath)
  }
  // Segui source se referenzia un altro field del map (ADD)
  if (rule.source && map[rule.source as keyof typeof map]) {
    this.detectCyclesFrom(pluginId, map, rule.source, newPath)
  }
}
```

---

### CR-04: validateCanonical è un no-op che ignora i FieldDescriptor — passo 6 della pipeline non valida nulla [BLOCKER]

**File:** `packages/mapper/src/mapper-engine.ts:291-303`
**Issue:** `validateCanonical(schemaId, payload)` controlla solo che lo schema sia registrato; se lo è, ritorna `{ ok: true, value: payload }` senza guardare i `FieldDescriptor.type`/`required`. Il commento dichiara "F2 V1: structural pass" ma il README afferma "post-mapping validation" come parte dei "7 casi PRD §14.2" che il mapper deve supportare (success criterion #3). Conseguenza: payload canonico con tipi sbagliati (`location: 42` per `type: 'string'`) o field `required: true` mancanti (DOPO il mapping — situazione diversa da `mapping.field.missing` che si verifica nel `applyMapping`) passano la validazione. Il test integrazione `transform-failure-modes.test.ts:296-304` riconosce esplicitamente che V1 è permissive ed evita di assertare il behavior — ma questo significa che il success criterion #3 non è coperto.

In aggiunta: il `valibotAdapter` è iniettato come dipendenza (`MapperEngineOptions.validator`) ma NON viene mai chiamato in `validateCanonical`. È un dead field iniettato per future use ma documentato come "F2 V1 V1.x potrà costruire dinamicamente uno schema Valibot" — questa è una feature non implementata, non un V1.x deferral come dichiarato.

**Fix:** Implementare la validation costruendo dinamicamente uno schema Valibot dai `FieldDescriptor`, oppure documentare apertamente nel README che il passo 6 non valida e demote il success criterion #3. Esempio implementazione minima:
```ts
validateCanonical(canonicalSchemaId, payload): ValidationResult {
  const schema = this.canonicalRegistry.get(canonicalSchemaId)
  if (!schema) return { ok: false, issues: [...] }
  const issues: ValidationIssue[] = []
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, issues: [{ message: 'canonical payload must be object' }] }
  }
  const obj = payload as Record<string, unknown>
  for (const [name, fd] of Object.entries(schema.fields)) {
    const present = name in obj
    if (fd.required && !present) {
      issues.push({ path: [name], message: `required field missing` })
      continue
    }
    if (present) {
      const val = obj[name]
      const typeOk = fd.type === 'any' || matchesType(val, fd.type)
      if (!typeOk) issues.push({ path: [name], message: `expected ${fd.type}, got ${typeof val}` })
    }
  }
  return issues.length === 0 ? { ok: true, value: payload } : { ok: false, issues }
}
```

---

### CR-05: bootstrapFromConfig può throw nel constructor — comportamento non documentato [BLOCKER]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:483-507` (bootstrapFromConfig)
**File:** `packages/mapper/src/public-factory.ts:123-132` (createMapperBroker)
**Issue:** `bootstrapFromConfig` invoca `transformPipeline.register(name, fn)` (può throw `transform.id.duplicate`), `aliasRegistry.registerGlobal(local, canonical)` (può throw `alias.global.conflict`), `aliasRegistry.registerScoped(...)` (può throw `alias.scoped.conflict`), e `canonicalRegistry.register(schema)` (può throw `canonical.requires.unresolved`). Se la `Map`-iteration su `config.transforms` o `config.aliasRegistry.scoped` produce duplicati (improbabile con object literal, ma config provenienti da JSON merging possono averli), o se `aliasRegistry.global` ha conflict tra plugin che riusano lo stesso alias, la **`createMapperBroker` factory** lancia un `BrokerError` di category `mapping` o un `Error` nativo. La JSDoc dichiara solo `throw {Error} 'Invalid MapperBrokerConfig'` (validation Valibot). Il consumer che cattura "Invalid MapperBrokerConfig" non gestisce le altre eccezioni, e il broker resta in uno stato parzialmente inizializzato (constructor ha completato `inner = new Broker(config)` ma non il bootstrap).

Inoltre: l'ordine bootstrap (canonicalModel → aliasRegistry → transforms) è fisso, mentre se uno schema canonico ha `requires` su un altro schema dello stesso config che viene processato dopo, lo schema dependency fallisce. Esempio:
```ts
canonicalModel: { schemas: [
  { id: 'forecast', requires: ['user'], fields: {...} }, // throws - 'user' not registered yet
  { id: 'user', fields: {...} },
]}
```
L'ordine nell'array determina la registrability — il consumer deve fare topological sort manualmente.

**Fix:** O wrappare il bootstrap in try/catch riportando errori aggregati al consumer (raccomandato), o documentare esplicitamente la lista di possibili throw. Ordinare topologicamente gli schema per `requires` automaticamente, o fail-fast con messaggio chiaro. Patch:
```ts
private bootstrapFromConfig(config: MapperBrokerConfig): void {
  if (!config) return
  // 1. Topological sort of canonical schemas by 'requires'
  if (config.canonicalModel?.schemas) {
    const sorted = topologicalSort(config.canonicalModel.schemas)
    for (const schema of sorted) {
      try { this.canonicalRegistry.register(schema) }
      catch (err) { this.logger.error('bootstrap: canonical register failed', { schemaId: schema.id, error: err }); throw err }
    }
  }
  // ... idem per altri sezioni con error wrapping
}
```

---

### CR-06: handleMappingError pubblica `mapping.error` con `deliveryMode: 'async'` — può loop se mapping.error subscriber a sua volta fallisce [BLOCKER]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:615-634` (handleMappingError)
**Issue:** `handleMappingError` chiama `this.inner.publish('mapping.error', payload, { source: { type: 'system', id: 'mapper' }, deliveryMode: 'async' })`. Il problema: il publish va attraverso `this.inner` (NON `this.publish` del MapperBroker), quindi il payload `mapping.error` salta tutto il mapping wrapper. Tuttavia: se un consumer subscribe a `mapping.error` e a sua volta lancia, il `Broker.bus` di F1 potrebbe re-publishare un `system.error` (CORE-12 handler isolation). Se quel `system.error` viene a sua volta gestito da un mapper-aware subscriber che fallisce... non c'è guard contro questo loop. Il commento "T-02-10-05: F1 handler isolation previene cascade infinita" presume che F1 sia robusto, ma non è verificato in questo package.

In aggiunta, e più gravemente: il `payload` di `mapping.error` contiene `error: BrokerError` — un oggetto `Error` con stack trace e potenzialmente `cause: Error` con riferimenti circolari (createBrokerError + originalError). Quando F1 deep-freeze (in dev mode) tenta di freeze il payload, può fallire o accedere a getter che hanno side effect (e.g., `error.stack` lazily computed). Test mancante per questo path.

E ancora: `JSON.stringify(payload)` in eventuali logger/inspector con `BrokerError + originalError + cause` produce output non deterministico (Error ha `toJSON` undefined in alcuni motori e custom in altri). Il README afferma "Inspector ring buffer bounded" per il count ma il payload effettivo del mapping.error che entra negli handler subscriber è una struttura potenzialmente non serializable.

**Fix:** 
1. Sanitize il payload prima del publish: estrarre solo `code`, `category`, `message`, `details`, evitare `originalError`/`cause`/`stack` ricorsivi:
```ts
const safeError = {
  code: err.code, category: err.category, message: err.message,
  details: err.details, // already plain object
}
this.inner.publish('mapping.error', { error: safeError, sourceEvent: sourceTopic, step }, ...)
```
2. Guard esplicito contro recursion: track in-flight mapping errors via Set<string> (sourceTopic+step) e skip se già in chain.
3. Test caso: subscribe a `mapping.error` con handler che throws → verificare che NON triggera re-publish di `mapping.error` infinito.

## Warnings

### WR-01: Proxy in wrapPluginContext rompe il `this` binding per metodi non-funzione [WARNING]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:553-579` (wrapPluginContext)
**Issue:** Il Proxy intercetta `get` e per ogni proprietà funzione fa `value.bind(target)` (riga 573). Questo rompe i metodi che dipendono dal `this` essere il Proxy stesso (per chained calls), e per i getter properties non funzione perde l'identity. In particolare, se il `ctx.broker` originale (PluginScopedBroker di F1) ha proprietà non enumerable o getter (eg. `get pendingAsyncDelivery()`), il proxy ritorna un valore stale. Inoltre: il `subscribe` è intercettato senza supportare il caso `subscribe(pattern, handler)` con 2 argomenti — la chiusura forza `options = {}` come 3° argomento, ok, ma non controlla se `target.subscribe` accetta 3 argomenti. Se F3 cambia la firma del subscribe scoped, questo Proxy rompe silently.

**Fix:** Usare un wrapper esplicito con metodi typed invece di un generic Proxy:
```ts
private wrapPluginContext(ctx, pluginId): PluginContext {
  const inner = ctx.broker as ScopedBrokerLike
  const wrapped = {
    subscribe: (pattern, handler, options = {}) => {
      if (this.mapper.hasInputMap(pluginId)) {
        return inner.subscribe(pattern, this.wrapConsumerHandler(pluginId, handler), options)
      }
      return inner.subscribe(pattern, handler, options)
    },
    publish: inner.publish?.bind(inner),
    // expose other methods as needed explicitly
  }
  return { ...ctx, broker: wrapped }
}
```

### WR-02: `topicSchemas` placeholder rimane `unknown` ma il TS augmentation non lo tipa — config con shape sbagliata accettato [WARNING]

**File:** `packages/core/src/types/config.ts:58` (topicSchemas), `packages/mapper/src/augment.ts` (no topicSchemas augment)
**Issue:** `topicSchemas?: unknown` rimane tale anche dopo F2. Il `MapperBrokerConfigSchema` Valibot lo accetta come `v.optional(v.unknown())`. In runtime questo significa che ANY shape è accettata e ignorata. Il README dichiara "topicSchemas (F2 V2 deferred): kept as unknown placeholder" — accettabile, ma il consumer può passare `topicSchemas: { weatherTopic: 'invalid-schema' }` aspettandosi validazione e ottenere silent ignore. Un test "regression-prevention" (esempio: warn nel constructor se `topicSchemas` non vuoto) eviterebbe sorprese in F3+.

**Fix:** Aggiungere `if (config.topicSchemas !== undefined) this.logger.warn('topicSchemas is reserved for F2 V2 — currently ignored')` nel `MapperBroker` constructor.

### WR-03: applyMapping non protegge contro `__proto__` / `constructor` keys [WARNING]

**File:** `packages/mapper/src/mapper-engine.ts:404-430` (applyMapping)
**Issue:** Il payload locale viene letto con `source[path]` e il risultato è accumulato in `result[fm.canonicalField]`. Se un payload utente contiene `{ __proto__: { polluted: true } }`, e un `MappingRule` ha `source: '__proto__'` (improbabile ma possibile), il mapper espone il prototype object al canonical. Più realisticamente: se il `canonicalField` è `__proto__` o `constructor` (impossibile in TS strict, ma possibile via cast), il `result['__proto__'] = ...` può prototype-pollute il `result` object. Anche `readPath` con dot-path `__proto__.polluted` espone gli internal del prototype.

**Fix:** Filtrare keys riservate in `compileRules` e `readPath`:
```ts
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
// In compileRules:
if (RESERVED_KEYS.has(canonicalField)) throw createBrokerError({ code: 'mapping.field.invalid', ... })
// In readPath:
if (parts.some(p => RESERVED_KEYS.has(p))) return undefined
```
Oppure usare `Object.create(null)` per `result` invece di `{}` (rimuove la prototype chain per output object).

### WR-04: `wrapTap` chiama l'inspector dopo il tap originale — ordine non documentato [WARNING]

**File:** `packages/mapper/src/inspector.ts:209-221` (wrapTap)
**Issue:** L'ordine di invocazione è: tap originale prima, inspector dopo. Se il tap originale modifica lo snapshot (es. mutates), l'inspector vede il valore mutato. Anche se `PipelineSnapshot` è readonly type-level, in JS niente impedisce mutation. Il commento "il tap originale non deve rompere il chain" implica safety del catch ma non discute ordering. Inoltre, se il tap originale è async (ritorna Promise), `try { original.onPipelineStep(...) }` swallow il throw sincrono ma NON aspetta la promise — eventuali rejection vengono silently lost.

**Fix:** Documentare l'ordine esplicitamente; preferire chiamata inspector-first per leggere snapshot non corrotto:
```ts
export function wrapTap(original, inspector): EventTap {
  return {
    onPipelineStep(step, snapshot): void {
      // Inspector PRIMA del tap utente — vediamo snapshot pristine.
      try { inspector.recordSnapshot(step, snapshot) } catch { /* never throw from inspector */ }
      try { original.onPipelineStep(step, snapshot) } catch { /* swallow user tap */ }
    }
  }
}
```

### WR-05: TransformPipeline.unregisterByOwner muta il Map durante l'iterazione [WARNING]

**File:** `packages/mapper/src/transform-pipeline.ts:173-182`
**Issue:** Il loop `for (const [name, entry] of this.transforms)` chiama `this.transforms.delete(name)` durante l'iterazione. In JS Map iteration semantics, delete durante for-of è ufficialmente safe — l'iteratore visita gli elementi correnti e skippa quelli rimossi. Tuttavia, su engine con implementazioni più aggressive (e in alcuni lint rules), questo è un anti-pattern segnalato. Prevedibile ma stylistically debole.

**Fix:** Collect-then-delete:
```ts
unregisterByOwner(pluginId: string): number {
  const toDelete: string[] = []
  for (const [name, entry] of this.transforms) {
    if (entry.ownerId === pluginId) toDelete.push(name)
  }
  for (const name of toDelete) this.transforms.delete(name)
  return toDelete.length
}
```

### WR-06: MapperBroker.unregisterPlugin cleanup ordering — risorse rimosse PRIMA della unregister F1 inducono race [WARNING]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:328-361` (unregisterPlugin)
**Issue:** L'ordine attuale è: `inner.unregisterPlugin(id)` PRIMA, poi cascade F2 (alias scoped, transform, mapper compiled). Se durante `inner.unregisterPlugin` il plugin esegue `onUnmount` che pubblica un evento, quel publish utilizza ancora il mapper compiled (`mapper.hasCompiled(id) === true`). Se `onUnmount` triggera un mapping che usa un transform di un altro plugin il quale a sua volta è in fase di unregister, può esserci overlap. Più semplicemente: il commento dice che la cascade è coerente con LIFE-02, ma F1 esegue cascade `bus.unsubscribeByOwner(id)` DENTRO `inner.unregisterPlugin`, non dopo. Quindi F2 cascade after F1 è ok per cleanup, ma il documento del README "Cascade isolata: ogni step indipendente" (T-02-10-03) è in tensione con l'ordering.

In aggiunta: `try/catch` swallow di ogni step **non è preceduto da log**: se `mapper.unregisterPluginMappings` rimuove fallisce silently, il consumer non lo sa. Il pattern attuale fa `this.logger.error(...)` ma il logger di default è `silentLogger` — error invisible.

**Fix:** Consolidare l'error reporting via Inspector ring buffer:
```ts
async unregisterPlugin(id: string): Promise<void> {
  await this.inner.unregisterPlugin(id)
  const errors: BrokerError[] = []
  const safe = (op: () => void, step: string) => {
    try { op() }
    catch (err) {
      const wrapped = createBrokerError({ code: 'plugin.cascade.failed', category: 'plugin', message: ..., details: { id, step, error: err }})
      this.inspector.recordError(wrapped)
      errors.push(wrapped)
    }
  }
  safe(() => this.aliasRegistry.unregisterScopedAll(id), 'alias-cascade')
  safe(() => this.transformPipeline.unregisterByOwner(id), 'transform-cascade')
  safe(() => this.mapper.unregisterPluginMappings(id), 'mapper-cascade')
  // ... canonical schemas
}
```

### WR-07: F1 createBroker accetta sezioni F2-F6 come pass-through senza validazione — default sicuro? [WARNING]

**File:** `packages/core/src/public-factory.ts:96-103`
**Issue:** `createBroker` (F1) riceve un `BrokerConfig` con sezioni F2-F6 augmented dichiarazionalmente. Il `BrokerConfigSchema` usa `v.looseObject` (riga 39), accettando qualsiasi extra key. Se un consumer chiama `createBroker({ canonicalModel: { schemas: 'wrong-shape' } })` (F1-only, senza importare il package mapper), nessuna validazione struttura le sezioni. Acceptable per pass-through ma il consumer non riceve errore. Il commento in `public-factory.ts:55-60` riconosce ciò ("i package F2-F6 hanno la responsabilità di validare le proprie sezioni internamente al momento del wiring") ma il `MapperBroker.bootstrapFromConfig` lo fa solo SE creato via `createMapperBroker` — `new Broker(config)` direttamente con `canonicalModel: {...}` non valida nulla.

Questo si lega a CR-05: il consumer non sa quale factory deve usare.

**Fix:** Documentare nel JSDoc di `createBroker` (F1) che le sezioni F2-F6 sono ignorate al runtime se non si usa la factory specifica. Considerare un log warn in `createBroker` quando sezioni F2-F6 sono presenti ma `@sembridge/mapper` non è caricato.

### WR-08: ValidatorAdapter.validate sopra cast `unknown` a `BaseSchema` può accettare schema runtime errato e ritornare ok [WARNING]

**File:** `packages/mapper/src/valibot-adapter.ts:104-113`
**Issue:** Il cast `schema as v.BaseSchema<...>` è un cast non-checked. Se il caller passa un objeto che NON è uno schema Valibot (es. `{ type: 'string' }` JSON Schema-like), `v.safeParse` può:
- Throw un internal error → catturato dal try/catch e ritornato come `{ ok: false, issues: [...] }` ✓
- Ritornare `{ success: true, output: payload }` se l'oggetto NON-schema accidentalmente non triggera l'errore → adapter ritorna `ok: true` con un payload non-validato → la pipeline F2 prosegue come se la validation fosse passata

In particolare: `v.safeParse({}, payload)` (oggetto vuoto come schema) — il behavior dipende dall'implementazione Valibot 1.x. Test mancante per il caso "non-Valibot schema".

**Fix:** Verificare che lo schema sia un `BaseSchema` con un type guard:
```ts
function isValibotSchema(s: unknown): s is v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
  return typeof s === 'object' && s !== null && '_run' in s && typeof (s as { _run?: unknown })._run === 'function'
}
// In validate:
if (!isValibotSchema(schema)) {
  return { ok: false, issues: [{ message: 'invalid schema: not a Valibot BaseSchema' }] }
}
```

### WR-09: Default `errorBufferSize=10` può troncare errori importanti su burst [WARNING]

**File:** `packages/mapper/src/inspector.ts:109`
**Issue:** Il ring buffer di default contiene solo 10 errori. In un burst (es. 100 transform fail in 1 secondo per un produttore broken), gli ultimi 90 sostituiscono i primi 10 e il consumer perde l'osservabilità del problema iniziale (root cause). Il README e la JSDoc lo riconoscono come accept ("F2 V1 best-effort"), ma 10 è basso. Lo standard nelle libraries error-tracking è 50-100.

**Fix:** Aumentare default a 50 (`errorBufferSize ?? 50`) e/o esporre `errorBufferSize` nel `MapperBrokerConfig` per permettere override. Aggiungere metric counter "errori droppati" per visibilità:
```ts
private droppedCount = 0
recordError(error: BrokerError): void {
  this.errorBuffer.push(error)
  if (this.errorBuffer.length > this.errorBufferSize) {
    this.errorBuffer.shift()
    this.droppedCount++
  }
}
getSnapshot(): MappingInspectorSnapshot {
  return { ..., droppedErrorsCount: this.droppedCount }
}
```

## Info

### IN-01: README sezione "Helpers runtime" lista 5 classi ma il barrel ne esporta tutte [INFO]

**File:** `packages/mapper/README.md:189`
**Issue:** Il README dice "Le 4 classi runtime AliasRegistry, CanonicalRegistry, TransformPipeline, MapperEngine, MappingInspector sono esportate" — sono 5 nomi ma scrive "4 classi". Errore tipografico cosmetico.

**Fix:** Cambiare "4 classi" in "5 classi" o riformulare.

### IN-02: Nomi method `unregisterByOwner` vs `unregisterScopedAll` — naming inconsistency [INFO]

**File:** `packages/mapper/src/transform-pipeline.ts:173`, `packages/mapper/src/alias-registry.ts:203`
**Issue:** `TransformPipeline.unregisterByOwner(pluginId)` e `AliasRegistry.unregisterScopedAll(pluginId)` fanno la stessa cosa concettualmente (cascade plugin) ma hanno nomi diversi. `MapperEngine.unregisterPluginMappings` usa un terzo naming. Inconsistency surface-level.

**Fix:** Standardizzare su `unregisterByOwner(ownerId)` o `unregisterByPlugin(pluginId)` per i 3 metodi cascade. Refactor:
- `AliasRegistry.unregisterScopedAll(pluginId)` → `AliasRegistry.unregisterByOwner(pluginId)`
- `MapperEngine.unregisterPluginMappings(pluginId)` → `MapperEngine.unregisterByOwner(pluginId)`

### IN-03: Test "documentary" che non assertano nulla [INFO]

**File:** `packages/mapper/src/__integration__/transform-failure-modes.test.ts:301-355` (Test 5 e Test 6)
**Issue:** Due test del suite di failure modes hanno `expect(true).toBe(true)` come unica assertion (riga 303 e 355) "per documentare il behavior corrente". Questi test PASSANO sempre indipendentemente dal codice e non producono regressione signal. Sono noise nel report di test.

**Fix:** Rimuovere questi test, oppure renderli proper assertion-based. Per Test 5 (canonical validation failure), assertare il behavior atteso (sì o no `mapping.error` published) e committare al contract; per Test 6 (skip + required combo), specificare cosa vuole il design e testare quello.

### IN-04: `interface ImportMetaEnv` referenced ma non importata in broker.ts [INFO]

**File:** `packages/core/src/core/broker.ts:103` (cast a `ImportMetaEnv`)
**Issue:** Il cast `import.meta as unknown as { env?: ImportMetaEnv }` referenzia un type `ImportMetaEnv` che è ambient (provided da Vite/tsup typings). Se il consumer build con un toolchain diverso che non fornisce questo ambient, il typecheck fallisce. Non è in scope F2 ma il review l'ha attraversato.

**Fix:** Definire un type locale narrow `interface ImportMetaEnv { DEV?: boolean }` o usare un narrower cast:
```ts
const meta = import.meta as unknown as { env?: { DEV?: boolean } }
```

### IN-05: `RESERVED` keys in source/canonicalField + magic numbers (errorBufferSize, etc) non centralizzati [INFO]

**File:** `packages/mapper/src/inspector.ts:109`, `packages/mapper/src/mapper-engine.ts:409`
**Issue:** I default magic value (errorBufferSize=10, payload `?? {}` fallback, payload null check) sono sparsi nel codice. Una sezione `constants.ts` ridurrebbe duplication e renderebbe i tuning visibili.

**Fix:** Creare `packages/mapper/src/constants.ts` con:
```ts
export const DEFAULT_ERROR_BUFFER_SIZE = 50
export const RESERVED_FIELD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
export const PIPELINE_F2_STEPS = ['event.source.resolved', 'event.mapped.canonical', 'event.canonical.validated', 'event.mapped.consumer', 'event.final.validated'] as const
```

---

_Reviewed: 2026-04-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
