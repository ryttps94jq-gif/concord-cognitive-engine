// Player stats combining Fallout SPECIAL attributes with Sims-style needs
// and emotional state. Stats are stored as DTUs in the player's locker;
// this module provides the in-memory representation and derived values.

// ── Fallout SPECIAL ─────────────────────────────────────────────────

export interface SPECIALStats {
  strength: number;      // 1-10 — melee damage, carry weight
  perception: number;    // 1-10 — detection range, VATS accuracy
  endurance: number;     // 1-10 — max health, stamina pool, needs decay rate
  charisma: number;      // 1-10 — dialogue options, barter, companion limit
  intelligence: number;  // 1-10 — XP gain multiplier, crafting complexity, skill checks
  agility: number;       // 1-10 — movement speed, dodge chance, AP pool
  luck: number;          // 1-10 — crit chance, loot quality, random event outcomes
}

export const DEFAULT_SPECIAL: SPECIALStats = {
  strength: 5,
  perception: 5,
  endurance: 5,
  charisma: 5,
  intelligence: 5,
  agility: 5,
  luck: 5,
};

// Derived values computed from SPECIAL
export function deriveStats(s: SPECIALStats) {
  return {
    maxHealth: 100 + s.endurance * 20,
    maxStamina: 100 + s.agility * 10,
    carryWeight: 100 + s.strength * 10,      // kg
    moveSpeedMultiplier: 0.8 + s.agility * 0.05,
    dodgeChance: s.agility * 2,              // %
    critChance: s.luck * 1.5,               // %
    xpMultiplier: 1 + (s.intelligence - 5) * 0.1,
    meleeDamageBonus: (s.strength - 5) * 2,
    vatsApPool: 50 + s.agility * 5,         // Action Points for VATS
    speechChance: s.charisma * 10,          // % base pass rate for skill checks
  };
}

// ── Sims-style Needs ────────────────────────────────────────────────

export interface PlayerNeeds {
  hunger: number;       // 0-100 (100 = full, 0 = starving)
  rest: number;         // 0-100 (100 = well rested)
  social: number;       // 0-100 (100 = socially fulfilled)
  fun: number;          // 0-100 (100 = entertained)
  hygiene: number;      // 0-100 (100 = clean)
  comfort: number;      // 0-100 (100 = comfortable)
  safety: number;       // 0-100 (100 = safe)
}

export const DEFAULT_NEEDS: PlayerNeeds = {
  hunger: 80,
  rest: 80,
  social: 70,
  fun: 70,
  hygiene: 80,
  comfort: 70,
  safety: 90,
};

// Hourly decay rates — affected by Endurance stat
export function needsDecayRates(endurance: number): PlayerNeeds {
  const slow = 1 - (endurance - 5) * 0.05;
  return {
    hunger:  3.0 * slow,
    rest:    2.0 * slow,
    social:  2.5 * slow,
    fun:     2.0 * slow,
    hygiene: 1.5 * slow,
    comfort: 1.0 * slow,
    safety:  0.5 * slow,
  };
}

// ── Mood / Emotion ──────────────────────────────────────────────────

export type Emotion =
  | 'neutral' | 'happy' | 'excited' | 'sad' | 'angry'
  | 'scared' | 'flirty' | 'confident' | 'tired' | 'inspired';

export interface MoodState {
  primary: Emotion;
  intensity: number;   // 0-100
  moodlets: Moodlet[];
}

export interface Moodlet {
  id: string;
  label: string;
  emotion: Emotion;
  magnitude: number;   // added to intensity
  expiresAt: number;   // unix ms
}

// Derive current mood from needs and active moodlets
export function deriveMood(needs: PlayerNeeds, moodlets: Moodlet[]): MoodState {
  const now = Date.now();
  const active = moodlets.filter(m => m.expiresAt > now);

  const needScore =
    (needs.hunger + needs.rest + needs.social + needs.fun + needs.comfort) / 5;

  let primary: Emotion = 'neutral';
  if (needs.rest < 20) primary = 'tired';
  else if (needs.hunger < 20) primary = 'sad';
  else if (needs.safety < 20) primary = 'scared';
  else if (active.length > 0) primary = active[0].emotion;
  else if (needScore >= 75) primary = 'happy';
  else if (needScore >= 50) primary = 'neutral';
  else primary = 'sad';

  const moodletIntensity = active.reduce((sum, m) => sum + m.magnitude, 0);
  const intensity = Math.min(100, Math.round(needScore + moodletIntensity));

  return { primary, intensity, moodlets: active };
}

// Mood-derived gameplay modifiers
export function moodModifiers(mood: MoodState) {
  const base = mood.intensity / 100;
  return {
    xpBonus: mood.primary === 'inspired' ? 0.25 : mood.primary === 'happy' ? 0.10 : 0,
    socialBonus: mood.primary === 'flirty' ? 15 : mood.primary === 'confident' ? 10 : 0,
    combatPenalty: mood.primary === 'tired' ? 0.15 : mood.primary === 'scared' ? 0.10 : 0,
    craftBonus: mood.primary === 'inspired' ? 0.20 : 0,
    base,
  };
}

// ── Player Perk ─────────────────────────────────────────────────────
// Fallout-style perks unlock at level milestones.

export interface Perk {
  id: string;
  name: string;
  description: string;
  requires: Partial<SPECIALStats>;
  minLevel: number;
  effect: PerkEffect;
}

export interface PerkEffect {
  statBonus?: Partial<SPECIALStats>;
  damageMultiplier?: number;
  critMultiplier?: number;
  carryBonus?: number;
  speechBonus?: number;
  xpMultiplier?: number;
  specialAbility?: string;   // id of unlocked ability
}

// ── Full Player State ────────────────────────────────────────────────

export interface PlayerStats {
  level: number;
  xp: number;
  xpToNextLevel: number;
  special: SPECIALStats;
  needs: PlayerNeeds;
  mood: MoodState;
  perks: Perk[];
  karma: number;         // -1000 to 1000
  health: number;
  stamina: number;
}

export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.15, level - 1));
}

export function createDefaultPlayerStats(): PlayerStats {
  const special = { ...DEFAULT_SPECIAL };
  const derived = deriveStats(special);
  const needs = { ...DEFAULT_NEEDS };
  const mood = deriveMood(needs, []);
  return {
    level: 1,
    xp: 0,
    xpToNextLevel: xpToNextLevel(1),
    special,
    needs,
    mood,
    perks: [],
    karma: 0,
    health: derived.maxHealth,
    stamina: derived.maxStamina,
  };
}
