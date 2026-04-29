import { describe, it, expect } from 'vitest';

// Mirrors server/lib/skill-progression.js — keep in sync
function computeLevelFromExperience(totalExp: number): number {
  return 1 + Math.log10(1 + totalExp / 10);
}

const MASTERY_THRESHOLDS = [
  { level: 10,   badge: 'novice' },
  { level: 25,   badge: 'adept' },
  { level: 50,   badge: 'skilled' },
  { level: 100,  badge: 'expert' },
  { level: 200,  badge: 'master' },
  { level: 500,  badge: 'legendary' },
  { level: 1000, badge: 'mythic' },
  { level: 5000, badge: 'transcendent' },
];

function getMasteryBadge(level: number): string {
  let badge = 'unranked';
  for (const m of MASTERY_THRESHOLDS) {
    if (level >= m.level) badge = m.badge;
    else break;
  }
  return badge;
}

describe('computeLevelFromExperience', () => {
  it('starts at level 1 with 0 experience', () => {
    expect(computeLevelFromExperience(0)).toBe(1);
  });

  it('level increases with more experience', () => {
    const l1 = computeLevelFromExperience(100);
    const l2 = computeLevelFromExperience(1000);
    const l3 = computeLevelFromExperience(100000);
    expect(l2).toBeGreaterThan(l1);
    expect(l3).toBeGreaterThan(l2);
  });

  it('has no hard cap — very high experience gives higher level than low experience', () => {
    const lowLevel  = computeLevelFromExperience(100);
    const highLevel = computeLevelFromExperience(1_000_000_000);
    expect(highLevel).toBeGreaterThan(lowLevel);
    // log10(1 + 1e9/10) ≈ 8, so level ≈ 9 — unbounded but logarithmically slow
    expect(highLevel).toBeGreaterThan(5);
  });

  it('growth slows at higher experience (diminishing returns)', () => {
    const delta1 = computeLevelFromExperience(1000)  - computeLevelFromExperience(0);
    const delta2 = computeLevelFromExperience(100000) - computeLevelFromExperience(99000);
    expect(delta1).toBeGreaterThan(delta2);
  });
});

describe('Mastery markers', () => {
  it('returns unranked below level 10', () => {
    expect(getMasteryBadge(5)).toBe('unranked');
  });

  it('returns novice at level 10', () => {
    expect(getMasteryBadge(10)).toBe('novice');
  });

  it('returns master at level 200', () => {
    expect(getMasteryBadge(200)).toBe('master');
  });

  it('returns mythic at level 1000', () => {
    expect(getMasteryBadge(1000)).toBe('mythic');
  });

  it('returns transcendent at level 5000', () => {
    expect(getMasteryBadge(5000)).toBe('transcendent');
  });
});
