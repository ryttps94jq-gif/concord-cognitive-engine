/**
 * character-physics.ts
 *
 * Pure functions for character-driven physics simulation.
 * No Three.js dependency — pure math, usable server-side too.
 *
 * Core idea: strength determines what you can swing effectively,
 * stamina determines how long you can do it, mass determines momentum.
 * A greatsword wielded by a low-strength character becomes a liability.
 */

export interface CharacterPhysicsProfile {
  mass:           number;  // kg — affects momentum / stopping distance
  strength:       number;  // 1–100
  agility:        number;  // 1–100 — affects turn speed, dodge distance
  maxStamina:     number;  // 1–100
  currentStamina: number;  // real-time (0..maxStamina)
}

/** Weapon mass registry (kg). */
export const WEAPON_MASS: Record<string, number> = {
  fists:      0,
  dagger:     0.5,
  shortsword: 1.2,
  sword:      2.0,
  greatSword: 4.5,
  axe:        2.8,
  greatAxe:   5.5,
  staff:      1.5,
  hammer:     3.2,
  warhammer:  6.0,
  bow:        0.8,
  crossbow:   3.5,
};

/** Default profile for a new character. */
export function defaultProfile(): CharacterPhysicsProfile {
  return { mass: 70, strength: 30, agility: 30, maxStamina: 100, currentStamina: 100 };
}

/**
 * Effective swing speed multiplier (0.3 – 1.5).
 *
 * Logic:
 *  - Weapon "effective strength" threshold: weaponMass * 10
 *  - At threshold exactly: ratio = 1.0 (normal swing)
 *  - Below threshold (weak for the weapon): < 1.0, bottoms at 0.3
 *  - Above threshold (over-powered for the weapon): > 1.0, caps at 1.5
 */
export function computeSwingSpeed(weaponMass: number, strength: number): number {
  if (weaponMass === 0) return Math.min(1.5, 1 + (strength - 30) / 70); // unarmed scales with strength
  const threshold = weaponMass * 10; // strength needed for "neutral" swing
  const ratio     = strength / threshold;
  return Math.max(0.3, Math.min(1.5, ratio));
}

/**
 * Stamina-driven movement speed multiplier (0.4 – 1.0).
 * At full stamina: 1.0.  At zero: 0.4 (exhaustion stagger).
 */
export function computeMoveSpeed(currentStamina: number, maxStamina: number): number {
  if (maxStamina <= 0) return 0.4;
  const ratio = Math.max(0, currentStamina) / maxStamina;
  // Linear except bottom 20% drops off sharply
  if (ratio > 0.2) return 0.4 + ratio * 0.6;
  return 0.4 * (ratio / 0.2); // 0 → 0.4 as ratio goes 0 → 0.2
}

/**
 * Momentum overshoot distance (metres) when stopping.
 * Heavier + faster → slides further before stopping.
 */
export function computeMomentumOvershoot(mass: number, currentSpeedMs: number): number {
  // Physical analogy: kinetic energy / resistance
  // Light characters (60kg) at 5m/s → ~0.3m overshoot
  // Heavy armored (120kg) at 12m/s → ~1.8m overshoot
  const massScale = mass / 70; // normalized to 70kg baseline
  return Math.max(0, massScale * currentSpeedMs * 0.025);
}

/** Stamina drain per action per second (or per event). */
const DRAIN_RATES: Record<string, number> = {
  sprint:  8,    // per second
  block:   5,    // per second while held
  dodge:   20,   // per event
  swing:   12,   // per event, scaled by weaponMass
};

/**
 * Drain stamina for an action.
 * Returns the amount drained (positive number).
 * For timed actions (sprint/block) pass dt in seconds.
 * For instant actions (dodge/swing) pass dt = 1.
 */
export function drainStamina(
  profile:    CharacterPhysicsProfile,
  action:     string,
  weaponMass: number,
  dt:         number,
): number {
  const base = DRAIN_RATES[action] ?? 0;
  const cost  = action === 'swing'
    ? base * (1 + weaponMass / 2) // heavier weapon = more drain
    : base * dt;
  profile.currentStamina = Math.max(0, profile.currentStamina - cost);
  return cost;
}

/**
 * Recover stamina over time.
 * 15/s base; halved during sprint; zero during an active swing.
 */
export function recoverStamina(
  profile:     CharacterPhysicsProfile,
  dt:          number,
  isSprinting: boolean,
  isSwinging:  boolean,
): number {
  if (isSwinging) return 0;
  const rate    = isSprinting ? 7.5 : 15;
  const gained  = rate * dt;
  profile.currentStamina = Math.min(profile.maxStamina, profile.currentStamina + gained);
  return gained;
}

/**
 * Returns true if the character is too exhausted to use this weapon effectively.
 * Threshold: stamina < 20% of max.
 */
export function isExhausted(profile: CharacterPhysicsProfile): boolean {
  return profile.currentStamina < profile.maxStamina * 0.2;
}

/**
 * Stamina exhaustion debuff: 50% damage reduction when exhausted.
 */
export function exhaustionDamageMultiplier(profile: CharacterPhysicsProfile): number {
  return isExhausted(profile) ? 0.5 : 1.0;
}
