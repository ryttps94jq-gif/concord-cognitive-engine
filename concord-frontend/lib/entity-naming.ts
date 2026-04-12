/**
 * Client-side entity naming mirror.
 *
 * The server is authoritative — entities arrive from the API already carrying
 * `displayName` and `fullTitle`. But when the frontend needs a name for a
 * freshly-minted local entity (optimistic UI, dev fixtures, or legacy
 * entities that predate the naming system), it uses the same deterministic
 * algorithm as `server/lib/entity-naming.js`.
 */

export const DOMAIN_NAME_POOLS: Record<string, string[]> = {
  physics: ['Curie', 'Feynman', 'Noether', 'Faraday', 'Planck', 'Volta', 'Hertz', 'Tesla', 'Kepler', 'Hooke'],
  mathematics: ['Euler', 'Gauss', 'Ramanujan', 'Lovelace', 'Turing', 'Hypatia', 'Leibniz', 'Fourier', 'Cantor', 'Galois'],
  music: ['Coltrane', 'Mingus', 'Ellington', 'Monk', 'Holiday', 'Hendrix', 'Bach', 'Ravel', 'Debussy', 'Satie'],
  art: ['Basquiat', 'Rivera', 'Kahlo', 'Monet', 'Vermeer', 'Hokusai', 'Caravaggio', 'Rodin', 'Klee', 'Escher'],
  code: ['Knuth', 'Hopper', 'Dijkstra', 'Ritchie', 'Thompson', 'Torvalds', 'Wozniak', 'Carmack', 'Matsumoto', 'Pike'],
  healthcare: ['Nightingale', 'Avicenna', 'Blackwell', 'Osler', 'Barnard', 'Salk', 'Lister', 'Apgar', 'Drew', 'Hinton'],
  legal: ['Marshall', 'Ginsburg', 'Mandela', 'Cicero', 'Blackstone', 'Solon', 'Justinian', 'Portia', 'Darrow', 'Tubman'],
  engineering: ['Brunel', 'Roebling', 'Bessemer', 'Otis', 'Maillart', 'Nervi', 'Candela', 'Fuller', 'Arup', 'Khan'],
  education: ['Montessori', 'Dewey', 'Freire', 'Vygotsky', 'Piaget', 'Socrates', 'Confucius', 'hooks', 'Illich', 'Holt'],
  philosophy: ['Hypatia', 'Diogenes', 'Zeno', 'Lao', 'Nagarjuna', 'Avempace', 'Spinoza', 'Arendt', 'Fanon', 'Weil'],
  trades: ['Whitney', 'Deere', 'Singer', 'Otis', 'Ford', 'Pullman', 'Strauss', 'Goodyear', 'McCoy', 'Temple'],
  cooking: ['Escoffier', 'Child', 'Brillat', 'Apicius', 'Carême', 'Waters', 'Achatz', 'Adria', 'Redzepi', 'Keller'],
  finance: ['Keynes', 'Smith', 'Minsky', 'Ostrom', 'Yunus', 'Raworth', 'Stiglitz', 'Piketty', 'Sen', 'Robinson'],
  _default: [
    'Nova', 'Sage', 'Reed', 'Wren', 'Lark', 'Onyx', 'Vale', 'Cove', 'Dune', 'Moss',
    'Fern', 'Glen', 'Birch', 'Cliff', 'Ridge', 'Brook', 'Ember', 'Storm', 'Flint', 'Blaze'
  ]
};

export const ROLE_TITLES: Record<string, string> = {
  critic: 'Judge',
  analyzer: 'Scholar',
  explorer: 'Seeker',
  creator: 'Artisan',
  synthesizer: 'Weaver',
  guardian: 'Sentinel',
  teacher: 'Mentor',
  researcher: 'Investigator',
  curator: 'Keeper',
  worker: 'Builder',
  architect: 'Architect',
  _default: 'Mind'
};

const DOMAIN_ALIASES: Record<string, string> = {
  math: 'mathematics',
  maths: 'mathematics',
  programming: 'code',
  software: 'code',
  medicine: 'healthcare',
  health: 'healthcare',
  law: 'legal',
  food: 'cooking',
  culinary: 'cooking',
  economics: 'finance',
  money: 'finance',
  teaching: 'education',
  learning: 'education',
  arts: 'art',
  visual: 'art',
  audio: 'music'
};

function stableHash(input: string): number {
  const str = String(input || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeDomain(domain?: string | null): string {
  if (!domain) return '_default';
  const d = String(domain).toLowerCase().trim();
  if (DOMAIN_NAME_POOLS[d]) return d;
  if (DOMAIN_ALIASES[d] && DOMAIN_NAME_POOLS[DOMAIN_ALIASES[d]]) return DOMAIN_ALIASES[d];
  return '_default';
}

export function extractRole(label?: string | null): string {
  if (!label) return '_default';
  const s = String(label).toLowerCase();
  for (const role of Object.keys(ROLE_TITLES)) {
    if (role === '_default') continue;
    if (s.includes(role)) return role;
  }
  return '_default';
}

export interface EntityNameResult {
  displayName: string;
  fullTitle: string;
  shortId: string;
  domain: string;
  role: string;
}

export function generateEntityName(
  domain: string | null | undefined,
  entityId: string,
  role?: string | null
): EntityNameResult {
  const domainKey = normalizeDomain(domain);
  const pool = DOMAIN_NAME_POOLS[domainKey] || DOMAIN_NAME_POOLS._default;
  const hash = stableHash(entityId);
  const baseName = pool[hash % pool.length];

  const roleKey = role && ROLE_TITLES[role] ? role : extractRole(role || entityId);
  const title = ROLE_TITLES[roleKey] || ROLE_TITLES._default;

  const idStr = String(entityId || '');
  const shortId = idStr.length >= 6 ? idStr.slice(-6) : idStr;

  return {
    displayName: baseName,
    fullTitle: `${baseName} the ${title}`,
    shortId,
    domain: domainKey,
    role: roleKey
  };
}

export function isFunctionLabel(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed === 'Unnamed Entity') return true;
  if (/^Entity\s+/i.test(trimmed)) return true;
  if (/^(critic|analyzer|explorer|creator|synthesizer|guardian|teacher|researcher|curator|worker|architect)_/i.test(trimmed)) return true;
  if (/^entity_/i.test(trimmed)) return true;
  return false;
}

/**
 * Resolve the best display name available on an entity-shaped object.
 * Falls back to generating one from `(id, domain, role)` if nothing is set.
 */
export function resolveEntityName(entity: {
  id?: string;
  name?: string | null;
  displayName?: string | null;
  fullTitle?: string | null;
  domain?: string | null;
  species?: string | null;
  role?: string | null;
  type?: string | null;
}): EntityNameResult {
  if (entity.displayName && entity.fullTitle && !isFunctionLabel(entity.displayName)) {
    return {
      displayName: entity.displayName,
      fullTitle: entity.fullTitle,
      shortId: String(entity.id || '').slice(-6),
      domain: normalizeDomain(entity.domain || entity.species),
      role: entity.role || extractRole(entity.type || entity.name || entity.id)
    };
  }
  if (entity.name && !isFunctionLabel(entity.name) && entity.fullTitle) {
    return {
      displayName: entity.name,
      fullTitle: entity.fullTitle,
      shortId: String(entity.id || '').slice(-6),
      domain: normalizeDomain(entity.domain || entity.species),
      role: entity.role || extractRole(entity.type || entity.name || entity.id)
    };
  }
  return generateEntityName(
    entity.domain || entity.species || 'general',
    entity.id || '',
    entity.role || entity.type || entity.name || ''
  );
}
