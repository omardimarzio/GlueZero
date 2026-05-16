# 12 — Devtools MF

`@gluezero/devtools/mf-inspector` (F16, subpath) estende il devtools baseline v1.1 (Event/Mapping/
Route Inspector + MetricsCollector) con **17 fields aggregator per-MF** e **14 metriche per-MF**
(`gluezero.mfs.*`). Integrazione con `SnapshotProvider Registry` (MIN-3) e D-V2-19 metrics
`microFrontends[]` array shape.

## Quick start

```typescript
import { createBroker } from '@gluezero/core';
import { microFrontendModule } from '@gluezero/microfrontends';
import { devtoolsModule } from '@gluezero/devtools';
import { mfInspectorModule } from '@gluezero/devtools/mf-inspector';

const broker = createBroker({
  modules: [
    microFrontendModule(),
    devtoolsModule(), // baseline v1.1
    mfInspectorModule(), // estensione F16 MF-aware
  ],
});

const devtools = broker.getService('devtools');
const snapshot = devtools.getDebugSnapshot();

// 17 fields per-MF aggregati
console.log(snapshot.microFrontends);
// [
//   {
//     id: 'cart',
//     version: '1.0.0',
//     state: 'mounted',
//     mountCount: 2,
//     lastMountTs: 1700000000000,
//     bootstrapDurationMs: 120,
//     mountDurationMs: 45,
//     errors: [],
//     subscriptions: ['cart.*', 'user.read'],
//     publishedTopics: ['cart.added', 'cart.removed'],
//     // ... 7 altri fields
//   },
//   // ...
// ]
```

## API reference

Documentazione API completa: vedi [@gluezero/devtools](../../packages/devtools/README.md) +
subpath `mf-inspector`.

## 14 metriche per-MF

Tutte cumulative-only (D-164 carryover F6), in formato simil-OpenMetrics:

| Metric name | Tipo | Descrizione |
|-------------|------|-------------|
| `gluezero.mfs.registered.total` | counter | MF registered totali |
| `gluezero.mfs.mounted.current` | gauge | MF currently mounted |
| `gluezero.mfs.mount.total` | counter | mount events totali |
| `gluezero.mfs.unmount.total` | counter | unmount events totali |
| `gluezero.mfs.errors.total` | counter | errori totali (tutti MF_ERROR_TOPICS) |
| `gluezero.mfs.bootstrap.duration_ms` | histogram | distribuzione bootstrap durations |
| `gluezero.mfs.mount.duration_ms` | histogram | distribuzione mount durations |
| `gluezero.mfs.published.total` | counter (per-MF) | publish per-MF |
| `gluezero.mfs.subscribed.total` | counter (per-MF) | subscribe per-MF |
| `gluezero.mfs.permissions.denied.total` | counter | permission denied F11 |
| `gluezero.mfs.compat.failed.total` | counter | compat failed F12 |
| `gluezero.mfs.capability.missing.total` | counter | capability missing F11 |
| `gluezero.mfs.fallback.applied.total` | counter | fallback applicato F14 |
| `gluezero.mfs.circuit.open.current` | gauge | circuit aperti correnti F14 |

## 17 fields per-MF aggregator

Per ogni MF, `snapshot.microFrontends[i]` espone 17 fields aggregati:

1. `id` — descriptor.id
2. `version` — descriptor.version
3. `state` — FSM state corrente
4. `mountCount` — numero mount completed
5. `unmountCount` — numero unmount completed
6. `lastMountTs` — timestamp ultimo mount
7. `lastUnmountTs` — timestamp ultimo unmount
8. `bootstrapDurationMs` — ms ultimo bootstrap
9. `mountDurationMs` — ms ultimo mount
10. `errors` — array degli errors recenti (ring buffer 50)
11. `subscriptions` — array topic subscriptions attive
12. `publishedTopics` — array topic ever publicati
13. `permissionsDenied` — counter denied F11
14. `capabilitiesDeclared` — `descriptor.capabilities`
15. `capabilitiesRequired` — `descriptor.requiredCapabilities`
16. `isolationPolicy` — policy applicata F13
17. `fallbackState` — `'normal' | 'retrying' | 'circuit-open' | 'fallback-ui'`

## D-V2-19 — metrics shape preservation

`snapshot.metrics.microFrontends` è un **array** (non un Record). Questo permette ordering
stable e tree-shaking on the consumer side. La shape è locked (D-V2-19).

## SnapshotProvider Registry MIN-3

`mf-inspector` registra un SnapshotProvider con name `'microfrontends'` nel devtools registry
baseline. Almeno 3 provider sono sempre present (MIN-3 invariant):

- `events` (F6 ring buffer 500)
- `metrics` (F6 cumulative)
- `microfrontends` (F16, NEW)

## Decisioni v2.0 lockate

- **D-V2-19** — `metrics.microFrontends[]` array shape preservation.
- **D-V2-F16-14** — 14 metriche per-MF in 6 globali + 5 per-MF + 1 gauge + 2 histogram.
- **D-V2-F16-17** — 17 fields aggregator per-MF.
- **D-164 carryover** — Metrics cumulative-only.
- **D-167 carryover** — Inspector ring buffer 500.
- **D-170 carryover** — Critical bypass (snapshot integrity).

## Riferimenti

- [PRD §25 — Devtools MF](../../prd_2.0.0.md)
- [README @gluezero/devtools](../../packages/devtools/README.md)
- [04 — Lifecycle FSM](./04-lifecycle.md)
- [`examples/microfrontends/mf-devtools-inspector.html`](../../examples/microfrontends/mf-devtools-inspector.html)
