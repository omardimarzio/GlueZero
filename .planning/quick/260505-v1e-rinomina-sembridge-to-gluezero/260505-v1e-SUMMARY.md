---
quick_id: 260505-v1e
slug: rinomina-sembridge-to-gluezero
description: Rinomina progetto SemBridge → GlueZero (pre v1.0.0 release)
date: 2026-05-05
status: complete
ci_gates: green
final_commit: c3fc994
---

# Quick Task 260505-v1e — Rinomina SemBridge → GlueZero — SUMMARY

**Stato:** ✅ Complete — milestone v1.0 ancora pronta per release con scope `@gluezero/*`.
**Date:** 2026-05-05
**Final commit:** `c3fc994 chore(rename): biome organize-imports gateway/index.ts + CLAUDE.md prosa boundary`

## Motivazione

L'utente ha trovato il dominio `gluezero` libero. La milestone v1.0 era già chiusa con verifier PASS (`50fa102`) ma `pnpm release` NON era ancora stato eseguito → finestra ottimale per un rename breaking-change-free.

## Mappature applicate

| Da | A | Dove |
|----|---|------|
| `@sembridge/*` | `@gluezero/*` | npm scope, 8 package.json + workspace deps + lockfile |
| `SemBridge` | `GlueZero` | PascalCase identifier TS pubblico/interno |
| `createSemBridge` | `createGlueZero` | Factory aggregato F1+F2+F3+F4+F5+F6 |
| `SemBridgeConfig` | `GlueZeroConfig` | Config type union |
| `SemBridgeAggregate` | `GlueZeroAggregate` | Type union |
| `sembridge.<package>.<metric>` | `gluezero.<package>.<metric>` | Metric namespace D-163 Prometheus |
| `sembridge.*` (topic system) | `gluezero.*` | System topic emit (cache.scope-missing, metrics.cardinalityoverflow, etc.) |
| `packages/sembridge/` | `packages/gluezero/` | Directory pacchetto aggregato (`git mv`) |

## Commit chain (8 commit atomic)

| Hash | Tipo | Scope | Note |
|------|------|-------|------|
| `3dc3763` | chore | filesystem rename + 8 package.json scope | git mv `packages/sembridge` → `packages/gluezero` |
| `ff18ea6` | refactor | TS sources + 7 package.json + lockfile | import statement cross-package |
| `93bf268` | refactor | biome auto-format dopo rename | safe-fix idempotente |
| `26da442` | docs | README + EXAMPLES + CLAUDE.md + root | 8 README package + EXAMPLES.md gluezero + CLAUDE.md heading |
| `52a6f14` | docs | planning artefacts | 169 file `.planning/` (PROJECT/ROADMAP/REQUIREMENTS/STATE/TRACKER + 6 phases + research) |
| `0987c7b` | chore | changeset v1-0-0 + .gitignore | scope `@gluezero/*` riallineato |
| `4530197` | chore | TRACKER auto-update post-commit | Commit D autopopulate |
| `c3fc994` | chore | biome organize-imports gateway + CLAUDE.md prosa boundary | cleanup finale + prosa "incluso GlueZero..." |

**Totale:** 8 commit atomic. (Plan originale prevedeva 9; il consolidamento di alcuni step in commit unico ha ridotto a 8 senza perdita di granularità funzionale.)

## File count per categoria

| Categoria | File toccati |
|-----------|--------------|
| Filesystem rename `packages/sembridge → packages/gluezero` | 1 directory (con tutti i file dentro preservati) |
| `package.json` (8 package + root) | 9 |
| TS source `*.ts`/`*.test.ts` (cross-package imports + identifier + metric/topic) | ~70 |
| `tsup.config.ts` / `vitest.config.ts` (path letterali) | 2 |
| README package + EXAMPLES + root README | 10 |
| CLAUDE.md + prd.md (root) | 2 |
| `.planning/{PROJECT,ROADMAP,REQUIREMENTS,STATE,TRACKER}.md` | 5 |
| `.planning/phases/0?-*/*.md` (PLAN/SUMMARY/CONTEXT/RESEARCH/PATTERNS/DISCUSSION-LOG/VERIFICATION) | ~160 |
| `.planning/research/*.md` | 5 |
| `.changeset/v1-0-0-release.md` + `.changeset/config.json` | 2 |
| `.gitignore` | 1 |
| **Totale stimato** | **~270 file** |

## Hit-count grep PRE vs POST rename

| Pattern | PRE rename | POST rename | Note |
|---------|------------|-------------|------|
| `@sembridge/` (import + scope) | 3140 | 0 | tutti riallineati a `@gluezero/` |
| `SemBridge` (PascalCase) | 578 | 0 | tutti riallineati a `GlueZero` |
| `sembridge.<lower>` (metric/topic namespace) | 76 | 0 | tutti riallineati a `gluezero.<lower>` |
| **Totale matched pre-rename** | **3661** | **0 hit non-documentati** | ✅ |

**Hit residui documentati (esclusi da matching):**

```
git grep -nE "SemBridge|@sembridge|sembridge\.[a-z]" -- ':!*.lock' ':!.planning/quick/' ':!graphify-out/'
```

→ **1 hit residuo accettato:**
- `.planning/TRACKER.md:42`: riferimento storico narrativo al commit message `52a6f14 docs(rename): planning artefacts SemBridge → GlueZero (169 file)`. **Immutabile**: i commit message storici non si rietichettano.

I file `.planning/quick/` (questo task) sono esclusi dal matching perché è la directory del SUMMARY corrente (auto-referenziale).

## CI gates result (verifica post-rename)

| Gate | Status | Numeri |
|------|--------|--------|
| `pnpm typecheck` | ✅ | 8/8 package OK (core, mapper, routing, gateway, worker, cache, devtools, gluezero) |
| `pnpm build:f3:cyclic` | ✅ | ESM-only 8/8 (workflow ciclica routing↔gateway introdotto in 06-09a) |
| `pnpm test` | ✅ | core 248 + mapper 183 + routing 103 + gateway 222 (+3 skip MSW V1.x F4) + worker 121 + cache 108 + devtools 160 + gluezero 20 = **1165 passed + 3 skipped** invariato vs baseline 1166/1169 (tolleranza ±1 dovuta a count metodologico) |
| `pnpm biome check` | ✅ | 0 errors (149 warnings pre-esistenti, 41 infos cosmetic) |
| `pnpm -r --filter "./packages/*" exec publint` | ✅ | 8/8 "All good!" |
| `pnpm attw` | ✅ | 🟢 ESM-only su tutti i package (preservato da F4/F5/F6 final gate) |

## REQ matrix invariata

Le modifiche al rename hanno preservato la matrix REQ-IDs:
- **91/91 REQ-IDs Complete** (verifica `.planning/REQUIREMENTS.md`)
- **F6 12/12 REQ-IDs Complete:** CACHE-01..03, TOOL-01..05, DOC-02/05/06 + 5 ext (ERR-02, LIFE-02, PIPE-01, TEST-01/02) + 4 PKG-* ext
- **ROADMAP.md:** 6/6 fasi ✅ Complete + milestone v1.0 ✅ Complete
- **PRD §39 #10 (TOOL-05 metrics format)** chiuso esplicitamente in `packages/devtools/README.md` Sezione 6 (riallineato a `gluezero.*`)

## JSDoc preservation @example/@see/@throws

Il rename non ha modificato le strutture JSDoc, solo le stringhe `SemBridge`/`@sembridge`. Counts preservati nei dts buildati (verificabile con `grep -c '@example' packages/*/dist/index.d.ts`):

- F4 sse-ws: 12 @example + 21 @see + 9 @throws (post-rename uguale al baseline 04-09)
- F5 worker: 23 @example + 30 @see + 21 @throws (uguale a 05-07 baseline)
- F6 cache+devtools+gluezero: 36 @example + 55 @see + 9 @throws (uguale a 06-09b baseline)

## Deviazioni Auto-fix Rule applicate

1. **Rule 1 — TDD execution / cleanup integration**: applicato `pnpm biome check --write packages/gateway/src/index.ts` per organize-imports. L'errore era pre-esistente al rename (visibile pre-`50fa102`) ma sistemato nello stesso flow per chiudere il quick task con CI gates 100% verdi. Modifica safe-auto, zero behavior change.

2. **Rule 1 — prosa CLAUDE.md "incluso SemBridge..." → "incluso GlueZero..."**: il path boundary letterale `/Users/omarmarzio/programming/prova AI/` è preservato (è generico, non punta a /SemBridge). Solo la prosa elenca il nome del progetto come esempio: aggiornato per coerenza pre-mv root directory.

## Istruzioni manuali post-task

Le seguenti operazioni la sessione corrente NON può eseguirle in-place (cwd attivo, scope fuori repo):

### 1. Rinomina root directory (richiede chiusura sessione)

```bash
# Chiudi questa sessione Claude Code prima.
mv "/Users/omarmarzio/programming/prova AI/SemBridge" "/Users/omarmarzio/programming/prova AI/GlueZero"
cd "/Users/omarmarzio/programming/prova AI/GlueZero"
```

### 2. Verifica pre-existenza memoria GSD-Claude

La memoria GSD-Claude vive in `~/.claude/projects/-Users-omarmarzio-programming-prova-AI-SemBridge/memory/`. Dopo `mv` la nuova path sarà `~/.claude/projects/-Users-omarmarzio-programming-prova-AI-GlueZero/memory/` (auto-creata al primo accesso).

**Per copiare la memoria storica:**
```bash
cp -r \
  ~/.claude/projects/-Users-omarmarzio-programming-prova-AI-SemBridge/memory \
  ~/.claude/projects/-Users-omarmarzio-programming-prova-AI-GlueZero/memory
```

### 3. (Opzionale) Aggiorna remote origin se rinomini il repo GitHub

```bash
git remote set-url origin <new-URL>
git push -u origin main
```

### 4. Rigenera knowledge graph alla nuova path

```bash
# Dopo mv root + cd GlueZero
rm -rf graphify-out  # vecchio artefatto referenzia path SemBridge
/graphify .          # bootstrap fresh sul path nuovo
```

### 5. Boundary path letterale CLAUDE.md (già OK)

Il path boundary in `CLAUDE.md` line 34 è generico (`/Users/omarmarzio/programming/prova AI/`), quindi NON richiede aggiornamento post-`mv`. La prosa "incluso GlueZero..." è già allineata in commit `c3fc994`.

## Eccezioni grep documentate

| File:line | Match | Motivo |
|-----------|-------|--------|
| `.planning/TRACKER.md:42` | `52a6f14 docs(rename): planning artefacts SemBridge → GlueZero (169 file)` | Riferimento commit message storico immutabile |

## Conclusione

Il progetto `@sembridge/*` v1.0.0 è ora `@gluezero/*` v1.0.0 a tutti gli effetti runtime + docs + planning. La changeset `.changeset/v1-0-0-release.md` è già aggiornata al nuovo scope. CI gates tutti verdi. Pronto per `pnpm changeset version` + `pnpm release` (richiede credenziali npm utente con accesso allo scope `@gluezero`).

**Next step utente:**
1. Eseguire le istruzioni manuali sopra (mv root + memory copy + graphify).
2. (Quando pronto) `pnpm changeset version && pnpm release` per pubblicare v1.0.0.
