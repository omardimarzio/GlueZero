/**
 * Custom fallback renderer (D-V2-F14-15).
 *
 * `await handler(error, ctx)` con try/catch:
 * - Success: `fallbackType:'custom'`.
 * - Throw o reject: console.error + `fallbackType:'custom-failed'`.
 *
 * `ctx` = `MicroFrontendRuntimeContext` F10 opt (facades F13 storage/gateway/worker/theme).
 *
 * `result instanceof Promise` check evita `await` su valori sync (micro-perf).
 *
 * @see D-V2-F14-15 — Custom handler await + catch
 * @see prd_2.0.0.md §29.3 — type:'custom' handler signature
 */
import type { MicroFrontendError } from '../microfrontend-error.js'

export interface CustomRenderResult {
  readonly applied: true
  readonly fallbackType: 'custom' | 'custom-failed'
}

/**
 * Invoca handler custom user-provided con try/catch + Promise unwrap.
 *
 * Handler signature: `(err, ctx) => void | Promise<void>`. Handler può:
 * - Mutare DOM direttamente (es. document.querySelector + innerHTML).
 * - Chiamare facade su `ctx` (storage/gateway/worker/theme F10-F13).
 * - Throw sincrono o rejected Promise → catch + console.error + fallbackType:'custom-failed'.
 *
 * @param handler Function user-provided da `FallbackDefinition.handler`.
 * @param error MicroFrontendError class o shape minimale `{message}` — passato come 1° arg.
 * @param ctx MicroFrontendRuntimeContext F10 opt (placeholder type unknown — F10 augment
 *   espone shape reale). Passato come 2° arg al handler.
 * @returns Promise<RenderResult> con `applied: true` + `fallbackType: 'custom' | 'custom-failed'`.
 */
export async function renderCustomFallback(
  handler: (err: unknown, ctx: unknown) => void | Promise<void>,
  error: MicroFrontendError | { message: string },
  ctx: unknown,
): Promise<CustomRenderResult> {
  try {
    const result = handler(error, ctx)
    if (result instanceof Promise) await result
    return { applied: true, fallbackType: 'custom' }
  } catch (err) {
    // biome-ignore lint/suspicious/noConsole: dev error intentional (handler throw)
    console.error('[fallbacks] custom handler failed', err)
    return { applied: true, fallbackType: 'custom-failed' }
  }
}
