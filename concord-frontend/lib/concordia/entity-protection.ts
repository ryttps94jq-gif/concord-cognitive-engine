// Entity protection rules — defines who can harm whom and where.
//
// Tiers:
//   emergent  — Concordia's native AI entities. Invulnerable to all player
//               harm, everywhere. They also cannot initiate harm against players.
//   conscious — Player-created NPCs and named story characters. Protected on
//               mainland and in safe zones. Targetable in conflict districts
//               only if the player has hostile faction standing.
//   ambient   — Procedural fill NPCs seeded by the district domain. Fair game
//               in any combat-allowed district.
//   player    — Human players. PvP only where both parties have opted in.

import { isSafeZone, type DomainType } from './district-domains';

export type EntityTier = 'emergent' | 'conscious' | 'ambient' | 'player';

export interface ProtectedEntity {
  id: string;
  tier: EntityTier;
  name: string;
  /** Only relevant for 'player' tier — has the player opted into PvP? */
  pvpConsented?: boolean;
}

export interface HarmContext {
  attacker: { tier: EntityTier; pvpConsented?: boolean };
  target: ProtectedEntity;
  domain: DomainType;
}

export interface HarmResult {
  allowed: boolean;
  reason?: string;  // shown in combat log when blocked
}

/**
 * Single authoritative function for all harm checks.
 * Call this before resolving any attack, skill, or VATS shot.
 */
export function canHarm(ctx: HarmContext): HarmResult {
  const { attacker, target, domain } = ctx;

  // Emergents are always invulnerable — no exceptions
  if (target.tier === 'emergent') {
    return { allowed: false, reason: 'Emergents cannot be harmed.' };
  }

  // Emergents don't initiate harm against players
  if (attacker.tier === 'emergent' && target.tier === 'player') {
    return { allowed: false, reason: 'Emergents do not harm players.' };
  }

  // No combat in safe zones (mainland + designated peaceful districts)
  if (isSafeZone(domain)) {
    return { allowed: false, reason: `Combat is not permitted in ${domain}.` };
  }

  // Conscious NPCs: allowed only in combat zones
  if (target.tier === 'conscious') {
    return { allowed: true };
  }

  // Player-vs-player: both must have consented
  if (target.tier === 'player') {
    if (!attacker.pvpConsented || !target.pvpConsented) {
      return { allowed: false, reason: 'PvP requires both players to opt in.' };
    }
    return { allowed: true };
  }

  // Ambient NPCs in combat zones: always allowed
  return { allowed: true };
}

/** Quick boolean wrapper for use in combat hot paths */
export function harmAllowed(ctx: HarmContext): boolean {
  return canHarm(ctx).allowed;
}

/** Build a ProtectedEntity descriptor from game NPC data */
export function makeEntity(
  id: string,
  name: string,
  tier: EntityTier,
  pvpConsented = false,
): ProtectedEntity {
  return { id, name, tier, pvpConsented };
}

// ── Mainland Concordia lore rule ──────────────────────────────────────
//
// Emergents are native to Mainland Concordia. They can appear in any district
// as visitors or guides, but retain their protected status everywhere.
// Players may converse with, trade with, or receive quests from emergents —
// the relationship is collaborative, not adversarial.
//
// The vice-versa rule (emergents cannot harm players) ensures the world feels
// safe to explore and the emergent characters remain trustworthy protagonists
// rather than threats.
