// =============================================================================
// Concord Cognitive Engine — Full-Stack Infrastructure Types
// =============================================================================
// Comprehensive type definitions covering seven layers of backend infrastructure:
//   1. Infrastructure Layer
//   2. Data Layer
//   3. Security Layer
//   4. DevOps Layer
//   5. Observability Layer
//   6. Developer Experience Layer
//   7. ML Ops Layer
// =============================================================================

// =============================================================================
// 1. INFRASTRUCTURE LAYER
// =============================================================================

/** Auto-scaling configuration for a service. */
export interface AutoScaleConfig {
  min: number;
  max: number;
  targetCPU: number;
}

/** Primary service deployment and resource configuration. */
export interface ServiceConfig {
  name: string;
  port: number;
  healthEndpoint: string;
  replicas: number;
  memoryLimit: string;
  cpuLimit: string;
  autoScale: AutoScaleConfig;
}

/** Retry policy for event bus message delivery. */
export interface RetryPolicy {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/** Event bus / message broker configuration. */
export interface EventBusConfig {
  provider: 'nats' | 'redis-streams';
  channels: string[];
  deadLetterQueue: string;
  retryPolicy: RetryPolicy;
}

/** Individual queue definition within the job queue system. */
export interface QueueDefinition {
  name: string;
  concurrency: number;
  retryAttempts: number;
  backoff: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

/** Background job queue configuration. */
export interface JobQueueConfig {
  provider: 'bull' | 'bee-queue';
  queues: QueueDefinition[];
}

/** Application-level cache configuration. */
export interface CacheConfig {
  provider: 'redis' | 'memcached';
  ttl: number;
  maxMemory: string;
  evictionPolicy: 'lru' | 'lfu' | 'volatile-lru' | 'allkeys-lru' | 'noeviction';
  keyPrefix: string;
}

/** Individual edge cache rule. */
export interface EdgeCacheRule {
  pathPattern: string;
  ttl: number;
  staleWhileRevalidate: number;
}

/** CDN / edge caching configuration. */
export interface EdgeCacheConfig {
  provider: 'cloudflare' | 'fastly';
  rules: EdgeCacheRule[];
}

/** Circuit breaker pattern configuration. */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests: number;
}

/** Rate limiting configuration. */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: string;
  skipList: string[];
}

/** Aggregated Infrastructure Layer configuration. */
export interface InfrastructureLayerConfig {
  services: ServiceConfig[];
  eventBus: EventBusConfig;
  jobQueue: JobQueueConfig;
  cache: CacheConfig;
  edgeCache: EdgeCacheConfig;
  circuitBreaker: CircuitBreakerConfig;
  rateLimit: RateLimitConfig;
}

// =============================================================================
// 2. DATA LAYER
// =============================================================================

/** Ingestion stage of the analytics pipeline. */
export interface AnalyticsIngestionConfig {
  batchSize: number;
  flushInterval: number;
}

/** Storage stage of the analytics pipeline. */
export interface AnalyticsStorageConfig {
  provider: 'clickhouse' | 'bigquery' | 'snowflake' | 's3';
  retention: number;
}

/** Real-time processing stage of the analytics pipeline. */
export interface AnalyticsRealtimeConfig {
  provider: 'kafka-streams' | 'flink' | 'spark-streaming';
  windowSize: number;
}

/** End-to-end analytics pipeline configuration. */
export interface AnalyticsPipelineConfig {
  ingestion: AnalyticsIngestionConfig;
  storage: AnalyticsStorageConfig;
  realtime: AnalyticsRealtimeConfig;
}

/** Node type within the STAXX knowledge graph. */
export interface KnowledgeGraphNodeType {
  name: string;
  properties: Record<string, string>;
  primaryKey: string;
}

/** Edge type within the STAXX knowledge graph. */
export interface KnowledgeGraphEdgeType {
  name: string;
  from: string;
  to: string;
  properties: Record<string, string>;
  directed: boolean;
}

/** STAXX Knowledge Graph configuration. */
export interface STAXXKnowledgeGraphConfig {
  nodeTypes: KnowledgeGraphNodeType[];
  edgeTypes: KnowledgeGraphEdgeType[];
  indexFields: string[];
  queryTimeout: number;
}

/** Vector / semantic search configuration. */
export interface SemanticSearchConfig {
  embeddingModel: string;
  dimensions: number;
  indexType: 'hnsw' | 'ivf';
  similarityMetric: 'cosine' | 'euclidean' | 'dot-product';
}

/** Recommendation engine configuration. */
export interface RecommendationConfig {
  algorithm: 'collaborative' | 'content-based' | 'hybrid' | 'graph-based';
  features: string[];
  refreshInterval: number;
  cacheResults: boolean;
}

/** Aggregated Data Layer configuration. */
export interface DataLayerConfig {
  analyticsPipeline: AnalyticsPipelineConfig;
  knowledgeGraph: STAXXKnowledgeGraphConfig;
  semanticSearch: SemanticSearchConfig;
  recommendation: RecommendationConfig;
}

// =============================================================================
// 3. SECURITY LAYER
// =============================================================================

/** Zero-trust authentication and access control configuration. */
export interface ZeroTrustConfig {
  authProvider: 'oauth2' | 'oidc' | 'saml' | 'passkey';
  tokenExpiry: number;
  refreshExpiry: number;
  mfaRequired: boolean;
  ipAllowlist: string[];
}

/** Content-addressable storage / integrity verification configuration. */
export interface ContentAddressableConfig {
  hashAlgorithm: 'sha256' | 'blake3';
  verifyOnRead: boolean;
  deduplication: boolean;
}

/** Encryption-at-rest sub-configuration. */
export interface EncryptionAtRestConfig {
  algorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyRotation: number;
}

/** Encryption-in-transit sub-configuration. */
export interface EncryptionInTransitConfig {
  minTLSVersion: '1.2' | '1.3';
  cipherSuites: string[];
}

/** Combined encryption configuration. */
export interface EncryptionConfig {
  atRest: EncryptionAtRestConfig;
  inTransit: EncryptionInTransitConfig;
}

/** Audit logging configuration. */
export interface AuditLogConfig {
  retentionDays: number;
  events: string[];
  immutable: boolean;
  exportFormat: 'json' | 'csv' | 'parquet';
}

/** Aggregated Security Layer configuration. */
export interface SecurityLayerConfig {
  zeroTrust: ZeroTrustConfig;
  contentAddressable: ContentAddressableConfig;
  encryption: EncryptionConfig;
  auditLog: AuditLogConfig;
}

// =============================================================================
// 4. DEVOPS LAYER
// =============================================================================

/** CI/CD pipeline stage definition. */
export interface CICDStage {
  name: string;
  runner: string;
  steps: string[];
  timeout: number;
  dependsOn?: string[];
}

/** CI/CD pipeline configuration. */
export interface CICDConfig {
  provider: 'github-actions' | 'gitlab-ci';
  stages: CICDStage[];
  autoMerge: boolean;
  requiredChecks: string[];
}

/** Individual feature flag definition. */
export interface FeatureFlagDefinition {
  key: string;
  default: boolean;
  rolloutPercentage: number;
  description?: string;
  tags?: string[];
}

/** Feature flag management configuration. */
export interface FeatureFlagConfig {
  provider: 'launchdarkly' | 'unleash' | 'custom';
  flags: FeatureFlagDefinition[];
}

/** Backup and disaster recovery configuration. */
export interface BackupConfig {
  schedule: string;
  retention: number;
  provider: 's3' | 'gcs' | 'azure-blob' | 'r2';
  encryption: boolean;
  verifyRestore: boolean;
}

/** Infrastructure-as-Code configuration. */
export interface IaCConfig {
  provider: 'terraform' | 'pulumi';
  stateBackend: string;
  autoApply: boolean;
  driftDetection: boolean;
}

/** Aggregated DevOps Layer configuration. */
export interface DevOpsLayerConfig {
  cicd: CICDConfig;
  featureFlags: FeatureFlagConfig;
  backup: BackupConfig;
  iac: IaCConfig;
}

// =============================================================================
// 5. OBSERVABILITY LAYER
// =============================================================================

/** Distributed tracing configuration. */
export interface TracingConfig {
  provider: 'jaeger' | 'zipkin' | 'otel';
  sampleRate: number;
  propagation: 'w3c' | 'b3' | 'jaeger' | 'xray';
}

/** Error tracking / exception monitoring configuration. */
export interface ErrorTrackingConfig {
  provider: 'sentry' | 'bugsnag';
  dsn: string;
  environment: string;
  release: string;
  ignoreErrors: string[];
}

/** Custom metric definition. */
export interface CustomMetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels: string[];
  description?: string;
}

/** Metrics collection and export configuration. */
export interface MetricsConfig {
  provider: 'prometheus' | 'datadog';
  scrapeInterval: number;
  customMetrics: CustomMetricDefinition[];
}

/** Individual service health monitor entry. */
export interface HealthServiceEntry {
  name: string;
  endpoint: string;
  interval: number;
  alertThreshold: number;
}

/** Health dashboard configuration. */
export interface HealthDashboardConfig {
  services: HealthServiceEntry[];
}

/** Individual uptime monitor. */
export interface UptimeMonitor {
  url: string;
  interval: number;
  alertChannels: string[];
}

/** Uptime monitoring configuration. */
export interface UptimeConfig {
  monitors: UptimeMonitor[];
  statusPageUrl: string;
}

/** Aggregated Observability Layer configuration. */
export interface ObservabilityLayerConfig {
  tracing: TracingConfig;
  errorTracking: ErrorTrackingConfig;
  metrics: MetricsConfig;
  healthDashboard: HealthDashboardConfig;
  uptime: UptimeConfig;
}

// =============================================================================
// 6. DEVELOPER EXPERIENCE LAYER
// =============================================================================

/** API server entry for documentation. */
export interface APIServer {
  url: string;
  description: string;
}

/** API documentation auth descriptor. */
export interface APIDocsAuth {
  type: 'bearer' | 'apiKey' | 'oauth2' | 'basic';
  headerName?: string;
  scheme?: string;
}

/** API documentation configuration. */
export interface APIDocsConfig {
  format: 'openapi' | 'graphql-schema';
  version: string;
  servers: APIServer[];
  auth: APIDocsAuth;
}

/** SDK generation and distribution configuration. */
export interface SDKConfig {
  languages: string[];
  packageManager: string;
  autoGenerate: boolean;
  testCoverage: number;
}

/** Webhook signing configuration. */
export interface WebhookSigningConfig {
  algorithm: 'hmac-sha256' | 'hmac-sha512' | 'ed25519';
  secret: string;
}

/** Webhook retry policy. */
export interface WebhookRetryPolicy {
  maxRetries: number;
  backoff: 'exponential' | 'linear' | 'fixed';
  initialDelay: number;
}

/** Webhook delivery and management configuration. */
export interface WebhookConfig {
  events: string[];
  signing: WebhookSigningConfig;
  retryPolicy: WebhookRetryPolicy;
  deliveryLog: boolean;
}

/** Sandbox / developer environment configuration. */
export interface SandboxConfig {
  isolated: boolean;
  seedData: boolean;
  resetInterval: number;
  rateLimit: number;
}

/** Aggregated Developer Experience Layer configuration. */
export interface DeveloperExperienceLayerConfig {
  apiDocs: APIDocsConfig;
  sdk: SDKConfig;
  webhook: WebhookConfig;
  sandbox: SandboxConfig;
}

// =============================================================================
// 7. ML OPS LAYER
// =============================================================================

/** Model version registry and serving configuration. */
export interface ModelVersionConfig {
  registry: string;
  versioning: 'semver' | 'hash';
  storage: string;
  servingEndpoint: string;
}

/** Individual prompt template definition. */
export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

/** A/B testing configuration for prompt variants. */
export interface PromptABTestingConfig {
  enabled: boolean;
  variants: {
    templateId: string;
    weight: number;
  }[];
  evaluationMetric: string;
  duration: number;
}

/** Prompt management and templating configuration. */
export interface PromptManagementConfig {
  templates: PromptTemplate[];
  abTesting: PromptABTestingConfig;
}

/** Individual model serving definition. */
export interface InferenceModelDefinition {
  name: string;
  memoryGB: number;
  quantization: 'none' | 'int8' | 'int4' | 'fp16' | 'bf16' | 'gptq' | 'awq';
  batchSize: number;
}

/** Inference runtime configuration. */
export interface InferenceConfig {
  provider: 'ollama' | 'vllm' | 'triton';
  models: InferenceModelDefinition[];
}

/** Hyperparameters for fine-tuning jobs. */
export interface FineTuningHyperparameters {
  learningRate: number;
  epochs: number;
  batchSize: number;
  warmupSteps?: number;
  weightDecay?: number;
}

/** Evaluation configuration for fine-tuned models. */
export interface FineTuningEvaluation {
  metrics: string[];
  testSplit: number;
  baselineComparison: boolean;
}

/** Fine-tuning job configuration. */
export interface FineTuningConfig {
  baseModel: string;
  dataset: string;
  hyperparameters: FineTuningHyperparameters;
  evaluation: FineTuningEvaluation;
}

/** Aggregated ML Ops Layer configuration. */
export interface MLOpsLayerConfig {
  modelVersion: ModelVersionConfig;
  promptManagement: PromptManagementConfig;
  inference: InferenceConfig;
  fineTuning: FineTuningConfig;
}

// =============================================================================
// MASTER CONFIGURATION
// =============================================================================

/** Complete infrastructure configuration spanning all seven layers. */
export interface InfrastructureConfig {
  /** Service mesh, caching, event bus, job queues, circuit breakers, rate limits. */
  infrastructure: InfrastructureLayerConfig;

  /** Analytics pipelines, knowledge graphs, semantic search, recommendations. */
  data: DataLayerConfig;

  /** Zero-trust auth, encryption, content addressing, audit logging. */
  security: SecurityLayerConfig;

  /** CI/CD, feature flags, backups, infrastructure-as-code. */
  devops: DevOpsLayerConfig;

  /** Tracing, error tracking, metrics, health dashboards, uptime monitors. */
  observability: ObservabilityLayerConfig;

  /** API docs, SDKs, webhooks, sandbox environments. */
  developerExperience: DeveloperExperienceLayerConfig;

  /** Model versioning, prompt management, inference, fine-tuning. */
  mlops: MLOpsLayerConfig;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Extract a single layer from the master config by key. */
export type InfrastructureLayer = keyof InfrastructureConfig;

/** Resolve the config type for a given layer key. */
export type LayerConfig<K extends InfrastructureLayer> = InfrastructureConfig[K];

/** Deep partial variant — useful for config overrides and patches. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

/** Partial infrastructure config for merging environment-specific overrides. */
export type PartialInfrastructureConfig = DeepPartial<InfrastructureConfig>;

/** Validated wrapper — marks a config as having passed validation. */
export interface ValidatedConfig<T> {
  config: T;
  validatedAt: number;
  checksum: string;
}

/** Environment-specific configuration with base + override pattern. */
export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production' | 'preview';
  base: InfrastructureConfig;
  overrides: PartialInfrastructureConfig;
}

/** Configuration change event for tracking config mutations. */
export interface ConfigChangeEvent {
  timestamp: number;
  layer: InfrastructureLayer;
  path: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  reason: string;
}

/** Health status for a single infrastructure component. */
export interface ComponentHealthStatus {
  component: string;
  layer: InfrastructureLayer;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latencyMs: number;
  lastChecked: number;
  details?: Record<string, unknown>;
}

/** Aggregated platform health report. */
export interface PlatformHealthReport {
  timestamp: number;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealthStatus[];
  activeAlerts: number;
}
