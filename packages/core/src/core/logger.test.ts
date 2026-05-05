import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createConsoleLogger, silentLogger } from './logger'

describe('createConsoleLogger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let infoSpy: ReturnType<typeof vi.spyOn>
  let debugSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.restoreAllMocks()
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  it('respects the info level: info/warn/error invoked, debug/trace not', () => {
    const logger = createConsoleLogger('info')
    logger.error('e')
    logger.warn('w')
    logger.info('i')
    logger.debug('d')
    logger.trace('t')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('silent level: no console method invoked at all', () => {
    const logger = createConsoleLogger('silent')
    logger.error('e')
    logger.warn('w')
    logger.info('i')
    logger.debug('d')
    logger.trace('t')
    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(infoSpy).not.toHaveBeenCalled()
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('error level: only error invoked', () => {
    const logger = createConsoleLogger('error')
    logger.error('e')
    logger.warn('w')
    logger.info('i')
    logger.debug('d')
    logger.trace('t')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).not.toHaveBeenCalled()
    expect(infoSpy).not.toHaveBeenCalled()
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('trace level: all methods invoked (debug + trace both → console.debug)', () => {
    const logger = createConsoleLogger('trace')
    logger.error('e')
    logger.warn('w')
    logger.info('i')
    logger.debug('d')
    logger.trace('t')
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy).toHaveBeenCalledTimes(1)
    // debug AND trace both go to console.debug (D-12)
    expect(debugSpy).toHaveBeenCalledTimes(2)
  })

  it('includes [gluezero] namespace prefix as first arg', () => {
    const logger = createConsoleLogger('info')
    logger.info('hello')
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[gluezero]'), 'hello')
  })

  it('passes meta as third arg when provided', () => {
    const logger = createConsoleLogger('info')
    logger.info('hello', { key: 'value' })
    expect(infoSpy).toHaveBeenCalledWith(expect.any(String), 'hello', { key: 'value' })
  })

  it('passes only 2 args when meta absent', () => {
    const logger = createConsoleLogger('info')
    logger.info('hello')
    const callArgs = infoSpy.mock.calls[0]
    expect(callArgs).toBeDefined()
    expect(callArgs?.length).toBe(2)
  })

  it('trace uses console.debug with TRACE prefix (D-12)', () => {
    const logger = createConsoleLogger('trace')
    logger.trace('msg')
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('TRACE'), 'msg')
  })

  it('default level is info when not specified', () => {
    const logger = createConsoleLogger()
    logger.info('i')
    logger.debug('d')
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(debugSpy).not.toHaveBeenCalled()
  })
})

describe('silentLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('all 5 methods are no-ops that do not throw', () => {
    expect(() => silentLogger.error('x')).not.toThrow()
    expect(() => silentLogger.warn('x')).not.toThrow()
    expect(() => silentLogger.info('x')).not.toThrow()
    expect(() => silentLogger.debug('x')).not.toThrow()
    expect(() => silentLogger.trace('x')).not.toThrow()
  })

  it('does not invoke console methods', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    silentLogger.error('x')
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
