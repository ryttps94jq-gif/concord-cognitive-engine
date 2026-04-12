/**
 * Hybrid Lens Discovery — Auto-detect cross-domain intersections
 *
 * Some learning happens at the boundaries. A DTU that cites sources from
 * two or more domains is a bridge. Clusters of bridges become hybrid lenses.
 *
 * This is System 9 of the Concord Educational Engine. The engine maintains
 * a list of hand-authored hybrids (MANUAL_HYBRIDS) and can also scan the
 * DTU store to propose new ones automatically.
 */

/**
 * Hand-curated cross-domain lenses that ship with the system.
 *
 * @type {Array<{domains: string[], name: string, description: string}>}
 */
export const MANUAL_HYBRIDS = [
  {
    domains: ["music", "mathematics"],
    name: "Musical Set Theory",
    description: "Where pitch class sets meet group theory",
  },
  {
    domains: ["cooking", "chemistry"],
    name: "Molecular Gastronomy",
    description: "Where cuisine meets molecular science",
  },
  {
    domains: ["architecture", "psychology"],
    name: "Neuroarchitecture",
    description: "Where built environments meet mental health",
  },
  {
    domains: ["bio", "engineering"],
    name: "Biomimicry",
    description: "Where nature meets design",
  },
  {
    domains: ["physics", "finance"],
    name: "Econophysics",
    description: "Where statistical mechanics meets market dynamics",
  },
  {
    domains: ["linguistics", "code"],
    name: "Computational Linguistics",
    description: "Where natural language meets algorithms",
  },
  {
    domains: ["art", "mathematics"],
    name: "Generative Art",
    description: "Where aesthetics meet algorithms",
  },
  {
    domains: ["philosophy", "code"],
    name: "Formal Verification",
    description: "Where logic meets provable software",
  },
  {
    domains: ["medicine", "engineering"],
    name: "Biomedical Engineering",
    description: "Where healing meets hardware",
  },
  {
    domains: ["eco", "economics"],
    name: "Ecological Economics",
    description: "Where biosphere limits meet market systems",
  },
];

/** Default minimum DTU count for a cluster to be proposed as a hybrid. */
const DEFAULT_MIN_DTU_COUNT = 5;

/**
 * Hybrid Lens Discovery engine.
 */
export class HybridLensDiscovery {
  /**
   * @param {object} [deps]
   * @param {object} [deps.dtuStore]    — DTU store with listAll()/all()/query()
   * @param {object} [deps.embeddings]  — Optional embeddings service for naming hints
   * @param {object} [deps.lensManifest]— Optional lens manifest for registration
   */
  constructor({ dtuStore, embeddings, lensManifest } = {}) {
    this.dtuStore = dtuStore || null;
    this.embeddings = embeddings || null;
    this.lensManifest = lensManifest || null;
    /** @type {Array<object>} */
    this.discovered = [];
  }

  /**
   * Scan DTUs for cross-domain citations and propose hybrids.
   *
   * @param {object} [opts]
   * @param {number} [opts.minDTUCount=5] — minimum bridge DTUs to emit a hybrid
   * @returns {Promise<{ok: boolean, hybrids: object[], scanned: number, bridges: number}>}
   */
  async discoverHybrids({ minDTUCount = DEFAULT_MIN_DTU_COUNT } = {}) {
    try {
      const bridges = await this.findCrossDomainDTUs();
      const clusters = this.clusterByDomainPairs(bridges);
      const hybrids = [];

      for (const cluster of clusters) {
        if (cluster.count < minDTUCount) continue;
        const [d1, d2] = cluster.pair;
        let name;
        try {
          name = await this.suggestHybridName(d1, d2);
        } catch {
          name = `${this._titleCase(d1)} × ${this._titleCase(d2)}`;
        }
        hybrids.push({
          domains: [d1, d2],
          name,
          description: `Auto-discovered bridge lens between ${d1} and ${d2}.`,
          count: cluster.count,
          source: "discovered",
          sampleDTUs: cluster.sample,
        });
      }

      this.discovered = hybrids;
      return {
        ok: true,
        hybrids,
        scanned: await this._countAllDTUs(),
        bridges: bridges.length,
      };
    } catch (err) {
      return {
        ok: false,
        error: err && err.message ? err.message : String(err),
        hybrids: [],
        scanned: 0,
        bridges: 0,
      };
    }
  }

  /**
   * Return the set of DTUs that reference two or more distinct domains.
   *
   * @returns {Promise<object[]>}
   */
  async findCrossDomainDTUs() {
    const all = await this._listAllDTUs();
    const results = [];
    for (const dtu of all) {
      if (!dtu || typeof dtu !== "object") continue;
      const domains = this._extractDomains(dtu);
      if (domains.length >= 2) {
        results.push({ dtu, domains });
      }
    }
    return results;
  }

  /**
   * Group bridge DTUs by unordered domain pair.
   *
   * @param {Array<{dtu: object, domains: string[]}>} crossDomainDTUs
   * @returns {Array<{pair: [string, string], count: number, sample: object[]}>}
   */
  clusterByDomainPairs(crossDomainDTUs) {
    /** @type {Map<string, {pair: [string, string], count: number, sample: object[]}>} */
    const clusters = new Map();
    for (const entry of crossDomainDTUs || []) {
      const domains = [...new Set(entry.domains)].sort();
      // Emit one entry per unordered pair.
      for (let i = 0; i < domains.length; i++) {
        for (let j = i + 1; j < domains.length; j++) {
          const key = `${domains[i]}::${domains[j]}`;
          if (!clusters.has(key)) {
            clusters.set(key, {
              pair: [domains[i], domains[j]],
              count: 0,
              sample: [],
            });
          }
          const c = clusters.get(key);
          c.count += 1;
          if (c.sample.length < 3 && entry.dtu && entry.dtu.id) {
            c.sample.push({ id: entry.dtu.id, title: entry.dtu.title || null });
          }
        }
      }
    }
    return [...clusters.values()].sort((a, b) => b.count - a.count);
  }

  /**
   * Suggest a human-readable name for a hybrid. Uses manual hybrids as a
   * lookup first; falls back to a simple "A × B" form.
   *
   * @param {string} domain1
   * @param {string} domain2
   * @returns {Promise<string>}
   */
  async suggestHybridName(domain1, domain2) {
    // Check manual hybrids — the curated list has the nicest names.
    for (const hybrid of MANUAL_HYBRIDS) {
      const d = hybrid.domains.slice().sort();
      const target = [domain1, domain2].slice().sort();
      if (d[0] === target[0] && d[1] === target[1]) {
        return hybrid.name;
      }
    }

    // If an embeddings/LLM service is provided with a naming helper, try it.
    if (this.embeddings && typeof this.embeddings.nameConcept === "function") {
      try {
        const n = await this.embeddings.nameConcept({
          concepts: [domain1, domain2],
          style: "hybrid-discipline",
        });
        if (n && typeof n === "string") return n;
      } catch {
        // fall through
      }
    }

    return `${this._titleCase(domain1)} × ${this._titleCase(domain2)}`;
  }

  /**
   * Register a hybrid with the lens manifest.
   *
   * @param {object} hybrid — { domains, name, description }
   * @returns {Promise<{ok: boolean, hybrid?: object, error?: string}>}
   */
  async registerHybrid(hybrid) {
    try {
      if (!hybrid || !hybrid.name || !Array.isArray(hybrid.domains) || hybrid.domains.length < 2) {
        return { ok: false, error: "hybrid must have { name, domains: [d1, d2, ...] }" };
      }
      const slug = String(hybrid.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const manifest = {
        lensId: slug,
        domain: slug,
        name: hybrid.name,
        description: hybrid.description || `Hybrid lens bridging ${hybrid.domains.join(" and ")}`,
        category: "hybrid",
        tags: ["hybrid", ...hybrid.domains],
        parentDomains: hybrid.domains.slice(),
        source: hybrid.source || "hybrid-discovery",
      };

      if (this.lensManifest && typeof this.lensManifest.registerUserLens === "function") {
        try {
          if (typeof this.lensManifest.hasManifest === "function" && this.lensManifest.hasManifest(slug)) {
            return { ok: true, hybrid: manifest, alreadyRegistered: true };
          }
          this.lensManifest.registerUserLens(manifest);
        } catch (err) {
          return { ok: false, error: err && err.message ? err.message : String(err) };
        }
      }

      // Record in the in-memory discovered list if not already there.
      if (!this.discovered.some(h => h.name === manifest.name)) {
        this.discovered.push(manifest);
      }

      return { ok: true, hybrid: manifest };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  /**
   * Manual curated hybrid list.
   * @returns {object[]}
   */
  getManualHybrids() {
    return MANUAL_HYBRIDS;
  }

  /**
   * Auto-discovered hybrids from the most recent scan.
   * @returns {object[]}
   */
  getDiscovered() {
    return this.discovered;
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  /**
   * Extract the domain set from a DTU. Tolerates several shapes:
   *   - dtu.domains: string[]
   *   - dtu.sources: string[] or object[] with .domain
   *   - dtu.tags: string[]
   *   - dtu.domain: string
   *
   * @private
   * @param {object} dtu
   * @returns {string[]}
   */
  _extractDomains(dtu) {
    const set = new Set();
    if (Array.isArray(dtu.domains)) {
      for (const d of dtu.domains) if (d) set.add(String(d));
    }
    if (Array.isArray(dtu.sources)) {
      for (const s of dtu.sources) {
        if (!s) continue;
        if (typeof s === "string") set.add(s);
        else if (typeof s === "object" && s.domain) set.add(String(s.domain));
      }
    }
    if (Array.isArray(dtu.tags)) {
      for (const t of dtu.tags) if (t) set.add(String(t));
    }
    if (dtu.domain) set.add(String(dtu.domain));
    // Filter out generic tag noise so the pair count is meaningful.
    const noise = new Set(["seed", "hybrid", "discovered", "user", "system"]);
    return [...set].filter(d => !noise.has(d));
  }

  /**
   * List all DTUs from whichever enumeration method the store provides.
   * @private
   */
  async _listAllDTUs() {
    const store = this.dtuStore;
    if (!store) return [];
    try {
      if (typeof store.listAll === "function") {
        const r = await store.listAll();
        return Array.isArray(r) ? r : [];
      }
      if (typeof store.all === "function") {
        const r = await store.all();
        return Array.isArray(r) ? r : [];
      }
      if (typeof store.list === "function") {
        const r = await store.list();
        return Array.isArray(r) ? r : [];
      }
      if (typeof store.query === "function") {
        const r = await store.query({});
        return Array.isArray(r) ? r : [];
      }
    } catch {
      return [];
    }
    return [];
  }

  /** @private */
  async _countAllDTUs() {
    try {
      const all = await this._listAllDTUs();
      return all.length;
    } catch {
      return 0;
    }
  }

  /** @private */
  _titleCase(s) {
    if (!s) return "";
    return String(s)
      .replace(/[-_]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
}

/**
 * Factory for the HybridLensDiscovery engine.
 *
 * @param {object} [deps]
 * @returns {HybridLensDiscovery}
 */
export function createHybridLensDiscovery(deps = {}) {
  return new HybridLensDiscovery(deps);
}

export default {
  MANUAL_HYBRIDS,
  HybridLensDiscovery,
  createHybridLensDiscovery,
};
