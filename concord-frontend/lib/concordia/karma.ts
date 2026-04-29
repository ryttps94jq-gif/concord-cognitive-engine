// Fallout-style karma and faction reputation system.
// Karma is a single global score; reputation is per faction/district.
// Both persist as DTUs in the player's locker.

export type KarmaTier =
  | 'saint'       // > 750
  | 'good'        // 250..750
  | 'neutral'     // -249..249
  | 'evil'        // -750..-250
  | 'demon';      // < -750

export function karmaToTier(karma: number): KarmaTier {
  if (karma > 750)  return 'saint';
  if (karma > 249)  return 'good';
  if (karma > -250) return 'neutral';
  if (karma > -750) return 'evil';
  return 'demon';
}

export interface KarmaAction {
  id: string;
  label: string;
  delta: number;   // negative = evil, positive = good
}

export const KARMA_ACTIONS: Record<string, KarmaAction> = {
  helped_npc:         { id: 'helped_npc',         label: 'Helped an NPC',          delta: 10 },
  donated_resources:  { id: 'donated_resources',   label: 'Donated resources',      delta: 15 },
  resolved_conflict:  { id: 'resolved_conflict',   label: 'Resolved conflict',      delta: 20 },
  completed_quest:    { id: 'completed_quest',      label: 'Completed a quest',      delta: 25 },
  created_dtu:        { id: 'created_dtu',          label: 'Contributed knowledge',  delta: 5  },
  attacked_innocent:  { id: 'attacked_innocent',   label: 'Attacked an innocent',   delta: -30 },
  stole_items:        { id: 'stole_items',          label: 'Stole items',            delta: -15 },
  betrayed_ally:      { id: 'betrayed_ally',        label: 'Betrayed an ally',       delta: -40 },
  destroyed_creation: { id: 'destroyed_creation',  label: 'Destroyed a creation',   delta: -20 },
  threatened_npc:     { id: 'threatened_npc',       label: 'Threatened an NPC',      delta: -10 },
};

// ── Faction Reputation ───────────────────────────────────────────────

export type FactionStanding =
  | 'hero'        // > 750
  | 'ally'        // 500..750
  | 'friendly'    // 250..499
  | 'neutral'     // -249..249
  | 'unfriendly'  // -499..-250
  | 'hostile'     // -749..-500
  | 'enemy';      // < -750

export function repToStanding(rep: number): FactionStanding {
  if (rep > 750)  return 'hero';
  if (rep > 499)  return 'ally';
  if (rep > 249)  return 'friendly';
  if (rep > -250) return 'neutral';
  if (rep > -499) return 'unfriendly';
  if (rep > -750) return 'hostile';
  return 'enemy';
}

export interface FactionReputation {
  factionId: string;
  factionName: string;
  score: number;          // -1000 to 1000
  standing: FactionStanding;
  notoriety: number;      // 0-100 — how well-known you are (affects NPC reactions)
}

export interface KarmaState {
  global: number;          // -1000 to 1000
  tier: KarmaTier;
  factions: Record<string, FactionReputation>;
  recentActions: Array<{ action: KarmaAction; timestamp: number }>;
}

export function createDefaultKarmaState(): KarmaState {
  return {
    global: 0,
    tier: 'neutral',
    factions: {},
    recentActions: [],
  };
}

export function applyKarmaAction(
  state: KarmaState,
  actionId: string,
  factionId?: string,
): KarmaState {
  const action = KARMA_ACTIONS[actionId];
  if (!action) return state;

  const newGlobal = Math.max(-1000, Math.min(1000, state.global + action.delta));

  const newFactions = { ...state.factions };
  if (factionId) {
    const prev = newFactions[factionId] ?? {
      factionId,
      factionName: factionId,
      score: 0,
      standing: 'neutral' as FactionStanding,
      notoriety: 0,
    };
    const newScore = Math.max(-1000, Math.min(1000, prev.score + action.delta));
    newFactions[factionId] = {
      ...prev,
      score: newScore,
      standing: repToStanding(newScore),
      notoriety: Math.min(100, prev.notoriety + Math.abs(action.delta) * 0.1),
    };
  }

  return {
    global: newGlobal,
    tier: karmaToTier(newGlobal),
    factions: newFactions,
    recentActions: [
      { action, timestamp: Date.now() },
      ...state.recentActions.slice(0, 19), // keep last 20
    ],
  };
}
