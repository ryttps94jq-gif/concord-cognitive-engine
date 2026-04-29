# Phase 4 — Chat Context Integration

## Delivered

- `server/lib/chat-context-pipeline.js` — `fetchPersonalSubstrate(userId, lockerKey, queryText, db)`:
  - Fetches all personal_dtus for user
  - Decrypts each, scores by keyword overlap with query
  - Returns top 5 most relevant, marked `scope:"personal"`
  - Returns [] gracefully if locker locked or no DTUs
- `runContextHarvest()` — Source E (personal substrate) added. Prepended to working set at highest priority. `sources.personalSubstrate` count added to return value.
- Chat pipeline pass-through: `lockerKey: getLockerKey(userId)` and `db` now passed to `runContextHarvest` from the main conscious brain pipeline.

## Tests

6 tests pass — null key/userId/db returns [], decrypts matching DTUs, wrong-key rows skipped, max 5 results.
