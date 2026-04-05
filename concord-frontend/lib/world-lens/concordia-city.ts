/**
 * World Lens — Concordia City Definition
 *
 * Concordia is the canonical shared city of the Concord platform,
 * geographically inspired by Poughkeepsie, New York. The city sits
 * on the east bank of a major river (the Hudson analogue), with a
 * steep bluff rising from the waterfront to a commercial plateau,
 * then rolling hills to the east. A creek (Fallkill analogue) cuts
 * east-to-west through the northern half of the map.
 *
 * Key Poughkeepsie parallels:
 * - River on the west edge with rail/waterfront at the base of a bluff
 * - Main Street running east-west across the plateau (~40m elevation)
 * - Academic institutions on the eastern hills (Vassar analogue)
 * - Walkway Over the Hudson → The Walkway (pedestrian bridge)
 * - Mid-Hudson Bridge → The Crossing (vehicle/rail bridge)
 * - Bardavon Opera House → The Bardavon (event venue)
 * - Poughkeepsie Train Station → The Terminal
 * - Pulaski Park → The Commons
 *
 * Elevation model (meters above river level):
 *   0     — River surface (west edge)
 *   0-15  — Waterfront / Docks
 *   20    — Waterfront bluff crest
 *   40    — Main Street plateau
 *   60    — Academy hills
 *   80    — Observatory peak (eastern high ground)
 */

import type { ZoneType, SoilType } from './types';

// ── Interfaces ─────────────────────────────────────────────────────

/** Definition of a Concordia district with its real-world Poughkeepsie parallel. */
export interface ConcordiaDistrictDef {
  id: string;
  name: string;
  description: string;
  /** Bounding box in world-space meters. */
  position: { x1: number; y1: number; x2: number; y2: number };
  zoneType: ZoneType;
  /** Elevation range in meters above river level. */
  elevationRange: { min: number; max: number };
  soilType: SoilType;
  architecturalCharacter: string;
  ambienceSummary: string;
  populationCapacity: number;
  keyNPCs: string[];
  infrastructureTypes: string[];
  /** The real-world Poughkeepsie area this district maps to. */
  poughkeepsieEquivalent: string;
}

/** Definition of a notable Concordia landmark. */
export interface ConcordiaLandmarkDef {
  id: string;
  name: string;
  description: string;
  /** Position in world-space meters. */
  position: { x: number; y: number };
  type: string;
  creator: string;
  citations: number;
  inspectable: boolean;
}

// ── Geography ──────────────────────────────────────────────────────

/**
 * Master geography constants for the Concordia map.
 *
 * The coordinate system places (0,0) at the northwest corner.
 * X increases eastward, Y increases southward.
 * The river runs along the west edge (low X values).
 *
 * Inspired by the Poughkeepsie waterfront-to-hills cross-section:
 * river → rail yard → steep bluff → Main Street plateau → rolling hills.
 */
export const CONCORDIA_GEOGRAPHY = {
  /** Total map width in meters (east-west). */
  width: 2000,
  /** Total map depth in meters (north-south). */
  depth: 1500,
  /** Heightmap grid resolution. */
  resolution: { columns: 100, rows: 80 },
  /** Reference elevation tiers in meters above river level. */
  riverLevel: 0,
  waterfrontBluff: 20,
  mainStreetPlateau: 40,
  academyHills: 60,
  observatoryPeak: 80,
  /** Hudson River analogue — flows south along the west edge. */
  river: {
    name: 'The Great River',
    edge: 'west' as const,
    widthMeters: 200,
    flowDirection: 'south' as const,
    tidalRange: 1.2,
    currentSpeed: 0.8,
  },
  /** Fallkill Creek analogue — cuts east-to-west through the map. */
  creek: {
    name: 'Millrace Creek',
    path: 'east-to-west' as const,
    approximateY: 500,
    widthMeters: 8,
    depthMeters: 2,
    feedsIntoRiver: true,
  },
} as const;

// ── Districts ──────────────────────────────────────────────────────

/**
 * The 10 canonical districts of Concordia.
 *
 * Positions are given as bounding boxes in world-space meters
 * where (0,0) is the northwest corner of the map.
 */
export const CONCORDIA_DISTRICTS: ConcordiaDistrictDef[] = [
  {
    id: 'district-docks',
    name: 'The Docks',
    description:
      'A gritty waterfront strip at the base of the bluff. Warehouses, piers, and the train terminal line the riverbank. The air smells of creosote and river water.',
    position: { x1: 0, y1: 800, x2: 300, y2: 1500 },
    zoneType: 'industrial',
    elevationRange: { min: 0, max: 15 },
    soilType: 'gravel',
    architecturalCharacter: 'Cobblestone streets, red-brick warehouses, cast-iron loading cranes, timber piers',
    ambienceSummary: 'Clanking chains, lapping water, steam whistles, gulls overhead',
    populationCapacity: 800,
    keyNPCs: ['Harbormaster Voss', 'Dockhand Rina', 'Customs Inspector Farrow'],
    infrastructureTypes: ['road', 'water', 'drainage', 'rail'],
    poughkeepsieEquivalent: 'Poughkeepsie waterfront and Metro-North train station area',
  },
  {
    id: 'district-exchange',
    name: 'The Exchange',
    description:
      'The commercial heart of Concordia. Brick-facade shops, cafes, and trading halls line a broad east-west boulevard atop the bluff.',
    position: { x1: 300, y1: 500, x2: 900, y2: 900 },
    zoneType: 'commercial',
    elevationRange: { min: 20, max: 40 },
    soilType: 'loam',
    architecturalCharacter: 'Three-story brick facades, arched windows, cast-iron storefronts, gas-lamp streetlights',
    ambienceSummary: 'Bustling crowds, shop bells, street musicians, the aroma of bakeries',
    populationCapacity: 3000,
    keyNPCs: ['Merchant Guild Leader Opal', 'Auctioneer Thatch', 'Street Performer Lyric'],
    infrastructureTypes: ['road', 'power', 'water', 'data'],
    poughkeepsieEquivalent: 'Main Street and the Innovation District',
  },
  {
    id: 'district-forge',
    name: 'The Forge',
    description:
      'Heavy industry and manufacturing. Smokestacks, foundries, and fabrication shops occupy the low ground south of the bluff.',
    position: { x1: 300, y1: 1100, x2: 900, y2: 1500 },
    zoneType: 'industrial',
    elevationRange: { min: 10, max: 25 },
    soilType: 'clay',
    architecturalCharacter: 'Steel-frame buildings, concrete floors, corrugated metal walls, overhead gantry cranes',
    ambienceSummary: 'Rhythmic hammering, furnace roar, welding sparks, metallic tang in the air',
    populationCapacity: 1200,
    keyNPCs: ['Foundry Master Kelda', 'Safety Inspector Briggs', 'Apprentice Spark'],
    infrastructureTypes: ['road', 'power', 'water', 'drainage'],
    poughkeepsieEquivalent: 'South Poughkeepsie industrial areas along the rail corridor',
  },
  {
    id: 'district-academy',
    name: 'The Academy',
    description:
      'Leafy campus on the eastern hills. Gothic lecture halls, Victorian laboratories, and winding stone paths through old-growth trees.',
    position: { x1: 1300, y1: 0, x2: 2000, y2: 600 },
    zoneType: 'education',
    elevationRange: { min: 40, max: 60 },
    soilType: 'loam',
    architecturalCharacter: 'Gothic stone buildings, Victorian turrets, slate roofs, arched cloisters, stone paths',
    ambienceSummary: 'Birdsong, distant lectures, rustling leaves, tolling bell tower',
    populationCapacity: 2500,
    keyNPCs: ['Dean Hargrove', 'Professor Lumen', 'Librarian Quill', 'Groundskeeper Moss'],
    infrastructureTypes: ['road', 'power', 'water', 'data'],
    poughkeepsieEquivalent: 'Vassar College campus and Academy Street neighborhood',
  },
  {
    id: 'district-commons',
    name: 'The Commons',
    description:
      'A central public green with fountains, benches, and open-air stages. The social crossroads where all districts meet.',
    position: { x1: 700, y1: 500, x2: 1100, y2: 900 },
    zoneType: 'mixed',
    elevationRange: { min: 30, max: 40 },
    soilType: 'loam',
    architecturalCharacter: 'Formal gardens, gravel paths, wrought-iron fences, bandstand pavilion, war memorial',
    ambienceSummary: 'Children playing, fountain splashing, public debates, food carts',
    populationCapacity: 1500,
    keyNPCs: ['Park Warden Elm', 'Orator Vesper', 'Gardener Bloom'],
    infrastructureTypes: ['road', 'water', 'drainage'],
    poughkeepsieEquivalent: 'Pulaski Park and surrounding civic green spaces',
  },
  {
    id: 'district-nexus',
    name: 'The Nexus',
    description:
      'Seat of civic governance. City hall, council chambers, courthouses, and administrative offices in imposing institutional stone.',
    position: { x1: 900, y1: 300, x2: 1300, y2: 700 },
    zoneType: 'mixed',
    elevationRange: { min: 35, max: 45 },
    soilType: 'rock',
    architecturalCharacter: 'Neoclassical stone facades, columned porticos, domed rotundas, formal plazas',
    ambienceSummary: 'Measured footsteps on marble, gavel echoes, murmured deliberations',
    populationCapacity: 1000,
    keyNPCs: ['Mayor Calder', 'Chief Engineer Strand', 'Clerk Finch'],
    infrastructureTypes: ['road', 'power', 'water', 'data'],
    poughkeepsieEquivalent: 'Civic Center, City Hall, and Family Court area',
  },
  {
    id: 'district-grid',
    name: 'The Grid',
    description:
      'Infrastructure showcase along the northern riverbank. Water treatment, power generation, and engineering marvels with exposed mechanical systems.',
    position: { x1: 0, y1: 0, x2: 400, y2: 500 },
    zoneType: 'industrial',
    elevationRange: { min: 5, max: 20 },
    soilType: 'gravel',
    architecturalCharacter: 'Exposed steel trusses, glass-walled control rooms, pipe arrays, cooling towers',
    ambienceSummary: 'Humming generators, rushing water through pipes, blinking indicator lights',
    populationCapacity: 400,
    keyNPCs: ['Chief Operator Watts', 'Turbine Tech Cora', 'Water Chemist Sable'],
    infrastructureTypes: ['power', 'water', 'drainage', 'road'],
    poughkeepsieEquivalent: 'Water treatment and utility infrastructure along the northern waterfront',
  },
  {
    id: 'district-observatory',
    name: 'The Observatory',
    description:
      'A contemplative hilltop on the eastern edge. Telescope domes, weather stations, and quiet stone terraces overlooking the entire city and river.',
    position: { x1: 1600, y1: 400, x2: 2000, y2: 900 },
    zoneType: 'research',
    elevationRange: { min: 60, max: 80 },
    soilType: 'rock',
    architecturalCharacter: 'Cylindrical stone towers, copper domes, observation decks, dry-stone walls',
    ambienceSummary: 'Wind across hilltops, clicking instruments, hushed reverence, panoramic vistas',
    populationCapacity: 300,
    keyNPCs: ['Astronomer Vale', 'Meteorologist Cirrus', 'Cartographer Meridian'],
    infrastructureTypes: ['power', 'data', 'road'],
    poughkeepsieEquivalent: 'Eastern high ground and hilltop areas east of the city center',
  },
  {
    id: 'district-arena',
    name: 'The Arena',
    description:
      'Competition grounds and event space. A grand amphitheater ringed by training yards, scoreboards, and vendor stalls.',
    position: { x1: 700, y1: 900, x2: 1200, y2: 1300 },
    zoneType: 'mixed',
    elevationRange: { min: 20, max: 30 },
    soilType: 'sand',
    architecturalCharacter: 'Tiered stone seating, steel-arched canopy, sand-floor arena floor, competitor tunnels',
    ambienceSummary: 'Roaring crowds, clash of competition, victory horns, vendor hawking',
    populationCapacity: 5000,
    keyNPCs: ['Arena Master Gale', 'Scorekeeper Tally', 'Champion Rook'],
    infrastructureTypes: ['road', 'power', 'water', 'drainage'],
    poughkeepsieEquivalent: 'Mid-Hudson Civic Center and surrounding event area',
  },
  {
    id: 'district-frontier',
    name: 'The Frontier',
    description:
      'The raw southeastern edge of the city. Partially cleared land, pioneer settlements, and wild terrain awaiting development.',
    position: { x1: 1200, y1: 900, x2: 2000, y2: 1500 },
    zoneType: 'agricultural',
    elevationRange: { min: 30, max: 50 },
    soilType: 'loam',
    architecturalCharacter: 'Rough timber cabins, canvas tents, split-rail fences, cleared meadows, wild grass',
    ambienceSummary: 'Crickets, rustling tall grass, distant hammering, campfire smoke',
    populationCapacity: 600,
    keyNPCs: ['Pioneer Wren', 'Surveyor Compass', 'Herbalist Sage'],
    infrastructureTypes: ['road'],
    poughkeepsieEquivalent: 'Developing south and east edges of the city, toward Arlington',
  },
];

// ── Landmarks ──────────────────────────────────────────────────────

/**
 * Notable landmarks in Concordia.
 *
 * These are high-citation, inspectable structures that serve as
 * orientation points and cultural anchors for the city.
 */
export const CONCORDIA_LANDMARKS: ConcordiaLandmarkDef[] = [
  {
    id: 'landmark-walkway',
    name: 'The Walkway',
    description:
      'A graceful pedestrian bridge spanning the Great River at the northern end of the city. ' +
      'The first DTU ever placed in Concordia, it carries enormous symbolic weight. ' +
      'Inspired by the Walkway Over the Hudson in Poughkeepsie — the longest elevated pedestrian bridge in the world.',
    position: { x: 100, y: 200 },
    type: 'pedestrian-bridge',
    creator: '@concordia-founders',
    citations: 340,
    inspectable: true,
  },
  {
    id: 'landmark-crossing',
    name: 'The Crossing',
    description:
      'A steel cable-stayed bridge carrying vehicle and rail traffic across the Great River at the southern end. ' +
      'Inspired by the Mid-Hudson Bridge connecting Poughkeepsie to Highland.',
    position: { x: 100, y: 1200 },
    type: 'vehicle-rail-bridge',
    creator: '@bridge-guild',
    citations: 185,
    inspectable: true,
  },
  {
    id: 'landmark-terminal',
    name: 'The Terminal',
    description:
      'The central train station in The Docks district. Departures connect Concordia to other worlds and servers. ' +
      'Inspired by the Poughkeepsie Metro-North station on the Hudson Line.',
    position: { x: 150, y: 1000 },
    type: 'train-station',
    creator: '@transit-authority',
    citations: 120,
    inspectable: true,
  },
  {
    id: 'landmark-bardavon',
    name: 'The Bardavon',
    description:
      'A grand performance hall and event venue on the main boulevard in The Exchange. ' +
      'Hosts competitions, lectures, and cultural performances. ' +
      'Inspired by the Bardavon 1869 Opera House on Main Street in Poughkeepsie.',
    position: { x: 600, y: 700 },
    type: 'event-venue',
    creator: '@culture-guild',
    citations: 95,
    inspectable: true,
  },
  {
    id: 'landmark-great-library',
    name: 'The Great Library',
    description:
      'The research centerpiece of The Academy district. A towering stone edifice housing the accumulated knowledge ' +
      'of every validated DTU in Concordia. Inspired by the Thompson Memorial Library at Vassar College.',
    position: { x: 1600, y: 300 },
    type: 'library',
    creator: '@academy-council',
    citations: 210,
    inspectable: true,
  },
];

// ── Weather ────────────────────────────────────────────────────────

/**
 * Concordia weather profile, modeled on the Hudson Valley climate.
 *
 * Poughkeepsie sits in USDA Hardiness Zone 6b with warm humid summers,
 * cold winters, and significant precipitation year-round. The river
 * moderates temperatures slightly compared to inland areas.
 */
export const CONCORDIA_WEATHER = {
  climateName: 'Hudson Valley Continental',
  seasons: ['spring', 'summer', 'autumn', 'winter'] as const,
  /** Average annual temperature in degrees Celsius. */
  baseTemperature: 12,
  /** Seasonal temperature extremes in degrees Celsius. */
  temperatureRange: { min: -10, max: 33 },
  /** Prevailing wind speed range in meters per second. */
  windSpeed: { min: 10, max: 15 },
  /** Prevailing wind direction. */
  windDirection: 'west' as const,
  /** Seismic zone rating (1-5 scale). */
  seismicZone: 2,
  /** Annual precipitation in millimeters. */
  annualRainfall: 1100,
  /** Seasonal precipitation notes. */
  precipitation: {
    spring: 'Frequent rain showers, occasional thunderstorms, snowmelt flooding risk',
    summer: 'Warm humid air, afternoon thunderstorms, occasional heat waves',
    autumn: 'Crisp air, diminishing rainfall, early frost by late October',
    winter: 'Regular snowfall, ice storms possible, persistent cold from December through February',
  },
  /** Average seasonal snow accumulation in centimeters. */
  snowAccumulation: 90,
  /** Fog frequency — river valleys produce regular morning fog. */
  fogFrequency: 'moderate',
} as const;

// ── Architectural Guide ────────────────────────────────────────────

/**
 * Concordia architectural guide.
 *
 * Reflects the organic architectural diversity of Poughkeepsie:
 * Victorian homes on tree-lined streets, brick commercial rows on
 * Main Street, industrial steel along the waterfront, and stone
 * academic buildings on the eastern hills.
 */
export const CONCORDIA_ARCHITECTURAL_GUIDE = {
  /** Default building height range in stories. */
  defaultStories: { min: 2, max: 4 },
  /**
   * Preferred material palette keyed by district ID.
   * Each entry lists primary and secondary materials.
   */
  materialPalette: {
    'district-docks': { primary: 'steel', secondary: 'timber', accent: 'cast-iron' },
    'district-exchange': { primary: 'brick', secondary: 'cast-iron', accent: 'glass' },
    'district-forge': { primary: 'steel', secondary: 'concrete', accent: 'corrugated-metal' },
    'district-academy': { primary: 'stone', secondary: 'slate', accent: 'copper' },
    'district-commons': { primary: 'stone', secondary: 'wrought-iron', accent: 'wood' },
    'district-nexus': { primary: 'stone', secondary: 'marble', accent: 'bronze' },
    'district-grid': { primary: 'steel', secondary: 'glass', accent: 'concrete' },
    'district-observatory': { primary: 'stone', secondary: 'copper', accent: 'glass' },
    'district-arena': { primary: 'stone', secondary: 'steel', accent: 'canvas' },
    'district-frontier': { primary: 'wood', secondary: 'canvas', accent: 'fieldstone' },
  },
  /** Overarching design philosophy. */
  stylePhilosophy: 'organic diversity' as const,
  /** Signature architectural features found throughout Concordia. */
  signatureFeatures: {
    rowHouses:
      'Attached multi-story residences with shared walls, individual stoops, and varied facade ornamentation — common in The Exchange and residential hills.',
    porches:
      'Covered front porches on residential structures, encouraging street-level social interaction. Wide wrap-around porches on corner buildings.',
    connectedBuildings:
      'Upper-story pedestrian bridges and covered walkways linking adjacent commercial buildings, especially along the main boulevard.',
    steepRoofs:
      'Pitched roofs designed for snow shedding, with dormers providing attic light and ventilation.',
    industrialGlazing:
      'Large multi-pane factory windows in The Forge and The Grid, maximizing natural light for work floors.',
  },
} as const;

// ── Heightmap Generator ────────────────────────────────────────────

/**
 * Generates a 2D heightmap array modeling the Concordia elevation profile.
 *
 * The profile mimics the Poughkeepsie cross-section:
 * - West edge (low x): river level (0m), representing the Hudson.
 * - x ~ 200m: steep bluff rising from 0 to ~20m.
 * - x ~ 400-800m: Main Street plateau at ~40m.
 * - x ~ 1000-1500m: rolling terrain rising to ~60m (Academy hills).
 * - x ~ 1600-2000m: eastern high ground peaking at ~80m (Observatory).
 * - A creek valley (Millrace Creek / Fallkill analogue) cuts east-to-west
 *   through approximately y = 500, depressing elevation by ~10m.
 *
 * @param width  Number of columns in the output grid.
 * @param height Number of rows in the output grid.
 * @returns A height x width array of elevation values in meters.
 */
export function generateConcordiaHeightmap(width: number, height: number): number[][] {
  const mapWidth = CONCORDIA_GEOGRAPHY.width;
  const mapDepth = CONCORDIA_GEOGRAPHY.depth;
  const creekY = CONCORDIA_GEOGRAPHY.creek.approximateY;
  const riverWidth = CONCORDIA_GEOGRAPHY.river.widthMeters;

  const heightmap: number[][] = [];

  for (let row = 0; row < height; row++) {
    const gridRow: number[] = [];
    const worldY = (row / (height - 1)) * mapDepth;

    for (let col = 0; col < width; col++) {
      const worldX = (col / (width - 1)) * mapWidth;

      // --- Base east-west elevation profile ---
      let elevation: number;

      if (worldX < riverWidth) {
        // River zone: at or below river level
        elevation = 0;
      } else if (worldX < riverWidth + 100) {
        // Steep bluff rising from waterfront (Poughkeepsie's dramatic bluff)
        const t = (worldX - riverWidth) / 100;
        elevation = t * t * 20;
      } else if (worldX < 500) {
        // Lower plateau approaching Main Street
        const t = (worldX - 300) / 200;
        elevation = 20 + t * 20;
      } else if (worldX < 900) {
        // Main Street plateau — relatively flat
        elevation = 40 + Math.sin(worldX * 0.008) * 3;
      } else if (worldX < 1400) {
        // Rolling transition to Academy hills
        const t = (worldX - 900) / 500;
        elevation = 40 + t * 20 + Math.sin(worldX * 0.012) * 4;
      } else {
        // Eastern high ground — Observatory peak
        const t = Math.min(1, (worldX - 1400) / 600);
        elevation = 60 + t * 20 + Math.sin(worldX * 0.01) * 3;
      }

      // --- Creek valley depression ---
      // The creek cuts east-to-west; depress elevation near its path.
      const creekDist = Math.abs(worldY - creekY);
      const creekHalfWidth = 40; // meters of valley influence
      if (creekDist < creekHalfWidth && worldX > riverWidth) {
        const creekFactor = 1 - creekDist / creekHalfWidth;
        // Deeper valley in the middle, shallower at edges
        elevation -= creekFactor * creekFactor * 10;
      }

      // --- Gentle north-south variation ---
      // Slight roll to prevent the map from feeling like extruded stripes.
      elevation += Math.sin(worldY * 0.005) * 2 + Math.cos(worldY * 0.012 + worldX * 0.003) * 1.5;

      // --- Small-scale terrain noise ---
      // Pseudorandom variation using deterministic sine combinations.
      const noise =
        Math.sin(worldX * 0.037 + worldY * 0.029) * 0.8 +
        Math.sin(worldX * 0.071 - worldY * 0.053) * 0.5;
      elevation += noise;

      // Clamp: river cells stay at 0, everything else stays non-negative.
      gridRow.push(Math.max(0, Math.round(elevation * 100) / 100));
    }

    heightmap.push(gridRow);
  }

  return heightmap;
}
