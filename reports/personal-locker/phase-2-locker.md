# Phase 2 — Encryption Infrastructure

## Delivered

- `server/migrations/036_personal_locker.js` — adds `locker_salt` to users, creates `personal_dtus` table with encrypted_content/iv/auth_tag BLOB columns. Applied.
- `server/lib/personal-locker/crypto.js` — `generateLockerSalt()`, `deriveLockerKey()` (scrypt, 32 bytes), `encryptBlob()` / `decryptBlob()` (AES-256-GCM). No new dependencies.
- `server/server.js` — `_LOCKER_KEYS` Map, `setLockerKey()`, `clearLockerKey()`, `getLockerKey()`.
- `server/routes/auth.js` — derives locker key at login (async, non-blocking), clears at logout.

## Security properties

- Key derived from plaintext password (available only at login) + user-specific salt
- Key never written to disk; exists only in `_LOCKER_KEYS` memory map during active session
- Platform cannot reconstruct key from database alone (would need user's password)
- AES-256-GCM provides authenticated encryption — tamper detection on every decrypt

## Tests

9 tests pass — roundtrip, wrong key throws, tampered ciphertext throws, unique IVs per encryption.
