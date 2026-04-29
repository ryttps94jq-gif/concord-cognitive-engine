import { describe, it, expect } from 'vitest';
import { computeVATSTargets, regenAP, queueVATSShot, exitVATS, createVATSState } from '@/lib/concordia/combat/vats';
import { isOnCooldown, cooldownProgress } from '@/lib/concordia/combat/hotbar';
import { DEFAULT_SPECIAL } from '@/lib/concordia/player-stats';
import type { CombatSkill } from '@/lib/concordia/combat/hotbar';

describe('VATS targeting', () => {
  it('computes hit chances for all body parts', () => {
    const targets = [{ id: 'e1', name: 'Bandit', distance: 5, health: 80 }];
    const vatsTargets = computeVATSTargets(targets, DEFAULT_SPECIAL);
    expect(vatsTargets).toHaveLength(1);
    expect(vatsTargets[0].bodyParts).toHaveLength(6);
    for (const bp of vatsTargets[0].bodyParts) {
      expect(bp.hitChance).toBeGreaterThan(0);
      expect(bp.hitChance).toBeLessThanOrEqual(95);
      expect(bp.apCost).toBeGreaterThan(0);
    }
  });

  it('head hit chance is lower than torso', () => {
    const targets = [{ id: 'e1', name: 'Bandit', distance: 3, health: 100 }];
    const vats = computeVATSTargets(targets, DEFAULT_SPECIAL);
    const torso = vats[0].bodyParts.find(b => b.part === 'torso')!;
    const head  = vats[0].bodyParts.find(b => b.part === 'head')!;
    expect(torso.hitChance).toBeGreaterThan(head.hitChance);
  });

  it('head hit has higher damage multiplier than torso', () => {
    const targets = [{ id: 'e1', name: 'Bandit', distance: 3, health: 100 }];
    const vats = computeVATSTargets(targets, DEFAULT_SPECIAL);
    const torso = vats[0].bodyParts.find(b => b.part === 'torso')!;
    const head  = vats[0].bodyParts.find(b => b.part === 'head')!;
    expect(head.damageMultiplier).toBeGreaterThan(torso.damageMultiplier);
  });

  it('AP regens over time', () => {
    const state = createVATSState(DEFAULT_SPECIAL);
    const depleted = { ...state, ap: 0 };
    const regened = regenAP(depleted, 1); // 1 second
    expect(regened.ap).toBeCloseTo(20, 1); // 20 AP/s
  });

  it('AP does not regen while VATS active', () => {
    const state = { ...createVATSState(DEFAULT_SPECIAL), active: true, ap: 10 };
    const after = regenAP(state, 1);
    expect(after.ap).toBe(10);
  });

  it('queuing a shot costs AP', () => {
    const state = createVATSState(DEFAULT_SPECIAL);
    const after = queueVATSShot(state, 'e1', 'torso', 8);
    expect(after.ap).toBe(state.ap - 8);
    expect(after.queuedShots).toHaveLength(1);
  });

  it('cannot queue shot when AP insufficient', () => {
    const state = { ...createVATSState(DEFAULT_SPECIAL), ap: 5 };
    const after = queueVATSShot(state, 'e1', 'torso', 8);
    expect(after.queuedShots).toHaveLength(0);
    expect(after.ap).toBe(5);
  });

  it('exitVATS clears queue and active flag', () => {
    const state = { ...createVATSState(DEFAULT_SPECIAL), active: true };
    const after = queueVATSShot(state, 'e1', 'head', 15);
    const exited = exitVATS(after);
    expect(exited.active).toBe(false);
    expect(exited.queuedShots).toHaveLength(0);
  });
});

describe('Hotbar cooldown', () => {
  const makeSkill = (lastUsedAt: number, cooldownMs: number): CombatSkill => ({
    dtuId: 'test', name: 'Test', description: '', cooldownMs, staminaCost: 10,
    apCost: 5, damageRange: [5, 10], range: 'melee', targetType: 'single',
    animationClip: 'attack', derivedFrom: [], lastUsedAt,
  });

  it('skill is on cooldown immediately after use', () => {
    const skill = makeSkill(Date.now(), 3000);
    expect(isOnCooldown(skill)).toBe(true);
  });

  it('skill is off cooldown after cooldown expires', () => {
    const skill = makeSkill(Date.now() - 4000, 3000);
    expect(isOnCooldown(skill)).toBe(false);
  });

  it('cooldown progress is 0 immediately after use', () => {
    const skill = makeSkill(Date.now(), 3000);
    expect(cooldownProgress(skill)).toBeLessThan(0.1);
  });

  it('cooldown progress is 1 after cooldown expires', () => {
    const skill = makeSkill(Date.now() - 5000, 3000);
    expect(cooldownProgress(skill)).toBe(1);
  });
});
