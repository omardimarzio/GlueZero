# Security Policy

## Supported versions

GlueZero follows semantic versioning. Security fixes are backported to the latest minor of the current major.

| Version | Supported |
|---------|-----------|
| 1.x.x   | ✅        |
| < 1.0   | ❌ (pre-release) |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately via one of:

- **GitHub Security Advisories** — preferred. Open a draft advisory at https://github.com/omardimarzio/GlueZero/security/advisories/new
- **Email** — `security@<TBD>` (replace with actual contact once domain is registered)

Include:

1. Affected package(s) and version range
2. Reproduction steps or PoC code
3. Impact assessment (what an attacker can achieve)
4. Suggested fix or mitigation, if any

You should receive an acknowledgement within **72 hours**. We will work with you on a coordinated disclosure timeline; expect a fix within **14 days** for high-severity issues, longer for low-impact ones.

## Threat model

GlueZero is **browser-side only**. The threat model assumes:

- The host application is trusted (GlueZero does not protect against malicious code running in the same realm).
- Network calls go through user-defined routes; URL allowlisting (D-71) is the primary mitigation against arbitrary fetch destinations.
- Worker isolation relies on the browser's structured-clone boundary; payload integrity is enforced by `assertSerializable` (D-139/D-140) in dev mode.
- Cache scope isolation (D-156/D-157) is the primary mitigation against cross-tenant data leakage; the missing-scope behavior is fail-secure (cache miss + audit event).

What is **out of scope**:

- Server-side attacks (GlueZero does not run on the server)
- Application-level authentication / authorization (the consumer wires this via `AuthStrategy`)
- Browser engine vulnerabilities

## Hardening recommendations for consumers

When adopting GlueZero in production:

1. **Enable URL allowlist** (`HttpGateway.allowlist`, D-71) — restrict which hosts your routes can reach.
2. **Configure scoped cache** (`BrokerConfig.cache.scopeProvider`, D-156) — for any multi-tenant or per-user data.
3. **Keep `debug: false` in production** — `getDebugSnapshot` and `EventInspector` capture full payloads; only enable for diagnostics behind a flag.
4. **Set realistic timeouts and retry caps** — default policies are conservative; align them with your back-end SLA.
5. **Audit `taps`** — third-party EventTap plugins receive the full event lifecycle. Treat them as privileged.

## Security-relevant decisions

The following decisions in [`DECISIONS.md`](./DECISIONS.md) are most relevant for security review:

- **D-71** — URL allowlist + post-redirect re-validation (SEC-05)
- **D-72** — `AuthStrategy` Bearer with single-flight token refresh
- **D-141** — Transferable opt-in via JSONPath (prevents accidental ownership transfer)
- **D-156 / D-157** — Cache scope hybrid + fail-secure on missing scope
- **D-162** — `getDebugSnapshot` deep-clone via `structuredClone` (no live state leak)
- **D-166** — Cardinality cap on metric labels (DoS protection)
