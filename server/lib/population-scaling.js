// server/lib/population-scaling.js
// Population tier definitions and simulation density helpers.

export const POPULATION_TIERS = {
  empty:    { range: [0, 0],          simulation: "minimal",  npcDensity: 0.1, tickRate: 300000 },
  sparse:   { range: [1, 10],         simulation: "low",      npcDensity: 0.3, tickRate: 60000  },
  active:   { range: [11, 50],        simulation: "medium",   npcDensity: 0.6, tickRate: 30000  },
  bustling: { range: [51, 200],       simulation: "high",     npcDensity: 0.9, tickRate: 10000  },
  dense:    { range: [201, Infinity], simulation: "maximum",  npcDensity: 1.0, tickRate: 5000   },
};

/**
 * Return the tier descriptor for a given player population count.
 * @param {number} population
 * @returns {{ name: string, simulation: string, npcDensity: number, tickRate: number }}
 */
export function getTierFor(population) {
  for (const [name, tier] of Object.entries(POPULATION_TIERS)) {
    if (population >= tier.range[0] && population <= tier.range[1]) {
      return { name, ...tier };
    }
  }
  return { name: "dense", ...POPULATION_TIERS.dense };
}

/**
 * Calculate tick rate and NPC target counts for a world at a given player count.
 * @param {object} world
 * @param {number} playerCount
 * @returns {{ tickRate: number, targetNpcCount: number, tier: string, simulation: string }}
 */
export function adjustSimulationDensity(world, playerCount) {
  const tier = getTierFor(playerCount);
  const baseNpcCapacity = 50;
  const targetNpcCount  = Math.max(1, Math.floor(baseNpcCapacity * tier.npcDensity));

  return {
    tickRate:       tier.tickRate,
    targetNpcCount,
    tier:           tier.name,
    simulation:     tier.simulation,
  };
}
