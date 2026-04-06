/**
 * Infrastructure Tools Types
 *
 * TypeScript type definitions for the 12 core infrastructure tools
 * powering the Concord Cognitive Engine platform.
 *
 * Tools covered:
 *   1.  CPM         — Concord Package Manager
 *   2.  Validation  — Structural validation API
 *   3.  DTU         — Digital Twin Unit protocol
 *   4.  BaaS        — Brain as a Service
 *   5.  CID         — Concord Identity
 *   6.  Sync        — Real-time collaboration sync
 *   7.  ProcGen     — Procedural generation engine
 *   8.  Registry    — Package registry
 *   9.  Observe     — Observability & auto-repair
 *   10. Test        — Simulation testing
 *   11. Moderate    — Content moderation
 *   12. Lens        — World Lens educational layers
 *
 * All types are exported. Interfaces use strict field typing where possible;
 * `any` is used only for genuinely opaque / user-defined payloads.
 */

// ── CPM (Concord Package Manager) ──────────────────────────────────────────

export interface CpmManifest {
  name: string;
  version: string;
  creator: string;
  mode: string;
  description: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  district: {
    terrain: string;
    seismicZone: string;
    windZone: string;
    climate: string;
  };
  buildingCode: string;
}

export interface CpmPackage {
  name: string;
  version: string;
  creator: string;
  description: string;
  dtuId: string;
  validationStatus: string;
  dependencies: string[];
  citations: number;
  downloads: number;
  thumbnail: string;
  publishedAt: string;
}

export interface DependencyTree {
  root: CpmPackage;
  children: DependencyTree[];
  resolved: boolean;
}

export interface CompatibilityReport {
  compatible: boolean;
  warnings: string[];
  errors: string[];
}

// ── Validation API ─────────────────────────────────────────────────────────

export interface ValidationRequest {
  structure: {
    members: StructuralMember[];
    connections: any[];
  };
  environment: {
    seismicZone: number;
    windSpeed: number;
    snowLoad: number;
    temperatureRange: {
      min: number;
      max: number;
    };
  };
  tests: string[];
  callback?: string;
}

export interface ValidationResponse {
  jobId: string;
  status: string;
  overallPass: boolean;
  computeTime: string;
  results: Record<
    string,
    {
      pass: boolean;
      safetyFactor?: number;
      criticalMember?: string;
      suggestion?: string;
    }
  >;
  memberDetails: any[];
}

export interface StructuralMember {
  id: string;
  type: 'beam' | 'column' | 'wall' | 'slab' | 'truss' | 'connection';
  material: string;
  length?: number;
  height?: number;
  crossSection: any;
  supports: any;
  loads: any[];
}

// ── DTU Protocol ───────────────────────────────────────────────────────────

export interface DTUDocument {
  $schema: string;
  dtuVersion: string;
  id: string;
  type:
    | 'component'
    | 'structure'
    | 'material'
    | 'npc'
    | 'quest'
    | 'policy'
    | 'system';
  name: string;
  creator: {
    id: string;
    handle: string;
    timestamp: string;
  };
  content: unknown;
  validation: DTUValidationState;
  citations: {
    cites: DTUCitation[];
    citedBy: number;
  };
  metadata: {
    tags: string[];
    category: string;
    license: string;
    version: string;
    changelog: string;
    previousVersion: string | null;
  };
  hash: string;
}

export interface DTUValidationState {
  status: 'validated' | 'experimental' | 'unvalidated' | 'superseded';
  engine: string;
  timestamp: string;
  results: Record<string, any>;
  overallPass: boolean;
  hash: string;
}

export interface DTUCitation {
  dtuId: string;
  relationship:
    | 'material'
    | 'component'
    | 'foundation'
    | 'dependency'
    | 'fork'
    | 'improvement';
}

// ── BaaS (Brain as a Service) ──────────────────────────────────────────────

export type BrainType = 'conscious' | 'subconscious' | 'utility' | 'repair';

export interface BrainRequest {
  task: string;
  context: {
    systemPrompt?: string;
    conversationHistory?: any[];
  };
  parameters: {
    maxTokens?: number;
    temperature?: number;
  };
}

export interface BrainResponse {
  brain: BrainType;
  model: string;
  response: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latency: string;
  };
}

// ── CID (Concord Identity) ────────────────────────────────────────────────

export interface ConcordIdentity {
  cid: string;
  handle: string;
  displayName: string;
  avatar: string;
  joined: string;
  professions: string[];
  reputation: Record<string, number>;
  portfolio: {
    totalDTUs: number;
    totalCitations: number;
    totalRoyalties: string;
    topDTUs: {
      id: string;
      name: string;
      citations: number;
    }[];
  };
  badges: string[];
  firms: {
    id: string;
    name: string;
    role: string;
  }[];
  worlds: {
    id: string;
    name: string;
    visitors: number;
  }[];
  verified: boolean;
}

export type OAuthScope =
  | 'profile'
  | 'portfolio'
  | 'reputation'
  | 'badges'
  | 'firms'
  | 'worlds'
  | 'email'
  | 'validate'
  | 'publish';

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: OAuthScope[];
}

// ── Sync ───────────────────────────────────────────────────────────────────

export interface SyncRoom {
  id: string;
  users: SyncUser[];
  state: Record<string, unknown>;
  locks: SyncLock[];
  createdAt: string;
}

export interface SyncUser {
  id: string;
  name: string;
  color: string;
  cursor: {
    x: number;
    y: number;
    z: number;
    target: string | null;
  } | null;
  joinedAt: string;
}

export interface SyncLock {
  objectId: string;
  userId: string;
  lockedAt: string;
  autoReleaseMs: number;
}

export interface SyncServerConfig {
  port: number;
  maxRoomsPerServer: number;
  maxUsersPerRoom: number;
  heartbeatInterval: number;
  stateStorage: string;
}

// ── ProcGen (Procedural Generation) ────────────────────────────────────────

export interface NPCGenerationConfig {
  count: number;
  constraints: {
    occupations: Record<string, number | 'auto'>;
    personalityDistribution: string;
    ageRange: {
      min: number;
      max: number;
    };
    relationshipDensity: number;
    scheduleTemplate: string;
    culture: string;
  };
}

export interface GeneratedNPC {
  name: string;
  occupation: string;
  personality: string[];
  schedule: any[];
  relationships: any[];
  systemPrompt: string;
  greetings: string[];
  age: number;
}

export interface QuestGenerationConfig {
  theme: string;
  steps: number;
  difficulty: string;
  context: {
    district: string;
    recentEvents: string[];
  };
  rewardBudget: {
    concordCoin: number;
    reputation: number;
  };
}

export interface TerrainGenerationConfig {
  template: string;
  dimensions: {
    width: number;
    depth: number;
  };
  features: {
    river?: any;
    hills?: any;
    creek?: boolean;
    flatland?: any;
  };
  geology: {
    soilTypes: string[];
    bedrockDepth: {
      min: number;
      max: number;
    };
    seismicZone: number;
  };
}

// ── Registry ───────────────────────────────────────────────────────────────

export interface RegistryPackage {
  name: string;
  version: string;
  creator: string;
  description: string;
  citations: number;
  downloads: number;
  validationStatus: string;
  performance: Record<string, any>;
  thumbnail: string;
  publishedAt: string;
  tags: string[];
}

export interface RegistrySearchParams {
  q?: string;
  category?: string;
  minCitations?: number;
  sortBy?: 'citations' | 'downloads' | 'recent';
  page?: number;
  pageSize?: number;
}

// ── Observe ────────────────────────────────────────────────────────────────

export interface ObserveConfig {
  serviceName: string;
  endpoint: string;
  apiKey: string;
  enableTracing: boolean;
  enableErrorCapture: boolean;
  enableMetrics: boolean;
  enableAutoRepair: boolean;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  operationName: string;
  startTime: string;
  endTime?: string;
  attributes: Record<string, any>;
  status: string;
}

export interface ErrorCapture {
  error: {
    message: string;
    stack: string;
  };
  context: {
    user?: string;
    action?: string;
    dtu?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

export interface AutoRepairDiagnosis {
  hasFix: boolean;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  fix: {
    description: string;
    code?: string;
  };
  explanation: string;
}

// ── Test ───────────────────────────────────────────────────────────────────

export interface SimulationTestConfig {
  environment: any;
  load: any;
  test: string;
}

export interface SimulationTestResult {
  pass: boolean;
  safetyFactor?: number;
  criticalMember?: string;
  criticalRatio?: number;
  maxStress?: number;
}

export interface TestSuiteResult {
  name: string;
  passed: number;
  failed: number;
  total: number;
  duration: number;
}

// ── Moderate ───────────────────────────────────────────────────────────────

export interface ModerationResult {
  pass: boolean;
  flags: string[];
  confidence: number;
  suggestion: string | null;
}

export type ModerationPolicy = 'standard' | 'strict' | 'permissive' | 'custom';

export interface ModerationReport {
  reporter: string;
  targetType: 'world' | 'building' | 'user' | 'dtu';
  targetId: string;
  reason: string;
  description: string;
}

// ── Lens ───────────────────────────────────────────────────────────────────

export interface LensDefinition {
  name: string;
  version: string;
  domain: string;
  creator: string;
  description: string;
  icon: string;
  sections: LensSection[];
  metadata: {
    difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    estimatedTime: string;
    tags: string[];
  };
}

export interface LensSection {
  id: string;
  title: string;
  type: 'knowledge' | 'interactive' | 'assessment';
  content: any;
  dataSources: any[];
  interactives: any[];
  dtuConnections: any[];
  learningOutcomes: string[];
}

// ── Master Configuration ───────────────────────────────────────────────────

export type ConcordPackageScope =
  | 'cpm'
  | 'validation'
  | 'dtu'
  | 'baas'
  | 'cid'
  | 'sync'
  | 'procgen'
  | 'registry'
  | 'observe'
  | 'test'
  | 'moderate'
  | 'lens';

export interface InfraToolsConfig {
  cpm: {
    registryUrl: string;
    cacheDir: string;
    defaultManifest: Partial<CpmManifest>;
  };
  validation: {
    endpoint: string;
    timeout: number;
    retries: number;
  };
  dtu: {
    schemaVersion: string;
    defaultLicense: string;
    hashAlgorithm: string;
  };
  baas: {
    endpoint: string;
    defaultBrain: BrainType;
    maxTokens: number;
    temperature: number;
  };
  cid: {
    oauthEndpoint: string;
    clientId: string;
    defaultScopes: OAuthScope[];
  };
  sync: {
    server: SyncServerConfig;
    reconnectInterval: number;
    maxRetries: number;
  };
  procgen: {
    defaultCulture: string;
    maxNPCBatch: number;
    terrainResolution: number;
  };
  registry: {
    endpoint: string;
    defaultPageSize: number;
    cacheTTL: number;
  };
  observe: ObserveConfig;
  test: {
    parallelism: number;
    timeout: number;
    reportDir: string;
  };
  moderate: {
    defaultPolicy: ModerationPolicy;
    autoFlag: boolean;
    reviewEndpoint: string;
  };
  lens: {
    maxSections: number;
    defaultDifficulty: LensDefinition['metadata']['difficulty'];
    contentCDN: string;
  };
}
