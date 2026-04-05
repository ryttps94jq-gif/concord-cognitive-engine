/**
 * World Lens — Game Systems Type Definitions
 *
 * All types for the 21 auxiliary game systems: sound, inventory,
 * crafting, combat, progression, quests, map, camera, animation,
 * HUD, notifications, accessibility, settings, persistence,
 * moderation, VFX, loading, localization, seasonal content,
 * replay, and analytics.
 */

// ── 1. Sound & Music ──────────────────────────────────────────────

export type SoundCategory =
  | 'ambient'
  | 'music'
  | 'sfx'
  | 'dialogue'
  | 'weather'
  | 'construction'
  | 'ui';

export interface SoundEvent {
  id: string;
  type: SoundCategory;
  source: string;
  volume: number; // 0–1
  position?: { x: number; y: number; z: number };
  loop: boolean;
}

export interface AmbientSoundscape {
  districtId: string;
  layers: Array<{
    sound: string;
    volume: number;
    fadeRadius: number;
  }>;
}

export interface MusicTrack {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  intensity: number; // 0–1
}

/** Master audio mixer state. */
export interface AudioState {
  masterVolume: number;
  categoryVolumes: Record<SoundCategory, number>;
  currentSoundscape: string | null;
  currentMusic: string | null;
  spatialEnabled: boolean;
}

// ── 2. Inventory & Equipment ──────────────────────────────────────

export type ItemCategory =
  | 'tool'
  | 'material'
  | 'component'
  | 'blueprint'
  | 'consumable'
  | 'equipment'
  | 'trophy';

export interface InventoryItem {
  id: string;
  name: string;
  category: ItemCategory;
  quantity: number;
  dtuRef?: string;
  icon: string;
}

export interface ToolItem extends InventoryItem {
  category: 'tool';
  durability: number;
  maxDurability: number;
  efficiency: number;
}

export interface MaterialStack {
  materialId: string;
  quantity: number;
  quality: number; // 0–1
}

export interface EquipmentLoadout {
  head: string | null;
  body: string | null;
  hands: string | null;
  tool: string | null;
  accessory: string | null;
}

export interface InventoryState {
  items: InventoryItem[];
  maxSlots: number;
  equipped: EquipmentLoadout;
  storageRefs: string[];
}

// ── 3. Crafting ───────────────────────────────────────────────────

export interface CraftingIngredient {
  itemId: string;
  quantity: number;
}

export type CraftingStationType =
  | 'forge'
  | 'workbench'
  | 'lab'
  | 'assembly'
  | 'kiln';

export interface CraftingRecipe {
  id: string;
  name: string;
  inputs: CraftingIngredient[];
  output: CraftingIngredient;
  stationType: CraftingStationType;
  duration: number; // seconds
  skillRequired?: string;
}

export interface CraftingStation {
  id: string;
  type: CraftingStationType;
  position: { x: number; y: number };
  recipes: string[];
  currentJob: string | null;
}

export interface CraftingResult {
  success: boolean;
  outputItem: CraftingIngredient;
  qualityBonus: number;
  byproducts: CraftingIngredient[];
}

// ── 4. Combat (user worlds only, not Concordia) ───────────────────

export interface CombatStats {
  health: number;
  maxHealth: number;
  armor: number;
  resistance: number;
  stamina: number;
}

export type WeaponType = 'melee' | 'ranged';

export interface WeaponDTU {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  range: number;
  speed: number;
  materialRefs: string[];
  creator: string;
}

export interface ArmorDTU {
  id: string;
  name: string;
  slot: string;
  protection: number;
  ballisticRating: number;
  materialRefs: string[];
  creator: string;
}

export interface CoverBonus {
  structuralIntegrity: number; // 0–1 ratio
  protection: number;
}

export interface HitResult {
  damage: number;
  blocked: boolean;
  penetrated: boolean;
  coverBonus: CoverBonus | null;
}

export type CombatMode = 'pve' | 'pvp' | 'disabled';

// ── 5. Progression (reputation-based, NOT XP) ────────────────────

export type ReputationDomain =
  | 'structural'
  | 'materials'
  | 'infrastructure'
  | 'energy'
  | 'architecture'
  | 'mentorship'
  | 'governance'
  | 'exploration';

export type ProfessionalTier =
  | 'novice'
  | 'apprentice'
  | 'journeyman'
  | 'expert'
  | 'master'
  | 'grandmaster';

/** A player's accumulated reputation across all professional domains. */
export interface ReputationProfile {
  userId: string;
  domains: Record<ReputationDomain, {
    score: number;
    tier: ProfessionalTier;
    citations: number;
  }>;
  totalCitations: number;
  totalRoyalties: number;
  badges: string[];
}

export interface UnlockRequirement {
  domain: ReputationDomain;
  tier: ProfessionalTier;
  minCitations: number;
  minRoyalties: number;
}

export interface CitationMilestone {
  threshold: number;
  reward: string;
  title: string;
}

// ── 6. Quest & Mission ────────────────────────────────────────────

export type QuestType = 'main' | 'side' | 'daily' | 'chain' | 'community';

export type QuestObjectiveType =
  | 'location'
  | 'build'
  | 'deliver'
  | 'talk-npc'
  | 'survive'
  | 'inspect'
  | 'craft';

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  target: string;
  current: number;
  required: number;
  description: string;
}

export type QuestTriggerType =
  | 'enter-area'
  | 'time'
  | 'npc-interact'
  | 'build-complete'
  | 'reputation-reach';

export interface QuestTrigger {
  type: QuestTriggerType;
  condition: string;
}

export type QuestRewardType =
  | 'currency'
  | 'component'
  | 'reputation'
  | 'access'
  | 'title';

export interface QuestReward {
  type: QuestRewardType;
  value: string | number;
}

export interface QuestDTU {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  triggers: QuestTrigger[];
  creator: string;
  royaltyRate: number;
}

// ── 7. Map & Navigation ──────────────────────────────────────────

export interface MinimapConfig {
  center: { x: number; y: number };
  zoom: number;
  showBuildings: boolean;
  showNPCs: boolean;
  showPlayers: boolean;
  showInfra: boolean;
  radius: number;
}

export interface WaypointMarker {
  id: string;
  position: { x: number; y: number };
  label: string;
  icon: string;
  color: string;
  persistent: boolean;
}

export type MapLayer =
  | 'terrain'
  | 'buildings'
  | 'infrastructure'
  | 'npcs'
  | 'players'
  | 'zones'
  | 'weather';

export interface NavigationPath {
  waypoints: Array<{ x: number; y: number }>;
  distance: number; // meters
  estimatedTime: number; // seconds
}

export interface WorldMapRegion {
  id: string;
  name: string;
  position: { x: number; y: number };
  bounds: { width: number; height: number };
  districtCount: number;
  playerCount: number;
}

// ── 8. Camera ─────────────────────────────────────────────────────

export type CameraMode =
  | 'isometric'
  | 'follow'
  | 'free'
  | 'interior'
  | 'cinematic';

export type ZoomLevel = 'world' | 'district' | 'neighborhood' | 'building' | 'interior';

export interface CameraState {
  mode: CameraMode;
  position: { x: number; y: number; z: number };
  zoom: number;
  rotation: number;
  target: { x: number; y: number; z: number } | null;
  fov: number;
}

export interface CameraTransition {
  from: CameraState;
  to: CameraState;
  duration: number; // ms
  easing: string;
}

// ── 9. Animation ──────────────────────────────────────────────────

export interface AnimationClip {
  id: string;
  name: string;
  frames: number;
  duration: number; // ms
  loop: boolean;
}

export interface AnimationState {
  current: string | null;
  queue: string[];
  blending: boolean;
}

export type AvatarAnimation =
  | 'idle'
  | 'walk'
  | 'run'
  | 'build'
  | 'inspect'
  | 'craft'
  | 'sit'
  | 'wave'
  | 'celebrate';

export type ConstructionPhase =
  | 'foundation'
  | 'frame'
  | 'walls'
  | 'roof'
  | 'finish';

export interface ConstructionAnimation {
  buildingId: string;
  phase: ConstructionPhase;
  progress: number; // 0–1
}

export type WeatherParticleType =
  | 'rain'
  | 'snow'
  | 'dust'
  | 'leaves'
  | 'ash';

export interface WeatherParticle {
  type: WeatherParticleType;
  density: number;
  windAffected: boolean;
}

// ── 10. UI / HUD ─────────────────────────────────────────────────

export interface HUDElement {
  id: string;
  type: string;
  position: { x: number; y: number };
  visible: boolean;
  priority: number;
}

export type HUDMode = 'explore' | 'build' | 'inspect' | 'combat' | 'social';

export interface HUDLayout {
  elements: HUDElement[];
  mode: HUDMode;
}

export interface ToolbarSlot {
  index: number;
  itemId: string | null;
  keybind: string;
  cooldown: number; // ms remaining
}

export interface NotificationToast {
  id: string;
  message: string;
  type: string;
  icon: string;
  duration: number; // ms
  action?: string;
}

export interface CurrencyDisplay {
  concordCoin: number;
  royaltiesPending: number;
  dailyEarnings: number;
}

// ── 11. Notifications & Feeds ─────────────────────────────────────

export type NotificationType =
  | 'citation'
  | 'royalty'
  | 'discovery'
  | 'event'
  | 'system'
  | 'social'
  | 'moderation'
  | 'milestone';

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

export interface FeedItem {
  id: string;
  type: string;
  content: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface DailyDigest {
  date: string;
  newCitations: number;
  royaltiesEarned: number;
  worldEvents: string[];
  topCreation: string | null;
  npSummary: string;
}

export interface NotificationPreferences {
  enabledTypes: NotificationType[];
  dailyDigestEnabled: boolean;
  soundEnabled: boolean;
  doNotDisturb: boolean;
}

// ── 12. Accessibility ─────────────────────────────────────────────

export type ColorblindMode =
  | 'none'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia';

export interface AccessibilitySettings {
  colorblindMode: ColorblindMode;
  textScale: number;
  screenReaderEnabled: boolean;
  keyboardNavEnabled: boolean;
  reducedMotion: boolean;
  subtitlesEnabled: boolean;
  oneHandedMode: boolean;
  gameSpeed: number;
  highContrast: boolean;
}

// ── 13. Settings & Configuration ──────────────────────────────────

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  ambientVolume: number;
  sfxVolume: number;
  dialogueVolume: number;
  spatialAudio: boolean;
}

export interface ControlBindings {
  bindings: Record<string, string>; // action → keybind
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  worldVisibility: 'public' | 'friends' | 'private';
  activityStatus: boolean;
  allowDMs: boolean;
}

export interface GameSettings {
  graphics: GraphicsQuality;
  audio: AudioSettings;
  notifications: NotificationPreferences;
  privacy: PrivacySettings;
  controls: ControlBindings;
  locale: string;
  accessibility: AccessibilitySettings;
}

// ── 14. Save & Persistence ────────────────────────────────────────

export interface PlayerSaveState {
  userId: string;
  avatarState: Record<string, unknown>;
  inventory: InventoryState;
  progression: ReputationProfile;
  settings: GameSettings;
  lastPosition: { x: number; y: number; districtId: string };
  lastLogin: string;
  playtime: number; // seconds
}

export interface WorldPersistence {
  worldId: string;
  buildings: string[];
  npcs: string[];
  infrastructure: string[];
  weather: Record<string, unknown>;
  economy: Record<string, unknown>;
  lastTick: string;
}

export type OfflineCalculationType =
  | 'royalty'
  | 'npc-work'
  | 'weather'
  | 'growth';

export interface OfflineCalculation {
  type: OfflineCalculationType;
  accumulatedValue: number;
  period: { start: string; end: string };
}

export type SaveCheckpointType = 'auto' | 'manual';

export interface SaveCheckpoint {
  id: string;
  timestamp: string;
  worldId: string;
  type: SaveCheckpointType;
  metadata: Record<string, unknown>;
}

// ── 15. Anti-Grief & Moderation ───────────────────────────────────

export type BuildPermissionLevel = 'none' | 'view' | 'build' | 'modify' | 'admin';

export interface BuildingPermission {
  districtId: string;
  level: BuildPermissionLevel;
  userId: string;
}

export type ReportTargetType = 'building' | 'player' | 'npc' | 'component';

export interface ReportEntry {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: ReportTargetType;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  timestamp: string;
}

export type ModActionType =
  | 'warn'
  | 'mute'
  | 'ban'
  | 'remove-dtu'
  | 'restrict';

export interface ModAction {
  id: string;
  type: ModActionType;
  targetId: string;
  moderatorId: string;
  reason: string;
  expiresAt: string | null;
}

export interface RateLimitConfig {
  action: string;
  maxPerMinute: number;
  maxPerHour: number;
  cooldownMs: number;
}

export interface UndoAction {
  id: string;
  userId: string;
  actionType: string;
  targetId: string;
  previousState: Record<string, unknown>;
  timestamp: string;
  expiresAt: string;
}

export interface WorldOwnerControls {
  banList: string[];
  allowList: string[];
  buildPermission: BuildPermissionLevel;
  destroyPermission: BuildPermissionLevel;
  visitPermission: 'public' | 'friends' | 'allowlist' | 'private';
  maxVisitors: number;
  rules: string[];
}

// ── 16. Particle Effects & VFX ────────────────────────────────────

export interface ParticleConfig {
  count: number;
  lifetime: number; // ms
  speed: number;
  spread: number;
  color: string;
  size: number;
  gravity: number;
  fadeOut: boolean;
}

export interface ParticleEmitter {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  config: ParticleConfig;
  active: boolean;
}

export type VFXTrigger =
  | 'placement'
  | 'validation-pass'
  | 'validation-fail'
  | 'destruction'
  | 'weather'
  | 'celebration'
  | 'fire'
  | 'water'
  | 'electrical';

export interface WeatherVFX {
  type: string;
  intensity: number;
  windDirection: number; // degrees
  accumulation: number;
}

export interface ConstructionVFX {
  phase: ConstructionPhase;
  sparkleRate: number;
  dustAmount: number;
}

export type ValidationVFXStatus = 'green' | 'yellow' | 'red';

export interface ValidationVFX {
  status: ValidationVFXStatus;
  pulseRate: number;
  glowIntensity: number;
}

// ── 17. Loading & Transitions ─────────────────────────────────────

export interface LoadingScreen {
  destinationId: string;
  destinationName: string;
  progress: number; // 0–100
  tip: string;
  stats?: Record<string, unknown>;
}

export type GameTransitionType =
  | 'seamless'
  | 'portal'
  | 'fast-travel'
  | 'loading'
  | 'assembly';

export interface FastTravelPoint {
  id: string;
  name: string;
  districtId: string;
  position: { x: number; y: number };
  unlocked: boolean;
  cost: number;
}

export interface PortalLink {
  sourceWorldId: string;
  destWorldId: string;
  sourcePosition: { x: number; y: number };
  destPosition: { x: number; y: number };
  bidirectional: boolean;
}

export type AssemblyLoadPhase =
  | 'terrain'
  | 'infrastructure'
  | 'buildings'
  | 'npcs'
  | 'weather';

export interface AssemblyLoadState {
  phase: AssemblyLoadPhase;
  progress: number; // 0–1
}

// ── 18. Localization ──────────────────────────────────────────────

export type LanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'pt'
  | 'ru'
  | 'ar'
  | 'hi';

export interface LocaleConfig {
  language: LanguageCode;
  region: string;
  dateFormat: string;
  numberFormat: string;
  measurementUnit: 'metric' | 'imperial';
}

export interface TranslationKey {
  namespace: string;
  key: string;
}

export interface NPCDialogueTranslation {
  npcId: string;
  sourceText: string;
  translatedText: string;
  targetLanguage: LanguageCode;
}

// ── 19. Seasonal & Timed Content ──────────────────────────────────

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface SeasonalEvent {
  id: string;
  name: string;
  season: Season;
  startDate: string;
  endDate: string;
  theme: string;
  challenges: string[];
  decorations: string[];
  rewards: string[];
}

export interface HolidayTheme {
  id: string;
  name: string;
  decorationOverrides: Record<string, string>;
  specialNPCs: string[];
  limitedItems: string[];
}

export interface MonthlyChallenge {
  id: string;
  month: number; // 1–12
  title: string;
  description: string;
  objective: string;
  leaderboardId: string;
  rewards: string[];
}

export interface AnnualCompetition {
  id: string;
  year: number;
  title: string;
  categories: string[];
  submissionDeadline: string;
  judgingCriteria: string[];
  prizes: string[];
}

export interface SeasonalWeather {
  season: Season;
  tempRange: { min: number; max: number };
  precipitation: number;
  dayLength: number; // hours
  specialEvents: string[];
}

// ── 20. Replay & Spectator ────────────────────────────────────────

export interface CameraKeyframe {
  position: { x: number; y: number; z: number };
  rotation: number;
  zoom: number;
  timestamp: number; // ms
}

export interface CameraPath {
  keyframes: CameraKeyframe[];
}

export interface ReplayEvent {
  timestamp: number;
  type: string;
  actorId: string;
  data: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface ReplayRecording {
  id: string;
  worldId: string;
  startTime: string;
  endTime: string;
  events: ReplayEvent[];
  cameraPath: CameraPath;
}

export interface SpectatorMode {
  targetUserId: string | null;
  cameraMode: CameraMode;
  showHUD: boolean;
  showAnnotations: boolean;
  chatEnabled: boolean;
}

export interface TimelapseConfig {
  worldId: string;
  startTime: string;
  endTime: string;
  speed: number; // multiplier
  cameraPath: CameraPath;
  resolution: { width: number; height: number };
}

// ── 21. Analytics Dashboard ───────────────────────────────────────

export interface PersonalStats {
  totalCitations: number;
  totalRoyalties: number;
  mostCitedDTU: string | null;
  mostUsedMaterial: string | null;
  reputationByDomain: Record<ReputationDomain, number>;
  buildCount: number;
  playtime: number; // seconds
  loginStreak: number; // days
}

export interface WorldStats {
  worldId: string;
  population: number;
  buildingCount: number;
  infraCoverage: number; // 0–1
  envScore: number; // 0–100
  economicActivity: number;
  visitorCount: number;
}

export interface GlobalStats {
  activeDistricts: number;
  trendingComponents: string[];
  topCreators: string[];
  totalBuildings: number;
  totalCitations: number;
  activeUsers: number;
}

export interface StatDataPoint {
  timestamp: string;
  value: number;
}

export interface StatTimeseries {
  metric: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dataPoints: StatDataPoint[];
}

export type PerformanceTrend = 'up' | 'down' | 'stable';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  trend: PerformanceTrend;
}
