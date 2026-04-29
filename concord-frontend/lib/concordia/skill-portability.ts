// concord-frontend/lib/concordia/skill-portability.ts
// Client-side preview of skill effectiveness in a world.
// The server is authoritative; this is for UI preview only.

export interface WorldResistance {
  threshold: number;
  scaling: number;
}

export interface EffectivenessResult {
  effectiveness: number;
  status: 'below_threshold' | 'functional' | 'mastered';
  skillLevel: number;
  threshold: number;
}

/**
 * Compute sigmoid effectiveness for a skill level against a world resistance config.
 * Mirrors server/lib/skill-effectiveness.js#computeEffectiveness — keep in sync.
 */
export function computeEffectivenessPreview(
  skillLevel: number,
  resistance: WorldResistance,
): EffectivenessResult {
  const { threshold, scaling } = resistance;

  if (skillLevel < threshold) {
    return { effectiveness: 0, status: 'below_threshold', skillLevel, threshold };
  }

  const above = skillLevel - threshold;
  const eff   = 1 / (1 + Math.exp(-above * scaling / 50));
  const status: EffectivenessResult['status'] = eff >= 0.9 ? 'mastered' : 'functional';

  return { effectiveness: eff, status, skillLevel, threshold };
}

// ── World resistance presets (mirrors server world seed) ─────────────────────

export const WORLD_RESISTANCE_MAP: Record<string, Record<string, WorldResistance>> = {
  'concordia-hub':    {},
  'fable-world': {
    hacking:    { threshold: 999999, scaling: 0 },
    technology: { threshold: 999999, scaling: 0 },
    magic:      { threshold: 5,      scaling: 1.2 },
    flight:     { threshold: 20,     scaling: 1.0 },
  },
  'superhero-world': {
    power: { threshold: 10, scaling: 1.5 },
    magic: { threshold: 30, scaling: 0.8 },
  },
  'wasteland-world': {
    magic:    { threshold: 999999, scaling: 0 },
    survival: { threshold: 1,      scaling: 1.0 },
    combat:   { threshold: 5,      scaling: 1.1 },
  },
  'crime-city': {
    hacking:   { threshold: 10, scaling: 1.2 },
    stealth:   { threshold: 5,  scaling: 1.3 },
    persuasion:{ threshold: 5,  scaling: 1.1 },
  },
  'war-zone': {
    combat:  { threshold: 5,      scaling: 1.2 },
    tactics: { threshold: 10,     scaling: 1.3 },
    magic:   { threshold: 999999, scaling: 0   },
  },
};

/**
 * Get the resistance config for a skill type in a world.
 * Returns a permissive default if not configured.
 */
export function getResistanceForWorld(worldId: string, skillType: string): WorldResistance {
  return WORLD_RESISTANCE_MAP[worldId]?.[skillType] || { threshold: 1, scaling: 1.0 };
}
