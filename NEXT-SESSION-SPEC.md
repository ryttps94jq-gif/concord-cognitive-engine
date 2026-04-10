# NEXT SESSION SPEC — Lens Overhaul Continuation

**Branch:** `claude/lens-audit-features-ycDgf`
**Last commit:** `62f8c70` (WIP: 5 domain handlers written but not registered)

---

## What Was Done This Session

### Infrastructure Fixes
- **15 route files** wired into server.js (were silently 404ing)
- **7 lensId mismatches** fixed (trades cluster)
- **Music contamination** removed from daily + collab lenses

### Frontend Overhauls (10 lenses)
Pets, Parenting, Neuro, Temporal, Fractal, Ethics, AR, QuestMarket, DIY, Materials
— all converted from bare-bones (174-292 lines) to full tabbed CRUD with edit modals

### Domain Handlers Created (65 total)
Each handler has 4 real computational actions, registered in `server/domains/index.js` and `ALL_LENS_DOMAINS`:

```
pets, parenting, questmarket, diy, materials,
agents, analytics, animation, astronomy, automotive,
bridge, calendar, carpentry, collab, construction,
consulting, cooking, council, creativewriting, custom,
daily, database, debate, defense, desert,
disputes, electrical, emergencyservices, energy, engineering,
experience, exportdomain, fashion, feed, filmstudios,
finance, forestry, forum, game, gamedesign,
geology, history, homeimprovement, hr, hvac,
landscaping, lawenforcement, linguistics, marketing, masonry,
mentalhealth, mentorship, mining, ocean, pharmacy,
philosophy, photography, plumbing, podcast, poetry,
privacy, projects, robotics, space, sports
```

### Lens Identities Added
~78 out of 175 lenses now have unique identities in `concord-frontend/lib/lens-identities.ts`

---

## TASK 1: Register 5 Written-But-Unregistered Handlers

These files exist in `server/domains/` but are NOT in `server/domains/index.js`:

```
supplychain.js → registerLensAction("supplychain", ...)
telecommunications.js → registerLensAction("telecommunications", ...)
travel.js → registerLensAction("travel", ...)
urbanplanning.js → registerLensAction("urban-planning", ...)
veterinary.js → registerLensAction("veterinary", ...)
```

**Steps:**
1. Add imports to `server/domains/index.js`
2. Add to the export array
3. Verify they're already in `ALL_LENS_DOMAINS` in `server/server.js` (they should be from prior commit)
4. Commit: `lens-overhaul: supplychain, telecommunications, travel, urban-planning, veterinary — complete`

---

## TASK 2: Create 21 Missing Domain Handler Files

These frontend lenses have NO `server/domains/[name].js` file at all:

```
artistry, atlas, graph, import, ingest, law, marketplace,
ml, music, paper, reasoning, sim, srs, studio,
thread, voice, wallet, welding, whiteboard, world
```

Note: Some of these may have handlers under different names. Check:
- `music` might be handled by existing code in server.js inline
- `marketplace` might be handled by creative-marketplace routes
- `voice`, `wallet`, `world` are in ALL_LENS_DOMAINS already

**For each missing handler:**
1. Create `server/domains/[name].js` with 4 real domain-specific actions
2. Add import to `server/domains/index.js`
3. Add to export array
4. Ensure domain is in `ALL_LENS_DOMAINS` in server.js
5. Batch 5 at a time, commit after each batch

**Pattern for each handler file:**
```javascript
// server/domains/[name].js
export default function register[Name]Actions(registerLensAction) {
  registerLensAction("[domain]", "actionName", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    // Real computation — not a stub
    return { ok: true, result: { /* computed data */ } };
  });
  // 3 more actions...
}
```

---

## TASK 3: Add 97 Missing Lens Identities

`concord-frontend/lib/lens-identities.ts` has 78 identities defined.
175 lenses exist. 97 are falling back to DEFAULT_IDENTITY.

**For each missing identity, add to LENS_IDENTITIES object:**
```typescript
  "lens-name": {
    accent: "#HEXCOLOR",        // unique per lens
    secondaryAccent: "#HEXCOLOR",
    icon: "\u{EMOJI}",          // unicode emoji
    gradient: "linear-gradient(135deg, #HEX11, #HEX11)",
    contentLayout: "feed|dashboard|document|gallery|editorial|threads|data|ide|reference|tutorial|player|paper|specs|course|isometric|daw",
    cardStyle: "default|metric|document|article|thread|artwork|listing|post|project|component|paper|species|district|game|clinical|lesson|repo|album|track",
    emptyState: "Domain-specific empty message. Not generic.",
    vibe: "real-world-design-reference",
  },
```

**Missing identities (do in batches of ~20):**
Check which lenses are in `concord-frontend/app/lenses/*/` but NOT in `LENS_IDENTITIES`.

---

## TASK 4: Fix Naming Mismatches in domains/index.js

Some domain handler files use unhyphenated names but the lens uses hyphens:

| Frontend lens dir | Handler file | registerLensAction domain |
|---|---|---|
| creative-writing | creativewriting.js | "creative-writing" ✓ |
| emergency-services | emergencyservices.js | "emergency-services" ✓ |
| film-studios | filmstudios.js | "film-studios" ✓ |
| game-design | gamedesign.js | "game-design" ✓ |
| home-improvement | homeimprovement.js | "home-improvement" ✓ |
| law-enforcement | lawenforcement.js | "law-enforcement" ✓ |
| mental-health | mentalhealth.js | "mental-health" ✓ |
| urban-planning | urbanplanning.js | "urban-planning" ✓ |
| app-maker | appmaker.js | Already existed ✓ |
| command-center | commandcenter.js | Already existed ✓ |

These are fine — the registerLensAction call uses the hyphenated name matching the frontend.

---

## TASK 5: Per-Lens Deep Overhaul (If Time)

The user's protocol requires for each lens:
- Backend handler with 4+ domain-specific actions
- Frontend with unique terminology, colors, visual signature
- All buttons wired, all forms work, all tabs populated
- No stubs, no "coming soon", no empty handlers

Priority lenses that need the most frontend work:
1. Any lens still using old `useQuery` pattern instead of `useLensData`
2. Any lens with hardcoded demo data instead of API-backed data
3. Any lens with tabs declared but empty content

---

## Execution Order

1. Register 5 WIP handlers (5 min)
2. Create 21 missing handler files (batches of 5, ~1 hour)
3. Bulk-add 97 lens identities (batches of 20, ~30 min)
4. Commit and push after each batch
5. Per-lens deep overhaul if time remains

---

## Key Files

| File | Purpose |
|---|---|
| `server/domains/index.js` | Imports and exports all domain handlers |
| `server/domains/*.js` | Individual domain action handlers |
| `server/server.js:30530` | `ALL_LENS_DOMAINS` array — must include every domain |
| `server/lib/domain-logic-extended.js` | Domain validation rules (separate from handlers) |
| `concord-frontend/lib/lens-identities.ts` | Visual identity for each lens |
| `concord-frontend/lib/lens-registry.ts` | Lens metadata for sidebar/command palette |
| `concord-frontend/app/lenses/*/page.tsx` | Frontend lens pages |
