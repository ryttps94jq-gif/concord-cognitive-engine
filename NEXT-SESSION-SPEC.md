# Next Session Spec: Remaining Lens Work

## What Was Completed This Session

**Full 175-lens audit completed.** Every lens page was read and checked for:
- Music contamination
- "Coming soon" / toast-only stubs  
- Broken imports
- Missing useLensNav / lensId mismatches
- General functionality

**Fixes applied (19 files, commit `51e3f53`):**
- Music contamination removed from 8 lenses (agents, daily, experience, game, goals, market, srs, whiteboard)
- Toast stubs wired to real APIs in 6 lenses (thread, repos, timeline, collab, calendar, poetry)
- lensId mismatches fixed in 3 lenses (automotive, construction, electrical)
- Missing useLensNav added to 2 lenses (analytics, disputes)

**Domain-logic rules:** 30 of 175 domains have rules in `server/lib/domain-logic.js`.

---

## What the Next Session Must Cover

### 1. Domain-Logic Rules (145 remaining domains)

**File:** `server/lib/domain-logic.js`  
**Approach:** Add rules in batches of 10-15 domains at a time, NOT all 145 at once.

Each domain needs:
```js
DOMAIN_RULES.set("domain-name", {
  types: [...],           // 4-6 artifact types
  validStatuses: [...],   // 4-6 lifecycle statuses
  transitions: {...},     // state machine
  requiredFields: {...},  // per-type required fields
  computedFields: (type, data) => { ... return data; },
  scoring: (type, data) => { ... return 0-1 score; },
});
```

**Domains still needing rules (grouped by similarity for batching):**

**Batch A — Trades/Construction (share patterns):**
accounting, agriculture, automotive, aviation, billing, carpentry, construction, consulting, electrical, energy, hvac, landscaping, manufacturing, masonry, mining, plumbing, welding

**Batch B — Science/Academic:**
astronomy, bio, chem, ecology/eco, environment, forestry, geology, linguistics, materials, ocean, pharmacy, quantum

**Batch C — Professional Services:**
hr, insurance, law-enforcement, logistics, marketing, nonprofit, realestate, retail, services, supplychain, telecommunications, urban-planning, veterinary

**Batch D — Tech/Platform:**
analytics, animation, app-maker, ar, crypto, custom, database, debug, dtus, game-design, integrations, ml, robotics, schema, security

**Batch E — Meta/System:**
affect, alliance, anon, attention, audit, bridge, calendar, collab, command-center, commonsense, cri, daily, defense, desert, disputes, docs, diy, ethics, events, experience, export, fashion, feed (already done), film-studios, fitness, food, fork, fractal, game, global, goals, government, grounding, history, home-improvement, household, hypothesis, import, inference, ingest, invariant, lab, law (already done), legacy, lock, meta, metacognition, metalearning, neuro, news, offline, organ, paper (already done), parenting, pets, photography, platform, podcast, poetry, privacy, projects, questmarket, queue, reasoning (already done), reflection, repos, resonance, sim (already done), sports, srs, studio (already done), suffering, temporal, thread, tick, timeline, transfer, travel, vote, whiteboard (already done)

### 2. Remaining Frontend Issues (Lower Priority)

These are minor polish items found during audit — fix as you encounter them:

| Lens | Issue | Priority |
|------|-------|----------|
| parenting | Schedules/Health/Activities tabs all show milestone list | Medium |
| photography | Collections and Editing tabs are minimal stubs | Medium |
| bio | Experiments and sequences tabs are static/decorative | Low |
| animation | Timeline and Render tabs are placeholder divs | Medium |
| ar | Viewport, stats, config are non-functional placeholders | Medium |
| queue | Hardcoded stats mixed with real data | Low |
| reflection | Decision Journal section is hardcoded | Low |
| metalearning | Duplicate stat card rows | Low |
| app-maker | Uses alert() instead of toast, render-time side effect | Low |
| law | Preview Contract / Generate Document buttons permanently disabled | Medium |
| sports | Training logs not persisted to backend | Low |
| collab | "genre" field should be renamed to "category" | Low |

### 3. Lens Identities (Optional Enhancement)

`concord-frontend/lib/lens-identities.ts` currently has ~32 lens identities defined.  
143 lenses use the DEFAULT_IDENTITY fallback. Could add custom identities for frequently-used lenses.

---

## How to Execute

1. **Start with domain-logic Batch A** (17 trades/construction domains) — they share similar patterns (jobs, estimates, materials, invoices, inspections, certifications)
2. **Commit after each batch** — don't accumulate too many uncommitted changes
3. **Move to Batch B** (science/academic) — similar patterns (experiments, data, analysis, publications)
4. **Continue through C, D, E** — one batch per commit
5. **After domain-logic is done**, circle back to the frontend polish issues table
6. **Test with `tsc --noEmit`** after each batch of frontend changes

**Key files:**
- `server/lib/domain-logic.js` — domain rules (insert before line 849 "Exported helpers")
- `concord-frontend/lib/lens-identities.ts` — visual identities (optional)
- `concord-frontend/app/lenses/*/page.tsx` — individual lens pages
