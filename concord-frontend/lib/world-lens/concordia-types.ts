/**
 * Concordia Experience Layer — Type Definitions
 *
 * Layer 2: What happens INSIDE and BETWEEN validated structures.
 * Avatars, professions, firms, player-owned worlds, fantasy mode.
 */

// ── Avatar System ───────────────────────────────────────────────────

export interface Avatar {
  id: string;
  userId: string;
  displayName: string;
  appearance: AvatarAppearance;
  professions: Profession[];
  position: { x: number; y: number; district: string };
  firmId?: string;
  reputation: Record<string, number>; // domain → reputation score
  createdAt: string;
}

export interface AvatarAppearance {
  bodyType: 'slim' | 'medium' | 'broad';
  skinTone: string; // hex color
  hairStyle: string;
  hairColor: string;
  clothingDTU?: string; // DTU id for clothing
  toolDTU?: string; // DTU id for equipped tool
  accessoryDTUs: string[];
}

// ── Professions ─────────────────────────────────────────────────────

export type ProfessionId =
  | 'architect'
  | 'civil-engineer'
  | 'materials-scientist'
  | 'mechanical-engineer'
  | 'electrical-engineer'
  | 'environmental-scientist'
  | 'urban-planner'
  | 'geologist'
  | 'economist'
  | 'policy-designer'
  | 'educator'
  | 'artist'
  | 'explorer'
  | 'trader';

export interface Profession {
  id: ProfessionId;
  name: string;
  description: string;
  reputation: number;
  citationCount: number;
  specializations: string[];
}

export const PROFESSION_DEFS: Record<ProfessionId, { name: string; description: string; icon: string }> = {
  'architect': { name: 'Architect', description: 'Designs buildings and structures', icon: 'Building2' },
  'civil-engineer': { name: 'Civil Engineer', description: 'Designs infrastructure networks', icon: 'Workflow' },
  'materials-scientist': { name: 'Materials Scientist', description: 'Creates and validates new materials', icon: 'FlaskConical' },
  'mechanical-engineer': { name: 'Mechanical Engineer', description: 'Designs vehicles and machines', icon: 'Cog' },
  'electrical-engineer': { name: 'Electrical Engineer', description: 'Designs power systems and electronics', icon: 'Zap' },
  'environmental-scientist': { name: 'Environmental Scientist', description: 'Designs ecological systems', icon: 'Leaf' },
  'urban-planner': { name: 'Urban Planner', description: 'Designs zoning and district layouts', icon: 'Map' },
  'geologist': { name: 'Geologist', description: 'Surveys terrain and subsurface', icon: 'Mountain' },
  'economist': { name: 'Economist', description: 'Designs trade systems and markets', icon: 'TrendingUp' },
  'policy-designer': { name: 'Policy Designer', description: 'Creates governance frameworks', icon: 'Landmark' },
  'educator': { name: 'Educator', description: 'Creates tutorials and educational content', icon: 'GraduationCap' },
  'artist': { name: 'Artist', description: 'Designs aesthetics, public art, landscaping', icon: 'Palette' },
  'explorer': { name: 'Explorer', description: 'Discovers new terrain, maps unmapped areas', icon: 'Compass' },
  'trader': { name: 'Trader', description: 'Buys/sells components, arbitrages between districts', icon: 'Store' },
};

// ── Firms (Guilds) ──────────────────────────────────────────────────

export interface Firm {
  id: string;
  name: string;
  description: string;
  founder: string;
  members: FirmMember[];
  headquarters?: string; // Building DTU id
  specializations: string[];
  totalCitations: number;
  activeContracts: string[];
  createdAt: string;
}

export interface FirmMember {
  userId: string;
  displayName: string;
  role: 'founder' | 'partner' | 'associate' | 'apprentice';
  joinedAt: string;
  contributions: number;
}

// ── Player-Owned Worlds ─────────────────────────────────────────────

export type WorldMode = 'realistic' | 'creative' | 'fantasy' | 'competitive';

export interface PlayerWorld {
  id: string;
  name: string;
  owner: string;
  mode: WorldMode;
  description: string;
  isPublic: boolean;
  districts: string[]; // District DTU ids
  customRules?: FantasyRules;
  playerCount: number;
  createdAt: string;
}

// ── Fantasy Mode ────────────────────────────────────────────────────

export interface FantasyRules {
  gravityMultiplier: number;
  customMaterials: FantasyMaterial[];
  creatures: CreatureDTU[];
  magicSystem?: MagicSystem;
  questChains: QuestChain[];
  customCurrency?: { name: string; symbol: string };
  lore?: string;
  dayNightCycle: boolean;
  weatherOverride?: string;
}

export interface FantasyMaterial {
  id: string;
  name: string;
  properties: Record<string, number>; // Custom property values
  visualEffect?: string;
  creator: string;
}

export interface CreatureDTU {
  id: string;
  name: string;
  type: 'friendly' | 'hostile' | 'neutral';
  patrolPath?: Array<{ x: number; y: number }>;
  combatStats?: { hp: number; attack: number; defense: number };
  lootTable?: Array<{ itemId: string; dropRate: number }>;
  behavior: 'patrol' | 'wander' | 'guard' | 'merchant';
  creator: string;
}

export interface MagicSystem {
  spells: SpellDTU[];
  manaPool: number;
  regenRate: number;
}

export interface SpellDTU {
  id: string;
  name: string;
  type: 'damage' | 'healing' | 'teleport' | 'construction' | 'buff' | 'debuff';
  manaCost: number;
  cooldown: number;
  effect: Record<string, number>;
  creator: string;
}

export interface QuestChain {
  id: string;
  title: string;
  quests: QuestStep[];
  creator: string;
  citations: number;
}

export interface QuestStep {
  id: string;
  title: string;
  description: string;
  objectives: Array<{ type: string; target: string; count: number }>;
  reward: { xp: number; items?: string[]; currency?: number };
}

// ── Social Systems ──────────────────────────────────────────────────

export interface Apprenticeship {
  id: string;
  masterId: string;
  apprenticeId: string;
  profession: ProfessionId;
  startedAt: string;
  projectsCollaborated: number;
  status: 'active' | 'completed' | 'cancelled';
}

export type ChatChannel = 'proximity' | 'firm' | 'district' | 'direct' | 'broadcast';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  districtId?: string;
  firmId?: string;
  recipientId?: string;
}

// ── Events ──────────────────────────────────────────────────────────

export type EventType =
  | 'design-competition'
  | 'disaster-drill'
  | 'grand-opening'
  | 'lecture'
  | 'market-day'
  | 'exploration'
  | 'fantasy-raid';

export interface WorldEvent {
  id: string;
  type: EventType;
  title: string;
  description: string;
  districtId: string;
  organizerId: string;
  startTime: string;
  endTime: string;
  participants: string[];
  maxParticipants?: number;
  rewards?: Record<string, number>;
  rules?: Record<string, unknown>;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
}

// ── District Leaderboards ───────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  metric: string;
  rank: number;
}

export interface DistrictLeaderboards {
  mostCitedCreator: LeaderboardEntry[];
  highestHabitability: LeaderboardEntry[];
  bestEnvironmental: LeaderboardEntry[];
  strongestBridge: LeaderboardEntry[];
  mostEfficientPower: LeaderboardEntry[];
}
