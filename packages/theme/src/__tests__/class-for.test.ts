import { describe, expect, it } from 'vitest'
import { classFor } from '../class-for'

const adapter = {
  id: 'tailwind',
  roleMap: {
    'action.primary': 'bg-indigo-600 text-white px-4 py-2 rounded',
    'feedback.error': 'text-red-600',
  },
}
const adapterNoMap = { id: 'minimal' }

describe('classFor (Strategia C — escape hatch)', () => {
  it('returns mapped class string for known role', () => {
    expect(classFor(adapter, 'action.primary')).toBe(
      'bg-indigo-600 text-white px-4 py-2 rounded',
    )
  })

  it('returns empty string for unknown role (no throw — D-F7-17)', () => {
    expect(classFor(adapter, 'unknown.role')).toBe('')
  })

  it('returns empty string when adapter has no roleMap', () => {
    expect(classFor(adapterNoMap, 'action.primary')).toBe('')
  })

  it('returns empty string when adapter is null', () => {
    expect(classFor(null, 'action.primary')).toBe('')
  })
})
