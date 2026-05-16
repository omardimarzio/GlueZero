/**
 * Customer Dashboard — Host bootstrap (Livello C governance full stack).
 *
 * Installa 9 modules (1 core + 3 loaders + 5 governance) e registra 3 MF mixed:
 *   - cart-mf       — React MF via @gluezero/react (createReactMicroFrontendLifecycle)
 *   - recs-mf       — Web Component MF via @gluezero/web-components (GlueZeroElement)
 *   - analytics-mf  — iframe MF via @gluezero/mf-iframe (bridge handshake F15)
 *
 * 5 governance feature attivi:
 *   1. permissionsModule  → ACL allow/deny per topic (Cart MF NO payment.*)
 *   2. compatModule       → semver compat host v2.0 + policy block-mount
 *   3. isolationModule    → per-MF override (recs-mf shadow-dom, others mount-root)
 *   4. fallbacksModule    → event-based dispatch onMountError + onRuntimeError
 *   5. mfInspectorModule  → live HTML panel con 17 fields + 14 metrics per-MF
 *
 * Inspector panel refresh 1s via setInterval — getDebugSnapshot() + getMetrics().
 *
 * @see ./README.md           — quick run + 3 MF descrizione + governance description
 * @see ./walkthrough-A-B-C.md — migration evolution Livello A → B → C
 * @see ../microfrontends/mf-react-adapter.html   — variante minimal solo React
 * @see ../microfrontends/mf-permissions-demo.html — variante minimal solo permissions
 */
import { createBroker } from '@gluezero/core'
import { microFrontendModule } from '@gluezero/microfrontends'
import { mfEsmModule } from '@gluezero/mf-esm'
import { mfWebComponentModule } from '@gluezero/mf-web-component'
import { mfIframeModule } from '@gluezero/mf-iframe'
import { permissionsModule } from '@gluezero/permissions'
import { compatModule } from '@gluezero/compat'
import { isolationModule } from '@gluezero/isolation'
import { fallbacksModule } from '@gluezero/fallbacks'
import { mfInspectorModule } from '@gluezero/devtools/mf-inspector'

// ============================================================
// 1. Broker bootstrap Livello C — 9 modules.
// ============================================================
const broker = createBroker({
  modules: [
    // Core MF + 3 loaders.
    microFrontendModule(),
    mfEsmModule(),
    mfWebComponentModule(),
    mfIframeModule(),

    // 5 governance feature.
    permissionsModule({
      policies: {
        'cart-mf': { allow: ['cart.*', 'system.warmup'], deny: ['payment.*'] },
        'recs-mf': { allow: ['recommendation.*', 'cart.added'], deny: ['*.admin'] },
        'analytics-mf': {
          allow: ['analytics.*', 'cart.added', 'recommendation.*'],
          deny: [],
        },
      },
    }),
    compatModule({
      hostVersion: '2.0.0',
      policy: 'block-mount',
    }),
    isolationModule({
      default: 'mount-root',
      perMfOverride: {
        'recs-mf': 'shadow-dom',
      },
    }),
    fallbacksModule({
      onMountError: 'event',
      onRuntimeError: 'event',
    }),
    mfInspectorModule(),
  ],
})

// ============================================================
// 2. Inspector live panel (refresh 1s).
// ============================================================
const inspectorEl = document.getElementById('inspector')

function refreshInspector() {
  try {
    const snapshot =
      typeof broker.getDebugSnapshot === 'function' ? broker.getDebugSnapshot() : null
    const metrics = typeof broker.getMetrics === 'function' ? broker.getMetrics() : null

    const view = {
      microFrontends: snapshot?.microFrontends ?? [],
      metricsMf: metrics?.microFrontends ?? [],
      topicsSample: (snapshot?.topics ?? []).slice(0, 5),
      timestamp: new Date().toISOString(),
    }
    inspectorEl.textContent = JSON.stringify(view, null, 2)
  } catch (e) {
    inspectorEl.textContent = 'Inspector error: ' + String(e)
  }
}

setInterval(refreshInspector, 1000)
refreshInspector()

// ============================================================
// 3. Register 3 MF (React + WC + iframe).
// ============================================================
// API: `broker.registerMicroFrontend(descriptor)` — monkey-patched da
// microFrontendModule() (vedi packages/microfrontends/src/microfrontend-module.ts).
try {
  await broker.registerMicroFrontend({
    id: 'cart-mf',
    name: 'Cart MF',
    version: '2.0.0',
    loader: { type: 'esm', url: './mf-cart-react.js' },
    mount: { target: '#mf-cart' },
  })

  await broker.registerMicroFrontend({
    id: 'recs-mf',
    name: 'Recommendations MF',
    version: '2.0.0',
    loader: {
      type: 'web-component',
      tagName: 'recs-mf-element',
      url: './mf-recommendations-wc.js',
    },
    mount: { target: '#mf-recs' },
  })

  await broker.registerMicroFrontend({
    id: 'analytics-mf',
    name: 'Analytics MF',
    version: '2.0.0',
    loader: {
      type: 'iframe',
      url: './mf-analytics-iframe.html',
      expectedOrigin: location.origin,
    },
    mount: { target: '#mf-analytics' },
  })
} catch (err) {
  console.error('Customer Dashboard registration failed:', err)
}

console.log('Customer Dashboard ready — 3 MF + 9 modules governance attivi.')

// Expose for debug in devtools.
window.__gluezero = { broker }
