# Phase 24 — Open-Ended Progression

## Summary
Unbounded skill levelling powered by meaningful-event verification and
diminishing-returns XP, with anti-grinding detection and rich mastery markers.

## Files Created
- `server/migrations/043_skill_progression.js` — adds skill_level, total_experience, practice_count, teaching_count, cross_world_uses, hybrid_contributions, last_practiced_at, highest_meaningful_use to dtus; creates skill_experience_events table
- `server/lib/skill-progression.js` — EXPERIENCE_RATES, computeLevelFromExperience(), awardExperience(), verifyMeaningfulEvent(), detectGrinding(), getMasteryMarkers()
- `concord-frontend/components/concordia/skills/ProgressionPanel.tsx` — level display, XP bar, mastery badge, world effectiveness bar, stat chips, NPC recognition / teacher eligibility flags

## Level Formula
`level = 1 + log10(1 + totalExp / 10)` — no cap; slows naturally at high levels.

## Anti-Grinding
If the last 20 events from the same user have fewer than 3 unique context hashes, `detectGrinding` returns true and XP is not awarded.

## Mastery Thresholds
Novice(10) → Adept(25) → Skilled(50) → Expert(100) → Master(200) → Legendary(500) → Mythic(1000) → Transcendent(5000+)
