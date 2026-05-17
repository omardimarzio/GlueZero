/**
 * Tier-1 jsdom — `bridge-schemas.ts` Valibot strict 9 schemas + variant union
 * (D-V2-F15-01 closure — T-15-02 schema injection mitigation).
 */
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { BridgeMessageSchema } from '../bridge-schemas'

function baseEnvelope(type: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'msg-test-1',
    microFrontendId: 'mf-x',
    timestamp: 1700000000000,
    type,
    payload,
  }
}

describe('bridge-schemas — Valibot v.strictObject 9 schemas (D-V2-F15-01)', () => {
  it('gz:handshake — happy path valid', () => {
    const msg = baseEnvelope('gz:handshake', {
      protocolVersion: 'gz:bridge/1.0',
      expectedHostOrigin: 'https://host.example.com',
    })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(true)
  })

  it('gz:ready — happy path con capabilities optional', () => {
    const msg = baseEnvelope('gz:ready', {
      protocolVersion: 'gz:bridge/1.0',
      capabilities: ['publish', 'subscribe'],
    })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(true)
  })

  it('gz:publish — happy path topic + data', () => {
    const msg = baseEnvelope('gz:publish', {
      topic: 'user.action',
      data: { action: 'click', x: 100 },
    })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(true)
  })

  it('gz:subscribe — happy path topic + subscriptionId', () => {
    const msg = baseEnvelope('gz:subscribe', {
      topic: 'theme.changed',
      subscriptionId: 'sub-1',
    })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(true)
  })

  it('gz:error — happy path code + message', () => {
    const msg = baseEnvelope('gz:error', {
      code: 'CLIENT_ERR_42',
      message: 'failure inside iframe',
    })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(true)
  })

  it('gz:lifecycle — happy path phase + status', () => {
    const msg = baseEnvelope('gz:lifecycle', {
      phase: 'mount',
      status: 'completed',
    })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(true)
  })

  it('reject — unknown extra field foo → strict reject (D-V2-F15-01 T-15-01)', () => {
    const msg = {
      ...baseEnvelope('gz:publish', { topic: 't', data: null }),
      foo: 'bar', // EXTRA FIELD unknown
    }
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(false)
  })

  it('reject — missing timestamp', () => {
    const msg: Record<string, unknown> = {
      id: 'm1',
      microFrontendId: 'mf-x',
      type: 'gz:publish',
      payload: { topic: 't', data: null },
    }
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(false)
  })

  it('reject — missing microFrontendId', () => {
    const msg: Record<string, unknown> = {
      id: 'm1',
      timestamp: 1700000000000,
      type: 'gz:publish',
      payload: { topic: 't', data: null },
    }
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(false)
  })

  it('reject — wrong protocolVersion in handshake', () => {
    const msg = baseEnvelope('gz:handshake', {
      protocolVersion: 'WRONG_VERSION',
      expectedHostOrigin: 'https://host.example.com',
    })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(false)
  })

  it('reject — empty id (minLength 1)', () => {
    const msg = {
      id: '',
      microFrontendId: 'mf-x',
      timestamp: 1700000000000,
      type: 'gz:publish',
      payload: { topic: 't', data: null },
    }
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(false)
  })

  it('reject — negative timestamp', () => {
    const msg = {
      id: 'm1',
      microFrontendId: 'mf-x',
      timestamp: -1,
      type: 'gz:publish',
      payload: { topic: 't', data: null },
    }
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(false)
  })

  it('reject — unknown discriminator type', () => {
    const msg = baseEnvelope('gz:nonexistent', { foo: 1 })
    const result = v.safeParse(BridgeMessageSchema, msg)
    expect(result.success).toBe(false)
  })
})
