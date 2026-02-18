# ADR-001: Intentional Monolith Architecture

| Field       | Value                     |
|-------------|---------------------------|
| Status      | Accepted                  |
| Date        | 2024-06-15                |
| Authors     | Core Team                 |
| Supersedes  | N/A                       |

## Context

Concord Cognitive Engine is a local-first cognitive operating system with 40+ API
endpoints, 24 domain modules, 45+ emergent system modules, and a macro-driven
architecture. The server codebase must be:

1. **Atomically deployable** — no version mismatches between modules.
2. **Auditable in full** — open source visibility into all logic paths.
3. **IP-defensible** — interconnected logic creates a natural barrier against casual forking.
4. **Low-ops** — single process to deploy, monitor, and debug.

## Decision

The backend is structured as an **intentional monolith** in a single entry point
(`server.js`) supported by domain-specific modules in `loaf/`, `emergent/`,
`domains/`, and `affect/`.

Business logic is expressed as **macros** registered in a central macro registry,
keeping the server file as a thin routing and middleware layer.

## Consequences

### Positive
- **Zero module version drift** — one deploy, one version, always consistent.
- **Simple debugging** — single process, `structuredLog` covers the entire
  request lifecycle.
- **Low infrastructure cost** — runs on a single $5/mo VPS.
- **Fast cold start** — no service mesh, no RPC overhead.

### Negative
- **Large file size** — `server.js` exceeds 35K lines. Mitigated by ongoing
  route extraction into `server/routes/` modules.
- **Contributor onboarding** — requires IDE with good search. Mitigated by
  JSDoc annotations and the `types.d.ts` definitions file.
- **Testing isolation** — tests must mock or boot the full server.
  Mitigated by unit-testable macro functions separated from Express routes.

### Mitigation Plan
Route extraction is an ongoing effort (see recent commits reducing server.js from
36,728 to 35,539 lines). The target is thin routing in `server.js` with all
business logic in domain modules.

## Alternatives Considered

| Alternative        | Rejected Because                                     |
|--------------------|------------------------------------------------------|
| Microservices      | Operational overhead incompatible with local-first    |
| Module federation  | Runtime complexity, harder to audit                   |
| Multi-file routes  | Partially adopted — route extraction is in progress   |
