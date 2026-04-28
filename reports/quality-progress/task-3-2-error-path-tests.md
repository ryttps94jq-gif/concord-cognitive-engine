# Task 3.2: Error Path Coverage Tests

**Date:** 2026-04-28  
**File:** `server/tests/error-paths.test.js`

---

## Summary

Created 21 error path tests across 7 `describe` groups covering server behavior under adverse conditions: brain offline, malformed requests, oversized payloads, concurrent requests, and URL edge cases.

---

## Test Groups

| Group | Tests | What It Covers |
|-------|-------|----------------|
| Brain offline / degraded | 4 | Brain status, health, chat, generate with Ollama unreachable |
| Malformed JSON bodies | 4 | Parse errors, empty body, array instead of object, null body |
| Missing Content-Type | 1 | POST without Content-Type header |
| Oversized payloads | 1 | 10 MB request body — should 413 or reset, not 5xx |
| Concurrent requests | 3 | 10 simultaneous health checks, 5 DTU lists, 3 registrations |
| URL edge cases | 4 | Path traversal, 500-char path, null bytes, unknown route |
| Malformed body shapes | - | Covered across groups |

**Total: 21 tests**

---

## Key Scenarios

### Brain Offline (Degraded Mode)

The server is started in local test mode with brain URLs pointed at `127.0.0.1:19999` (unreachable). In CI, `API_BASE` is used so the already-running server is tested.

The tests verify that brain timeouts result in structured error responses (with `error` or `message` fields), not raw 500 crashes. This matches the server's brain circuit-breaker and degraded-mode behavior.

### Malformed Requests

- `{ not valid json !!!` → parse error → 400 (not 500)
- Empty string body → graceful 400
- Array body `[1,2,3]` instead of object → 400 (not 500)
- `null` serialized as JSON body → 400 (not 500)

### Concurrent Requests

10 simultaneous `/health` calls verify the server doesn't have race conditions in basic response handling. 5 simultaneous DTU list calls verify query path is concurrency-safe. 3 simultaneous registrations verify unique-constraint handling is consistent.

### URL Edge Cases

Path traversal (`../../etc/passwd`) should return 4xx, not a filesystem read. Very long paths (500 chars) should return 404, not crash. URL-encoded null bytes should be handled safely.

---

## CI Integration

Added to `integration-test` job after edge case tests:

```yaml
- name: Run error path tests (degraded mode)
  working-directory: ./server
  env:
    API_BASE: http://localhost:5050
  run: node --test tests/error-paths.test.js
```

**Note:** The brain "offline" tests are most valuable in the local spawn mode where the brain URLs are explicitly misconfigured. In CI where the server is already running with `AUTH_MODE: ci`, the brain tests verify the existing degraded-mode handling is stable.

---

## Coverage Gap: DB Unavailable

Testing full DB unavailability (SQLite file locked/corrupt) requires starting the server with a broken DB path and verifying `/health` returns 503 with `status: "unhealthy"`. This would require a dedicated test server spawn and is left for a follow-up CI integration test that focuses on infrastructure failure modes.
