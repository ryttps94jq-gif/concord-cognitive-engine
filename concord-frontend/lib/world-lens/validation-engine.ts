/**
 * World Lens — Physics Validation Engine
 *
 * Bridge between Physics lens computations and the World Engine.
 * Runs structural, wind, seismic, thermal, fire, and habitability tests.
 *
 * Real-time mode: simplified Euler-Bernoulli beam theory (< 100ms).
 * Full validation mode: comprehensive test suite for publish.
 */

import type {
  BuildingDTU,
  District,
  MaterialDTU,
  StructuralMember,
  ValidationReport,
  ValidationCategory,
  MemberResult,
  FailurePoint,
  HabitabilityFactors,
  PhysicsFeedback,
} from './types';

// ── Constants ───────────────────────────────────────────────────────

const SAFETY_FACTOR = 1.5;
const GRAVITY = 9.81; // m/s²
const _AIR_DENSITY = 1.225; // kg/m³
const GREEN_THRESHOLD = 0.7;
const WIND_PRESSURE_COEFF = 0.613; // 0.5 * air_density for dynamic pressure

// ── Material Cache ──────────────────────────────────────────────────

const materialCache = new Map<string, MaterialDTU>();

export function cacheMaterials(materials: MaterialDTU[]) {
  for (const m of materials) {
    materialCache.set(m.id, m);
  }
}

function getMaterial(id: string): MaterialDTU | undefined {
  return materialCache.get(id);
}

// ── Real-Time Physics Feedback (< 100ms) ────────────────────────────

/**
 * Simplified beam theory for interactive building feedback.
 * Runs on every structural member placement or modification.
 */
export function computeRealtimeFeedback(
  members: StructuralMember[],
  materials: MaterialDTU[]
): PhysicsFeedback[] {
  // Cache materials for fast lookup
  const matMap = new Map(materials.map(m => [m.id, m]));
  const feedback: PhysicsFeedback[] = [];

  // Calculate load path from roof to foundation
  const loadMap = computeLoadDistribution(members);

  for (const member of members) {
    const mat = matMap.get(member.materialId);
    if (!mat) {
      feedback.push({
        memberId: member.id,
        status: 'red',
        ratio: Infinity,
        tooltip: 'No material assigned to this member.',
      });
      continue;
    }

    const appliedLoad = loadMap.get(member.id) || 0;
    const area = member.crossSectionArea || (member.dimensions.width * member.dimensions.height);

    // Actual stress = applied load / cross-section area
    const actualStress = area > 0 ? appliedLoad / area / 1e6 : 0; // Convert to MPa

    // Allowable stress based on member type
    const allowableStress = getAllowableStress(member.type, mat) / SAFETY_FACTOR;

    const ratio = allowableStress > 0 ? actualStress / allowableStress : 0;

    let status: 'green' | 'yellow' | 'red';
    let tooltip: string;

    if (ratio < GREEN_THRESHOLD) {
      status = 'green';
      tooltip = `Within limits (${(ratio * 100).toFixed(0)}% capacity)`;
    } else if (ratio <= 1.0) {
      status = 'yellow';
      const suggestion = getSuggestion(member, mat, ratio);
      tooltip = `Approaching ${member.type} limit. ${suggestion}`;
    } else {
      status = 'red';
      tooltip = `Exceeds ${mat.name} ${member.type === 'beam' ? 'tensile' : 'compressive'} strength at this span. Increase cross-section or upgrade material.`;
    }

    feedback.push({ memberId: member.id, status, ratio, tooltip });
  }

  return feedback;
}

// ── Full Validation Engine ──────────────────────────────────────────

export function validateStructure(
  building: BuildingDTU,
  districtContext: District,
  materials: MaterialDTU[]
): ValidationReport {
  const matMap = new Map(materials.map(m => [m.id, m]));
  const allMembers = [...building.foundations, ...building.members];

  const loadBearing = validateLoadBearing(allMembers, matMap);
  const windShear = validateWindShear(allMembers, matMap, districtContext.weather);
  const seismic = validateSeismic(allMembers, matMap, districtContext);
  const thermal = validateThermal(allMembers, matMap, districtContext.weather);
  const fire = validateFire(allMembers, matMap);
  const habitability = computeHabitability(building);

  const failurePoints: FailurePoint[] = [];

  // Collect failure points from all categories
  for (const cat of [loadBearing, windShear, seismic, thermal, fire]) {
    for (const detail of cat.details) {
      if (detail.status === 'red') {
        const member = allMembers.find(m => m.id === detail.memberId);
        failurePoints.push({
          memberId: detail.memberId,
          memberType: detail.memberType,
          failureMode: getFailureMode(detail),
          actualLoad: detail.actualStress,
          allowableLoad: detail.allowableStress,
          location: member?.position || { x: 0, y: 0, z: 0 },
          suggestion: getSuggestionForFailure(detail, member),
        });
      }
    }
  }

  const overallPass = loadBearing.pass && windShear.pass && seismic.pass &&
    thermal.pass && fire.pass;

  return {
    overallPass,
    categories: {
      loadBearing,
      windShear,
      seismic,
      thermal,
      fire,
      habitability: { score: habitability.score, factors: habitability.factors },
    },
    failurePoints,
    timestamp: new Date().toISOString(),
  };
}

// ── Load Bearing Validation ─────────────────────────────────────────

function validateLoadBearing(
  members: StructuralMember[],
  matMap: Map<string, MaterialDTU>
): ValidationCategory {
  const details: MemberResult[] = [];
  const loadMap = computeLoadDistribution(members);

  for (const member of members) {
    const mat = matMap.get(member.materialId);
    if (!mat) continue;

    const appliedLoad = loadMap.get(member.id) || 0;
    const area = member.crossSectionArea || (member.dimensions.width * member.dimensions.height);
    const actualStress = area > 0 ? appliedLoad / area / 1e6 : 0;
    const allowableStress = getAllowableStress(member.type, mat) / SAFETY_FACTOR;
    const ratio = allowableStress > 0 ? actualStress / allowableStress : 0;

    details.push({
      memberId: member.id,
      memberType: member.type,
      actualStress,
      allowableStress,
      ratio,
      status: ratio < GREEN_THRESHOLD ? 'green' : ratio <= 1.0 ? 'yellow' : 'red',
    });
  }

  return {
    pass: details.every(d => d.ratio <= 1.0),
    details,
  };
}

// ── Wind Shear Validation ───────────────────────────────────────────

function validateWindShear(
  members: StructuralMember[],
  matMap: Map<string, MaterialDTU>,
  weather: District['weather']
): ValidationCategory & { maxWindSurvived: number } {
  const details: MemberResult[] = [];
  const windSpeed = weather.avgWindSpeed;
  // Dynamic pressure: q = 0.5 * rho * v^2
  const windPressure = WIND_PRESSURE_COEFF * windSpeed * windSpeed; // Pa

  let maxSurvived = windSpeed;

  for (const member of members) {
    const mat = matMap.get(member.materialId);
    if (!mat) continue;

    // Lateral force = wind pressure * exposed area
    const exposedArea = member.dimensions.height * member.dimensions.width;
    const lateralForce = windPressure * exposedArea;
    const area = member.crossSectionArea || (member.dimensions.width * member.dimensions.height);
    const actualStress = area > 0 ? lateralForce / area / 1e6 : 0;
    const allowableStress = mat.properties.shearStrength / SAFETY_FACTOR;
    const ratio = allowableStress > 0 ? actualStress / allowableStress : 0;

    if (ratio <= 1.0) {
      // Calculate max wind this member can survive
      const maxForce = allowableStress * 1e6 * area;
      const maxWindPressure = exposedArea > 0 ? maxForce / exposedArea : Infinity;
      const memberMaxWind = Math.sqrt(maxWindPressure / WIND_PRESSURE_COEFF);
      maxSurvived = Math.min(maxSurvived, memberMaxWind);
    }

    details.push({
      memberId: member.id,
      memberType: member.type,
      actualStress,
      allowableStress,
      ratio,
      status: ratio < GREEN_THRESHOLD ? 'green' : ratio <= 1.0 ? 'yellow' : 'red',
    });
  }

  return {
    pass: details.every(d => d.ratio <= 1.0),
    maxWindSurvived: maxSurvived,
    details,
  };
}

// ── Seismic Validation ──────────────────────────────────────────────

function validateSeismic(
  members: StructuralMember[],
  matMap: Map<string, MaterialDTU>,
  district: District
): ValidationCategory & { maxMagnitude: number } {
  const details: MemberResult[] = [];
  const seismicZone = district.weather.seismicRisk;

  // Lateral acceleration as % of gravity based on seismic zone
  const seismicCoeff = getSeismicCoefficient(seismicZone);

  const maxMagnitude = seismicZone;

  for (const member of members) {
    const mat = matMap.get(member.materialId);
    if (!mat) continue;

    // Self-weight of member
    const volume = member.dimensions.length * member.dimensions.width * member.dimensions.height;
    const weight = volume * mat.properties.density * GRAVITY;

    // Seismic lateral force = weight * seismic coefficient
    const lateralForce = weight * seismicCoeff;
    const area = member.crossSectionArea || (member.dimensions.width * member.dimensions.height);
    const actualStress = area > 0 ? lateralForce / area / 1e6 : 0;
    const allowableStress = mat.properties.shearStrength / SAFETY_FACTOR;
    const ratio = allowableStress > 0 ? actualStress / allowableStress : 0;

    details.push({
      memberId: member.id,
      memberType: member.type,
      actualStress,
      allowableStress,
      ratio,
      status: ratio < GREEN_THRESHOLD ? 'green' : ratio <= 1.0 ? 'yellow' : 'red',
    });
  }

  return {
    pass: details.every(d => d.ratio <= 1.0),
    maxMagnitude,
    details,
  };
}

// ── Thermal Validation ──────────────────────────────────────────────

function validateThermal(
  members: StructuralMember[],
  matMap: Map<string, MaterialDTU>,
  weather: District['weather']
): ValidationCategory & { tempRange: { min: number; max: number } } {
  const details: MemberResult[] = [];
  const tempRange = weather.seasonalRange;
  const deltaT = tempRange.max - tempRange.min;

  for (const member of members) {
    const mat = matMap.get(member.materialId);
    if (!mat) continue;

    // Thermal strain = alpha * deltaT
    // Thermal stress = E * alpha * deltaT (if restrained)
    const thermalStress = mat.properties.elasticModulus * 1e3 * // GPa to MPa
      mat.properties.thermalExpansionCoeff * deltaT;

    const allowableStress = mat.properties.tensileStrength / SAFETY_FACTOR;
    const ratio = allowableStress > 0 ? Math.abs(thermalStress) / allowableStress : 0;

    details.push({
      memberId: member.id,
      memberType: member.type,
      actualStress: Math.abs(thermalStress),
      allowableStress,
      ratio,
      status: ratio < GREEN_THRESHOLD ? 'green' : ratio <= 1.0 ? 'yellow' : 'red',
    });
  }

  return {
    pass: details.every(d => d.ratio <= 1.0),
    tempRange,
    details,
  };
}

// ── Fire Validation ─────────────────────────────────────────────────

function validateFire(
  members: StructuralMember[],
  matMap: Map<string, MaterialDTU>
): ValidationCategory & { resistanceHours: number } {
  const details: MemberResult[] = [];
  const requiredHours = 2; // Default building code requirement
  let minResistance = Infinity;

  for (const member of members) {
    const mat = matMap.get(member.materialId);
    if (!mat) continue;

    const fireHours = mat.properties.fireResistanceHours;
    minResistance = Math.min(minResistance, fireHours);
    const ratio = requiredHours > 0 ? requiredHours / Math.max(fireHours, 0.01) : 0;

    details.push({
      memberId: member.id,
      memberType: member.type,
      actualStress: fireHours, // Repurpose field: actual fire resistance
      allowableStress: requiredHours, // Required fire resistance
      ratio: ratio > 1 ? ratio : ratio * GREEN_THRESHOLD, // Invert for display
      status: fireHours >= requiredHours ? 'green' : fireHours >= requiredHours * 0.75 ? 'yellow' : 'red',
    });
  }

  return {
    pass: minResistance >= requiredHours,
    resistanceHours: minResistance === Infinity ? 0 : minResistance,
    details,
  };
}

// ── Habitability Scoring ────────────────────────────────────────────

function computeHabitability(building: BuildingDTU): { score: number; factors: HabitabilityFactors } {
  const walls = building.members.filter(m => m.type === 'wall');
  const floors = building.members.filter(m => m.type === 'floor');

  // Natural light: estimate from wall count (proxy for windows)
  const wallCount = walls.length;
  const floorArea = floors.reduce((sum, f) => sum + f.dimensions.length * f.dimensions.width, 0);
  const windowArea = wallCount * 1.5; // Assume 1.5m² window per wall segment
  const naturalLight = floorArea > 0 ? Math.min(100, (windowArea / floorArea) * 100 * 5) : 50;

  // Space per occupant (assuming 1 person per 10m² floor)
  const occupants = Math.max(1, floorArea / 10);
  const spacePerOccupant = Math.min(100, (floorArea / occupants) * 5);

  // Noise isolation: based on wall thickness
  const avgWallThickness = walls.length > 0
    ? walls.reduce((sum, w) => sum + w.dimensions.width, 0) / walls.length
    : 0.15;
  const noiseIsolation = Math.min(100, avgWallThickness * 400);

  // Thermal comfort: based on wall insulation (proxy)
  const thermalComfort = Math.min(100, avgWallThickness * 300);

  // Air quality: based on volume/person
  const avgHeight = walls.length > 0
    ? walls.reduce((sum, w) => sum + w.dimensions.height, 0) / walls.length
    : 2.7;
  const volume = floorArea * avgHeight;
  const airQuality = Math.min(100, (volume / occupants) * 3);

  // Aesthetics: material variety + proportions
  const uniqueMaterials = new Set(building.members.map(m => m.materialId)).size;
  const aesthetics = Math.min(100, uniqueMaterials * 20);

  const factors: HabitabilityFactors = {
    naturalLight,
    spacePerOccupant,
    noiseIsolation,
    thermalComfort,
    airQuality,
    aesthetics,
  };

  const score = (
    naturalLight * 0.2 +
    spacePerOccupant * 0.2 +
    noiseIsolation * 0.15 +
    thermalComfort * 0.2 +
    airQuality * 0.15 +
    aesthetics * 0.1
  );

  return { score: Math.round(score), factors };
}

// ── Helper Functions ────────────────────────────────────────────────

function computeLoadDistribution(members: StructuralMember[]): Map<string, number> {
  const loadMap = new Map<string, number>();

  // Sort by Z position (top to bottom) for gravity load path
  const sorted = [...members].sort((a, b) => b.position.z - a.position.z);

  for (const member of sorted) {
    const mat = getMaterial(member.materialId) || materialCache.values().next().value;
    if (!mat) {
      loadMap.set(member.id, 0);
      continue;
    }

    // Self-weight
    const volume = member.dimensions.length * member.dimensions.width * member.dimensions.height;
    const selfWeight = volume * mat.properties.density * GRAVITY;

    // Accumulated load from members above (connected)
    let accumulatedLoad = selfWeight;
    for (const connId of member.connections) {
      accumulatedLoad += (loadMap.get(connId) || 0) * 0.5; // Distribute to connections
    }

    // Live load for floors (2.4 kN/m² residential)
    if (member.type === 'floor') {
      accumulatedLoad += 2400 * member.dimensions.length * member.dimensions.width;
    }

    // Snow load for roof
    if (member.type === 'roof') {
      accumulatedLoad += 1200 * member.dimensions.length * member.dimensions.width;
    }

    loadMap.set(member.id, accumulatedLoad);
  }

  return loadMap;
}

function getAllowableStress(memberType: string, mat: MaterialDTU): number {
  switch (memberType) {
    case 'beam':
    case 'roof':
      return mat.properties.tensileStrength;
    case 'column':
    case 'foundation':
    case 'wall':
      return mat.properties.compressiveStrength;
    case 'brace':
      return mat.properties.shearStrength;
    case 'floor':
      return mat.properties.tensileStrength * 0.8; // Bending
    default:
      return mat.properties.tensileStrength;
  }
}

function getSeismicCoefficient(magnitude: number): number {
  // Simplified mapping of seismic zone/magnitude to lateral coefficient
  if (magnitude <= 3) return 0.05;
  if (magnitude <= 5) return 0.10;
  if (magnitude <= 6) return 0.20;
  if (magnitude <= 7) return 0.30;
  return 0.40;
}

function getSuggestion(member: StructuralMember, mat: MaterialDTU, ratio: number): string {
  if (member.type === 'beam') {
    const maxSpan = (member.dimensions.length * (1 / ratio)).toFixed(1);
    return `Reduce span to ${maxSpan}m or upgrade material.`;
  }
  if (member.type === 'column') {
    const minDiam = (member.dimensions.width * Math.sqrt(ratio)).toFixed(2);
    return `Increase column diameter to ${minDiam}m or switch to stronger material.`;
  }
  return `Reduce load or increase cross-section.`;
}

function getFailureMode(result: MemberResult): string {
  if (result.memberType === 'beam') return 'Tensile failure - beam overstressed in bending';
  if (result.memberType === 'column') return 'Compressive failure - column buckled';
  if (result.memberType === 'wall') return 'Compressive failure - wall overstressed';
  if (result.memberType === 'foundation') return 'Foundation bearing capacity exceeded';
  return 'Structural member overstressed';
}

function getSuggestionForFailure(result: MemberResult, member?: StructuralMember): string {
  const overBy = ((result.ratio - 1) * 100).toFixed(0);
  if (!member) return `Load exceeds capacity by ${overBy}%.`;

  if (member.type === 'beam') {
    return `Reduce span from ${member.dimensions.length}m or increase beam depth.`;
  }
  if (member.type === 'column') {
    const newSize = (member.dimensions.width * Math.sqrt(result.ratio) * 1.1).toFixed(2);
    return `Increase column size from ${(member.dimensions.width * 100).toFixed(0)}cm to ${(parseFloat(newSize) * 100).toFixed(0)}cm.`;
  }
  return `Increase cross-section by ${overBy}% or upgrade material.`;
}
