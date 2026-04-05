/**
 * World Lens — Premium Features Type Definitions
 *
 * All types for the premium "holy shit" feature set: voice interface,
 * command palette, real-time collaboration, export & embed, AR preview,
 * mobile companion, achievement system, lens widgets & plugins,
 * smart notifications, and keyboard / power-user tooling.
 */

// ── 1. Voice Interface ──────────────────────────────────────────────

/** Recognised voice intents that map to world actions. */
export type VoiceIntent =
  | 'build'
  | 'navigate'
  | 'search'
  | 'simulate'
  | 'inspect'
  | 'modify'
  | 'invite'
  | 'chat';

/** A single transcribed voice command with parsed intent. */
export interface VoiceCommand {
  transcript: string;
  intent: VoiceIntent;
  /** 0–1 confidence score from the recognition engine. */
  confidence: number;
  /** Key-value parameters extracted from the transcript (e.g. target, material). */
  parameters: Record<string, string>;
  /** ISO-8601 timestamp of recognition. */
  timestamp: string;
}

/** Outcome returned after executing a voice command. */
export interface VoiceCommandResult {
  success: boolean;
  /** Human-readable description of the action taken. */
  action: string;
  /** Spoken or displayed feedback to the user. */
  feedback: string;
  /** Execution wall-time in milliseconds. */
  executionTime: number;
}

/** Configuration for the speech-to-text pipeline. */
export interface SpeechToTextConfig {
  engine: 'whisper-local' | 'deepgram' | 'browser';
  /** BCP-47 language code, e.g. "en-US". */
  language: string;
  /** Keep the microphone open between utterances. */
  continuous: boolean;
  /** Emit partial transcripts while the user is still speaking. */
  interimResults: boolean;
}

/** Configuration for the text-to-speech pipeline. */
export interface TextToSpeechConfig {
  /** Named voice identifier (browser voice name or ElevenLabs voice id). */
  voice: string;
  /** Playback rate multiplier. 1.0 is normal speed. */
  rate: number;
  /** Pitch multiplier. 1.0 is normal pitch. */
  pitch: number;
  /** Volume 0–1. */
  volume: number;
  engine: 'browser' | 'elevenlabs';
}

/** Per-NPC voice customisation for dialogue playback. */
export interface NPCVoiceProfile {
  npcId: string;
  voiceId: string;
  pitch: number;
  rate: number;
  accent: string;
  /** Personality tag that influences inflection and pauses. */
  personality: string;
}

/** Runtime state of the voice subsystem. */
export interface VoiceSessionState {
  active: boolean;
  listening: boolean;
  processing: boolean;
  lastTranscript: string | null;
  lastIntent: VoiceIntent | null;
}

// ── 2. Command Palette ──────────────────────────────────────────────

/** Categories that group command palette results. */
export type CommandCategory =
  | 'navigation'
  | 'building'
  | 'simulation'
  | 'social'
  | 'search'
  | 'settings'
  | 'lens';

/** A single result row surfaced in the command palette. */
export interface CommandResult {
  id: string;
  type: 'navigation' | 'action' | 'search' | 'entity' | 'setting';
  label: string;
  description: string;
  icon: string;
  /** Callback key or action identifier to execute. */
  action: string;
  /** Display string for the keyboard shortcut, e.g. "Ctrl+K". */
  shortcut: string | null;
}

/** Snapshot of a previously executed palette query. */
export interface RecentCommand {
  query: string;
  result: CommandResult;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/** Ambient context fed into the palette's ranking algorithm. */
export interface CommandContext {
  currentDistrict: string | null;
  currentWorld: string | null;
  profession: string | null;
  activeTools: string[];
}

/** Full runtime state of the command palette UI. */
export interface CommandPaletteState {
  open: boolean;
  query: string;
  results: CommandResult[];
  selectedIndex: number;
  recentCommands: RecentCommand[];
}

// ── 3. Real-Time Collaboration ──────────────────────────────────────

/** Types of edits that can be applied to a DTU during collaboration. */
export type DTUEditType =
  | 'modify-parameter'
  | 'add-member'
  | 'remove-member'
  | 'change-material'
  | 'move';

/** A single edit event broadcast to all session participants. */
export interface DTUEditEvent {
  userId: string;
  type: DTUEditType;
  /** JSON-pointer-style path to the affected property. */
  path: string;
  oldValue: unknown;
  newValue: unknown;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

/** Strategy used to resolve a conflict between concurrent edits. */
export type ConflictStrategy = 'last-write' | 'manual' | 'merge';

/** Record of a single conflict and its resolution. */
export interface ConflictResolution {
  parameterId: string;
  values: Array<{ userId: string; value: unknown }>;
  resolvedValue: unknown;
  resolvedBy: string;
  strategy: ConflictStrategy;
}

/** Another user's cursor / selection state inside the collaborative editor. */
export interface CollaboratorCursor {
  userId: string;
  /** CSS-compatible colour assigned for this collaborator. */
  color: string;
  position: { x: number; y: number; z: number };
  /** The DTU member id currently selected, if any. */
  selectedMemberId: string | null;
  /** Active tool name, e.g. "move", "scale", "annotate". */
  tool: string | null;
  /** ISO-8601 timestamp of last cursor update. */
  timestamp: string;
}

/** Top-level session that coordinates real-time DTU editing. */
export interface CollaborationSession {
  id: string;
  dtuId: string;
  participants: string[];
  cursors: CollaboratorCursor[];
  editHistory: DTUEditEvent[];
  conflictQueue: ConflictResolution[];
}

/** A single immutable snapshot in a DTU's version chain. */
export interface DTUVersion {
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  author: string;
  changes: DTUEditEvent[];
  /** Validation result at commit time. */
  validationResult: 'pass' | 'warning' | 'fail';
  parentVersion: string | null;
  /** Human-readable commit message. */
  message: string;
}

/** Complete version history for a DTU. */
export interface DTUVersionHistory {
  dtuId: string;
  versions: DTUVersion[];
}

// ── 4. Export & Embed ───────────────────────────────────────────────

/** Supported 3-D and document export formats. */
export type ExportFormat =
  | 'gltf'
  | 'pdf'
  | 'embed-iframe'
  | 'link'
  | 'stl'
  | 'obj'
  | 'step';

/** Parameters that control an export job. */
export interface ExportConfig {
  format: ExportFormat;
  /** Quality hint 0–1 (geometry decimation, texture resolution, etc.). */
  quality: number;
  includeValidation: boolean;
  includeMetadata: boolean;
  includeCitations: boolean;
}

/** Result payload returned after an export job completes. */
export interface ExportResult {
  url: string;
  format: ExportFormat;
  /** File size in bytes. */
  fileSize: number;
  /** ISO-8601 timestamp. */
  generatedAt: string;
  /** ISO-8601 timestamp after which the URL is no longer valid. */
  expiresAt: string;
}

/** Configuration for an embeddable DTU viewer iframe. */
export interface EmbedConfig {
  dtuId: string;
  width: number;
  height: number;
  interactive: boolean;
  showControls: boolean;
  theme: 'dark' | 'light';
  autoRotate: boolean;
}

/** Which sections to include in a generated PDF report. */
export type PDFReportSection =
  | 'overview'
  | 'structure'
  | 'validation'
  | 'materials'
  | 'citations';

/** Parameters for generating a DTU PDF report. */
export interface PDFReportConfig {
  dtuId: string;
  sections: PDFReportSection[];
}

/** A publicly shareable link with rich preview metadata. */
export interface ShareableLink {
  url: string;
  dtuId: string;
  previewImage: string;
  title: string;
  description: string;
  /** oEmbed endpoint for rich unfurling in Slack, Discord, etc. */
  oEmbed: string;
}

// ── 5. AR Preview (WebXR) ───────────────────────────────────────────

/** Tracking quality reported by the XR device. */
export type ARTrackingState = 'none' | 'limited' | 'normal';

/** Runtime state of an AR preview session. */
export interface ARSessionState {
  active: boolean;
  supported: boolean;
  permissionGranted: boolean;
  trackingState: ARTrackingState;
}

/** Describes where a DTU has been placed in the AR scene. */
export interface ARPlacement {
  dtuId: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  scale: number;
  surface: 'horizontal' | 'vertical';
  anchorId: string;
}

/** User preferences for the AR experience. */
export interface ARConfig {
  scale: 'real-world' | 'tabletop' | 'miniature';
  showAnnotations: boolean;
  showValidation: boolean;
  measureMode: boolean;
}

/** Gesture-based interactions available in AR mode. */
export type ARInteraction =
  | 'tap-to-place'
  | 'pinch-to-scale'
  | 'rotate'
  | 'inspect-member'
  | 'walk-around';

// ── 6. Mobile Companion ─────────────────────────────────────────────

/** Top-level screens available in the mobile companion app. */
export type MobileScreen =
  | 'dashboard'
  | 'notifications'
  | 'marketplace'
  | 'chat'
  | 'dtu-inspector'
  | 'royalties'
  | 'project-board';

/** Quick-glance data surfaced on the mobile dashboard. */
export interface MobileDashboard {
  royaltiesSummary: {
    lifetimeEarnings: number;
    last30Days: number;
    pendingPayout: number;
  };
  recentCitations: Array<{
    dtuId: string;
    citedBy: string;
    timestamp: string;
  }>;
  activeEvents: Array<{
    eventId: string;
    title: string;
    endsAt: string;
  }>;
  firmStatus: {
    firmId: string;
    memberCount: number;
    activeProjects: number;
  } | null;
  quickActions: string[];
}

/** Push notification preferences per device. */
export interface PushNotificationConfig {
  enabled: boolean;
  /** Notification category keys the user has opted into. */
  categories: string[];
  quietHours: {
    enabled: boolean;
    /** HH:MM in local time. */
    start: string;
    /** HH:MM in local time. */
    end: string;
  };
  deviceToken: string;
}

/** Sync state between the mobile companion and the server. */
export interface CompanionSyncState {
  /** ISO-8601 timestamp of last successful sync. */
  lastSync: string;
  pendingActions: number;
  offlineQueue: Array<{
    actionId: string;
    type: string;
    payload: unknown;
    queuedAt: string;
  }>;
}

// ── 7. Achievement System ───────────────────────────────────────────

/** Rarity tier — determines visual treatment and notification fanfare. */
export type AchievementRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

/** Top-level groupings for the achievement catalogue. */
export type AchievementCategory =
  | 'creation'
  | 'validation'
  | 'citation'
  | 'social'
  | 'exploration'
  | 'mentorship'
  | 'governance'
  | 'mastery';

/** How an achievement manifests in the world when unlocked. */
export interface AchievementWorldImpact {
  type:
    | 'plaque'
    | 'statue'
    | 'naming-rights'
    | 'featured-slot'
    | 'cosmetic'
    | 'title';
  /** World location where the reward appears, if applicable. */
  location: string | null;
  description: string;
}

/** A single achievement definition. */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  rarity: AchievementRarity;
  /** ISO-8601 unlock timestamp, null if still locked. */
  unlockedAt: string | null;
  worldImpact: AchievementWorldImpact | null;
}

/** Tracks a player's incremental progress toward an achievement. */
export interface AchievementProgress {
  achievementId: string;
  current: number;
  required: number;
  /** Pre-computed current / required, 0–1. */
  percentage: number;
}

/** Seed catalogue of well-known achievements. */
export const ACHIEVEMENT_DEFINITIONS: ReadonlyArray<
  Omit<Achievement, 'unlockedAt'>
> = [
  {
    id: 'first-validated',
    title: 'First Validated',
    description: 'Submit your first DTU that passes all validation checks.',
    category: 'validation',
    icon: 'badge-check',
    rarity: 'common',
    worldImpact: {
      type: 'plaque',
      location: null,
      description: 'A small commemorative plaque appears on your first validated DTU.',
    },
  },
  {
    id: 'hundred-citations',
    title: 'Hundred Citations',
    description: 'Have your DTUs cited 100 times across all worlds.',
    category: 'citation',
    icon: 'quote',
    rarity: 'rare',
    worldImpact: {
      type: 'statue',
      location: null,
      description: 'A statue of your avatar is erected in the Citation Hall.',
    },
  },
  {
    id: 'district-architect',
    title: 'District Architect',
    description: 'Design and validate every structure required to complete a district.',
    category: 'creation',
    icon: 'city',
    rarity: 'epic',
    worldImpact: {
      type: 'naming-rights',
      location: null,
      description: 'You may name the district you completed.',
    },
  },
  {
    id: 'foundation-builder',
    title: 'Foundation Builder',
    description: 'Create 50 foundation-type structural members used by others.',
    category: 'creation',
    icon: 'layers',
    rarity: 'uncommon',
    worldImpact: {
      type: 'cosmetic',
      location: null,
      description: 'Unlock the "Bedrock" avatar frame.',
    },
  },
  {
    id: 'bridge-master',
    title: 'Bridge Master',
    description: 'Successfully validate a bridge DTU spanning over 200 m.',
    category: 'mastery',
    icon: 'bridge',
    rarity: 'legendary',
    worldImpact: {
      type: 'featured-slot',
      location: null,
      description: 'Your bridge is featured on the World Lens landing page for one season.',
    },
  },
  {
    id: 'mentor-of-the-year',
    title: 'Mentor of the Year',
    description: 'Help 25 newcomers publish their first validated DTU.',
    category: 'mentorship',
    icon: 'academic-cap',
    rarity: 'epic',
    worldImpact: {
      type: 'title',
      location: null,
      description: 'Earn the "Master Mentor" title displayed beside your name.',
    },
  },
  {
    id: 'world-explorer',
    title: 'World Explorer',
    description: 'Visit every district in at least 10 different player-owned worlds.',
    category: 'exploration',
    icon: 'globe',
    rarity: 'rare',
    worldImpact: {
      type: 'cosmetic',
      location: null,
      description: 'Unlock the "Wanderer" avatar trail effect.',
    },
  },
  {
    id: 'governance-voice',
    title: 'Governance Voice',
    description: 'Participate in 20 governance votes across districts you belong to.',
    category: 'governance',
    icon: 'megaphone',
    rarity: 'uncommon',
    worldImpact: {
      type: 'plaque',
      location: null,
      description: 'A civic plaque appears at the district town hall.',
    },
  },
  {
    id: 'social-butterfly',
    title: 'Social Butterfly',
    description: 'Join 5 firms and participate in a cross-firm collaborative build.',
    category: 'social',
    icon: 'users',
    rarity: 'uncommon',
    worldImpact: {
      type: 'cosmetic',
      location: null,
      description: 'Unlock the "Connector" name glow effect.',
    },
  },
] as const;

// ── 8. Lens Widgets & Plugin System ─────────────────────────────────

/** Visual widget types that can be placed inside a lens view. */
export type LensWidgetType =
  | 'data-feed'
  | 'search-terminal'
  | 'visualization'
  | 'control-panel';

/** Publication status of a community-authored lens plugin. */
export type PluginLensStatus = 'draft' | 'review' | 'published';

/** Data format accepted or emitted by a plugin lens. */
export type PluginDataFormat = 'json' | 'csv' | 'stream';

/** Blueprint for a widget that can be instantiated in the world. */
export interface LensWidget {
  lensId: string;
  widgetType: LensWidgetType;
  /** Position in world-space where the widget is anchored. */
  position: { x: number; y: number; z: number };
  size: { width: number; height: number };
  /** Milliseconds between live-data refreshes. 0 = manual only. */
  refreshInterval: number;
}

/** A concrete, placed instance of a lens widget in the scene. */
export interface LensWidgetInstance {
  id: string;
  widgetDef: LensWidget;
  worldPosition: { x: number; y: number; z: number };
  buildingId: string | null;
  surfaceId: string | null;
  liveData: unknown;
}

/** Community-created lens plugin definition. */
export interface PluginLensDef {
  id: string;
  name: string;
  creator: string;
  description: string;
  /** JSON Schema describing the plugin's configuration surface. */
  schema: Record<string, unknown>;
  dataSourceUrl: string;
  citationCount: number;
  /** Percentage royalty rate 0–1 earned per citation. */
  royaltyRate: number;
  status: PluginLensStatus;
}

/** Runtime configuration for a plugin lens data pipeline. */
export interface PluginLensConfig {
  /** Milliseconds between data fetches. */
  updateInterval: number;
  dataFormat: PluginDataFormat;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

/** Row in the lens marketplace browser. */
export interface LensMarketplaceEntry {
  lensId: string;
  name: string;
  creator: string;
  category: string;
  citations: number;
  downloads: number;
  /** Average user rating 0–5. */
  rating: number;
  /** ISO-8601 timestamp. */
  publishedAt: string;
}

// ── 9. Smart Notifications ──────────────────────────────────────────

/** Delivery cadence for a notification. */
export type NotificationPriority =
  | 'immediate'
  | 'daily-digest'
  | 'weekly-summary'
  | 'archive';

/** User-level profile that drives the smart notification engine. */
export interface SmartNotificationProfile {
  userId: string;
  /** Engineering / science domains the user cares about. */
  interests: string[];
  /** Serialised pattern describing when the user is most active. */
  activityPattern: string;
  /** Per-priority minimum importance score required to surface. */
  importanceThresholds: Record<NotificationPriority, number>;
}

/** A single notification routing rule. */
export interface NotificationRule {
  domain: string;
  eventType: string;
  priority: NotificationPriority;
  enabled: boolean;
  /** Optional JSONPath or key-value filter narrowing which events match. */
  customFilter: string | null;
}

/** Implicit feedback signal used to train the notification ranker. */
export interface NotificationLearningSignal {
  notificationId: string;
  action: 'read' | 'dismiss' | 'click' | 'mute';
  /** ISO-8601 timestamp. */
  timestamp: string;
}

// ── 10. Keyboard & Power User ───────────────────────────────────────

/** Groupings shown in the shortcut reference sheet. */
export type ShortcutCategory =
  | 'navigation'
  | 'building'
  | 'camera'
  | 'social'
  | 'system'
  | 'creation';

/** A user-customisable key binding for a single action. */
export interface CustomKeybind {
  action: string;
  /** Primary key combination, e.g. "Ctrl+Shift+P". */
  primary: string;
  /** Optional secondary binding. */
  secondary: string | null;
  context: 'global' | 'building' | 'marketplace' | 'chat';
}

/** Entry in the master shortcut lookup table. */
export interface KeyboardShortcutEntry {
  /** Key combination string, e.g. "Ctrl+K". */
  keybind: string;
  category: ShortcutCategory;
  description: string;
}

/** Full keyboard shortcut map keyed by action identifier. */
export type KeyboardShortcutMap = Record<string, KeyboardShortcutEntry>;

/** Top-level configuration for power users. */
export interface PowerUserConfig {
  /** Enable vim-style modal key bindings in editors and the palette. */
  vimMode: boolean;
  shortcuts: CustomKeybind[];
  /** Key combo that opens the command palette, default "Ctrl+K". */
  commandPaletteHotkey: string;
  /** Allow Ctrl+Tab style quick-switching between recent DTUs. */
  quickSwitchEnabled: boolean;
}
