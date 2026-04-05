/**
 * Concordia NPC System — Procedural NPC Generation & Management
 *
 * Two populations:
 * - Emergents: Protected citizens, NOT NPCs. Constitutional protections.
 * - Procedural NPCs: Generated world population. Owned by world creators.
 *
 * Inspired by: Majora's Mask (schedules), Oblivion (needs), RDR2 (memory).
 */

// ── NPC Identity ────────────────────────────────────────────────────

export type NPCTrait =
  | 'brave' | 'cautious' | 'curious' | 'cynical' | 'generous' | 'greedy'
  | 'honest' | 'humorous' | 'idealistic' | 'lazy' | 'loyal' | 'nervous'
  | 'optimistic' | 'patient' | 'pragmatic' | 'proud' | 'quiet' | 'rebellious'
  | 'scholarly' | 'skeptical' | 'sociable' | 'stoic' | 'stubborn'
  | 'suspicious' | 'warm';

export type SocialClass = 'laborer' | 'artisan' | 'merchant' | 'professional' | 'elite';

export type RelationshipType = 'friend' | 'rival' | 'family' | 'employer' | 'employee' | 'neighbor' | 'stranger';

export type NPCActivity =
  | 'sleep' | 'eat' | 'work' | 'socialize' | 'shop' | 'exercise'
  | 'worship' | 'study' | 'patrol' | 'craft' | 'trade' | 'wander' | 'rest';

export interface ProceduralNPC {
  id: string;
  name: { first: string; last: string; nickname?: string };
  demographics: {
    age: number;
    occupation: string;
    residence: string; // Building DTU id
    workplace: string; // Building DTU id
    socialClass: SocialClass;
  };
  personality: {
    traits: NPCTrait[];
    morality: number; // 0-100
    sociability: number; // 0-100
    courage: number; // 0-100
    ambition: number; // 0-100
  };
  needs: {
    hunger: number; // 0-100, decays over time
    rest: number; // 0-100, decays over time
    social: number; // 0-100, decays without interaction
    purpose: number; // 0-100, decays without work
    safety: number; // 0-100, drops when threats present
  };
  relationships: Array<{
    targetNPCId: string;
    type: RelationshipType;
    opinion: number; // -100 to 100
    lastInteraction: string;
  }>;
  memory: {
    events: EventMemory[];
    maxEvents: number; // 50 rolling window
    playerOpinions: Record<string, number>; // playerId → opinion (-100 to 100)
  };
  schedule: DailySchedule;
  systemPrompt: string;
  alive: boolean;
  spawnedAt: string;
}

export interface EventMemory {
  timestamp: string;
  type: string;
  description: string;
  emotionalImpact: number; // -10 to 10
  involvedEntities: string[];
}

export interface ScheduleBlock {
  startTime: number; // 0-24
  endTime: number; // 0-24
  activity: NPCActivity;
  location: string; // building DTU id or "roam:[district]"
  interruptible: boolean;
  priority: number; // 1-10
}

export interface DailySchedule {
  weekday: ScheduleBlock[];
  weekend: ScheduleBlock[];
  overrides: Array<{
    condition: string;
    replacementSchedule: ScheduleBlock[];
  }>;
}

export interface EventBroadcast {
  type: string;
  location: { x: number; y: number; z?: number };
  radius: number;
  description: string;
  severity: number; // 1-10
  participants: string[];
}

export interface NPCSlot {
  role: string;
  position: { x: number; y: number };
  animation: 'standing' | 'sitting' | 'working' | 'reading' | 'cooking';
  maxOccupancy: number;
}

// ── Population Caps ─────────────────────────────────────────────────

export const POPULATION_CAPS = {
  small: { districts: 1, maxNPCs: 50 },
  medium: { districts: 4, maxNPCs: 150 },
  large: { districts: 10, maxNPCs: 400 },
  mega: { districts: Infinity, maxNPCs: 800 },
} as const;

export function getPopulationCap(districtCount: number): number {
  if (districtCount <= 1) return POPULATION_CAPS.small.maxNPCs;
  if (districtCount <= 4) return POPULATION_CAPS.medium.maxNPCs;
  if (districtCount <= 10) return POPULATION_CAPS.large.maxNPCs;
  return POPULATION_CAPS.mega.maxNPCs;
}

// ── Name Pool ───────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aria', 'Kael', 'Thane', 'Lyra', 'Vex', 'Sera', 'Brin', 'Mara', 'Dax',
  'Elira', 'Rowan', 'Petra', 'Finn', 'Nessa', 'Cade', 'Isla', 'Torin',
  'Zara', 'Oren', 'Rhea', 'Sable', 'Quinn', 'Dara', 'Lev', 'Nyx',
  'Corvus', 'Ember', 'Sage', 'Knox', 'Wren', 'Sol', 'Cleo', 'Nash',
  'Ivy', 'Rune', 'Ash', 'Jade', 'Cole', 'Fern', 'Reed',
];

const LAST_NAMES = [
  'Ashford', 'Blackwell', 'Copperfield', 'Dawnbrook', 'Elderwood',
  'Fairhaven', 'Greystone', 'Hawthorne', 'Ironforge', 'Jasperwall',
  'Kingsley', 'Longmere', 'Mooreland', 'Northwind', 'Oakbend',
  'Pinecrest', 'Queensbury', 'Ravenshill', 'Silverton', 'Thornwick',
  'Underhill', 'Vanderway', 'Whitestone', 'Yarrow', 'Zephyrdale',
];

const OCCUPATIONS: Record<string, string[]> = {
  residential: ['homemaker', 'retiree', 'student', 'freelancer'],
  commercial: ['shopkeeper', 'merchant', 'clerk', 'bartender', 'cook'],
  industrial: ['factory worker', 'foreman', 'welder', 'machinist'],
  education: ['teacher', 'professor', 'librarian', 'researcher'],
  healthcare: ['doctor', 'nurse', 'pharmacist', 'healer'],
  agriculture: ['farmer', 'rancher', 'botanist', 'miller'],
  infrastructure: ['engineer', 'construction worker', 'electrician', 'plumber'],
  military: ['guard', 'soldier', 'scout', 'captain'],
};

// ── NPC Generator ───────────────────────────────────────────────────

let npcCounter = 0;

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTraits(count: number): NPCTrait[] {
  const all: NPCTrait[] = [
    'brave', 'cautious', 'curious', 'cynical', 'generous', 'greedy',
    'honest', 'humorous', 'idealistic', 'lazy', 'loyal', 'nervous',
    'optimistic', 'patient', 'pragmatic', 'proud', 'quiet', 'rebellious',
    'scholarly', 'skeptical', 'sociable', 'stoic', 'stubborn',
    'suspicious', 'warm',
  ];
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function generateNPC(
  worldId: string,
  residenceId: string,
  workplaceId: string,
  buildingType: string
): ProceduralNPC {
  const id = `npc-${worldId}-${++npcCounter}`;
  const firstName = randomFrom(FIRST_NAMES);
  const lastName = randomFrom(LAST_NAMES);
  const age = 18 + Math.floor(Math.random() * 55);
  const occPool = OCCUPATIONS[buildingType] || OCCUPATIONS.commercial;
  const occupation = randomFrom(occPool);
  const traits = randomTraits(3 + Math.floor(Math.random() * 3));
  const socialClass: SocialClass = randomFrom(['laborer', 'artisan', 'merchant', 'professional', 'elite']);

  const morality = 30 + Math.floor(Math.random() * 60);
  const sociability = 20 + Math.floor(Math.random() * 70);
  const courage = 20 + Math.floor(Math.random() * 70);
  const ambition = 20 + Math.floor(Math.random() * 70);

  const schedule = generateSchedule(occupation, traits, sociability);
  const npc: ProceduralNPC = {
    id,
    name: { first: firstName, last: lastName },
    demographics: { age, occupation, residence: residenceId, workplace: workplaceId, socialClass },
    personality: { traits, morality, sociability, courage, ambition },
    needs: { hunger: 80, rest: 90, social: 70, purpose: 75, safety: 100 },
    relationships: [],
    memory: { events: [], maxEvents: 50, playerOpinions: {} },
    schedule,
    systemPrompt: '',
    alive: true,
    spawnedAt: new Date().toISOString(),
  };

  npc.systemPrompt = generateSystemPrompt(npc, worldId);
  return npc;
}

// ── Schedule Generator ──────────────────────────────────────────────

function generateSchedule(occupation: string, traits: NPCTrait[], sociability: number): DailySchedule {
  const isSociable = sociability > 60 || traits.includes('sociable');
  const isLazy = traits.includes('lazy');
  const isStudious = traits.includes('scholarly') || traits.includes('curious');

  const wakeTime = isLazy ? 7 : 5;
  const sleepTime = isSociable ? 23 : 21;
  const workStart = wakeTime + 1;
  const workEnd = isLazy ? 15 : 17;

  const weekday: ScheduleBlock[] = [
    { startTime: wakeTime, endTime: wakeTime + 1, activity: 'eat', location: 'residence', interruptible: true, priority: 3 },
    { startTime: workStart, endTime: 12, activity: 'work', location: 'workplace', interruptible: false, priority: 8 },
    { startTime: 12, endTime: 13, activity: 'eat', location: isSociable ? 'roam:commercial' : 'workplace', interruptible: true, priority: 4 },
    { startTime: 13, endTime: workEnd, activity: 'work', location: 'workplace', interruptible: false, priority: 8 },
    { startTime: workEnd, endTime: workEnd + 1, activity: isSociable ? 'shop' : 'rest', location: 'roam:commercial', interruptible: true, priority: 2 },
    { startTime: workEnd + 1, endTime: workEnd + 2, activity: 'eat', location: 'residence', interruptible: true, priority: 5 },
    { startTime: workEnd + 2, endTime: sleepTime, activity: isSociable ? 'socialize' : isStudious ? 'study' : 'rest', location: isSociable ? 'roam:commercial' : 'residence', interruptible: true, priority: 2 },
    { startTime: sleepTime, endTime: wakeTime + 24, activity: 'sleep', location: 'residence', interruptible: false, priority: 10 },
  ];

  const weekend: ScheduleBlock[] = [
    { startTime: wakeTime + 1, endTime: wakeTime + 2, activity: 'eat', location: 'residence', interruptible: true, priority: 3 },
    { startTime: wakeTime + 2, endTime: 12, activity: isSociable ? 'socialize' : 'wander', location: 'roam:commons', interruptible: true, priority: 2 },
    { startTime: 12, endTime: 13, activity: 'eat', location: 'roam:commercial', interruptible: true, priority: 4 },
    { startTime: 13, endTime: 17, activity: isStudious ? 'study' : 'shop', location: isStudious ? 'roam:education' : 'roam:commercial', interruptible: true, priority: 2 },
    { startTime: 17, endTime: 19, activity: 'eat', location: 'residence', interruptible: true, priority: 5 },
    { startTime: 19, endTime: sleepTime, activity: 'socialize', location: 'roam:commons', interruptible: true, priority: 2 },
    { startTime: sleepTime, endTime: wakeTime + 25, activity: 'sleep', location: 'residence', interruptible: false, priority: 10 },
  ];

  const overrides = [
    {
      condition: 'disaster_active',
      replacementSchedule: [
        { startTime: 0, endTime: 24, activity: 'rest' as NPCActivity, location: 'residence', interruptible: false, priority: 10 },
      ],
    },
    {
      condition: 'festival',
      replacementSchedule: [
        { startTime: 8, endTime: 22, activity: 'socialize' as NPCActivity, location: 'roam:commons', interruptible: true, priority: 3 },
        { startTime: 22, endTime: 8, activity: 'sleep' as NPCActivity, location: 'residence', interruptible: false, priority: 10 },
      ],
    },
  ];

  return { weekday, weekend, overrides };
}

// ── System Prompt Generator ─────────────────────────────────────────

export function generateSystemPrompt(npc: ProceduralNPC, worldName: string): string {
  const traitText = npc.personality.traits.join(', ');
  const recentEvents = npc.memory.events
    .slice(-10)
    .map(e => e.description)
    .join('. ');

  const relationships = npc.relationships
    .map(r => {
      const opDesc = r.opinion > 50 ? 'respect' : r.opinion > 0 ? 'get along with' : r.opinion > -50 ? 'distrust' : 'dislike';
      return `You ${opDesc} your ${r.type}.`;
    })
    .join(' ');

  const mood = computeMood(npc);

  const speechStyle = getSpeechStyle(npc.demographics.socialClass, npc.personality.traits);

  return `You are ${npc.name.first} ${npc.name.last}, a ${npc.demographics.age}-year-old ${npc.demographics.occupation} in ${worldName}.

Your personality: You are ${traitText}.

Your daily life: You work as a ${npc.demographics.occupation} and live in the ${npc.demographics.socialClass} district.

${relationships ? `Your relationships: ${relationships}` : ''}

${recentEvents ? `Recent events you remember: ${recentEvents}` : 'Things have been quiet lately.'}

Your current mood: ${mood}

How you speak: ${speechStyle}

Rules: Stay in character. Reference your memories when relevant. Your opinions of the person talking to you affect your tone. If asked about events you didn't witness, say you heard rumors or don't know. Never break character.`;
}

function computeMood(npc: ProceduralNPC): string {
  const { needs, personality, memory } = npc;
  const avgNeeds = (needs.hunger + needs.rest + needs.social + needs.purpose + needs.safety) / 5;
  const recentImpact = memory.events.slice(-5).reduce((sum, e) => sum + e.emotionalImpact, 0);

  if (avgNeeds > 80 && recentImpact >= 0) {
    return personality.traits.includes('optimistic') ? 'cheerful and content' : 'calm and satisfied';
  }
  if (avgNeeds > 50) {
    return personality.traits.includes('stoic') ? 'composed but watchful' : 'slightly on edge';
  }
  if (needs.safety < 30) {
    return personality.traits.includes('brave') ? 'tense but determined' : 'frightened';
  }
  return personality.traits.includes('cynical') ? 'irritable' : 'weary';
}

function getSpeechStyle(socialClass: SocialClass, traits: NPCTrait[]): string {
  const base = {
    laborer: 'You speak plainly and directly.',
    artisan: 'You speak with pride about your craft.',
    merchant: 'You speak persuasively and know your numbers.',
    professional: 'You speak formally with technical precision.',
    elite: 'You speak with authority and measured elegance.',
  }[socialClass];

  const modifiers: string[] = [];
  if (traits.includes('humorous')) modifiers.push('You crack jokes when the mood allows.');
  if (traits.includes('cynical')) modifiers.push('Your observations have a sarcastic edge.');
  if (traits.includes('warm')) modifiers.push('You show genuine care for those you speak to.');
  if (traits.includes('quiet')) modifiers.push('You are a person of few words.');
  if (traits.includes('scholarly')) modifiers.push('You reference books and history often.');

  return [base, ...modifiers].join(' ');
}

// ── Event Processing ────────────────────────────────────────────────

export function processEventBroadcast(
  event: EventBroadcast,
  npcs: ProceduralNPC[],
  npcPositions: Map<string, { x: number; y: number }>
): void {
  for (const npc of npcs) {
    if (!npc.alive) continue;
    const pos = npcPositions.get(npc.id);
    if (!pos) continue;

    const dist = Math.sqrt(
      (pos.x - event.location.x) ** 2 + (pos.y - event.location.y) ** 2
    );

    if (dist <= event.radius) {
      // Emotional impact based on personality
      let impact = event.severity;
      if (npc.personality.traits.includes('brave')) impact *= 0.7;
      if (npc.personality.traits.includes('nervous')) impact *= 1.5;
      if (npc.personality.traits.includes('stoic')) impact *= 0.5;

      const memory: EventMemory = {
        timestamp: new Date().toISOString(),
        type: event.type,
        description: event.description,
        emotionalImpact: Math.round(impact * (event.severity >= 5 ? -1 : 1)),
        involvedEntities: event.participants,
      };

      npc.memory.events.push(memory);

      // Enforce rolling window
      if (npc.memory.events.length > npc.memory.maxEvents) {
        // Drop oldest with lowest emotional impact
        npc.memory.events.sort((a, b) => Math.abs(b.emotionalImpact) - Math.abs(a.emotionalImpact));
        npc.memory.events = npc.memory.events.slice(0, npc.memory.maxEvents);
        npc.memory.events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      }

      // Update needs
      if (event.severity >= 5) {
        npc.needs.safety = Math.max(0, npc.needs.safety - event.severity * 5);
      }

      // Trigger schedule override for severe events
      if (event.severity >= 7) {
        // NPC will use disaster override on next schedule tick
      }
    }
  }
}

// ── Population Generator ────────────────────────────────────────────

export function generatePopulation(
  worldId: string,
  buildings: Array<{ id: string; type: string; capacity: number }>,
  districtCount: number
): ProceduralNPC[] {
  const cap = getPopulationCap(districtCount);
  const npcs: ProceduralNPC[] = [];

  // Separate residential and non-residential
  const residences = buildings.filter(b => b.type === 'residential');
  const workplaces = buildings.filter(b => b.type !== 'residential');

  // Generate NPCs proportional to building capacity
  let totalGenerated = 0;
  for (const residence of residences) {
    const occupants = Math.min(residence.capacity, cap - totalGenerated);
    for (let i = 0; i < occupants && totalGenerated < cap; i++) {
      const workplace = workplaces.length > 0
        ? workplaces[totalGenerated % workplaces.length]
        : residence;
      const npc = generateNPC(worldId, residence.id, workplace.id, workplace.type);
      npcs.push(npc);
      totalGenerated++;
    }
  }

  // Generate relationships
  for (let i = 0; i < npcs.length; i++) {
    // Neighbors (share residence)
    for (let j = i + 1; j < npcs.length; j++) {
      if (npcs[i].demographics.residence === npcs[j].demographics.residence) {
        const opinion = 20 + Math.floor(Math.random() * 40);
        npcs[i].relationships.push({ targetNPCId: npcs[j].id, type: 'neighbor', opinion, lastInteraction: new Date().toISOString() });
        npcs[j].relationships.push({ targetNPCId: npcs[i].id, type: 'neighbor', opinion: opinion - 10 + Math.floor(Math.random() * 20), lastInteraction: new Date().toISOString() });
      }
    }
    // Coworkers (share workplace)
    for (let j = i + 1; j < npcs.length; j++) {
      if (npcs[i].demographics.workplace === npcs[j].demographics.workplace) {
        const opinion = Math.floor(Math.random() * 80) - 20;
        const type: RelationshipType = opinion > 30 ? 'friend' : opinion < -30 ? 'rival' : 'stranger';
        npcs[i].relationships.push({ targetNPCId: npcs[j].id, type, opinion, lastInteraction: new Date().toISOString() });
      }
    }
  }

  return npcs;
}
