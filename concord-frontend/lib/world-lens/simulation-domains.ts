/**
 * World Lens — Simulation Domain Modules
 *
 * 20 domain modules that plug into the validation engine.
 * Each module provides domain-specific calculations and validation tests.
 */

import type { District, MaterialDTU, StructuralMember, MemberResult } from './types';

// ── Domain Module Interface ─────────────────────────────────────────

export interface DomainModule {
  id: string;
  name: string;
  priority: number;
  description: string;
  validate: (members: StructuralMember[], materials: Map<string, MaterialDTU>, district: District) => MemberResult[];
  calculate: (params: Record<string, number>) => Record<string, number>;
}

// ── 1. Structural Engineering (Priority 1) ──────────────────────────

export const structuralModule: DomainModule = {
  id: 'structural',
  name: 'Structural Engineering',
  priority: 1,
  description: 'Beam theory, column analysis, connection design, load path tracing, foundation design',
  validate: (members, materials, district) => {
    const results: MemberResult[] = [];
    for (const member of members) {
      const mat = materials.get(member.materialId);
      if (!mat) continue;
      const vol = member.dimensions.length * member.dimensions.width * member.dimensions.height;
      const selfWeight = vol * mat.properties.density * 9.81;
      const liveLoad = member.type === 'floor' ? 2400 * member.dimensions.length * member.dimensions.width : 0;
      const snowLoad = member.type === 'roof' ? district.weather.snowLoad * 47.88 * member.dimensions.length * member.dimensions.width : 0;
      const totalLoad = selfWeight + liveLoad + snowLoad;
      const area = member.crossSectionArea || (member.dimensions.width * member.dimensions.height);
      const stress = area > 0 ? totalLoad / area / 1e6 : 0;
      const allowable = (member.type === 'column' || member.type === 'wall'
        ? mat.properties.compressiveStrength
        : mat.properties.tensileStrength) / 1.5;
      const ratio = allowable > 0 ? stress / allowable : 0;
      results.push({
        memberId: member.id, memberType: member.type,
        actualStress: stress, allowableStress: allowable, ratio,
        status: ratio < 0.7 ? 'green' : ratio <= 1.0 ? 'yellow' : 'red',
      });
    }
    return results;
  },
  calculate: (params) => {
    const { span, width, height, elasticModulus, load } = params;
    const I = (width * height ** 3) / 12; // Moment of inertia (rectangular)
    const maxDeflection = (5 * load * span ** 4) / (384 * elasticModulus * 1e9 * I);
    const maxStress = (load * span) / (8 * width * height ** 2 / 6) / 1e6;
    return { momentOfInertia: I, maxDeflection, maxStress };
  },
};

// ── 2. Infrastructure Networks (Priority 2) ─────────────────────────

export const infrastructureModule: DomainModule = {
  id: 'infrastructure',
  name: 'Infrastructure Networks',
  priority: 2,
  description: 'Water distribution, electrical grid, drainage, roads',
  validate: () => [],
  calculate: (params) => {
    // Water: Hazen-Williams pressure drop
    const { pipeLength, pipeDiameter, flowRate, roughnessCoeff } = params;
    const C = roughnessCoeff || 130;
    const d = pipeDiameter || 0.15;
    const L = pipeLength || 100;
    const Q = flowRate || 0.01;
    // Simplified Hazen-Williams: hf = 10.67 * L * Q^1.852 / (C^1.852 * d^4.87)
    const headLoss = 10.67 * L * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * Math.pow(d, 4.87));

    // Electrical: voltage drop
    const { conductorLength, current, resistance } = params;
    const voltageDrop = (conductorLength || 100) * (current || 10) * (resistance || 0.003);

    // Drainage: Manning's equation
    const { slope, hydraulicRadius, manningN } = params;
    const n = manningN || 0.013;
    const S = slope || 0.01;
    const R = hydraulicRadius || 0.1;
    const velocity = (1 / n) * Math.pow(R, 2 / 3) * Math.pow(S, 0.5);

    return { headLoss, voltageDrop, drainageVelocity: velocity };
  },
};

// ── 3. Energy Systems (Priority 3) ──────────────────────────────────

export const energyModule: DomainModule = {
  id: 'energy',
  name: 'Energy Systems',
  priority: 3,
  description: 'Solar panels, wind turbines, power storage, grid connection',
  validate: () => [],
  calculate: (params) => {
    // Solar: P = A * eff * irradiance * cloud_factor
    const { panelArea, efficiency, irradiance, cloudFactor, tiltAngle } = params;
    const tiltFactor = Math.cos((Math.abs((tiltAngle || 30) - 35)) * Math.PI / 180);
    const solarOutput = (panelArea || 20) * (efficiency || 0.22) * (irradiance || 1000) * (cloudFactor || 0.75) * tiltFactor;

    // Wind: P = 0.5 * rho * A * v^3 * Cp
    const { sweptArea, windSpeed, airDensity, powerCoeff } = params;
    const rho = airDensity || 1.225;
    const Cp = powerCoeff || 0.4;
    const windOutput = 0.5 * rho * (sweptArea || 50) * Math.pow(windSpeed || 8, 3) * Cp;

    // Battery
    const { batteryCapacity, chargeRate, dischargeRate, cycleLife } = params;
    const batteryLifeYears = (cycleLife || 5000) / 365;

    return { solarOutput, windOutput, batteryLifeYears: batteryLifeYears || 0, totalGeneration: solarOutput + windOutput };
  },
};

// ── 4. Agriculture (Priority 4) ─────────────────────────────────────

export const agricultureModule: DomainModule = {
  id: 'agriculture',
  name: 'Agriculture',
  priority: 4,
  description: 'Greenhouse design, irrigation, vertical farming, crop yield',
  validate: () => [],
  calculate: (params) => {
    const { growingArea, lightHours, temperature, waterSupply, nutrientLevel } = params;
    const area = growingArea || 100;
    const tempFactor = 1 - Math.abs((temperature || 22) - 22) * 0.03;
    const lightFactor = Math.min(1, (lightHours || 12) / 16);
    const waterFactor = Math.min(1, (waterSupply || 5) / 6);
    const nutrientFactor = Math.min(1, (nutrientLevel || 80) / 100);
    const yieldPerM2 = 4.5 * tempFactor * lightFactor * waterFactor * nutrientFactor; // kg/m²/month
    const totalYield = area * yieldPerM2;
    const irrigationRate = area * 6; // L/day
    const heatingLoad = area * 0.05 * Math.max(0, 18 - (temperature || 22)); // kW

    return { yieldPerM2, totalYield, irrigationRate, heatingLoad };
  },
};

// ── 5. Transport (Priority 5) ───────────────────────────────────────

export const transportModule: DomainModule = {
  id: 'transport',
  name: 'Transport',
  priority: 5,
  description: 'Road networks, rail, bridges, traffic flow',
  validate: () => [],
  calculate: (params) => {
    const { lanes, throughputPerLane, bridgeSpan, vehicleWeight } = params;
    const roadCapacity = (lanes || 2) * (throughputPerLane || 1800); // vehicles/hour
    const bridgeLoad = (vehicleWeight || 3500) * 9.81; // N
    return { roadCapacity, bridgeLoad };
  },
};

// ── 6. Vehicle Design (Priority 6) ──────────────────────────────────

export const vehicleModule: DomainModule = {
  id: 'vehicle',
  name: 'Vehicle Design',
  priority: 6,
  description: 'Chassis, engine, suspension, tire grip validation',
  validate: () => [],
  calculate: (params) => {
    const { chassisWeight, enginePower, gripCoeff, maxSpeed } = params;
    const accel = (enginePower || 100) * 1000 / (chassisWeight || 1500); // m/s²
    const brakingDist = Math.pow(maxSpeed || 30, 2) / (2 * (gripCoeff || 0.8) * 9.81);
    return { acceleration: accel, brakingDistance: brakingDist };
  },
};

// ── 7. Thermal & HVAC (Priority 7) ──────────────────────────────────

export const thermalHvacModule: DomainModule = {
  id: 'thermal-hvac',
  name: 'Thermal & HVAC',
  priority: 7,
  description: 'Building envelope, HVAC sizing, energy consumption',
  validate: () => [],
  calculate: (params) => {
    const { wallArea, wallRValue, windowArea, windowUValue, deltaT, occupants, equipmentWatts } = params;
    // Envelope heat loss: Q = U * A * ΔT
    const wallLoss = (wallArea || 200) / (wallRValue || 3.5) * (deltaT || 25); // W
    const windowLoss = (windowArea || 30) * (windowUValue || 2.0) * (deltaT || 25); // W
    const ventilationLoad = (occupants || 20) * 10 * (deltaT || 25); // W (10 L/s per person)
    const internalGains = (occupants || 20) * 120 + (equipmentWatts || 2000); // W
    const totalHeating = wallLoss + windowLoss + ventilationLoad;
    const totalCooling = internalGains + (windowArea || 30) * 200; // Solar gains estimate
    return { wallLoss, windowLoss, ventilationLoad, totalHeating, totalCooling, internalGains };
  },
};

// ── 8. Fluid Dynamics (Priority 8) ──────────────────────────────────

export const fluidDynamicsModule: DomainModule = {
  id: 'fluid-dynamics',
  name: 'Fluid Dynamics',
  priority: 8,
  description: 'Water flow, dam pressure, flood simulation, stormwater',
  validate: () => [],
  calculate: (params) => {
    const { damHeight, waterDensity, reservoirArea, rainfallIntensity, imperviousRatio, catchmentArea } = params;
    const rho = waterDensity || 1000;
    const h = damHeight || 10;
    // Hydrostatic pressure on dam face
    const hydrostaticPressure = rho * 9.81 * h; // Pa at base
    const hydrostaticForce = 0.5 * rho * 9.81 * h * h; // N/m width
    const reservoirVolume = (reservoirArea || 10000) * h * 0.4; // m³ (approximate)
    // Runoff
    const runoffVolume = (rainfallIntensity || 50) / 1000 * (catchmentArea || 100000) * (imperviousRatio || 0.6);
    return { hydrostaticPressure, hydrostaticForce, reservoirVolume, runoffVolume };
  },
};

// ── 9. Aerospace (Priority 9) ───────────────────────────────────────

export const aerospaceModule: DomainModule = {
  id: 'aerospace',
  name: 'Aerospace',
  priority: 9,
  description: 'Orbital mechanics, rocket equation, satellite coverage',
  validate: () => [],
  calculate: (params) => {
    const { structuralMass, propellantMass, exhaustVelocity, orbitalAltitude } = params;
    // Tsiolkovsky rocket equation: Δv = ve * ln(m0/mf)
    const m0 = (structuralMass || 5000) + (propellantMass || 20000);
    const mf = structuralMass || 5000;
    const ve = exhaustVelocity || 3000;
    const deltaV = ve * Math.log(m0 / mf);
    // Orbital period
    const R = 6371000 + (orbitalAltitude || 400) * 1000;
    const orbitalPeriod = 2 * Math.PI * Math.sqrt(R ** 3 / (6.674e-11 * 5.972e24));
    // Coverage radius (simplified)
    const coverageRadius = Math.sqrt(R ** 2 - 6371000 ** 2) / 1000; // km
    return { deltaV, orbitalPeriod: orbitalPeriod / 60, coverageRadius };
  },
};

// ── 10. Electronics (Priority 10) ───────────────────────────────────

export const electronicsModule: DomainModule = {
  id: 'electronics',
  name: 'Electronics',
  priority: 10,
  description: 'Circuit layout, panel sizing, wire gauge, smart grid',
  validate: () => [],
  calculate: (params) => {
    const { circuitLoad, breakerRating, wireLength, wireGauge, voltage } = params;
    const load = circuitLoad || 2000;
    const breaker = breakerRating || 20;
    const current = load / (voltage || 240);
    const isOverloaded = current > breaker;
    // Voltage drop: V = I * R * L * 2 (round trip)
    const resistancePerMeter = 0.0001 * (wireGauge || 12); // Simplified
    const vDrop = current * resistancePerMeter * (wireLength || 30) * 2;
    return { current, isOverloaded: isOverloaded ? 1 : 0, voltageDrop: vDrop };
  },
};

// ── 11. Ecological & Environmental (Priority 11) ────────────────────

export const ecologicalModule: DomainModule = {
  id: 'ecological',
  name: 'Ecological & Environmental',
  priority: 11,
  description: 'Environmental score, green infrastructure, carbon accounting',
  validate: () => [],
  calculate: (params) => {
    const { buildingDensity, greenSpaceRatio, industrialEmissions, energyUse, emissionFactor } = params;
    const densityScore = Math.max(0, 100 - (buildingDensity || 50) * 1.2);
    const greenScore = Math.min(100, (greenSpaceRatio || 0.2) * 300);
    const emissionScore = Math.max(0, 100 - (industrialEmissions || 0) * 10);
    const environmentalScore = (densityScore + greenScore + emissionScore) / 3;
    const carbonFootprint = (energyUse || 1000) * (emissionFactor || 0.5); // kg CO2
    return { environmentalScore, carbonFootprint, densityScore, greenScore };
  },
};

// ── 12. Disaster Simulation (Priority 12) ───────────────────────────

export const disasterModule: DomainModule = {
  id: 'disaster',
  name: 'Disaster Simulation',
  priority: 12,
  description: 'Earthquake, hurricane, flood, fire stress tests',
  validate: () => [],
  calculate: (params) => {
    const { earthquakeMagnitude, windCategory, rainfallMm, fireOriginBldg } = params;
    const seismicAccel = 0.05 * Math.pow(2, (earthquakeMagnitude || 5) - 3);
    const windSpeed = 33 + ((windCategory || 1) - 1) * 20; // m/s for hurricane category
    const floodDepth = Math.max(0, ((rainfallMm || 50) - 30) * 0.01); // m, simplified
    return { seismicAcceleration: seismicAccel, windSpeed, floodDepth };
  },
};

// ── 13. Social & Habitability (Priority 13) ─────────────────────────

export const socialModule: DomainModule = {
  id: 'social-habitability',
  name: 'Social & Habitability',
  priority: 13,
  description: 'Habitability scoring, population demand, livability',
  validate: () => [],
  calculate: (params) => {
    const { windowFloorRatio, areaPerPerson, wallMassSTC, tempInComfort, ventCFM } = params;
    const naturalLight = Math.min(100, (windowFloorRatio || 0.15) * 500);
    const space = Math.min(100, (areaPerPerson || 15) * 5);
    const noise = Math.min(100, (wallMassSTC || 40) * 2);
    const thermal = tempInComfort || 80;
    const airQuality = Math.min(100, (ventCFM || 15) * 5);
    const score = naturalLight * 0.2 + space * 0.2 + noise * 0.15 + thermal * 0.2 + airQuality * 0.15 + 50 * 0.1;
    return { naturalLight, space, noise, thermal, airQuality, habitabilityScore: score };
  },
};

// ── 14-20: Remaining Modules ────────────────────────────────────────

export const governanceModule: DomainModule = {
  id: 'governance', name: 'Governance & Policy', priority: 14,
  description: 'Building codes, policy DTUs, district governance',
  validate: () => [], calculate: (p) => ({ compliance: 1 }),
};

export const miningModule: DomainModule = {
  id: 'mining-geology', name: 'Mining & Geology', priority: 15,
  description: 'Subsurface exploration, mine shafts, extraction, processing',
  validate: () => [], calculate: (p) => {
    const oreGrade = p.oreGrade || 0.05;
    const extractionRate = (p.equipmentCapacity || 100) * oreGrade;
    return { extractionRate, powerDraw: (p.equipmentCapacity || 100) * 0.5 };
  },
};

export const communicationsModule: DomainModule = {
  id: 'communications', name: 'Communications & Networking', priority: 16,
  description: 'Cell towers, fiber, data centers, network topology',
  validate: () => [], calculate: (p) => {
    const { towerHeight, frequency, bandwidth, distance } = p;
    const coverageRadius = Math.sqrt(2 * 6371000 * (towerHeight || 30)) / 1000; // km
    const latency = (distance || 10) * 1000 / (2e8) * 1000; // ms
    return { coverageRadius, latency, bandwidth: bandwidth || 1000 };
  },
};

export const wasteModule: DomainModule = {
  id: 'waste-management', name: 'Waste Management', priority: 17,
  description: 'Landfill, recycling, waste-to-energy',
  validate: () => [], calculate: (p) => {
    const { population, wastePerCapita, recyclingRate } = p;
    const totalWaste = (population || 1000) * (wastePerCapita || 1.5); // kg/day
    const recycled = totalWaste * (recyclingRate || 0.3);
    const landfilled = totalWaste - recycled;
    return { totalWaste, recycled, landfilled };
  },
};

export const maritimeModule: DomainModule = {
  id: 'maritime', name: 'Maritime & Naval', priority: 18,
  description: 'Port infrastructure, ship buoyancy, channels, docks',
  validate: () => [], calculate: (p) => {
    const { hullVolume, waterDensity, cargoMass, hullMass } = p;
    const buoyantForce = (hullVolume || 500) * (waterDensity || 1025) * 9.81;
    const totalWeight = ((cargoMass || 10000) + (hullMass || 5000)) * 9.81;
    const freeboard = buoyantForce > totalWeight ? 1 : 0;
    return { buoyantForce, totalWeight, floats: freeboard };
  },
};

export const roboticsModule: DomainModule = {
  id: 'robotics', name: 'Robotics & Automation', priority: 19,
  description: 'Industrial robots, assembly lines, safety zones, warehousing',
  validate: () => [], calculate: (p) => {
    const { reachEnvelope, payloadCapacity, cycleTime, robotCount } = p;
    const throughput = (robotCount || 1) * 3600 / (cycleTime || 10); // units/hour
    return { throughput, safetyRadius: (reachEnvelope || 2) * 1.5 };
  },
};

export const defenseModule: DomainModule = {
  id: 'defense-security', name: 'Defense & Security', priority: 20,
  description: 'Fortification, emergency shelters, security perimeters',
  validate: () => [], calculate: (p) => {
    const { wallThickness, overpressure, blastDistance } = p;
    const resistanceRating = (wallThickness || 0.3) * 500; // kPa
    const requiredResistance = (overpressure || 50) * Math.pow(10 / (blastDistance || 10), 3);
    return { resistanceRating, requiredResistance, survives: resistanceRating >= requiredResistance ? 1 : 0 };
  },
};

// ── Module Registry ─────────────────────────────────────────────────

export const ALL_DOMAIN_MODULES: DomainModule[] = [
  structuralModule,
  infrastructureModule,
  energyModule,
  agricultureModule,
  transportModule,
  vehicleModule,
  thermalHvacModule,
  fluidDynamicsModule,
  aerospaceModule,
  electronicsModule,
  ecologicalModule,
  disasterModule,
  socialModule,
  governanceModule,
  miningModule,
  communicationsModule,
  wasteModule,
  maritimeModule,
  roboticsModule,
  defenseModule,
].sort((a, b) => a.priority - b.priority);

export function getModule(id: string): DomainModule | undefined {
  return ALL_DOMAIN_MODULES.find(m => m.id === id);
}
