/**
 * World Lens — Invisible Layer Type Definitions
 *
 * All types for the 15 invisible-layer game systems: juice/feedback,
 * soundscapes, hidden assistance, adaptive difficulty, environmental
 * storytelling, secrets/discovery, variable reinforcement, ownership/
 * territory, loss aversion, social proof, ritual/routine, emergent
 * storytelling, camera/framing, pacing/downtime, and the meta-game.
 *
 * These systems form the "game feel" and psychological layer —
 * the polish, pacing, and emotional hooks that keep the world
 * feeling alive without the player consciously noticing.
 */

// ── 1. Game Juice / Feedback Polish ─────────────────────────────────

/** Triggers that fire a juice reaction (particles, sound, camera, screen). */
export type JuiceTrigger =
  | 'place-dtu'
  | 'validate-pass'
  | 'validate-fail'
  | 'earn-royalty'
  | 'get-cited'
  | 'enter-building'
  | 'milestone';

/** Full-screen or localised visual effect applied after a juice trigger. */
export type ScreenEffect =
  | 'settle'
  | 'shake'
  | 'pulse-green'
  | 'flash-red'
  | 'glow'
  | 'fade';

/** A single juice event dispatched by gameplay actions. */
export interface JuiceEvent {
  trigger: JuiceTrigger;
  soundId: string;
  particleId: string;
  cameraEffect: CameraSettle | null;
  screenEffect: ScreenEffect | null;
}

/** Global juice configuration — lets the player (or system) dial intensity. */
export interface JuiceConfig {
  enabled: boolean;
  /** Overall juice strength. 0 = silent, 1 = full fireworks. */
  intensity: number; // 0–1
  screenShakeEnabled: boolean;
  particlesEnabled: boolean;
}

/** Short audio cue tied to a juice event. */
export interface SoundFeedback {
  clipId: string;
  /** Playback volume. */
  volume: number; // 0–1
  /** Pitch multiplier (1 = normal). */
  pitch: number;
  /** Delay before playback in ms. */
  delay: number;
}

/** One-shot particle burst spawned at a world position. */
export interface ParticleBurst {
  position: { x: number; y: number; z: number };
  count: number;
  color: string;
  /** Cone spread in degrees. */
  spread: number;
  /** Lifetime in ms. */
  duration: number;
}

/** Smooth camera ease after placement or validation. */
export interface CameraSettle {
  targetPosition: { x: number; y: number; z: number };
  /** Settle duration in ms. */
  settleTime: number;
  /** How far the camera overshoots before settling back (0–1). */
  overshoot: number;
}

// ── 2. Soundscapes ──────────────────────────────────────────────────

/** Time-of-day gate for an ambience layer. */
export type TimeOfDay = 'always' | 'day' | 'night' | 'dawn' | 'dusk';

/** A single sound layer inside a district soundscape. */
export interface AmbienceLayer {
  soundId: string;
  volume: number; // 0–1
  /** World-unit radius within which this layer is audible. */
  fadeRadius: number;
  timeOfDay: TimeOfDay;
}

/** The full ambient bed for one district. */
export interface SoundscapeBed {
  districtId: string;
  layers: AmbienceLayer[];
}

/** Mapping from district name keys to their ambience layer configs. */
export type DistrictAmbiencePreset = Record<string, AmbienceLayer[]>;

/** Controls how audio crossfades between districts. */
export interface CrossfadeConfig {
  /** Transition duration in ms. Default 200. */
  transitionDuration: number;
  easing: string;
  /** 0–1 — how much the two beds overlap mid-crossfade. */
  overlapPercent: number;
}

// ── 3. Hidden Assistance ────────────────────────────────────────────

/** Flavour of invisible help offered to the player. */
export type AssistanceHintType = 'near-miss' | 'suggestion' | 'encouragement';

/** A gentle nudge surfaced when the player is struggling. */
export interface AssistanceHint {
  type: AssistanceHintType;
  message: string;
  targetMemberId: string;
  suggestedFix: string | null;
}

/** Detects when a structural member is *almost* valid. */
export interface NearMissDetection {
  memberId: string;
  stressRatio: number;
  /** How far over capacity, as a percentage (e.g. 8 = 8 %). */
  overBy: number;
  /** Human-readable suggestion, e.g. "increase diameter by 2 cm". */
  fixDescription: string;
}

/** Proposes the smallest property tweak to bring a member into compliance. */
export interface SmallestFixSuggestion {
  memberId: string;
  property: string;
  currentValue: number;
  suggestedValue: number;
  resultingRatio: number;
}

/** Governs when hidden assistance kicks in. */
export interface AssistanceThreshold {
  /** Maximum percentage overage before assistance activates. Default 10. */
  maxOveragePercent: number;
  enabled: boolean;
  showForNewUsersOnly: boolean;
}

// ── 4. Dynamic Difficulty / Adaptive Complexity ─────────────────────

/** Broad expertise band inferred from player behaviour. */
export type ExpertiseLevel =
  | 'newcomer'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

/** A single observed player action that informs the complexity profile. */
export interface BehaviorSignal {
  type:
    | 'material-choice'
    | 'cross-section-config'
    | 'validation-check'
    | 'build-speed'
    | 'ui-navigation';
  /** Normalised complexity of the action. */
  complexity: number; // 0–1
}

/** How much technical detail the UI should expose. */
export type UIDetailLevel = 'simplified' | 'standard' | 'detailed' | 'engineering';

/** Per-user adaptive complexity state. */
export interface ComplexityProfile {
  userId: string;
  inferredExpertise: ExpertiseLevel;
  signals: BehaviorSignal[];
  /** ISO-8601 timestamp. */
  lastUpdated: string;
  detailLevel: UIDetailLevel;
}

/** Output of the expertise inference engine. */
export interface ExpertiseInference {
  signals: BehaviorSignal[];
  confidence: number; // 0–1
  recommendation: UIDetailLevel;
}

// ── 5. Environmental Storytelling ───────────────────────────────────

/** Visual wear stage applied to buildings over time. */
export type WeatheringVisualState =
  | 'pristine'
  | 'light-wear'
  | 'weathered'
  | 'aged'
  | 'historic';

/** Weathering applied to an entire building based on age and climate. */
export interface WeatheringEffect {
  buildingId: string;
  /** Age in days. */
  age: number;
  /** Climate exposure factor (0 = sheltered, 1 = fully exposed). */
  climateExposure: number;
  visualState: WeatheringVisualState;
}

/** Per-DTU age and weathering metadata. */
export interface AgeIndicator {
  dtuId: string;
  /** ISO-8601 creation date. */
  createdAt: string;
  daysSinceCreation: number;
  weatheringLevel: number; // 0–1
}

/** Badge awarded when a building survives (or doesn't) a disaster. */
export interface DisasterBadge {
  buildingId: string;
  event: string;
  survived: boolean;
  magnitude: number;
  displayIcon: string;
}

/** Prestige tier for a heavily-cited DTU. */
export type PrestigeLevel = 'standard' | 'notable' | 'renowned' | 'legendary';

/** Citation-driven visual flair on a DTU. */
export interface CitationPrestige {
  dtuId: string;
  citationCount: number;
  prestigeLevel: PrestigeLevel;
  visualEffect: string;
}

/** Foot-traffic wear on a district path. */
export interface WearPattern {
  districtId: string;
  pathId: string;
  trafficCount: number;
  wornLevel: number; // 0–1
}

/** A single entry in a building's timeline. */
export interface HistoryEntry {
  timestamp: string;
  event: string;
  description: string;
}

/** Full history of notable events for a building. */
export interface BuildingHistory {
  buildingId: string;
  events: HistoryEntry[];
}

// ── 6. Secrets and Discovery ────────────────────────────────────────

/** Categories of hidden discoveries scattered through the world. */
export type DiscoveryType =
  | 'material-composition'
  | 'terrain-feature'
  | 'npc-secret'
  | 'easter-egg'
  | 'perfect-validation'
  | 'famous-structure-match';

/** What the player earns for finding a secret. */
export type DiscoveryRewardType = 'title' | 'badge' | 'material' | 'cosmetic' | 'reputation';

/** Condition that unlocks a hidden discovery. */
export interface SecretTrigger {
  condition: string;
  hint: string;
  /** Proximity radius required to trigger, in world units. */
  radius: number;
  /** Minimum time the player must remain in range (ms). */
  timeRequirement: number;
}

/** Reward granted upon discovery. */
export interface DiscoveryReward {
  type: DiscoveryRewardType;
  value: string;
}

/** A hidden discovery placed in the world. */
export interface HiddenDiscovery {
  id: string;
  type: DiscoveryType;
  location: { x: number; y: number };
  trigger: SecretTrigger;
  reward: DiscoveryReward;
  discoveredBy: string[];
}

// ── 7. Variable Reinforcement / "Almost" Feeling ────────────────────

/** Kind of variable-schedule reward moment. */
export type ReinforcementType =
  | 'citation-surge'
  | 'royalty-moment'
  | 'discovery'
  | 'recognition';

/** Timing of the reinforcement relative to the triggering action. */
export type ReinforcementTiming = 'immediate' | 'delayed';

/** A single reinforcement event felt by the player. */
export interface ReinforcementEvent {
  type: ReinforcementType;
  timing: ReinforcementTiming;
  magnitude: number;
}

/** A sudden spike in citations for a single DTU. */
export interface CitationSurge {
  dtuId: string;
  count: number;
  /** Window over which citations arrived, in ms. */
  timeWindow: number;
  triggerUser: string;
  isInfluencer: boolean;
}

/** Level of celebration shown for a royalty payout. */
export type CelebrationLevel = 'subtle' | 'normal' | 'grand';

/** A royalty payout moment with optional dramatic delay. */
export interface RoyaltyMoment {
  amount: number;
  source: string;
  /** Delay before displaying the payout, in ms. */
  displayDelay: number;
  celebrationLevel: CelebrationLevel;
}

/** Tracks state that feeds the anticipation / "almost" feeling. */
export interface AnticipationState {
  pendingCitations: number;
  recentPublishes: number;
  /** ISO-8601 timestamp. */
  lastRoyaltyTime: string;
}

// ── 8. Ownership and Territory ──────────────────────────────────────

/** Emotional attachment score for a player within a district. */
export interface OwnershipSentiment {
  userId: string;
  worldId: string;
  districtId: string;
  buildingsCited: number;
  totalContributions: number;
  /** Emotional ownership score, 0 = indifferent, 100 = deeply invested. */
  emotionalScore: number; // 0–100
}

/** Who dominates a district and by how much. */
export interface TerritoryControl {
  districtId: string;
  topContributors: Array<{ userId: string; percentage: number }>;
  dominantFirm: string | null;
}

/** A player's complete creative output portfolio. */
export interface CreationPortfolio {
  userId: string;
  dtus: string[];
  totalCitations: number;
  totalRoyalties: number;
  highlights: string[];
}

/** A creator-curated walking tour through their work. */
export interface GuidedTourConfig {
  tourId: string;
  stops: Array<{
    position: { x: number; y: number };
    description: string;
    dtuRef: string | null;
  }>;
  creatorId: string;
}

/** Contribution breakdown for a single user in a single district. */
export interface DistrictContribution {
  userId: string;
  districtId: string;
  buildingsPlaced: number;
  componentsCited: number;
  infraContributed: number;
}

/** Long-term legacy profile for a veteran player. */
export interface LegacyProfile {
  userId: string;
  /** ISO-8601 date the player first entered the world. */
  foundedDate: string;
  majorWorks: string[];
  apprenticesTrained: number;
  badgesEarned: string[];
}

// ── 9. Loss Aversion and Stakes ─────────────────────────────────────

/** Kind of consequence threatening the player's investments. */
export type ConsequenceType =
  | 'building-damage'
  | 'policy-change'
  | 'royalty-decline'
  | 'relevance-drop'
  | 'entropy';

/** A consequence event that requires the player's attention. */
export interface ConsequenceEvent {
  type: ConsequenceType;
  targetId: string;
  /** 0 = trivial, 1 = catastrophic. */
  severity: number;
  description: string;
  actionRequired: boolean;
}

/** Damage applied to a building after a disaster or neglect. */
export interface BuildingDamage {
  buildingId: string;
  cause: string;
  /** 0 = pristine, 1 = destroyed. */
  damageLevel: number; // 0–1
  repairCost: number;
  /** ISO-8601 deadline for repair before further degradation. */
  deadline: string | null;
}

/** Reason a DTU's royalty rate has dropped. */
export type RoyaltyDeclineReason = 'superseded' | 'fewer-citations' | 'policy';

/** Notification that a DTU is earning fewer royalties. */
export interface RoyaltyDecline {
  dtuId: string;
  previousRate: number;
  currentRate: number;
  reason: RoyaltyDeclineReason;
}

/** Slow relevance decay applied to ageing, uncited DTUs. */
export interface EntropyEffect {
  dtuId: string;
  /** Age in days. */
  age: number;
  /** 0 = forgotten, 100 = highly relevant. */
  relevanceScore: number; // 0–100
  /** ISO-8601 timestamp. */
  lastCitedAt: string;
  trending: 'up' | 'down' | 'stable';
}

/** Breakdown of factors contributing to a DTU's relevance score. */
export interface RelevanceScore {
  dtuId: string;
  score: number;
  factors: {
    citationRecency: number;
    competitorCount: number;
    usageRate: number;
  };
}

// ── 10. Social Proof and Spectacle ──────────────────────────────────

/** Category of a live activity feed entry. */
export type ActivityEventType =
  | 'build'
  | 'citation'
  | 'milestone'
  | 'event'
  | 'record';

/** A single event in the live activity feed. */
export interface ActivityEvent {
  type: ActivityEventType;
  actor: string;
  description: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** 0 = routine, 1 = world-shaking. */
  significance: number;
}

/** Live feed of world activity shown to spectators and participants. */
export interface LiveActivityFeed {
  events: ActivityEvent[];
}

/** Real-time player population display for a world. */
export interface PlayerCountDisplay {
  worldId: string;
  count: number;
  trend: 'rising' | 'falling' | 'stable';
  peakToday: number;
}

/** Stats for a competition or build event. */
export interface CompetitionStats {
  eventId: string;
  entryCount: number;
  viewerCount: number;
  topEntries: string[];
}

/** View analytics for a single DTU. */
export interface ViewCount {
  dtuId: string;
  views: number;
  uniqueViewers: number;
  trending: boolean;
}

/** A DTU currently gaining traction in the community. */
export interface TrendingCreation {
  dtuId: string;
  creator: string;
  citationsThisWeek: number;
  rank: number;
  category: string;
}

/** Real-time activity intensity within a district. */
export interface ActivityPulse {
  districtId: string;
  /** 0 = quiet, 1 = buzzing. */
  intensity: number; // 0–1
  dominantActivity: string;
}

// ── 11. Ritual and Routine ──────────────────────────────────────────

/** Summary presented when a player logs in. */
export interface DailyCheckIn {
  userId: string;
  /** ISO-8601 date. */
  date: string;
  overnightRoyalties: number;
  newCitations: number;
  worldEvents: string[];
  weatherChanges: string[];
  npcUpdates: string[];
}

/** Everything that happened while the player was away. */
export interface OvernightSummary {
  /** Human-readable period, e.g. "8 h 23 min". */
  period: string;
  royaltiesEarned: number;
  citationsReceived: number;
  worldEventsOccurred: string[];
  buildingsAffected: string[];
  npcActivities: string[];
}

/** A single headline in the morning newspaper. */
export interface NewspaperHeadline {
  title: string;
  category: string;
  body: string;
  relatedDTU: string | null;
}

/** In-world newspaper delivered each morning. */
export interface MorningNewspaper {
  headlines: NewspaperHeadline[];
  /** ISO-8601 date. */
  date: string;
  districtId: string;
}

/** NPC memory changes that occurred overnight. */
export interface NPCMemoryUpdate {
  npcId: string;
  newMemories: string[];
  moodChange: number;
}

/** Weather impact report for a district. */
export interface WeatherImpactReport {
  districtId: string;
  weatherEvents: string[];
  buildingsAffected: string[];
  damageAssessment: string;
}

// ── 12. Emergent Storytelling ───────────────────────────────────────

/** Category of emergent moment. */
export type EmergentMomentType =
  | 'system-interaction'
  | 'npc-reaction'
  | 'crisis'
  | 'spectacle'
  | 'coincidence';

/** An unscripted moment that emerged from overlapping systems. */
export interface EmergentMoment {
  id: string;
  type: EmergentMomentType;
  description: string;
  involvedEntities: string[];
  /** ISO-8601 timestamp. */
  timestamp: string;
  witnesses: string[];
}

/** Two game systems interacting in an interesting way. */
export interface SystemInteraction {
  systemA: string;
  systemB: string;
  result: string;
  unexpected: boolean;
}

/** An event that was not scripted and arose from emergent chains. */
export interface UnscriptedEvent {
  trigger: string;
  chain: string[];
  outcome: string;
  playerCount: number;
}

/** How an NPC reacted to a stimulus. */
export interface NPCReaction {
  npcId: string;
  stimulus: string;
  response: string;
  emotional: boolean;
  witnessed: boolean;
}

/** A district-wide crisis arising from system failure or disaster. */
export interface DistrictCrisis {
  districtId: string;
  cause: string;
  severity: number;
  affectedBuildings: string[];
  affectedNPCs: string[];
  resolution: string | null;
}

/** A large public spectacle drawing spectators. */
export interface PublicSpectacle {
  location: { x: number; y: number };
  type: string;
  viewerCount: number;
  /** Duration in ms. */
  duration: number;
  memorable: boolean;
}

// ── 13. Camera and Framing ──────────────────────────────────────────

/** A scripted cinematic camera moment triggered by gameplay. */
export interface CinematicMoment {
  trigger: string;
  cameraPath: Array<{ x: number; y: number; z: number }>;
  /** Duration in ms. */
  duration: number;
  hudVisible: boolean;
}

/** Zoom-out after placing a building to show neighbourhood context. */
export interface PlacementZoomOut {
  buildingId: string;
  startZoom: number;
  endZoom: number;
  /** Duration in ms. */
  duration: number;
  showContext: boolean;
}

/** Transition animation when entering or exiting a building interior. */
export interface DoorwayTransition {
  buildingId: string;
  direction: 'enter' | 'exit';
  /** Duration in ms. */
  duration: number;
  /** Cross-fade between exterior and interior soundscapes. */
  soundCrossfade: boolean;
}

/** Camera shake when disaster strikes. */
export interface DisasterShake {
  magnitude: number;
  /** Duration in ms. */
  duration: number;
  /** Shake frequency in Hz. */
  frequency: number;
  /** Damping factor applied each cycle (0–1). */
  damping: number;
}

/** Celebratory camera orbit when a milestone is reached. */
export interface MilestoneCamera {
  type: string;
  targetPosition: { x: number; y: number; z: number };
  /** Orbit duration in ms. */
  orbitDuration: number;
  celebrationVFX: string;
}

/** Reveal shot that shows surrounding context entities. */
export interface ContextReveal {
  center: { x: number; y: number };
  radius: number;
  /** Duration in ms. */
  duration: number;
  highlightEntities: string[];
}

// ── 14. Pacing and Downtime ─────────────────────────────────────────

/** Current player activity category for pacing analysis. */
export type PacingActivity =
  | 'build'
  | 'validate'
  | 'explore'
  | 'rest'
  | 'socialize'
  | 'craft'
  | 'compete';

/** Snapshot of the player's current pacing state. */
export interface PacingState {
  current: PacingActivity;
  /** 0 = idle, 1 = maximum intensity. */
  intensity: number; // 0–1
  /** Time spent in this state, in ms. */
  duration: number;
}

/** Tracks recent player intensity to suggest breaks. */
export interface ActivityIntensity {
  userId: string;
  recentActions: number;
  avgIntensity: number; // 0–1
  suggestBreak: boolean;
}

/** A designated calm zone in the world. */
export interface RestZone {
  position: { x: number; y: number };
  radius: number;
  ambience: string;
  seatingCapacity: number;
}

/** Trigger for a peaceful moment. */
export type PeacefulTrigger =
  | 'bench-sit'
  | 'vista-view'
  | 'npc-watch'
  | 'ambient-listen';

/** A quiet, contemplative moment experienced by the player. */
export interface PeacefulMoment {
  location: { x: number; y: number };
  trigger: PeacefulTrigger;
  /** Duration in ms. */
  duration: number;
}

// ── 15. The Meta-Game ───────────────────────────────────────────────

/** Domain category for a meta-game discovery. */
export type MetaCategory =
  | 'material-efficiency'
  | 'structural-optimization'
  | 'cost-reduction'
  | 'environmental'
  | 'aesthetic';

/** A meta-game insight discovered and potentially shared by a player. */
export interface MetaDiscovery {
  id: string;
  category: MetaCategory;
  description: string;
  discoveredBy: string;
  sharedCount: number;
}

/** A repeatable optimisation technique found by a player. */
export interface OptimizationStrategy {
  name: string;
  domain: string;
  technique: string;
  /** Improvement as a percentage (e.g. 12 = 12 %). */
  improvement: number;
  discoveredBy: string;
}

/** Performance-per-cost analysis for a material in a given application. */
export interface MaterialEfficiency {
  materialId: string;
  application: string;
  performancePerCost: number;
  comparisons: Array<{ materialId: string; performancePerCost: number }>;
}

/** Status of a community-proposed theory. */
export type TheoryStatus = 'proposed' | 'tested' | 'confirmed' | 'debunked';

/** A community-sourced theory about game mechanics or optimisation. */
export interface CommunityTheory {
  id: string;
  title: string;
  author: string;
  description: string;
  supportingEvidence: string[];
  debateCount: number;
  status: TheoryStatus;
}

/** A deep engineering insight applicable across multiple contexts. */
export interface EngineeringInsight {
  domain: string;
  finding: string;
  evidence: string[];
  applicableContexts: string[];
}
