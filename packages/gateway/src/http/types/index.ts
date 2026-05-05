// Barrel del package `@gluezero/gateway/http/types`.
//
// I 3 type-file (`gateway-config`, `http-strategies`, `http-error`) sono type-only.
// L'unica eccezione runtime è `isGatewayErrorCode` (type guard set-based, pattern
// identico a `isMappingErrorCode` di F2) — esportato come runtime function dal barrel.

export type * from './gateway-config'
export type * from './http-error'
export { isGatewayErrorCode } from './http-error'
export type * from './http-strategies'
