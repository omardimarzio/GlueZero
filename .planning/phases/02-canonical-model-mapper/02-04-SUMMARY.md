---
phase: 02-canonical-model-mapper
plan: 04
subsystem: alias-registry
tags: [alias-registry, tdd, parallel-wave-3, resolution-order, scope-isolation, close-prd-39-1]

# Dependency graph
requires:
  - phase: 02-canonical-model-mapper
    plan: 02
    provides: "CanonicalSchemaId branded type da packages/mapper/src/types/canonical-schema.ts (re-exportato per convenienza dei consumer interni del mapper-engine)"
provides:
  - "packages/mapper/src/alias-registry.ts (240 LOC) — class AliasRegistry con registerGlobal/registerScoped/resolve/unregisterScopedAll/listGlobal/listScoped"
  - "packages/mapper/src/alias-registry.test.ts (173 LOC, 16 test) — TDD RED→GREEN coverage completo dei 12 behavior + 4 sub-test"
  - "Resolution order D-40 implementato (livelli 2-4: scoped > global > name-match)"
  - "Ambiguity flag D-41 implementato (true solo per alias automatici, false per name-match)"
  - "Scope isolation T-02-04-02 (Map<pluginId, Map<...>> separa gli scope)"
  - "Conflict detection T-02-04-03 (alias.{global,scoped}.conflict throw su pair conflittuale)"
  - "D-26 ext F2 cascade abilitato via unregisterScopedAll(pluginId) — wiring al broker wrapper in plan 02-10"
  - "Closure PRD §39 open issue #1 (precedenza alias automatici vs mapping esplicito) — MAP-17"
affects: [02-07-mapper-engine, 02-08-broker-wrapper, 02-09-augment, 02-10-integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern F1 TopicRegistry replicato come role-match (idempotent register, list() copia ordinata) + estensione due livelli di scope (globalAliases vs pluginScopedAliases)"
    - "Map<pluginId, Map<localField, canonicalField>> per scope isolation tra plugin (T-02-04-02 mitigation)"
    - "Conflict throw su pair conflittuale + idempotent return false su pair identico (anti-shadow PITFALLS §3.B)"
    - "Resolution order esplicito documentato in JSDoc + return type discriminator `source: 'scoped'|'global'|'name-match'|'unresolved'` per debug (T-02-04-04 mitigation)"
    - "list*() ritorna spread copy + sort deterministico (`[...map.entries()].sort(([a], [b]) => a.localeCompare(b))`) per T-02-04-01 mitigation"
    - "Module auto-contenuto: niente import da @gluezero/core. Errori sono Error nativi (alias.global.conflict / alias.scoped.conflict / alias.localField.empty), wrapping in BrokerError delegato al consumer mapper-engine"
    - "TDD RED→GREEN gate verificato in git history (2 commit separati: 018b867 test prima, e1517ee feat dopo)"

key-files:
  created:
    - "packages/mapper/src/alias-registry.ts (240 LOC) — class AliasRegistry + AliasResolution interface + AliasResolutionSource union"
    - "packages/mapper/src/alias-registry.test.ts (173 LOC) — 16 test cases coprendo i 12 behavior PLAN <task>"
  modified: []

key-decisions:
  - "Nessuna deviazione da PATTERNS.md §2.2 (alias-registry come role-match di topic-registry F1) e §5.1 (anti-pattern alias globali shadow risolto via Map<pluginId, Map>)"
  - "Errori `alias.{global,scoped}.conflict` e `alias.localField.empty` sono Error nativi (NON BrokerError) — coerente con error handling auto-contenuto del module. Documentato come decisione consapevole nel PLAN <output>: il consumer mapper-engine wrappa eventualmente in BrokerError quando intercetta. Mantiene il registry agnostico da @gluezero/core."
  - "Test 'truly unresolved' verifica il contract registry: il source 'unresolved' non è prodotto da AliasRegistry direttamente — è riservato al mapper-engine quando consulta CanonicalRegistry (livello 5 D-40). Il default qui è 'name-match' con localField come canonical."
  - "16 test cases invece dei 12 behavior PLAN — la differenza è dovuta a sub-test dei 4 describe block (registerGlobal/registerScoped/resolve/list ciascuno ha 2-7 test it()). Nessuna deviazione concettuale: tutti i 12 behavior sono coperti."
  - "Niente runtime deepFreeze sugli alias post-register — coerente con T-02-03-03 disposition di plan 02-03 (deepFreeze dev mode deferred al mapper-engine plan 02-07)"
  - "Re-export CanonicalSchemaId dal module per convenienza dei consumer interni del mapper-engine (plan 02-07) — riduce import boilerplate quando il mapper compila i mapping con type confusion prevention."

patterns-established:
  - "Pattern registry due-livelli (global + plugin-scoped) con resolution order esplicito: applicabile a future estensioni (route alias F3, worker alias F5) — il discriminator literal union 'source' è il pattern di debug riusabile."
  - "Pattern conflict-vs-idempotent: `existing === value ? return false : throw conflict` — applicabile a TransformPipeline.register (plan 02-05) e a tutti i registry F2+ con replace policy strict."
  - "Pattern unregister*All(ownerId) cascade per cleanup proprietario: applicabile in modo identico a TransformPipeline (plan 02-05) e ad altre estensioni LIFE-02 di future fasi."
  - "Pattern test 'sub-test sotto describe block' che mantiene 1:1 il behavior PLAN ma granularizza per readability/diagnosi: 16 test it() sotto 4 describe corrispondono ai 12 behavior dichiarativi del PLAN."

requirements-completed: []
requirements-runtime-level:
  - MAP-16
  - MAP-17

# Metrics
duration: ~9min
completed: 2026-04-29
---

# Phase 2 Plan 04: AliasRegistry Summary

**Implementato `AliasRegistry` (240 LOC) + test co-locato (173 LOC, 16 test) con pattern TDD RED→GREEN: 2 commit separati, 16/16 test passing al primo run dopo GREEN. Resolution order D-40 implementato (livelli 2-4: scoped > global > name-match) con ambiguity flag D-41 (true solo per alias automatici). Chiude PRD §39 open issue #1 (precedenza alias automatici vs mapping esplicito) tramite contract documentato: il mapper-engine plan 02-07 valuta il livello 1 (esplicito) PRIMA di chiamare `resolve`, quindi l'esplicito vince sempre per costruzione. Pronto per consumption da MapperEngine (plan 02-07).**

## Performance

- **Duration:** ~9 min (start 14:41:36Z; commit GREEN 14:48:??Z; SUMMARY 14:50Z)
- **Started:** 2026-04-29T14:41:36Z
- **Completed:** 2026-04-29T14:50:43Z
- **Tasks:** 1/1 completed (TDD RED + GREEN come 2 commit atomici dello stesso task)
- **Files created:** 2 nuovi (413 LOC totali: 240 src + 173 test)
- **Files modified:** 0

## Accomplishments

- `class AliasRegistry` con 6 metodi pubblici: `registerGlobal`, `registerScoped`, `resolve`, `unregisterScopedAll`, `listGlobal`, `listScoped`
- 2 type pubblici co-esportati: `AliasResolution` (interface readonly), `AliasResolutionSource` (literal union 4 source: scoped/global/name-match/unresolved)
- D-40 resolution order: scoped (livello 2) > global (livello 3) > name-match (livello 4); livello 1 esplicito gestito dal mapper-engine plan 02-07; livello 5 unresolved emerge nel mapper-engine via CanonicalRegistry check
- D-41 ambiguity flag: `ambiguous: true` solo per alias automatici (scoped/global) per innescare `mapping.warn` lato mapper-engine; `false` per name-match diretto
- T-02-04-02 scope isolation via `Map<pluginId, Map<localField, canonicalField>>`: plugin-a scoped alias NOT visibile a plugin-b
- T-02-04-03 conflict detection: `registerGlobal`/`registerScoped` throw `alias.{global,scoped}.conflict` su pair conflittuale; idempotent su pair identico (anti-shadow PITFALLS §3.B)
- D-26 ext F2 cascade abilitato via `unregisterScopedAll(pluginId)` ritornante count rimossi — wired al broker wrapper in plan 02-10
- T-02-04-01 list mutation safety: `listGlobal`/`listScoped` ritornano spread copy ordinata deterministicamente per `localeCompare`
- T-02-04-04 source discriminator literal union: `AliasResolutionSource` espone esattamente quale livello D-40 ha risolto, per debug Inspector F6
- Validation guard: `resolve` con `localField === ''` → throw `Error 'alias.localField.empty'`
- Module auto-contenuto: niente import da `@gluezero/core` runtime; solo `import type { CanonicalSchemaId }` da `./types/canonical-schema`
- Header italiano + JSDoc IntelliSense in italiano + reference D-XX/REQ-ID/Threat-ID coerente con pattern F1
- Auto-fix manuale `Array<T>` → `T[]` per Biome `useShorthandArrayType` (formattazione, non altera semantica)

## Task Commits

Il PLAN dichiara 1 task con `tdd="true"`. Il task è stato eseguito come 2 commit atomici (RED gate + GREEN gate) coerenti con il pattern TDD F1:

1. **Task 1 RED — `018b867`** `test(02-04): aggiunge test RED per AliasRegistry`
   - `alias-registry.test.ts` (173 LOC, 16 test)
   - Test importa `./alias-registry` che non esiste → FAIL atteso (RED gate verificato: `Failed to resolve import "./alias-registry"`)
2. **Task 1 GREEN — `e1517ee`** `feat(02-04): implementa AliasRegistry (REQ MAP-16, MAP-17 — chiude PRD §39 #1)`
   - `alias-registry.ts` (240 LOC) — implementazione completa
   - Test passing 16/16 al primo run dopo creazione del modulo (`Test Files 1 passed (1) | Tests 16 passed (16)`)
   - Auto-fix manuale Biome `Array<T>` → `T[]` applicato pre-commit (cambia signature da `Array<[string, string]>` a `[string, string][]`, semantica identica)

**Plan metadata commit:** TBD (eseguito alla fine del workflow tramite `gsd-sdk query commit` insieme a STATE/ROADMAP/REQUIREMENTS).

## Files Created

### packages/mapper/src/alias-registry.ts (240 LOC)

Esporta:

- `AliasResolutionSource` literal union — `'scoped' | 'global' | 'name-match' | 'unresolved'` (D-40, D-41)
- `AliasResolution` interface readonly — `{ canonical: string; ambiguous: boolean; source: AliasResolutionSource }`
- `class AliasRegistry` con private state:
  - `private readonly globalAliases = new Map<string, string>()` — alias globali visibili a tutti i plugin
  - `private readonly pluginScopedAliases = new Map<string, Map<string, string>>()` — alias plugin-scoped (T-02-04-02 isolation)
- 6 metodi pubblici:
  - `registerGlobal(localField, canonicalField): boolean` — registra alias globale; throw `alias.global.conflict` se conflict
  - `registerScoped(pluginId, localField, canonicalField): boolean` — registra alias scoped; throw `alias.scoped.conflict` se conflict; scope isolation tra plugin
  - `resolve(pluginId, localField): AliasResolution` — risolve secondo D-40 livelli 2-4; throw `alias.localField.empty` se localField vuoto
  - `unregisterScopedAll(pluginId): number` — cascade D-26 ext F2; ritorna count rimossi
  - `listGlobal(): [string, string][]` — copia ordinata alfabeticamente per localField
  - `listScoped(pluginId): [string, string][]` — copia ordinata per plugin scope (vuoto se plugin non registrato)
- Re-export `CanonicalSchemaId` per convenienza dei consumer interni mapper-engine

### packages/mapper/src/alias-registry.test.ts (173 LOC, 16 test)

Test cases organizzati in 4 `describe` block:

| # | Describe | It | Behavior coperto | Decisione/Threat |
|---|----------|-----|------------------|------------------|
| 1 | registerGlobal | returns true on new, false on duplicate (idempotent) | Test 1 PLAN | Pattern F1 |
| 2 | registerGlobal | throws on conflict (same localField → different canonical) | Test 2 PLAN | T-02-04-03 |
| 3 | registerScoped | registers scoped alias for one plugin only | Test 3 PLAN | Pattern F1 |
| 4 | registerScoped | throws on conflict within same plugin scope | Test 3 PLAN ext | T-02-04-03 |
| 5 | registerScoped | different plugins can register conflicting scoped aliases | Test 7 PLAN ext | T-02-04-02 isolation |
| 6 | resolve | scoped alias resolution → ambiguous: true, source: scoped | Test 4 PLAN | D-40 livello 2, D-41 |
| 7 | resolve | global alias resolution → ambiguous: true, source: global | Test 5 PLAN | D-40 livello 3, D-41 |
| 8 | resolve | scoped wins over global (D-40 priority) | Test 6 PLAN | D-40 priority |
| 9 | resolve | plugin-b does NOT see scoped alias of plugin-a (isolation) | Test 7 PLAN | T-02-04-02 |
| 10 | resolve | name match (no alias) → ambiguous: false, source: name-match | Test 8 PLAN | D-40 livello 4, D-41 |
| 11 | resolve | truly unresolved → name-match default (mapper-engine resolves to unresolved) | Test 9 PLAN | D-40 livello 5 contract |
| 12 | resolve | throws on empty localField | Test 12 PLAN | validation guard |
| 13 | unregisterScopedAll | removes all scoped for plugin; global + other intact | Test 10 PLAN | D-26 ext F2 |
| 14 | unregisterScopedAll | returns 0 if plugin had no scoped aliases | Test 10 PLAN ext | D-26 ext F2 edge |
| 15 | list | listGlobal returns sorted entries | Test 11 PLAN | T-02-04-01 |
| 16 | list | listScoped(pluginId) returns sorted entries for that plugin only | Test 11 PLAN | T-02-04-01 + isolation |

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm --filter @gluezero/mapper test alias-registry` (RED, post Task 1.1) | FAIL atteso: `Failed to resolve import "./alias-registry"` |
| `pnpm --filter @gluezero/mapper test alias-registry` (GREEN, post Task 1.2) | Exit 0: **`Test Files 1 passed (1) \| Tests 16 passed (16)`** Duration 469ms |
| `pnpm --filter @gluezero/mapper test` (full mapper) | Exit 0: **`Test Files 2 passed (2) \| Tests 27 passed (27)`** (16 alias-registry + 11 canonical-registry) |
| `pnpm --filter @gluezero/mapper typecheck` | Exit 0 (isolatedDeclarations enforcement OK) |
| `pnpm --filter @gluezero/core test` (regression F1) | Exit 0: **24 file/248 test passing** (no regression) |
| `pnpm biome check packages/mapper/src/alias-registry*.ts` | Exit 0 dopo fix manuale `Array<T>` → `T[]` (suggested unsafe fix di Biome applicato manualmente, formattazione equivalente) |
| Grep verifica acceptance | 8/8 PASSED (`export class AliasRegistry`, `registerGlobal`, `registerScoped`, `unregisterScopedAll`, `ambiguous`, `source: 'scoped'`, file source + file test esistenti) |
| Audit `any` literal | 0 occorrenze come tipo |
| Audit `unknown` non documentato | 0 occorrenze (nessun `unknown` nel module — il dato è solo string→string) |
| Audit import `@gluezero/core` runtime | 0 (module auto-contenuto come da PLAN must_haves) |
| Post-commit deletion check | OK: no deletions tra HEAD~1 e HEAD |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-04-01 (Tampering — listGlobal/listScoped mutation esterna) | mitigate | Spread copy + sort: `[...this.globalAliases.entries()].sort(([a], [b]) => a.localeCompare(b))` (riga 213). Test 15-16 verificano ordinamento determinante e integrità. |
| T-02-04-02 (Information disclosure — Plugin B vede alias scoped di Plugin A) | mitigate | `pluginScopedAliases: Map<pluginId, Map<localField, canonicalField>>` separa gli scope (riga 87). `resolve` legge SOLO `pluginScopedAliases.get(pluginId)` (riga 174-179). **Test 9** ("plugin-b does NOT see scoped alias of plugin-a") verifica direttamente. |
| T-02-04-03 (Tampering — silent overwrite di alias conflittuale) | mitigate | `registerGlobal`/`registerScoped` throw `alias.{global,scoped}.conflict` su pair conflittuale; idempotent su pair identico (riga 99-107, 132-141). **Test 2 + Test 4** verificano. |
| T-02-04-04 (Repudiation — resolve non riporta source → debug difficile) | mitigate | `AliasResolution.source` literal union espone esattamente quale livello D-40 ha risolto (riga 50). **Test 6-11** verificano per ogni source value. |
| T-02-04-05 (Spoofing — plugin malevolo registra alias globale per shadow di mapping critico) | mitigate | `registerGlobal` sarà esposto solo via `Broker.registerAlias` (plan 02-10) con auth applicativo del consumer; conflict throw previene shadow accidentale (T-02-04-03). Plugin-scoped è sempre la priorità per il plugin proprio (D-40 livello 2 > 3). Mitigation completa al wiring plan 02-10. |

## Deviations from Plan

**None — il plan è stato eseguito esattamente come scritto.** Tutti i 12 behavior listati nel PLAN `<task><behavior>` sono coperti dai 16 test cases (alcuni behavior hanno più test it() per granularizzare diagnosi). L'implementazione segue lo snippet di codice del PLAN con identica shape (Map global, Map<pluginId, Map> scoped, conditional throw su conflict, spread copy su list).

**Note tecniche minori (non deviazioni):**

1. **16 test cases vs 12 behavior PLAN** — la differenza è strutturale: ogni `describe` block raggruppa 2-7 `it()` che insieme coprono 1-3 behavior PLAN. Esempio: PLAN Test 3 ("registerScoped registra alias scoped; idempotent") è coperto da `it('registers scoped alias for one plugin only')` + `it('throws on conflict within same plugin scope')` + `it('different plugins can register conflicting scoped aliases')` perché il conflict throw e l'isolation tra plugin sono behavior correlati ma indipendenti.
2. **Test 9 PLAN "truly unresolved"** — il PLAN dichiara `source: 'unresolved'` come valore di ritorno; il `<interfaces>` del PLAN chiarisce che il source `'unresolved'` è riservato al mapper-engine quando consulta CanonicalRegistry (livello 5 D-40). Quindi il registry da solo NON produce mai `source: 'unresolved'` — il default è `'name-match'` con `localField` come canonical. Il test verifica esattamente questo contract (`expect(result.source).toBe('name-match')`). Coerente con il PLAN behavior commentato: "the 'unresolved' source is not produced by this registry alone".
3. **Errori `Error` nativi anziché BrokerError** — `alias.global.conflict`, `alias.scoped.conflict`, `alias.localField.empty` sono Error nativi, NON BrokerError. Documentato esplicitamente nel PLAN `<output>` come decisione consapevole: "conflict error con `alias.global.conflict`/`alias.scoped.conflict` come Error nativo (non BrokerError) — coerente con error handling auto-contenuto del module (delegato al mapper-engine consumer per wrapping eventuale)". Mantiene il registry agnostico da `@gluezero/core`.
4. **Auto-fix Biome manuale** — Biome ha segnalato 2 errori `useShorthandArrayType` (`Array<T>` → `T[]`). Biome ha classificato il fix come "unsafe" (richiede `--unsafe` flag), quindi l'ho applicato manualmente con `Edit`. Cambio cosmetico: signature da `Array<[string, string]>` a `[string, string][]`, semantica identica. Re-run test e typecheck post-fix: 27/27 passing.
5. **Re-export `CanonicalSchemaId` dal module** — al fondo di `alias-registry.ts` (riga 240): `export type { CanonicalSchemaId }`. Lo snippet del PLAN lo include nell'`<action>` (riga 417). Convenience re-export per i consumer interni del mapper-engine plan 02-07 quando dovranno coordinare alias resolution con CanonicalRegistry (Pitfall #12 — type confusion prevention). Niente nuovo tipo introdotto, solo passthrough.

## TDD Gate Compliance

Plan `type: execute` con un task `tdd="true"`. Gate sequence verificata in `git log --oneline`:

- ✅ **RED gate** (`018b867`): commit `test(02-04): aggiunge test RED per AliasRegistry`
- ✅ **GREEN gate** (`e1517ee`): commit `feat(02-04): implementa AliasRegistry (REQ MAP-16, MAP-17 — chiude PRD §39 #1)` dopo RED

**RED fail-fast confirmed:** test ha fallito al run con messaggio `Failed to resolve import "./alias-registry"` PRIMA della creazione del modulo. Nessun test è passato accidentalmente in fase RED.

**GREEN single-iteration:** 16/16 test passati al primo run dopo la creazione del modulo. Nessuna iterazione di debug richiesta. L'unico cambio post-implementazione è il fix manuale Biome `Array<T>` → `T[]` (formattazione, non logica).

REFACTOR gate non necessario: l'implementazione del PLAN era già completa e idiomatica; il fix Biome è cosmetico, non refactor logico.

## Auth Gates

Nessun auth gate — task interamente automatico (file creation + typecheck/test/biome local).

## Open Items / Pronto-per

- ✅ **Closed:** PRD §39 open issue **#1** (precedenza alias automatici vs mapping esplicito) — chiusa per costruzione: il mapper-engine plan 02-07 valuta il livello 1 (esplicito `inputMap`/`outputMap`) PRIMA di chiamare `AliasRegistry.resolve`, quindi l'esplicito vince sempre. Il registry stesso non vede l'esplicito; documentato in JSDoc del metodo `resolve` (riga 159-167).
- ✅ **Closed:** D-40 resolution order (livelli 2-4: scoped > global > name-match) — runtime al `resolve`.
- ✅ **Closed:** D-41 ambiguity flag (true solo per alias automatici, false per name-match) — runtime in `AliasResolution.ambiguous`.
- ✅ **Closed:** D-26 ext F2 cascade plugin unregister — abilitato via `unregisterScopedAll(pluginId)`. Wiring al broker wrapper in plan 02-10.
- ✅ **Ready:** plan 02-07 (`MapperEngine`) può consumare `aliasRegistry.resolve(pluginId, localField)` per scoprire il canonical name di un field non dichiarato esplicitamente.
- ✅ **Ready:** plan 02-10 (broker wrapper) può chiamare `aliasRegistry.unregisterScopedAll(pluginId)` durante cascade plugin unregister.
- ⏳ **Pending:** Wave 3 paralleli plan 02-05/06 con file ownership disgiunta confermata (questo plan tocca SOLO `alias-registry.ts`/`alias-registry.test.ts`, nessun overlap con `transform-pipeline.ts` plan 02-05 e `valibot-adapter.ts` plan 02-06).
- ⏳ **Pending:** Coverage v8 misurazione del modulo deferred a plan 02-12 (final gate F2 — D-55).

## Self-Check: PASSED

File creati (verifica esistenza):
- packages/mapper/src/alias-registry.ts: FOUND (240 LOC)
- packages/mapper/src/alias-registry.test.ts: FOUND (173 LOC)

Commit hash (verifica esistenza in git log):
- 018b867 (Task 1 RED — test alias-registry): FOUND
- e1517ee (Task 1 GREEN — feat alias-registry): FOUND

REQ-IDs avanzati al runtime-level:
- **MAP-16** runtime (warning runtime alias ambiguo via `AliasResolution.ambiguous: true` + source `'scoped'|'global'` — usato dal mapper-engine plan 02-07 per emettere `mapping.warn`)
- **MAP-17** runtime (chiusura PRD §39 #1 — il livello esplicito è gestito dal mapper-engine PRIMA di consultare AliasRegistry; il registry stesso documenta in JSDoc che `resolve` ritorna `name-match` come default deterministico per il livello 4)
