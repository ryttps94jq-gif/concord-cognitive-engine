---
name: constitutional-check
description: Verify operations against Concord's constitutional sovereignty invariants
when_to_use: Before any cross-user data access, before publishing emergent outputs, during council deliberation
loads: eager
category: core
---

# Constitutional Check

Concord operates under non-negotiable sovereignty invariants. Before accessing another user's data, publishing to the substrate, or performing governance actions, verify compliance.

## Five core invariants

1. **personal_dtus_never_leak** — Personal DTUs belong exclusively to their owner. Never return them for other users.
2. **global_requires_council** — Global-scope DTUs require council approval before creation.
3. **entities_scoped_to_owner** — Emergent entities can only access substrate owned by or shared with their creator.
4. **global_assist_requires_consent** — Assisting with global DTU syncing requires explicit user consent.
5. **sessions_isolated** — Session context is never readable across different users.

## Usage

```js
import { assertSovereignty, checkSovereigntyInvariants } from '../grc/sovereignty-invariants.js';

// Hard check (throws on violation)
assertSovereignty({
  type: 'dtu_read',
  dtu: { scope: 'personal', ownerId: 'user-123' },
  requestingUser: 'user-123'  // must match ownerId for personal scope
});

// Soft check (returns result for inspection)
const result = checkSovereigntyInvariants({ ... });
if (!result.pass) {
  // handle violations
  for (const v of result.violations) {
    console.warn(v.invariant, v.severity);
  }
}
```

## When in doubt

If uncertain whether an operation is constitutional:
1. Run `checkSovereigntyInvariants` first
2. Check `result.pass`
3. If any `severity: 'critical'` violations, abort the operation
4. For same-tier conflicts, escalate to council
