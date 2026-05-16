/**
 * Recommendations MF — Web Component MicroFrontend via @gluezero/web-components.
 *
 * Estende `GlueZeroElement` (D-V2-F17-05/06): cleanup automatico via
 * AbortController + signal in `disconnectedCallback`, context wiring via property
 * assignment (`this.glueZeroBroker = broker` post-mount dal WC loader F15).
 *
 * Helper usati:
 *   - this.subscribe(topic, handler)  → wrap broker.subscribe con signal +
 *     auto-iniezione `metadata.microFrontendId` (MF-OBS-01 facade).
 *
 * Governance attiva (vedi host.js):
 *   - permissionsModule policy `recs-mf` allow `recommendation.* + cart.added`
 *     deny `*.admin`.
 *   - isolationModule perMfOverride `recs-mf → shadow-dom` (visivo + style scope).
 *
 * @see ../microfrontends/mf-shadow-dom.html — variante minimal isolation standalone.
 */
import { GlueZeroElement } from '@gluezero/web-components'

class RecsMfElement extends GlueZeroElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; padding: 8px; font-family: system-ui, sans-serif; }
        h3 { margin: 0 0 8px; color: #475569; font-size: 1rem; }
        ul { padding-left: 1rem; margin: 0; }
        li { margin: 4px 0; font-size: 0.9rem; color: #0F172A; }
        .empty { color: #94A3B8; font-style: italic; font-size: 0.85rem; }
      </style>
      <h3>Top picks</h3>
      <ul id="list">
        <li class="empty">No recommendations yet — add items to cart.</li>
      </ul>
    `
  }

  /**
   * onContextReady — invocato dal setter `glueZeroBroker` quando il host
   * inietta il broker (property-mode wiring D-V2-F17-06).
   */
  onContextReady() {
    const listEl = this.shadowRoot.getElementById('list')
    let initial = true

    this.subscribe('cart.added', (event) => {
      if (initial) {
        listEl.innerHTML = ''
        initial = false
      }
      const li = document.createElement('li')
      const sku = event.payload?.sku ?? 'unknown'
      li.textContent = `Hai aggiunto ${sku} — prova anche ${sku}-similar`
      listEl.appendChild(li)
    })
  }
}

customElements.define('recs-mf-element', RecsMfElement)
