// server/domains/sim.js
export default function registerSimActions(registerLensAction) {
  registerLensAction("sim", "scenarioRun", (ctx, artifact, _params) => {
    const state = artifact.data?.initialState || {};
    const rules = artifact.data?.rules || [];
    const steps = parseInt(artifact.data?.steps) || 10;
    if (Object.keys(state).length === 0) return { ok: true, result: { message: "Provide initialState object and rules to simulate." } };
    const history = [{ step: 0, state: { ...state } }];
    let current = { ...state };
    for (let i = 1; i <= Math.min(steps, 100); i++) {
      const next = { ...current };
      rules.forEach(rule => {
        const field = rule.field || rule.variable;
        if (!field || !(field in next)) return;
        const val = parseFloat(next[field]) || 0;
        if (rule.type === "growth" || rule.type === "multiply") {
          next[field] = Math.round(val * (1 + (parseFloat(rule.rate) || 0.1)) * 1000) / 1000;
        } else if (rule.type === "decay") {
          next[field] = Math.round(val * (1 - (parseFloat(rule.rate) || 0.1)) * 1000) / 1000;
        } else if (rule.type === "add") {
          next[field] = Math.round((val + (parseFloat(rule.value) || 1)) * 1000) / 1000;
        } else if (rule.type === "cap") {
          next[field] = Math.min(val, parseFloat(rule.max) || Infinity);
        } else if (rule.type === "floor") {
          next[field] = Math.max(val, parseFloat(rule.min) || 0);
        }
      });
      history.push({ step: i, state: { ...next } });
      current = next;
    }
    return { ok: true, result: { stepsRun: history.length - 1, initialState: history[0].state, finalState: current, deltas: Object.fromEntries(Object.keys(state).map(k => [k, { start: state[k], end: current[k], change: (parseFloat(current[k]) || 0) - (parseFloat(state[k]) || 0) }])), history: history.length <= 20 ? history : [history[0], ...history.filter((_, i) => i % Math.ceil(history.length / 10) === 0), history[history.length - 1]] } };
  });

  registerLensAction("sim", "parameterSweep", (ctx, artifact, _params) => {
    const base = artifact.data?.baseState || {};
    const param = artifact.data?.parameter || "";
    const range = artifact.data?.range || {};
    const rules = artifact.data?.rules || [];
    const steps = parseInt(artifact.data?.steps) || 10;
    if (!param) return { ok: true, result: { message: "Specify parameter, range {min, max, step}, baseState, and rules." } };
    const min = parseFloat(range.min) || 0;
    const max = parseFloat(range.max) || 10;
    const step = parseFloat(range.step) || 1;
    const results = [];
    for (let val = min; val <= max; val += step) {
      let current = { ...base, [param]: val };
      for (let s = 0; s < Math.min(steps, 50); s++) {
        const next = { ...current };
        rules.forEach(rule => {
          const field = rule.field;
          if (field && field in next) {
            const v = parseFloat(next[field]) || 0;
            if (rule.type === "growth") next[field] = Math.round(v * (1 + (parseFloat(rule.rate) || 0.1)) * 1000) / 1000;
            else if (rule.type === "decay") next[field] = Math.round(v * (1 - (parseFloat(rule.rate) || 0.1)) * 1000) / 1000;
            else if (rule.type === "add") next[field] = Math.round((v + (parseFloat(rule.value) || 1)) * 1000) / 1000;
          }
        });
        current = next;
      }
      results.push({ paramValue: val, finalState: current });
    }
    const outputField = Object.keys(base).find(k => k !== param) || param;
    return { ok: true, result: { parameter: param, sweepRange: { min, max, step }, runsCompleted: results.length, stepsPerRun: steps, results: results.map(r => ({ [param]: r.paramValue, outcome: r.finalState[outputField] })), bestOutcome: results.sort((a, b) => (parseFloat(b.finalState[outputField]) || 0) - (parseFloat(a.finalState[outputField]) || 0))[0] } };
  });

  registerLensAction("sim", "monteCarlo", (ctx, artifact, _params) => {
    const trials = Math.min(parseInt(artifact.data?.trials) || 1000, 10000);
    const variables = artifact.data?.variables || [];
    const formula = artifact.data?.formula || "sum";
    if (variables.length === 0) return { ok: true, result: { message: "Provide variables with {name, min, max} or {name, mean, stddev} for Monte Carlo." } };
    const results = [];
    for (let t = 0; t < trials; t++) {
      const vals = {};
      variables.forEach(v => {
        if (v.mean !== undefined && v.stddev !== undefined) {
          const u1 = Math.random(), u2 = Math.random();
          vals[v.name] = parseFloat(v.mean) + parseFloat(v.stddev) * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        } else {
          const min = parseFloat(v.min) || 0, max = parseFloat(v.max) || 1;
          vals[v.name] = min + Math.random() * (max - min);
        }
      });
      let outcome;
      if (formula === "sum") outcome = Object.values(vals).reduce((s, v) => s + v, 0);
      else if (formula === "product") outcome = Object.values(vals).reduce((s, v) => s * v, 1);
      else if (formula === "max") outcome = Math.max(...Object.values(vals));
      else if (formula === "min") outcome = Math.min(...Object.values(vals));
      else outcome = Object.values(vals).reduce((s, v) => s + v, 0);
      results.push(outcome);
    }
    results.sort((a, b) => a - b);
    const mean = results.reduce((s, v) => s + v, 0) / trials;
    const variance = results.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / trials;
    const p5 = results[Math.floor(trials * 0.05)];
    const p25 = results[Math.floor(trials * 0.25)];
    const p50 = results[Math.floor(trials * 0.50)];
    const p75 = results[Math.floor(trials * 0.75)];
    const p95 = results[Math.floor(trials * 0.95)];
    return { ok: true, result: { trials, formula, mean: Math.round(mean * 1000) / 1000, stddev: Math.round(Math.sqrt(variance) * 1000) / 1000, min: Math.round(results[0] * 1000) / 1000, max: Math.round(results[trials - 1] * 1000) / 1000, percentiles: { p5: Math.round(p5 * 1000) / 1000, p25: Math.round(p25 * 1000) / 1000, p50: Math.round(p50 * 1000) / 1000, p75: Math.round(p75 * 1000) / 1000, p95: Math.round(p95 * 1000) / 1000 }, confidenceInterval90: { lower: Math.round(p5 * 1000) / 1000, upper: Math.round(p95 * 1000) / 1000 } } };
  });

  registerLensAction("sim", "sensitivityAnalysis", (ctx, artifact, _params) => {
    const baseState = artifact.data?.baseState || {};
    const rules = artifact.data?.rules || [];
    const perturbation = parseFloat(artifact.data?.perturbation) || 10;
    const steps = parseInt(artifact.data?.steps) || 10;
    const fields = Object.keys(baseState).filter(k => !isNaN(parseFloat(baseState[k])));
    if (fields.length === 0) return { ok: true, result: { message: "Provide baseState with numeric fields and rules." } };
    const runSim = (state) => {
      let current = { ...state };
      for (let s = 0; s < steps; s++) {
        const next = { ...current };
        rules.forEach(rule => {
          const f = rule.field;
          if (f && f in next) {
            const v = parseFloat(next[f]) || 0;
            if (rule.type === "growth") next[f] = v * (1 + (parseFloat(rule.rate) || 0.1));
            else if (rule.type === "decay") next[f] = v * (1 - (parseFloat(rule.rate) || 0.1));
            else if (rule.type === "add") next[f] = v + (parseFloat(rule.value) || 1);
          }
        });
        current = next;
      }
      return current;
    };
    const baseline = runSim(baseState);
    const outputField = fields[fields.length - 1];
    const baselineOutput = parseFloat(baseline[outputField]) || 0;
    const sensitivity = fields.map(field => {
      const baseVal = parseFloat(baseState[field]) || 0;
      const delta = baseVal * (perturbation / 100);
      const upState = { ...baseState, [field]: baseVal + delta };
      const downState = { ...baseState, [field]: baseVal - delta };
      const upOutput = parseFloat(runSim(upState)[outputField]) || 0;
      const downOutput = parseFloat(runSim(downState)[outputField]) || 0;
      const outputChange = ((upOutput - downOutput) / 2);
      const elasticity = baselineOutput !== 0 ? Math.round((outputChange / baselineOutput) * 100 * 10) / 10 : 0;
      return { parameter: field, baseValue: baseVal, perturbation: `±${perturbation}%`, outputUp: Math.round(upOutput * 1000) / 1000, outputDown: Math.round(downOutput * 1000) / 1000, sensitivity: Math.round(Math.abs(elasticity) * 10) / 10, direction: elasticity > 0 ? "positive" : elasticity < 0 ? "negative" : "neutral" };
    }).sort((a, b) => b.sensitivity - a.sensitivity);
    return { ok: true, result: { outputField, baselineOutput: Math.round(baselineOutput * 1000) / 1000, perturbationPercent: perturbation, sensitivity, mostSensitive: sensitivity[0]?.parameter, leastSensitive: sensitivity[sensitivity.length - 1]?.parameter } };
  });
}
