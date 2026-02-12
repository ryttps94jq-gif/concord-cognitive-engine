// Atlas Global — TypeScript Types for Frontend

// ── Domain Types ─────────────────────────────────────────────────────────

export type DomainType =
  | 'formal.math' | 'formal.logic'
  | 'empirical.physics' | 'empirical.biology' | 'empirical.medicine'
  | 'historical.world' | 'historical.economic'
  | 'interpretive.philosophy' | 'interpretive.linguistics'
  | 'model.economics' | 'model.policy'
  | 'arts.visual' | 'arts.music' | 'arts.literature'
  | 'design.architecture' | 'design.product';

export type EpistemicClass =
  | 'FORMAL' | 'EMPIRICAL' | 'HISTORICAL'
  | 'INTERPRETIVE' | 'MODEL' | 'ARTS' | 'DESIGN';

export type AtlasStatus = 'DRAFT' | 'PROPOSED' | 'VERIFIED' | 'DISPUTED' | 'DEPRECATED' | 'QUARANTINED';

export type ClaimType = 'FACT' | 'INTERPRETATION' | 'RECEPTION' | 'PROVENANCE' | 'SPEC' | 'HYPOTHESIS' | 'MODEL_OUTPUT';

export type SourceTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'UNCITED';

export type ContradictionType = 'NUMERIC' | 'DATE' | 'CAUSAL' | 'ATTRIBUTION' | 'DEFINITIONAL' | 'MODEL_ASSUMPTION' | 'INTERPRETATION_CONFLICT' | 'PROVENANCE_CHAIN';

export type ContradictionSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

// ── Atlas DTU ────────────────────────────────────────────────────────────

export interface AtlasSource {
  sourceId: string;
  title: string;
  publisher: string;
  url: string;
  sourceTier: SourceTier;
  retrievedAt: number;
  quoteAnchors: { start: number; end: number }[];
}

export interface AtlasClaim {
  claimId: string;
  claimType: ClaimType;
  text: string;
  entities: string[];
  timeRange?: { start: string; end: string } | null;
  numeric: { value: number; unit: string; context: string }[];
  sources: AtlasSource[];
  evidenceTier: string;
  confidence: { factual: number; structural: number; overall: number };
  dispute: { isDisputed: boolean; reasons: string[] };
  _needsSources?: boolean;
}

export interface AtlasInterpretation {
  interpId: string;
  school: string;
  text: string;
  supportsClaims: string[];
  sources: AtlasSource[];
  confidence: { structural: number; overall: number };
}

export interface AtlasAssumption {
  assumptionId: string;
  text: string;
  appliesTo: string[];
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AtlasProvenance {
  provId: string;
  type: string;
  text: string;
  sources: AtlasSource[];
}

export interface AtlasLink {
  targetDtuId: string;
  claimIds: string[];
  strength: number;
  type?: ContradictionType | null;
  severity?: ContradictionSeverity;
  createdAt: string;
  createdBy: string;
}

export interface AtlasAuditEvent {
  ts: number;
  actor: string;
  action: string;
  diff: string;
}

export interface AtlasDTU {
  id: string;
  schemaVersion: string;
  createdAt: string;
  updatedAt: string;

  title: string;
  tags: string[];
  domainType: DomainType;
  epistemicClass: EpistemicClass;

  status: AtlasStatus;
  author: {
    userId: string;
    display: string;
    isSystem: boolean;
  };

  claims: AtlasClaim[];
  interpretations: AtlasInterpretation[];
  assumptions: AtlasAssumption[];
  provenance: AtlasProvenance[];

  links: {
    supports: AtlasLink[];
    contradicts: AtlasLink[];
    sameAs: AtlasLink[];
    about: { entityId: string; role: string }[];
  };

  scores: {
    confidence_factual: number;
    credibility_structural: number;
    confidence_overall: number;
  };

  lineage: {
    origin: 'HUMAN' | 'AUTOGEN' | 'IMPORT';
    generationDepth: number;
    parents: { dtuId: string; weight: number }[];
    runId: string | null;
    hash: string;
  };

  audit: {
    events: AtlasAuditEvent[];
  };

  proofVerified?: boolean;
  replicationCount?: number;
}

// ── Score Explanation ────────────────────────────────────────────────────

export interface ScoreComponent {
  name: string;
  value: number;
  weight: number;
}

export interface ScoreExplanation {
  confidence_factual: number;
  credibility_structural: number;
  confidence_overall: number;
  factualBreakdown: ScoreComponent[];
  structuralBreakdown: ScoreComponent[];
  whyNotVerified: {
    gate: string;
    required: number;
    actual: number;
    message: string;
  }[];
  canBeProposed: boolean;
  canBeVerified: boolean;
}

// ── Social Types ─────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  displayName: string;
  bio: string;
  avatar: string;
  isPublic: boolean;
  specialization: string[];
  website: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    dtuCount: number;
    publicDtuCount: number;
    citationCount: number;
    followerCount: number;
    followingCount: number;
  };
}

export interface FeedItem {
  dtuId: string;
  title: string;
  authorId: string;
  authorName: string;
  tags: string[];
  tier: string;
  createdAt: string;
  citationCount: number;
}

export interface TrendingItem {
  dtuId: string;
  title: string;
  authorId: string;
  authorName: string;
  tags: string[];
  citationCount: number;
  score: number;
  createdAt: string;
}

// ── Collaboration Types ──────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: {
    userId: string;
    role: string;
    joinedAt: string;
  }[];
  visibility: 'private' | 'org' | 'public';
  dtuCount?: number;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  dtuId: string;
  userId: string;
  text: string;
  parentCommentId: string | null;
  createdAt: string;
  updatedAt: string;
  reactions: Record<string, number>;
  isResolved: boolean;
  replies?: Comment[];
}

export interface RevisionProposal {
  id: string;
  dtuId: string;
  proposerId: string;
  changes: Record<string, unknown>;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'APPLIED';
  votes: { userId: string; vote: 'approve' | 'reject'; votedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

// ── Analytics Types ──────────────────────────────────────────────────────

export interface PersonalAnalytics {
  userId: string;
  summary: {
    dtuCount: number;
    citationCount: number;
    followerCount: number;
    followingCount: number;
    publicDtuCount: number;
    revenue: number;
    sales: number;
  };
  tierDistribution: Record<string, number>;
  topTags: { tag: string; count: number }[];
  recentDtus: { id: string; title: string; tier: string; createdAt: string }[];
}

export interface EfficiencyDashboard {
  headline: {
    llmCallsSaved: number;
    reuseRate: string;
    tokensEstimatedSaved: number;
    costEstimatedSaved: string;
    timeEstimatedSaved: string;
  };
  comparison: {
    substrateReuseCount: number;
    llmCallCount: number;
    reusePercentage: number;
    cacheHitRate: string;
  };
  byOperation: {
    operation: string;
    saved: number;
    made: number;
    reuseRate: number;
  }[];
}

// ── RBAC Types ───────────────────────────────────────────────────────────

export type OrgRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer' | 'api_only';

export interface OrgWorkspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  settings: {
    maxMembers: number;
    maxDtus: number;
    dataRegion: string;
    complianceLevel: string;
  };
  memberCount: number;
}

// ── Webhook Types ────────────────────────────────────────────────────────

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  ownerId: string;
  createdAt: string;
  lastDeliveryAt: string | null;
  consecutiveFailures: number;
}

// ── Status Badge Colors ──────────────────────────────────────────────────

export const ATLAS_STATUS_CONFIG: Record<AtlasStatus, { label: string; color: string; bgColor: string }> = {
  DRAFT:        { label: 'Draft',       color: 'text-gray-400',   bgColor: 'bg-gray-500/10' },
  PROPOSED:     { label: 'Proposed',    color: 'text-blue-400',   bgColor: 'bg-blue-500/10' },
  VERIFIED:     { label: 'Verified',    color: 'text-green-400',  bgColor: 'bg-green-500/10' },
  DISPUTED:     { label: 'Disputed',    color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  DEPRECATED:   { label: 'Deprecated',  color: 'text-orange-400', bgColor: 'bg-orange-500/10' },
  QUARANTINED:  { label: 'Quarantined', color: 'text-red-400',    bgColor: 'bg-red-500/10' },
};

export const EPISTEMIC_CLASS_CONFIG: Record<EpistemicClass, { label: string; description: string; color: string }> = {
  FORMAL:       { label: 'Formal',       description: 'Proof/logic-based truth',        color: 'text-purple-400' },
  EMPIRICAL:    { label: 'Empirical',    description: 'Replication/statistics-based',    color: 'text-cyan-400' },
  HISTORICAL:   { label: 'Historical',   description: 'Corroboration-weighted',          color: 'text-amber-400' },
  INTERPRETIVE: { label: 'Interpretive', description: 'Argument/school-of-thought',      color: 'text-rose-400' },
  MODEL:        { label: 'Model',        description: 'Assumption/scenario-based',       color: 'text-indigo-400' },
  ARTS:         { label: 'Arts',         description: 'Provenance + interpretation',     color: 'text-pink-400' },
  DESIGN:       { label: 'Design',       description: 'Specs + process + constraints',   color: 'text-teal-400' },
};
