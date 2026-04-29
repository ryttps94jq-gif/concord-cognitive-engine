// District domain system — each district has a thematic domain that controls
// combat permissions, NPC flavor, quest vocabulary, and architecture style.
// Bridges connect domains; Mainland is always a safe zone.

export const DOMAIN_TYPES = [
  'mainland',
  'fantasy',
  'sci-fi',
  'western',
  'noir',
  'post-apocalyptic',
  'underwater',
  'horror',
  'mythic',
  'cyberpunk',
] as const;

export type DomainType = typeof DOMAIN_TYPES[number];

export interface DomainConfig {
  type: DomainType;
  label: string;
  combatAllowed: boolean;
  /** Terms used for hostile NPCs in this domain */
  hostileVocab: {
    singular: string;
    plural: string;
    factionName: string;
  };
  /** Flavor adjectives used in quest narrative generation */
  atmosphereTags: string[];
  /** CSS color accent for UI chrome in this domain */
  accentColor: string;
}

export const DOMAIN_CONFIGS: Record<DomainType, DomainConfig> = {
  mainland: {
    type: 'mainland',
    label: 'Mainland Concordia',
    combatAllowed: false,
    hostileVocab: { singular: 'rival', plural: 'rivals', factionName: 'Opposition' },
    atmosphereTags: ['civic', 'collaborative', 'open', 'evolving'],
    accentColor: '#22d3ee',  // cyan
  },
  fantasy: {
    type: 'fantasy',
    label: 'Realm of Aethon',
    combatAllowed: true,
    hostileVocab: { singular: 'marauder', plural: 'marauders', factionName: 'Blighted Host' },
    atmosphereTags: ['ancient', 'mystical', 'perilous', 'enchanted'],
    accentColor: '#a78bfa',  // violet
  },
  'sci-fi': {
    type: 'sci-fi',
    label: 'Proxima Station',
    combatAllowed: true,
    hostileVocab: { singular: 'rogue unit', plural: 'rogue units', factionName: 'Null Protocol' },
    atmosphereTags: ['sterile', 'vast', 'synthetic', 'fractal'],
    accentColor: '#34d399',  // emerald
  },
  western: {
    type: 'western',
    label: 'Dustfall Territory',
    combatAllowed: true,
    hostileVocab: { singular: 'outlaw', plural: 'outlaws', factionName: 'Redrock Gang' },
    atmosphereTags: ['arid', 'lawless', 'gritty', 'frontier'],
    accentColor: '#fb923c',  // orange
  },
  noir: {
    type: 'noir',
    label: 'Voss City',
    combatAllowed: true,
    hostileVocab: { singular: 'enforcer', plural: 'enforcers', factionName: 'Syndicate' },
    atmosphereTags: ['shadowed', 'corrupt', 'rain-slicked', 'conspiratorial'],
    accentColor: '#94a3b8',  // slate
  },
  'post-apocalyptic': {
    type: 'post-apocalyptic',
    label: 'The Ashen Reach',
    combatAllowed: true,
    hostileVocab: { singular: 'raider', plural: 'raiders', factionName: 'Scorch Clan' },
    atmosphereTags: ['ruined', 'scarce', 'survivalist', 'radioactive'],
    accentColor: '#facc15',  // yellow
  },
  underwater: {
    type: 'underwater',
    label: 'Thalassic Deep',
    combatAllowed: true,
    hostileVocab: { singular: 'predator', plural: 'predators', factionName: 'Abyssal Court' },
    atmosphereTags: ['bioluminescent', 'pressured', 'silent', 'alien'],
    accentColor: '#38bdf8',  // sky
  },
  horror: {
    type: 'horror',
    label: 'The Hollow',
    combatAllowed: true,
    hostileVocab: { singular: 'wraith', plural: 'wraiths', factionName: 'The Consumed' },
    atmosphereTags: ['decayed', 'haunted', 'wrong', 'liminal'],
    accentColor: '#f87171',  // red
  },
  mythic: {
    type: 'mythic',
    label: 'Pantheon Heights',
    combatAllowed: true,
    hostileVocab: { singular: 'champion', plural: 'champions', factionName: 'Rival Pantheon' },
    atmosphereTags: ['divine', 'colossal', 'eternal', 'contested'],
    accentColor: '#fbbf24',  // amber
  },
  cyberpunk: {
    type: 'cyberpunk',
    label: 'Neon Sprawl',
    combatAllowed: true,
    hostileVocab: { singular: 'corp-sec', plural: 'corp-sec', factionName: 'MegaCorp Enforcement' },
    atmosphereTags: ['neon', 'overcrowded', 'surveilled', 'augmented'],
    accentColor: '#e879f9',  // fuchsia
  },
};

// ── Bridge ────────────────────────────────────────────────────────────

export interface DistrictBridge {
  id: string;
  fromDistrictId: string;
  toDistrictId: string;
  toDomain: DomainType;
  /** World position of the portal/gate on the from-side */
  position: { x: number; y: number; z: number };
  /** Descriptive label shown on approach */
  label: string;
  /** Unlock requirement — null means always open */
  requiredKarma?: number;
  requiredFaction?: { factionId: string; minStanding: string };
  requiredLevel?: number;
}

// ── District config ───────────────────────────────────────────────────

export interface ConcordiaDistrict {
  id: string;
  name: string;
  domain: DomainType;
  health: number;    // 0-100: low → more hostiles, fewer resources
  bridges: DistrictBridge[];
  /** Active faction controlling this district */
  controllingFactionId: string | null;
}

export function domainConfig(domain: DomainType): DomainConfig {
  return DOMAIN_CONFIGS[domain];
}

/** Mainland and any district with combatAllowed=false */
export function isSafeZone(domain: DomainType): boolean {
  return !DOMAIN_CONFIGS[domain].combatAllowed;
}

/** Health-based hostile spawn rate: 0 at health=100, 1 at health=0 */
export function hostileSpawnRate(health: number): number {
  return Math.max(0, 1 - health / 100);
}

/** Mutate district health, clamped to 0-100 */
export function applyHealthDelta(district: ConcordiaDistrict, delta: number): ConcordiaDistrict {
  return { ...district, health: Math.max(0, Math.min(100, district.health + delta)) };
}
