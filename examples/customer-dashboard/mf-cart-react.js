/**
 * Cart MF — React MicroFrontend via @gluezero/react.
 *
 * Usa `createReactMicroFrontendLifecycle` (D-V2-F17-04) per produrre il bundle
 * lifecycle `{bootstrap, mount, unmount, destroy}` compatibile
 * MicroFrontendRuntimeModule F8.
 *
 * Hook usati:
 *   - useGlueZeroPublish    → publica `cart.added` con metadata.microFrontendId
 *     auto-iniettato dal Provider context (MF-OBS-01 facade).
 *   - useGlueZeroSubscribe  → cleanup automatico via useEffect (StrictMode-safe).
 *
 * Governance attiva (vedi host.js):
 *   - permissionsModule policy `cart-mf` allow `cart.*` deny `payment.*`.
 *
 * @see ../microfrontends/mf-react-adapter.html — variante minimal standalone.
 */
import {
  createReactMicroFrontendLifecycle,
  useGlueZeroPublish,
  useGlueZeroSubscribe,
} from '@gluezero/react'
import React from 'react'

function CartUI() {
  const publish = useGlueZeroPublish()
  const [items, setItems] = React.useState([])

  useGlueZeroSubscribe('cart.added', (event) => {
    setItems((prev) => [...prev, event.payload])
  })

  return React.createElement(
    'div',
    null,
    React.createElement(
      'button',
      {
        onClick: () =>
          publish('cart.added', {
            sku: 'SKU-' + Date.now().toString(36).slice(-5),
            qty: 1,
          }),
      },
      'Add to cart',
    ),
    React.createElement(
      'ul',
      { style: { marginTop: '0.5rem' } },
      items.map((item, idx) =>
        React.createElement(
          'li',
          { key: idx },
          `${item.sku} × ${item.qty ?? 1}`,
        ),
      ),
    ),
  )
}

const lifecycle = createReactMicroFrontendLifecycle(CartUI)
export const { bootstrap, mount, unmount, destroy } = lifecycle
