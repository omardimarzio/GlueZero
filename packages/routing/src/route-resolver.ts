// route-resolver.ts — RED phase stub. GREEN replacement in commit successivo.
// Test deve fallire: le API non sono implementate.

export interface CompiledRoute {
  readonly id: string
  readonly definition: unknown
  readonly ownerId: string | undefined
  readonly priority: number
  readonly requestBuilder?: (canonicalPayload: unknown) => unknown
}

export interface RouteRegistration {
  readonly id: string
  unregister(): void
}

export interface AmbiguousRouteEvent {
  readonly topic: string
  readonly candidateRouteIds: readonly string[]
  readonly selectedRouteId: string
}

export interface RouteResolverOptions {
  readonly strict?: boolean
  readonly onAmbiguousRoutes?: (event: AmbiguousRouteEvent) => void
}

export class RouteResolver {
  // RED stub — costruttore presente per compilation, metodi NON implementati
  constructor(_options: RouteResolverOptions = {}) {
    void _options
  }
  register(_def: unknown, _options: { ownerId?: string } = {}): RouteRegistration {
    void _def
    void _options
    throw new Error('RouteResolver.register: not implemented (RED phase)')
  }
  unregister(_routeId: string): boolean {
    void _routeId
    return false
  }
  unregisterByOwner(_ownerId: string): readonly string[] {
    void _ownerId
    return []
  }
  resolve(_topic: string, _policy?: string): readonly CompiledRoute[] {
    void _topic
    void _policy
    return []
  }
  countByOwner(_ownerId: string): number {
    void _ownerId
    return 0
  }
  list(): readonly CompiledRoute[] {
    return []
  }
}
