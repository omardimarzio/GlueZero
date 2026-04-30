---
phase: 02-canonical-model-mapper
reviewed: 2026-04-29T16:30:00Z
depth: standard
review_type: post_iter2_re_review
iteration: 3
files_reviewed: 21
files_reviewed_list:
  - packages/mapper/src/broker-mapper-wrapper.ts
  - packages/mapper/src/broker-mapper-wrapper.test.ts
  - packages/mapper/src/mapper-engine.ts
  - packages/mapper/src/mapper-engine.test.ts
  - packages/mapper/src/inspector.ts
  - packages/mapper/src/inspector.test.ts
  - packages/mapper/src/valibot-adapter.ts
  - packages/mapper/src/valibot-adapter.test.ts
  - packages/mapper/src/transform-pipeline.ts
  - packages/mapper/src/alias-registry.ts
  - packages/mapper/src/canonical-registry.ts
  - packages/mapper/src/public-factory.ts
  - packages/mapper/src/index.ts
  - packages/mapper/README.md
  - packages/mapper/src/__integration__/weather-scenario.integration.test.ts
  - packages/mapper/src/__integration__/alias-ambiguity.test.ts
  - packages/mapper/src/__integration__/cycle-detection.integration.test.ts
  - packages/mapper/src/__integration__/inspector-snapshot.integration.test.ts
  - packages/mapper/src/__integration__/mapping-error-event.integration.test.ts
  - packages/mapper/src/__integration__/plugin-cleanup-mapper.integration.test.ts
  - packages/mapper/src/__integration__/transform-failure-modes.test.ts
findings:
  blocker: 1
  warning: 4
  total: 5
status: issues_found
---

# Phase 2 — Code Review Report (Iteration 3, post-iter2 fix)

**Reviewed:** 2026-04-29T16:30:00Z
**Depth:** standard (focus mirato sui 7 finding iter2: CR-01-RESIDUAL, CR-02-RESIDUAL, WR-A, WR-B, WR-C, WR-D, WR-E)
**Files reviewed:** 21
**Test baseline verified:** mapper 172/172 PASS · core 248/248 PASS · `tsc --noEmit` clean su entrambi i package
**Status:** issues_found

## Summary

Verifica adversarial dei 7 finding chiusi in iter2 (`02-REVIEW-FIX.md` iter 2 → `all_fixed`).

**Trace per ogni finding iter2:**

| Iter2 finding | Stato verificato | Note |
|---------------|------------------|------|
| CR-01-RESIDUAL (`event.source.resolved` step) | **CONFIRMED FIXED** | `broker-mapper-wrapper.ts:348` (publish-side) e `:908` (consumer-side) emettono il step. Test `weather-scenario.integration.test.ts:107` verifica. 5/5 step F2 ora strumentati. |
| CR-02-RESIDUAL (alias-only path nel broker) | **CONFIRMED FIXED** ma introduce edge case (vedi BL-01) | Guard a `broker-mapper-wrapper.ts:432-437` ora compila se `canonicalSchemaId \|\| outputMap \|\| inputMap`. Test `alias-ambiguity.test.ts:179-251` verifica scoped+global. |
| WR-A (Valibot `~run` error message) | **CONFIRMED FIXED** | `valibot-adapter.ts:128` usa `~run`. Test `valibot-adapter.test.ts:117-118` verifica `contiene '~run'` E `non contiene '_run'`. |
| WR-B (duplicate schema id detection) | **CONFIRMED FIXED** | `broker-mapper-wrapper.ts:754-764` early-throw `bootstrap.canonical.duplicate`. Test `broker-mapper-wrapper.test.ts:609-643` verifica code, category, message non `cycle`, details.schemaId. |
| WR-C (eventId reale propagato) | **PARZIALMENTE FIXED** (vedi WR-01) | Subscribe-side propaga `event.id` reale. Publish-side resta placeholder `f2:topic:step` (documentato come limitation F6 da JSDoc). |
| WR-D (null+required handling) | **DOCUMENTATION FIXED** ma incoerente con README precedente (vedi WR-02) | mapper-engine.ts:351-360 JSDoc + Test 25h verificano. README WR-D iter2 paragraph corretto, MA tabella precedente al §Field policy contiene ancora un error code obsoleto. |
| WR-E (recursion guard test transitivo) | **CONFIRMED FIXED** | 2 nuovi test in `broker-mapper-wrapper.test.ts:503-581` (transitivo + documentary). JSDoc su `handleMappingError:954-961` + `inFlightMappingErrors:230-234` chiarisce semantica. |

**Findings emersi (NON in scope iter2 — emersi dalla re-review come effetti collaterali o gap pre-esistenti):**
- **1 BLOCKER**: regression introdotta da CR-02-RESIDUAL fix per plugin con SOLO `canonicalSchemaId` (no maps, no aliases) → payload silently dropped.
- **2 WARNING residui**: WR-C publish-side asimmetria; README field-policy table error-code stale.
- **1 WARNING gap pre-esistente**: AliasRegistry/CanonicalRegistry no prototype-pollution guard (gap iter1 WR-03 incomplete).
- **1 WARNING design**: `event.source.resolved` consumer-side è semantica F6-friendly ma non strict-PRD §28.

## Blocker Issues

### BL-01: Regression — plugin con SOLO `canonicalSchemaId` (senza maps né aliases) ora droppa il payload [BLOCKER]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:432-439`
**Riferimento iter2:** CR-02-RESIDUAL (`02-REVIEW-FIX.md` iter2 §CR-02-RESIDUAL)

**Issue:**
Il fix CR-02-RESIDUAL ha esteso il guard di `compileMappings` da `outputMap !== undefined || inputMap !== undefined` a `canonicalSchemaId !== undefined || outputMap !== undefined || inputMap !== undefined`. Questo ha l'effetto desiderato (alias scoped/global ora applicati a runtime), MA introduce un side-effect inverso per i plugin che hanno SOLO `canonicalSchemaId` (no `outputMap`, no `inputMap`, no alias scoped, no alias globali per i field del payload):

Trace runtime:
1. `registerPlugin({ id: 'p', canonicalSchemaId: 'X' })` → `compileMappings` registra `{ outputCompiled: [], inputCompiled: [], canonicalSchemaId: 'X' }`.
2. `mapper.hasCompiled('p')` → ora ritorna `true` (era `false` pre-iter2).
3. `publish('topic', { foo: 'bar' }, { source: { type: 'plugin', id: 'p' } })` → entra nel branch `if (...hasCompiled)` (linea 341).
4. `applyOutputMap('p', { foo: 'bar' })` → `applyMapping` itera `outputCompiled = []` (zero rules) → `result = {}`. Poi `applyAliasResolution` itera `Object.keys(payload)` = `['foo']`, ma `'foo'` non risolve a nessun alias → nessun field aggiunto. **Ritorna `{}`**.
5. `canonicalPayload` ora è `{}` (era `{ foo: 'bar' }` pre-iter2 — pass-through).
6. Se lo schema `X` ha qualunque field `required: true` → `validateCanonical` fallisce → `mapping.error` + `return` (no delivery). Se ha solo field optional → `inner.publish('topic', {}, options)` → consumer riceve payload VUOTO.

**Pre-iter2** (guard più stringente): plugin con SOLO `canonicalSchemaId` non era compilato → `hasCompiled = false` → branch saltato → `inner.publish(topic, payload, options)` con payload originale invariato.

**Conseguenza concreta:**
- Pattern lecito: dichiarare `canonicalSchemaId` per "intent documentale" senza voler ancora attivare il mapping/aliases (es. plugin in fase di sviluppo che pubblica payload "raw" temporaneamente).
- Test 13 `Bonus passthrough for plugin without outputMap` (broker-mapper-wrapper.test.ts:370) NON copre questo caso (registra plugin SENZA `canonicalSchemaId`).
- Non c'è alcun test che esercita "plugin con solo canonicalSchemaId, payload con field non-aliasati".

**Fix suggerito (scegli uno):**

Opzione A — Restringere il guard:
```ts
// broker-mapper-wrapper.ts:432-437
if (mp.outputMap !== undefined || mp.inputMap !== undefined) {
  this.mapper.compileMappings(mp)
} else if (mp.canonicalSchemaId !== undefined) {
  // Solo canonicalSchemaId: compile only se ci sono alias scoped o globali risolvibili
  // — altrimenti pass-through come pre-iter2 per back-compat.
  if (this.aliasRegistry.listScoped(mp.id).length > 0 || this.aliasRegistry.listGlobal().length > 0) {
    this.mapper.compileMappings(mp)
  }
}
```

Opzione B — Cambiare semantica `applyMapping` per fallback al passthrough:
```ts
// mapper-engine.ts:applyOutputMap (linea 265)
applyOutputMap(pluginId, payload) {
  const compiled = this.compiled.get(pluginId)
  if (!compiled) return this.shallowCopy(payload)
  const result = this.applyMapping(pluginId, payload, compiled.outputCompiled)
  this.applyAliasResolution(pluginId, payload, compiled, result)
  // BL-01 fix: se zero rule esplicite E nessun alias ha aggiunto field, ritorna shallow copy (passthrough back-compat)
  if (compiled.outputCompiled.length === 0 && Object.keys(result).length === 0) {
    return this.shallowCopy(payload)
  }
  return result
}
```

Opzione C — Documentare la breaking change come intentional (richiede aggiornamento PRD §13.5 + README + test esplicito che documenta il dropping behavior come voluto).

**Test che dovrebbe esistere (RED):**
```ts
it('BL-01: plugin with only canonicalSchemaId (no maps, no aliases) preserves payload (regression)', async () => {
  const broker = new MapperBroker({ runtime: { logLevel: 'silent' } })
  broker.registerCanonicalSchema({
    id: 'opt' as CanonicalSchemaId,
    fields: { other: { type: 'string', required: false } },
  })
  await broker.registerPlugin({ id: 'minimal', canonicalSchemaId: 'opt' as CanonicalSchemaId })
  const received: unknown[] = []
  broker.subscribe('demo.evt', (e) => received.push(e.payload))
  broker.publish('demo.evt', { foo: 'bar' }, {
    source: { type: 'plugin', id: 'minimal' },
    deliveryMode: 'sync',
  })
  // Pre-iter2: { foo: 'bar' } passthrough. Post-iter2: {} (foo droppato).
  // L'expectation back-compat richiede passthrough.
  expect(received[0]).toEqual({ foo: 'bar' })
})
```

---

## Warning Issues

### WR-01: WR-C iter2 — pubblicazione asimmetrica del placeholder `eventId` su `event.source.resolved` publish-side [WARNING]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:348-356`
**Riferimento iter2:** WR-C (correlazione `BrokerEvent.id` reale ai snapshot)

**Issue:**
Il fix WR-C iter2 propaga `event.id` reale agli step subscribe-side (11 e 12). Publish-side (step 4 / 5 / 6) il placeholder `f2:${topic}:${step}` resta in uso — la JSDoc giustifica con "l'evento non è ancora stato generato dal `inner.publish`".

Tuttavia, `inner.publish` chiama `createBrokerEvent` SINCRONO che genera `event.id` con nanoid (`packages/core/src/core/broker.ts:160`). Il MapperBroker potrebbe **pre-allocare l'event.id** a inizio `publish()` (con la stessa funzione) e propagarlo come `eventId` a tutti gli step F2 publisher-side, garantendo correlation completa publisher → subscriber. La doc dichiara "F6 dovrà comunque normalizzare la correlation publisher↔subscriber" — ma questa è la responsabilità di F2 V1: gli step publish-side hanno `eventId` placeholder distinto da quello consumer-side **per lo stesso evento**, rendendo impossibile filtrare gli snapshot di un singolo evento via `eventId` su Inspector V2.

**Impatto:**
- Inspector V1 (no-op) — nessun impatto runtime.
- Inspector V2/F6 — i snapshot publish-side avranno `eventId = 'f2:topic:step'` mentre subscribe-side avranno l'id reale → correlation cross-step richiede heuristic (topic + timestamp) invece di lookup deterministic per eventId.
- Test `weather-scenario.integration.test.ts:116-123` verifica solo che subscribe-side ha id reale; non verifica correlation publisher↔subscriber.

**Fix suggerito:**
```ts
// broker-mapper-wrapper.ts:publish (linea 337)
publish<T>(topic: string, payload: T, options: MapperPublishOptions = {}): void {
  const sourcePluginId = options.source?.id
  let canonicalPayload: unknown = payload
  // WR-01 fix: pre-genera l'eventId per correlation cross-step F2.
  // Pattern: leggi nanoid o genera UUID — coerente con createBrokerEvent F1 (che riusera lo stesso id).
  const eventId = options.eventId ?? generateNanoid()  // shared con inner.publish

  if (sourcePluginId !== undefined && this.mapper.hasCompiled(sourcePluginId)) {
    try {
      this.emitF2Tap('event.source.resolved' as PipelineStep, topic, {
        eventId,  // NEW
        metadata: { pluginId: sourcePluginId },
      })
      // ... resto identico
    }
  }
  this.inner.publish(topic, canonicalPayload, { ...options, eventId })  // pass eventId pre-allocato
}
```

In alternativa, accept current limitation come V1 ma con ADR/JSDoc esplicito + test che documenta il gap.

---

### WR-02: README §Field policy table riporta error code obsoleto `validation.field.missing` [WARNING]

**File:** `packages/mapper/README.md:211`

**Issue:**
La tabella "Field policy (VAL-08)" riga 211 dice:
> `required: true` | usa il valore | throw `BrokerError 'validation.field.missing'` → publish `mapping.error` (D-58) → no delivery

Ma:
- `mapper-engine.ts:575` throws `code: 'mapping.field.missing'` (NON `validation.field.missing`).
- README riga 217 (NEW WR-D iter2 paragraph) cita correttamente `mapping.field.missing`.

Il fix WR-D iter2 ha aggiunto il paragrafo nuovo che usa il code corretto, ma NON ha allineato la tabella precedente. Il developer che legge la tabella scrive un subscriber per `validation.field.missing` e NON intercetta nulla — debug confuso.

**Fix suggerito:**
```markdown
| `required: true` | usa il valore | throw `BrokerError 'mapping.field.missing'` → publish `mapping.error` (D-58) → no delivery |
```

Anche `MappingErrorCode` literal union (`packages/mapper/src/types/mapping-error.ts`) è la source of truth — il README deve riflettere quella enum.

---

### WR-03: AliasRegistry e CanonicalRegistry non hanno prototype-pollution guard sui field name [WARNING]

**File:** `packages/mapper/src/alias-registry.ts:104-114, 134-149` · `packages/mapper/src/canonical-registry.ts:90-126`
**Riferimento storico:** WR-03 (iter1) chiuso solo per `compileRules` + `readPath` di mapper-engine.ts.

**Issue:**
WR-03 iter1 ha aggiunto `RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])` in `mapper-engine.ts` per:
- `compileRules` (line 441-456): rifiuta canonicalField/source riservati.
- `readPath` (line 728-742): ritorna undefined su segmenti riservati.

Tuttavia, `AliasRegistry.registerGlobal/registerScoped` accetta QUALUNQUE stringa come `localField` E `canonicalField`. Esempio:
```ts
broker.registerAlias('safeKey', '__proto__', { scope: 'global' })
// → globalAliases.set('safeKey', '__proto__')
// publish con payload { safeKey: 'evil' } via plugin compilato:
// → applyAliasResolution: result['__proto__'] = 'evil' → POLLUTION
```

Verifica trace:
- `mapper-engine.ts:706`: `result[resolution.canonical] = source[localField]`
- `resolution.canonical` proviene da AliasRegistry e NON è validato contro RESERVED_KEYS.

Stessa lacuna in `CanonicalRegistry.register(schema)` per `schema.id` e `schema.fields` keys: una `id` o un field name `__proto__` viene accettato silenziosamente (`schemas.set('__proto__', schema)` su Map è safe perché Map non eredita da Object.prototype, ma quando il consumer fa `schema.fields['__proto__']` su un POJO può triggare pollution).

**Impatto severity:**
- Vector LOCAL (richiede chiamata API esplicita, non via input utente untrusted come in T-02-07-x). PRD §31 dichiara "input from server/user untrusted; APIs API trusted". Questa è defensive depth, non vuln runtime.
- Comunque WR-03 iter1 ha proteggi a metà — coverage incompleto.

**Fix suggerito:**

`alias-registry.ts:104` (e analogo `:134`):
```ts
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
registerGlobal(localField: string, canonicalField: string): boolean {
  if (RESERVED_KEYS.has(localField) || RESERVED_KEYS.has(canonicalField)) {
    throw new Error(`alias.field.reserved: localField/canonicalField cannot be ${localField}/${canonicalField} (prototype-pollution guard)`)
  }
  // ... resto identico
}
```

`canonical-registry.ts:90`:
```ts
register(schema: CanonicalSchema, options: RegisterOptions = {}): boolean {
  if (RESERVED_KEYS.has(schema.id)) {
    throw createBrokerError({ code: 'canonical.id.reserved', ... })
  }
  for (const fieldName of Object.keys(schema.fields)) {
    if (RESERVED_KEYS.has(fieldName)) {
      throw createBrokerError({ code: 'canonical.field.reserved', ... })
    }
  }
  // ... resto identico
}
```

In alternativa, centralizzare `RESERVED_KEYS` in un file shared (es. `types/reserved-keys.ts`) e usarlo da tutti e 3 i punti.

---

### WR-04: `event.source.resolved` consumer-side (iter2 add) non corrisponde a Step 4 PRD §28 (publisher-only) [WARNING — design]

**File:** `packages/mapper/src/broker-mapper-wrapper.ts:903-911`
**Riferimento iter2:** CR-01-RESIDUAL "simmetria — F6 può differenziare publisher vs consumer via metadata.pluginId"

**Issue:**
Il PRD §28 mappa Step 4 (`event.source.resolved`) come publisher-side step ("alias-resolve / source resolved" — chi pubblica, identificazione del plugin sender). Il fix CR-01-RESIDUAL emette lo STESSO step anche consumer-side ("simmetria — il tap registra il momento in cui il pipeline determina quale plugin sta ricevendo l'evento") — ma il PRD §28 step 11 (`event.mapped.consumer`) e step 12 (`event.final.validated`) sono già la counterpart consumer-side; non c'è un "Step 11.0 source resolved consumer".

Conseguenze:
- Inspector V2/F6: dovrà differenziare publisher-vs-consumer leggendo `metadata.pluginId` E semantically inferendo dal `step` su quale side è (impossibile col solo step name).
- Per ogni evento delivered con N consumer + 1 publisher → si vedono `N+1` snapshot di `event.source.resolved` per lo STESSO topic, con `eventId` diversi (publisher è placeholder, consumer è reale). Conta confusing per metriche.
- Test `weather-scenario.integration.test.ts:107` `expect(...length).toBeGreaterThan(0)` non verifica la cardinalità — non distingue tra "1 publisher only" vs "1 publisher + N consumers".

**Fix suggerito:**

Opzione A — Rimuovere consumer-side emission di `event.source.resolved`:
```ts
// broker-mapper-wrapper.ts:wrapConsumerHandler — RIMUOVERE linee 908-911
private wrapConsumerHandler(pluginId, handler) {
  return (event: BrokerEvent) => {
    try {
      // Step 11: applyInputMap consumer-side (NO event.source.resolved consumer-side)
      const mappedPayload = this.mapper.applyInputMap(pluginId, event.payload)
      // ... resto identico
    }
  }
}
```

Opzione B — Introdurre step distinto F2-only per consumer-side (es. `event.consumer.resolved`) e aggiornare `F2PipelineStep` literal union:
```ts
// index.ts:F2PipelineStep
export type F2PipelineStep =
  | 'event.source.resolved'        // publisher-side step 4
  | 'event.consumer.resolved'      // NEW — consumer-side identification
  | 'event.mapped.canonical'
  | 'event.canonical.validated'
  | 'event.mapped.consumer'
  | 'event.final.validated'
```
Aggiornare doc PRD §28 → 6 step F2 (era 5). Aggiornare CLAUDE.md "EventTap interface deve essere instrumentata già in F2" coverage.

Opzione C — Documentare in JSDoc `wrapConsumerHandler` + README §Pipeline che `event.source.resolved` ha doppia semantica F2 V1 con discriminazione via `metadata.pluginId` + `metadata.role: 'publisher'|'consumer'` (non implementato attualmente — `metadata.pluginId` è disambiguante solo se il consumer ed il publisher hanno pluginId diversi, false in plugin-loop scenarios).

---

## Out of scope

Iter 1 + iter 2 hanno chiuso 22 finding totali. Le seguenti restano fuori scope per `fix_scope: critical_warning`:
- IN-01..IN-05 della review iniziale (info findings, già documentate in `02-REVIEW-FIX.md` iter2 §"Out of scope").
- Performance e bundle-size: out of scope v1 review per policy GSD.

## Verification

| Tier | Check | Result |
|------|-------|--------|
| 1 | Re-read di ogni file iter2-modificato | PASS |
| 2 | `pnpm -F @sembridge/mapper test` | PASS — 172/172 |
| 2 | `pnpm -F @sembridge/core test` | PASS — 248/248 (no D-49 regression) |
| 2 | `pnpm -F @sembridge/mapper exec tsc --noEmit` | PASS — clean |
| 3 | Trace `event.source.resolved` publisher path (broker-mapper-wrapper.ts:341-356) | PASS — emesso PRIMA di applyOutputMap |
| 3 | Trace `event.source.resolved` subscriber path (broker-mapper-wrapper.ts:901-911) | PASS — emesso con `event.id` reale, prima di applyInputMap |
| 3 | Trace alias-only path runtime (registerPlugin → compileMappings → applyOutputMap → applyAliasResolution) | PASS per scoped/global · **EDGE CASE rilevato** per "no maps, no aliases" → BL-01 |
| 3 | Trace error message `~run` in valibot-adapter.ts:128 | PASS |
| 3 | Trace duplicate-id detection in topologicalSortSchemas (broker-mapper-wrapper.ts:754-764) | PASS |
| 3 | Verify `eventId: event.id` propagato a step 11/12 (broker-mapper-wrapper.ts:909, 919, 927) | PASS · **publish-side resta placeholder** → WR-01 |
| 3 | Verify README WR-D paragraph + Test 25h null-handling | PASS · **README table line 211 ancora obsoleta** → WR-02 |
| 3 | Verify recursion guard transitivo test (broker-mapper-wrapper.test.ts:503-564) | PASS — 2 mapping.error per topic diversi |

## Recommendations

1. **BL-01 — addressing prima del Phase 2 close:** scegliere fix Opzione A/B/C e implementare con TDD test esplicito per il caso "plugin with only canonicalSchemaId, no maps, no relevant aliases". Decidere se la breaking change post-iter2 è intentional (Opzione C, accept) o richiede compat fix (Opzione A/B).
2. **WR-02:** allineare README §Field policy table (oneliner). 30 secondi.
3. **WR-03:** aggiungere prototype-pollution guards in AliasRegistry e CanonicalRegistry per coverage completo (~15 righe + 3-4 unit test).
4. **WR-01 + WR-04:** entrambi sono design discussions (impact su F6) — possono essere documentate come ADR/known-limitation in attesa di Phase 6 (Inspector reale) invece di essere fixed ora. Decisione di scope.

---

_Reviewed: 2026-04-29T16:30:00Z_
_Reviewer: Claude (gsd-code-reviewer, opus-4-7-1)_
_Depth: standard · iteration 3 (post-iter2 fix)_
