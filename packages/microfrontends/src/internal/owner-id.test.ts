import { describe, expect, it } from 'vitest'
import { MF_OWNER_PREFIX, mfOwnerId } from './owner-id'

describe('mfOwnerId — D-V2-16 convention', () => {
  it('builds ownerId nel formato "mf:<id>" (D-V2-16)', () => {
    expect(mfOwnerId('customer-dashboard')).toBe('mf:customer-dashboard')
  })

  it('preserva id che contengono dots', () => {
    expect(mfOwnerId('app.v2.beta')).toBe('mf:app.v2.beta')
  })

  it('preserva id che contengono hyphens', () => {
    expect(mfOwnerId('my-mf-2')).toBe('mf:my-mf-2')
  })

  it('MF_OWNER_PREFIX const espone literal "mf:"', () => {
    expect(MF_OWNER_PREFIX).toBe('mf:')
  })
})
