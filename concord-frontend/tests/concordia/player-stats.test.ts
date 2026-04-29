import { describe, it, expect } from 'vitest';
import {
  deriveStats, DEFAULT_SPECIAL, deriveMood, needsDecayRates,
  DEFAULT_NEEDS, createDefaultPlayerStats, xpToNextLevel,
} from '@/lib/concordia/player-stats';
import { applyKarmaAction, karmaToTier, createDefaultKarmaState } from '@/lib/concordia/karma';

describe('SPECIAL derived stats', () => {
  it('max health scales with endurance', () => {
    const low  = deriveStats({ ...DEFAULT_SPECIAL, endurance: 1 });
    const high = deriveStats({ ...DEFAULT_SPECIAL, endurance: 10 });
    expect(high.maxHealth).toBeGreaterThan(low.maxHealth);
  });

  it('VATS AP pool scales with agility', () => {
    const low  = deriveStats({ ...DEFAULT_SPECIAL, agility: 1 });
    const high = deriveStats({ ...DEFAULT_SPECIAL, agility: 10 });
    expect(high.vatsApPool).toBeGreaterThan(low.vatsApPool);
  });

  it('move speed multiplier scales with agility', () => {
    const low  = deriveStats({ ...DEFAULT_SPECIAL, agility: 1 });
    const high = deriveStats({ ...DEFAULT_SPECIAL, agility: 10 });
    expect(high.moveSpeedMultiplier).toBeGreaterThan(low.moveSpeedMultiplier);
  });

  it('speech chance scales with charisma', () => {
    const low  = deriveStats({ ...DEFAULT_SPECIAL, charisma: 1 });
    const high = deriveStats({ ...DEFAULT_SPECIAL, charisma: 10 });
    expect(high.speechChance).toBeGreaterThan(low.speechChance);
  });
});

describe('Sims needs system', () => {
  it('deriveMood returns tired when rest < 20', () => {
    const needs = { ...DEFAULT_NEEDS, rest: 10 };
    const mood = deriveMood(needs, []);
    expect(mood.primary).toBe('tired');
  });

  it('deriveMood returns happy when all needs are high', () => {
    const needs = { hunger: 90, rest: 90, social: 90, fun: 90, hygiene: 90, comfort: 90, safety: 90 };
    const mood = deriveMood(needs, []);
    expect(mood.primary).toBe('happy');
  });

  it('needsDecayRates are slower with high endurance', () => {
    const low  = needsDecayRates(1);
    const high = needsDecayRates(10);
    expect(high.hunger).toBeLessThan(low.hunger);
  });
});

describe('Karma system', () => {
  it('helping NPC increases karma', () => {
    const state = createDefaultKarmaState();
    const after = applyKarmaAction(state, 'helped_npc');
    expect(after.global).toBeGreaterThan(0);
  });

  it('attacking innocent decreases karma', () => {
    const state = createDefaultKarmaState();
    const after = applyKarmaAction(state, 'attacked_innocent');
    expect(after.global).toBeLessThan(0);
  });

  it('karma is clamped to -1000..1000', () => {
    let state = createDefaultKarmaState();
    for (let i = 0; i < 100; i++) state = applyKarmaAction(state, 'helped_npc');
    expect(state.global).toBeLessThanOrEqual(1000);
    state = createDefaultKarmaState();
    for (let i = 0; i < 100; i++) state = applyKarmaAction(state, 'attacked_innocent');
    expect(state.global).toBeGreaterThanOrEqual(-1000);
  });

  it('karmaToTier classifies correctly', () => {
    expect(karmaToTier(900)).toBe('saint');
    expect(karmaToTier(500)).toBe('good');
    expect(karmaToTier(0)).toBe('neutral');
    expect(karmaToTier(-500)).toBe('evil');
    expect(karmaToTier(-900)).toBe('demon');
  });

  it('faction reputation updates independently', () => {
    const state = createDefaultKarmaState();
    const after = applyKarmaAction(state, 'helped_npc', 'merchants');
    expect(after.factions['merchants']?.score).toBeGreaterThan(0);
    // A single +10 action is still in the neutral band (±249); verify score exists
    expect(after.factions['merchants']?.factionId).toBe('merchants');
    // Large positive reputation should shift standing to friendly
    let bigState = createDefaultKarmaState();
    for (let i = 0; i < 30; i++) bigState = applyKarmaAction(bigState, 'helped_npc', 'merchants');
    expect(['friendly', 'ally', 'hero']).toContain(bigState.factions['merchants']?.standing);
  });
});

describe('Player stats init', () => {
  it('creates default stats without errors', () => {
    const stats = createDefaultPlayerStats();
    expect(stats.level).toBe(1);
    expect(stats.health).toBeGreaterThan(0);
    expect(stats.stamina).toBeGreaterThan(0);
    expect(stats.karma).toBe(0);
  });

  it('xpToNextLevel increases with level', () => {
    expect(xpToNextLevel(2)).toBeGreaterThan(xpToNextLevel(1));
    expect(xpToNextLevel(10)).toBeGreaterThan(xpToNextLevel(5));
  });
});
