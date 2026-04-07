# Concord Cognitive Engine -- Authentication and Security

Concord uses a 7-layer security architecture. In production, all layers are active. In development, layers can be relaxed for easier iteration.

---

## Security Layers

### Layer 1: JWT Authentication

**What it protects:** All non-public API endpoints.

JSON Web Tokens are issued on login and included in every request. Tokens are signed with `JWT_SECRET` using HS256. Access tokens expire after `JWT_EXPIRES_IN` (default: 7 days). Refresh tokens expire after `REFRESH_TOKEN_EXPIRES` (default: 30 days).

Tokens can be sent as:
- `Authorization: Bearer <token>` header
- httpOnly cookie (set automatically on login)

Token blacklisting is supported -- revoked tokens are rejected immediately via an in-memory blacklist.

### Layer 2: API Key Authentication

**What it protects:** Programmatic/machine-to-machine access.

API keys are created via `POST /api/auth/api-keys` with scoped permissions. Keys are hashed with SHA-256 before storage -- the raw key is shown only once at creation.

Send the key in the `X-API-Key` header:
```
X-API-Key: cck_abc123...
```

Keys can be scoped to specific operations (e.g., `read:dtus`, `write:dtus`).

### Layer 3: Session Cookies

**What it protects:** Browser-based sessions against token theft.

Login sets two httpOnly cookies:
- **Auth cookie** -- contains the JWT (httpOnly, Secure in production, SameSite=Strict)
- **Refresh cookie** -- contains the refresh token

Cookies are automatically sent by browsers and do not require manual header management. The `SameSite=Strict` attribute prevents cross-site request inclusion.

### Layer 4: CSRF Protection

**What it protects:** State-changing requests from cross-site forgery.

All POST/PUT/PATCH/DELETE requests from browser sessions require a valid CSRF token. Tokens are obtained via `GET /api/auth/csrf-token` and submitted as:
- `X-CSRF-Token` header, or
- `_csrf` field in the request body

CSRF protection is enforced only for cookie-based auth. API key and Bearer token requests bypass CSRF since they are not vulnerable to cross-site attacks.

### Layer 5: Rate Limiting

**What it protects:** Against brute-force attacks, credential stuffing, and abuse.

Two tiers of rate limiting:
- **Auth endpoints** (`/api/auth/*`): Stricter limits to prevent brute-force login attempts. Returns `429` with `Retry-After` header.
- **General API**: Configurable per-IP rate limits.

Rate limiting uses in-memory tracking. In multi-instance deployments, consider a shared store (Redis).

### Layer 6: Production Write Gate

**What it protects:** Against accidental writes in production from unauthenticated sources.

The `productionWriteAuthMiddleware` ensures that all write operations (POST, PUT, PATCH, DELETE) in production require valid authentication. This is an additional gate beyond JWT/API key -- it prevents any bypass that might allow unauthenticated writes.

In development mode, this gate is relaxed.

### Layer 7: Request Sanitization

**What it protects:** Against XSS, injection attacks, and malformed input.

The `sanitizationMiddleware` processes all incoming request bodies and query parameters:
- Strips HTML tags and script content
- Escapes special characters
- Validates input against expected schemas (via `validate()` middleware)
- Rejects payloads that exceed size limits

---

## Three-Gate Permission System

Beyond the 7 auth layers, every request passes through three content gates defined in `server.js`:

| Gate | Mechanism | Purpose |
|------|-----------|---------|
| Gate 1 | `publicReadPaths` allowlist | Allows specific GET paths without auth |
| Gate 2 | `publicReadDomains` allowlist | Domain + macro name allowlist |
| Gate 3 | `_safeReadPaths` + `safeReadBypass` | Lattice reality guard bypass |

All three gates must allow a request for it to succeed without authentication. POST endpoints require JWT/cookie auth and bypass the public read gates.

---

## Development Mode

To disable authentication for local development:

```bash
# Option 1: Disable auth entirely
AUTH_ENABLED=false

# Option 2: Set development environment (relaxes several layers)
NODE_ENV=development
```

In development mode:
- JWT is still generated but validation is lenient
- CSRF protection is relaxed
- Production write gate is disabled
- Rate limiting may be reduced or absent
- CSP headers allow `unsafe-eval` for hot-reload tooling

**Never run with `AUTH_ENABLED=false` in production.**

---

## Production Mode

When `NODE_ENV=production`:
- All 7 layers are fully active
- HSTS headers are set (1 year, includeSubDomains, preload)
- `Secure` flag is set on all cookies
- CSP blocks `unsafe-eval`
- Cross-Origin-Embedder-Policy is enabled
- `no-new-privileges` is set in Docker containers

Required environment variables for production:

| Variable | How to Generate |
|----------|-----------------|
| `JWT_SECRET` | `openssl rand -hex 64` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | Choose a strong password (min 12 characters) |
| `FOUNDER_SECRET` | `openssl rand -hex 32` |

---

## Generating Secrets

```bash
# JWT secret -- 64-byte hex string (512-bit)
openssl rand -hex 64

# Session secret -- 32-byte hex string (256-bit)
openssl rand -hex 32

# Founder secret -- 32-byte hex string
openssl rand -hex 32

# Quick one-liner to generate all secrets
echo "JWT_SECRET=$(openssl rand -hex 64)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
echo "FOUNDER_SECRET=$(openssl rand -hex 32)"
```

Place these in your `.env` file. Never commit secrets to version control.

---

## Auth Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_ENABLED` | `true` | Master auth toggle |
| `AUTH_MODE` | `hybrid` | `hybrid`, `public`, or `strict` |
| `JWT_SECRET` | -- (required) | JWT signing key |
| `JWT_EXPIRES_IN` | `7d` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES` | `30d` | Refresh token lifetime |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `ALLOW_REGISTRATION` | `true` | Allow new user sign-ups |
| `SOVEREIGN_USERNAME` | `Concord_Founder_Dutch` | Sovereign account name |

---

## Auth Flow Summary

```
1. Client -> POST /api/auth/login (username + password)
2. Server -> validates credentials, hashes match via bcrypt
3. Server -> issues JWT + refresh token, sets httpOnly cookies
4. Client -> includes Bearer token or cookies on subsequent requests
5. Server -> validates JWT signature + expiry on every request
6. Server -> checks rate limits, CSRF, sanitization, write gate
7. Server -> passes request through 3-gate permission system
8. Server -> executes the handler if all gates pass
```

Token refresh flow:
```
1. Access token expires (client gets 401)
2. Client -> POST /api/auth/refresh with refresh token
3. Server -> validates refresh token, checks token family
4. Server -> issues new access + refresh token pair
5. Old refresh token is invalidated (rotation)
```
