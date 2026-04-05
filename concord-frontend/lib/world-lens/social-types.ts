/**
 * World Lens — Social Connectivity & World Travel Type Definitions
 *
 * All types for player presence, communication, world travel,
 * collaboration, events, and social graph systems.
 */

import type { WorldMode } from './concordia-types';

// ── Player Presence & Instancing ──────────────────────────────────

/** The set of recognisable player activities shown on avatars and the minimap. */
export type ActivityIndicator =
  | 'building'
  | 'trading'
  | 'exploring'
  | 'socializing'
  | 'mentoring'
  | 'spectating'
  | 'idle';

/** Controls who can see a player or join an instance. */
export type VisibilityMode =
  | 'public'
  | 'friends-only'
  | 'firm-only'
  | 'invite-only'
  | 'private';

/** Real-time snapshot of a player's location and status within the world. */
export interface PlayerPresence {
  userId: string;
  avatarId: string;
  instanceId: string;
  location: {
    worldId: string;
    districtId: string;
    position: { x: number; y: number };
  };
  currentActivity: ActivityIndicator;
  visibility: VisibilityMode;
  isOnline: boolean;
  /** ISO-8601 timestamp of the last heartbeat when offline. */
  lastSeen: string;
}

/**
 * Configuration for a single world instance shard.
 * Each instance holds up to `maxPlayers` concurrent connections.
 */
export interface InstanceConfig {
  instanceId: string;
  worldId: string;
  /** Soft cap — server may allow brief overflow during events. Default 200. */
  maxPlayers: number;
  currentCount: number;
  priorityMatching: 'firm' | 'friends';
  visibility: VisibilityMode;
  region: string;
}

// ── Communication Systems ─────────────────────────────────────────

/** Message broadcast to all players within a tile radius of the sender. */
export interface ProximityChatMessage {
  id: string;
  senderId: string;
  content: string;
  position: { x: number; y: number };
  /** Tile radius of audibility. Typical default ~15. */
  radius: number;
  timestamp: string;
}

/** One-to-one message between two players. */
export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

/** Message posted to a firm-wide chat channel. */
export interface FirmChatMessage {
  id: string;
  firmId: string;
  senderId: string;
  content: string;
  timestamp: string;
}

export type BroadcastCategory = 'announcement' | 'request' | 'event';

/** District-wide broadcast visible to all players in the district. */
export interface DistrictBroadcast {
  id: string;
  districtId: string;
  senderId: string;
  content: string;
  category: BroadcastCategory;
  timestamp: string;
}

export type VoiceChatMode = 'proximity' | 'firm' | 'push-to-talk';

/** Current state of a player's voice-chat subsystem. */
export interface VoiceChatState {
  enabled: boolean;
  mode: VoiceChatMode;
  muted: boolean;
}

/** Emote animations that can be triggered by players. */
export type EmoteType =
  | 'wave'
  | 'point'
  | 'clap'
  | 'nod'
  | 'shake-head'
  | 'sit'
  | 'lean'
  | 'inspect'
  | 'celebrate';

export type ChatChannelType =
  | 'proximity'
  | 'direct'
  | 'firm'
  | 'district'
  | 'event';

/** A unified chat channel that aggregates messages of a given scope. */
export interface ChatChannel {
  id: string;
  type: ChatChannelType;
  participants: string[];
  messages: (ProximityChatMessage | DirectMessage | FirmChatMessage | DistrictBroadcast)[];
}

// ── World Travel ──────────────────────────────────────────────────

export type WorldAccessStatus = 'open' | 'friends-only' | 'firm-only' | 'invite-only' | 'locked';

/** A single row in the Terminal departure board. */
export interface TerminalDeparture {
  worldId: string;
  worldName: string;
  owner: string;
  playerCount: number;
  mode: WorldMode;
  accessStatus: WorldAccessStatus;
  description: string;
}

/** Sort options available in the Terminal's departure list. */
export type TerminalSortOption =
  | 'popular'
  | 'newest'
  | 'friends-visiting'
  | 'firm-worlds'
  | 'recent'
  | 'recommended';

export type TransitionType =
  | 'terminal'
  | 'direct-invite'
  | 'firm'
  | 'bookmark'
  | 'walkway';

export type PortalLoadingState = 'idle' | 'loading' | 'streaming' | 'ready' | 'failed';

/** Tracks an in-progress or completed portal transition between worlds. */
export interface PortalTransition {
  sourceWorldId: string;
  destWorldId: string;
  transitionType: TransitionType;
  loadingState: PortalLoadingState;
  /** Progress percentage, 0–100. */
  progress: number;
  initiatedAt: string;
}

export type WorldInviteStatus = 'pending' | 'accepted' | 'declined';

/** An invitation from one player to another to visit a world. */
export interface WorldInvite {
  id: string;
  fromUserId: string;
  toUserId: string;
  worldId: string;
  worldName: string;
  status: WorldInviteStatus;
  timestamp: string;
}

/** A saved world reference for quick travel. */
export interface WorldBookmark {
  worldId: string;
  worldName: string;
  owner: string;
  /** ISO-8601 timestamp of the player's last visit. */
  lastVisited: string;
  /** Whether this bookmark appears in the quick-access bar. */
  quickAccess: boolean;
}

/** Fired when a world's walkway portal opens for the first time. */
export interface WalkwayPortalEvent {
  worldId: string;
  /** ISO-8601 timestamp of the grand opening. */
  grandOpeningTime: string;
  /** User IDs of the first visitors (up to 10). */
  firstVisitors: string[];
  isActive: boolean;
}

// ── Collaboration Systems ─────────────────────────────────────────

/** A color-coded cursor representing one participant in a co-build session. */
export interface CoBuildCursor {
  userId: string;
  color: string; // hex
  position: { x: number; y: number; z: number };
}

/** Tracks an active real-time collaborative build session. */
export interface CoBuildSession {
  id: string;
  worldId: string;
  participants: string[];
  cursorPositions: CoBuildCursor[];
  /** DTU placement IDs currently in-flight (not yet committed). */
  activePlacements: string[];
}

/**
 * A shared crafting station where two players combine components
 * and split royalties on the resulting DTU.
 */
export interface SharedWorkbench {
  id: string;
  location: { worldId: string; districtId: string; position: { x: number; y: number } };
  /** At most two participants may use a workbench simultaneously. */
  participants: string[];
  /** The DTU id produced by the current workbench session, if any. */
  outputDTU?: string;
  /** Percentage split of royalties keyed by userId. Values should sum to 100. */
  royaltySplit: Record<string, number>;
}

export type ProjectTaskStatus = 'open' | 'claimed' | 'in-progress' | 'review' | 'complete';

/** A single task on a project board (kanban card). */
export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  claimedBy?: string;
  /** Payment amount in the world's currency upon completion. */
  payment?: number;
  createdAt: string;
  updatedAt: string;
}

/** A kanban-style project board scoped to a firm or district. */
export interface ProjectBoard {
  id: string;
  firmId?: string;
  districtId?: string;
  name: string;
  tasks: ProjectTask[];
}

export type AnnotationType = 'suggestion' | 'issue' | 'praise';

/** A single annotation pinned to a structural member during design review. */
export interface ReviewAnnotation {
  id: string;
  memberId: string;
  comment: string;
  type: AnnotationType;
  position: { x: number; y: number; z: number };
}

export type ReviewVerdict = 'approved' | 'needs-work' | 'rejected';

/** A formal peer-review of a DTU's structural and aesthetic quality. */
export interface DesignReview {
  id: string;
  dtuId: string;
  reviewerId: string;
  annotations: ReviewAnnotation[];
  comments: string[];
  verdict: ReviewVerdict;
  createdAt: string;
}

/** An active mentorship session with shared annotation tools. */
export interface MentorshipSession {
  id: string;
  mentorId: string;
  menteeId: string;
  active: boolean;
  /** Whether the mentor has real-time annotation tools enabled. */
  annotationTools: boolean;
  /** Reputation earned by the mentor for this session. */
  reputationEarned: number;
  startedAt: string;
}

// ── Events & Gatherings ───────────────────────────────────────────

export type ScheduledEventType =
  | 'grand-opening'
  | 'design-competition'
  | 'disaster-drill'
  | 'lecture'
  | 'market-day'
  | 'festival'
  | 'firm-showcase'
  | 'exploration-expedition';

/** A pre-announced event with a fixed schedule and participant list. */
export interface ScheduledEvent {
  id: string;
  type: ScheduledEventType;
  title: string;
  description: string;
  worldId: string;
  districtId: string;
  organizerId: string;
  startTime: string;
  endTime: string;
  participants: string[];
  maxParticipants?: number;
  rewards?: Record<string, number>;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

/**
 * An emergent gathering detected when >=10 players cluster
 * in the same area without a scheduled event.
 */
export interface SpontaneousGathering {
  id: string;
  position: { x: number; y: number };
  playerCount: number;
  /** Auto-created local chat channel for the cluster. */
  localChatChannelId: string;
  /** Whether this gathering is displayed on the minimap. */
  minimapIndicator: boolean;
  detectedAt: string;
}

/** A cross-world competitive or collaborative event spanning multiple worlds. */
export interface CrossWorldEvent {
  eventId: string;
  title: string;
  description: string;
  participatingWorlds: string[];
  /** ISO-8601 deadline for DTU submissions. */
  submissionDeadline: string;
  judging: {
    judgeIds: string[];
    criteria: string[];
    status: 'accepting-submissions' | 'judging' | 'complete';
    results?: Array<{ worldId: string; rank: number; score: number }>;
  };
}

// ── Social Graph ──────────────────────────────────────────────────

export type OnlineStatus = 'online' | 'away' | 'busy' | 'offline';

/** A single entry in a player's friends list. */
export interface FriendEntry {
  userId: string;
  displayName: string;
  onlineStatus: OnlineStatus;
  currentLocation?: {
    worldId: string;
    districtId: string;
  };
  activity?: ActivityIndicator;
  addedAt: string;
}

/** Public-facing player profile shown on inspection or in search results. */
export interface PlayerProfile {
  userId: string;
  avatarId: string;
  displayName: string;
  professionBadges: string[];
  reputationScores: Record<string, number>;
  totalCitations: number;
  totalRoyalties: number;
  firmMembership?: { firmId: string; role: string };
  /** Top DTU ids showcased on the profile. */
  portfolio: string[];
  worldsOwned: string[];
  badges: string[];
  joinedAt: string;
}

/** A follow relationship between two players. */
export interface FollowerRelation {
  followerId: string;
  followeeId: string;
  since: string;
  notificationsEnabled: boolean;
}

/** A log entry recording a player's visit to a world. */
export interface VisitorLogEntry {
  worldId: string;
  visitorId: string;
  enteredAt: string;
  leftAt?: string;
  /** DTU ids of buildings the visitor inspected during the visit. */
  buildingsInspected: string[];
  /** Number of components the visitor cited from this world. */
  componentsCited: number;
}
