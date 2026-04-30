---
phase: 02-canonical-model-mapper
fixed_at: 2026-04-29T17:10:00Z
review_path: .planning/phases/02-canonical-model-mapper/02-REVIEW.md
iteration: 3
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
cumulative_tally:
  iter_1_fixed: 15
  iter_2_fixed: 7
  iter_3_fixed: 5
  total_fixed: 27
---

# Phase 2: Code Review Fix Report (Iteration 3)

**Fixed at:** 2026-04-29T17:10:00Z
**Source review:** `.planning/phases/02-canonical-model-mapper/02-REVIEW.md` (post-iter2 re-review, status: issues_found)
**Iteration:** 3 (ultimo cap auto-loop)

**Summary:**
- Findings in scope: 5 (1 BLOCKER regression + 4 WARNING — Info findings out of scope)
- Fixed: 5
- Skipped: 0
- Status: `all_fixed`

**Cumulative tally (iter 1 + iter 2 + iter 3):**
- iter 1: 15 finding fixed (6 BLOCKER + 9 WARNING)
- iter 2: 7 finding fixed (2 BLOCKER residui + 5 WARNING residui)
- iter 3: 5 finding fixed (1 BLOCKER regression + 4 WARNING)
- **Total: 27 finding closed**

**Test baseline / final:**
- mapper: 172/172 → **183/183** (+11 nuovi TDD test in iter 3; 0 regression)
- core: 248/248 → 248/248 (no regression — vincolo D-49 rispettato)
- TypeScript `tsc --noEmit`: clean su entrambi i package

**Vincoli rispettati:**
- D-49: nessuna modifica a `packages/core/src/core/bus.ts`
- TDD: ogni behavior change preceduto da test (RED → GREEN)
- Lingua italiano in commit messages (codice/identifiers in inglese)
- REVIEW-FIX.md NON committato (orchestrator gestisce)

## Fixed Issues

### BL-01: Regression — plugin con SOLO `canonicalSchemaId` (senza maps né aliases) droppava il payload [BLOCKER]

**Files modified:**
- `packages/mapper/src/broker-mapper-wrapper.ts` (publish: percorso canonical-only + eventId pre-allocato)
- `packages/mapper/src/mapper-engine.ts` (nuovo metodo `isCanonicalOnly(pluginId)`)
- `packages/mapper/src/__integration__/alias-ambiguity.test.ts` (3 nuovi test BL-01 scenario A/B/C)
- `packages/mapper/package.json` + `pnpm-lock.yaml` (dep `nanoid` per WR-01 — vedi sotto)

**Commit:** `3981fe5` (combinato con WR-01 + WR-04 — stesso file core e fix coesivi)

**Applied fix:**
- Aggiunto in `MapperEngine` il metodo `isCanonicalOnly(pluginId)` che ritorna `true` iff il plugin ha `canonicalSchemaId !== undefined` ma `outputCompiled.length === 0 && inputCompiled.length === 0` — identifica i plugin "puramente documentali".
- In `MapperBroker.publish`: se il plugin è `isCanonicalOnly` AND non ha alias scoped registrati AND la global alias registry è vuota → **skippa `applyOutputMap`** (preserva il payload originale) ma esegue comunque step 6 (canonical-validate) sul payload originale e step 12 (final-validate, gestito subscribe-side).
- Coerenza: l'evento `event.source.resolved` resta emesso (publisher-side) anche per il percorso canonical-only.
- Rationale: il fix CR-02-RESIDUAL iter2 aveva esteso `compileMappings` a tutti i plugin con `canonicalSchemaId` per abilitare alias resolution; per il caso "puramente documentale" (no maps, no alias), `applyOutputMap` ritornava `{}` e droppava il payload. Iter3 fix preserva back-compat F1 partial mapping policy (T-02-07-06).

**TDD:** 3 nuovi test in `__integration__/alias-ambiguity.test.ts`:
- **Scenario A** (`BL-01 scenario A: plugin with ONLY canonicalSchemaId (no maps, no aliases) preserves original payload (passthrough)`) — caso primario regression: pre-fix payload era `{}`, post-fix è `{foo: 'bar'}`.
- **Scenario B** (`BL-01 scenario B: plugin with ONLY scoped alias (no canonicalSchemaId, no maps) — back-compat NO compile`) — verifica che plugin senza canonicalSchemaId/maps NON viene compilato (no regression iter2).
- **Scenario C** (`BL-01 scenario C: plugin with canonicalSchemaId + scoped alias (no maps) → alias resolution applied (iter2 behavior preserved)`) — verifica che il fix BL-01 NON regredisce iter2: plugin con alias rilevanti DEVE applicare alias resolution.

---

### WR-01: WR-C iter2 — pubblicazione asimmetrica del placeholder `eventId` su `event.source.resolved` publish-side [WARNING]

**Files modified:**
- `packages/mapper/src/broker-mapper-wrapper.ts` (publish: pre-genera eventId via nanoid + propaga ai 5 step F2 + pass via inner.publish options.id)
- `packages/mapper/src/__integration__/weather-scenario.integration.test.ts` (verify cross-step eventId consistency)
- `packages/mapper/package.json` (aggiunge `nanoid: 5.1.9` come dep diretta)

**Commit:** `3981fe5` (combinato con BL-01 — modifiche coese su `MapperBroker.publish`)

**Applied fix:**
- `MapperBroker.publish` ora pre-alloca `preAllocatedEventId = options.id ?? nanoid()` a inizio metodo.
- Tutti gli step F2 publish-side (4 / 5 / 6) propagano `eventId: preAllocatedEventId` invece del placeholder `f2:${topic}:${step}`.
- `inner.publish(topic, canonicalPayload, { ...options, id: preAllocatedEventId })` — `createBrokerEvent` di F1 (event-factory.ts:63) riusa `params.id ?? nanoid()`, quindi il `BrokerEvent.id` finale è uguale al `preAllocatedEventId`.
- Subscribe-side (step 11/12) leggono `event.id` da `BrokerEvent` (già coerente con WR-C iter2) → tutti e 5 gli step F2 condividono lo stesso eventId.
- JSDoc su `makeF2Snapshot` aggiornata con sezione "WR-01 iter3" che documenta il pattern.
- Aggiunto `nanoid: 5.1.9` come dep diretta del pacchetto mapper (era transitiva via `@sembridge/core`).

**TDD:** Esteso `weather-scenario.integration.test.ts` con verifica cross-step:
- I 5 step F2 condividono lo stesso eventId reale (NOT `^f2:`).
- `publisherSourceResolved.eventId === mappedCanonicalSnap.eventId === canonicalValidatedSnap.eventId === consumerSnap.eventId === finalSnap.eventId`.

Inspector V2/F6 può ora correlare snapshot cross-step deterministicamente — NO heuristic topic+timestamp.

---

### WR-02: README §Field policy table riportava error code obsoleto `validation.field.missing` [WARNING]

**Files modified:** `packages/mapper/README.md`

**Commit:** `91ddf9a`

**Applied fix:**
- Tabella §Field policy (riga 211) aggiornata da `BrokerError 'validation.field.missing'` a `BrokerError 'mapping.field.missing'` — coerente con `MappingErrorCode` literal union (source of truth) e con `mapper-engine.ts:575` che effettivamente throw `mapping.field.missing`.
- Il paragrafo WR-D iter2 (riga 217) era già corretto; ora la tabella precedente è allineata.

Developer che legge la tabella ora trova il code corretto al primo colpo — niente più subscriber su `validation.field.missing` (silently inerte).

---

### WR-03: AliasRegistry e CanonicalRegistry non hanno prototype-pollution guard sui field name [WARNING]

**Files modified:**
- `packages/mapper/src/alias-registry.ts` (+ helper `assertNotReserved`)
- `packages/mapper/src/canonical-registry.ts` (+ guard in `register`)
- `packages/mapper/src/alias-registry.test.ts` (+5 test)
- `packages/mapper/src/canonical-registry.test.ts` (+3 test)

**Commit:** `467a388`

**Applied fix:**
- **AliasRegistry**: introdotto `RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])` (coerente con `mapper-engine.ts:110`). Helper `assertNotReserved(localField, canonicalField)` invocato da:
  - `registerGlobal` — throw `Error 'alias.field.reserved'` se l'uno o l'altro è riservato.
  - `registerScoped` — idem.
  - `resolve` — throw `Error 'alias.field.reserved'` se `localField` è riservato (defense in depth: anche se register è bloccato, `resolve` è surface pubblica chiamabile direttamente).
- **CanonicalRegistry**: aggiunto check su `schema.id` (throw `BrokerError 'canonical.id.reserved'`, category `config`) e su ogni `Object.keys(schema.fields)` (throw `BrokerError 'canonical.field.reserved'`, category `config`).
- Coerenza cross-modulo: i 3 RESERVED_KEYS set sono identici (mapper-engine + alias-registry + canonical-registry).

WR-03 iter1 aveva aggiunto guard solo in mapper-engine.ts (`compileRules` + `readPath`). Iter3 chiude la coverage: ora un caller third-party che invoca direttamente i registry con un nome riservato è bloccato deterministicamente — defense in depth completa.

**TDD:** 8 nuovi test:
- 5 in `alias-registry.test.ts`: registerGlobal/Scoped/resolve con `__proto__`/`constructor`/`prototype` come localField o canonicalField.
- 3 in `canonical-registry.test.ts`: register con `schema.id === '__proto__'` / `schema.fields.constructor` / `schema.fields.prototype`.

---

### WR-04: `event.source.resolved` consumer-side non corrisponde a Step 4 PRD §28 (publisher-only) [WARNING — design]

**Files modified:** `packages/mapper/src/broker-mapper-wrapper.ts` (JSDoc only)

**Commit:** `3981fe5` (combinato con BL-01 + WR-01 — stesso file)

**Applied fix:**
JSDoc esplicito su due punti:
1. **Field-level JSDoc su `tap`** (riga ~227): aggiunta sezione "WR-04 iter3 — Doppia semantica V1" che documenta la scelta implementativa — il PRD §28 step 4 è publisher-only, ma la V1 emette il medesimo step anche consumer-side per simmetria.
2. **Method-level JSDoc su `wrapConsumerHandler`**: aggiunta sezione "WR-04 iter3 — Doppia semantica `event.source.resolved` (V1 documentary)" che spiega:
   - Per ogni delivery con N consumer + 1 publisher → `1+N` snapshot di `event.source.resolved` per lo stesso topic.
   - F6/V2 dovrà discriminare via `metadata.pluginId`: il publisher è in `options.source.id`, il consumer è in `subscribeOptions.ownerId`.
   - Refactor F6 alternativo: introdurre uno step F2-only `event.consumer.resolved` o un marker `metadata.role: 'publisher' | 'consumer'`.

NO behavior change (solo documentazione): la scelta è intentional V1, mantenuta per back-compat con il fix CR-01-RESIDUAL iter2.

## Skipped Issues

Nessuna finding skipped. Tutte le 5 finding in scope (1 BLOCKER + 4 WARNING) sono state applicate con successo.

## Out of scope (Info findings)

Le 5 finding `IN-*` (info) della review iniziale + qualsiasi nuova finding info emersa nelle review iterative restano fuori scope per `fix_scope: critical_warning`:
- IN-01: README typo ("4 classi" → "5 classi")
- IN-02: Naming inconsistency cascade methods
- IN-03: Test "documentary" senza assertion
- IN-04: `ImportMetaEnv` cast in core
- IN-05: Magic numbers + RESERVED keys non centralizzati

> **Nota su IN-05:** la centralizzazione di `RESERVED_KEYS` in un file shared (es. `types/reserved-keys.ts`) resta out-of-scope. Iter3 ha replicato il `Set` in tre punti (mapper-engine + alias-registry + canonical-registry) — i set sono identici e cambiamenti futuri richiederanno aggiornamento sincronizzato dei tre.

## Verification (post-iter3)

| Tier | Check | Result |
|------|-------|--------|
| 1 | Re-read di ogni file modificato post-edit | PASS — no corruption |
| 2 | `pnpm -F @sembridge/mapper exec tsc --noEmit` | PASS — clean (no errors) |
| 2 | `pnpm -F @sembridge/mapper test` | PASS — **183/183** |
| 2 | `pnpm -F @sembridge/core test` (D-49 regression) | PASS — 248/248 |
| 3 | Trace canonical-only path (BL-01) — plugin solo `canonicalSchemaId` preserva payload | PASS — Test scenario A verifica `received[0] === { foo: 'bar' }` |
| 3 | Trace eventId pre-allocato → propagato ai 5 step F2 (WR-01) | PASS — weather-scenario verify `5 × snap.eventId === consumerSnap.eventId` |
| 3 | README riga 211 ora `mapping.field.missing` (WR-02) | PASS |
| 3 | AliasRegistry / CanonicalRegistry refusano `__proto__`/`constructor`/`prototype` (WR-03) | PASS — 8 unit test verificano |
| 3 | JSDoc consumer-side `event.source.resolved` documenta doppia semantica V1 (WR-04) | PASS |

## Iter 3 commits (3 atomic commits, 5 finding)

```
3981fe5 fix(02-NN-BL-01+WR-01+WR-04-iter3): canonical-only path, eventId reale publish-side, JSDoc consumer-side
91ddf9a fix(02-NN-WR-02-iter3): allinea README §Field policy table a mapping.field.missing
467a388 fix(02-NN-WR-03-iter3): prototype-pollution guard in AliasRegistry e CanonicalRegistry
```

**Note sul commit `3981fe5` combinato (3 finding in 1 commit):**
- BL-01 (canonical-only path) e WR-01 (eventId pre-allocato) toccano entrambi `MapperBroker.publish` con modifiche coese: la pre-allocazione di `preAllocatedEventId` è all'inizio del metodo e va prima del check `isCanonicalOnly`; entrambi influenzano il flusso publish. Splittarli avrebbe richiesto 2 commit con overlap di linee.
- WR-04 (JSDoc consumer-side) è puramente documentale e tocca lo stesso file (`broker-mapper-wrapper.ts`) — incluso per chiusura completa del finding "design" senza commit aggiuntivo banale.
- Test files inclusi: `alias-ambiguity.test.ts` (BL-01) + `weather-scenario.integration.test.ts` (WR-01).
- `package.json` + `pnpm-lock.yaml` per `nanoid` dep diretta richiesta da WR-01.

---

_Fixed: 2026-04-29T17:10:00Z_
_Fixer: Claude (gsd-code-fixer, opus-4-7-1)_
_Iteration: 3_
