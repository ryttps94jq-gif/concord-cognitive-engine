# NEXT SESSION SPEC — Lens Frontend Upgrade (Wire Backend Actions to UI)

**Branch:** `claude/document-next-session-sY9bg`
**Last commit:** `49610e6`

---

## What Was Done This Session

### Domain Handlers & Identities (COMPLETE)
- 174/174 domain handler files with real computational logic
- 174/174 lens identities with unique visual signatures
- All registered in `server/domains/index.js` and `ALL_LENS_DOMAINS`

### Infrastructure (COMPLETE)
- Periodic state backup (2h) + 5-min safety net saves
- Startup script (`startup.sh`) with dev/recovery modes
- Staggered autonomous intervals (7s offset each, no simultaneous fires)
- Initiative engine proactive tick (Concord sends first, double-texts, follows up)

### User Sovereignty (COMPLETE)
- ownerId filtering on lens.get, lens.list, search
- Default visibility: private
- Consent enforcement on brain context + DTU lineage
- Wallet payouts on marketplace sale (instant, idempotent)
- Real DTU counts (excludes shadow/repair/system padding)
- Scope hierarchy: local → regional → national → global

### useQuery → useLensData Migration (COMPLETE)
- 6 files migrated, 4 useLensNav fixes

### Lens Frontend Upgrades (STARTED — 8 of 174 done)

---

## THE TASK: Wire Backend Actions into Frontend UI

Every lens has backend computational actions (via `registerLensAction`). Most frontends don't use them. The task is to add dedicated, interactive UI panels for each action — not generic UniversalActions buttons.

### Audit Results

**FULLY WIRED (8 lenses — SKIP these):**
```
accounting, admin, creative, environment, events, government, paper, reasoning
```

**PARTIAL (68 lenses — have useRunArtifact but no action panels):**
```
affect, agriculture, ar, astronomy, automotive, aviation, bio, carpentry,
construction, consulting, council, defense, desert, diy, education, electrical,
emergency-services, energy, engineering, ethics, fitness, food, forestry,
fractal, geology, healthcare, history, household, hr, hvac, insurance,
landscaping, law-enforcement, legal, linguistics, logistics, manufacturing,
marketing, masonry, materials, mental-health, mining, neuro, nonprofit, ocean,
parenting, pets, pharmacy, philosophy, plumbing, projects, questmarket,
realestate, retail, robotics, science, security, services, sim, space,
suffering, supplychain, telecommunications, temporal, trades, urban-planning,
veterinary, welding
```

**UNWIRED (98 lenses — no useRunArtifact at all, highest priority):**
```
agents, alliance, analytics, animation, anon, app-maker, art, artistry, atlas,
attention, audit, billing, board, bridge, calendar, chat, chem, code, collab,
command-center, commonsense, cooking, creative-writing, cri, crypto, custom,
daily, database, debate, debug, disputes, docs, dtus, eco, entity, experience,
export, fashion, feed, film-studios, finance, fork, forum, game-design, game,
global, goals, graph, grounding, home-improvement, hypothesis, import,
inference, ingest, integrations, invariant, lab, law, legacy, lock, market,
marketplace, math, mentorship, meta, metacognition, metalearning, ml, music,
news, offline, organ, photography, physics, platform, podcast, poetry, privacy,
quantum, queue, reflection, repos, research, resonance, schema, sports, srs,
studio, thread, tick, timeline, transfer, travel, voice, vote, wallet,
whiteboard, world
```

---

## Process Per Batch

### 1. Check backend actions
```bash
grep "registerLensAction" server/domains/LENS.js | grep -oP '"[^"]+",\s*"[^"]+"'
```

### 2. Check current frontend state
```bash
wc -l concord-frontend/app/lenses/LENS/page.tsx
grep -c "useRunArtifact\|runAction" concord-frontend/app/lenses/LENS/page.tsx
```

### 3. Launch agent with this prompt template
For UNWIRED lenses (add useRunArtifact + action panels):
```
Upgrade the LENS lens frontend to wire its backend computational actions.

Current state: concord-frontend/app/lenses/LENS/page.tsx (NNNL).
No useRunArtifact. Backend actions are not surfaced in UI.

Backend actions (in server/domains/LENS.js):
[READ THE FILE FIRST — list the action names and what they compute]

What to do:
1. Read the current page.tsx and the backend handler
2. Add: import { useRunArtifact } from '@/lib/hooks/use-lens-artifacts'
3. Wire: const runAction = useRunArtifact('DOMAIN')
4. For each backend action, add a dedicated interactive panel:
   - Trigger button with action name and icon
   - Loading spinner while running
   - Formatted result display (not raw JSON)
   - Contextual design matching the domain
5. Add state: const [actionResult, setActionResult] = useState(null)
   const [isRunning, setIsRunning] = useState<string | null>(null)

Pattern:
const handleAction = async (action: string) => {
  if (!selectedItem) return;
  setIsRunning(action);
  try {
    const res = await runAction.mutateAsync({ id: selectedItem.id, action });
    setActionResult(res.result);
  } catch (e) { console.error(e); }
  setIsRunning(null);
};

Read first, then add. Don't rewrite — augment.
```

For PARTIAL lenses (already have useRunArtifact, just need panels):
Same as above but skip steps 2-3.

### 4. Commit and push after each batch

---

## Execution Order

**Start with UNWIRED (98 lenses) — highest priority, biggest impact.**
Do in batches of 3, alphabetical:

| Batch | Lenses |
|---|---|
| 1 | agents, alliance, analytics |
| 2 | animation, anon, app-maker |
| 3 | art, artistry, atlas |
| 4 | attention, audit, billing |
| 5 | board, bridge, calendar |
| 6 | chat, chem, code |
| 7 | collab, command-center, commonsense |
| 8 | cooking, creative-writing, cri |
| 9 | crypto, custom, daily |
| 10 | database, debate, debug |
| 11 | disputes, docs, dtus |
| 12 | eco, entity, experience |
| 13 | export, fashion, feed |
| 14 | film-studios, finance, fork |
| 15 | forum, game-design, game |
| 16 | global, goals, graph |
| 17 | grounding, home-improvement, hypothesis |
| 18 | import, inference, ingest |
| 19 | integrations, invariant, lab |
| 20 | law, legacy, lock |
| 21 | market, marketplace, math |
| 22 | mentorship, meta, metacognition |
| 23 | metalearning, ml, music |
| 24 | news, offline, organ |
| 25 | photography, physics, platform |
| 26 | podcast, poetry, privacy |
| 27 | quantum, queue, reflection |
| 28 | repos, research, resonance |
| 29 | schema, sports, srs |
| 30 | studio, thread, tick |
| 31 | timeline, transfer, travel |
| 32 | voice, vote, wallet |
| 33 | whiteboard, world (2 lenses — world already has 80 components) |

**Then PARTIAL (68 lenses) — add action panels to existing hooks:**

| Batch | Lenses |
|---|---|
| 34 | affect, agriculture, ar |
| 35 | astronomy, automotive, aviation |
| 36 | bio, carpentry, construction |
| 37 | consulting, council, defense |
| 38 | desert, diy, education |
| 39 | electrical, emergency-services, energy |
| 40 | engineering, ethics, fitness |
| 41 | food, forestry, fractal |
| 42 | geology, healthcare, history |
| 43 | household, hr, hvac |
| 44 | insurance, landscaping, law-enforcement |
| 45 | legal, linguistics, logistics |
| 46 | manufacturing, marketing, masonry |
| 47 | materials, mental-health, mining |
| 48 | neuro, nonprofit, ocean |
| 49 | parenting, pets, pharmacy |
| 50 | philosophy, plumbing, projects |
| 51 | questmarket, realestate, retail |
| 52 | robotics, science, security |
| 53 | services, sim, space |
| 54 | suffering, supplychain, telecommunications |
| 55 | temporal, trades, urban-planning |
| 56 | veterinary, welding (2 lenses) |

---

## Key Files

| File | Purpose |
|---|---|
| `server/domains/*.js` | Backend action handlers — READ FIRST for each lens |
| `server/server.js:30831` | `DOMAIN_ACTION_MANIFEST` — brain-dispatched actions |
| `concord-frontend/app/lenses/*/page.tsx` | Frontend lens pages — EDIT these |
| `concord-frontend/lib/hooks/use-lens-artifacts.ts` | `useRunArtifact` hook |
| `concord-frontend/lib/hooks/use-lens-data.ts` | `useLensData` hook |
| `concord-frontend/components/lens/UniversalActions.tsx` | Generic action buttons (what we're augmenting beyond) |

---

## Quality Bar

For each lens, the upgrade must include:
- `useRunArtifact('domain')` wired
- Every backend action from the domain handler has a dedicated trigger button
- Results displayed in formatted panels (not raw JSON, not console.log)
- Loading spinners during execution
- Contextual icons and domain-appropriate terminology
- No stubs, no "coming soon", no empty panels
