/**
 * `iframeLoader` — Skeleton stub factory F15 W1 — sblocca F13 IframeAdapter contract.
 *
 * Implementazione W2 Plan 15-03 (D-V2-09 BLOCKING closure):
 * - iframe creation + sandbox apply (REQ MF-SEC-01).
 * - bridge handshake `gz:handshake` → `gz:ready` 9-step state machine.
 * - Valibot `v.strictObject` validation 9 message types (D-V2-F15-01).
 * - LRU dedup 500 per (origin, mfId) (D-V2-F15-02).
 * - Replay mitigation ID + timestamp 30s (D-V2-F15-03).
 * - Rate limit 100 msg/s drop + emit topic (D-V2-F15-04).
 * - `expectedOrigin` MANDATORY enforcement (REQ MF-IFRAME-04).
 * - `targetOrigin '*'` BAN runtime assert (REQ MF-IFRAME-04).
 * - `IframeAdapter.createSandbox(policy, mfId, mount)` duck-typing F13 sblocco
 *   (D-V2-F15-21).
 *
 * Pattern factory (ritorna adapter) anziché const singleton perché esposto come
 * `iframeLoader: () => adapter` per F13 `IsolationResolvers.iframeLoader?.()` lookup
 * (`packages/isolation/src/iframe-stub.ts:41-47`).
 *
 * @see D-V2-F15-01..04 — Security gates D-V2-09 closure
 * @see D-V2-F15-21 — IframeAdapter.createSandbox contract F13 sblocco
 * @see REQ MF-IFRAME-04 — expectedOrigin MANDATORY + targetOrigin '*' BANNED
 * @see packages/isolation/src/iframe-stub.ts (F13 contract reference)
 */
import type {
  LoaderContext,
  LoadedModule,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
} from '@gluezero/microfrontends'

/**
 * Factory iframe loader — ritorna `MicroFrontendLoaderAdapter` + duck-typing
 * IframeAdapter (`createSandbox` method) per sblocco F13.
 *
 * Skeleton stub W1 — body W2 P03 implementation.
 *
 * @throws `MfIframeError` con code in `MfIframeErrorCode` union su security gate violation.
 */
export function iframeLoader(): MicroFrontendLoaderAdapter {
  return {
    type: 'iframe',
    async load(
      _definition: MicroFrontendLoaderDefinition,
      _ctx: LoaderContext,
    ): Promise<LoadedModule> {
      throw new Error(
        'TODO W2 P03 — iframeLoader implementation D-V2-09 closure (Valibot strict + LRU + rate-limit + replay + expectedOrigin + targetOrigin ban + sandbox + handshake)',
      )
    },
  }
}
