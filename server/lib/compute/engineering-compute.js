// server/lib/compute/engineering-compute.js
/**
 * Engineering Compute — Structural, electrical, thermal, hydraulic.
 *
 * Real engineering calculations for building, mechanical, electrical,
 * and civil engineering applications. Called by the Oracle Engine for
 * deeper domain computation beyond the lightweight handlers in
 * server/domains/engineering.js.
 *
 * Each function is pure, takes plain parameters, and returns a result
 * of the form { value, unit, formula, inputs, margin?, warnings? }.
 * Edge cases return { error, inputs } instead of throwing.
 *
 * No external dependencies — only the native Math object.
 */

// --------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------

const PI = Math.PI;

function isNum(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function err(message, inputs) {
  return { error: message, inputs };
}

function ok(value, unit, formula, inputs, extra = {}) {
  return { value, unit, formula, inputs, warnings: [], ...extra };
}

function pushWarn(result, msg) {
  if (!Array.isArray(result.warnings)) result.warnings = [];
  result.warnings.push(msg);
  return result;
}

// --------------------------------------------------------------------
// Reference tables (conservative, code-aware but not code-certified)
// --------------------------------------------------------------------

// NEC-style AWG → copper/aluminum resistance (ohms per 1000 ft, 75°C).
const AWG_OHMS_PER_KFT = {
  copper: {
    14: 3.07, 12: 1.93, 10: 1.21, 8: 0.764, 6: 0.491,
    4: 0.308, 3: 0.245, 2: 0.194, 1: 0.154,
    "1/0": 0.122, "2/0": 0.0967, "3/0": 0.0766, "4/0": 0.0608,
    250: 0.0515, 300: 0.0429, 350: 0.0367, 400: 0.0321, 500: 0.0258,
  },
  aluminum: {
    14: 5.06, 12: 3.18, 10: 2.00, 8: 1.26, 6: 0.808,
    4: 0.508, 3: 0.403, 2: 0.319, 1: 0.253,
    "1/0": 0.201, "2/0": 0.159, "3/0": 0.126, "4/0": 0.100,
    250: 0.0847, 300: 0.0707, 350: 0.0605, 400: 0.0529, 500: 0.0424,
  },
};

// Wire ampacity (60°C insulation, copper) — rough NEC Table 310.16.
const AWG_AMPACITY_COPPER = {
  14: 15, 12: 20, 10: 30, 8: 40, 6: 55, 4: 70, 3: 85, 2: 95, 1: 110,
  "1/0": 125, "2/0": 145, "3/0": 165, "4/0": 195,
  250: 215, 300: 240, 350: 260, 400: 280, 500: 320,
};

// Standard breaker sizes (amps).
const STANDARD_BREAKERS = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150,
  175, 200, 225, 250, 300, 350, 400, 450, 500, 600,
];

// Wire cross-section areas for conduit fill (sq-in, THHN, approximate).
const THHN_AREA_SQIN = {
  14: 0.0097, 12: 0.0133, 10: 0.0211, 8: 0.0366, 6: 0.0507,
  4: 0.0824, 3: 0.0973, 2: 0.1158, 1: 0.1562,
  "1/0": 0.1855, "2/0": 0.2223, "3/0": 0.2679, "4/0": 0.3237,
};

// EMT internal area (sq-in) for 40% fill rule.
const EMT_AREA_SQIN = {
  "1/2": 0.304, "3/4": 0.533, 1: 0.864, "1-1/4": 1.496,
  "1-1/2": 2.036, 2: 3.356, "2-1/2": 5.858, 3: 8.846,
};

// --------------------------------------------------------------------
// STRUCTURAL
// --------------------------------------------------------------------

/**
 * Preliminary sizing of a reinforced concrete wall against lateral
 * wind load. Returns a factor of safety plus required thickness if
 * the provided section is insufficient.
 *
 * Units: imperial (mph, ft, in, psi).
 */
export function reinforcedConcreteWall({
  windMph,
  wallHeightFt,
  wallThicknessIn,
  concreteFc = 4000,
  rebarSpacingIn = 12,
  rebarSize = 5,
}) {
  const inputs = { windMph, wallHeightFt, wallThicknessIn, concreteFc, rebarSpacingIn, rebarSize };
  if (!isNum(windMph) || windMph < 0) return err("windMph must be ≥ 0", inputs);
  if (!isNum(wallHeightFt) || wallHeightFt <= 0) return err("wallHeightFt must be > 0", inputs);
  if (!isNum(wallThicknessIn) || wallThicknessIn <= 0) return err("wallThicknessIn must be > 0", inputs);
  if (!isNum(concreteFc) || concreteFc <= 0) return err("concreteFc must be > 0", inputs);

  // Velocity pressure (ASCE simplified): qz ≈ 0.00256 · V²  (psf)
  const qz = 0.00256 * windMph * windMph;
  // Assume Cp = 1.0 windward, GCf ≈ 0.85. Net pressure on wall:
  const loadPsf = qz * 1.0 * 0.85;

  // Shear capacity of concrete: Vc = 2·√fc' · b · d   (ACI 318, lb)
  // For a 12-inch strip (b = 12"), d = thickness − 1.5" cover.
  const b = 12;
  const d = Math.max(wallThicknessIn - 1.5, 0.1);
  const sqrtFc = Math.sqrt(concreteFc);
  const vcPerFt = 2 * sqrtFc * b * d; // lbf per 12" strip

  // Rebar contribution: As·fy, with #5 bar area 0.31 in², fy = 60000 psi.
  const rebarAreaTable = { 3: 0.11, 4: 0.20, 5: 0.31, 6: 0.44, 7: 0.60, 8: 0.79 };
  const As = rebarAreaTable[rebarSize] ?? 0.31;
  const fy = 60000;
  const barsPerFt = 12 / rebarSpacingIn;
  const vsPerFt = As * fy * barsPerFt * 0.6; // shear component (phi ≈ 0.6)

  const capacityLbPerFt = vcPerFt + vsPerFt;
  // Shear demand on a 1-ft strip over the full height.
  const demandLbPerFt = loadPsf * wallHeightFt;

  const factorOfSafety = demandLbPerFt > 0 ? capacityLbPerFt / demandLbPerFt : Infinity;
  // Back-solve required thickness for FoS = 2.0 from concrete alone.
  const targetVcPerFt = 2 * demandLbPerFt - vsPerFt;
  const requiredD = targetVcPerFt > 0 ? targetVcPerFt / (2 * sqrtFc * b) : 0;
  const requiredThickness = Math.max(requiredD + 1.5, 6);

  const result = ok(
    factorOfSafety,
    "ratio",
    "FoS = (Vc + Vs) / (q · h)",
    inputs,
    {
      loadPsf,
      capacityPsf: capacityLbPerFt / (wallHeightFt || 1),
      requiredThickness,
      shearDemandLbPerFt: demandLbPerFt,
      shearCapacityLbPerFt: capacityLbPerFt,
    },
  );
  if (factorOfSafety < 1) pushWarn(result, "wall fails under specified wind load");
  else if (factorOfSafety < 1.5) pushWarn(result, "factor of safety below 1.5 — consider thicker wall");
  if (wallThicknessIn < 6) pushWarn(result, "wall thinner than 6 in minimum for structural concrete");
  return result;
}

/**
 * Euler critical buckling load for a slender column.
 * Pcr = π² · E · I / (k·L)²
 * Inputs: kips, ft, psi, in⁴.
 */
export function columnBuckling({ loadKips, lengthFt, modulusE, momentI, kFactor = 1 }) {
  const inputs = { loadKips, lengthFt, modulusE, momentI, kFactor };
  if (!isNum(lengthFt) || !isNum(modulusE) || !isNum(momentI) || !isNum(kFactor)) {
    return err("lengthFt, modulusE, momentI, kFactor required", inputs);
  }
  if (lengthFt <= 0 || modulusE <= 0 || momentI <= 0 || kFactor <= 0) {
    return err("positive values required", inputs);
  }
  const Lin = lengthFt * 12;
  const effective = kFactor * Lin;
  const pcrLb = (PI * PI * modulusE * momentI) / (effective * effective);
  const pcrKips = pcrLb / 1000;

  let factorOfSafety = null;
  if (isNum(loadKips) && loadKips > 0) factorOfSafety = pcrKips / loadKips;

  const result = ok(pcrKips, "kips", "Pcr = π²EI/(kL)²", inputs, {
    criticalLoadLb: pcrLb,
    effectiveLengthIn: effective,
    factorOfSafety,
  });
  if (factorOfSafety !== null && factorOfSafety < 1.67) {
    pushWarn(result, "below AISC recommended FS of 1.67");
  }
  return result;
}

/**
 * Fillet weld strength, AWS D1.1. Allowable = 0.3 · Fexx · throat · length.
 * weldSize: leg size in inches, length: inches.
 */
export function weldStrength({ weldSize, length, material = "e70xx" }) {
  const inputs = { weldSize, length, material };
  if (!isNum(weldSize) || !isNum(length)) return err("numeric required", inputs);
  if (weldSize <= 0 || length <= 0) return err("positive values required", inputs);
  const fExxTable = { e60xx: 60, e70xx: 70, e80xx: 80, e90xx: 90 };
  const fExx = fExxTable[String(material).toLowerCase()] ?? 70; // ksi
  const throat = 0.707 * weldSize;
  const allowablePerInchKips = 0.3 * fExx * throat;
  const totalKips = allowablePerInchKips * length;
  return ok(totalKips, "kips", "V = 0.3·Fexx·0.707·w·L", inputs, {
    throatIn: throat,
    allowablePerInchKips,
    fExxKsi: fExx,
  });
}

/**
 * Bolted connection, AISC allowable shear. A325 group with ≈ 48 ksi
 * allowable shear (bearing type, threads included).
 */
export function boltedConnection({ boltDiameter, boltGrade = "a325", numBolts, loadType = "single" }) {
  const inputs = { boltDiameter, boltGrade, numBolts, loadType };
  if (!isNum(boltDiameter) || !isNum(numBolts)) return err("numeric required", inputs);
  if (boltDiameter <= 0 || numBolts <= 0) return err("positive values required", inputs);
  const fvTable = { a307: 24, a325: 48, a490: 60 }; // ksi, threads included
  const fv = fvTable[String(boltGrade).toLowerCase()] ?? 48;
  const area = (PI * boltDiameter * boltDiameter) / 4;
  const planes = loadType === "double" ? 2 : 1;
  const perBoltKips = fv * area * planes;
  const totalKips = perBoltKips * numBolts;
  return ok(totalKips, "kips", "R = Fv·Ab·n·planes", inputs, {
    shearPlanes: planes,
    perBoltKips,
    boltAreaSqIn: area,
  });
}

// --------------------------------------------------------------------
// ELECTRICAL
// --------------------------------------------------------------------

/**
 * Voltage drop along a conductor. Uses AWG resistance tables and
 * simple V = 2·I·R·L (single-phase round-trip).
 */
export function voltageDrop({ current, length, awg, material = "copper", voltage = 120, phase = 1 }) {
  const inputs = { current, length, awg, material, voltage, phase };
  if (!isNum(current) || !isNum(length)) return err("current, length numeric", inputs);
  if (current < 0 || length < 0) return err("non-negative required", inputs);
  const table = AWG_OHMS_PER_KFT[String(material).toLowerCase()];
  if (!table) return err(`unknown material: ${material}`, inputs);
  const key = typeof awg === "number" ? awg : String(awg);
  const rPerKft = table[key];
  if (!isNum(rPerKft)) return err(`unknown awg: ${awg}`, inputs);
  const rTotal = (rPerKft * length) / 1000;
  // Factor = 2 for single-phase round-trip, √3 for three-phase
  const factor = phase === 3 ? Math.sqrt(3) : 2;
  const vDrop = factor * current * rTotal;
  const percent = voltage > 0 ? (vDrop / voltage) * 100 : null;

  const result = ok(vDrop, "V", phase === 3 ? "Vd = √3·I·R·L" : "Vd = 2·I·R·L", inputs, {
    percent,
    resistanceOhms: rTotal,
    phase,
  });
  if (percent !== null && percent > 5) pushWarn(result, "voltage drop exceeds 5% (NEC recommendation)");
  else if (percent !== null && percent > 3) pushWarn(result, "voltage drop exceeds 3% on feeder (NEC suggestion)");
  return result;
}

/**
 * Size an overcurrent breaker for a given load. Continuous loads get
 * the 125 % factor per NEC 210.20.
 */
export function breakerSizing({ loadAmps, continuous = false, factor = 1.25 }) {
  const inputs = { loadAmps, continuous, factor };
  if (!isNum(loadAmps) || loadAmps < 0) return err("loadAmps ≥ 0 required", inputs);
  const mult = continuous ? factor : 1;
  const required = loadAmps * mult;
  const breaker = STANDARD_BREAKERS.find(b => b >= required) ?? STANDARD_BREAKERS[STANDARD_BREAKERS.length - 1];
  const result = ok(breaker, "A", continuous ? "I·1.25 → next standard" : "I → next standard", inputs, {
    requiredAmps: required,
    selectedBreakerAmps: breaker,
  });
  if (required > breaker) pushWarn(result, "load exceeds largest standard breaker in table");
  return result;
}

/**
 * Conduit fill, NEC chapter 9. Simple 40% fill check for three or more
 * current-carrying conductors.
 */
export function conduitFill({ wireCount, wireAWG, conduitType = "EMT", conduitSize = "1/2" }) {
  const inputs = { wireCount, wireAWG, conduitType, conduitSize };
  if (!isNum(wireCount) || wireCount <= 0) return err("wireCount > 0 required", inputs);
  const key = typeof wireAWG === "number" ? wireAWG : String(wireAWG);
  const wireArea = THHN_AREA_SQIN[key];
  if (!isNum(wireArea)) return err(`unknown wireAWG: ${wireAWG}`, inputs);
  const conduitArea = EMT_AREA_SQIN[String(conduitSize)];
  if (!isNum(conduitArea)) return err(`unknown conduitSize: ${conduitSize}`, inputs);
  const usedArea = wireArea * wireCount;
  const allowed = conduitArea * (wireCount >= 3 ? 0.40 : (wireCount === 2 ? 0.31 : 0.53));
  const fillPct = (usedArea / conduitArea) * 100;
  const ok_ = usedArea <= allowed;
  const result = ok(fillPct, "%", "usedArea / conduitArea", inputs, {
    usedSqIn: usedArea,
    allowedSqIn: allowed,
    conduitAreaSqIn: conduitArea,
    withinCode: ok_,
  });
  if (!ok_) pushWarn(result, "exceeds NEC chapter 9 fill limits");
  return result;
}

/**
 * Transformer sizing. Returns the required kVA plus a next-standard
 * kVA from the ANSI size ladder.
 */
export function transformerSizing({ loadKva, voltage, phase = 3, powerFactor = 0.9, growthFactor = 1.25 }) {
  const inputs = { loadKva, voltage, phase, powerFactor, growthFactor };
  if (!isNum(loadKva) || loadKva <= 0) return err("loadKva must be > 0", inputs);
  if (!isNum(voltage) || voltage <= 0) return err("voltage must be > 0", inputs);
  const required = loadKva * growthFactor;
  const ladder = [15, 30, 45, 75, 112.5, 150, 225, 300, 500, 750, 1000, 1500, 2000, 2500];
  const selected = ladder.find(k => k >= required) ?? ladder[ladder.length - 1];
  // Primary current from selected kVA.
  const primaryAmps =
    phase === 3
      ? (selected * 1000) / (Math.sqrt(3) * voltage)
      : (selected * 1000) / voltage;
  return ok(selected, "kVA", "kVA = loadKva · growth", inputs, {
    requiredKva: required,
    selectedKva: selected,
    primaryAmps,
    powerFactor,
  });
}

// --------------------------------------------------------------------
// THERMAL / HVAC
// --------------------------------------------------------------------

/**
 * Sensible heat load on a space. Q = (A / R) · ΔT + solarGain (BTU/h).
 */
export function heatLoadCalc({ areaSqft, rValue, deltaTemp, solarGain = 0 }) {
  const inputs = { areaSqft, rValue, deltaTemp, solarGain };
  if (!isNum(areaSqft) || !isNum(rValue) || !isNum(deltaTemp)) return err("numeric required", inputs);
  if (rValue <= 0) return err("rValue must be > 0", inputs);
  const conductive = (areaSqft * Math.abs(deltaTemp)) / rValue;
  const total = conductive + (isNum(solarGain) ? solarGain : 0);
  return ok(total, "BTU/h", "Q = A·ΔT/R + solar", inputs, {
    conductiveBtuH: conductive,
    solarBtuH: solarGain,
    tons: total / 12000,
  });
}

/**
 * Duct sizing from CFM and target velocity. A = CFM / v (ft²),
 * then convert to round diameter.
 */
export function ductSizing({ cfm, velocity = 1200 }) {
  const inputs = { cfm, velocity };
  if (!isNum(cfm) || cfm <= 0) return err("cfm must be > 0", inputs);
  if (!isNum(velocity) || velocity <= 0) return err("velocity must be > 0", inputs);
  const areaFt2 = cfm / velocity;
  const areaIn2 = areaFt2 * 144;
  const diameterIn = Math.sqrt((4 * areaIn2) / PI);
  const result = ok(diameterIn, "in", "D = √(4·A/π)", inputs, {
    areaSqFt: areaFt2,
    areaSqIn: areaIn2,
    velocityFpm: velocity,
  });
  if (velocity > 2000) pushWarn(result, "velocity above 2000 fpm — expect noise");
  if (velocity < 600) pushWarn(result, "velocity below 600 fpm — oversized duct");
  return result;
}

/**
 * Room cooling load estimation: a simplified residential approach.
 * Combines envelope, occupant, equipment, and window sensible gains.
 * Returns BTU/h and tons.
 */
export function coolingLoad({ roomSqft, occupants = 0, equipment = 0, windows = 0, deltaTemp = 20, rValue = 13 }) {
  const inputs = { roomSqft, occupants, equipment, windows, deltaTemp, rValue };
  if (!isNum(roomSqft) || roomSqft <= 0) return err("roomSqft > 0 required", inputs);
  if (!isNum(rValue) || rValue <= 0) return err("rValue > 0 required", inputs);
  const envelope = (roomSqft * Math.abs(deltaTemp)) / rValue;
  const people = occupants * 250; // ~250 BTU/h sensible per person
  const equip = equipment; // pass-through BTU/h
  const glassGain = windows * 30 * Math.abs(deltaTemp); // approx. U=0.5 · area · ΔT × factor
  const total = envelope + people + equip + glassGain;
  return ok(total, "BTU/h", "Q_total = envelope + people + equip + glass", inputs, {
    envelopeBtuH: envelope,
    peopleBtuH: people,
    equipBtuH: equip,
    glassBtuH: glassGain,
    tons: total / 12000,
  });
}

// --------------------------------------------------------------------
// HYDRAULIC / PLUMBING
// --------------------------------------------------------------------

/**
 * Pipe size from flow and target velocity.
 * A = Q / v. Returns internal diameter in inches.
 */
export function pipeSize({ flowGpm, velocity = 5 }) {
  const inputs = { flowGpm, velocity };
  if (!isNum(flowGpm) || flowGpm <= 0) return err("flowGpm > 0 required", inputs);
  if (!isNum(velocity) || velocity <= 0) return err("velocity > 0 required", inputs);
  // Q(gpm) → ft³/s : * 0.002228
  const qFt3s = flowGpm * 0.002228;
  const areaFt2 = qFt3s / velocity;
  const diameterFt = Math.sqrt((4 * areaFt2) / PI);
  const diameterIn = diameterFt * 12;
  const result = ok(diameterIn, "in", "D = √(4·Q/(π·v))", inputs, {
    areaSqFt: areaFt2,
    flowFt3PerSec: qFt3s,
    velocityFps: velocity,
  });
  if (velocity > 8) pushWarn(result, "velocity above 8 fps — erosion risk");
  return result;
}

/**
 * Pump brake horsepower: BHP = (Q·H·SG) / (3960·η).
 */
export function pumpHead({ flowGpm, totalDynamicHead, efficiency = 0.7, specificGravity = 1.0 }) {
  const inputs = { flowGpm, totalDynamicHead, efficiency, specificGravity };
  if (!isNum(flowGpm) || !isNum(totalDynamicHead) || !isNum(efficiency)) return err("numeric required", inputs);
  if (efficiency <= 0 || efficiency > 1) return err("efficiency between 0 and 1", inputs);
  if (flowGpm <= 0 || totalDynamicHead <= 0) return err("positive flow and head required", inputs);
  const whp = (flowGpm * totalDynamicHead * specificGravity) / 3960;
  const bhp = whp / efficiency;
  return ok(bhp, "hp", "BHP = Q·H·SG/(3960·η)", inputs, {
    waterHp: whp,
    efficiency,
    kW: bhp * 0.7457,
  });
}

/**
 * Darcy–Weisbach pressure loss in a round pipe. Estimates a friction
 * factor via Swamee–Jain when relative roughness is provided.
 * Units: in, gpm, ft, in → returns psi.
 */
export function pressureLoss({ pipeDiameter, flowGpm, length, roughness = 0.00015 }) {
  const inputs = { pipeDiameter, flowGpm, length, roughness };
  if (!isNum(pipeDiameter) || !isNum(flowGpm) || !isNum(length)) return err("numeric required", inputs);
  if (pipeDiameter <= 0 || length <= 0 || flowGpm < 0) return err("positive required", inputs);

  // Convert to SI for friction factor calc.
  const dM = pipeDiameter * 0.0254;
  const qM3s = flowGpm * 6.309e-5;
  const areaM2 = (PI * dM * dM) / 4;
  const vMs = qM3s / areaM2;

  // Water at 20°C: ρ = 998 kg/m³, μ = 1.002e-3 Pa·s.
  const re = (998 * vMs * dM) / 1.002e-3;
  const eps = roughness; // ft assumed same order of magnitude
  const epsOverD = eps / (pipeDiameter / 12); // both in ft
  // Swamee–Jain explicit friction factor.
  const f =
    re > 4000
      ? 0.25 /
        Math.pow(Math.log10(epsOverD / 3.7 + 5.74 / Math.pow(re, 0.9)), 2)
      : re > 0
      ? 64 / re
      : 0;

  const lengthM = length * 0.3048;
  const dpPa = f * (lengthM / dM) * 0.5 * 998 * vMs * vMs;
  const dpPsi = dpPa * 0.000145038;

  const result = ok(dpPsi, "psi", "ΔP = f·(L/D)·½·ρ·v²", inputs, {
    frictionFactor: f,
    reynolds: re,
    velocityMs: vMs,
    velocityFps: vMs * 3.28084,
  });
  if (vMs * 3.28084 > 8) pushWarn(result, "velocity above 8 fps");
  return result;
}

// --------------------------------------------------------------------
// Default export — Oracle registry
// --------------------------------------------------------------------

export default {
  reinforcedConcreteWall,
  columnBuckling,
  weldStrength,
  boltedConnection,
  voltageDrop,
  breakerSizing,
  conduitFill,
  transformerSizing,
  heatLoadCalc,
  ductSizing,
  coolingLoad,
  pipeSize,
  pumpHead,
  pressureLoss,
  tables: {
    AWG_OHMS_PER_KFT,
    AWG_AMPACITY_COPPER,
    STANDARD_BREAKERS,
    THHN_AREA_SQIN,
    EMT_AREA_SQIN,
  },
};
