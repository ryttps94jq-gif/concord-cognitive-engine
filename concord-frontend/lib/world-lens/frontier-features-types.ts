/**
 * frontier-features-types.ts
 *
 * TypeScript type definitions for the 16 Concord frontier features.
 * Each feature block is separated by a decorated comment banner.
 */

// ── Feature 1: Fabrication ──────────────────────────────────────────────────

export type FabricationFormat =
  | 'gcode'
  | 'stl'
  | 'dxf'
  | 'step'
  | 'obj'
  | 'iges';

export interface FabricationExport {
  id: string;
  dtuId: string;
  userId: string;
  format: FabricationFormat;
  machineProfile?: string;
  parameters: {
    tolerance: number;
    minWallThickness: number;
    supports: 'auto' | 'none' | 'manual';
    orientation: 'auto-optimize' | 'manual';
  };
  filePath?: string;
  fileSizeBytes?: number;
  status: 'processing' | 'completed' | 'failed';
  validationHash: string;
  createdAt: string;
}

export interface MachineProfile {
  id: string;
  name: string;
  type:
    | 'cnc_mill'
    | 'cnc_lathe'
    | 'fdm_printer'
    | 'sla_printer'
    | 'laser_cutter'
    | 'waterjet';
  workVolume: {
    x: number;
    y: number;
    z: number;
  };
  materialCompatibility: string[];
  isPublic: boolean;
}

// ── Feature 2: Sensors ──────────────────────────────────────────────────────

export interface SensorDevice {
  id: string;
  ownerId: string;
  name: string;
  type:
    | 'weather'
    | 'structural'
    | 'environmental'
    | 'traffic'
    | 'energy'
    | 'water'
    | 'custom';
  location: {
    lat: number;
    lng: number;
    altitude?: number;
  };
  linkedDtuId?: string;
  linkedDistrictId?: string;
  apiKey: string;
  status: 'active' | 'inactive' | 'error';
  lastReadingAt?: string;
}

export interface SensorReading {
  id: string;
  deviceId: string;
  timestamp: string;
  data: Record<string, number | string>;
  anomalyDetected: boolean;
  anomalyDetails?: any;
}

export interface AnomalyAlert {
  deviceId: string;
  readingValue: number;
  expectedRange: {
    min: number;
    max: number;
  };
  deviationPercent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ── Feature 3: Notarization ─────────────────────────────────────────────────

export interface NotarizationRecord {
  id: string;
  dtuId: string;
  dtuHash: string;
  chain: 'ethereum_l2' | 'polygon' | 'base' | 'arbitrum';
  transactionHash?: string;
  blockNumber?: number;
  status: 'pending' | 'confirmed' | 'failed';
  creatorId: string;
  createdAt: string;
}

export interface NotarizationVerification {
  verified: boolean;
  notarizedAt?: string;
  chain?: string;
  transactionHash?: string;
}

// ── Feature 4: Shell ────────────────────────────────────────────────────────

export interface ShellCommand {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export interface ShellOutput {
  output: string;
  error?: string;
  exitCode: number;
  data?: any;
}

export interface ShellCompletion {
  text: string;
  description: string;
  type: 'command' | 'argument' | 'flag';
}

// ── Feature 5: Notebook ─────────────────────────────────────────────────────

export interface NotebookDocument {
  id: string;
  title: string;
  creatorId: string;
  cells: NotebookCell[];
  isPublic: boolean;
  forkOf?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookCell {
  id: string;
  notebookId: string;
  cellIndex: number;
  type:
    | 'markdown'
    | 'dtu'
    | 'validation'
    | 'visualization'
    | 'lens_query'
    | 'code'
    | 'publish';
  content: any;
  output?: any;
  executedAt?: string;
}

// ── Feature 6: Marketplace ──────────────────────────────────────────────────

export interface ServiceListing {
  id: string;
  providerId: string;
  title: string;
  description: string;
  category: string;
  priceCC: number;
  priceType: 'fixed' | 'hourly' | 'per_item';
  deliveryTimeHours?: number;
  ratingAvg: number;
  ratingCount: number;
  isActive: boolean;
}

export interface ServiceOrder {
  id: string;
  listingId: string;
  buyerId: string;
  providerId: string;
  status:
    | 'pending'
    | 'accepted'
    | 'in_progress'
    | 'delivered'
    | 'revision_requested'
    | 'completed'
    | 'cancelled'
    | 'disputed';
  requirements?: string;
  priceCC: number;
  escrowTxId?: string;
}

export interface ServiceReview {
  id: string;
  orderId: string;
  reviewerId: string;
  rating: number;
  reviewText?: string;
}

// ── Feature 7: Certificates ─────────────────────────────────────────────────

export interface LearningPath {
  id: string;
  name: string;
  domain: string;
  description?: string;
  requiredLensCompletions: string[];
  requiredDtuCount: number;
  requiredCitationCount: number;
  requiredValidationPassRate: number;
}

export interface Certificate {
  id: string;
  userId: string;
  learningPathId: string;
  issuedAt: string;
  metrics: {
    totalDTUs: number;
    totalCitations: number;
    avgSafetyFactor: number;
    validationPassRate: number;
  };
  contentHash: string;
  verificationUrl: string;
  revoked: boolean;
}

export interface CertificateProgress {
  completed: string[];
  remaining: string[];
  dtuCount: number;
  required: number;
  citationCount: number;
  passRate: number;
  isComplete: boolean;
}

// ── Feature 8: Federation ───────────────────────────────────────────────────

export interface FederationInstance {
  id: string;
  name: string;
  url: string;
  publicKey: string;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  capabilities: string[];
  lastSyncAt?: string;
}

export interface FederationSyncLog {
  id: string;
  instanceId: string;
  direction: 'push' | 'pull';
  dtuCount: number;
  status: string;
  createdAt: string;
}

// ── Feature 9: Compiler ─────────────────────────────────────────────────────

export type CompileAction =
  | 'parse'
  | 'compile'
  | 'compile_and_validate'
  | 'compile_and_publish';

export interface CompileResult {
  compiled: number;
  validated: number;
  failed: number;
  published: number;
  publishedIds: string[];
}

export interface CompileError {
  line: number;
  column: number;
  message: string;
}

export interface DSLDiagnostic {
  severity: 'error' | 'warning' | 'info';
  line: number;
  column: number;
  message: string;
}

// ── Feature 10: Digital Twins ───────────────────────────────────────────────

export interface DigitalTwin {
  id: string;
  name: string;
  ownerId: string;
  sourceDtuId: string;
  sensorDeviceIds: string[];
  status: 'active' | 'paused' | 'archived';
  healthScore: number;
  lastAssessmentAt?: string;
}

export interface TwinAssessment {
  id: string;
  twinId: string;
  timestamp: string;
  predictedState: any;
  actualState: any;
  deviationScore: number;
  anomalies: any[];
  recommendations: string[];
}

// ── Feature 11: Voice ───────────────────────────────────────────────────────

export interface VoiceTranscription {
  transcript: string;
  confidence: number;
  language: string;
}

export interface FrontierVoiceIntent {
  command: string;
  args: string[];
  confidence: number;
}

export interface VoiceConversation {
  id: string;
  userId: string;
  messages: VoiceMessage[];
  createdAt: string;
}

export interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  timestamp: string;
}

// ── Feature 12: Replay ──────────────────────────────────────────────────────

export interface ReplayBookmark {
  id: string;
  worldId: string;
  userId: string;
  name: string;
  startTime: string;
  endTime: string;
  description?: string;
  isPublic: boolean;
}

export interface ForensicReport {
  id: string;
  worldId: string;
  analystId: string;
  subjectDtuId?: string;
  title: string;
  rootCause?: string;
  recommendations: string[];
}

export interface TimelapseJob {
  id: string;
  worldId: string;
  from: string;
  to: string;
  outputDuration: number;
  resolution: '720p' | '1080p' | '4k';
  status: string;
}

// ── Feature 13: Agents ──────────────────────────────────────────────────────

export type AgentType =
  | 'monitor'
  | 'alert'
  | 'report'
  | 'auto_bid'
  | 'market_watch'
  | 'validation_watch'
  | 'portfolio_manager'
  | 'custom';

export interface ConcordAgent {
  id: string;
  ownerId: string;
  name: string;
  type: AgentType;
  config: any;
  status: 'active' | 'paused' | 'error' | 'quota_exceeded';
  lastRunAt?: string;
  runCount: number;
  dailyQuota: number;
  dailyUsage: number;
}

export interface AgentLog {
  id: string;
  agentId: string;
  action: string;
  details?: any;
  result: 'success' | 'failure' | 'skipped';
  createdAt: string;
}

// ── Feature 14: Standards ───────────────────────────────────────────────────

export interface EngineeringStandard {
  id: string;
  code: string;
  name: string;
  issuingBody: string;
  version: string;
  jurisdiction: string[];
  category: string;
  rules: StandardRule[];
  effectiveDate?: string;
  isActive: boolean;
}

export interface StandardRule {
  id: string;
  section: string;
  title: string;
  type: string;
  parameters: any;
  validationMapping?: {
    test: string;
    parameter: string;
    operator: string;
    value: number;
  };
}

export interface StandardComplianceResult {
  standard: string;
  compliance: 'COMPLIANT' | 'NON-COMPLIANT';
  sectionResults: any[];
}

// ── Feature 15: Diff ────────────────────────────────────────────────────────

export interface DTUDiff {
  added: any[];
  removed: any[];
  modified: {
    memberId: string;
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  unchangedCount: number;
  summary: string;
  validationDelta?: any;
}

export interface DTUDiffVisualOverlay {
  memberId: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged';
  color: string;
}

// ── Feature 16: Graph ───────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  creator: string;
  citations: number;
  validationStatus: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  royaltyFlow: number;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    totalCreators: number;
    totalRoyaltyFlow: number;
  };
}

export type GraphLayout = 'force-directed' | 'hierarchical' | 'radial';

// ── Master Configuration ────────────────────────────────────────────────────

export interface FrontierConfig {
  fabrication: {
    enabled: boolean;
    defaultFormat: FabricationFormat;
    maxFileSizeBytes: number;
    supportedMachineTypes: MachineProfile['type'][];
  };
  sensors: {
    enabled: boolean;
    maxDevicesPerUser: number;
    readingRetentionDays: number;
    anomalyThresholdPercent: number;
  };
  notarization: {
    enabled: boolean;
    defaultChain: NotarizationRecord['chain'];
    autoNotarize: boolean;
    confirmationBlocks: number;
  };
  shell: {
    enabled: boolean;
    maxOutputLength: number;
    allowedCommands: string[];
    sandboxed: boolean;
  };
  notebook: {
    enabled: boolean;
    maxCellsPerNotebook: number;
    allowPublicForks: boolean;
    autoSaveIntervalMs: number;
  };
  marketplace: {
    enabled: boolean;
    minListingPriceCC: number;
    maxListingPriceCC: number;
    escrowEnabled: boolean;
    platformFeePercent: number;
  };
  certificates: {
    enabled: boolean;
    verificationBaseUrl: string;
    autoIssue: boolean;
    revocationEnabled: boolean;
  };
  federation: {
    enabled: boolean;
    maxInstances: number;
    syncIntervalMs: number;
    requireMutualTrust: boolean;
  };
  compiler: {
    enabled: boolean;
    defaultAction: CompileAction;
    maxCompileBatchSize: number;
    strictMode: boolean;
  };
  digitalTwins: {
    enabled: boolean;
    maxTwinsPerUser: number;
    assessmentIntervalMs: number;
    healthScoreThreshold: number;
  };
  voice: {
    enabled: boolean;
    defaultLanguage: string;
    maxConversationLength: number;
    confidenceThreshold: number;
  };
  replay: {
    enabled: boolean;
    maxBookmarksPerUser: number;
    maxTimelapseDuration: number;
    supportedResolutions: TimelapseJob['resolution'][];
  };
  agents: {
    enabled: boolean;
    maxAgentsPerUser: number;
    defaultDailyQuota: number;
    allowCustomAgents: boolean;
  };
  standards: {
    enabled: boolean;
    autoComplianceCheck: boolean;
    defaultJurisdiction: string;
    strictEnforcement: boolean;
  };
  diff: {
    enabled: boolean;
    maxDiffMembers: number;
    showValidationDelta: boolean;
    colorScheme: Record<DTUDiffVisualOverlay['status'], string>;
  };
  graph: {
    enabled: boolean;
    defaultLayout: GraphLayout;
    maxNodes: number;
    maxEdges: number;
    showRoyaltyFlows: boolean;
  };
}
