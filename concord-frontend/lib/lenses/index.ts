/**
 * Lens Infrastructure — barrel export.
 *
 * Provides unified access to:
 *   - Lens manifest (runtime contract)
 *   - Lens status taxonomy (viewer/hybrid/product/system/deprecated)
 *   - Lens merge map (which lenses combine and how)
 *   - Productization roadmap (execution order)
 *   - Product Lens Gate (quality requirements)
 */

// Runtime contract
export {
  type LensManifest,
  LENS_MANIFESTS,
  getLensManifest,
  getLensManifests,
  getAllLensDomains,
  getManifestCount,
  getLensesMissingMacro,
} from './manifest';

// Status taxonomy (Step 1)
export {
  type LensStatus,
  type LensStatusEntry,
  LENS_STATUS_MAP,
  getLensStatus,
  getLensesByStatus,
  getLensesMergingInto,
  getProductLenses,
  getDeprecatedLenses,
  isPublicLens,
  getLensStatusSummary,
} from './lens-status';

// Merge map (Step 2)
export {
  type MergeSource,
  type MergeGroup,
  LENS_MERGE_GROUPS,
  getMergeGroup,
  getAllMergeSourceIds,
  findMergeGroupForSource,
  getMergeReductionCount,
  POST_MERGE_STANDALONE_LENSES,
  type PostMergeStandaloneLens,
} from './lens-merge-map';

// Productization roadmap (Step 3)
export {
  type PhaseStatus,
  type ProductionArtifact,
  type ProductionEngine,
  type ProductionPipeline,
  type ProductionPhase,
  PRODUCTIZATION_PHASES,
  getProductionPhases,
  getCurrentPhase,
  getPhaseByLens,
  areDependenciesMet,
  getTotalArtifactCount,
  getTotalEngineCount,
} from './productization-roadmap';

// Product Lens Gate (the non-negotiable rule)
export {
  type LensCapability,
  type LensScore,
  type CIViolation,
  LENS_CAPABILITIES,
  GATE_PASS_THRESHOLD,
  MAX_SCORE,
  scoreLens,
  CI_HARD_RULES,
} from './product-lens-gate';

// Chat Lens Recommender (chat → actionable)
export {
  type IntentClass,
  type LensRecommenderEntry,
  type SessionContext,
  type LensRecommendation,
  type RecommendationResult,
  type SessionTelemetry,
  type ScoredLens,
  LENS_RECOMMENDER_REGISTRY,
  recommendLenses,
  extractSignals,
  classifyIntent,
  checkTriggers,
  scoreLenses as scoreLensesForRecommendation,
  createSessionContext,
  createSessionTelemetry,
  recordRecommendationShown,
  recordLensOpened,
  recordDismissal,
  recordTimeToAction,
} from './chat-lens-recommender';

// Domain Schemas (Dimension 1: Domain Data Model Completion)
export {
  type FieldType,
  type FieldDef,
  type EntityDef,
  type RelationDef,
  type DomainSchema,
  DOMAIN_SCHEMAS,
  getDomainSchema,
  getDomainEntities,
  getDomainRelations,
  getDomainsWithSchemas,
} from './domain-schemas';

// Workflow Definitions (Dimension 2: Workflow Engines)
export {
  type WorkflowState,
  type WorkflowTransition,
  type WorkflowDef,
  WORKFLOW_DEFINITIONS,
  getWorkflowsForDomain,
  getWorkflow,
  getAvailableTransitions,
  isValidTransition,
  getInitialState,
  getDomainsWithWorkflows,
} from './workflow-definitions';

// Automation Bindings (Dimensions 3–5: Import/Export, Automation, RBAC)
export {
  type ImportFormat,
  type ExportFormat,
  type ImportExportProfile,
  type AutomationTrigger,
  type AutomationProfile,
  type DomainPermission,
  type DomainRBACProfile,
  IMPORT_EXPORT_PROFILES,
  AUTOMATION_PROFILES,
  DOMAIN_RBAC_PROFILES,
  getImportExportProfile,
  getAutomationProfile,
  getDomainRBAC,
  getDomainsWithImportExport,
  getDomainsWithAutomation,
  getDomainsWithRBAC,
} from './automation-bindings';

// Domain Bridge (unified profile + parity scoring)
export {
  type DomainProfile,
  type CompetitorParityScore,
  getDomainProfile,
  getCompetitorParityScore,
  getAllBoundDomains,
  getFleetParityReport,
  getFleetSummary,
} from './domain-bridge';
