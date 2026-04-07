/**
 * World Lens — Core Type Definitions
 *
 * All types for the simulation pipeline: districts, materials,
 * structures, validation, citations, marketplace, and creation modes.
 */

// ── Terrain & District ──────────────────────────────────────────────

export type SoilType = 'clay' | 'sand' | 'rock' | 'loam' | 'gravel';

export interface TerrainCell {
  soilType: SoilType;
  bedrockDepth: number; // meters
  waterTableDepth: number; // meters
  seismicZone: number; // 1-5
  elevation: number; // meters
}

export interface TerrainLayer {
  grid: TerrainCell[][];
  dimensions: { width: number; height: number };
}

export type ZoneType =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'education'
  | 'research'
  | 'agricultural'
  | 'mixed';

export interface ZoneDTU {
  id: string;
  type: ZoneType;
  densityLimit: number;
  buildingCodeRef: string; // DTU id
  creator: string;
}

export interface ZoningLayer {
  zones: ZoneDTU[];
}

export interface InfrastructureDTU {
  id: string;
  type: 'water' | 'power' | 'drainage' | 'road' | 'data';
  path: Array<{ x: number; y: number }>;
  capacity: number;
  creator: string;
  citations: number;
}

export interface WeatherProfile {
  baseTemperature: number;
  seasonalRange: { min: number; max: number };
  avgWindSpeed: number; // m/s
  avgWindDirection: number; // degrees
  annualRainfall: number; // mm
  snowLoad: number; // lb/sqft
  seismicRisk: number; // magnitude
}

export interface PlacedBuildingDTU {
  id: string;
  dtuId: string; // ref to BuildingDTU
  position: { x: number; y: number };
  rotation: number;
  validationStatus: ValidationStatus;
  creator: string;
  placedAt: string;
}

export interface District {
  id: string;
  name: string;
  terrain: TerrainLayer;
  zoning: ZoningLayer;
  infrastructure: {
    waterMains: InfrastructureDTU[];
    powerGrid: InfrastructureDTU[];
    drainage: InfrastructureDTU[];
    roads: InfrastructureDTU[];
    dataNetwork: InfrastructureDTU[];
  };
  weather: WeatherProfile;
  buildings: PlacedBuildingDTU[];
  environmentalScore: number; // 0-100
  populationCapacity: number;
  powerCapacity: number; // kW
  waterCapacity: number; // gallons/day
}

// ── Materials ───────────────────────────────────────────────────────

export type MaterialCategory =
  | 'USB-composite'
  | 'steel'
  | 'concrete'
  | 'wood'
  | 'glass'
  | 'polymer'
  | 'ceramic';

export type CorrosionResistance = 'low' | 'moderate' | 'high' | 'extreme';

export type MaterialValidationStatus = 'validated' | 'experimental' | 'superseded';

export interface MaterialProperties {
  tensileStrength: number; // MPa
  compressiveStrength: number; // MPa
  shearStrength: number; // MPa
  elasticModulus: number; // GPa
  density: number; // kg/m³
  thermalConductivity: number; // W/mK
  thermalExpansionCoeff: number; // per °C
  meltingPoint: number; // °C
  fireResistanceHours: number;
  corrosionResistance: CorrosionResistance;
  fatigueLimit: number; // MPa
  cost: number; // per unit volume
}

export interface MaterialDTU {
  id: string;
  name: string;
  category: MaterialCategory;
  properties: MaterialProperties;
  creator: string;
  citations: number;
  validationStatus: MaterialValidationStatus;
}

// ── Structural Members ──────────────────────────────────────────────

export type MemberType = 'beam' | 'column' | 'wall' | 'floor' | 'roof' | 'foundation' | 'brace';

export interface StructuralMember {
  id: string;
  type: MemberType;
  materialId: string;
  position: { x: number; y: number; z: number };
  dimensions: { length: number; width: number; height: number };
  rotation: number;
  crossSection: 'rectangular' | 'circular' | 'I-beam' | 'H-beam' | 'tube' | 'custom';
  crossSectionArea: number; // m²
  momentOfInertia: number; // m⁴
  connections: string[]; // ids of connected members
}

export interface BuildingDTU {
  id: string;
  name: string;
  description: string;
  category: BuildingCategory;
  members: StructuralMember[];
  foundations: StructuralMember[];
  systems: BuildingSystems;
  materialRefs: string[]; // material DTU ids
  creator: string;
  citations: number;
  validationReport?: ValidationReport;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export type BuildingCategory =
  | 'residential'
  | 'commercial'
  | 'office'
  | 'industrial'
  | 'education'
  | 'healthcare'
  | 'infrastructure'
  | 'energy'
  | 'agriculture'
  | 'transport'
  | 'custom';

export interface BuildingSystems {
  waterConnection?: { infrastructureId: string; distance: number };
  powerConnection?: { infrastructureId: string; distance: number };
  drainageConnection?: { infrastructureId: string; distance: number };
  dataConnection?: { infrastructureId: string; distance: number };
}

// ── Validation ──────────────────────────────────────────────────────

export type ValidationStatus = 'validated' | 'experimental' | 'superseded' | 'foundation' | 'at-risk';

export interface MemberResult {
  memberId: string;
  memberType: MemberType;
  actualStress: number; // MPa
  allowableStress: number; // MPa
  ratio: number; // actual / allowable
  status: 'green' | 'yellow' | 'red';
}

export interface FailurePoint {
  memberId: string;
  memberType: string;
  failureMode: string;
  actualLoad: number;
  allowableLoad: number;
  location: { x: number; y: number; z: number };
  suggestion: string;
}

export interface ValidationCategory {
  pass: boolean;
  details: MemberResult[];
}

export interface ValidationReport {
  overallPass: boolean;
  categories: {
    loadBearing: ValidationCategory;
    windShear: ValidationCategory & { maxWindSurvived: number };
    seismic: ValidationCategory & { maxMagnitude: number };
    thermal: ValidationCategory & { tempRange: { min: number; max: number } };
    fire: ValidationCategory & { resistanceHours: number };
    habitability: { score: number; factors: HabitabilityFactors };
  };
  failurePoints: FailurePoint[];
  timestamp: string;
}

export interface HabitabilityFactors {
  naturalLight: number; // 0-100
  spacePerOccupant: number; // 0-100
  noiseIsolation: number; // 0-100
  thermalComfort: number; // 0-100
  airQuality: number; // 0-100
  aesthetics: number; // 0-100
}

// ── Citations & Royalties ───────────────────────────────────────────

export interface Citation {
  id: string;
  citingDTU: string;
  citedDTU: string;
  citedCreator: string;
  timestamp: string;
  context: string; // e.g. "foundation", "beam", "power-connection"
}

export interface RoyaltyWeights {
  foundation: number;
  structuralFrame: number;
  utilities: number;
  materials: number;
  components: number;
}

// ── Marketplace ─────────────────────────────────────────────────────

export type ComponentCategory =
  | 'foundation'
  | 'beam'
  | 'wall-system'
  | 'roof-truss'
  | 'pipe-joint'
  | 'electrical-panel'
  | 'solar-array'
  | 'hvac-unit'
  | 'column'
  | 'bracket'
  | 'joint'
  | 'pipe-segment'
  | 'solar-mount';

export interface MarketplaceEntry {
  dtuId: string;
  name: string;
  category: ComponentCategory;
  creator: string;
  creatorHandle: string;
  validationStatus: MaterialValidationStatus;
  citationCount: number;
  performanceSpecs: Record<string, number>;
  materialRefs: string[];
  thumbnail: string;
  royaltyRate: number;
  publishedAt: string;
  tags: string[];
}

// ── Creation Modes ──────────────────────────────────────────────────

export type CreationMode = 'guided' | 'component' | 'raw';

export type GuidedStep =
  | 'intent'
  | 'foundation'
  | 'structure'
  | 'systems'
  | 'validation'
  | 'publish';

// ── Real-Time Physics Feedback ──────────────────────────────────────

export interface PhysicsFeedback {
  memberId: string;
  status: 'green' | 'yellow' | 'red';
  ratio: number;
  tooltip: string;
}

// ── Publish Flow ────────────────────────────────────────────────────

export type PublishTarget = 'district' | 'global-library' | 'private';

export interface PlacementCheck {
  zoning: { pass: boolean; message: string };
  infrastructure: { pass: boolean; message: string };
  buildingCode: { pass: boolean; message: string };
  structural: { pass: boolean; message: string };
  environmental: { pass: boolean; message: string };
}

// ── Simulation Domains ──────────────────────────────────────────────

export type SimulationDomain =
  | 'structural'
  | 'infrastructure'
  | 'energy'
  | 'agriculture'
  | 'transport'
  | 'vehicle'
  | 'thermal-hvac'
  | 'fluid-dynamics'
  | 'aerospace'
  | 'electronics'
  | 'ecological'
  | 'disaster'
  | 'social-habitability'
  | 'governance'
  | 'mining-geology'
  | 'communications'
  | 'waste-management'
  | 'maritime'
  | 'robotics'
  | 'defense-security';

// ── District Timeline ───────────────────────────────────────────────

export interface DistrictSnapshot {
  timestamp: string;
  buildingCount: number;
  populationCapacity: number;
  powerCapacity: number;
  waterCapacity: number;
  environmentalScore: number;
}

// ── Community Request Board ─────────────────────────────────────────

export interface CommunityRequest {
  id: string;
  districtId: string;
  title: string;
  description: string;
  requirementSpecs: Record<string, unknown>;
  budgetRange: { min: number; max: number };
  creator: string;
  status: 'open' | 'claimed' | 'completed';
  claimedBy?: string;
}
