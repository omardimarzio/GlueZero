import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDomApplier } from '../dom-applier'
import { createClassesTracker } from '../internal/weakmap-classes'

const tailwind = {
  id: 'tailwind',
  roleMap: {
    'action.primary': 'bg-indigo-600 text-white',
    'feedback.error': 'text-red-600',
  },
}
const bootstrap = {
  id: 'bootstrap5',
  roleMap: {
    'action.primary': 'btn btn-primary',
  },
}

/**
 * Helper: flush microtasks + RIC fallback (setTimeout 0) for batching.
 * jsdom non implementa requestIdleCallback, quindi il fallback usa setTimeout(0).
 */
async function flushAll(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('createDomApplier (Strategia A)', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    root.setAttribute('data-test-root', '')
    document.body.appendChild(root)
  })

  afterEach(() => {
    if (root.parentNode != null) document.body.removeChild(root)
  })

  it('exposes scan/setAdapter/dispose', () => {
    const tracker = createClassesTracker()
    const a = createDomApplier({
      adapter: tailwind,
      classesTracker: tracker,
      observerRoot: root,
    })
    expect(typeof a.scan).toBe('function')
    expect(typeof a.setAdapter).toBe('function')
    expect(typeof a.dispose).toBe('function')
    a.dispose()
  })

  it('initial scan applies classes to pre-existing nodes', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(true)
    expect(btn.classList.contains('text-white')).toBe(true)
    a.dispose()
  })

  it('newly added node receives classes via MutationObserver', async () => {
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(true)
    a.dispose()
  })

  it('changing data-gz-role attribute swaps classes', async () => {
    const btn = document.createElement('span')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(true)
    btn.setAttribute('data-gz-role', 'feedback.error')
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(false)
    expect(btn.classList.contains('text-red-600')).toBe(true)
    a.dispose()
  })

  it('data-gz-skip-observer is ignored', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    btn.setAttribute('data-gz-skip-observer', '')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(false)
    a.dispose()
  })

  it('setAdapter swaps classes atomically (Q5 queueMicrotask)', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(true)
    a.setAdapter(bootstrap)
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(false)
    expect(btn.classList.contains('btn')).toBe(true)
    expect(btn.classList.contains('btn-primary')).toBe(true)
    a.dispose()
  })

  it('role unknown in adapter roleMap: no class applied (no throw)', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'orphan.role')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    expect(btn.className).toBe('')
    a.dispose()
  })

  it('null adapter: no classes applied', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: null, observerRoot: root })
    await flushAll()
    expect(btn.className).toBe('')
    a.dispose()
  })

  it('dispose disconnects observer + cleans tracker', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    a.dispose()
    // After dispose, mutating DOM does NOT trigger track
    const btn2 = document.createElement('button')
    btn2.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn2)
    await flushAll()
    expect(btn2.className).toBe('')
  })

  it('observerRoot scope limit: nodes outside scope ignored', async () => {
    const inside = document.createElement('button')
    inside.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(inside)
    const outside = document.createElement('button')
    outside.setAttribute('data-gz-role', 'action.primary')
    document.body.appendChild(outside)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    expect(inside.classList.contains('bg-indigo-600')).toBe(true)
    expect(outside.classList.contains('bg-indigo-600')).toBe(false)
    a.dispose()
    document.body.removeChild(outside)
  })

  it('removed node: tracker restore called (cleanup)', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const a = createDomApplier({ adapter: tailwind, observerRoot: root })
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(true)
    root.removeChild(btn)
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(false)
    a.dispose()
  })
})
