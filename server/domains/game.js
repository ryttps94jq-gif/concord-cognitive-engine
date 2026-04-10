// server/domains/game.js
export default function registerGameActions(registerLensAction) {
  registerLensAction("game", "balanceCheck", (ctx, artifact, _params) => {
    const units = artifact.data?.units || [];
    if (units.length < 2) return { ok: true, result: { message: "Add at least 2 game units with stats to check balance." } };
    const analyzed = units.map(u => { const hp = parseFloat(u.hp) || 100; const atk = parseFloat(u.attack) || 10; const def = parseFloat(u.defense) || 10; const spd = parseFloat(u.speed) || 10; const cost = parseFloat(u.cost) || 1; const power = (hp / 10 + atk + def + spd) / 4; const efficiency = cost > 0 ? power / cost : power; return { name: u.name, power: Math.round(power * 10) / 10, cost, efficiency: Math.round(efficiency * 10) / 10, stats: { hp, atk, def, spd } }; });
    const avgPower = analyzed.reduce((s, u) => s + u.power, 0) / analyzed.length;
    const variance = Math.sqrt(analyzed.reduce((s, u) => s + Math.pow(u.power - avgPower, 2), 0) / analyzed.length);
    return { ok: true, result: { units: analyzed.sort((a, b) => b.efficiency - a.efficiency), avgPower: Math.round(avgPower * 10) / 10, powerVariance: Math.round(variance * 10) / 10, balance: variance < avgPower * 0.15 ? "well-balanced" : variance < avgPower * 0.3 ? "slightly-unbalanced" : "needs-rebalancing", strongest: analyzed[0]?.name, weakest: analyzed[analyzed.length - 1]?.name } };
  });
  registerLensAction("game", "economySimulate", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const startGold = parseFloat(data.startingGold) || 100;
    const earnRate = parseFloat(data.goldPerMinute) || 5;
    const spendRate = parseFloat(data.avgSpendPerMinute) || 3;
    const inflationRate = parseFloat(data.inflationPercent) || 2;
    const minutes = parseInt(data.simulateMinutes) || 60;
    const timeline = [];
    let gold = startGold;
    for (let t = 0; t <= minutes; t += 5) {
      const inflation = 1 + (inflationRate / 100) * (t / 60);
      gold += (earnRate - spendRate * inflation) * 5;
      gold = Math.max(0, gold);
      if (t % 10 === 0) timeline.push({ minute: t, gold: Math.round(gold), inflation: Math.round(inflation * 100) / 100 });
    }
    return { ok: true, result: { startGold, earnRate, spendRate, inflationRate, finalGold: Math.round(gold), netFlow: Math.round(gold - startGold), timeline, sustainable: gold > startGold * 0.5, tip: gold < startGold * 0.3 ? "Economy deflating — increase earn rate or add gold sinks" : "Economy is stable" } };
  });
  registerLensAction("game", "levelCurve", (ctx, artifact, _params) => {
    const data = artifact.data || {};
    const maxLevel = parseInt(data.maxLevel) || 50;
    const baseXP = parseInt(data.baseXP) || 100;
    const growthFactor = parseFloat(data.growthFactor) || 1.5;
    const levels = [];
    let cumulative = 0;
    for (let l = 1; l <= maxLevel; l++) { const xp = Math.round(baseXP * Math.pow(growthFactor, l - 1)); cumulative += xp; levels.push({ level: l, xpRequired: xp, cumulativeXP: cumulative }); }
    return { ok: true, result: { maxLevel, baseXP, growthFactor, totalXPToMax: cumulative, levels: levels.filter((_, i) => i % Math.max(1, Math.floor(maxLevel / 10)) === 0 || i === levels.length - 1), midpointLevel: levels.find(l => l.cumulativeXP >= cumulative / 2)?.level, earlyGameFeels: growthFactor < 1.3 ? "slow-and-steady" : growthFactor < 1.8 ? "balanced" : "fast-start-hard-finish" } };
  });
  registerLensAction("game", "dropRateCalc", (ctx, artifact, _params) => {
    const dropRate = parseFloat(artifact.data?.dropRatePercent) || 5;
    const attempts = parseInt(artifact.data?.attempts) || 100;
    const rate = dropRate / 100;
    const expectedDrops = Math.round(attempts * rate * 10) / 10;
    const pAtLeastOne = 1 - Math.pow(1 - rate, attempts);
    const attemptsFor50 = Math.ceil(Math.log(0.5) / Math.log(1 - rate));
    const attemptsFor90 = Math.ceil(Math.log(0.1) / Math.log(1 - rate));
    const attemptsFor99 = Math.ceil(Math.log(0.01) / Math.log(1 - rate));
    return { ok: true, result: { dropRate: `${dropRate}%`, attempts, expectedDrops, probabilityAtLeastOne: `${Math.round(pAtLeastOne * 10000) / 100}%`, attemptsFor50Percent: attemptsFor50, attemptsFor90Percent: attemptsFor90, attemptsFor99Percent: attemptsFor99, pitySystemSuggestion: `Guarantee drop at ${attemptsFor90} attempts (90th percentile)` } };
  });
}
