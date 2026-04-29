/**
 * movement-styles.ts
 *
 * Per-character movement style system.
 * Each style is a config of animation multipliers applied on top of the
 * base procedural skeleton. Every character — player or NPC — has a
 * MovementStyle that makes them visually distinct.
 *
 * Styles can transition based on situation (idle, combat, fleeing, social).
 */

export type MovementStyle =
  | 'warrior'    // grounded, wide stance, deliberate steps
  | 'rogue'      // quick, low centre of gravity, darting
  | 'scholar'    // upright, quick shuffle, no combat idle
  | 'berserker'  // aggressive lean, rapid momentum, hard stops
  | 'guardian'   // slow, heavy step, planted
  | 'acrobat'    // exaggerated limb swing, light step
  | 'archer'     // upright walk, constant pan, back-pedal priority
  | 'merchant'   // casual, relaxed, no combat stance
  | 'patrol';    // rhythmic, symmetrical, alert head bob

export interface MovementStyleConfig {
  /** Animation cycle playback multiplier (1.0 = normal) */
  walkCycleSpeed:      number;
  /** Foot plant spread — 1.0 = default, >1 = wider stance */
  strideLengthScale:   number;
  /** Hip side-sway amplitude in radians (0 = rigid) */
  hipSwayAmplitude:    number;
  /** Arm forward/back swing amplitude in radians */
  armSwingAmplitude:   number;
  /** Head up/down bob frequency multiplier (1.0 = one bob per stride) */
  headBobFrequency:    number;
  /** Forward body lean in combat stance (radians) */
  combatStanceOffset:  number;
  /** How much upper body anticipates direction change (0–1) */
  turnAnimationBlend:  number;
  /** Chest rise/fall amplitude at idle */
  idleBreathScale:     number;
  /** Dodge animation variant */
  dodgeStyle:          'roll' | 'sidestep' | 'backflip' | 'slide';
}

export const MOVEMENT_STYLE_CONFIGS: Record<MovementStyle, MovementStyleConfig> = {
  warrior: {
    walkCycleSpeed:     0.85,
    strideLengthScale:  1.15,
    hipSwayAmplitude:   0.04,
    armSwingAmplitude:  0.25,
    headBobFrequency:   0.9,
    combatStanceOffset: 0.12,
    turnAnimationBlend: 0.5,
    idleBreathScale:    0.8,
    dodgeStyle:         'sidestep',
  },
  rogue: {
    walkCycleSpeed:     1.25,
    strideLengthScale:  0.9,
    hipSwayAmplitude:   0.06,
    armSwingAmplitude:  0.18,
    headBobFrequency:   1.3,
    combatStanceOffset: 0.08,
    turnAnimationBlend: 0.85,
    idleBreathScale:    0.6,
    dodgeStyle:         'roll',
  },
  scholar: {
    walkCycleSpeed:     1.15,
    strideLengthScale:  0.8,
    hipSwayAmplitude:   0.02,
    armSwingAmplitude:  0.12,
    headBobFrequency:   1.1,
    combatStanceOffset: 0.03,
    turnAnimationBlend: 0.4,
    idleBreathScale:    1.0,
    dodgeStyle:         'sidestep',
  },
  berserker: {
    walkCycleSpeed:     1.1,
    strideLengthScale:  1.25,
    hipSwayAmplitude:   0.08,
    armSwingAmplitude:  0.38,
    headBobFrequency:   1.0,
    combatStanceOffset: 0.22,
    turnAnimationBlend: 0.7,
    idleBreathScale:    1.2,
    dodgeStyle:         'slide',
  },
  guardian: {
    walkCycleSpeed:     0.7,
    strideLengthScale:  1.3,
    hipSwayAmplitude:   0.02,
    armSwingAmplitude:  0.15,
    headBobFrequency:   0.7,
    combatStanceOffset: 0.15,
    turnAnimationBlend: 0.3,
    idleBreathScale:    0.9,
    dodgeStyle:         'sidestep',
  },
  acrobat: {
    walkCycleSpeed:     1.2,
    strideLengthScale:  1.05,
    hipSwayAmplitude:   0.09,
    armSwingAmplitude:  0.42,
    headBobFrequency:   1.4,
    combatStanceOffset: 0.06,
    turnAnimationBlend: 0.9,
    idleBreathScale:    0.7,
    dodgeStyle:         'backflip',
  },
  archer: {
    walkCycleSpeed:     0.95,
    strideLengthScale:  0.95,
    hipSwayAmplitude:   0.03,
    armSwingAmplitude:  0.14,
    headBobFrequency:   1.0,
    combatStanceOffset: 0.05,
    turnAnimationBlend: 0.75,
    idleBreathScale:    0.65,
    dodgeStyle:         'sidestep',
  },
  merchant: {
    walkCycleSpeed:     0.9,
    strideLengthScale:  0.95,
    hipSwayAmplitude:   0.05,
    armSwingAmplitude:  0.2,
    headBobFrequency:   0.9,
    combatStanceOffset: 0.0,
    turnAnimationBlend: 0.35,
    idleBreathScale:    1.1,
    dodgeStyle:         'sidestep',
  },
  patrol: {
    walkCycleSpeed:     1.0,
    strideLengthScale:  1.0,
    hipSwayAmplitude:   0.03,
    armSwingAmplitude:  0.22,
    headBobFrequency:   1.0,
    combatStanceOffset: 0.10,
    turnAnimationBlend: 0.55,
    idleBreathScale:    0.85,
    dodgeStyle:         'sidestep',
  },
};

/** NPC occupation → default movement style */
const OCCUPATION_STYLE: Record<string, MovementStyle> = {
  blacksmith:   'warrior',
  guard:        'patrol',
  scholar:      'scholar',
  farmer:       'merchant',
  trader:       'merchant',
  builder:      'warrior',
  acrobat:      'acrobat',
  archer:       'archer',
  mage:         'scholar',
  rogue:        'rogue',
  berserker:    'berserker',
  guardian:     'guardian',
  generic:      'merchant',
};

/** NPC situation transitions. */
const SITUATION_TRANSITIONS: Record<MovementStyle, Partial<Record<string, MovementStyle>>> = {
  merchant:   { combat: 'warrior',    fleeing: 'rogue',   social: 'merchant' },
  scholar:    { combat: 'rogue',      fleeing: 'rogue',   social: 'scholar' },
  patrol:     { combat: 'warrior',    fleeing: 'patrol',  social: 'merchant' },
  warrior:    { combat: 'berserker',  fleeing: 'warrior', social: 'merchant' },
  rogue:      { combat: 'rogue',      fleeing: 'acrobat', social: 'merchant' },
  berserker:  { combat: 'berserker',  fleeing: 'berserker', social: 'merchant' },
  guardian:   { combat: 'guardian',   fleeing: 'guardian', social: 'merchant' },
  acrobat:    { combat: 'acrobat',    fleeing: 'acrobat', social: 'acrobat' },
  archer:     { combat: 'archer',     fleeing: 'rogue',   social: 'merchant' },
};

/**
 * Resolve a movement style from NPC occupation + situation.
 */
export function resolveNPCStyle(
  occupation: string,
  situation:  'idle' | 'combat' | 'fleeing' | 'social',
): MovementStyle {
  const base = OCCUPATION_STYLE[occupation.toLowerCase()] ?? 'merchant';
  if (situation === 'idle') return base;
  return SITUATION_TRANSITIONS[base]?.[situation] ?? base;
}

/**
 * Transition from current style given a trigger event.
 * Returns the new style (may be the same if no transition defined).
 */
export function transitionStyle(
  current: MovementStyle,
  trigger: string,       // e.g. 'combat', 'fleeing', 'social', 'idle'
): MovementStyle {
  return SITUATION_TRANSITIONS[current]?.[trigger] ?? current;
}

/** Lerp between two style configs for smooth transitions. */
export function lerpStyleConfigs(
  a:  MovementStyleConfig,
  b:  MovementStyleConfig,
  t:  number,
): MovementStyleConfig {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  return {
    walkCycleSpeed:     lerp(a.walkCycleSpeed,     b.walkCycleSpeed),
    strideLengthScale:  lerp(a.strideLengthScale,  b.strideLengthScale),
    hipSwayAmplitude:   lerp(a.hipSwayAmplitude,   b.hipSwayAmplitude),
    armSwingAmplitude:  lerp(a.armSwingAmplitude,   b.armSwingAmplitude),
    headBobFrequency:   lerp(a.headBobFrequency,    b.headBobFrequency),
    combatStanceOffset: lerp(a.combatStanceOffset,  b.combatStanceOffset),
    turnAnimationBlend: lerp(a.turnAnimationBlend,  b.turnAnimationBlend),
    idleBreathScale:    lerp(a.idleBreathScale,      b.idleBreathScale),
    dodgeStyle:         t < 0.5 ? a.dodgeStyle : b.dodgeStyle,
  };
}
