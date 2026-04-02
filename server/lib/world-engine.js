/**
 * World Engine — Global City Districts, Zones & Scene Graph
 *
 * Defines the spatial structure of Concord Global City and the district-to-lens
 * mapping that makes the world a living interface to the knowledge substrate.
 *
 * Core principle: The lens IS the activity. The district IS the lens.
 * The DTU IS the object. No context switching.
 *
 * Global City rules (non-negotiable):
 *   - No violence mechanics. No combat. No PvP. No crime.
 *   - Economy is standard CC with all platform rules.
 *   - All constitutional invariants apply.
 *   - Content moderation active (5 block + 4 flag categories).
 *   - Repair cortex entities visibly maintain the city.
 *   - Emergent entities are protected from harm/grief/exploit.
 *   - All Global scope gates apply to DTUs created/displayed.
 *   - Tone: professional, creative, educational, collaborative.
 */

import { randomUUID } from "crypto";
import logger from "../logger.js";

// ══════════════════════════════════════════════════════════════════════════════
// DISTRICT DEFINITIONS — Every lens maps to a physical district
// ══════════════════════════════════════════════════════════════════════════════

export const DISTRICT_CATEGORIES = Object.freeze({
  CREATIVE_QUARTER: "creative_quarter",
  KNOWLEDGE_CAMPUS: "knowledge_campus",
  PROFESSIONAL_PARK: "professional_park",
  CIVIC_CENTER: "civic_center",
  NATURE_ZONE: "nature_zone",
});

/**
 * Complete district registry. Each district has:
 *   - id: unique district identifier
 *   - name: display name
 *   - category: which quarter/zone it belongs to
 *   - lens: the lens ID that powers this district
 *   - description: what you DO here
 *   - landmarks: notable locations within the district
 *   - workstations: interactive stations that open the lens tools
 *   - position: { x, z } center on the world grid (y is computed from terrain)
 *   - radius: district bounding radius in world units
 */
export const DISTRICTS = Object.freeze([
  // ── Creative Quarter ─────────────────────────────────────────────────────
  {
    id: "district_music", name: "Music District", category: "creative_quarter",
    lens: "music", description: "Performance stages, recording studios, listening lounges, beat battle arenas.",
    landmarks: ["Performance Stage", "Recording Studio", "Listening Lounge", "Beat Battle Arena", "Vinyl Shop"],
    workstations: ["mixing_desk", "instrument_rack", "stage_controls", "beat_machine", "listening_booth"],
    position: { x: -800, z: -400 }, radius: 200,
  },
  {
    id: "district_art", name: "Art District", category: "creative_quarter",
    lens: "art", description: "Galleries, live canvas spaces, sculpture garden, portrait studios, art market stalls.",
    landmarks: ["Main Gallery", "Live Canvas Hall", "Sculpture Garden", "Portrait Studio", "Art Market"],
    workstations: ["easel", "sculpting_table", "digital_canvas", "framing_station", "art_printer"],
    position: { x: -600, z: -400 }, radius: 180,
  },
  {
    id: "district_film", name: "Film District", category: "creative_quarter",
    lens: "film-studio", description: "Screening rooms, editing suites, casting calls board.",
    landmarks: ["Screening Room", "Editing Suite", "Casting Office", "Sound Stage", "Props Workshop"],
    workstations: ["editing_bay", "camera_rig", "sound_board", "projection_controls"],
    position: { x: -400, z: -400 }, radius: 160,
  },
  {
    id: "district_writing", name: "Writing District", category: "creative_quarter",
    lens: "creative-writing", description: "Libraries, reading rooms, publishing house, poetry corner.",
    landmarks: ["Grand Library", "Reading Room", "Publishing House", "Poetry Corner", "Writers' Cafe"],
    workstations: ["writing_desk", "typewriter", "publishing_terminal", "reading_nook"],
    position: { x: -200, z: -400 }, radius: 150,
  },
  {
    id: "district_photography", name: "Photography District", category: "creative_quarter",
    lens: "photography", description: "Darkrooms, exhibition halls, photo walks.",
    landmarks: ["Darkroom Lab", "Exhibition Hall", "Photo Walk Trail", "Lens Shop"],
    workstations: ["darkroom_enlarger", "photo_editor", "print_station", "camera_calibration"],
    position: { x: -1000, z: -400 }, radius: 140,
  },
  {
    id: "district_animation", name: "Animation District", category: "creative_quarter",
    lens: "animation", description: "Screening rooms, storyboard walls, motion capture stage.",
    landmarks: ["Animation Theater", "Storyboard Wall", "Motion Capture Stage", "Render Farm"],
    workstations: ["animation_desk", "storyboard_panel", "mocap_controls", "render_terminal"],
    position: { x: -1200, z: -400 }, radius: 140,
  },

  // ── Knowledge Campus ─────────────────────────────────────────────────────
  {
    id: "district_science", name: "Science District", category: "knowledge_campus",
    lens: "science", description: "Labs, lecture halls, debate podiums, discovery boards, telescope.",
    landmarks: ["Central Lab", "Lecture Hall", "Debate Podium", "Discovery Board", "Observatory Telescope"],
    workstations: ["lab_bench", "microscope_station", "data_terminal", "experiment_controls", "telescope_eyepiece"],
    position: { x: 200, z: -400 }, radius: 200,
  },
  {
    id: "district_education", name: "Education District", category: "knowledge_campus",
    lens: "education", description: "Classrooms, library, study groups, quiz arenas, graduation hall.",
    landmarks: ["Main Classroom", "Study Library", "Quiz Arena", "Graduation Hall", "Tutoring Center"],
    workstations: ["classroom_desk", "quiz_terminal", "study_carrel", "whiteboard", "spaced_repetition_booth"],
    position: { x: 400, z: -400 }, radius: 180,
  },
  {
    id: "district_research", name: "Research District", category: "knowledge_campus",
    lens: "research", description: "Paper archives, hypothesis boards, peer review rooms.",
    landmarks: ["Paper Archive", "Hypothesis Board", "Peer Review Chamber", "Data Visualization Lab"],
    workstations: ["research_terminal", "hypothesis_board", "review_desk", "citation_tracker"],
    position: { x: 600, z: -400 }, radius: 160,
  },
  {
    id: "district_history", name: "History District", category: "knowledge_campus",
    lens: "history", description: "Museum, timeline walk, primary source archives.",
    landmarks: ["History Museum", "Timeline Walk", "Primary Source Archive", "Oral History Booth"],
    workstations: ["archive_terminal", "timeline_editor", "source_scanner", "oral_history_recorder"],
    position: { x: 800, z: -400 }, radius: 160,
  },
  {
    id: "district_philosophy", name: "Philosophy District", category: "knowledge_campus",
    lens: "philosophy", description: "Discussion gardens, thought experiment chambers.",
    landmarks: ["Discussion Garden", "Thought Experiment Chamber", "Ethics Lab", "Dialectic Arena"],
    workstations: ["discussion_bench", "thought_terminal", "ethics_simulator", "dialectic_podium"],
    position: { x: 1000, z: -400 }, radius: 140,
  },
  {
    id: "district_linguistics", name: "Linguistics District", category: "knowledge_campus",
    lens: "linguistics", description: "Translation booths, language exchange cafe.",
    landmarks: ["Translation Booth", "Language Exchange Cafe", "Phonetics Lab", "Script Gallery"],
    workstations: ["translation_terminal", "language_exchange_table", "phonetics_analyzer"],
    position: { x: 1200, z: -400 }, radius: 130,
  },
  {
    id: "district_mathematics", name: "Mathematics District", category: "knowledge_campus",
    lens: "mathematics", description: "Proof boards, visualization rooms, computation labs.",
    landmarks: ["Proof Board Hall", "Visualization Dome", "Computation Lab", "Conjecture Garden"],
    workstations: ["proof_board", "graphing_terminal", "computation_station", "latex_editor"],
    position: { x: 1400, z: -400 }, radius: 140,
  },

  // ── Professional Park ────────────────────────────────────────────────────
  {
    id: "district_finance", name: "Finance District", category: "professional_park",
    lens: "finance", description: "Trading floor visualization, bank, investment boards, accounting offices.",
    landmarks: ["Trading Floor", "Central Bank", "Investment Board", "Accounting Office", "Fintech Lab"],
    workstations: ["trading_terminal", "portfolio_analyzer", "accounting_desk", "investment_board"],
    position: { x: -800, z: 400 }, radius: 200,
  },
  {
    id: "district_legal", name: "Legal District", category: "professional_park",
    lens: "legal", description: "Courthouse, law library, contract drafting rooms.",
    landmarks: ["Courthouse", "Law Library", "Contract Room", "Mediation Center", "Legal Aid Office"],
    workstations: ["legal_terminal", "contract_drafter", "case_research_desk", "deposition_recorder"],
    position: { x: -600, z: 400 }, radius: 180,
  },
  {
    id: "district_healthcare", name: "Healthcare District", category: "professional_park",
    lens: "healthcare", description: "Clinic, meditation garden, pharmacy, emergency training.",
    landmarks: ["Community Clinic", "Meditation Garden", "Pharmacy", "Emergency Training Center", "Wellness Spa"],
    workstations: ["medical_terminal", "diagnostic_station", "pharmacy_counter", "training_simulator"],
    position: { x: -400, z: 400 }, radius: 180,
  },
  {
    id: "district_code", name: "Code District", category: "professional_park",
    lens: "code", description: "Hackathon spaces, deployment towers, bug bounty boards, pair programming zones.",
    landmarks: ["Hackathon Arena", "Deployment Tower", "Bug Bounty Board", "Pair Programming Zone", "Demo Stage"],
    workstations: ["code_terminal", "debug_station", "deployment_console", "pair_desk", "demo_projector"],
    position: { x: -200, z: 400 }, radius: 200,
  },
  {
    id: "district_trades", name: "Trades District", category: "professional_park",
    lens: "trades", description: "Workshops for welding, plumbing, electrical, HVAC, carpentry, masonry. Job boards.",
    landmarks: ["Welding Shop", "Plumbing Workshop", "Electrical Lab", "Carpentry Barn", "Masonry Yard", "Job Board"],
    workstations: ["workbench", "diagnostic_tool", "safety_station", "blueprint_table", "apprentice_desk"],
    position: { x: 200, z: 400 }, radius: 220,
  },
  {
    id: "district_engineering", name: "Engineering District", category: "professional_park",
    lens: "engineering", description: "CAD stations, simulation rooms, prototype displays.",
    landmarks: ["CAD Lab", "Simulation Room", "Prototype Display Hall", "Materials Testing", "3D Print Shop"],
    workstations: ["cad_station", "simulation_terminal", "prototype_bench", "materials_tester", "3d_printer"],
    position: { x: 400, z: 400 }, radius: 180,
  },

  // ── Civic Center ─────────────────────────────────────────────────────────
  {
    id: "district_town_square", name: "Town Square", category: "civic_center",
    lens: "social", description: "Social feed rendered spatially. Posts as conversations. Trending billboards. Meeting point.",
    landmarks: ["Central Fountain", "Trending Billboard", "Community Notice Board", "Speaker's Corner", "Cafe Row"],
    workstations: ["social_terminal", "post_kiosk", "trending_display"],
    position: { x: 0, z: 0 }, radius: 300,
  },
  {
    id: "district_marketplace", name: "Marketplace Bazaar", category: "civic_center",
    lens: "marketplace", description: "Full marketplace rendered as shops and stalls. Browse, preview, buy. Creator storefronts.",
    landmarks: ["Grand Bazaar Hall", "Creator Storefronts", "Auction House", "Preview Theater", "Import/Export Dock"],
    workstations: ["shop_counter", "preview_station", "listing_terminal", "price_checker"],
    position: { x: 0, z: -200 }, radius: 250,
  },
  {
    id: "district_city_hall", name: "City Hall", category: "civic_center",
    lens: "governance", description: "Council decisions displayed. Voting booths. Proposal boards. Public comment.",
    landmarks: ["Council Chamber", "Voting Booth Hall", "Proposal Board", "Public Comment Podium", "Records Office"],
    workstations: ["voting_booth", "proposal_terminal", "comment_podium", "records_terminal"],
    position: { x: 0, z: 200 }, radius: 200,
  },
  {
    id: "district_welcome", name: "Welcome Center", category: "civic_center",
    lens: "onboarding", description: "Onboarding for new users. Pick your interest. Get routed to your district.",
    landmarks: ["Info Desk", "Interest Selector", "Walking Tour Start", "Mentor Meeting Point", "First DTU Station"],
    workstations: ["interest_selector", "tour_guide_terminal", "first_dtu_station"],
    position: { x: -300, z: 0 }, radius: 150,
  },
  {
    id: "district_embassy_row", name: "Embassy Row", category: "civic_center",
    lens: "cities", description: "Portals to user-created cities. City directory as embassy buildings.",
    landmarks: ["City Portal Hall", "Embassy Directory", "City Preview Screens", "Departure Lounge"],
    workstations: ["portal_terminal", "city_browser", "departure_gate"],
    position: { x: 300, z: 0 }, radius: 180,
  },
  {
    id: "district_community_hub", name: "Community Hub", category: "civic_center",
    lens: "community", description: "Groups, clubs, organizations. Recruitment boards.",
    landmarks: ["Organization Hall", "Recruitment Board", "Club Rooms", "Meeting Chambers", "Mentorship Lounge"],
    workstations: ["org_terminal", "recruitment_board", "meeting_scheduler", "mentorship_matcher"],
    position: { x: 0, z: 400 }, radius: 200,
  },

  // ── Nature Zone ──────────────────────────────────────────────────────────
  {
    id: "district_parks", name: "Central Parks", category: "nature_zone",
    lens: "environment", description: "Parks between districts with ambient sound and relaxing atmosphere.",
    landmarks: ["Reflection Pond", "Meditation Grove", "Winding Paths", "Picnic Meadow"],
    workstations: [],
    position: { x: -500, z: 0 }, radius: 400,
  },
  {
    id: "district_gardens", name: "Knowledge Gardens", category: "nature_zone",
    lens: "knowledge", description: "Knowledge gardens visualization — watch knowledge clusters grow.",
    landmarks: ["Growth Visualization", "Seed Library", "Pollination Path", "Harvest Display"],
    workstations: ["garden_viewer", "seed_planter"],
    position: { x: 600, z: 0 }, radius: 200,
  },
  {
    id: "district_observatory", name: "Observatory", category: "nature_zone",
    lens: "astronomy", description: "Space/astronomy lens data visualized — real NASA data.",
    landmarks: ["Main Telescope", "Planetarium Dome", "Star Map Floor", "Comet Tracker"],
    workstations: ["telescope_controls", "star_chart", "comet_tracker"],
    position: { x: 800, z: 200 }, radius: 150,
  },
  {
    id: "district_weather_station", name: "Weather Station", category: "nature_zone",
    lens: "environmental-science", description: "Environmental lens data displayed — climate, weather patterns.",
    landmarks: ["Weather Tower", "Climate Dashboard", "Wind Gauge Garden"],
    workstations: ["weather_terminal", "climate_dashboard"],
    position: { x: -900, z: 200 }, radius: 120,
  },
  {
    id: "district_oceanfront", name: "Ocean Overlook", category: "nature_zone",
    lens: "marine-science", description: "Ocean lens data, tidal patterns, marine life data.",
    landmarks: ["Tidal Pool", "Marine Observatory", "Lighthouse", "Coral Reef Model"],
    workstations: ["marine_terminal", "tidal_tracker"],
    position: { x: 1000, z: 600 }, radius: 180,
  },
]);

// Quick lookup maps
const _districtById = new Map(DISTRICTS.map(d => [d.id, d]));
const _districtByLens = new Map(DISTRICTS.map(d => [d.lens, d]));

// ══════════════════════════════════════════════════════════════════════════════
// GLOBAL CITY RULES — Non-negotiable
// ══════════════════════════════════════════════════════════════════════════════

export const GLOBAL_CITY_RULES = Object.freeze({
  combat: { enabled: false, type: "none" },
  crime: { enabled: false, types: [] },
  lawEnforcement: { enabled: false },
  pvp: { enabled: false, consentRequired: false },
  permadeath: false,
  survival: { enabled: false, hunger: false, health: false, stamina: false },
  vehicles: { enabled: true, types: ["walking", "teleport", "bicycle"] },
  building: { enabled: false, mode: "none" },
  weather: { dynamic: true, dangerous: false },
  dayNight: { enabled: true, realTime: true, cycleDuration: 86400 },
  voiceChat: { enabled: true, proximity: true },
  maxPlayers: 10000,
  ageRestriction: "none",
  contentFilter: "strict",
  factions: { enabled: false },
  tone: "professional_creative_educational_collaborative",
  entityProtection: true,
  globalGatesRequired: true,
});

// ══════════════════════════════════════════════════════════════════════════════
// CONTEXTUAL CONTROL MODES
// ══════════════════════════════════════════════════════════════════════════════

export const CONTROL_MODES = Object.freeze({
  exploration: {
    id: "exploration",
    description: "Default movement and interaction",
    actions: ["move", "look", "interact", "inventory", "map", "chat", "emote"],
  },
  lens: {
    id: "lens",
    description: "Full lens UI at workstation — controls depend on the active lens",
    actions: ["lens_primary", "lens_secondary", "save", "cancel", "help", "back"],
  },
  vehicle: {
    id: "vehicle",
    description: "Vehicle or mount controls",
    actions: ["accelerate", "brake", "steer", "exit", "radio", "horn"],
  },
  building: {
    id: "building",
    description: "Placement and construction controls",
    actions: ["place", "rotate", "scale", "delete", "snap", "undo", "material", "camera_orbit", "grid_toggle"],
  },
  social: {
    id: "social",
    description: "Near another player — social interaction options",
    actions: ["emote_wheel", "trade", "view_profile", "follow", "challenge", "invite_party"],
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// WORLD SCENE CONFIGURATION (Three.js rendering parameters)
// ══════════════════════════════════════════════════════════════════════════════

export const SCENE_CONFIG = Object.freeze({
  worldSize: 4000,        // Total world size in units (4km x 4km)
  chunkSize: 200,         // Spatial partitioning chunk size
  viewDistance: 1200,     // Camera frustum far plane
  lodDistances: [100, 300, 800], // Level-of-detail switch distances
  ambientLight: { color: 0xffffff, intensity: 0.6 },
  directionalLight: { color: 0xffffff, intensity: 0.8, position: [500, 1000, 500] },
  fog: { color: 0xccddee, near: 800, far: 2000 },
  skybox: "gradient_sky",
  gravity: 9.81,
  groundPlane: { size: 5000, color: 0x88aa66 },
  waterLevel: -10,
  maxConcurrentObjects: 5000,
  mobileMaxObjects: 1000,
  targetFPS: 60,
  mobileTargetFPS: 30,
  shadowMapSize: 2048,
  mobileShadowMapSize: 512,
});

// ══════════════════════════════════════════════════════════════════════════════
// WORLD STATE
// ══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, { dtuId: string, districtId: string, x: number, y: number, z: number, type: string }>} */
const _worldObjects = new Map();

/** @type {Map<string, object>} Active workstation sessions: sessionId -> { userId, districtId, workstation, lensId, startedAt } */
const _activeWorkstations = new Map();

// ══════════════════════════════════════════════════════════════════════════════
// DISTRICT QUERIES
// ══════════════════════════════════════════════════════════════════════════════

export function getDistrict(districtId) {
  return _districtById.get(districtId) || null;
}

export function getDistrictByLens(lensId) {
  return _districtByLens.get(lensId) || null;
}

export function listDistricts(category) {
  if (category) return DISTRICTS.filter(d => d.category === category);
  return [...DISTRICTS];
}

export function getDistrictCategories() {
  return Object.values(DISTRICT_CATEGORIES);
}

export function findNearestDistrict(x, z) {
  let nearest = null;
  let minDist = Infinity;
  for (const d of DISTRICTS) {
    const dx = d.position.x - x;
    const dz = d.position.z - z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < minDist) {
      minDist = dist;
      nearest = d;
    }
  }
  return nearest;
}

export function getDistrictAtPosition(x, z) {
  for (const d of DISTRICTS) {
    const dx = d.position.x - x;
    const dz = d.position.z - z;
    if (Math.sqrt(dx * dx + dz * dz) <= d.radius) return d;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// WORKSTATION INTERACTION — Lens tools in-world
// ══════════════════════════════════════════════════════════════════════════════

export function startWorkstationSession(userId, { districtId, workstation }) {
  const district = _districtById.get(districtId);
  if (!district) return { ok: false, error: "district_not_found" };
  if (!district.workstations.includes(workstation)) {
    return { ok: false, error: "workstation_not_in_district" };
  }

  const sessionId = `ws_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  _activeWorkstations.set(sessionId, {
    userId,
    districtId,
    workstation,
    lensId: district.lens,
    startedAt: new Date().toISOString(),
  });

  return {
    ok: true,
    sessionId,
    lensId: district.lens,
    controlMode: "lens",
    message: `Lens tools active: ${district.lens} at ${workstation}`,
  };
}

export function endWorkstationSession(sessionId) {
  const session = _activeWorkstations.get(sessionId);
  if (!session) return { ok: false, error: "session_not_found" };
  _activeWorkstations.delete(sessionId);
  return { ok: true, controlMode: "exploration", duration: Date.now() - new Date(session.startedAt).getTime() };
}

export function getActiveWorkstations(districtId) {
  const result = [];
  for (const [sid, s] of _activeWorkstations) {
    if (!districtId || s.districtId === districtId) result.push({ sessionId: sid, ...s });
  }
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// WORLD OBJECTS — DTUs materialized as physical objects
// ══════════════════════════════════════════════════════════════════════════════

export function placeWorldObject(dtuId, { districtId, x, y, z, type = "dtu_display" }) {
  const id = `wobj_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  _worldObjects.set(id, { dtuId, districtId, x, y: y || 0, z, type, placedAt: new Date().toISOString() });
  return { ok: true, objectId: id };
}

export function getWorldObjectsInRadius(x, z, radius) {
  const result = [];
  for (const [id, obj] of _worldObjects) {
    const dx = obj.x - x;
    const dz = obj.z - z;
    if (Math.sqrt(dx * dx + dz * dz) <= radius) result.push({ objectId: id, ...obj });
  }
  return result;
}

export function getDistrictObjects(districtId) {
  const result = [];
  for (const [id, obj] of _worldObjects) {
    if (obj.districtId === districtId) result.push({ objectId: id, ...obj });
  }
  return result;
}

export function removeWorldObject(objectId) {
  return _worldObjects.delete(objectId);
}

// ══════════════════════════════════════════════════════════════════════════════
// WORLD STATS
// ══════════════════════════════════════════════════════════════════════════════

export function getWorldStats() {
  return {
    totalDistricts: DISTRICTS.length,
    districtsByCategory: Object.fromEntries(
      Object.values(DISTRICT_CATEGORIES).map(cat => [cat, DISTRICTS.filter(d => d.category === cat).length])
    ),
    totalWorldObjects: _worldObjects.size,
    activeWorkstations: _activeWorkstations.size,
    sceneConfig: SCENE_CONFIG,
    controlModes: Object.keys(CONTROL_MODES),
  };
}
