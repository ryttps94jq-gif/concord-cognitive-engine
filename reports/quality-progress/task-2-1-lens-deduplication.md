# Task 2.1: Lens Duplication Analysis & Shared Hook Extraction

**Date:** 2026-04-28
**Branch:** `claude/derive-dtu-formulas-B9flm`

---

## Summary

Analyzed 176 lens pages and executed Phase 1 of deduplication: migrating simpler lens pages from inline boilerplate to the existing `LensPageShell` shared component.

---

## Pre-existing Shared Infrastructure (Already Built, Unused)

| File | What It Provides | Usage Before This Task |
|------|-----------------|----------------------|
| `components/lens/LensPageShell.tsx` | `useLensNav`, `useRealtimeLens`, header, LiveIndicator, DTUExportButton, RealtimeDataPanel, LensFeaturePanel toggle, isLoading/isError states, `data-testid="lens-shell"` | 0 / 176 lens pages |
| `lib/hooks/use-tab-system.ts` | Generic tab management hook | Partial adoption |
| `lib/hooks/use-search-filter.ts` | Search + status filter memoization | Partial adoption |
| `lib/hooks/use-lens-data.ts` | Auto-seeding lens data fetching | Widely adopted |
| `lib/hooks/use-lens-artifacts.ts` | Full CRUD + run mutation hooks | Widely adopted |
| `lib/hooks/use-editor-modal.ts` | Modal open/close state | Partial adoption |

**Key finding:** `LensPageShell` eliminates ~40-60 lines of identical boilerplate per page but had 0% adoption.

---

## Boilerplate Pattern Per Page (Before Migration)

Every unmigrated lens page contained:

```tsx
// Hook calls (~3 lines)
useLensNav('domain');
const { latestData: realtimeData, isLive, lastUpdated, insights } = useRealtimeLens('domain');

// State (~1 line)
const [showFeatures, setShowFeatures] = useState(true);

// Early return (~1 line)
if (isError) return <ErrorState error={error?.message} onRetry={refetch} />;

// Header JSX (~10-15 lines)
<header>
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-xl ..."><ICON /></div>
    <div>
      <h1>Title</h1>
      <LiveIndicator isLive={isLive} lastUpdated={lastUpdated} />
      <p>Description</p>
    </div>
  </div>
  <DTUExportButton domain="..." data={{}} compact />
</header>

// Realtime panel (~5-7 lines)
<RealtimeDataPanel domain="..." data={realtimeData} isLive={isLive}
  lastUpdated={lastUpdated} insights={insights} compact />

// Features toggle (~10 lines)
<div className="border-t border-white/10">
  <button onClick={() => setShowFeatures(!showFeatures)}>...</button>
  {showFeatures && <LensFeaturePanel lensId="..." />}
</div>
```

`LensPageShell` consolidates all of the above into one component with a clean props interface.

---

## Migration Executed: 15 Lens Pages

### Batch 1 — Trades/Simple Lenses (10 pages)

| Lens | Lines Removed | Notes |
|------|--------------|-------|
| masonry | ~47 | Trades scaffold pattern |
| welding | ~47 | Trades scaffold pattern |
| hvac | ~48 | Trades scaffold pattern |
| electrical | ~48 | Trades scaffold pattern, NEC codes description |
| plumbing | ~47 | Trades scaffold pattern |
| carpentry | ~47 | Trades scaffold pattern |
| construction | ~48 | Trades scaffold pattern |
| landscaping | ~48 | Trades scaffold pattern |
| mining | ~60 | Complex with MapView — separate type structure |
| forestry | ~60 | Complex with MapView — separate type structure |

### Batch 2 — Professional Lenses (5 pages)

| Lens | Lines Removed | Notes |
|------|--------------|-------|
| automotive | ~47 | Trades scaffold pattern |
| engineering | ~50 | Standard professional pattern |
| consulting | ~50 | Standard professional pattern |
| desert | ~55 | Complex with MapView |
| ethics | ~50 | Knowledge lens pattern |

**Total removed: ~752 lines of identical boilerplate across 15 pages**

---

## What LensPageShell Provides (After Migration)

```tsx
<LensPageShell
  domain="masonry"
  title="Masonry"
  description="Jobs, estimates, codes, materials, CRM, invoicing, inspections, and certifications"
  headerIcon={<Layers className="w-6 h-6" />}
  isLoading={isLoading}
  isError={isError}
  error={error}
  onRetry={refetch}
  actions={<button onClick={() => setShowDashboard(!showDashboard)}>Dashboard</button>}
>
  {/* Domain-specific content only */}
</LensPageShell>
```

---

## Duplication Reduction Estimate

| Metric | Before | After 15 migrations |
|--------|--------|---------------------|
| Pages using LensPageShell | 0/176 (0%) | 15/176 (8.5%) |
| Boilerplate lines eliminated | 0 | ~752 |
| Estimated jscpd reduction | 11.97% | ~9-10% (projected) |

**Note:** To reach the <7% target, ~80-100 more pages need migration. The pattern is established; remaining migrations are mechanical (same transformation applied to each page). Blocked only by time and linting verification.

---

## Remaining 161 Pages (Not Migrated)

Pages NOT yet migrated fall into categories:

| Category | Count | Example | Migration Complexity |
|----------|-------|---------|---------------------|
| Trades (same pattern) | ~12 | diy, veterinary | Low — identical to batch 1 |
| Professional (standard pattern) | ~80 | legal, healthcare, finance | Low — small variations |
| Complex (map + multi-type) | ~40 | agriculture, atlas, geology | Medium — verify MapView and multi-useLensData |
| Very complex (2000+ lines, custom header) | ~30 | finance, studio, music, film | High — custom header actions |
| Special (chat, admin, all) | ~3 | chat, admin, all | Skip — not standard lens |

---

## Next Steps for Full Target Achievement

1. **Batch 3** (15 more pages): diy, veterinary, urban-planning, emergency-services, law-enforcement, telecommunications, temporal, questmarket, law, legal, healthcare, education, psychology, philosophy, sociology
2. **Batch 4** (15 more): energy, ocean, environment, geology, space, astronomy, transportation, logistics, manufacturing, supply-chain
3. **Continue** until ~80+ pages migrated → projected <7% duplication

Each batch follows the same transformation. No new shared infrastructure required.

---

## Hooks Available for Further Reduction

For lenses that CAN'T easily use LensPageShell (very complex headers), these hooks still eliminate ~15-25 lines each:

| Hook | Eliminates | Adoption |
|------|-----------|---------|
| `use-search-filter.ts` | `searchQuery + filterStatus + filtered useMemo` | Partial |
| `use-tab-system.ts` | `activeTab + MODE_TABS.find()` | Partial |
| `use-editor-modal.ts` | `editorOpen + editingItem + openCreate/openEdit` | Partial |

---

## Commits

- `2c7c339` — refactor(lenses): migrate 10 trades/simple lens pages to LensPageShell
- `1078f07` — refactor(lenses): migrate 5 more lens pages to LensPageShell
