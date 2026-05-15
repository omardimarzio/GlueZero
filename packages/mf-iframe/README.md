# @gluezero/mf-iframe

> Iframe sandbox loader + bridge postMessage 9 message types per GlueZero v2.0 — Phase 15.

[![npm](https://img.shields.io/badge/npm-2.0.0--alpha-blue)]() [![bundle](https://img.shields.io/badge/bundle-3.52KB%2F10KB-green)]() [![security](https://img.shields.io/badge/security-D--V2--09%20closure-success)]()

🔒 **Security-critical package — D-V2-09 BLOCKING closure F15** — Valibot `v.strictObject` 9 schemas + LRU dedup 500 per `(origin, mfId)` + replay-guard 30s dual-defense + rate-limit 100 msg/s + `expectedOrigin` MANDATORY + `targetOrigin '*'` BANNED + sandbox baseline `'allow-scripts'`.

## Quick start

```ts
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { isolationModule } from '@gluezero/isolation'
import '@gluezero/mf-iframe/augment'
import { iframeLoader } from '@gluezero/mf-iframe'

const adapter = iframeLoader()
const broker = createBroker({
  modules: [
    microfrontendModule(),
    isolationModule({ resolvers: { iframeLoader: () => adapter } }),
  ],
})
const service = broker.modules.get('@gluezero/microfrontends')
service.registerLoader(adapter)

await service.register({
  id: 'payment-iframe',
  loader: {
    type: 'iframe',
    url: 'https://payment.example.com/widget',
    expectedOrigin: 'https://payment.example.com', // MANDATORY (REQ MF-IFRAME-04)
    sandbox: 'allow-scripts',                       // baseline (REQ MF-SEC-01)
    bridge: true,                                   // attiva handshake 9 messaggi
  },
})
```

## Install

```bash
pnpm add @gluezero/mf-iframe valibot
# peer optional richiesti se usi isolation + context propagation:
pnpm add @gluezero/isolation @gluezero/context
```

Peer hard: `@gluezero/core`, `@gluezero/microfrontends`, `valibot`. Peer optional: `@gluezero/isolation` (F13 sblocco), `@gluezero/context` (context propagation cross-frame).

## API host-side

### `iframeLoader(): MicroFrontendLoaderAdapter & IframeAdapter`

Factory che ritorna adapter duck-typed: compatibile sia con `MicroFrontendLoaderAdapter` F8 (`type='iframe'` + `load` + `unload`) sia con `IframeAdapter` F13 (`createSandbox(policy, mfId, mount): void`) — sblocca F13 `IFRAME_ADAPTER_REQUIRED` throw path (D-V2-F15-21).

### `IframeLoaderDefinition`

```ts
interface IframeLoaderDefinition {
  readonly type: 'iframe'
  readonly url: string
  readonly expectedOrigin: string             // MANDATORY non-optional (REQ MF-IFRAME-04)
  readonly sandbox?: string                   // default 'allow-scripts' (REQ MF-SEC-01)
  readonly allow?: string                     // Permissions-Policy
  readonly bridge?: boolean                   // default true
  readonly bridgeTimeoutMs?: number           // default 15000ms
}
```

### `MfIframeError` + `createMfIframeError`

Class custom extends Error implements BrokerError (D-V2-F15-12). 6 literal codes:

| Code | Quando | Recovery |
| --- | --- | --- |
| `MF_IFRAME_BRIDGE_TIMEOUT` | Handshake `gz:handshake → gz:ready` non risolto in `bridgeTimeoutMs` | Verificare client SDK installato in iframe + origin trust |
| `MF_IFRAME_ORIGIN_MISMATCH` | `expectedOrigin` undefined/`'*'` o `event.origin !== expectedOrigin` | Fix descriptor + verificare host iframe |
| `MF_IFRAME_SCHEMA_INVALID` | Valibot `v.strictObject` reject envelope (missing field / unknown field / wrong type) | Investigare codice MF client — possibile injection o version drift |
| `MF_IFRAME_REPLAY_DETECTED` | LRU dedup hit o timestamp fuori window 30s | Possible attacker replay or client clock skew |
| `MF_IFRAME_RATE_LIMITED` | >100 msg/s per `mfId` (warn-only — drop silent) | Throttle iframe MF client publish loop |
| `MF_IFRAME_SANDBOX_DENIED` | Sandbox attribute apply failed | Browser policy / CSP iframe-src violation |

## API client-side (subpath `/client`)

Per code che gira **dentro** l'iframe — NO broker completo esposto, minimal SDK 1.21 KB gzip:

```ts
import { createIframeClient } from '@gluezero/mf-iframe/client'

const client = createIframeClient({
  hostOrigin: 'https://app.example.com',
  microFrontendId: 'payment-iframe',
})
await client.handshake()
client.publish('payment.completed', { orderId: 'O-1' })
const sub = client.subscribe('app.theme.changed', (theme) => { ... })
```

## Bridge 9 message types

| Type | Direzione | Payload key |
| --- | --- | --- |
| `gz:handshake` | host → iframe | `protocolVersion`, `expectedHostOrigin` |
| `gz:ready` | iframe → host | `protocolVersion`, `capabilities?` |
| `gz:publish` | iframe → host | `topic`, `data` |
| `gz:subscribe` | iframe → host | `topic`, `subscriptionId` |
| `gz:unsubscribe` | iframe → host | `subscriptionId` |
| `gz:context:get` | iframe → host | `keys?` |
| `gz:context:update` | host → iframe | record partial |
| `gz:error` | bidirezionale | `code`, `message`, `details?` |
| `gz:lifecycle` | bidirezionale | `phase`, `status`, `reason?` |

Common envelope:

```ts
{
  id: string                  // nanoid o crypto.randomUUID, length ≥ 1
  microFrontendId: string     // length ≥ 1
  timestamp: number           // integer ≥ 0, ms da epoch (replay-window 30s)
  correlationId?: string      // tracing cross-frame
  type: 'gz:...'              // discriminator
  payload: { ... }            // per-tipo (Valibot v.strictObject)
}
```

## Security model

### ⚠️ Governance, not crypto sandbox (P-13 disclaimer)

L'iframe sandbox è governance + browser native protection, NON sandbox crittografica completa. In shared-window scenario un MF malevolo che esce dalla sandbox può comunque interferire con il main window via DOM patches o prototype pollution. Questo package mitiga la classe più comune di vulnerability ma non sostituisce due diligence sulla supply chain dei codici remote loaded.

### 7 D-V2-09 gates (closure F15)

| # | Gate | Implementation | STRIDE |
| --- | --- | --- | --- |
| 1 | Valibot `v.strictObject` 9 schemas reject unknown field | `bridge-schemas.ts` | T-15-01 |
| 2 | LRU dedup 500 per `(origin, mfId)` | `lru-dedup.ts` | T-15-02 |
| 3 | Replay timestamp 30s dual-defense | `lru-dedup.ts:isReplay` | T-15-03 |
| 4 | Rate-limit 100 msg/s drop+emit topic 1x/window | `rate-limiter.ts` | T-15-06 |
| 5 | `expectedOrigin` MANDATORY (no `?`, no `'*'`) | `origin-validator.ts` | T-15-04 |
| 6 | `targetOrigin '*'` BANNED runtime PRIMARY | `origin-validator.ts:validateTargetOrigin` | T-15-05 |
| 7 | Sandbox baseline `'allow-scripts'` + warn `allow-same-origin` | `iframe-loader.ts` | T-15-07 |

### Renwa Mar 2026 + CVE-2024-49038 reference

[Renwa "Iframe sandbox bypass via origin masquerading" Mar 2026] — mitigato da `expectedOrigin` MANDATORY + Valibot `microFrontendId` ≥ 1 + LRU per-tuple scoping.
[CVE-2024-49038 "postMessage handler injection unknown fields"] — mitigato da `v.strictObject` reject extra props.

## Errors

Vedi tabella completa sopra (sezione "MfIframeError"). 6 literal codes union — gestire via `if (err instanceof MfIframeError && err.code === 'MF_IFRAME_...')`.

## Q&A

**Q: Cosa significa "governance not crypto" exactly?**
A: La sandbox iframe garantisce isolation a livello DOM/storage/network ma NON protegge contro escape via prototype pollution shared-window o supply chain compromise del codice MF remote. Per crittografia hard (es. cross-tenant), serve cross-origin iframe + separate process (deferred V2.1).

**Q: Posso impostare `expectedOrigin: '*'` durante dev?**
A: No. La validation è runtime + type-level. Per dev usa `expectedOrigin: 'http://localhost:5173'` (origin specifico del dev server).

**Q: Cosa succede se ricevo >100 msg/s da una MF?**
A: I msg 101+ vengono droppati silently (anti-DoS amplification). Una emit topic `microfrontend.iframe.bridge.rate-limited` UNA volta per 1s window con payload `{mfId, origin, droppedCount, windowMs, timestamp}`.

**Q: Posso usare il loader senza bridge handshake?**
A: Sì, `bridge: false` nel descriptor. Utile per iframe full-page static (es. embed CMS). NB: in quel caso il MF non può publish/subscribe via broker host.

**Q: Posso scambiare context cross-frame?**
A: Sì, via messaggi `gz:context:get` (iframe→host) e `gz:context:update` (host→iframe). Validati da Valibot strict.

**Q: Cosa fa il subpath `/client`?**
A: Minimal SDK per code in-iframe (1.21 KB gzip). NO broker completo, solo `handshake/publish/subscribe/context.get/update`. Evita di esporre 30 KB+ broker cross-frame.

**Q: Il loader chiama `iframe.contentWindow.postMessage`?**
A: Sì, sempre con `targetOrigin = expectedOrigin` (mai `'*'` — runtime assert PRIMARY blocca).

## Migration v1.x → v2.0

Primo iframe loader in v2.0. Zero breaking change v1.x. Opt-in pattern:

```ts
// v2.0 — opt-in
import '@gluezero/mf-iframe/augment'
import { iframeLoader } from '@gluezero/mf-iframe'
service.registerLoader(iframeLoader())
```

## Limitations (PRD §44)

- **Storage isolation cross-frame**: `localStorage`/`sessionStorage` cross-origin iframe è già isolato dal browser. Stesso-origin iframe → richiede `@gluezero/isolation` (F13) `storage: 'namespaced'`. Deep storage propagation deferred V2.1.
- **Theme propagation cross-frame**: tokens passati via `gz:context:update` payload. Variants advanced deferred V2.1.
- **`srcdoc` / `document.write` NOT supported**: solo `iframe.src` URL. Origin inheritance ambiguity con `srcdoc` mitigato dall'API choice (T-15-10 accepted).
- **Service Worker proxy NOT bundled**: il bridge è postMessage-only.

## Performance

| Metric | Value | Note |
| --- | --- | --- |
| Bundle gzipped | **3.52 KB** | Cap 10 KB (35% utilizzo) |
| Augment gzipped | 22 B | Cap 1 KB |
| Client subpath gzipped | **1.21 KB** | Cap 3 KB (40% utilizzo) |
| Valibot strict parse | ~5 µs | Per envelope |
| LRU dedup lookup | ~1 µs | Map.has |
| Rate-limit check | ~0.5 µs | Map increment |
| Handshake handshake→ready | ~10-50 ms | Network-dependent |

## Bundle

| Entry | Path | Limit | Gzip |
| --- | --- | --- | --- |
| `@gluezero/mf-iframe` | `dist/index.js` | 10 KB | **3.52 KB** |
| `@gluezero/mf-iframe/augment` | `dist/augment.js` | 1 KB | **22 B** |
| `@gluezero/mf-iframe/client` | `dist/client.js` | 3 KB | **1.21 KB** |

## Riferimenti

- PRD §26 — Iframe Loader + Bridge
- PRD §44 — Security (Renwa Mar 2026 + CVE-2024-49038)
- D-V2-09 BLOCKING — Valibot bridge schema strict + LRU dedup + expectedOrigin MANDATORY
- D-V2-F15-01 — Valibot strict-only
- D-V2-F15-02 — LRU 500 per `(origin, mfId)`
- D-V2-F15-03 — Replay timestamp 30s dual-defense
- D-V2-F15-04 — Rate-limit drop+emit policy
- D-V2-F15-21 — IframeAdapter F13 sblocco duck-typing
- REQ MF-IFRAME-01..05, MF-SEC-01..04
- 15-CONTEXT.md, 15-03-SUMMARY.md

---

*Phase 15 v2.0.0 — Last updated: 2026-05-15 (W3 P05 closure + D-V2-09 BLOCKING formal closure)*
