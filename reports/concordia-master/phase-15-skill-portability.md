# Phase 15 — Skill Portability (Updated: Continuous Curves)

## Summary
Replaced the old fixed-multiplier model with a sigmoid effectiveness curve
that requires skills to clear a per-world level threshold before functioning.

## Files Created
- `server/lib/skill-effectiveness.js` — computeEffectiveness() (sigmoid curve), getWorldResistance(), evaluateSkillInWorld() (curve × legacy multiplier), teachSkillToPlayer() (subconscious brain adaptation + lineage)
- `concord-frontend/lib/concordia/skill-portability.ts` — computeEffectivenessPreview(), getResistanceForWorld(), WORLD_RESISTANCE_MAP (mirrors server seed)
- `concord-frontend/components/concordia/skills/SkillEffectivenessPanel.tsx` — circular gauge per skill, threshold warning, Learn from Master button

## Routes added to worlds.js
- `POST /api/worlds/skills/teach` — body: `{ teacherDtuId, studentId }` — returns new student skill DTU with lineage
- `GET  /api/worlds/skills/:dtuId/effectiveness?worldId=` — returns effectiveness object

## Curve Formula
`eff = 1 / (1 + exp(-above * scaling / 50))`
where `above = skill_level - threshold`.
Below threshold → effectiveness = 0. At threshold+50 → ~73%. Approaches 1.0 asymptotically.

## Example: flight in fable-world
`{ threshold: 20, scaling: 1.0 }`
- Level 19 → 0% (inactive)
- Level 20 → 50%
- Level 70 → ~73%
- Level 200 → ~98%
