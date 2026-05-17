/**
 * `ModuleFederationLoaderDefinition` — Type narrowing F8 `MicroFrontendLoaderDefinition`
 * con `type: 'module-federation'` discriminator literal + campi MF-specific.
 *
 * Experimental @0.x.0 V2.0 GA (D-V2-23 lockato). webpack-only (D-V2-F15-09);
 * rsbuild/vite deferred V2.1.
 *
 * @see D-V2-F15-09 — webpack-only V2.0 GA
 * @see D-V2-F15-10 — Share scope conflict warn + proceed
 * @see PRD §24 — Module Federation Loader (experimental @0.x.0)
 */
import type { MicroFrontendLoaderDefinition } from '@gluezero/microfrontends'

/**
 * Loader definition narrowing per `type: 'module-federation'`.
 *
 * W2 P04 fill: contract completo + JSDoc per ognuno dei field.
 *
 * @example Descriptor MF webpack 5
 * ```ts
 * await broker.registerMicroFrontend({
 *   id: 'analytics-mf',
 *   name: 'Analytics (Module Federation)',
 *   version: '1.0.0',
 *   loader: {
 *     type: 'module-federation',
 *     scope: 'analytics_app',
 *     module: './AnalyticsWidget',
 *     url: 'https://cdn.example.com/analytics/remoteEntry.js',
 *     shared: { react: { requiredVersion: '^18.2', singleton: true } },
 *     timeoutMs: 10000,
 *   } satisfies ModuleFederationLoaderDefinition,
 * })
 * ```
 */
export interface ModuleFederationLoaderDefinition extends MicroFrontendLoaderDefinition {
  /** Discriminator literal — narrowing TS. */
  readonly type: 'module-federation'

  /** Nome scope remote (es. `'analytics_app'`). */
  readonly scope: string

  /** Path module dentro lo scope (es. `'./AnalyticsWidget'`). */
  readonly module: string

  /** URL `remoteEntry.js` webpack 5 formato. */
  readonly url: string

  /**
   * Share scope config (carryover webpack MF default). Conflitto version → warn + proceed
   * (D-V2-F15-10) + emit topic `microfrontend.mf.share.version-mismatch`.
   *
   * Esempio: `{react: {requiredVersion: '^18.2', singleton: true}}`.
   */
  readonly shared?: Record<
    string,
    {
      readonly requiredVersion?: string
      readonly singleton?: boolean
      readonly eager?: boolean
    }
  >

  /**
   * Override export name esplicito per Strategy 1 (D-V2-F9-05 carryover F9). Se omesso,
   * priority degrade a `default` export → named exports flat.
   */
  readonly exportName?: string

  /**
   * Timeout `loadRemote` race in millisecondi (default 15000 — carryover F9 PRD §23.4).
   */
  readonly timeoutMs?: number
}
