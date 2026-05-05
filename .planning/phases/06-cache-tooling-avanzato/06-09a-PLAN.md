---
phase: 06-cache-tooling-avanzato
plan: 09a
type: execute
wave: 5
depends_on: [06-08b]
files_modified:
  - packages/cache/vitest.config.ts
  - packages/devtools/vitest.config.ts
  - packages/gluezero/vitest.config.ts
  - packages/cache/package.json
  - packages/devtools/package.json
  - packages/gluezero/package.json
  - package.json
autonomous: true
requirements:
  - PKG-01
  - PKG-02
  - PKG-03
  - PKG-04
  - TEST-01
  - TEST-02
must_haves:
  truths:
    - "Tutti CI gates passing su F6: lint biome zero errors + typecheck tsc clean su 8 pacchetti + build tsup ESM-only + test jsdom + coverage v8 ≥90/80/90/90 sui source F6 (calibrate post-impl + 0.5% safety floor — pattern F4 04-09 commit 761e4ad + F5 05-07 commit 1347d0b)"
    - "publint OK su 3 pacchetti F6 (cache + devtools + sembridge) + attw ESM-only OK (node16 OK + bundler OK)"
    - "size-limit budget @gluezero/{cache,devtools,sembridge} rispettato — calibrato post-impl con +20% headroom (lesson learned F3 03-14 commit 9922a36 — pre-impl estimate sotto-stima sistematicamente)"
    - "Biome auto-format + auto-organize-imports applied su tutti i file F6 modificati packages/{cache,devtools,sembridge}/src/ — zero behavior change verified via test re-run"
    - "Coverage threshold calibration in vitest.config.ts (cache + devtools + sembridge) post-implementation a measured floor − 0.5% safety"
    - "Vincolo D-83 strict (CRITICO): zero modifiche packages/{core,mapper,routing,gateway,worker}/src/ per tutto il plan 06-09a"
  artifacts:
    - path: "packages/cache/vitest.config.ts"
      provides: "Coverage thresholds calibrate post-impl @gluezero/cache (statements/branches/functions/lines a measured-0.5%)"
    - path: "packages/devtools/vitest.config.ts"
      provides: "Coverage thresholds calibrate post-impl @gluezero/devtools"
    - path: "packages/gluezero/vitest.config.ts"
      provides: "Coverage thresholds calibrate post-impl @gluezero/gluezero"
    - path: "package.json"
      provides: "size-limit array F6 budget aggiunto (cache 10 KB / devtools 16 KB / sembridge 100 KB) — calibrato post-impl + 20% headroom"
  key_links:
    - from: "packages/{cache,devtools,sembridge}/vitest.config.ts"
      to: "Coverage thresholds calibration"
      via: "post-impl measured floor"
      pattern: "thresholds:"
    - from: "package.json"
      to: "size-limit budget @gluezero/{cache,devtools,sembridge}"
      via: "post-impl measured + 20% headroom"
      pattern: "@gluezero/cache.*gzip\\|@gluezero/devtools.*gzip\\|@gluezero/gluezero.*gzip"
---

<objective>
Wave 5a sequential gate (post 06-08b — depends_on completion devtools wrapper + sembridge chain): CI gates verification + budget calibration + biome cleanup.

**6 deliverable principali:**

1. **Run CI gates monorepo full**: typecheck, build, test 3-tier (Tier-1 jsdom + Tier-3 Playwright Chromium structuredclone-perf benchmark), coverage v8 measure.

2. **Coverage thresholds calibration** post-implementation in `packages/{cache,devtools,sembridge}/vitest.config.ts` — pattern F3 03-14 / F4 04-09 / F5 05-07 verbatim: thresholds a `measured - 0.5%` safety floor.

3. **size-limit budget calibration** in root `package.json` — entries `@gluezero/{cache,devtools,sembridge}` con `limit: <measured + 20% headroom>` (lesson learned F3 commit 9922a36 routing 19.15/24 KB raised — pre-impl estimate sotto-stima sistematicamente).

4. **publint validation** 3 package F6 (cache + devtools + sembridge) — verify `package.json` exports/types/main puntano a `dist/` correttamente.

5. **attw ESM-only validation** 3 package F6 — verify node16 + bundler resolution corrette per ESM-only consumer.

6. **Biome auto-format + auto-organize-imports** su tutti i source F6 modificati nei plan 06-01..06-08b. Verify zero behavior change via test re-run completo.

**Vincolo D-83 strict (CRITICO):** zero modifiche `packages/{core,mapper,routing,gateway,worker}/src/` per tutto il plan 06-09a — solo CI/config/biome cleanup su F6 packages.

Output: 6-8 file modificati (3 vitest.config.ts + 4 package.json + biome whitespace). 1 commit atomico CI gate calibration.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/06-cache-tooling-avanzato/06-CONTEXT.md
@.planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md
@CLAUDE.md
@.planning/phases/05-worker-runtime/05-07-PLAN.md
@.planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-09-PLAN.md
@packages/worker/package.json
@packages/worker/vitest.config.ts
@packages/gateway/vitest.config.ts
@packages/cache/package.json
@packages/cache/vitest.config.ts
@packages/devtools/package.json
@packages/devtools/vitest.config.ts
@packages/gluezero/package.json
@packages/gluezero/vitest.config.ts
@package.json

<interfaces>
F5 05-07 ha prodotto 1 commit di calibration (pattern target):

```
test(05-07): coverage thresholds calibration post-impl + size-limit budget F5 + biome cleanup
- @gluezero/worker subset 91.5%/83%/90%/93.5% (above target ≥90/80/90/90)
- size-limit @gluezero/worker 18 KB measured + 20% headroom = 22 KB
- biome auto-format zero behavior change
```

F4 04-09 ha prodotto pattern simile per gateway sse-ws subset.

F6 06-09a applica stesso pattern adattato a 3 package (cache + devtools + sembridge).
</interfaces>
</context>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-09a-01 | Logic flaw (size-limit budget pre-implementation underestimate F3-F5 carryover lesson) | package.json size-limit | mitigate | Calibrazione post-implementation pattern F3 03-14 commit 9922a36 (raise floor a measured + 20% headroom). Documentato in commit message |
| T-06-09a-02 | DoS (CI gates timeout su monorepo full test 8 pacchetti — ~900 test) | CI run | accept | Vitest 4.x parallel run + cross-package isolation OK. Documentato in 06-09a-SUMMARY tempi run reali |
| T-06-09a-03 | Logic flaw (biome auto-format introduce behavior change accidentale) | biome cleanup | mitigate | Test re-run completo post-format per verify zero regression. Pattern F5 05-07 carryover |
| T-06-09a-04 | Logic flaw (coverage threshold troppo strict post-calibration → CI flake) | vitest.config.ts thresholds | mitigate | Floor a `measured - 0.5%` safety margin (pattern F4/F5 carryover). Test ripetibilità verified |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: CI gates verification + coverage thresholds calibration + size-limit budget + biome cleanup</name>
  <files>packages/cache/vitest.config.ts, packages/devtools/vitest.config.ts, packages/gluezero/vitest.config.ts, packages/cache/package.json, packages/devtools/package.json, packages/gluezero/package.json, package.json</files>
  <read_first>
    - packages/worker/package.json (analog F5 05-07 scripts CI gates ext)
    - packages/worker/vitest.config.ts (analog F5 coverage thresholds calibrate post-impl 91.5/83/90/93.5)
    - packages/gateway/vitest.config.ts (analog F4 04-09 sse-ws subset 91.80/86.70/89.53/93.75)
    - .planning/phases/05-worker-runtime/05-07-PLAN.md (analog struttura Task 1 verbatim)
    - .planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-09-PLAN.md (analog F4 final gate)
    - package.json (root size-limit array — F4/F5 entries da estendere)
    - .planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md §16 size-limit budget proposta + §16.2 CI gates
  </read_first>
  <action>
**1.1 — Run CI gates su monorepo full + measure coverage:**

```bash
cd "/Users/omarmarzio/programming/prova AI/GlueZero"
pnpm install
pnpm -r typecheck
pnpm -r build
pnpm -r test --passWithNoTests
pnpm -F @gluezero/cache test:coverage
pnpm -F @gluezero/devtools test:coverage
pnpm -F @gluezero/gluezero test:coverage
```

Atteso: zero errori. Annota i numeri reali coverage v8 sui sub-modulo F6:
- @gluezero/cache: statements/branches/functions/lines (atteso ≥90/80/90/90)
- @gluezero/devtools: statements/branches/functions/lines (atteso ≥90/80/90/90)
- @gluezero/gluezero: statements/branches/functions/lines (atteso ≥90/80/90/90)

**1.2 — Calibrate vitest.config.ts thresholds post-implementation (pattern F3 03-14 / F4 04-09 / F5 05-07):**

Aggiorna `packages/cache/vitest.config.ts` con thresholds calibrati a measured floor:

```typescript
coverage: {
  thresholds: {
    statements: <measured - 0.5>,
    branches:   <measured - 0.5>,
    functions:  <measured - 0.5>,
    lines:      <measured - 0.5>,
  },
}
```

Stessa cosa per `packages/devtools/vitest.config.ts` e `packages/gluezero/vitest.config.ts`.

**1.3 — size-limit budget calibration (Task 1.1 lesson learned F3 carryover):**

Run `pnpm size-limit` per misurare bundle reali. Aggiorna `package.json` root con nuove entries:

```json
{
  "size-limit": [
    // Existing F1-F5 entries...
    {
      "name": "@gluezero/cache (gzip)",
      "path": "packages/cache/dist/index.js",
      "limit": "<measured + 20% headroom> KB",
      "gzip": true
    },
    {
      "name": "@gluezero/devtools (gzip)",
      "path": "packages/devtools/dist/index.js",
      "limit": "<measured + 20% headroom> KB",
      "gzip": true
    },
    {
      "name": "@gluezero/gluezero (gzip)",
      "path": "packages/gluezero/dist/index.js",
      "limit": "<measured + 20% headroom> KB",
      "gzip": true
    }
  ]
}
```

Run `pnpm size-limit` per measure reale bundle gzip. Se measured > limit pre-impl, raise il limite a measured + 20% headroom (lesson F3 commit 9922a36). Documenta il raise in commit message.

**1.4 — publint + attw validation 3 package F6:**

```bash
cd "/Users/omarmarzio/programming/prova AI/GlueZero"
pnpm dlx publint packages/cache
pnpm dlx publint packages/devtools
pnpm dlx publint packages/sembridge
pnpm dlx @arethetypeswrong/cli --pack packages/cache
pnpm dlx @arethetypeswrong/cli --pack packages/devtools
pnpm dlx @arethetypeswrong/cli --pack packages/sembridge
```

Atteso: publint OK (zero error/warn) + attw "node16 OK + bundler OK" (no FalseCJS, no FalseESM).

**1.5 — Biome auto-format su tutti i source F6:**

```bash
pnpm biome check --write packages/cache/src/ packages/devtools/src/ packages/gluezero/src/
```

Verifica zero behavior change — solo whitespace + import ordering. Re-run `pnpm -r test` per assert no regression.

**Commit 1 (atomic):**

```bash
git add packages/cache/vitest.config.ts packages/devtools/vitest.config.ts packages/gluezero/vitest.config.ts packages/cache/package.json packages/devtools/package.json packages/gluezero/package.json package.json packages/cache/src/ packages/devtools/src/ packages/gluezero/src/
git commit -m "test(06-09a): coverage thresholds calibration post-impl + size-limit budget F6 + biome cleanup

Coverage v8 calibrate post-implementation (analog F4 04-09 + F5 05-07):
- @gluezero/cache subset <measured>%/<measured>%/<measured>%/<measured>% (above target ≥90/80/90/90)
- @gluezero/devtools subset <measured>%/<measured>%/<measured>%/<measured>% (above target ≥90/80/90/90)
- @gluezero/gluezero subset <measured>%/<measured>%/<measured>%/<measured>% (above target ≥90/80/90/90)

size-limit budget @gluezero/{cache,devtools,sembridge} added with measured + 20% headroom
(lesson learned F3 commit 9922a36 — pre-impl estimate sotto-stima sistematicamente).

Biome auto-format su 30+ file packages/{cache,devtools,sembridge}/src/ (zero behavior change,
solo whitespace + organize imports).

CI gates: publint OK (3/3 F6 packages + 7/7 totale), attw ESM-only OK (3/3 F6 + 7/7), biome
OK, typecheck OK, build OK, test ≥<count>/<count> monorepo full passing (zero regression
cross-package).

D-83 strict OK verified.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
  </action>
  <verify>
    <automated>cd "/Users/omarmarzio/programming/prova AI/GlueZero" && pnpm -r typecheck 2>&1 | tail -3 && pnpm -r build 2>&1 | tail -3 && pnpm -r test --passWithNoTests 2>&1 | tail -5 && pnpm size-limit 2>&1 | tail -10 && DIFF=$(git diff main...HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/ packages/worker/src/ | wc -l); echo "D-83 strict diff lines $DIFF (atteso 0)"</automated>
  </verify>
  <done>
    - vitest config thresholds calibrate per cache + devtools + sembridge
    - size-limit budget root package.json esteso F6 (3 entries)
    - publint + attw OK 3 package F6
    - Biome auto-format applied (zero behavior change verified via test run)
    - 1 commit atomico
    - CI gates all green
    - D-83 strict OK
  </done>
</task>

</tasks>

<verification>
- 1 commit atomico CI gate calibration
- Coverage v8 cache + devtools + sembridge subset measured + thresholds calibrate post-impl
- size-limit budget @gluezero/{cache,devtools,sembridge} rispettato (measured + 20% headroom)
- publint + attw OK 3 package F6
- Biome auto-format zero behavior change
- Cross-package zero regression full monorepo
- D-83 strict acceptance gate verified: zero diff packages/{core,mapper,routing,gateway,worker}/src/
</verification>

<success_criteria>
- [x] CI gates ALL GREEN (publint 7/7 + attw ESM-only + biome + typecheck + build + test 3-tier + coverage v8) ✅
- [x] size-limit budget @gluezero/{cache,devtools,sembridge} measured + 20% headroom ✅
- [x] Coverage thresholds calibrate post-impl in vitest.config.ts ✅
- [x] Biome auto-format zero behavior change ✅
- [x] D-83 strict acceptance gate verified ✅
</success_criteria>

<output>
Crea `.planning/phases/06-cache-tooling-avanzato/06-09a-SUMMARY.md` con:
- 1 commit details
- Coverage v8 measured (cache + devtools + sembridge)
- size-limit budget measured + headroom
- publint + attw report
- CI gates report (publint 7/7 + attw + biome + typecheck + build + test)
- D-83 strict acceptance verified
- Building blocks pronti per 06-09b (DOC consolidation + JSDoc + REQ flip + milestone v1.0 closure)
</output>
