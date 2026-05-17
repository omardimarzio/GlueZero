# Deferred Items — Phase 13

## 13-02 W2 P02 — Discovered out-of-scope issues

### 2026-05-13 19:27 UTC — `packages/isolation/src/internal/build-theme-stylesheet.ts` TS syntax errors

**Scope:** File NON di ownership 13-02 — `<files_modified>` 13-02 esplicitamente NON include questo file. Il plan ownership è documentato linee 75-77:
- P02 (13-02) ownership: `policy-resolver.ts` + `warning-matrix.ts` + `lifecycle-register-hook.ts` + `internal/policy-cache.ts`
- **P04 (13-04) ownership: `internal/build-theme-stylesheet.ts`**

Il file è apparso durante la wave parallel (timestamp 19:27, concomitante al Task 3 13-02), creato da agente parallelo P04 in corso. Errori TS riportati da `pnpm typecheck` su 13-02 NON sono regression del mio plan — file è work-in-progress P04.

**Errors observed (sample):**
- `src/internal/build-theme-stylesheet.ts(13,68): error TS1128: Declaration or statement expected.`
- `src/internal/build-theme-stylesheet.ts(67,1): error TS1160: Unterminated template literal.`
- 30+ TS1128/TS1005/TS1443 cascade da unterminated template literal.

**Action:** NESSUNA — out-of-scope per 13-02. Lasciato a 13-04 (P04 owner) per completion del file.

**Verifica isolata 13-02 files:** Tutti i miei 4 file (policy-resolver.ts + warning-matrix.ts + lifecycle-register-hook.ts + internal/policy-cache.ts) sono syntactically corretti — nessun TS error attribuibile a 13-02.

**Test suite 13-02:** Tutti i 25 nuovi test PASS (63 totali isolation package). Vitest non si blocca per syntax error file (transform skippa per `src/**/*.test.ts` resolution).

## 13-03 W2 P03 — Discovered out-of-scope issues

### 2026-05-13 19:28 UTC — Re-osservato `packages/isolation/src/internal/build-theme-stylesheet.ts` ancora con TS errors

**Scope:** Stesso file P04 (work-in-progress) già documentato sopra da 13-02. P03 ownership è esclusivamente:
- `packages/isolation/src/dom-isolation.ts` + `css-isolation.ts` + `scope-css.ts` + `iframe-stub.ts` + `lifecycle-mount-hook.ts` + 5 test corrispondenti

**Action:** NESSUNA — out-of-scope per 13-03 (SCOPE BOUNDARY rule). Lasciato a 13-04 owner.

**Verifica isolata 13-03 files:** Nessun TS error attribuibile ai file P03. Test suite P03 PASS (14 test Task 1 + 6 test Task 2 = 20 nuovi P03; cumulativo isolation 83 test, suite a verde modulo file P04 untracked).

