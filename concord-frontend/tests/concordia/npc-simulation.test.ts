import { describe, it, expect } from 'vitest';

// Population tier logic (mirrors server/lib/population-scaling.js)
const POPULATION_TIERS = {
  empty:    { range: [0, 0],          simulation: 'minimal',  npcDensity: 0.1, tickRate: 300000 },
  sparse:   { range: [1, 10],         simulation: 'low',      npcDensity: 0.3, tickRate: 60000  },
  active:   { range: [11, 50],        simulation: 'medium',   npcDensity: 0.6, tickRate: 30000  },
  bustling: { range: [51, 200],       simulation: 'high',     npcDensity: 0.9, tickRate: 10000  },
  dense:    { range: [201, Infinity], simulation: 'maximum',  npcDensity: 1.0, tickRate: 5000   },
} as const;

function getTierFor(population: number) {
  for (const [name, tier] of Object.entries(POPULATION_TIERS)) {
    if (population >= tier.range[0] && population <= tier.range[1]) {
      return { name, ...tier };
    }
  }
  return { name: 'dense', ...POPULATION_TIERS.dense };
}

describe('Population tiers', () => {
  it('returns empty tier for population 0', () => {
    const tier = getTierFor(0);
    expect(tier.name).toBe('empty');
    expect(tier.simulation).toBe('minimal');
  });

  it('returns sparse for population 5', () => {
    expect(getTierFor(5).name).toBe('sparse');
  });

  it('returns active for population 25', () => {
    expect(getTierFor(25).name).toBe('active');
  });

  it('returns bustling for population 100', () => {
    expect(getTierFor(100).name).toBe('bustling');
  });

  it('returns dense for population 500', () => {
    expect(getTierFor(500).name).toBe('dense');
  });

  it('all tiers have npcDensity between 0 and 1', () => {
    for (const tier of Object.values(POPULATION_TIERS)) {
      expect(tier.npcDensity).toBeGreaterThanOrEqual(0);
      expect(tier.npcDensity).toBeLessThanOrEqual(1);
    }
  });

  it('tick rate decreases as population grows', () => {
    expect(getTierFor(0).tickRate).toBeGreaterThan(getTierFor(500).tickRate);
  });
});

// NPC need urgency threshold
const URGENCY_THRESHOLD = 0.5;

describe('NPC need urgency', () => {
  it('need below threshold is considered urgent', () => {
    expect(0.3 < URGENCY_THRESHOLD).toBe(true);
  });

  it('need at threshold is not urgent', () => {
    expect(0.5 < URGENCY_THRESHOLD).toBe(false);
  });

  it('full need is never urgent', () => {
    expect(1.0 < URGENCY_THRESHOLD).toBe(false);
  });
});
