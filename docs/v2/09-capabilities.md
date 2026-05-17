# 09 — Capabilities

Le **capabilities** sono dichiarazioni di contratti che un MF espone o richiede. Le capabilities
sono **negoziate** dal `@gluezero/permissions` module al register/mount con semantics **first-wins**:
il primo MF a registrare una capability resta provider canonico.

## Quick start

```typescript
await broker.registerMicroFrontend({
  id: 'auth',
  version: '1.0.0',
  capabilities: ['user.read', 'user.write', 'session.refresh'], // dichiarate (provider)
  // ...
});

await broker.registerMicroFrontend({
  id: 'cart',
  version: '1.0.0',
  requiredCapabilities: ['user.read', 'session.refresh'], // richieste (consumer)
  // ...
});
```

Se `cart` viene registered ma nessun MF provider ha registrato `user.read`, il broker pubblica
`microfrontend.capability.missing` + applica la policy compat (block-mount / warn / allow).

## API reference

Documentazione API completa: vedi [@gluezero/permissions](../../packages/permissions/README.md)
(capabilities sotto-modulo).

## First-wins semantics

Se due MF dichiarano la stessa capability, il **primo registered** vince:

```typescript
await broker.registerMicroFrontend({ id: 'auth-v1', capabilities: ['user.read'] }); // provider canonico
await broker.registerMicroFrontend({ id: 'auth-v2', capabilities: ['user.read'] }); // NO-OP per questa capability
```

`auth-v2` resta registered ma **non** è il provider di `user.read`. Topic
`microfrontend.capability.duplicate` è publicato per observability.

## Missing capability handling

Quando un MF dichiara `requiredCapabilities` e una capability non è provider'd:

1. Topic `microfrontend.capability.missing` publicato con `{microFrontendId, missingCapability}`.
2. La policy `compat` (F12) decide il comportamento:
   - `block-mount` (default): il MF entra in stato `failed` e non monta.
   - `warn`: log warn ma monta comunque.
   - `allow`: silent allow (sconsigliato in produzione).

## Capability check programmatico

```typescript
const capService = broker.getService('capabilities');

const hasCapability = capService.has('user.read'); // boolean
const provider = capService.getProvider('user.read'); // 'auth-v1' o null
const consumers = capService.getConsumers('user.read'); // ['cart', 'header', ...]
```

## Decisioni v2.0 lockate

- **D-V2-F11-cap-01** — First-wins semantics per duplicate capability.
- **D-V2-F11-cap-02** — `microfrontend.capability.missing` + `microfrontend.capability.duplicate`
  come topic single point.
- **D-V2-F12-cap-01** — Default policy `block-mount` per missing required capability.

## Riferimenti

- [PRD §22 — Capabilities](../../prd_2.0.0.md)
- [README @gluezero/permissions](../../packages/permissions/README.md)
- [08 — Permissions](./08-permissions.md)
- [10 — Compat / Versioning](./10-compat-versioning.md)
