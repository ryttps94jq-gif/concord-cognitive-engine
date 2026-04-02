/**
 * City Manager — User-Created City Configuration & Management
 *
 * Manages city instances where each city is a configuration stored as a DTU.
 * Cities define themed environments with selectable domains, economy rules,
 * roleplay factions/jobs, and interactive entity modes.
 *
 * Core invariants:
 *   - Every user starts in DEFAULT_CITY (Concord City)
 *   - City tax capped at 2% (0.02) from platform's 5.46%
 *   - Themes restricted to known set
 *   - Owner-only mutations enforced at manager level
 */

import { randomUUID } from "crypto";
import logger from "../logger.js";

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const VALID_THEMES = new Set([
  "modern", "cyberpunk", "medieval", "fantasy", "minimal", "industrial", "nature",
]);

const VALID_DOMAINS = new Set([
  "legal", "healthcare", "finance", "trades", "music", "food",
]);

const VALID_ENTITY_MODES = new Set(["interactive", "passive", "none"]);
const VALID_VISIBILITY = new Set(["public", "private"]);
const VALID_SORT_KEYS = new Set(["activePlayers", "totalDtus", "rating", "newest"]);

const MAX_CITY_TAX = 0.02;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ══════════════════════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════════════════════

/** @type {Map<string, object>} City configs keyed by city ID */
const _cities = new Map();

/** @type {Map<string, Set<string>>} Active players per city: cityId -> Set<userId> */
const _cityPlayers = new Map();

/** @type {Map<string, string>} User home city: userId -> cityId */
const _homeCities = new Map();

// ══════════════════════════════════════════════════════════════════════════════
// DEFAULT CITY
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_CITY_ID = "city_concord_default";

/** The main Concord City — everyone starts here */
export const DEFAULT_CITY = Object.freeze({
  id: DEFAULT_CITY_ID,
  name: "Concord City",
  owner: "system",
  description: "The default Concord City — all domains active, open to everyone.",
  theme: "modern",
  activeDomains: [...VALID_DOMAINS],
  economy: { standard: true, cityTax: 0 },
  roleplay: {
    jobs: {},
    factions: ["Citizens"],
  },
  mapSeed: "concord-default-2026",
  entityMode: "interactive",
  visibility: "public",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stats: { activePlayers: 0, totalDtus: 0, rating: 0, visits: 0 },
});

// Seed default city into the store
_cities.set(DEFAULT_CITY_ID, { ...DEFAULT_CITY });
_cityPlayers.set(DEFAULT_CITY_ID, new Set());

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function _generateCityId() {
  return `city_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
}

function _nowISO() {
  return new Date().toISOString();
}

function _validateTheme(theme) {
  if (theme && !VALID_THEMES.has(theme)) {
    throw new Error(`Invalid theme "${theme}". Valid: ${[...VALID_THEMES].join(", ")}`);
  }
}

function _validateDomains(domains) {
  if (!Array.isArray(domains) || domains.length === 0) {
    throw new Error("activeDomains must be a non-empty array");
  }
  for (const d of domains) {
    if (!VALID_DOMAINS.has(d)) {
      throw new Error(`Invalid domain "${d}". Valid: ${[...VALID_DOMAINS].join(", ")}`);
    }
  }
}

function _validateEntityMode(mode) {
  if (mode && !VALID_ENTITY_MODES.has(mode)) {
    throw new Error(`Invalid entityMode "${mode}". Valid: ${[...VALID_ENTITY_MODES].join(", ")}`);
  }
}

function _validateVisibility(vis) {
  if (vis && !VALID_VISIBILITY.has(vis)) {
    throw new Error(`Invalid visibility "${vis}". Valid: ${[...VALID_VISIBILITY].join(", ")}`);
  }
}

function _validateTax(tax) {
  if (typeof tax !== "number" || tax < 0 || tax > MAX_CITY_TAX) {
    throw new Error(`cityTax must be between 0 and ${MAX_CITY_TAX} (${MAX_CITY_TAX * 100}%)`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new city configuration.
 *
 * @param {object} opts
 * @param {string} opts.name - City name
 * @param {string} opts.owner - Owner user ID
 * @param {string} [opts.description]
 * @param {string} [opts.theme="modern"]
 * @param {string[]} [opts.activeDomains]
 * @param {object} [opts.economy]
 * @param {object} [opts.roleplay]
 * @param {string} [opts.mapSeed]
 * @param {string} [opts.entityMode="interactive"]
 * @param {string} [opts.visibility="public"]
 * @returns {object} The created city config
 */
export function createCity(opts = {}) {
  const {
    name,
    owner,
    description = "",
    theme = "modern",
    activeDomains = [...VALID_DOMAINS],
    economy = { standard: true, cityTax: 0 },
    roleplay = { jobs: {}, factions: ["Citizens"] },
    mapSeed = `city-${Date.now().toString(36)}`,
    entityMode = "interactive",
    visibility = "public",
  } = opts;

  if (!name || typeof name !== "string") throw new Error("City name is required");
  if (!owner || typeof owner !== "string") throw new Error("Owner userId is required");

  _validateTheme(theme);
  _validateDomains(activeDomains);
  _validateEntityMode(entityMode);
  _validateVisibility(visibility);
  if (economy?.cityTax != null) _validateTax(economy.cityTax);

  const now = _nowISO();
  const city = {
    id: _generateCityId(),
    name,
    owner,
    description,
    theme,
    activeDomains: [...activeDomains],
    economy: {
      standard: economy.standard !== false,
      cityTax: Math.min(economy.cityTax ?? 0, MAX_CITY_TAX),
    },
    roleplay: {
      jobs: roleplay.jobs ? { ...roleplay.jobs } : {},
      factions: Array.isArray(roleplay.factions) ? [...roleplay.factions] : ["Citizens"],
    },
    mapSeed,
    entityMode,
    visibility,
    createdAt: now,
    updatedAt: now,
    stats: { activePlayers: 0, totalDtus: 0, rating: 0, visits: 0 },
  };

  _cities.set(city.id, city);
  _cityPlayers.set(city.id, new Set());

  logger.info?.(`[city-manager] Created city "${city.name}" (${city.id}) by ${owner}`);
  return { ...city };
}

/**
 * Get city by ID.
 *
 * @param {string} cityId
 * @returns {object|null}
 */
export function getCity(cityId) {
  const city = _cities.get(cityId);
  if (!city) return null;
  return { ...city, stats: { ...city.stats, activePlayers: _cityPlayers.get(cityId)?.size ?? 0 } };
}

/**
 * Update a city's configuration. Owner-only.
 *
 * @param {string} cityId
 * @param {object} updates - Fields to update
 * @param {string} ownerId - Requesting user ID (must match city owner)
 * @returns {object} Updated city
 */
export function updateCity(cityId, updates = {}, ownerId) {
  const city = _cities.get(cityId);
  if (!city) throw new Error(`City not found: ${cityId}`);
  if (city.owner !== ownerId && city.owner !== "system") {
    throw new Error("Only the city owner can update this city");
  }

  // Validate provided fields
  if (updates.theme != null) _validateTheme(updates.theme);
  if (updates.activeDomains != null) _validateDomains(updates.activeDomains);
  if (updates.entityMode != null) _validateEntityMode(updates.entityMode);
  if (updates.visibility != null) _validateVisibility(updates.visibility);
  if (updates.economy?.cityTax != null) _validateTax(updates.economy.cityTax);

  // Apply safe fields only
  const allowed = [
    "name", "description", "theme", "activeDomains", "entityMode",
    "visibility", "mapSeed",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      city[key] = Array.isArray(updates[key]) ? [...updates[key]] : updates[key];
    }
  }

  // Merge economy
  if (updates.economy) {
    city.economy = {
      ...city.economy,
      ...updates.economy,
      cityTax: Math.min(updates.economy.cityTax ?? city.economy.cityTax, MAX_CITY_TAX),
    };
  }

  // Merge roleplay
  if (updates.roleplay) {
    city.roleplay = {
      jobs: updates.roleplay.jobs ? { ...city.roleplay.jobs, ...updates.roleplay.jobs } : city.roleplay.jobs,
      factions: Array.isArray(updates.roleplay.factions) ? [...updates.roleplay.factions] : city.roleplay.factions,
    };
  }

  city.updatedAt = _nowISO();

  logger.info?.(`[city-manager] Updated city "${city.name}" (${cityId})`);
  return { ...city, stats: { ...city.stats, activePlayers: _cityPlayers.get(cityId)?.size ?? 0 } };
}

/**
 * Delete a city. Owner-only.
 *
 * @param {string} cityId
 * @param {string} ownerId
 * @returns {boolean}
 */
export function deleteCity(cityId, ownerId) {
  const city = _cities.get(cityId);
  if (!city) throw new Error(`City not found: ${cityId}`);
  if (cityId === DEFAULT_CITY_ID) throw new Error("Cannot delete the default city");
  if (city.owner !== ownerId) throw new Error("Only the city owner can delete this city");

  _cities.delete(cityId);
  _cityPlayers.delete(cityId);

  // Remove home city refs pointing to this city
  for (const [uid, hid] of _homeCities) {
    if (hid === cityId) _homeCities.delete(uid);
  }

  logger.info?.(`[city-manager] Deleted city "${city.name}" (${cityId}) by ${ownerId}`);
  return true;
}

/**
 * List cities with optional filters.
 *
 * @param {object} [opts]
 * @param {string} [opts.visibility] - Filter by visibility
 * @param {string} [opts.sortBy="newest"] - Sort key
 * @param {number} [opts.limit=20]
 * @param {number} [opts.offset=0]
 * @returns {{ cities: object[], total: number }}
 */
export function listCities(opts = {}) {
  const {
    visibility,
    sortBy = "newest",
    limit = DEFAULT_LIMIT,
    offset = 0,
  } = opts;

  let cities = [..._cities.values()].map(c => ({
    ...c,
    stats: { ...c.stats, activePlayers: _cityPlayers.get(c.id)?.size ?? 0 },
  }));

  // Filter
  if (visibility && VALID_VISIBILITY.has(visibility)) {
    cities = cities.filter(c => c.visibility === visibility);
  }

  // Sort
  if (VALID_SORT_KEYS.has(sortBy)) {
    switch (sortBy) {
      case "activePlayers":
        cities.sort((a, b) => b.stats.activePlayers - a.stats.activePlayers);
        break;
      case "totalDtus":
        cities.sort((a, b) => b.stats.totalDtus - a.stats.totalDtus);
        break;
      case "rating":
        cities.sort((a, b) => b.stats.rating - a.stats.rating);
        break;
      case "newest":
      default:
        cities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }
  }

  const total = cities.length;
  const clamped = Math.min(Math.max(limit, 1), MAX_LIMIT);
  cities = cities.slice(offset, offset + clamped);

  return { cities, total };
}

// ══════════════════════════════════════════════════════════════════════════════
// PLAYER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Add a user to a city's active players.
 *
 * @param {string} cityId
 * @param {string} userId
 * @returns {{ cityId: string, userId: string, playerCount: number }}
 */
export function joinCity(cityId, userId) {
  const city = _cities.get(cityId);
  if (!city) throw new Error(`City not found: ${cityId}`);
  if (!userId) throw new Error("userId is required");

  let players = _cityPlayers.get(cityId);
  if (!players) {
    players = new Set();
    _cityPlayers.set(cityId, players);
  }
  players.add(userId);

  city.stats.visits = (city.stats.visits || 0) + 1;

  logger.info?.(`[city-manager] User ${userId} joined city "${city.name}" (${cityId})`);
  return { cityId, userId, playerCount: players.size };
}

/**
 * Remove a user from a city's active players.
 *
 * @param {string} cityId
 * @param {string} userId
 * @returns {{ cityId: string, userId: string, playerCount: number }}
 */
export function leaveCity(cityId, userId) {
  const city = _cities.get(cityId);
  if (!city) throw new Error(`City not found: ${cityId}`);
  if (!userId) throw new Error("userId is required");

  const players = _cityPlayers.get(cityId);
  if (players) players.delete(userId);

  logger.info?.(`[city-manager] User ${userId} left city "${city.name}" (${cityId})`);
  return { cityId, userId, playerCount: players?.size ?? 0 };
}

/**
 * Get active players in a city.
 *
 * @param {string} cityId
 * @returns {string[]}
 */
export function getCityPlayers(cityId) {
  const city = _cities.get(cityId);
  if (!city) throw new Error(`City not found: ${cityId}`);
  return [...(_cityPlayers.get(cityId) ?? [])];
}

/**
 * Browse public cities sorted by popularity (active players descending).
 *
 * @returns {object[]}
 */
export function getCityDirectory() {
  return listCities({ visibility: "public", sortBy: "activePlayers", limit: MAX_LIMIT }).cities;
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME CITY
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Set a user's home city.
 *
 * @param {string} userId
 * @param {string} cityId
 * @returns {{ userId: string, cityId: string }}
 */
export function setHomeCity(userId, cityId) {
  if (!userId) throw new Error("userId is required");
  const city = _cities.get(cityId);
  if (!city) throw new Error(`City not found: ${cityId}`);

  _homeCities.set(userId, cityId);
  logger.info?.(`[city-manager] User ${userId} set home city to "${city.name}" (${cityId})`);
  return { userId, cityId };
}

/**
 * Get a user's home city. Defaults to DEFAULT_CITY if none set.
 *
 * @param {string} userId
 * @returns {object}
 */
export function getHomeCity(userId) {
  const cityId = _homeCities.get(userId) ?? DEFAULT_CITY_ID;
  return getCity(cityId) ?? getCity(DEFAULT_CITY_ID);
}
