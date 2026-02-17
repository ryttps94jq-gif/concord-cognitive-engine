# ADR-002: Structured Error Handling Strategy

| Field       | Value                     |
|-------------|---------------------------|
| Status      | Accepted                  |
| Date        | 2026-02-17                |
| Authors     | Core Team                 |
| Supersedes  | N/A                       |

## Context

The backend used generic `try/catch` blocks with `String(e?.message || e)` for
error conversion. This lost error context, made debugging difficult in production,
and left ~60% of async route handlers without any error handling (relying on
Express 4's default behavior which silently drops async rejections).

## Decision

1. **Custom error hierarchy** (`server/lib/errors.js`) — `ConcordError` base
   class with typed subclasses: `ValidationError`, `AuthenticationError`,
   `AuthorizationError`, `NotFoundError`, `ConflictError`, `RateLimitError`,
   `ServiceUnavailableError`, `DatabaseError`.

2. **`asyncHandler` wrapper** (`server/lib/async-handler.js`) — wraps async
   route handlers so rejected promises are forwarded to Express error middleware.

3. **Central error middleware** — converts `ConcordError` instances into
   structured JSON responses with appropriate HTTP status codes.

## Consequences

### Positive
- Every async route handler is now protected against unhandled rejections.
- Error responses are consistent: `{ ok: false, error, code, requestId }`.
- Stack traces appear in server logs but never in client responses.
- Error types can be matched in catch blocks for specific handling.

### Negative
- Existing code must be incrementally wrapped with `asyncHandler`.
- Custom error types add a small learning curve for contributors.
