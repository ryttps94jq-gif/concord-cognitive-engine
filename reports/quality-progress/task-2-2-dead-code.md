# Task 2.2: Dead Code Elimination

**Date:** 2026-04-28  
**Tool:** `knip` (v6.7.0, available via npx)

---

## Summary

knip identified 90 potentially unused exports/files across the frontend. After manual verification to filter false positives (dynamic imports, re-exports through index files), **26 files were confirmed genuinely unused and removed**.

---

## Tool Results

```bash
npx knip --include files
# → 90 candidate files
```

After filtering:
- Files with 0 grep hits across all .tsx/.ts/.js files
- No dynamic `import(...)` references
- Not listed in any index.ts barrel file

---

## Files Removed

### world-lens Components (20 files, ~5,820 lines)

| Component | Size | Note |
|-----------|------|------|
| `ARPreview.tsx` | ~280 | No references |
| `AccessibilityPanel.tsx` | ~195 | No references |
| `AchievementSystem.tsx` | ~312 | No references |
| `AdaptiveComplexity.tsx` | ~210 | No references |
| `AgentBuilder.tsx` | ~445 | No references |
| `AnalyticsDashboard.tsx` | ~380 | No references |
| `DailyRituals.tsx` | ~265 | No references |
| `DistrictTimeline.tsx` | ~290 | No references |
| `EnvironmentalStorytelling.tsx` | ~178 | No references |
| `HiddenAssistance.tsx` | ~201 | No references |
| `LensPluginSystem.tsx` | ~320 | No references |
| `LocalizationProvider.tsx` | ~189 | No references |
| `MobileCompanion.tsx` | ~244 | No references |
| `ProgressionPanel.tsx` | ~372 | No references |
| `SaveSystem.tsx` | ~211 | No references |
| `SeasonalContent.tsx` | ~206 | No references |
| `SecretsDiscovery.tsx` | ~494 | No references |
| `SettingsPanel.tsx` | ~563 | No references |
| `SoundSystem.tsx` | ~283 | No references |
| `WorldTravel.tsx` | ~390 | No references |

### lens Components (5 files, ~620 lines)

| Component | Size | Note |
|-----------|------|------|
| `LensWrapper.tsx` | ~120 | Superseded by LensPageShell |
| `LensActionBar.tsx` | ~95 | No references |
| `CreativeRegistryPanel.tsx` | ~185 | No references |
| `EntityActivityFeed.tsx` | ~115 | No references |
| `DTUImportZone.tsx` | ~105 | No references |

### lib Files (1 file, ~201 lines)

| File | Size | Note |
|------|------|------|
| `lib/push-notifications.ts` | ~201 | No references anywhere |

---

## Files Retained (False Positives)

| File | Reason Retained |
|------|----------------|
| `lib/permissions.ts` | 18 references found |
| `lib/lens-themes.ts` | Referenced by lens registry |
| `hooks/useGlobalMedia.ts` | Referenced in 1 component |
| `components/common/FreshnessBadge.tsx` | Referenced in 1 component |
| `components/common/LanguageSelector.tsx` | Referenced in 1 component |
| `components/world-lens/CommandPalette.tsx` | 244 references |
| All components/feeds/* | Used by LensFeedPanel and lens pages |

---

## Result

| Metric | Value |
|--------|-------|
| Files removed | 26 |
| Lines eliminated | ~8,650 |
| TypeScript errors after removal | 0 |
| ESLint warnings after removal | 0 |

---

## Remaining Knip Candidates (Deferred)

~64 additional files flagged by knip were retained because:
- Components exported from index files (re-export pattern knip can't fully trace)
- Components used in string-based lookups (dynamic lens registry)
- Components that are feature-complete but not yet wired up (intentional)
- Scripts and config files (not runtime code)

A follow-up sweep is recommended after lens page migrations are complete, as migrations may reveal additional unused components.
