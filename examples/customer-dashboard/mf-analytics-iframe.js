/**
 * Analytics MF — iframe MicroFrontend page script.
 *
 * Eseguito DENTRO l'iframe sandbox (F15 `@gluezero/mf-iframe` loader).
 * Riceve eventi dal host via `window.postMessage` con origin validation
 * delegata al bridge handshake F15 (expectedOrigin verificato lato parent).
 *
 * Protocollo messaggi:
 *   - In: { type: 'gluezero.broker.event', topic, payload, metadata, source }
 *   - Out: { type: 'gluezero.iframe.ready', mfId }  (handshake ready signal)
 *
 * @see ../microfrontends/mf-iframe-sandbox.html — variante minimal standalone F15.
 */
const eventsEl = document.getElementById('events')
eventsEl.innerHTML = ''

let firstEvent = true

window.addEventListener('message', (e) => {
  // F15 bridge handshake fornisce validated messages — l'origin check è
  // delegato al parent-side (expectedOrigin in descriptor.loader).
  if (!e.data || typeof e.data !== 'object' || !e.data.topic) return

  if (firstEvent) {
    eventsEl.innerHTML = ''
    firstEvent = false
  }

  const line = document.createElement('div')
  const ts = new Date().toISOString().substring(11, 19)
  const payload = e.data.payload === undefined ? '{}' : JSON.stringify(e.data.payload)
  line.textContent = `[${ts}] ${e.data.topic} — ${payload}`
  eventsEl.appendChild(line)
  eventsEl.scrollTop = eventsEl.scrollHeight
})

// Handshake ready — segnala al parent che l'iframe ha caricato e sta ascoltando.
window.parent.postMessage(
  { type: 'gluezero.iframe.ready', mfId: 'analytics-mf' },
  '*',
)
