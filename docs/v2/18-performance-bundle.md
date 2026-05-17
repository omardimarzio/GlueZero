# 18 — Performance & Bundle Impact

Trasparenza completa su bundle size, performance budget e regression CI hard gate di
GlueZero v2.0.

## Bundle target per-package (gzipped)

| Package | Cap gzip | Note |
|---------|----------|------|
| `@gluezero/core` baseline v2.0 | ≤ 8.87 KB | D-V2-21 cap raise documented (delta vs v1.x ≤ +350 B) |
| `@gluezero/microfrontends` | ≤ 5 KB | F8 lifecycle FSM 14 stati + registry + 29 standard topics |
| `@gluezero/mapper` | ≤ 12 KB | F2 canonical model + mapper bidirezionale + selector |
| `@gluezero/context` | ≤ 5 KB | F10 RuntimeContext + selector subscribe |
| `@gluezero/mf-esm` | ≤ 2 KB | F9 ESM loader (`import()` wrapper + smart fallback priority) |
| `@gluezero/mf-web-component` | ≤ 3 KB | F15 Web Component loader + `customElements.whenDefined` |
| `@gluezero/mf-iframe` | ≤ 10 KB | F15 iframe loader + bridge schema 9 message types + LRU dedup |
| `@gluezero/mf-module-federation` (experimental) | ≤ 5 KB | F15 — peer `@module-federation/runtime` |
| `@gluezero/mf-single-spa` (experimental) | ≤ 3 KB | F15 — peer `single-spa` |
| `@gluezero/permissions` | ≤ 5 KB | F11 pattern matching 4 modes + LRU cache 500 entries |
| `@gluezero/compat` | ≤ 9 KB | F12 9 dimensioni semver multi-dimensione + 5 policy |
| `@gluezero/isolation` | ≤ 12 KB | F13 shadow-dom + scoped + theme + cache integration |
| `@gluezero/fallbacks` | ≤ 6 KB | F14 retry + circuit + onMountError/onRuntimeError |
| `@gluezero/devtools` baseline | (estende v1.1 cap) | F6 Event/Mapping/Route Inspector + MetricsCollector |
| `@gluezero/devtools/mf-inspector` (subpath) | ≤ 6.27 KB | F16 — 14 metriche per-MF + 17 fields aggregator |
| **`@gluezero/react` (F17)** | **≤ 10 KB** | Provider + 6 hooks + factory + ErrorBoundary |
| **`@gluezero/web-components` (F17)** | **≤ 8 KB** | GlueZeroElement base class + property wiring |
| **`@gluezero/web-components/lit` (F17, subpath)** | **≤ 3 KB** | ReactiveController + Mixin |

## Misurazioni reali (Plan 17-04 closure)

Bundle reali registrati dal CI hard gate (`size-limit` con `gzip: true`):

| Package | Cap | Actual | Margin |
|---------|-----|--------|--------|
| `@gluezero/react` | 10 KB | **1.53 KB** | 85% |
| `@gluezero/web-components` | 8 KB | **609 B** | 92% |
| `@gluezero/web-components/lit` | 3 KB | **480 B** | 84% |

I tre adapter F17 sono ampiamente sotto target — il margine resta disponibile per
estensioni V2.1 (7° hook, SSR support, form-associated).

## Regression CI hard gate

Workspace `packages/_bench/` (private) esegue **due scenari** in CI:

### Scenario A — Baseline core only

```typescript
const broker = createBroker({}); // no modules
for (let i = 0; i < 1000; i++) {
  broker.publish('topic.test', { i });
}
```

**Cap regression:** ≤ 5% vs baseline v1.x committato in `packages/_bench/src/baseline-v1.json`.

### Scenario B — Full MF stack

```typescript
const broker = createBroker({
  modules: [microFrontendModule()],
});
// + 3 MF registered + 1000 publish bilanciati
```

**Cap regression:** ≤ 10% vs baseline scenario B committato.

Re-baseline manuale solo con commit justification + review approval (D-V2-F17-bench).

## Bundle delta per adoption level

| Configurazione | Bundle gzip totale | Delta vs v1.x |
|----------------|---------------------|---------------|
| **Livello A** — `createBroker({})` | ~8.87 KB | ≤ +350 B (D-V2-21 PASS) |
| **Livello B** — core + microfrontends + mf-esm | ~15 KB | +6 KB (nuovo) |
| **Livello C** — full governance + react adapter | ~60-65 KB | +52 KB (nuovo) |

Il delta da v1.x → v2.0 Livello A è **bit-exact safe**: progetti esistenti possono upgrade
senza rischio (BC §42 14 API public preservate).

## Esecuzione locale

```bash
# Build + size check tutti i package
pnpm build
pnpm ci:size

# Solo bench scenario
pnpm --filter @gluezero/_bench run bench
```

Output esempio:

```
@gluezero/core (gzip): 8.86 KB / 8.87 KB (99.9%)
@gluezero/react (gzip): 1.53 KB / 10 KB (15.3%)
@gluezero/web-components (gzip): 609 B / 8 KB (7.4%)
...
```

## Decisioni v2.0 lockate

- **D-V2-21** — Core cap raise a 8.87 KB documented (delta ≤ +350 B vs v1.x).
- **D-V2-F17-bench** — Bench CI hard gate cap scenario A ≤ 5%, scenario B ≤ 10%.
- **BC §42** — 14 API public preservate bit-exact (no breaking signature change).

## Riferimenti

- [PRD §43 — Performance](../../prd_2.0.0.md)
- [README @gluezero/_bench](../../packages/_bench/README.md)
- [17 — Migration guide](./17-migration-guide.md)
- [.planning/phases/17 — 17-04-SUMMARY.md](../../.planning/phases/17-framework-adapters-react-wc-migration-docs-ga-release/17-04-SUMMARY.md)
