/**
 * Concord Cognitive Engine — Entity Naming
 *
 * Turns function-label IDs like "critic_a3f2b1" into real, deterministic
 * citizen-style names like "Coltrane the Seeker". Names are:
 *
 *   • Deterministic   — same entity ID always resolves to the same name
 *   • Domain-aware    — a music entity gets a music-domain name pool
 *   • Persistable     — callers save displayName/fullTitle on the entity
 *
 * Used by all entity creation paths (world model, personal agents,
 * emergent growth) so that every entity has an identity, not a label.
 */

// Names inspired by historical figures in each domain
export const DOMAIN_NAME_POOLS = {
  physics: ["Curie", "Feynman", "Noether", "Faraday", "Planck", "Volta", "Hertz", "Tesla", "Kepler", "Hooke"],
  mathematics: ["Euler", "Gauss", "Ramanujan", "Lovelace", "Turing", "Hypatia", "Leibniz", "Fourier", "Cantor", "Galois"],
  music: ["Coltrane", "Mingus", "Ellington", "Monk", "Holiday", "Hendrix", "Bach", "Ravel", "Debussy", "Satie"],
  art: ["Basquiat", "Rivera", "Kahlo", "Monet", "Vermeer", "Hokusai", "Caravaggio", "Rodin", "Klee", "Escher"],
  code: ["Knuth", "Hopper", "Dijkstra", "Ritchie", "Thompson", "Torvalds", "Wozniak", "Carmack", "Matsumoto", "Pike"],
  healthcare: ["Nightingale", "Avicenna", "Blackwell", "Osler", "Barnard", "Salk", "Lister", "Apgar", "Drew", "Hinton"],
  legal: ["Marshall", "Ginsburg", "Mandela", "Cicero", "Blackstone", "Solon", "Justinian", "Portia", "Darrow", "Tubman"],
  engineering: ["Brunel", "Roebling", "Bessemer", "Otis", "Maillart", "Nervi", "Candela", "Fuller", "Arup", "Khan"],
  education: ["Montessori", "Dewey", "Freire", "Vygotsky", "Piaget", "Socrates", "Confucius", "hooks", "Illich", "Holt"],
  philosophy: ["Hypatia", "Diogenes", "Zeno", "Lao", "Nagarjuna", "Avempace", "Spinoza", "Arendt", "Fanon", "Weil"],
  trades: ["Whitney", "Deere", "Singer", "Otis", "Ford", "Pullman", "Strauss", "Goodyear", "McCoy", "Temple"],
  cooking: ["Escoffier", "Child", "Brillat", "Apicius", "Carême", "Waters", "Achatz", "Adria", "Redzepi", "Keller"],
  finance: ["Keynes", "Smith", "Minsky", "Ostrom", "Yunus", "Raworth", "Stiglitz", "Piketty", "Sen", "Robinson"],

  // Fallback pool for domains without specific names
  _default: [
    "Nova", "Sage", "Reed", "Wren", "Lark", "Onyx", "Vale", "Cove", "Dune", "Moss",
    "Fern", "Glen", "Birch", "Cliff", "Ridge", "Brook", "Ember", "Storm", "Flint", "Blaze"
  ]
};

// Role → honorific title
export const ROLE_TITLES = {
  critic: "Judge",
  analyzer: "Scholar",
  explorer: "Seeker",
  creator: "Artisan",
  synthesizer: "Weaver",
  guardian: "Sentinel",
  teacher: "Mentor",
  researcher: "Investigator",
  curator: "Keeper",
  worker: "Builder",
  architect: "Architect",
  _default: "Mind"
};

/**
 * Hash a string into a stable non-negative integer.
 * Small, dependency-free, deterministic.
 */
function stableHash(input) {
  const str = String(input || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Normalize an arbitrary domain label to a pool key. Handles case,
 * aliases, and trimming. Returns "_default" for unknown domains.
 */
function normalizeDomain(domain) {
  if (!domain) return "_default";
  const d = String(domain).toLowerCase().trim();
  if (DOMAIN_NAME_POOLS[d]) return d;

  // Common aliases
  const aliases = {
    math: "mathematics",
    maths: "mathematics",
    programming: "code",
    software: "code",
    engineering: "engineering",
    medicine: "healthcare",
    health: "healthcare",
    law: "legal",
    food: "cooking",
    culinary: "cooking",
    economics: "finance",
    money: "finance",
    teaching: "education",
    learning: "education",
    arts: "art",
    visual: "art",
    audio: "music"
  };
  if (aliases[d] && DOMAIN_NAME_POOLS[aliases[d]]) return aliases[d];

  return "_default";
}

/**
 * Extract a role keyword from a label/id like "critic_a3f2b1" or
 * "analyzer_7c9d2e". Returns "_default" when nothing matches.
 */
export function extractRole(label) {
  if (!label) return "_default";
  const s = String(label).toLowerCase();
  for (const role of Object.keys(ROLE_TITLES)) {
    if (role === "_default") continue;
    if (s.includes(role)) return role;
  }
  return "_default";
}

/**
 * Generate a deterministic entity name from domain + id + role.
 *
 * @param {string} domain   - Domain name (music, code, physics, ...)
 * @param {string} entityId - Stable entity ID (used as hash seed)
 * @param {string} role     - Behavioral role (critic, analyzer, ...)
 * @returns {{
 *   displayName: string,   // e.g. "Coltrane"
 *   fullTitle: string,     // e.g. "Coltrane the Seeker"
 *   shortId: string,       // last 6 chars of entity ID
 *   domain: string,        // normalized domain key
 *   role: string           // normalized role key
 * }}
 */
export function generateEntityName(domain, entityId, role) {
  const domainKey = normalizeDomain(domain);
  const pool = DOMAIN_NAME_POOLS[domainKey] || DOMAIN_NAME_POOLS._default;

  const hash = stableHash(entityId);
  const nameIndex = hash % pool.length;
  const baseName = pool[nameIndex];

  const roleKey = role && ROLE_TITLES[role] ? role : extractRole(role || entityId);
  const title = ROLE_TITLES[roleKey] || ROLE_TITLES._default;

  const idStr = String(entityId || "");
  const shortId = idStr.length >= 6 ? idStr.slice(-6) : idStr;

  return {
    displayName: baseName,
    fullTitle: `${baseName} the ${title}`,
    shortId,
    domain: domainKey,
    role: roleKey
  };
}

/**
 * True if a display name looks like a raw function label (e.g.
 * "critic_a3f2b1") rather than a proper citizen name. Used by
 * migrations to detect entities that need retroactive naming.
 */
export function isFunctionLabel(name) {
  if (!name || typeof name !== "string") return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed === "Unnamed Entity") return true;
  if (/^Entity\s+/i.test(trimmed)) return true;
  if (/^(critic|analyzer|explorer|creator|synthesizer|guardian|teacher|researcher|curator|worker|architect)_/i.test(trimmed)) return true;
  if (/^entity_/i.test(trimmed)) return true;
  return false;
}

/**
 * Migration helper: walk a Map of entities and attach display names
 * to anything still carrying a function-label name. Safe to call
 * repeatedly — entities that already have proper names are left alone.
 *
 * @param {Map<string, any>} entities - STATE.entities or STATE.worldModel.entities
 * @returns {number} count of entities that were renamed
 */
export function migrateEntityNames(entities) {
  if (!entities || typeof entities.entries !== "function") return 0;
  let renamed = 0;
  for (const [id, entity] of entities.entries()) {
    if (!entity || typeof entity !== "object") continue;
    const currentName = entity.displayName || entity.name;
    if (currentName && !isFunctionLabel(currentName) && entity.fullTitle) continue;

    const domain = entity.domain || entity.primaryDomain || entity.species || "general";
    const role = entity.role || entity.behavior || entity.type || extractRole(currentName || id);
    const name = generateEntityName(domain, id, role);

    entity.displayName = name.displayName;
    entity.fullTitle = name.fullTitle;
    if (!entity.name || isFunctionLabel(entity.name)) {
      entity.name = name.displayName;
    }
    renamed++;
  }
  return renamed;
}

export default {
  DOMAIN_NAME_POOLS,
  ROLE_TITLES,
  generateEntityName,
  extractRole,
  isFunctionLabel,
  migrateEntityNames
};
