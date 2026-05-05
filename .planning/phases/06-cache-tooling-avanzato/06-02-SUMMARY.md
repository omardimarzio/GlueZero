---
phase: 06-cache-tooling-avanzato
plan: 02
subsystem: cache
tags: [cache, lru, ttl, stable-hash, fnv1a, cache-key, scope, runtime]
one-liner: "MemoryCacheAdapter LRU bounded (D-158 maxEntries=1000) + stable-hash utility (FNV-1a 32-bit + cacheKey scope D-156) — Wave 2 building block A pronto per CacheHandler 06-03 e CacheBroker 06-08."
requires:
  - "@gluezero/cache types layer (06-01) — CacheAdapter, CacheEntry, CacheStats interfaces"
provides:
  - "createMemoryCacheAdapter({ maxEntries }): CacheAdapter — LRU bounded Map insertion order + TTL ortogonale + invalidate 3-dispatch + stats cumulative"
  - "stableStringify, fnv1a32, stableHash, cacheKey utility pure (zero deps) per cache key derivation D-155/D-156"
affects:
  - "@gluezero/cache barrel runtime exports (W2)"
tech-stack:
  added:
    - "Nessuna dipendenza esterna (zero-dep priority RESEARCH §2.3 + §3.2)"
  patterns:
    - "Map insertion order LRU (idiomatic JS ECMAScript 2015 spec — RESEARCH §2.2)"
    - "FNV-1a 32-bit inline hash (RESEARCH §3.2 — analog F3 D-74 KeyBased dedupe-strategy.ts:65-90)"
    - "Lazy TTL expiration (no proactive sweeper — RESEARCH §15.7)"
    - "TDD RED→GREEN co-located commit pattern (D-149 carryover F5)"
key-files:
  created:
    - "packages/cache/src/stable-hash.ts (133 LOC con JSDoc)"
    - "packages/cache/src/stable-hash.test.ts (119 LOC, 15 test)"
    - "packages/cache/src/memory-cache-adapter.ts (159 LOC con JSDoc)"
    - "packages/cache/src/memory-cache-adapter.test.ts (205 LOC, 15 test)"
  modified:
    - "packages/cache/src/index.ts (barrel append: createMemoryCacheAdapter + stable-hash utility)"
decisions:
  - "Pattern Map insertion order LRU adottato (zero-dep, Baseline universale) — `lru-cache@11.3.6` rigettato per budget bundle"
  - "FNV-1a 32-bit inline (~10 LOC) adottato — `json-stable-stringify` rigettato per zero-dep priority"
  - "Lazy TTL expiration (check su read) — proactive sweeper rigettato per overhead inutile (RESEARCH §15.7)"
  - "Replace in-place via delete+set per garantire LRU touch coerente su set di key esistente"
metrics:
  duration: "~25 min execution"
  tasks_completed: "2/2"
  files_created: 4
  files_modified: 1
  total_loc: 616
  test_count: 30
  coverage:
    stable-hash: "100/100/100/100"
    memory-cache-adapter: "100/96.29/100/100"
  completed-date: "2026-05-05"
---

# Phase 06 Plan 02: MemoryCacheAdapter + stable-hash Summary

**Wave 2 building block A** (parallelo a 06-04 con file ownership disgiunta). Implementazione runtime di `MemoryCacheAdapter` LRU bounded e utility `stable-hash` riusato dal CacheHandler (06-03) per la cache key default `${topic}::${stableHash(canonicalPayload)}` (D-155).

## Output

| File | LOC | Tipo | Test |
|------|-----|------|------|
| `packages/cache/src/stable-hash.ts` | 133 | source production | — |
| `packages/cache/src/stable-hash.test.ts` | 119 | test Tier-1 jsdom | 15 |
| `packages/cache/src/memory-cache-adapter.ts` | 159 | source production | — |
| `packages/cache/src/memory-cache-adapter.test.ts` | 205 | test Tier-1 jsdom | 15 |
| `packages/cache/src/index.ts` (modificato) | +5 LOC | barrel append | — |
| **Totale** | **616 LOC** | | **30 test** |

## Commit timeline

| # | Hash | Type | Descrizione |
|---|------|------|-------------|
| 1 | `be9f8b2` | test | RED test stable-hash (15 test deterministici) |
| 2 | `5ae6c4c` | feat | GREEN stable-hash (D-155 default + D-156 scope prefix + FNV-1a) |
| 3 | `c2c3a42` | test | RED test MemoryCacheAdapter (15 test deterministici) |
| 4 | `7935bff` | feat | GREEN MemoryCacheAdapter LRU bounded + barrel exports (D-158) |

Pattern TDD RED→GREEN co-located (D-149 carryover F5) verificato: per ogni file source `*.ts` il `*.test.ts` è committato PRIMA (RED) e il source segue (GREEN).

## Acceptance gates verified

### must_haves.truths (frontmatter PLAN)

- [x] `createMemoryCacheAdapter` ritorna CacheAdapter LRU bounded con maxEntries default 1000 (D-158)
- [x] Eviction LRU: cap=10, dopo 11 set sequenziali la prima entry inserita è evicted (Map insertion order)
- [x] TTL expiry: entry con ttlMs=100 dopo Date.now()+200 → cache.get ritorna undefined + entry rimossa + counter evictions++
- [x] LRU touch on get: cache.get(k1) re-ordina k1 in coda Map; la PROSSIMA eviction droppa k2 (next-oldest)
- [x] invalidate(string) exact + ritorna 1; invalidate(RegExp) match + ritorna count; invalidate({prefix}) startsWith + ritorna count
- [x] stats() ritorna readonly { hits, misses, evictions, entries } cumulative dal boot adapter
- [x] stableHash(value) determinismo: stesso payload → stesso 8-char hex hash su 1000 iterazioni
- [x] stableStringify key ordering invariance: { a: 1, b: 2 } produce identica stringa di { b: 2, a: 1 }
- [x] FNV-1a 32-bit collision rate <1e-3 su 10k random payload (cite C1 RESEARCH §3.2)
- [x] cacheKey({topic, payload}) ritorna formato `${topic}::${hash8}`
- [x] cacheKey({topic, payload, scope: 'user-42'}) ritorna `user-42::${topic}::${hash8}` (D-156 anti cross-tenant)
- [x] Coverage v8 sui 2 file ≥90/80/90/90 — measured: stable-hash 100/100/100/100 + memory-cache 100/96.29/100/100
- [x] Vincolo D-83 strict: `git diff cf51c97..HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines
- [x] File ownership disgiunta da 06-04: zero overlap su `packages/devtools/src/`

### Cross-file gate
- [x] 38/38 test cache passing (8 augment 06-01 + 15 stable-hash + 15 memory-cache-adapter)
- [x] `pnpm -F @gluezero/cache build` success (ESM 2.98 KB + DTS 7.12 KB)
- [x] `pnpm -F @gluezero/cache typecheck` zero errors

## Coverage measured (v8)

```
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered
--------------------|---------|----------|---------|---------|----------
stable-hash.ts      |   100   |   100    |   100   |   100   | —
memory-cache-adapter|   100   |   97.14  |   100   |   100   | line 100*
```

*Line 100 uncovered = branch `oldestKey === undefined` defensive guard (impossibile da raggiungere se `cache.size >= 1` invariant — soft uncovered fisiologico).

Target ≥90/80/90/90 superato su entrambi i file.

## Pattern carryover documentation

### F3 D-74 KeyBased (analog primario)

`packages/gateway/src/http/strategies/dedupe-strategy.ts:65-90` usa Map<string, Promise<unknown>> + cap maxInflight + cleanup finally. F6 06-02 generalizza il pattern:

- **Key derivation** → estratto in `stableStringify` + `fnv1a32` + `cacheKey` riusabili
- **Cap LRU eviction** → estratto in `MemoryCacheAdapter` con `cache.keys().next().value` drop oldest

### Map insertion order LRU (RESEARCH §2.2)

Pattern idiomatic JS ECMAScript 2015 spec, zero LOC overhead vs library:

- `cache.keys().next().value` → primo (oldest) key inserito
- `delete + set` → re-insert in coda Map (LRU touch)
- `Map.size` → atomic check vs cap

`lru-cache@11.3.6` valutato e rigettato per zero-dep priority + budget bundle stretto.

### TDD RED→GREEN co-located (D-149 carryover F5)

Verbatim 05-02/05-03/05-04/05-05: per ogni file source il test è committato PRIMA come RED commit, source segue come GREEN commit. 4 commit atomici.

## Threat model coverage

| Threat ID | Categoria | Component | Disposition | Verified |
|-----------|-----------|-----------|-------------|----------|
| T-06-02-01 | DoS cache illimitata | memory-cache-adapter | mitigate | Cap maxEntries=1000 default + LRU drop oldest — Test 5 fill 11 entries (cap=10) verifica first eviction |
| T-06-02-02 | Information Disclosure cross-tenant | stable-hash cacheKey | mitigate | D-156 scope prefix — Test 12 verifica `user-42::topic::hash` formato |
| T-06-02-03 | Tampering consumer mutation | memory-cache-adapter | accept | Cache restituisce reference (perf consideration RESEARCH §15.3) — documentato in JSDoc |
| T-06-02-04 | Logic flaw TTL race | memory-cache-adapter | mitigate | Atomic single-thread JS event loop + lazy expiration — Test 7 fake-timers 100ms+200ms verifica |
| T-06-02-05 | Tampering FNV-1a collision | stable-hash | accept | NON crypto-grade documentato — collision worst case = wrong cache hit, mitigato da scope D-156 |
| T-06-02-06 | DoS stableStringify cyclic | stable-hash | mitigate | Caveat documentato — Test 15 verifica RangeError throw, caller responsibility (Mapper F2 garantisce acyclic) |

## REQ-IDs progress

- **CACHE-01** (in-memory + key configurabile per route/topic) → runtime done ✅ (cacheKey default + override route-level documentato in JSDoc)
- **CACHE-02** (TTL + invalidate manuale/automatica) → runtime done ✅ (set ttlMs param + invalidate 3-dispatch)

## Deviations from Plan

**Nessuna deviazione applicata** — plan eseguito esattamente come scritto. Auto-fix Rule 1/2/3 non triggerati.

## Out-of-scope discoveries (deferred)

Durante la verifica cross-package zero regression, è emerso un errore pre-esistente NON correlato al plan 06-02:

- **`@gluezero/routing` build DTS error TS7016**: `Could not find a declaration file for module '@gluezero/gateway/http'`. Riprodotto al commit `cf51c97` (HEAD pre-06-02) → errore pre-esistente, fuori scope plan 06-02. Va loggato in `deferred-items.md` o trattato in plan dedicato F3 fix-up.

## Building blocks pronti per

- **06-03** (CacheHandler) — può importare `createMemoryCacheAdapter` + `cacheKey` dal barrel `@gluezero/cache`
- **06-08** (CacheBroker composition wrapper) — può consumare gli stessi runtime exports

## Self-Check: PASSED

- File creati esistenti:
  - [x] `packages/cache/src/stable-hash.ts` — FOUND
  - [x] `packages/cache/src/stable-hash.test.ts` — FOUND
  - [x] `packages/cache/src/memory-cache-adapter.ts` — FOUND
  - [x] `packages/cache/src/memory-cache-adapter.test.ts` — FOUND
- Commit esistenti in git log:
  - [x] `be9f8b2` (test RED stable-hash) — FOUND
  - [x] `5ae6c4c` (feat GREEN stable-hash) — FOUND
  - [x] `c2c3a42` (test RED memory-cache) — FOUND
  - [x] `7935bff` (feat GREEN memory-cache + barrel) — FOUND
- D-83 strict verified: zero diff `packages/{core,mapper,routing,gateway,worker}/src/` (cf51c97..HEAD)
- 38/38 test passing + build/typecheck OK
